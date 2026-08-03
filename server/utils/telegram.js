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

// Download a Telegram file (e.g. a photo) to a Buffer via getFile + the file CDN.
async function downloadTelegramFile(fileId) {
    const info = await callTelegram('getFile', { file_id: fileId });
    const path = info.result?.file_path;
    if (!path) throw new Error('Không lấy được file từ Telegram');
    const { data } = await axios.get(`https://api.telegram.org/file/bot${token()}/${path}`, { responseType: 'arraybuffer' });
    const ext = (path.split('.').pop() || 'jpg').toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { buffer: Buffer.from(data), mimeType };
}

// Send a generated file (e.g. a CSV export) via multipart. Uses the global
// fetch/FormData/Blob (Node 18+) since axios + Buffer multipart is fiddlier.
async function sendDocument(chatId, filename, content, caption = '') {
    if (!token()) throw new Error('Thiếu TELEGRAM_BOT_TOKEN');
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) form.append('caption', caption);
    form.append('document', new Blob([content], { type: 'text/csv' }), filename);
    const res = await fetch(`https://api.telegram.org/bot${token()}/sendDocument`, { method: 'POST', body: form });
    return res.json();
}

module.exports = { callTelegram, sendMessage, answerCallbackQuery, editMessageText, downloadTelegramFile, sendDocument };
