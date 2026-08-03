const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
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

// Inline-button actions (currently just "undo last entry").
async function handleCallback(cq) {
    const data = cq.data || '';
    const chatId = cq.message?.chat?.id;
    if (data.startsWith('undo:')) {
        const id = data.slice(5);
        const user = await User.findOne({ telegramChatId: String(chatId) });
        if (user) await Transaction.deleteOne({ _id: id, userId: user._id });
        await answerCallbackQuery(cq.id, 'Đã hoàn tác');
        await editMessageText(chatId, cq.message.message_id, '↩️ Đã hoàn tác giao dịch.');
        return;
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

        const tx = await Transaction.create({
            userId: user._id,
            createdBy: user._id,
            type: parsed.type,
            amount: parsed.amount,
            category: parsed.category,
            note: parsed.note,
            paymentMethod: 'cash',
            date: new Date(),
        });

        const label = parsed.type === 'income' ? 'Thu' : 'Chi';
        const emoji = parsed.type === 'income' ? '🟢' : '🔴';
        await sendMessage(
            chatId,
            `✅ Đã ghi ${emoji} <b>${label} ${fmt(parsed.amount)}đ</b>\n📂 ${parsed.category}${parsed.note ? `\n📝 ${parsed.note}` : ''}`,
            { reply_markup: { inline_keyboard: [[{ text: '↩️ Hoàn tác', callback_data: `undo:${tx._id}` }]] } }
        );
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
