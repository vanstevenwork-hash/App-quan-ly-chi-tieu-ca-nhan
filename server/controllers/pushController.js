const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const Card = require('../models/Card');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// ── VAPID setup ──────────────────────────────────────────────────────────
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@chitieu.app';
const pushEnabled = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
if (pushEnabled) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
} else {
    console.log('ℹ️  Web push chưa bật (thiếu VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).');
}

// ── Statement-cycle logic (mirrors client/lib/cardDue.ts) ─────────────────
// A card's `balance` is the full outstanding debt. Only charges that were on
// the last CLOSED statement are due at the upcoming payment date; anything
// posted after the last statement close bills next cycle.
function lastStatementClose(statementDay, now = new Date()) {
    if (!statementDay) return null;
    const closedThisMonth = now.getDate() > statementDay;
    return new Date(now.getFullYear(), now.getMonth() - (closedThisMonth ? 0 : 1), statementDay, 23, 59, 59, 999);
}

function activeInstallmentNotYetDue(txns, cardId, now = new Date()) {
    return txns
        .filter(t => t.isInstallment && (t.installmentMonths || 0) > 0 && String(t.cardId) === String(cardId))
        .reduce((sum, t) => {
            const start = t.installmentStartDate ? new Date(t.installmentStartDate) : new Date(t.date);
            const months = t.installmentMonths;
            const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
            const remaining = Math.max(0, months - elapsed);
            return sum + Math.max(0, remaining - 1) * (t.installmentMonthly || 0);
        }, 0);
}

function postStatementCharges(txns, cardId, statementDay, now = new Date()) {
    const close = lastStatementClose(statementDay, now);
    if (!close) return 0;
    return txns
        .filter(t => !t.isInstallment && t.type === 'expense' && String(t.cardId) === String(cardId) && new Date(t.date) > close)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
}

function getDueThisCycle(card, txns, now = new Date()) {
    const notYetDue = activeInstallmentNotYetDue(txns, card._id, now);
    const postClose = postStatementCharges(txns, card._id, card.statementDay, now);
    return Math.max(0, (card.balance || 0) - notYetDue - postClose);
}

function daysUntil(dueDay, now = new Date()) {
    if (!dueDay) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (due < today) due.setMonth(due.getMonth() + 1);
    return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

// Compose the morning notification body for one user, or null if nothing to say
// worth interrupting for (we still send a gentle nudge in that case).
async function buildMorningMessage(userId) {
    const now = new Date();
    const [cards, txns] = await Promise.all([
        Card.find({ userId }).lean(),
        Transaction.find({ userId, paymentMethod: 'card' }).select('type amount date cardId isInstallment installmentMonths installmentMonthly installmentStartDate').lean(),
    ]);

    const lines = [];

    // Credit cards with something actually due this cycle
    cards.filter(c => c.cardType === 'credit' && (c.balance || 0) > 0).forEach(card => {
        const due = getDueThisCycle(card, txns, now);
        if (due <= 0) return;
        const d = daysUntil(card.paymentDueDay, now);
        if (d === null) { lines.push(`💳 ${card.bankShortName || card.bankName}: cần thanh toán sao kê`); return; }
        if (d <= 7) {
            const when = d === 0 ? 'hôm nay' : `còn ${d} ngày`;
            lines.push(`💳 ${card.bankShortName || card.bankName}: đến hạn ${when}`);
        }
    });

    // Savings books maturing within 7 days
    cards.filter(c => c.cardType === 'savings' && c.maturityDate).forEach(card => {
        const d = Math.ceil((new Date(card.maturityDate).getTime() - now.getTime()) / 86_400_000);
        if (d >= 0 && d <= 7) {
            lines.push(`🏦 Sổ ${card.bankShortName || card.bankName}: đáo hạn ${d === 0 ? 'hôm nay' : `còn ${d} ngày`}`);
        }
    });

    if (lines.length === 0) {
        return { title: 'Chi tiêu cá nhân', body: 'Chào buổi sáng! Đừng quên ghi lại chi tiêu hôm qua nhé 👋', urgent: false };
    }
    return {
        title: '⏰ Nhắc thanh toán hôm nay',
        body: lines.slice(0, 4).join('\n'),
        urgent: true,
    };
}

// Send a payload to every subscription of one user, pruning dead endpoints.
async function sendToUser(userId, payload) {
    if (!pushEnabled) return { sent: 0, pruned: 0 };
    const subs = await PushSubscription.find({ userId }).lean();
    let sent = 0, pruned = 0;
    await Promise.all(subs.map(async sub => {
        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: sub.keys },
                JSON.stringify(payload),
            );
            sent++;
        } catch (err) {
            // 404/410 = subscription expired/unsubscribed → remove it.
            if (err.statusCode === 404 || err.statusCode === 410) {
                await PushSubscription.deleteOne({ _id: sub._id });
                pruned++;
            } else {
                console.error('push send error:', err.statusCode, err.body || err.message);
            }
        }
    }));
    return { sent, pruned };
}

// The morning job: notify every user who has at least one subscription.
async function sendMorningToAll() {
    if (!pushEnabled) return { users: 0, sent: 0 };
    const userIds = await PushSubscription.distinct('userId');
    let totalSent = 0;
    for (const userId of userIds) {
        try {
            const payload = await buildMorningMessage(userId);
            const { sent } = await sendToUser(userId, payload);
            totalSent += sent;
        } catch (e) {
            console.error('morning push for user', String(userId), e.message);
        }
    }
    console.log(`🔔 Morning push: ${totalSent} notification(s) to ${userIds.length} user(s)`);
    return { users: userIds.length, sent: totalSent };
}

// ── Route handlers ────────────────────────────────────────────────────────
exports.getPublicKey = (req, res) => {
    res.json({ data: { publicKey: VAPID_PUBLIC || null, enabled: pushEnabled } });
};

exports.subscribe = async (req, res) => {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: 'Subscription không hợp lệ' });
    }
    const sub = await PushSubscription.findOneAndUpdate(
        { endpoint },
        { userId: req.user.id, endpoint, keys, userAgent: req.headers['user-agent'] || '' },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.status(201).json({ data: { _id: sub._id } });
};

exports.unsubscribe = async (req, res) => {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ message: 'Thiếu endpoint' });
    await PushSubscription.deleteOne({ endpoint, userId: req.user.id });
    res.json({ data: { ok: true } });
};

// Send a test push to the caller right now (used by the "Bật thông báo" toggle).
exports.sendTest = async (req, res) => {
    const payload = await buildMorningMessage(req.user.id);
    const result = await sendToUser(req.user.id, payload);
    res.json({ data: result });
};

// External scheduler hits this at ~08:00 (also reachable to wake a sleeping host).
exports.cron = async (req, res) => {
    const result = await sendMorningToAll();
    res.json({ data: result });
};

exports.sendMorningToAll = sendMorningToAll;
exports.pushEnabled = pushEnabled;
