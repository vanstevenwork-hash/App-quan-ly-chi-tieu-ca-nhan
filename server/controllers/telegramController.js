const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Card = require('../models/Card');
const { hasCardAccess } = require('../utils/cardAccess');
const { sendMessage, answerCallbackQuery, editMessageText, downloadTelegramFile, sendDocument, callTelegram } = require('../utils/telegram');

// Category labels must match client/lib/mockData.ts CATEGORIES exactly so the
// app renders the right icon/colour for whatever the bot writes.
const EXPENSE_CATS = ['Ăn uống', 'Mua sắm', 'Di chuyển', 'Giải trí', 'Sức khỏe', 'Học tập', 'Hóa đơn', 'Trả thẻ tín dụng', 'Crypto', 'Khác'];
const INCOME_CATS = ['Lương', 'Freelance', 'Đầu tư', 'Thưởng', 'Tiền lãi', 'Khác'];
const catsFor = (type) => (type === 'income' ? INCOME_CATS : EXPENSE_CATS);

const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const ymOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const HELP = `🤖 <b>Ghi chi tiêu nhanh</b>

• Gõ tự nhiên: <code>cà phê 45k</code> · <code>grab 80k</code> · <code>lương 20tr</code>
• Dấu <b>+</b> ép thành khoản thu: <code>+500k lì xì</code>
• Kèm tên thẻ để ghi thẳng: <code>cà phê 45k vib</code>
• Nhiều dòng = nhiều giao dịch (mỗi dòng một cái)
• Gửi <b>ảnh hoá đơn</b> hoặc <b>tin nhắn thoại</b> → tự ghi

<b>Lệnh:</b>
/sodu – số dư các thẻ/ví
/homnay · /thang – báo cáo (kèm biểu đồ)
/tim – tìm giao dịch (vd /tim chi ăn uống tháng này)
/hoantien – hoàn tiền tháng này + thẻ nên quẹt
/ngansach – ngân sách theo danh mục
/hanmuc – hạn mức chi tổng
/dinhky – thu/chi định kỳ (lương, thuê bao…)
/xuat – xuất giao dịch tháng ra CSV
/undo – bỏ giao dịch gần nhất
/nguon – nguồn tiền mặc định
/nhac – bật/tắt nhắc chủ động`;

// ─── Amount parsing (regex, no API) ──────────────────────────────
function parseAmount(raw) {
    const s = String(raw).trim().toLowerCase();
    let m;
    if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|m)\s*(\d)?$/))) {
        let v = parseFloat(m[1].replace(',', '.')) * 1e6;
        if (m[2]) v += parseInt(m[2], 10) * 1e5;
        return Math.round(v);
    }
    if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|ngàn)$/))) return Math.round(parseFloat(m[1].replace(',', '.')) * 1e3);
    if ((m = s.match(/^(\d[\d.]*)$/))) return Math.round(parseInt(m[1].replace(/\./g, ''), 10));
    return 0;
}

// ─── Gemini parsing ──────────────────────────────────────────────
const CAT_RULES = `Quy tắc tiền: 'k'/'nghìn'=×1.000; 'tr'/'triệu'/'m'=×1.000.000; '2tr5'=2.500.000. Tiền vào (lương, thưởng, được trả, thu, nhận...) = income, còn lại = expense. Danh mục CHI: ${EXPENSE_CATS.join(', ')}. Danh mục THU: ${INCOME_CATS.join(', ')}. Chọn sát nghĩa nhất, không chắc dùng 'Khác'.`;

function geminiModel() {
    if (!process.env.GEMINI_API_KEY) throw new Error('Thiếu GEMINI_API_KEY trên server.');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest', generationConfig: { responseMimeType: 'application/json' } });
}

function parseGeminiJson(rawText, arrayMode = false) {
    try {
        return JSON.parse(rawText);
    } catch {
        const match = rawText.match(arrayMode ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
        if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
        return arrayMode ? [] : {};
    }
}

function normalizeParsed(parsed) {
    const type = parsed.type === 'income' ? 'income' : 'expense';
    const amount = Number.isFinite(Number(parsed.amount)) ? Math.max(0, Math.round(Number(parsed.amount))) : 0;
    const category = catsFor(type).includes(parsed.category) ? parsed.category : 'Khác';
    const note = typeof parsed.note === 'string' ? parsed.note.slice(0, 200) : '';
    return { type, amount, category, note };
}

async function parseSpending(text) {
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Bóc tách một giao dịch thu/chi từ câu tiếng Việt. Hôm nay ${today}.
Trả về DUY NHẤT JSON: {"type":"expense|income","amount":<số nguyên VNĐ>,"category":"...","note":"<mô tả ngắn>"}.
${CAT_RULES}
Không đọc được số tiền → amount=0, KHÔNG bịa.
Câu: "${text}"`;
    const r = await geminiModel().generateContent(prompt);
    return normalizeParsed(parseGeminiJson(r.response.text()));
}

async function parseSpendingMulti(text) {
    const prompt = `Mỗi dòng dưới đây là một giao dịch thu/chi tiếng Việt.
Trả về DUY NHẤT một MẢNG JSON, mỗi phần tử {"type":"expense|income","amount":<số nguyên VNĐ>,"category":"...","note":"<mô tả ngắn>"}.
${CAT_RULES}
Bỏ qua dòng không phải giao dịch. Không bịa số tiền.

${text}`;
    const r = await geminiModel().generateContent(prompt);
    const arr = parseGeminiJson(r.response.text(), true);
    return (Array.isArray(arr) ? arr : []).map(normalizeParsed);
}

const RECEIPT_PROMPT = `Trích xuất từ ảnh hoá đơn/biên lai/màn hình chuyển khoản tiếng Việt.
Trả về DUY NHẤT JSON: {"amount":<tổng tiền phải trả, số nguyên VNĐ, 0 nếu không đọc được>,"category":"<một trong: ${EXPENSE_CATS.join(', ')}; rỗng nếu không chắc>","note":"<tên cửa hàng/quán/người nhận, rỗng nếu không rõ>"}.
Nếu ảnh không phải hoá đơn hoặc không đọc được số tiền: amount=0. TUYỆT ĐỐI không bịa số.`;

async function parseReceiptImage(buffer, mimeType) {
    const r = await geminiModel().generateContent([
        RECEIPT_PROMPT,
        { inlineData: { data: buffer.toString('base64'), mimeType } },
    ]);
    const p = parseGeminiJson(r.response.text());
    const amount = Number.isFinite(Number(p.amount)) ? Math.max(0, Math.round(Number(p.amount))) : 0;
    const category = EXPENSE_CATS.includes(p.category) ? p.category : 'Khác';
    const note = typeof p.note === 'string' ? p.note.slice(0, 200) : '';
    return { amount, category, note };
}

// ─── Sources & balances ──────────────────────────────────────────
const CARD_EMOJI = { credit: '💳', debit: '🏧', eWallet: '📱', savings: '🏦', crypto: '₿' };
const sourceLabel = (card) => card ? `${CARD_EMOJI[card.cardType] || '💳'} ${card.bankShortName} ••${card.cardNumber}` : '💵 Tiền mặt';
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const spendingCards = (userId) => Card.find({
    userId, isActive: true, cardType: { $in: ['credit', 'debit', 'eWallet'] },
}).sort({ isDefault: -1, updatedAt: -1 });

// Mirror of transactionController's balance maths.
function applyBalance(card, type, amount, revert = false) {
    const isCredit = card.cardType === 'credit';
    let delta = type === 'income' ? (isCredit ? -amount : amount) : (isCredit ? amount : -amount);
    card.balance += revert ? -delta : delta;
}

async function commitTransaction(user, data, card) {
    const tx = await Transaction.create({
        userId: card ? card.userId : user._id,
        createdBy: user._id,
        type: data.type, amount: data.amount, category: data.category, note: data.note,
        paymentMethod: card ? 'card' : 'cash', cardId: card ? card._id : null,
        date: new Date(),
    });
    if (card) { applyBalance(card, data.type, data.amount); await card.save(); }
    return tx;
}

async function reassignTransaction(tx, newCard, fallbackUserId) {
    if (tx.paymentMethod === 'card' && tx.cardId) {
        const oldCard = await Card.findById(tx.cardId);
        if (oldCard) { applyBalance(oldCard, tx.type, tx.amount, true); await oldCard.save(); }
    }
    tx.paymentMethod = newCard ? 'card' : 'cash';
    tx.cardId = newCard ? newCard._id : null;
    tx.userId = newCard ? newCard.userId : fallbackUserId;
    if (newCard) { applyBalance(newCard, tx.type, tx.amount); await newCard.save(); }
    await tx.save();
    return tx;
}

async function resolveDefaultSource(user) {
    const d = user.telegramDefaultSource || 'ask';
    if (d === 'ask') return { mode: 'ask', card: null };
    if (d === 'cash') return { mode: 'cash', card: null };
    const access = await hasCardAccess(user._id, d);
    if (access.allowed) return { mode: 'card', card: access.card };
    return { mode: 'ask', card: null };
}

// ─── Limit alerts ────────────────────────────────────────────────
async function sumExpense(user, since) {
    const txs = await Transaction.find({ $or: [{ userId: user._id }, { createdBy: user._id }], type: 'expense', date: { $gte: since } });
    return txs.reduce((s, t) => s + t.amount, 0);
}
async function limitWarning(user) {
    const now = new Date();
    const warns = [];
    if (user.telegramDailyLimit > 0) {
        const spent = await sumExpense(user, new Date(now.getFullYear(), now.getMonth(), now.getDate()));
        if (spent > user.telegramDailyLimit) warns.push(`⚠️ Vượt hạn mức NGÀY: ${fmt(spent)}đ / ${fmt(user.telegramDailyLimit)}đ`);
    }
    if (user.telegramMonthlyLimit > 0) {
        const spent = await sumExpense(user, new Date(now.getFullYear(), now.getMonth(), 1));
        if (spent > user.telegramMonthlyLimit) warns.push(`⚠️ Vượt hạn mức THÁNG: ${fmt(spent)}đ / ${fmt(user.telegramMonthlyLimit)}đ`);
    }
    return warns.join('\n');
}

// ─── Confirmation UI ─────────────────────────────────────────────
const confirmText = (data, card) => {
    const label = data.type === 'income' ? 'Thu' : 'Chi';
    const emoji = data.type === 'income' ? '🟢' : '🔴';
    return `✅ Đã ghi ${emoji} <b>${label} ${fmt(data.amount)}đ</b>\n📂 ${data.category}${data.note ? `\n📝 ${data.note}` : ''}\n💰 ${sourceLabel(card)}`;
};
const confirmKeyboard = (txId) => ({
    reply_markup: { inline_keyboard: [
        [{ text: '↩️ Hoàn tác', callback_data: `undo:${txId}` }, { text: '🔀 Nguồn', callback_data: `move:${txId}` }],
        [{ text: '📂 Danh mục', callback_data: `cat:${txId}` }, { text: '✏️ Sửa tiền', callback_data: `edit:${txId}` }],
    ] },
});

// ─── Cashback (hoàn tiền) — same formula as client/lib/cashback.ts ───
// This month's cashback on a card: spend × rate, gated by min-spend, capped.
async function cashbackForCard(card) {
    const rate = card.cashbackRate || 0;
    if (rate <= 0) return null;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const txs = await Transaction.find({ cardId: card._id, type: 'expense', date: { $gte: start } });
    const spend = txs.reduce((s, t) => s + t.amount, 0);
    const cap = card.cashbackCap || 0;
    const minSpend = card.cashbackMinSpend || 0;
    const reached = !(minSpend > 0 && spend < minSpend);
    const raw = spend * rate / 100;
    const cashback = !reached ? 0 : (cap > 0 ? Math.min(raw, cap) : raw);
    return { rate, spend, cap, minSpend, cashback, reached, capped: cap > 0 && raw > cap && reached, needMore: minSpend > 0 ? Math.max(0, minSpend - spend) : 0 };
}

// One-line cashback hint appended to an expense confirmation on a cashback card.
async function cashbackNote(card) {
    const cb = await cashbackForCard(card);
    if (!cb) return '';
    if (!cb.reached) return `💵 Hoàn ${cb.rate}% — cần chi thêm ${fmt(cb.needMore)}đ để đạt mốc`;
    return `💵 Hoàn tiền tháng này: ~${fmt(cb.cashback)}đ (${cb.rate}%)${cb.capped ? ` · đã chạm trần ${fmt(cb.cap)}đ` : ''}`;
}

// This month's spend in one category vs its budget (if set).
async function budgetWarning(user, category) {
    const limit = (user.telegramCategoryBudgets || {})[category];
    if (!(limit > 0)) return '';
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const txs = await Transaction.find({ $or: [{ userId: user._id }, { createdBy: user._id }], type: 'expense', category, date: { $gte: start } });
    const spent = txs.reduce((s, t) => s + t.amount, 0);
    if (spent > limit) return `📛 Ngân sách ${category}: ${fmt(spent)}đ / ${fmt(limit)}đ — đã vượt`;
    if (spent >= limit * 0.8) return `⚠️ Ngân sách ${category}: ${fmt(spent)}đ / ${fmt(limit)}đ — sắp hết`;
    return '';
}

// Full confirmation body: base + (for expenses) limit/budget warning + cashback.
async function confirmBody(user, data, card) {
    let text = confirmText(data, card);
    if (data.type === 'expense') {
        const extras = [];
        const w = await limitWarning(user); if (w) extras.push(w);
        const b = await budgetWarning(user, data.category); if (b) extras.push(b);
        if (card) { const cn = await cashbackNote(card); if (cn) extras.push(cn); }
        if (extras.length) text += `\n\n${extras.join('\n')}`;
    }
    return text;
}

async function sendConfirmation(chatId, user, data, card, tx) {
    await sendMessage(chatId, await confirmBody(user, data, card), confirmKeyboard(tx._id));
}

function buildSourceRows(cards, cbFor, { includeCash = true, includeAsk = false } = {}) {
    const rows = [];
    if (includeCash) rows.push([{ text: '💵 Tiền mặt', callback_data: cbFor('cash') }]);
    for (const c of cards) rows.push([{ text: sourceLabel(c), callback_data: cbFor(String(c._id)) }]);
    if (includeAsk) rows.push([{ text: '❓ Luôn hỏi', callback_data: cbFor('ask') }]);
    return rows;
}

// ─── Pending state (awaiting a tap) ──────────────────────────────
const pending = new Map();      // pendingId -> parsed + exp   (source pick)
const pendingEdit = new Map();  // chatId    -> { txId, exp }  (amount edit)
const PENDING_TTL = 15 * 60 * 1000;
function putPending(data) {
    const id = crypto.randomBytes(4).toString('hex');
    pending.set(id, { ...data, exp: Date.now() + PENDING_TTL });
    return id;
}
function getPending(id) {
    const p = pending.get(id);
    if (!p) return null;
    if (Date.now() > p.exp) { pending.delete(id); return null; }
    return p;
}
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of pending) if (now > v.exp) pending.delete(k);
    for (const [k, v] of pendingEdit) if (now > v.exp) pendingEdit.delete(k);
}, 5 * 60 * 1000).unref?.();

async function sendSourcePicker(chatId, user, pendingId, parsed, opts = {}) {
    const cards = opts.cards || (await spendingCards(user._id)).slice(0, 10);
    const rows = buildSourceRows(cards, (s) => `pick:${pendingId}:${s}`, { includeCash: opts.includeCash !== false });
    rows.push([{ text: '❌ Huỷ', callback_data: `pick:${pendingId}:cancel` }]);
    const label = parsed.type === 'income' ? 'Thu' : 'Chi';
    const emoji = parsed.type === 'income' ? '🟢' : '🔴';
    const q = opts.prompt || (parsed.type === 'income' ? 'Cộng tiền vào đâu?' : 'Ghi vào nguồn nào?');
    await sendMessage(
        chatId,
        `${emoji} <b>${label} ${fmt(parsed.amount)}đ</b> · ${parsed.category}${parsed.note ? ` · ${parsed.note}` : ''}\n\n👉 ${q}`,
        { reply_markup: { inline_keyboard: rows } }
    );
}

async function recordWithDefault(chatId, user, parsed) {
    const def = await resolveDefaultSource(user);
    if (def.mode === 'ask') {
        const pendingId = putPending({ userId: user._id, ...parsed });
        return sendSourcePicker(chatId, user, pendingId, parsed);
    }
    const tx = await commitTransaction(user, parsed, def.card);
    return sendConfirmation(chatId, user, parsed, def.card, tx);
}

// ─── Inline-button handlers ──────────────────────────────────────
async function handlePick(cq, pendingId, source) {
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    const p = getPending(pendingId);
    if (!p) {
        await answerCallbackQuery(cq.id, 'Yêu cầu đã hết hạn');
        await editMessageText(chatId, messageId, '⌛ Yêu cầu đã hết hạn. Gõ lại giao dịch nhé.');
        return;
    }
    if (source === 'cancel') {
        pending.delete(pendingId);
        await answerCallbackQuery(cq.id, 'Đã huỷ');
        await editMessageText(chatId, messageId, '❌ Đã huỷ.');
        return;
    }
    const user = await User.findById(p.userId);
    if (!user) { await answerCallbackQuery(cq.id); return; }

    let card = null;
    if (source !== 'cash') {
        const access = await hasCardAccess(user._id, source);
        if (!access.allowed) { await answerCallbackQuery(cq.id, 'Không có quyền dùng thẻ này'); return; }
        card = access.card;
    }
    const tx = await commitTransaction(user, p, card);
    pending.delete(pendingId);
    await answerCallbackQuery(cq.id, 'Đã ghi ✅');
    await editMessageText(chatId, messageId, await confirmBody(user, p, card), confirmKeyboard(tx._id));
}

async function handleMove(cq, txId) {
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    const user = await User.findOne({ telegramChatId: String(chatId) });
    const tx = await Transaction.findById(txId);
    if (!user || !tx) { await answerCallbackQuery(cq.id, 'Không tìm thấy giao dịch'); return; }
    const cards = (await spendingCards(user._id)).slice(0, 10);
    const rows = buildSourceRows(cards, (s) => `mv:${txId}:${s}`, { includeCash: true });
    rows.push([{ text: '⬅️ Thôi', callback_data: `back:${txId}` }]);
    await answerCallbackQuery(cq.id);
    await editMessageText(chatId, messageId, `🔀 Đổi nguồn cho <b>${fmt(tx.amount)}đ · ${tx.category}</b>\n\n👉 Chọn nguồn mới:`, { reply_markup: { inline_keyboard: rows } });
}

async function handleMv(cq, txId, source) {
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    const user = await User.findOne({ telegramChatId: String(chatId) });
    const tx = await Transaction.findById(txId);
    if (!user || !tx) { await answerCallbackQuery(cq.id, 'Không tìm thấy'); return; }
    let newCard = null;
    if (source !== 'cash') {
        const access = await hasCardAccess(user._id, source);
        if (!access.allowed) { await answerCallbackQuery(cq.id, 'Không có quyền dùng thẻ này'); return; }
        newCard = access.card;
    }
    await reassignTransaction(tx, newCard, user._id);
    await answerCallbackQuery(cq.id, 'Đã đổi ✅');
    await editMessageText(chatId, messageId, await confirmBody(user, tx, newCard), confirmKeyboard(tx._id));
}

// Restore the confirmation card (used by "⬅️ Thôi" in move/category views).
async function handleBack(cq, txId) {
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    const tx = await Transaction.findById(txId);
    if (!tx) { await answerCallbackQuery(cq.id); return; }
    const card = tx.cardId ? await Card.findById(tx.cardId) : null;
    await answerCallbackQuery(cq.id);
    await editMessageText(chatId, messageId, confirmText(tx, card), confirmKeyboard(tx._id));
}

async function handleCat(cq, txId) {
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    const tx = await Transaction.findById(txId);
    if (!tx) { await answerCallbackQuery(cq.id); return; }
    const cats = catsFor(tx.type);
    const rows = [];
    let row = [];
    cats.forEach((c, i) => { row.push({ text: c, callback_data: `catset:${txId}:${i}` }); if (row.length === 2) { rows.push(row); row = []; } });
    if (row.length) rows.push(row);
    rows.push([{ text: '⬅️ Thôi', callback_data: `back:${txId}` }]);
    await answerCallbackQuery(cq.id);
    await editMessageText(chatId, messageId, `📂 Chọn danh mục mới cho <b>${fmt(tx.amount)}đ</b>:`, { reply_markup: { inline_keyboard: rows } });
}

async function handleCatSet(cq, txId, idx) {
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    const tx = await Transaction.findById(txId);
    if (!tx) { await answerCallbackQuery(cq.id); return; }
    const cats = catsFor(tx.type);
    const cat = cats[Number(idx)];
    if (cat) { tx.category = cat; await tx.save(); }
    const card = tx.cardId ? await Card.findById(tx.cardId) : null;
    await answerCallbackQuery(cq.id, 'Đã đổi danh mục ✅');
    await editMessageText(chatId, messageId, confirmText(tx, card), confirmKeyboard(tx._id));
}

async function handleEditAmount(cq, txId) {
    const chatId = cq.message?.chat?.id;
    pendingEdit.set(String(chatId), { txId, exp: Date.now() + PENDING_TTL });
    await answerCallbackQuery(cq.id);
    await sendMessage(chatId, '✏️ Nhắn <b>số tiền mới</b> (vd <code>50k</code>, <code>2tr</code>, <code>120000</code>):');
}

async function applyAmountEdit(chatId, user, txId, amount) {
    const tx = await Transaction.findById(txId);
    if (!tx) return void sendMessage(chatId, 'Không tìm thấy giao dịch để sửa.');
    let card = null;
    if (tx.paymentMethod === 'card' && tx.cardId) {
        card = await Card.findById(tx.cardId);
        if (card) applyBalance(card, tx.type, tx.amount, true); // revert old amount
    }
    tx.amount = amount;
    if (card) { applyBalance(card, tx.type, amount); await card.save(); } // apply new
    await tx.save();
    await sendConfirmation(chatId, user, tx, card, tx);
}

async function handleSetsrc(cq, source) {
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    const user = await User.findOne({ telegramChatId: String(chatId) });
    if (!user) { await answerCallbackQuery(cq.id); return; }
    let label;
    if (source === 'ask') { user.telegramDefaultSource = 'ask'; label = '❓ Luôn hỏi'; }
    else if (source === 'cash') { user.telegramDefaultSource = 'cash'; label = '💵 Tiền mặt'; }
    else {
        const access = await hasCardAccess(user._id, source);
        if (!access.allowed) { await answerCallbackQuery(cq.id, 'Không có quyền'); return; }
        user.telegramDefaultSource = source; label = sourceLabel(access.card);
    }
    await user.save();
    await answerCallbackQuery(cq.id, 'Đã lưu ✅');
    await editMessageText(chatId, messageId, `⚙️ Nguồn mặc định: <b>${label}</b>\nTừ giờ câu không nêu thẻ sẽ ghi vào đây.`);
}

// ─── Commands ────────────────────────────────────────────────────
async function handleNguon(chatId, user) {
    const cards = (await spendingCards(user._id)).slice(0, 10);
    const rows = buildSourceRows(cards, (s) => `setsrc:${s}`, { includeCash: true, includeAsk: true });
    const def = await resolveDefaultSource(user);
    const cur = def.mode === 'ask' ? '❓ Luôn hỏi' : sourceLabel(def.card);
    await sendMessage(chatId, `⚙️ <b>Nguồn mặc định</b>\nHiện tại: <b>${cur}</b>\n\nKhi bạn nhập không nêu thẻ, giao dịch sẽ ghi vào nguồn này. Chọn:`, { reply_markup: { inline_keyboard: rows } });
}

async function undoLast(chatId, user) {
    const tx = await Transaction.findOne({ createdBy: user._id }).sort({ createdAt: -1 });
    if (!tx) return void sendMessage(chatId, 'Chưa có giao dịch nào để hoàn tác.');
    if (tx.paymentMethod === 'card' && tx.cardId) {
        const card = await Card.findById(tx.cardId);
        if (card) { applyBalance(card, tx.type, tx.amount, true); await card.save(); }
    }
    await Transaction.findByIdAndDelete(tx._id);
    const label = tx.type === 'income' ? 'Thu' : 'Chi';
    await sendMessage(chatId, `↩️ Đã hoàn tác: <b>${label} ${fmt(tx.amount)}đ</b> · ${tx.category}${tx.note ? ` · ${tx.note}` : ''}`);
}

async function handleUndo(cq, txId) {
    const chatId = cq.message?.chat?.id;
    const user = await User.findOne({ telegramChatId: String(chatId) });
    const tx = await Transaction.findById(txId);
    if (tx && user && (tx.userId.toString() === user._id.toString() || tx.createdBy?.toString() === user._id.toString())) {
        if (tx.paymentMethod === 'card' && tx.cardId) {
            const card = await Card.findById(tx.cardId);
            if (card) { applyBalance(card, tx.type, tx.amount, true); await card.save(); }
        }
        await Transaction.findByIdAndDelete(txId);
    }
    await answerCallbackQuery(cq.id, 'Đã hoàn tác');
    await editMessageText(chatId, cq.message.message_id, '↩️ Đã hoàn tác giao dịch.');
}

// Text bar chart for the top expense categories.
async function sendReport(chatId, user, period) {
    const now = new Date();
    const start = period === 'day'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth(), 1);
    const title = period === 'day' ? 'Hôm nay' : `Tháng ${now.getMonth() + 1}`;
    const txs = await Transaction.find({ $or: [{ userId: user._id }, { createdBy: user._id }], date: { $gte: start } });
    let inc = 0, exp = 0;
    const byCat = {};
    for (const t of txs) {
        if (t.type === 'income') inc += t.amount;
        else { exp += t.amount; byCat[t.category] = (byCat[t.category] || 0) + t.amount; }
    }
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = top.length ? top[0][1] : 0;
    const chart = top.map(([c, v]) => {
        const blocks = max ? Math.max(1, Math.round((v / max) * 10)) : 0;
        const pct = exp ? Math.round((v / exp) * 100) : 0;
        return `${c}\n<code>${'█'.repeat(blocks)}${'░'.repeat(10 - blocks)}</code> ${fmt(v)}đ · ${pct}%`;
    }).join('\n');
    await sendMessage(chatId,
        `📊 <b>${title}</b>\n🔴 Chi: <b>${fmt(exp)}đ</b>\n🟢 Thu: <b>${fmt(inc)}đ</b>\n⚖️ Chênh lệch: <b>${fmt(inc - exp)}đ</b>${chart ? `\n\n<b>Chi theo danh mục:</b>\n${chart}` : ''}\n\n<i>${txs.length} giao dịch</i>`);
}

async function handleHanmuc(chatId, user, argText) {
    const arg = argText.trim().toLowerCase();
    if (!arg) {
        const d = user.telegramDailyLimit, m = user.telegramMonthlyLimit;
        return void sendMessage(chatId, `🚦 <b>Hạn mức chi</b>\nNgày: ${d > 0 ? fmt(d) + 'đ' : '—'}\nTháng: ${m > 0 ? fmt(m) + 'đ' : '—'}\n\nĐặt: <code>/hanmuc ngày 200k</code> · <code>/hanmuc tháng 5tr</code>\nTắt: <code>/hanmuc off</code>`);
    }
    if (arg === 'off') { user.telegramDailyLimit = 0; user.telegramMonthlyLimit = 0; await user.save(); return void sendMessage(chatId, '✅ Đã tắt cảnh báo hạn mức.'); }
    let m;
    if ((m = arg.match(/ng[àa]y\s*(.+)/))) {
        const v = parseAmount(m[1]);
        if (v > 0) { user.telegramDailyLimit = v; await user.save(); return void sendMessage(chatId, `✅ Hạn mức NGÀY: ${fmt(v)}đ`); }
    }
    if ((m = arg.match(/th[áa]ng\s*(.+)/))) {
        const v = parseAmount(m[1]);
        if (v > 0) { user.telegramMonthlyLimit = v; await user.save(); return void sendMessage(chatId, `✅ Hạn mức THÁNG: ${fmt(v)}đ`); }
    }
    return void sendMessage(chatId, 'Cú pháp: <code>/hanmuc ngày 200k</code> hoặc <code>/hanmuc tháng 5tr</code>');
}

async function handleHoantien(chatId, user) {
    const cards = await Card.find({ userId: user._id, isActive: true, cashbackRate: { $gt: 0 } }).sort({ cashbackRate: -1 });
    if (!cards.length) return void sendMessage(chatId, '💵 Chưa có thẻ nào cấu hình hoàn tiền.\nMở app → sửa thẻ → đặt % hoàn tiền để bot theo dõi.');

    let total = 0;
    const lines = [];
    const suggestable = [];
    for (const c of cards) {
        const cb = await cashbackForCard(c);
        total += cb.cashback;
        let line = `${sourceLabel(c)} · <b>${cb.rate}%</b>\n  Chi ${fmt(cb.spend)}đ → hoàn ~<b>${fmt(cb.cashback)}đ</b>`;
        if (!cb.reached) line += `\n  ⚠️ cần chi thêm ${fmt(cb.needMore)}đ để đạt mốc`;
        else if (cb.capped) line += `\n  🔒 đã chạm trần ${fmt(cb.cap)}đ`;
        lines.push(line);
        if (cb.reached && !cb.capped) suggestable.push({ card: c, rate: cb.rate, remaining: cb.cap > 0 ? cb.cap - cb.cashback : Infinity });
    }
    // Best card to keep swiping: highest rate, then most cap headroom left.
    suggestable.sort((a, b) => (b.rate - a.rate) || (b.remaining - a.remaining));
    const best = suggestable[0];
    const tip = best
        ? `\n\n💡 Nên quẹt: <b>${sourceLabel(best.card)}</b> (${best.rate}%${best.remaining !== Infinity ? `, còn ~${fmt(best.remaining)}đ hoàn` : ''})`
        : '';

    await sendMessage(chatId, `💵 <b>Hoàn tiền tháng ${new Date().getMonth() + 1}</b>\n${lines.join('\n')}\n\nTổng ước tính: <b>~${fmt(total)}đ</b>${tip}`);
}

async function handleDinhky(chatId, user, argText) {
    const arg = argText.trim();
    if (!arg) {
        if (!user.telegramRecurring.length) {
            return void sendMessage(chatId, `🔁 <b>Thu/chi định kỳ</b>\nChưa có mục nào.\n\nThêm thu: <code>/dinhky lương 20tr ngày 5</code>\nThêm chi: <code>/dinhky netflix 260k ngày 1</code>\nVào thẻ: <code>/dinhky lương 20tr ngày 5 vào vcb</code>\nXoá: <code>/dinhky xoa 1</code>`);
        }
        const list = user.telegramRecurring.map((r, i) => `${i + 1}. ${r.type === 'income' ? '🟢' : '🔴'} ${fmt(r.amount)}đ · ${r.category}${r.note ? ` (${r.note})` : ''} — ngày ${r.day}`).join('\n');
        return void sendMessage(chatId, `🔁 <b>Thu/chi định kỳ</b>\n${list}\n\nThêm: <code>/dinhky lương 20tr ngày 5</code>\nXoá: <code>/dinhky xoa &lt;số&gt;</code>`);
    }
    let m;
    if ((m = arg.match(/^x[oó]a\s+(\d+)/i))) {
        const idx = parseInt(m[1], 10) - 1;
        if (idx >= 0 && idx < user.telegramRecurring.length) {
            const removed = user.telegramRecurring.splice(idx, 1)[0];
            await user.save();
            return void sendMessage(chatId, `🗑️ Đã xoá định kỳ: ${fmt(removed.amount)}đ · ${removed.category}`);
        }
        return void sendMessage(chatId, 'Số thứ tự không hợp lệ.');
    }
    const dm = arg.match(/ng[àa]y\s*(\d{1,2})/i);
    const day = dm ? Math.min(28, Math.max(1, parseInt(dm[1], 10))) : 1;
    let desc = arg.replace(/ng[àa]y\s*\d{1,2}/i, '').trim();

    const cards = await spendingCards(user._id);
    const matched = cards.filter(c => new RegExp(`\\b${escapeRegExp(c.bankShortName)}\\b`, 'i').test(desc));
    let source = 'cash', srcCard = null;
    if (matched.length === 1) {
        srcCard = matched[0];
        source = String(srcCard._id);
        desc = desc.replace(/\bv[àa]o\b/ig, '').replace(new RegExp(`\\b${escapeRegExp(srcCard.bankShortName)}\\b`, 'ig'), '').replace(/\s{2,}/g, ' ').trim();
    }
    let parsed;
    try { parsed = await parseSpending(desc); }
    catch (e) { return void sendMessage(chatId, `❌ ${e.message}`); }
    if (!parsed.amount) return void sendMessage(chatId, '🤔 Chưa rõ số tiền. Vd: <code>/dinhky lương 20tr ngày 5</code>');

    user.telegramRecurring.push({ type: parsed.type, amount: parsed.amount, category: parsed.category, note: parsed.note, day, source });
    await user.save();
    await sendMessage(chatId, `✅ Đã đặt định kỳ: ${parsed.type === 'income' ? '🟢' : '🔴'} <b>${fmt(parsed.amount)}đ</b> · ${parsed.category} — mỗi <b>ngày ${day}</b> vào ${sourceLabel(srcCard)}.\nBot sẽ tự ghi vào ngày đó.`);
}

async function handleBatch(chatId, user, text) {
    let items;
    try { items = await parseSpendingMulti(text); }
    catch (e) { return void sendMessage(chatId, `❌ ${e.message}`); }
    items = items.filter(i => i.amount > 0);
    if (!items.length) return void sendMessage(chatId, '🤔 Không nhận ra giao dịch nào. Mỗi dòng nên có số tiền, vd "cà phê 45k".');

    const def = await resolveDefaultSource(user);
    const card = def.mode === 'card' ? def.card : null;
    let inc = 0, exp = 0;
    const lines = [];
    for (const it of items) {
        await commitTransaction(user, it, card);
        if (it.type === 'income') inc += it.amount; else exp += it.amount;
        lines.push(`${it.type === 'income' ? '🟢' : '🔴'} ${fmt(it.amount)}đ · ${it.category}${it.note ? ` · ${it.note}` : ''}`);
    }
    let text2 = `✅ Đã ghi <b>${items.length}</b> giao dịch vào ${sourceLabel(card)}:\n${lines.join('\n')}\n\n🔴 Chi ${fmt(exp)}đ · 🟢 Thu ${fmt(inc)}đ\n<i>Sai chỗ nào gõ /undo để bỏ cái gần nhất.</i>`;
    const w = await limitWarning(user); if (w) text2 += `\n\n${w}`;
    await sendMessage(chatId, text2);
}

async function handlePhoto(chatId, user, photos) {
    try {
        await sendMessage(chatId, '🔍 Đang đọc hoá đơn…');
        const fileId = photos[photos.length - 1].file_id;
        const { buffer, mimeType } = await downloadTelegramFile(fileId);
        const r = await parseReceiptImage(buffer, mimeType);
        if (!r.amount) return void sendMessage(chatId, '😕 Không đọc được số tiền trên ảnh. Thử ảnh rõ hơn, hoặc gõ tay nhé.');
        await recordWithDefault(chatId, user, { type: 'expense', amount: r.amount, category: r.category, note: r.note });
    } catch (e) {
        console.error('❌ Telegram photo error:', e.message);
        await sendMessage(chatId, `❌ Lỗi đọc ảnh: ${e.message}`);
    }
}

// ─── /sodu — balances at a glance ────────────────────────────────
async function handleSodu(chatId, user) {
    const cards = await Card.find({ userId: user._id, isActive: true }).sort({ isDefault: -1 });
    if (!cards.length) return void sendMessage(chatId, '💳 Bạn chưa có thẻ/tài khoản nào trong app.');
    const groups = { bank: [], credit: [], savings: [], other: [] };
    for (const c of cards) {
        if (c.cardType === 'credit') groups.credit.push(c);
        else if (c.cardType === 'savings') groups.savings.push(c);
        else if (c.cardType === 'debit' || c.cardType === 'eWallet') groups.bank.push(c);
        else groups.other.push(c);
    }
    const sum = (arr) => arr.reduce((s, c) => s + (c.balance || 0), 0);
    const block = (title, arr) => arr.length ? `\n<b>${title}</b>\n` + arr.map(c => `  ${sourceLabel(c)}: ${fmt(c.balance || 0)}đ`).join('\n') : '';
    const assets = sum(groups.bank) + sum(groups.savings) + sum(groups.other);
    const debt = sum(groups.credit);
    await sendMessage(chatId,
        `💰 <b>Số dư</b>` +
        block('Tài khoản & ví', groups.bank) +
        block('Tiết kiệm', groups.savings) +
        block('Khác', groups.other) +
        block('Tín dụng (dư nợ)', groups.credit) +
        `\n\n📊 Tài sản: <b>${fmt(assets)}đ</b>${debt ? ` · Dư nợ: <b>${fmt(debt)}đ</b>` : ''}\n💎 Ròng: <b>${fmt(assets - debt)}đ</b>`);
}

// ─── /ngansach — per-category budgets ────────────────────────────
async function handleNgansach(chatId, user, argText) {
    const arg = argText.trim();
    const budgets = user.telegramCategoryBudgets || {};
    if (!arg) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const entries = Object.entries(budgets).filter(([, v]) => v > 0);
        if (!entries.length) {
            return void sendMessage(chatId, `📊 <b>Ngân sách theo danh mục</b>\nChưa đặt mục nào.\n\nĐặt: <code>/ngansach Ăn uống 3tr</code>\nXoá: <code>/ngansach Ăn uống off</code>\nDanh mục: ${EXPENSE_CATS.join(', ')}`);
        }
        const txs = await Transaction.find({ $or: [{ userId: user._id }, { createdBy: user._id }], type: 'expense', date: { $gte: start } });
        const spentBy = {};
        for (const t of txs) spentBy[t.category] = (spentBy[t.category] || 0) + t.amount;
        const lines = entries.map(([cat, lim]) => {
            const sp = spentBy[cat] || 0;
            const pct = Math.round((sp / lim) * 100);
            const icon = sp > lim ? '📛' : sp >= lim * 0.8 ? '⚠️' : '✅';
            return `${icon} ${cat}: ${fmt(sp)}đ / ${fmt(lim)}đ (${pct}%)`;
        });
        return void sendMessage(chatId, `📊 <b>Ngân sách tháng ${now.getMonth() + 1}</b>\n${lines.join('\n')}`);
    }
    // "<category ...> off" | "<category ...> <amount>"
    const offMatch = arg.match(/^(.+?)\s+(off|xoa|xóa)$/i);
    if (offMatch) {
        const cat = EXPENSE_CATS.find(c => c.toLowerCase() === offMatch[1].trim().toLowerCase());
        if (cat && budgets[cat]) { delete budgets[cat]; user.telegramCategoryBudgets = budgets; user.markModified('telegramCategoryBudgets'); await user.save(); return void sendMessage(chatId, `🗑️ Đã bỏ ngân sách ${cat}.`); }
        return void sendMessage(chatId, 'Không tìm thấy danh mục đó.');
    }
    const m = arg.match(/^(.+)\s+(\S+)$/);
    if (m) {
        const cat = EXPENSE_CATS.find(c => c.toLowerCase() === m[1].trim().toLowerCase());
        const amount = parseAmount(m[2]);
        if (cat && amount > 0) { budgets[cat] = amount; user.telegramCategoryBudgets = budgets; user.markModified('telegramCategoryBudgets'); await user.save(); return void sendMessage(chatId, `✅ Ngân sách ${cat}: ${fmt(amount)}đ/tháng`); }
    }
    return void sendMessage(chatId, `Cú pháp: <code>/ngansach Ăn uống 3tr</code>\nDanh mục hợp lệ: ${EXPENSE_CATS.join(', ')}`);
}

// ─── Voice message → transcribe + parse (Gemini audio) ───────────
async function parseVoice(buffer, mimeType) {
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Nghe đoạn ghi âm tiếng Việt (người dùng đọc một khoản thu/chi). Hôm nay ${today}.
Trả về DUY NHẤT JSON: {"type":"expense|income","amount":<số nguyên VNĐ>,"category":"...","note":"<mô tả ngắn>"}.
${CAT_RULES}
Không nghe rõ số tiền → amount=0.`;
    const r = await geminiModel().generateContent([prompt, { inlineData: { data: buffer.toString('base64'), mimeType } }]);
    return normalizeParsed(parseGeminiJson(r.response.text()));
}

async function handleVoice(chatId, user, fileId, mimeType) {
    try {
        await sendMessage(chatId, '🎧 Đang nghe…');
        const { buffer } = await downloadTelegramFile(fileId);
        const parsed = await parseVoice(buffer, mimeType || 'audio/ogg');
        if (!parsed.amount) return void sendMessage(chatId, '😕 Chưa nghe rõ số tiền. Thử nói lại vd "cà phê bốn lăm nghìn", hoặc gõ tay.');
        await recordWithDefault(chatId, user, parsed);
    } catch (e) {
        console.error('❌ Telegram voice error:', e.message);
        await sendMessage(chatId, `❌ Lỗi nghe ghi âm: ${e.message}`);
    }
}

// ─── /tim — natural-language search ──────────────────────────────
async function parseQuery(text) {
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Chuyển câu tìm kiếm giao dịch tiếng Việt thành bộ lọc. Hôm nay ${today}.
Trả về DUY NHẤT JSON: {"type":"expense|income|any","category":"<một nhãn hoặc rỗng>","from":"YYYY-MM-DD hoặc rỗng","to":"YYYY-MM-DD hoặc rỗng","keyword":"<từ khoá trong ghi chú hoặc rỗng>"}.
Danh mục: ${[...EXPENSE_CATS, ...INCOME_CATS].join(', ')}.
"tháng này"=từ đầu tháng đến nay; "hôm qua"=ngày hôm qua; "tuần này"=từ thứ 2.
Câu: "${text}"`;
    const r = await geminiModel().generateContent(prompt);
    return parseGeminiJson(r.response.text());
}

async function handleTim(chatId, user, argText) {
    const q = argText.trim();
    if (!q) return void sendMessage(chatId, 'Tìm gì? Vd: <code>/tim chi ăn uống tháng này</code> · <code>/tim grab hôm qua</code>');
    let f;
    try { f = await parseQuery(q); } catch (e) { return void sendMessage(chatId, `❌ ${e.message}`); }
    const filter = { $or: [{ userId: user._id }, { createdBy: user._id }] };
    if (f.type === 'expense' || f.type === 'income') filter.type = f.type;
    const allCats = [...EXPENSE_CATS, ...INCOME_CATS];
    if (f.category && allCats.includes(f.category)) filter.category = f.category;
    if (f.keyword) filter.note = { $regex: escapeRegExp(f.keyword), $options: 'i' };
    if (f.from || f.to) {
        filter.date = {};
        if (/^\d{4}-\d{2}-\d{2}$/.test(f.from || '')) filter.date.$gte = new Date(f.from);
        if (/^\d{4}-\d{2}-\d{2}$/.test(f.to || '')) { const e = new Date(f.to); e.setHours(23, 59, 59, 999); filter.date.$lte = e; }
    }
    const txs = await Transaction.find(filter).sort({ date: -1 }).limit(15);
    if (!txs.length) return void sendMessage(chatId, '🔍 Không tìm thấy giao dịch nào khớp.');
    const total = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    const lines = txs.map(t => {
        const d = new Date(t.date);
        const ds = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        return `${t.type === 'income' ? '🟢' : '🔴'} ${ds} ${fmt(t.amount)}đ · ${t.category}${t.note ? ` · ${t.note}` : ''}`;
    });
    await sendMessage(chatId, `🔍 <b>${txs.length} giao dịch</b>\n${lines.join('\n')}\n\nTổng: <b>${fmt(total)}đ</b>${txs.length === 15 ? '\n<i>(15 gần nhất)</i>' : ''}`);
}

// ─── /xuat — CSV export ──────────────────────────────────────────
async function handleXuat(chatId, user) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const txs = await Transaction.find({ $or: [{ userId: user._id }, { createdBy: user._id }], date: { $gte: start } }).populate('cardId').sort({ date: 1 });
    if (!txs.length) return void sendMessage(chatId, 'Tháng này chưa có giao dịch để xuất.');
    const esc = (s) => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
    const rows = [['Ngày', 'Loại', 'Số tiền', 'Danh mục', 'Ghi chú', 'Nguồn'].join(',')];
    for (const t of txs) {
        const d = new Date(t.date);
        const ds = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const src = t.cardId ? `${t.cardId.bankShortName} ••${t.cardId.cardNumber}` : 'Tiền mặt';
        rows.push([esc(ds), esc(t.type === 'income' ? 'Thu' : 'Chi'), t.amount, esc(t.category), esc(t.note), esc(src)].join(','));
    }
    const csv = '﻿' + rows.join('\n'); // BOM so Excel reads Vietnamese
    const filename = `giao-dich-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`;
    await sendDocument(chatId, filename, csv, `📄 ${txs.length} giao dịch tháng ${now.getMonth() + 1}`);
}

async function handleNhac(chatId, user, argText) {
    const arg = argText.trim().toLowerCase();
    if (arg === 'off' || arg === 'tat') { user.telegramNudges = false; await user.save(); return void sendMessage(chatId, '🔕 Đã tắt nhắc chủ động (tổng kết cuối ngày, nhắc hạn thẻ, phí thường niên).'); }
    if (arg === 'on' || arg === 'bat') { user.telegramNudges = true; await user.save(); return void sendMessage(chatId, '🔔 Đã bật nhắc chủ động.'); }
    return void sendMessage(chatId, `Nhắc chủ động đang <b>${user.telegramNudges === false ? 'TẮT' : 'BẬT'}</b>.\n<code>/nhac off</code> để tắt · <code>/nhac on</code> để bật.`);
}

// ─── Recurring auto-entries (daily sweep) ────────────────────────
async function runRecurring() {
    try {
        const now = new Date();
        const ym = ymOf(now);
        const day = now.getDate();
        const users = await User.find({ telegramChatId: { $ne: null }, 'telegramRecurring.0': { $exists: true } });
        for (const user of users) {
            let changed = false;
            for (const item of user.telegramRecurring) {
                if (item.lastRunYm === ym || day < item.day || !(item.amount > 0)) continue;
                let card = null;
                if (item.source && item.source !== 'cash') {
                    const a = await hasCardAccess(user._id, item.source);
                    if (a.allowed) card = a.card;
                }
                const tx = await commitTransaction(user, { type: item.type, amount: item.amount, category: item.category, note: item.note }, card);
                item.lastRunYm = ym;
                changed = true;
                const label = item.type === 'income' ? 'Thu' : 'Chi';
                const em = item.type === 'income' ? '🟢' : '🔴';
                await sendMessage(user.telegramChatId, `🔁 Tự ghi định kỳ: ${em} <b>${label} ${fmt(item.amount)}đ</b> · ${item.category} → ${sourceLabel(card)}`, confirmKeyboard(tx._id));
            }
            if (changed) await user.save();
        }
    } catch (err) {
        console.error('❌ Recurring sweep error:', err.message);
    }
}
// Vietnam-local "now" (UTC+7) and helpers for time-of-day/date guards.
const vnNow = () => new Date(Date.now() + 7 * 3600 * 1000);
const vnYmd = (d = vnNow()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const vnDayStartUtc = () => { const d = vnNow(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 7 * 3600 * 1000); };

// End-of-day summary (fires in the 21:00–23:59 VN window, once per day).
async function runDailySummaries() {
    const v = vnNow();
    if (v.getUTCHours() < 21) return;
    const today = vnYmd(v);
    const start = vnDayStartUtc();
    const users = await User.find({ telegramChatId: { $ne: null }, telegramNudges: { $ne: false } });
    for (const user of users) {
        const rem = user.telegramReminders || {};
        if (rem.dailySummary === today) continue;
        const txs = await Transaction.find({ $or: [{ userId: user._id }, { createdBy: user._id }], date: { $gte: start } });
        let inc = 0, exp = 0;
        for (const t of txs) { if (t.type === 'income') inc += t.amount; else exp += t.amount; }
        rem.dailySummary = today;
        user.telegramReminders = rem; user.markModified('telegramReminders'); await user.save();
        if (!txs.length) continue; // nothing today → stay quiet
        await sendMessage(user.telegramChatId, `🌙 <b>Tổng kết hôm nay</b>\n🔴 Chi: ${fmt(exp)}đ · 🟢 Thu: ${fmt(inc)}đ\n<i>${txs.length} giao dịch. Gõ /thang để xem cả tháng.</i>`);
    }
}

// Credit-card payment-due reminders: 3 days before and on the due day.
async function runDueReminders() {
    const v = vnNow();
    const today = vnYmd(v);
    const day = v.getUTCDate();
    const users = await User.find({ telegramChatId: { $ne: null }, telegramNudges: { $ne: false } });
    for (const user of users) {
        const cards = await Card.find({ userId: user._id, isActive: true, cardType: 'credit', paymentDueDay: { $gt: 0 } });
        const rem = user.telegramReminders || {};
        rem.cardDue = rem.cardDue || {};
        let changed = false;
        for (const c of cards) {
            const debt = c.balance || 0;
            if (debt <= 0) continue;
            const diff = c.paymentDueDay - day;
            if (diff !== 3 && diff !== 0) continue;
            if (rem.cardDue[c._id] === today) continue;
            rem.cardDue[c._id] = today; changed = true;
            const when = diff === 0 ? 'HÔM NAY' : `trong ${diff} ngày (ngày ${c.paymentDueDay})`;
            await sendMessage(user.telegramChatId, `💳 <b>Nhắc thanh toán thẻ</b>\n${sourceLabel(c)} đến hạn ${when}.\nDư nợ: <b>${fmt(debt)}đ</b>`);
        }
        if (changed) { user.telegramReminders = rem; user.markModified('telegramReminders'); await user.save(); }
    }
}

// Cashback nudges: about to hit min-spend, or about to cap out (once/day).
async function runCashbackAlerts() {
    const today = vnYmd();
    const users = await User.find({ telegramChatId: { $ne: null }, telegramNudges: { $ne: false } });
    for (const user of users) {
        const cards = await Card.find({ userId: user._id, isActive: true, cashbackRate: { $gt: 0 } });
        const rem = user.telegramReminders || {};
        rem.cashback = rem.cashback || {};
        let changed = false;
        for (const c of cards) {
            const cb = await cashbackForCard(c);
            if (!cb) continue;
            let msg = '';
            if (!cb.reached && cb.needMore > 0 && cb.needMore <= cb.minSpend * 0.2) {
                msg = `Sắp đạt mốc hoàn tiền — chi thêm ${fmt(cb.needMore)}đ để được hoàn.`;
            } else if (cb.reached && cb.cap > 0 && !cb.capped && cb.cashback >= cb.cap * 0.9) {
                msg = `Sắp chạm trần hoàn tiền (${fmt(cb.cashback)}đ / ${fmt(cb.cap)}đ).`;
            }
            if (!msg) continue;
            if (rem.cashback[c._id] === today) continue;
            rem.cashback[c._id] = today; changed = true;
            await sendMessage(user.telegramChatId, `💵 <b>${sourceLabel(c)}</b>\n${msg}`);
        }
        if (changed) { user.telegramReminders = rem; user.markModified('telegramReminders'); await user.save(); }
    }
}

// Annual-fee (phí thường niên) reminders: nhắc trước 30 / 7 / 1 ngày.
// Mirror the web (cards/expiry): the fee is charged at the START of the card's
// expiry month — this year if that month hasn't passed, else next year.
function expiryFeeMonth(s) {
    if (!s) return null;
    let m;
    const a = /^(\d{2})\/(\d{2})$/.exec(s);   // MM/YY
    const b = /^(\d{4})-(\d{1,2})$/.exec(s);  // YYYY-MM
    if (a) m = +a[1];
    else if (b) m = +b[2];
    else return null;
    if (m < 1 || m > 12) return null;
    return m - 1; // 0-indexed month
}
async function runAnnualFeeReminders() {
    const v = vnNow();
    const today = vnYmd(v);
    const y = v.getUTCFullYear(), mo = v.getUTCMonth(), d = v.getUTCDate();
    const todayMs = Date.UTC(y, mo, d);
    const users = await User.find({ telegramChatId: { $ne: null }, telegramNudges: { $ne: false } });
    for (const user of users) {
        const cards = await Card.find({ userId: user._id, isActive: true, annualFee: { $gt: 0 }, expirationDate: { $nin: [null, ''] } });
        const rem = user.telegramReminders || {};
        rem.annualFee = rem.annualFee || {};
        let changed = false;
        for (const c of cards) {
            const feeMonth = expiryFeeMonth(c.expirationDate);
            if (feeMonth === null) continue;
            const feeYear = mo > feeMonth ? y + 1 : y;
            const feeDays = Math.round((Date.UTC(feeYear, feeMonth, 1) - todayMs) / 86_400_000);
            if (feeDays !== 30 && feeDays !== 7 && feeDays !== 1) continue;
            if (rem.annualFee[c._id] === today) continue;
            rem.annualFee[c._id] = today; changed = true;
            const when = feeDays === 1 ? 'NGÀY MAI' : `trong ${feeDays} ngày (đầu T${feeMonth + 1})`;
            await sendMessage(user.telegramChatId, `🗓️ <b>Nhắc phí thường niên</b>\n${sourceLabel(c)} sẽ bị thu phí thường niên ${when}.\nPhí: <b>${fmt(c.annualFee)}đ</b>`);
        }
        if (changed) { user.telegramReminders = rem; user.markModified('telegramReminders'); await user.save(); }
    }
}

// All time-based jobs. Runs on an internal hourly timer AND via the /cron
// endpoint (so an external scheduler like cron-job.org can wake a sleeping
// Render instance). Every job is idempotent via per-day/-month guards.
async function runScheduledJobs() {
    await runRecurring();
    await runDailySummaries();
    await runDueReminders();
    await runCashbackAlerts();
    await runAnnualFeeReminders();
}
setInterval(runScheduledJobs, 60 * 60 * 1000).unref?.();
setTimeout(runScheduledJobs, 30 * 1000).unref?.();

// ─── Linking ─────────────────────────────────────────────────────
async function handleLink(chatId, code) {
    const user = await User.findOne({ telegramLinkCode: code, telegramLinkCodeExpires: { $gt: new Date() } });
    if (!user) {
        return sendMessage(chatId, '❌ Mã liên kết không hợp lệ hoặc đã hết hạn.\nMở app → Cài đặt → Kết nối Telegram để lấy mã mới.');
    }
    user.telegramChatId = String(chatId);
    user.telegramLinkCode = null;
    user.telegramLinkCodeExpires = null;
    await user.save();
    return sendMessage(chatId, `✅ Đã liên kết với <b>${user.name}</b>!\n\n${HELP}`);
}

// ─── Dispatchers ─────────────────────────────────────────────────
async function handleCallback(cq) {
    const data = cq.data || '';
    if (data.startsWith('pick:')) { const [, id, s] = data.split(':'); return handlePick(cq, id, s); }
    if (data.startsWith('catset:')) { const [, id, idx] = data.split(':'); return handleCatSet(cq, id, idx); }
    if (data.startsWith('cat:')) return handleCat(cq, data.slice('cat:'.length));
    if (data.startsWith('mv:')) { const [, id, s] = data.split(':'); return handleMv(cq, id, s); }
    if (data.startsWith('move:')) return handleMove(cq, data.slice('move:'.length));
    if (data.startsWith('back:')) return handleBack(cq, data.slice('back:'.length));
    if (data.startsWith('undo:')) return handleUndo(cq, data.slice('undo:'.length));
    if (data.startsWith('edit:')) return handleEditAmount(cq, data.slice('edit:'.length));
    if (data.startsWith('setsrc:')) return handleSetsrc(cq, data.slice('setsrc:'.length));
    await answerCallbackQuery(cq.id);
}

// @desc  Telegram webhook — receives every update from Telegram
// @route POST /api/telegram/webhook
// @access Public (verified by the secret-token header, not JWT)
exports.webhook = async (req, res) => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
        return res.sendStatus(401);
    }
    res.sendStatus(200); // ack immediately; process afterwards

    try {
        const update = req.body || {};
        if (update.callback_query) return void handleCallback(update.callback_query);

        const msg = update.message;
        if (!msg) return;
        const chatId = msg.chat.id;

        // Receipt photo / voice note — both need a linked account.
        if (msg.photo || msg.voice || msg.audio) {
            const user = await User.findOne({ telegramChatId: String(chatId) });
            if (!user) return void sendMessage(chatId, '⚠️ Chưa liên kết tài khoản.\nMở app → Cài đặt → Kết nối Telegram.');
            if (msg.photo) return void handlePhoto(chatId, user, msg.photo);
            const f = msg.voice || msg.audio;
            return void handleVoice(chatId, user, f.file_id, f.mime_type);
        }

        if (!msg.text) return;
        let text = msg.text.trim();

        // /start [code] — entry point + account linking via deep link
        if (text.startsWith('/start')) {
            const code = text.split(/\s+/)[1];
            if (code) return void handleLink(chatId, code);
            return void sendMessage(chatId, `Chào bạn 👋\n\nMở app → <b>Cài đặt → Kết nối Telegram</b> để liên kết, rồi nhắn ví dụ <code>cà phê 45k</code>.\n\n${HELP}`);
        }
        if (text === '/help') return void sendMessage(chatId, HELP);

        const user = await User.findOne({ telegramChatId: String(chatId) });
        if (!user) return void sendMessage(chatId, '⚠️ Chưa liên kết tài khoản.\nMở app → Cài đặt → Kết nối Telegram.');

        // Commands
        if (text === '/homnay') return void sendReport(chatId, user, 'day');
        if (text === '/thang') return void sendReport(chatId, user, 'month');
        if (text === '/undo') return void undoLast(chatId, user);
        if (text === '/nguon') return void handleNguon(chatId, user);
        if (text === '/sodu') return void handleSodu(chatId, user);
        if (text === '/hoantien') return void handleHoantien(chatId, user);
        if (text === '/xuat') return void handleXuat(chatId, user);
        if (text.startsWith('/tim')) return void handleTim(chatId, user, text.slice('/tim'.length));
        if (text.startsWith('/ngansach')) return void handleNgansach(chatId, user, text.slice('/ngansach'.length));
        if (text.startsWith('/hanmuc')) return void handleHanmuc(chatId, user, text.slice('/hanmuc'.length));
        if (text.startsWith('/dinhky')) return void handleDinhky(chatId, user, text.slice('/dinhky'.length));
        if (text.startsWith('/nhac')) return void handleNhac(chatId, user, text.slice('/nhac'.length));

        // Amount-edit reply?
        const pe = pendingEdit.get(String(chatId));
        if (pe && Date.now() <= pe.exp) {
            const amt = parseAmount(text);
            pendingEdit.delete(String(chatId));
            if (amt > 0) return void applyAmountEdit(chatId, user, pe.txId, amt);
            // not a bare amount → fall through and treat as a normal entry
        }

        // Multi-line → batch
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length >= 2) return void handleBatch(chatId, user, lines.join('\n'));

        // Sign syntax: leading + forces income, leading - forces expense
        let forcedType = null;
        if (text.startsWith('+')) { forcedType = 'income'; text = text.slice(1).trim(); }
        else if (/^-\s*\d/.test(text)) { forcedType = 'expense'; text = text.replace(/^-\s*/, '').trim(); }

        // Single line
        let parsed;
        try { parsed = await parseSpending(text); }
        catch (e) { return void sendMessage(chatId, `❌ ${e.message}`); }
        if (forcedType) parsed.type = forcedType;
        if (!parsed.amount) {
            return void sendMessage(chatId, '🤔 Chưa nhận ra số tiền. Thử kiểu <code>cà phê 45k</code> hoặc <code>lương 20tr</code>. Gõ /help để xem hướng dẫn.');
        }

        // Shortcut: did the text name a bank the user owns? (e.g. "…vib")
        const cards = await spendingCards(user._id);
        const matched = cards.filter(c => new RegExp(`\\b${escapeRegExp(c.bankShortName)}\\b`, 'i').test(text));
        for (const c of matched) {
            parsed.note = parsed.note.replace(new RegExp(`\\b${escapeRegExp(c.bankShortName)}\\b`, 'ig'), '').replace(/\s{2,}/g, ' ').trim();
        }

        if (matched.length === 1) {
            const tx = await commitTransaction(user, parsed, matched[0]);
            return void sendConfirmation(chatId, user, parsed, matched[0], tx);
        }
        if (matched.length > 1) {
            const pendingId = putPending({ userId: user._id, ...parsed });
            return void sendSourcePicker(chatId, user, pendingId, parsed, {
                cards: matched, includeCash: false,
                prompt: `Bạn có ${matched.length} thẻ/tài khoản ${matched[0].bankShortName} — chọn cái nào?`,
            });
        }
        await recordWithDefault(chatId, user, parsed);
    } catch (err) {
        console.error('❌ Telegram webhook error:', err.message);
    }
};

// @desc  Mint a link code + deep link for the logged-in user
// @route GET /api/telegram/link
// @access Private
exports.getLink = async (req, res) => {
    try {
        const botUsername = process.env.TELEGRAM_BOT_USERNAME;
        const user = await User.findById(req.user._id);
        if (user.telegramChatId) return res.json({ success: true, connected: true });
        if (!botUsername) return res.status(500).json({ success: false, message: 'Thiếu TELEGRAM_BOT_USERNAME trên server' });

        const code = crypto.randomBytes(4).toString('hex');
        user.telegramLinkCode = code;
        user.telegramLinkCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        res.json({
            success: true, connected: false, code,
            url: `https://t.me/${botUsername}?start=${code}`,
            botUsername, expiresInMinutes: 15,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Run time-based jobs (summaries, due/cashback reminders, recurring).
//        Meant for an external scheduler (cron-job.org) to hit on a schedule so
//        nudges fire even when a free Render instance would otherwise be asleep.
// @route GET/POST /api/telegram/cron?key=<TELEGRAM_WEBHOOK_SECRET>
// @access Public (guarded by the shared secret)
exports.cron = async (req, res) => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && req.query.key !== secret) return res.sendStatus(401);
    res.json({ success: true });
    try { await runScheduledJobs(); } catch (e) { console.error('cron error', e.message); }
};

// @desc  Whether the logged-in user has a linked Telegram chat
// @route GET /api/telegram/status
// @access Private
exports.status = async (req, res) => {
    const user = await User.findById(req.user._id).select('telegramChatId');
    res.json({ success: true, connected: !!user?.telegramChatId });
};

// @desc  Unlink Telegram from the logged-in user
// @route POST /api/telegram/unlink
// @access Private
exports.unlink = async (req, res) => {
    await User.updateOne({ _id: req.user._id }, { $unset: { telegramChatId: 1, telegramLinkCode: 1, telegramLinkCodeExpires: 1 } });
    res.json({ success: true });
};

exports._internals = { parseSpending, parseSpendingMulti, parseAmount, normalizeParsed, callTelegram };
