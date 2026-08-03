const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Card = require('../models/Card');
const { hasCardAccess } = require('../utils/cardAccess');
const { sendMessage, answerCallbackQuery, editMessageText, callTelegram } = require('../utils/telegram');

// Category labels must match client/lib/mockData.ts CATEGORIES exactly so the
// app renders the right icon/colour for whatever the bot writes.
const EXPENSE_CATS = ['Ăn uống', 'Mua sắm', 'Di chuyển', 'Giải trí', 'Sức khỏe', 'Học tập', 'Hóa đơn', 'Trả thẻ tín dụng', 'Crypto', 'Khác'];
const INCOME_CATS = ['Lương', 'Freelance', 'Đầu tư', 'Thưởng', 'Tiền lãi', 'Khác'];

const fmt = (n) => Math.round(n).toLocaleString('vi-VN');

const HELP = `🤖 <b>Ghi chi tiêu nhanh</b>

Chỉ cần nhắn tự nhiên, ví dụ:
• <code>cà phê 45k</code>
• <code>grab về nhà 80k</code>
• <code>đi chợ 150k</code>
• <code>lương tháng 8 20tr</code>
• <code>thưởng dự án 2tr5</code>

Mình tự hiểu số tiền, loại thu/chi và danh mục.
Gõ /help để xem lại hướng dẫn này.`;

function parseGeminiJson(rawText) {
    try {
        return JSON.parse(rawText);
    } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
        return {};
    }
}

// Turn a free-text Vietnamese line into a structured transaction via Gemini.
// Returns { type, amount, category, note, confidence } — amount 0 means the
// model could not read a value (caller should ask the user to rephrase).
async function parseSpending(text) {
    if (!process.env.GEMINI_API_KEY) throw new Error('Thiếu GEMINI_API_KEY trên server — chưa parse được câu.');

    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Bạn là hệ thống bóc tách giao dịch thu/chi từ một câu tiếng Việt ngắn do người dùng nhắn.
Hôm nay: ${today}.
Trả về DUY NHẤT một JSON hợp lệ (không markdown, không giải thích):
{
  "type": "expense" hoặc "income",
  "amount": <số nguyên VNĐ>,
  "category": "<đúng một nhãn phù hợp>",
  "note": "<mô tả ngắn gọn, ví dụ 'cà phê', 'grab về nhà'>",
  "confidence": <0-100>
}
Quy tắc số tiền: 'k'/'nghìn' = ×1.000 ; 'tr'/'triệu'/'m' = ×1.000.000 ; '2tr5' = 2.500.000 ; '20tr' = 20.000.000.
Nếu là tiền vào (lương, thưởng, được trả, thu, nhận...) thì type='income', ngược lại 'expense'.
Danh mục cho CHI: ${EXPENSE_CATS.join(', ')}.
Danh mục cho THU: ${INCOME_CATS.join(', ')}.
Chọn danh mục sát nghĩa nhất; nếu không chắc dùng 'Khác'.
Nếu không đọc được số tiền, trả amount=0 và confidence=0, KHÔNG được bịa.

Câu người dùng: "${text}"`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: 'gemini-flash-lite-latest',
        generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await model.generateContent(prompt);
    const parsed = parseGeminiJson(result.response.text());

    const type = parsed.type === 'income' ? 'income' : 'expense';
    const amount = Number.isFinite(Number(parsed.amount)) ? Math.max(0, Math.round(Number(parsed.amount))) : 0;
    const validCats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
    const category = validCats.includes(parsed.category) ? parsed.category : 'Khác';
    const note = typeof parsed.note === 'string' ? parsed.note.slice(0, 200) : '';
    const confidence = Math.min(100, Math.max(0, Math.round(Number(parsed.confidence) || 0)));
    return { type, amount, category, note, confidence };
}

const CARD_EMOJI = { credit: '💳', debit: '🏧', eWallet: '📱', savings: '🏦', crypto: '₿' };
const sourceLabel = (card) => card ? `${CARD_EMOJI[card.cardType] || '💳'} ${card.bankShortName} ••${card.cardNumber}` : '💵 Tiền mặt';

// A parsed-but-not-yet-saved transaction, held while the user picks a payment
// source via inline buttons. In-memory + TTL: if the process restarts before
// they tap, the button just reports "hết hạn" and they retype — no data loss
// that matters. callback_data stays tiny (id + cardId) to fit Telegram's 64B.
const pending = new Map(); // id -> { userId, type, amount, category, note, exp }
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
}, 5 * 60 * 1000).unref?.();

// Mirror of the balance maths in transactionController: expense lowers a debit
// balance / raises credit debt; income does the reverse. `revert` undoes it.
function applyBalance(card, type, amount, revert = false) {
    const isCredit = card.cardType === 'credit';
    let delta = type === 'income' ? (isCredit ? -amount : amount) : (isCredit ? amount : -amount);
    card.balance += revert ? -delta : delta;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The real spending cards for a user (savings/crypto aren't payment sources).
const spendingCards = (userId) => Card.find({
    userId, isActive: true, cardType: { $in: ['credit', 'debit', 'eWallet'] },
}).sort({ isDefault: -1, updatedAt: -1 });

// Create the transaction and apply any card-balance change. `card` null = cash.
async function commitTransaction(user, data, card) {
    const tx = await Transaction.create({
        userId: card ? card.userId : user._id, // shared card → owner's history
        createdBy: user._id,
        type: data.type, amount: data.amount, category: data.category, note: data.note,
        paymentMethod: card ? 'card' : 'cash', cardId: card ? card._id : null,
        date: new Date(),
    });
    if (card) { applyBalance(card, data.type, data.amount); await card.save(); }
    return tx;
}

const confirmText = (data, card) => {
    const label = data.type === 'income' ? 'Thu' : 'Chi';
    const emoji = data.type === 'income' ? '🟢' : '🔴';
    return `✅ Đã ghi ${emoji} <b>${label} ${fmt(data.amount)}đ</b>\n📂 ${data.category}${data.note ? `\n📝 ${data.note}` : ''}\n💰 ${sourceLabel(card)}`;
};

const undoKeyboard = (txId) => ({ reply_markup: { inline_keyboard: [[{ text: '↩️ Hoàn tác', callback_data: `undo:${txId}` }]] } });

// Ask which source to record against. `opts.cards` overrides the list (used to
// disambiguate when the text named a bank with several cards); `opts.includeCash`
// / `opts.prompt` tune the message.
async function sendSourcePicker(chatId, user, pendingId, parsed, opts = {}) {
    const cards = opts.cards || (await spendingCards(user._id)).slice(0, 10);
    const rows = [];
    if (opts.includeCash !== false) rows.push([{ text: '💵 Tiền mặt', callback_data: `pick:${pendingId}:cash` }]);
    for (const c of cards) rows.push([{ text: sourceLabel(c), callback_data: `pick:${pendingId}:${c._id}` }]);
    rows.push([{ text: '❌ Huỷ', callback_data: `pick:${pendingId}:cancel` }]);

    const label = parsed.type === 'income' ? 'Thu' : 'Chi';
    const emoji = parsed.type === 'income' ? '🟢' : '🔴';
    await sendMessage(
        chatId,
        `${emoji} <b>${label} ${fmt(parsed.amount)}đ</b> · ${parsed.category}${parsed.note ? ` · ${parsed.note}` : ''}\n\n👉 ${opts.prompt || 'Ghi vào nguồn nào?'}`,
        { reply_markup: { inline_keyboard: rows } }
    );
}

// User tapped a source button → actually create the transaction now.
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
    await editMessageText(chatId, messageId, confirmText(p, card), undoKeyboard(tx._id));
}

// Undo: revert any card-balance change, then delete.
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

// Link a Telegram chat to an app user via the short code minted by GET /link.
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

// Inline-button dispatcher: source picker (pick:) and undo (undo:).
async function handleCallback(cq) {
    const data = cq.data || '';
    if (data.startsWith('pick:')) {
        const [, id, source] = data.split(':');
        return handlePick(cq, id, source);
    }
    if (data.startsWith('undo:')) {
        return handleUndo(cq, data.slice(5));
    }
    await answerCallbackQuery(cq.id);
}

// @desc  Telegram webhook — receives every update from Telegram
// @route POST /api/telegram/webhook
// @access Public (verified by the secret-token header, not JWT)
exports.webhook = async (req, res) => {
    // Reject spoofed calls: Telegram echoes back the secret we set via setWebhook.
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
        return res.sendStatus(401);
    }
    // Ack immediately so Telegram doesn't retry; process afterwards.
    res.sendStatus(200);

    try {
        const update = req.body || {};
        if (update.callback_query) return void handleCallback(update.callback_query);

        const msg = update.message;
        if (!msg || !msg.text) return;
        const chatId = msg.chat.id;
        const text = msg.text.trim();

        // /start [code] — entry point + account linking via deep link
        if (text.startsWith('/start')) {
            const code = text.split(/\s+/)[1];
            if (code) return void handleLink(chatId, code);
            return void sendMessage(chatId, `Chào bạn 👋\n\nMở app → <b>Cài đặt → Kết nối Telegram</b> để liên kết tài khoản, sau đó nhắn ví dụ <code>cà phê 45k</code> để ghi chi tiêu.`);
        }
        if (text === '/help') return void sendMessage(chatId, HELP);

        // Every other message must come from a linked account
        const user = await User.findOne({ telegramChatId: String(chatId) });
        if (!user) {
            return void sendMessage(chatId, '⚠️ Chưa liên kết tài khoản.\nMở app → Cài đặt → Kết nối Telegram.');
        }

        let parsed;
        try {
            parsed = await parseSpending(text);
        } catch (e) {
            return void sendMessage(chatId, `❌ ${e.message}`);
        }
        if (!parsed.amount) {
            return void sendMessage(chatId, '🤔 Chưa nhận ra số tiền. Thử lại kiểu <code>cà phê 45k</code> hoặc <code>lương 20tr</code>.');
        }

        // Shortcut: did the text name a bank the user actually owns? (e.g. "…vib")
        const cards = await spendingCards(user._id);
        const matched = cards.filter(c => new RegExp(`\\b${escapeRegExp(c.bankShortName)}\\b`, 'i').test(text));
        // Strip the matched bank word out of the note so it doesn't read "cà phê vib"
        for (const c of matched) {
            parsed.note = parsed.note.replace(new RegExp(`\\b${escapeRegExp(c.bankShortName)}\\b`, 'ig'), '').replace(/\s{2,}/g, ' ').trim();
        }

        // Exactly one match → unambiguous, record straight away (no tapping).
        if (matched.length === 1) {
            const tx = await commitTransaction(user, parsed, matched[0]);
            return void sendMessage(chatId, confirmText(parsed, matched[0]), undoKeyboard(tx._id));
        }

        // Otherwise hold it and ask. If several cards share the named bank
        // (e.g. VIB credit + VIB debit) show just those to disambiguate.
        const pendingId = putPending({ userId: user._id, type: parsed.type, amount: parsed.amount, category: parsed.category, note: parsed.note });
        if (matched.length > 1) {
            await sendSourcePicker(chatId, user, pendingId, parsed, {
                cards: matched, includeCash: false,
                prompt: `Bạn có ${matched.length} thẻ/tài khoản ${matched[0].bankShortName} — chọn cái nào?`,
            });
        } else {
            await sendSourcePicker(chatId, user, pendingId, parsed, { cards: cards.slice(0, 10) });
        }
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
        user.telegramLinkCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
        await user.save();

        res.json({
            success: true,
            connected: false,
            code,
            url: `https://t.me/${botUsername}?start=${code}`,
            botUsername,
            expiresInMinutes: 15,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
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
