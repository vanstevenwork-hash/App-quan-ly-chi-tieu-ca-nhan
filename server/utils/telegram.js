const axios = require('axios');

// Thin wrapper over the Telegram Bot API. Token comes from env so the same
// helper works locally and on Render. All calls go through callTelegram so
// errors are logged in one place (Telegram returns 200 with ok:false on
// logical errors, which axios would NOT throw on).
const token = () => process.env.TELEGRAM_BOT_TOKEN;

async function callTelegram(method, payload) {
    if (!token()) throw new Error('Thiếu TELEGRAM_BOT_TOKEN trong server/.env');
    const { data } = await axios.post(`https://api.telegram.org/bot${token()}/${method}`, payload);
    if (!data.ok) console.error(`⚠️ Telegram ${method} failed:`, data.description);
    return data;
}

const sendMessage = (chatId, text, extra = {}) =>
    callTelegram('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });

const answerCallbackQuery = (callbackQueryId, text = '') =>
    callTelegram('answerCallbackQuery', { callback_query_id: callbackQueryId, text });

const editMessageText = (chatId, messageId, text, extra = {}) =>
    callTelegram('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra });

module.exports = { callTelegram, sendMessage, answerCallbackQuery, editMessageText };
