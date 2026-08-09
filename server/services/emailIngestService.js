const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Card = require('../models/Card');
const { parseStatementPdfLocal } = require('./pdfStatementParser');

// Category labels must match client/lib/mockData.ts CATEGORIES.
const EXPENSE_CATS = ['Ăn uống', 'Mua sắm', 'Di chuyển', 'Giải trí', 'Sức khỏe', 'Học tập', 'Hóa đơn', 'Trả thẻ tín dụng', 'Crypto', 'Khác'];
const INCOME_CATS = ['Lương', 'Freelance', 'Đầu tư', 'Thưởng', 'Tiền lãi', 'Khác'];

// Only look at mail that plausibly is from a bank.
const BANK_SENDER_HINTS = ['vietcombank', 'techcombank', 'hsbc', 'tpb', 'tpbank', 'vpbank', 'acb', 'mbbank', 'bidv', 'vietinbank', 'sacombank', 'vib', 'shb', 'ocb', 'napas', 'timo', 'cake', 'momo', 'shinhan', 'citi', 'uob', 'uobgroup', 'standardchartered', 'agribank', 'eximbank', 'hdbank', 'seabank', 'msb'];
const TX_SUBJECT_HINTS = ['biến động số dư', 'giao dịch', 'thông báo giao dịch', 'transaction', 'payment', 'đã thanh toán', 'trừ tiền', 'ghi nợ', 'ghi có', 'chi tiêu', 'thanh toán thẻ', 'transfer successful', 'balance'];
const STATEMENT_SUBJECT_HINTS = ['sao kê', 'sao ke', 'statement', 'e-statement', 'estatement', 'bảng kê', 'thông báo dư nợ', 'dư nợ sao kê'];

const has = (hay, arr) => arr.some(h => (hay || '').toLowerCase().includes(h));
const fromBank = (from) => has(from, BANK_SENDER_HINTS);
const isStatementSubject = (subject) => has(subject, STATEMENT_SUBJECT_HINTS);
const isTxSubject = (subject) => has(subject, TX_SUBJECT_HINTS);

function geminiModel() {
    if (!process.env.GEMINI_API_KEY) throw new Error('Thiếu GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest', generationConfig: { responseMimeType: 'application/json' } });
}
const parseJson = (raw) => { try { return JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; } };

// Which app account the imported data belongs to.
async function resolveUser() {
    if (process.env.MAIL_INGEST_USER_EMAIL) {
        const u = await User.findOne({ email: process.env.MAIL_INGEST_USER_EMAIL.toLowerCase().trim() });
        if (u) return u;
    }
    if (process.env.MAIL_INGEST_USER_ID) {
        const u = await User.findById(process.env.MAIL_INGEST_USER_ID).catch(() => null);
        if (u) return u;
    }
    return User.findOne().sort({ createdAt: 1 });
}

function applyBalance(card, type, amount) {
    const isCredit = card.cardType === 'credit';
    card.balance += type === 'income' ? (isCredit ? -amount : amount) : (isCredit ? amount : -amount);
}

const normBank = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Find the app card an email transaction belongs to. Priority:
//   1) exact last-4 of the card number,
//   2) the full bank account number saved on the card (receiveAccountNumber),
//   3) same bank (fuzzy, so 'VPB' matches 'VPBANK') — preferring the expected
//      card type (a transfer from a payment account → a debit card, not credit),
//      and never a savings book.
function matchCard(cards, { bankShortName, last4, accountNumber, preferTypes } = {}) {
    if (last4) {
        const byNum = cards.find(c => c.cardNumber && c.cardNumber === last4);
        if (byNum) return byNum;
    }
    if (accountNumber) {
        const acc = String(accountNumber).replace(/\D/g, '');
        if (acc.length >= 4) {
            const byAcc = cards.find(c => {
                const r = String(c.receiveAccountNumber || '').replace(/\D/g, '');
                return r && (r === acc || r.endsWith(acc) || acc.endsWith(r));
            });
            if (byAcc) return byAcc;
        }
    }
    if (bankShortName) {
        const b = normBank(bankShortName);
        const sameBank = cards.filter(c => {
            const cb = normBank(c.bankShortName);
            return cb && b && (cb === b || cb.includes(b) || b.includes(cb));
        });
        if (sameBank.length) {
            if (preferTypes && preferTypes.length) {
                const typed = sameBank.find(c => preferTypes.includes(c.cardType));
                if (typed) return typed;
            }
            return sameBank.find(c => c.cardType !== 'savings') || sameBank[0];
        }
    }
    return null;
}

const cardLabel = (c) => c ? (c.bankShortName ? `${c.bankShortName}${c.cardNumber ? ' ••' + c.cardNumber : ''}` : (c.name || 'Thẻ')) : 'Tiền mặt';

// Best-effort bank short-name from the sender domain (statements often don't
// print a clean code; last-4 is the primary match key anyway).
const SENDER_BANK = { vpb: 'VPB', vib: 'VIB', msb: 'MSB', bidv: 'BIDV', uob: 'UOB', hsbc: 'HSBC', cake: 'CAKE', techcombank: 'TCB', vietcombank: 'VCB', tpb: 'TPB', shinhan: 'SHBVN', acb: 'ACB', mbbank: 'MB', citi: 'CITI', sacombank: 'STB', vietinbank: 'CTG', ocb: 'OCB' };
const senderBankShort = (from) => { const f = (from || '').toLowerCase(); for (const [k, v] of Object.entries(SENDER_BANK)) if (f.includes(k)) return v; return ''; };

// ── Parse a transaction-notification email (text body) ──
async function parseTxEmail(text) {
    const prompt = `Đây là nội dung một email ngân hàng. Nếu là THÔNG BÁO GIAO DỊCH / biến động số dư, trích xuất DUY NHẤT JSON:
{"isTransaction":bool,"type":"expense|income","amount":<số nguyên VNĐ>,"note":"<mô tả/nơi giao dịch>","date":"YYYY-MM-DD hoặc rỗng","bankShortName":"<vd VCB, TCB, HSBC, MB>","last4":"<4 số cuối thẻ/tài khoản nếu có, else rỗng>","category":"<một nhãn>"}
Danh mục CHI: ${EXPENSE_CATS.join(', ')}. Danh mục THU: ${INCOME_CATS.join(', ')}.
Tiền ra (thanh toán, chi tiêu, trừ tiền, ghi nợ, dấu -) = expense; tiền vào (nhận, cộng, ghi có, dấu +) = income.
Nếu KHÔNG phải thông báo giao dịch (quảng cáo, OTP, sao kê tổng, tin tức...) → isTransaction=false. Không bịa số tiền.

${text}`;
    const r = await geminiModel().generateContent(prompt);
    const p = parseJson(r.response.text());
    const type = p.type === 'income' ? 'income' : 'expense';
    const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
    return {
        isTransaction: !!p.isTransaction,
        type,
        amount: Number.isFinite(Number(p.amount)) ? Math.max(0, Math.round(Number(p.amount))) : 0,
        note: typeof p.note === 'string' ? p.note.slice(0, 200) : '',
        date: /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : '',
        bankShortName: typeof p.bankShortName === 'string' ? p.bankShortName : '',
        last4: typeof p.last4 === 'string' ? p.last4.replace(/\D/g, '').slice(-4) : '',
        accountNumber: '',
        category: cats.includes(p.category) ? p.category : 'Khác',
    };
}

// ── Deterministic parser for VPBank NEO transaction emails ──
// VPBank's "Transfer/Payment successful" emails have a fixed field layout, so we
// pull the figures with regex — 100% reliable and free (no LLM). Returns the same
// shape as parseTxEmail, or null if this isn't a recognizable VPBank tx email.
function parseVpbankNeo(from, text) {
    if (!/vpbankonline@vpb/i.test(from || '')) return null;
    const t = (text || '').replace(/\s+/g, ' ');
    // Money out = the DEBIT amount. Two layouts: "Số tiền trích nợ" (transfer) and
    // "Số tiền thanh toán" (bill/QRPay). Amount may carry a ".00" decimal.
    const amtM = t.match(/S[ốo] ti[eề]n (?:tr[íi]ch n[ợo]|thanh to[áa]n)\s*:?\s*([\d.,]+)/i);
    if (!amtM) return null;
    const amount = Math.abs(parseInt(amtM[1].replace(/[.,]\d{2}$/, '').replace(/[.,]/g, ''), 10)) || 0;
    if (!(amount > 0)) return null;

    const acctM = t.match(/T[àa]i kho[ảa]n (?:tr[íi]ch n[ợo]|thanh to[áa]n)\s*:?\s*(\d{6,})/i);
    const accountNumber = acctM ? acctM[1] : '';
    const last4 = accountNumber ? accountNumber.slice(-4) : '';
    const dateM = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const date = dateM ? `${dateM[3]}-${dateM[2]}-${dateM[1]}` : '';

    let note = '';
    const noteM = t.match(/N[ộo]i dung chuy[eể]n ti[eề]n\s*:?\s*(.+?)\s*Details of Payment/i);
    if (noteM) note = noteM[1].trim();
    if (!note) { // bill/QRPay layout: "Dịch vụ thanh toán … Nhà cung cấp …"
        const svc = t.match(/D[ịi]ch v[ụu] thanh to[áa]n\s*:?\s*(.+?)\s*(?:Nh[àa] cung c[ấa]p|Billing)/i);
        const biller = t.match(/Nh[àa] cung c[ấa]p\s*:?\s*(.+?)\s*(?:Billing|Biller|M[ãa]|C[áa]m [ơo]n)/i);
        note = [svc && svc[1].trim(), biller && biller[1].trim()].filter(Boolean).join(' - ');
    }
    if (!note) { const benM = t.match(/T[êe]n ng[uư][ờo]i h[uư][ởo]ng\s*:?\s*(.+?)\s*Beneficiary/i); if (benM) note = 'Chuyển ' + benM[1].trim(); }
    return {
        isTransaction: true,
        type: 'expense',
        amount,
        note: (note || 'Giao dịch VPBank').slice(0, 200),
        date,
        bankShortName: 'VPB',
        last4,
        accountNumber,
        // It's debited from a payment account → a debit/eWallet card, not credit.
        preferTypes: ['debit', 'eWallet'],
        category: 'Khác',
    };
}

// ── Scan the inbox and PREVIEW transactions (nothing is written for the user to
// review first). Statement PDFs still auto-update the matched card's dư nợ +
// hạn thanh toán (low-risk). `onProgress(done, total)` is called as it goes so
// the UI can show a %. Returns { items, statements, ... } — items are NOT saved.
async function scanBankEmails({ days = 7, user = null, onProgress = null } = {}) {
    const imapUser = process.env.IMAP_EMAIL_USER || process.env.EMAIL_USER;
    const imapPass = process.env.IMAP_EMAIL_PASS || process.env.EMAIL_PASS;
    if (!imapUser || !imapPass) throw new Error('Thiếu IMAP_EMAIL_USER / IMAP_EMAIL_PASS (hoặc EMAIL_USER / EMAIL_PASS)');
    if (!user) user = await resolveUser();
    if (!user) throw new Error('Không tìm thấy user để gán dữ liệu (đặt MAIL_INGEST_USER_EMAIL)');

    const cards = await Card.find({ userId: user._id, isActive: true });
    const seenStatements = new Set(user.mailStatementIds || []);
    const result = { items: [], statements: 0, notTx: 0, encrypted: 0, txSkipped: 0 };

    // Flag likely duplicates vs a manual entry with same day+type+amount.
    const windowStart = new Date(Date.now() - days * 86_400_000);
    const existing = await Transaction.find({ userId: user._id, date: { $gte: windowStart } })
        .select('amount type date sourceEmailId').lean();
    const dayKey = (d, type, amount) => `${new Date(d).toISOString().slice(0, 10)}|${type}|${amount}`;
    const existingKeys = new Set(existing.filter(t => !t.sourceEmailId).map(t => dayKey(t.date, t.type, t.amount)));

    const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: imapUser, pass: imapPass }, logger: false });
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let statementsChanged = false;
    try {
        const since = new Date(Date.now() - days * 86_400_000);
        // 1) Gather all candidate emails first so we know the total for progress.
        const candidates = [];
        for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
            const env = msg.envelope || {};
            const from = env.from?.[0]?.address || '';
            const subject = env.subject || '';
            if (!fromBank(from) && !isTxSubject(subject) && !isStatementSubject(subject)) continue;
            candidates.push({ env, source: msg.source, from, subject });
        }
        const total = candidates.length;
        if (onProgress) onProgress(0, total);

        // 2) Process each — the Gemini parse per email is the slow bit.
        for (let i = 0; i < candidates.length; i++) {
            const { env, source, from, subject } = candidates[i];
            const messageId = env.messageId || `${from}|${subject}|${env.date}`;
            const mail = await simpleParser(source);
            const pdf = (mail.attachments || []).find(a => (a.contentType || '').includes('pdf') || /\.pdf$/i.test(a.filename || ''));

            // ── Statement branch (PDF) — parsed locally, auto-applies to the card ──
            if (pdf && (isStatementSubject(subject) || fromBank(from))) {
                if (!seenStatements.has(messageId)) {
                    let st = null;
                    try { st = await parseStatementPdfLocal(pdf.content); } catch { st = null; }
                    seenStatements.add(messageId);
                    statementsChanged = true;
                    if (st && st.ok) {
                        const card = matchCard(cards, { bankShortName: senderBankShort(from), last4: st.last4 });
                        if (card) {
                            if (st.totalDue > 0) card.balance = st.totalDue;
                            if (st.dueDate) card.paymentDueDay = new Date(st.dueDate).getDate();
                            if (st.statementDate) card.statementDay = new Date(st.statementDate).getDate();
                            await card.save();
                        }
                        result.statements++;
                    } else {
                        result.encrypted++;
                    }
                }
                if (onProgress) onProgress(i + 1, total);
                continue;
            }

            // ── Transaction branch (text notification) — PREVIEW only ──
            if (await Transaction.exists({ userId: user._id, sourceEmailId: messageId })) {
                result.txSkipped++;
                if (onProgress) onProgress(i + 1, total);
                continue;
            }
            const body = (mail.text || (mail.html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').slice(0, 4000);
            // VPBank NEO has a fixed format → parse deterministically first (reliable
            // + no LLM cost). Fall back to Gemini for other banks / formats.
            let data = parseVpbankNeo(from, body);
            if (!data) {
                try { data = await parseTxEmail(`Tiêu đề: ${subject}\nNgười gửi: ${from}\n\n${body}`); }
                catch { if (onProgress) onProgress(i + 1, total); continue; }
            }
            if (!data.isTransaction || !(data.amount > 0)) {
                result.notTx++;
                if (onProgress) onProgress(i + 1, total);
                continue;
            }

            const card = matchCard(cards, { bankShortName: data.bankShortName, last4: data.last4, accountNumber: data.accountNumber, preferTypes: data.preferTypes });
            const txDate = data.date ? new Date(data.date) : (env.date || new Date());
            result.items.push({
                type: data.type,
                amount: data.amount,
                category: data.category,
                note: data.note,
                date: txDate,
                cardId: card ? String(card._id) : null,
                source: cardLabel(card),
                sourceEmailId: messageId,
                maybeDuplicate: existingKeys.has(dayKey(txDate, data.type, data.amount)),
            });
            if (onProgress) onProgress(i + 1, total);
        }
    } finally {
        lock.release();
        await client.logout().catch(() => { });
    }

    if (statementsChanged) {
        user.mailStatementIds = Array.from(seenStatements).slice(-300);
        await user.save();
    }
    return result;
}

// ── Commit reviewed items — create the transactions the user confirmed ──
async function commitItems({ user = null, items = [] } = {}) {
    if (!user) user = await resolveUser();
    if (!user) throw new Error('Không tìm thấy user để gán dữ liệu');
    const cards = await Card.find({ userId: user._id, isActive: true });
    let created = 0, skipped = 0;
    const createdList = [];
    for (const it of Array.isArray(items) ? items : []) {
        const amount = Math.round(Number(it && it.amount));
        if (!(amount > 0)) continue;
        if (it.sourceEmailId && await Transaction.exists({ userId: user._id, sourceEmailId: it.sourceEmailId })) { skipped++; continue; }
        const type = it.type === 'income' ? 'income' : 'expense';
        const card = it.cardId ? cards.find(c => String(c._id) === String(it.cardId)) : null;
        const category = (type === 'income' ? INCOME_CATS : EXPENSE_CATS).includes(it.category) ? it.category : 'Khác';
        const tx = await Transaction.create({
            userId: user._id, createdBy: user._id,
            type, amount, category, note: typeof it.note === 'string' ? it.note.slice(0, 200) : '',
            date: it.date ? new Date(it.date) : new Date(),
            cardId: card ? card._id : null, paymentMethod: card ? 'card' : 'cash',
            sourceEmailId: it.sourceEmailId || null,
        });
        if (card) { applyBalance(card, type, amount); await card.save(); }
        created++;
        createdList.push(tx._id.toString());
    }
    return { created, skipped, ids: createdList };
}

// ── Full auto ingest (used by the cron scheduler): scan + commit in one go ──
async function ingestBankEmails({ days = 7, user = null } = {}) {
    if (!user) user = await resolveUser();
    if (!user) throw new Error('Không tìm thấy user để gán dữ liệu (đặt MAIL_INGEST_USER_EMAIL)');
    const scan = await scanBankEmails({ days, user });
    const commit = await commitItems({ user, items: scan.items });
    return {
        statements: scan.statements,
        txCreated: commit.created,
        txSkipped: (scan.txSkipped || 0) + (commit.skipped || 0),
        notTx: scan.notTx,
        encrypted: scan.encrypted,
    };
}

module.exports = { ingestBankEmails, scanBankEmails, commitItems };
