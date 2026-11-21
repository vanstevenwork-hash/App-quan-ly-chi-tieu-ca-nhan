const mail = require('../services/mailboxService');

// The mailbox is ONE shared server account (EMAIL_USER), so only the app
// owner may open it — never every registered user. Owners are listed in
// MAIL_ADMIN_EMAILS / MAIL_INGEST_USER_EMAIL (comma-separated) plus DEFAULT_OWNERS.
// Default owner when MAIL_ADMIN_EMAILS isn't set on the host (e.g. production).
const DEFAULT_OWNERS = ['vansi19a@gmail.com'];
function ownerEmails() {
    const list = [process.env.MAIL_ADMIN_EMAILS, process.env.MAIL_INGEST_USER_EMAIL]
        .join(',').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return [...new Set([...DEFAULT_OWNERS, ...list])];
}
const isOwner = user => ownerEmails().includes((user?.email || '').toLowerCase());

exports.requireOwner = (req, res, next) => {
    if (!isOwner(req.user)) return res.status(403).json({ success: false, message: 'Bạn không có quyền quản lý hộp thư này' });
    next();
};

const wrap = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (err) {
        console.error('📬 mailbox:', err.message);
        res.status(err.status || 500).json({ success: false, message: err.message });
    }
};

// GET /api/mailbox/access — lets the client decide whether to show the entry.
exports.access = (req, res) => {
    res.json({ success: true, data: { allowed: isOwner(req.user), account: isOwner(req.user) ? process.env.EMAIL_USER || '' : '' } });
};

exports.folders = wrap(async (req, res) => {
    res.json({ success: true, data: await mail.folderList() });
});

exports.list = wrap(async (req, res) => {
    const { folder = 'inbox', page, limit, q, unread } = req.query;
    const status = ['unread', 'read', 'all'].includes(req.query.status) ? req.query.status : unread === 'true' ? 'unread' : 'all';
    res.json({ success: true, data: await mail.listMessages({ folder, page, limit, q: (q || '').trim(), status }) });
});

exports.get = wrap(async (req, res) => {
    res.json({ success: true, data: await mail.getMessage(req.query.folder || 'inbox', req.params.uid) });
});

exports.attachment = wrap(async (req, res) => {
    const a = await mail.getAttachment(req.query.folder || 'inbox', req.params.uid, req.params.index);
    res.setHeader('Content-Type', a.contentType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(a.filename)}`);
    res.send(a.content);
});

// PATCH /api/mailbox/messages/flags  { folder, uids, seen?, flagged? }
exports.flags = wrap(async (req, res) => {
    const { folder = 'inbox', uids, seen, flagged } = req.body;
    await mail.setFlags(folder, uids, { seen, flagged });
    res.json({ success: true });
});

// POST /api/mailbox/messages/delete  { folder, uids }
exports.remove = wrap(async (req, res) => {
    const { folder = 'inbox', uids } = req.body;
    res.json({ success: true, data: await mail.deleteMessages(folder, uids) });
});

// POST /api/mailbox/messages/move  { folder, uids, target }
exports.move = wrap(async (req, res) => {
    const { folder = 'inbox', uids, target } = req.body;
    await mail.moveMessages(folder, uids, target);
    res.json({ success: true });
});

// POST /api/mailbox/send  { to, cc?, subject, text, inReplyTo?, references? }
exports.send = wrap(async (req, res) => {
    res.json({ success: true, data: await mail.sendMail(req.body || {}) });
});

// GET /api/mailbox/traveloka?status=unread|read|all
exports.traveloka = wrap(async (req, res) => {
    const status = ['unread', 'read', 'all'].includes(req.query.status) ? req.query.status : req.query.unread === 'false' ? 'all' : 'unread';
    res.json({ success: true, data: await mail.travelokaVouchers({ status }) });
});
