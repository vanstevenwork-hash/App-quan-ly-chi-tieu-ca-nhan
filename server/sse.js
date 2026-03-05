// Shared SSE utility — used by server.js (to register clients) and notificationController.js (to push)
// Map: userId (string) → Set of SSE response objects
const sseClients = new Map();

function pushSSE(userId, data) {
    const uid = userId.toString();
    const clients = sseClients.get(uid);
    if (!clients || clients.size === 0) return;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
        try { res.write(payload); } catch { /* ignore dead connections */ }
    }
}

module.exports = { sseClients, pushSSE };
