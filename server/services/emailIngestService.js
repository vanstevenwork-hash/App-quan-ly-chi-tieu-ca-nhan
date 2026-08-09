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

const matchCard = (cards, bankShortName, last4) => cards.find(c =>
    (last4 && c.cardNumber === last4) ||
    (bankShortName && c.bankShortName?.toUpperCase() === String(bankShortName).toUpperCase())
);

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
        category: cats.includes(p.category) ? p.category : 'Khác',
    };
}

// Scan the last `days` of the inbox. Emails with a PDF attachment → statement
// (update the card's dư nợ + hạn thanh toán); text notifications → transactions.
// Nothing is written to disk/Cloudinary — PDFs are parsed in memory and dropped.
async function ingestBankEmails({ days = 7, user = null } = {}) {
    const imapUser = process.env.IMAP_EMAIL_USER || process.env.EMAIL_USER;
    const imapPass = process.env.IMAP_EMAIL_PASS || process.env.EMAIL_PASS;
    if (!imapUser || !imapPass) throw new Error('Thiếu IMAP_EMAIL_USER / IMAP_EMAIL_PASS (hoặc EMAIL_USER / EMAIL_PASS)');
    // A manual /sync passes the logged-in user so imports land in THEIR account;
    // the unauthenticated cron falls back to the env-configured user.
    if (!user) user = await resolveUser();
    if (!user) throw new Error('Không tìm thấy user để gán dữ liệu (đặt MAIL_INGEST_USER_EMAIL)');

    const cards = await Card.find({ userId: user._id, isActive: true });
    const cardLabel = (c) => c ? (c.bankShortName ? `${c.bankShortName}${c.cardNumber ? ' ••' + c.cardNumber : ''}` : (c.name || 'Thẻ')) : 'Tiền mặt';
    const seenStatements = new Set(user.mailStatementIds || []);
    const result = { scanned: 0, txCreated: 0, txSkipped: 0, statements: 0, notTx: 0, encrypted: 0, created: [] };

    // Pre-load existing transactions in the window to flag likely duplicates
    // (same manual/other entry with matching amount+type on the same day).
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
        for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
            result.scanned++;
            const env = msg.envelope || {};
            const from = env.from?.[0]?.address || '';
            const subject = env.subject || '';
            if (!fromBank(from) && !isTxSubject(subject) && !isStatementSubject(subject)) continue;

            const messageId = env.messageId || `${from}|${subject}|${env.date}`;
            const mail = await simpleParser(msg.source);
            const pdf = (mail.attachments || []).find(a => (a.contentType || '').includes('pdf') || /\.pdf$/i.test(a.filename || ''));

            // ── Statement branch (has a PDF) — parsed locally, no LLM ──
            if (pdf && (isStatementSubject(subject) || fromBank(from))) {
                if (seenStatements.has(messageId)) continue;
                let st;
                try { st = await parseStatementPdfLocal(pdf.content); }
                catch { result.encrypted++; continue; }
                seenStatements.add(messageId);
                statementsChanged = true;
                if (!st.ok) { result.encrypted++; continue; } // encrypted/scanned/unreadable

                const card = matchCard(cards, senderBankShort(from), st.last4);
                if (card) {
                    if (st.totalDue > 0) card.balance = st.totalDue; // official dư nợ kỳ sao kê
                    if (st.dueDate) card.paymentDueDay = new Date(st.dueDate).getDate();
                    if (st.statementDate) card.statementDay = new Date(st.statementDate).getDate();
                    await card.save();
                }
                result.statements++;
                continue;
            }

            // ── Transaction branch (text notification) ──
            if (await Transaction.exists({ userId: user._id, sourceEmailId: messageId })) { result.txSkipped++; continue; }
            const body = (mail.text || (mail.html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').slice(0, 4000);
            let data;
            try { data = await parseTxEmail(`Tiêu đề: ${subject}\nNgười gửi: ${from}\n\n${body}`); }
            catch { continue; }
            if (!data.isTransaction || !(data.amount > 0)) { result.notTx++; continue; }

            const card = matchCard(cards, data.bankShortName, data.last4);
            const txDate = data.date ? new Date(data.date) : (env.date || new Date());
            const tx = await Transaction.create({
                userId: user._id, createdBy: user._id,
                type: data.type, amount: data.amount, category: data.category, note: data.note,
                date: txDate,
                cardId: card ? card._id : null, paymentMethod: card ? 'card' : 'cash',
                sourceEmailId: messageId,
            });
            if (card) { applyBalance(card, data.type, data.amount); await card.save(); }
            result.txCreated++;
            result.created.push({
                _id: tx._id.toString(),
                type: data.type,
                amount: data.amount,
                category: data.category,
                note: data.note,
                date: txDate,
                source: cardLabel(card),
                // flagged if a non-email entry with same day+type+amount already exists
                maybeDuplicate: existingKeys.has(dayKey(txDate, data.type, data.amount)),
            });
        }
    } finally {
        lock.release();
        await client.logout().catch(() => { });
    }

    if (statementsChanged) {
        // keep the guard list bounded
        user.mailStatementIds = Array.from(seenStatements).slice(-300);
        await user.save();
    }
    return result;
}

module.exports = { ingestBankEmails };
