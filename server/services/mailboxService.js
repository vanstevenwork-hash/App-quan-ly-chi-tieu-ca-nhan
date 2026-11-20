// Mailbox manager for the app's own Gmail account (EMAIL_USER / EMAIL_PASS —
// the address that also sends OTP mails). Reads over IMAP, sends over SMTP.
// Deliberately separate from emailIngestService, which scans a different
// inbox (IMAP_EMAIL_USER) for bank notifications.
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');

function creds() {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (!user || !pass) throw Object.assign(new Error('Chưa cấu hình EMAIL_USER / EMAIL_PASS'), { status: 503 });
    return { user, pass };
}

// Folder keys the client uses → Gmail special-use flag (or literal path).
const FOLDERS = {
    inbox: { label: 'Hộp thư đến', path: 'INBOX' },
    starred: { label: 'Có gắn sao', specialUse: '\\Flagged' },
    sent: { label: 'Đã gửi', specialUse: '\\Sent' },
    drafts: { label: 'Thư nháp', specialUse: '\\Drafts' },
    spam: { label: 'Thư rác', specialUse: '\\Junk' },
    trash: { label: 'Thùng rác', specialUse: '\\Trash' },
    all: { label: 'Tất cả thư', specialUse: '\\All' },
};

// Folder paths differ by Gmail UI language ("[Gmail]/Sent Mail" vs
// "[Gmail]/Thư đã gửi"), so resolve them once from the special-use flags.
let folderCache = null;
async function resolveFolders(client) {
    if (folderCache) return folderCache;
    const list = await client.list();
    const map = {};
    for (const [key, f] of Object.entries(FOLDERS)) {
        if (f.path) map[key] = f.path;
        else {
            const hit = list.find(b => b.specialUse === f.specialUse);
            if (hit) map[key] = hit.path;
        }
    }
    folderCache = map;
    return map;
}

// One long-lived IMAP connection, reused across requests (a fresh TLS login
// to Gmail costs several seconds). Requests are serialised through a simple
// promise queue — IMAP can only have one mailbox selected at a time — and the
// connection is dropped after a few idle minutes / recreated if it closes.
let shared = null;          // { client, connecting }
let queue = Promise.resolve();
let idleTimer = null;
const IDLE_MS = 4 * 60_000;

async function getClient() {
    if (shared?.client?.usable) return shared.client;
    if (shared?.connecting) return shared.connecting;
    const { user, pass } = creds();
    const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user, pass }, logger: false });
    client.on('close', () => { if (shared?.client === client) shared = null; });
    client.on('error', () => { if (shared?.client === client) shared = null; });
    const connecting = client.connect().then(() => client).catch(err => {
        shared = null;
        throw Object.assign(new Error(`Không đăng nhập được IMAP (${user}): ${err.responseText || err.message}. Kiểm tra EMAIL_PASS là App Password và Gmail đã bật IMAP.`), { status: 502 });
    });
    shared = { client, connecting };
    await connecting;
    shared.connecting = null;
    return client;
}

function withClient(fn) {
    const run = async () => {
        clearTimeout(idleTimer);
        let client = await getClient();
        try {
            return await fn(client);
        } catch (err) {
            // Stale socket → retry once on a fresh connection.
            if (!client.usable && !err.status) {
                shared = null;
                client = await getClient();
                return fn(client);
            }
            throw err;
        } finally {
            idleTimer = setTimeout(() => {
                const c = shared?.client; shared = null;
                c?.logout().catch(() => {});
            }, IDLE_MS);
            idleTimer.unref?.();
        }
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
}

async function withFolder(folderKey, fn) {
    return withClient(async client => {
        const folders = await resolveFolders(client);
        const path = folders[folderKey];
        if (!path) throw Object.assign(new Error('Thư mục không tồn tại'), { status: 404 });
        const lock = await client.getMailboxLock(path);
        try { return await fn(client, path, folders); }
        finally { lock.release(); }
    });
}

const addr = a => (a || []).map(x => ({ name: x.name || '', address: x.address || '' }));
const hasAttachment = node => {
    if (!node) return false;
    if (node.disposition === 'attachment') return true;
    return (node.childNodes || []).some(hasAttachment);
};
const summary = msg => ({
    uid: msg.uid,
    subject: msg.envelope?.subject || '(Không có tiêu đề)',
    from: addr(msg.envelope?.from)[0] || null,
    to: addr(msg.envelope?.to),
    date: msg.envelope?.date || msg.internalDate,
    seen: msg.flags?.has('\\Seen') || false,
    flagged: msg.flags?.has('\\Flagged') || false,
    hasAttachment: hasAttachment(msg.bodyStructure),
});

async function folderList() {
    return withClient(async client => {
        const folders = await resolveFolders(client);
        const out = [];
        for (const [key, path] of Object.entries(folders)) {
            let unseen = 0;
            if (key === 'inbox' || key === 'spam') {
                const st = await client.status(path, { unseen: true }).catch(() => null);
                unseen = st?.unseen || 0;
            }
            out.push({ key, label: FOLDERS[key].label, unseen });
        }
        return { account: creds().user, folders: out };
    });
}

// Newest first. With `q` → Gmail search syntax (X-GM-RAW), e.g. "from:vpbank".
// status: 'all' | 'unread' | 'read'
async function listMessages({ folder = 'inbox', page = 1, limit = 30, q = '', status = 'all' } = {}) {
    limit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    page = Math.max(Number(page) || 1, 1);
    return withFolder(folder, async (client, path) => {
        let uids;
        if (q || status === 'unread' || status === 'read') {
            const query = {};
            if (q) query.gmraw = q;
            if (status === 'unread') query.seen = false;
            if (status === 'read') query.seen = true;
            uids = (await client.search(query, { uid: true })) || [];
        } else {
            const exists = client.mailbox.exists;
            if (!exists) return { total: 0, page, limit, messages: [] };
            const end = exists - (page - 1) * limit;
            if (end < 1) return { total: exists, page, limit, messages: [] };
            const start = Math.max(1, end - limit + 1);
            const messages = [];
            for await (const m of client.fetch(`${start}:${end}`, { uid: true, envelope: true, flags: true, bodyStructure: true, internalDate: true })) {
                messages.push(summary(m));
            }
            messages.sort((a, b) => b.uid - a.uid);
            return { total: exists, page, limit, messages };
        }
        uids.sort((a, b) => b - a);
        const total = uids.length;
        const slice = uids.slice((page - 1) * limit, page * limit);
        const messages = [];
        if (slice.length) {
            for await (const m of client.fetch(slice, { uid: true, envelope: true, flags: true, bodyStructure: true, internalDate: true }, { uid: true })) {
                messages.push(summary(m));
            }
        }
        messages.sort((a, b) => b.uid - a.uid);
        return { total, page, limit, messages };
    });
}

async function fetchParsed(client, uid) {
    const msg = await client.fetchOne(String(uid), { uid: true, source: true, flags: true }, { uid: true });
    if (!msg) throw Object.assign(new Error('Không tìm thấy thư'), { status: 404 });
    return { msg, parsed: await simpleParser(msg.source) };
}

async function getMessage(folder, uid, { markSeen = true } = {}) {
    return withFolder(folder, async client => {
        const { msg, parsed } = await fetchParsed(client, uid);
        if (markSeen && !msg.flags?.has('\\Seen')) {
            await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        }
        return {
            uid: msg.uid,
            subject: parsed.subject || '(Không có tiêu đề)',
            from: addr(parsed.from?.value)[0] || null,
            to: addr(parsed.to?.value),
            cc: addr(parsed.cc?.value),
            date: parsed.date,
            messageId: parsed.messageId || '',
            references: [].concat(parsed.references || []),
            flagged: msg.flags?.has('\\Flagged') || false,
            html: parsed.html || '',
            text: parsed.text || '',
            attachments: (parsed.attachments || []).map((a, i) => ({
                index: i, filename: a.filename || `tep-${i + 1}`, contentType: a.contentType, size: a.size,
            })),
        };
    });
}

async function getAttachment(folder, uid, index) {
    return withFolder(folder, async client => {
        const { parsed } = await fetchParsed(client, uid);
        const a = (parsed.attachments || [])[Number(index)];
        if (!a) throw Object.assign(new Error('Không tìm thấy tệp đính kèm'), { status: 404 });
        return { filename: a.filename || `tep-${Number(index) + 1}`, contentType: a.contentType || 'application/octet-stream', content: a.content };
    });
}

async function setFlags(folder, uids, { seen, flagged } = {}) {
    const list = [].concat(uids).map(Number).filter(Boolean);
    if (!list.length) return;
    return withFolder(folder, async client => {
        const range = list.join(',');
        if (seen === true) await client.messageFlagsAdd(range, ['\\Seen'], { uid: true });
        if (seen === false) await client.messageFlagsRemove(range, ['\\Seen'], { uid: true });
        if (flagged === true) await client.messageFlagsAdd(range, ['\\Flagged'], { uid: true });
        if (flagged === false) await client.messageFlagsRemove(range, ['\\Flagged'], { uid: true });
    });
}

// Move to Trash; deleting from Trash (or Spam) removes it for good.
async function deleteMessages(folder, uids) {
    const list = [].concat(uids).map(Number).filter(Boolean);
    if (!list.length) return { permanent: false };
    return withFolder(folder, async (client, path, folders) => {
        const range = list.join(',');
        if (folder === 'trash' || folder === 'spam' || !folders.trash) {
            await client.messageDelete(range, { uid: true });
            return { permanent: true };
        }
        await client.messageMove(range, folders.trash, { uid: true });
        return { permanent: false };
    });
}

async function moveMessages(folder, uids, target) {
    const list = [].concat(uids).map(Number).filter(Boolean);
    if (!list.length) return;
    return withFolder(folder, async (client, path, folders) => {
        if (!folders[target]) throw Object.assign(new Error('Thư mục đích không tồn tại'), { status: 400 });
        await client.messageMove(list.join(','), folders[target], { uid: true });
    });
}

// Gmail stores SMTP-sent mail in "Sent" by itself — no IMAP APPEND needed.
async function sendMail({ to, cc, subject, text, html, inReplyTo, references }) {
    const { user, pass } = creds();
    if (!to || !String(to).trim()) throw Object.assign(new Error('Thiếu người nhận'), { status: 400 });
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: { user, pass },
        connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
    });
    const info = await transporter.sendMail({
        from: user, to, cc: cc || undefined, subject: subject || '', text: text || '', html: html || undefined,
        inReplyTo: inReplyTo || undefined,
        references: references && references.length ? references : undefined,
    });
    return { messageId: info.messageId };
}

// ─── Traveloka gift vouchers ───────────────────────────────────────────────
// "Phiếu quà tặng Traveloka" mails list codes like GVXXXXXXXXXXXXXXXXXX, each
// followed by "Số tiền | VND 1,000,000". Some mails carry raw HTML in the text
// part, so always work from the HTML with tags stripped.
function htmlToText(html) {
    return String(html || '')
        .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>|<\/(p|div|tr|td|th|li|h\d)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
        .replace(/[ \t]+/g, ' ');
}
function parseTravelokaVouchers(parsed) {
    const text = parsed.html ? htmlToText(parsed.html) : String(parsed.text || '');
    const vouchers = [];
    const seen = new Set();
    const re = /\b(GV[A-Z0-9]{10,})\b[\s\S]{0,80}?(?:Số tiền|Amount|Value)[\s:|]*([A-Z]{2,3}|Rp)?\s*([\d][\d.,]*)/gi;
    let m;
    while ((m = re.exec(text))) {
        const code = m[1].toUpperCase();
        if (seen.has(code)) continue;
        seen.add(code);
        vouchers.push({ code, currency: (m[2] || 'VND').toUpperCase(), amount: Number(m[3].replace(/[.,]/g, '')) || 0 });
    }
    // Codes without a readable amount still matter — keep them.
    for (const c of text.match(/\bGV[A-Z0-9]{10,}\b/g) || []) {
        if (!seen.has(c)) { seen.add(c); vouchers.push({ code: c, currency: 'VND', amount: 0 }); }
    }
    const exp = text.match(/sử dụng trước\s+(\d{1,2})\s+thg\s+(\d{1,2})\s+(\d{4})/i);
    const expiresAt = exp ? new Date(Date.UTC(+exp[3], +exp[2] - 1, +exp[1])).toISOString() : null;
    // Subject: "…! ta van si vừa gửi cho bạn một phiếu quà tặng Traveloka!"
    const sender = (String(parsed.subject || '').match(/!\s*([^!]{1,40}?)\s+vừa gửi cho bạn/i) || [])[1]?.trim() || '';
    return { vouchers, expiresAt, sender };
}

// Searches "All Mail" so archived mails count too; never marks anything read.
async function travelokaVouchers({ status = 'unread', limit = 100 } = {}) {
    return withFolder('all', async client => {
        const q = `from:traveloka.com (subject:"phiếu quà tặng" OR subject:"gift voucher")${status === 'unread' ? ' is:unread' : status === 'read' ? ' is:read' : ''}`;
        const uids = ((await client.search({ gmraw: q }, { uid: true })) || []).sort((a, b) => b - a).slice(0, limit);
        const out = [];
        if (!uids.length) return { folder: 'all', emails: out };
        for await (const msg of client.fetch(uids, { uid: true, source: true, flags: true, envelope: true }, { uid: true })) {
            const parsed = await simpleParser(msg.source);
            const info = parseTravelokaVouchers(parsed);
            out.push({
                uid: msg.uid,
                subject: msg.envelope?.subject || '',
                date: msg.envelope?.date || parsed.date,
                seen: msg.flags?.has('\\Seen') || false,
                ...info,
            });
        }
        out.sort((a, b) => b.uid - a.uid);
        return { folder: 'all', emails: out };
    });
}

module.exports = { travelokaVouchers, parseTravelokaVouchers, folderList, listMessages, getMessage, getAttachment, setFlags, deleteMessages, moveMessages, sendMail };
