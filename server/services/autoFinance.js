// Automatic money movements that a real bank would do on its own:
//
//  1. Savings books that reached maturity are closed out ("tất toán"):
//     principal + full-term interest is paid into a payment account at the
//     SAME bank (VPBank book → VPBank account), falling back to the default
//     payment account when the user has none there.
//  2. Credit cards with auto-debit on get their closed statement paid
//     ("trích nợ tự động") from a payment account at the same bank, once per
//     statement cycle, as soon as the statement has closed — only when that
//     account holds enough money. Otherwise the user is told once per cycle
//     and the next scan tries again (e.g. after a top-up).
//
// Everything here is idempotent and race-safe (each step is claimed with an
// atomic update), so the hourly scheduler, the cron endpoint and the
// "user opened the app" call can overlap freely.
const Card = require('../models/Card');
const Transaction = require('../models/Transaction');
const AutoAction = require('../models/AutoAction');
const { createNotification } = require('../controllers/notificationController');

const VN_OFFSET_MS = 7 * 3600_000; // Asia/Ho_Chi_Minh, no DST
const PAYMENT_TYPES = ['debit', 'eWallet'];
const fmt = n => Math.round(n || 0).toLocaleString('vi-VN');

// Wall-clock date parts in Vietnam time, regardless of the host timezone.
function vnParts(date = new Date()) {
    const d = new Date(date.getTime() + VN_OFFSET_MS);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const pad = n => String(n).padStart(2, '0');

// Most recent statement close (VN time). Mirrors client getLastStatementClose:
// closed this month only once today is AFTER the statement day.
function lastStatementClose(statementDay, now = new Date()) {
    const t = vnParts(now);
    let y = t.y, m = t.m;
    if (!(t.d > Math.min(statementDay, daysInMonth(y, m)))) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
    const day = Math.min(statementDay, daysInMonth(y, m));
    return {
        key: `${y}-${pad(m + 1)}-${pad(day)}`,
        // 23:59:59.999 VN on the close day, as a real instant.
        end: new Date(Date.UTC(y, m, day, 23, 59, 59, 999) - VN_OFFSET_MS),
        label: `${pad(day)}/${pad(m + 1)}`,
    };
}

// Server port of client getDueThisCycle (lib/cardDue.ts): balance minus
// installment months not reached yet minus ordinary charges made after the
// statement closed (those bill next cycle).
async function dueThisCycle(card, closeEnd, now = new Date()) {
    const txs = await Transaction.find({ userId: card.userId, cardId: card._id, type: 'expense' })
        .select('amount date isInstallment installmentMonths installmentMonthly installmentStartDate').lean();
    const t = vnParts(now);
    let notYetDue = 0, postClose = 0;
    for (const tx of txs) {
        if (tx.isInstallment && tx.installmentMonths > 0) {
            const s = vnParts(new Date(tx.installmentStartDate || tx.date));
            const elapsed = (t.y - s.y) * 12 + (t.m - s.m);
            const remaining = Math.max(0, tx.installmentMonths - Math.max(0, elapsed));
            const monthly = tx.installmentMonthly || Math.ceil((tx.amount || 0) / tx.installmentMonths);
            if (remaining > 0) notYetDue += Math.max(0, remaining - 1) * monthly;
        } else if (new Date(tx.date) > closeEnd) {
            postClose += tx.amount || 0;
        }
    }
    return Math.max(0, Math.round((card.balance || 0) - notYetDue - postClose));
}

const norm = s => (s || '').trim().toLowerCase();
function sameBank(a, b) {
    if (norm(a.bankShortName) && norm(b.bankShortName)) return norm(a.bankShortName) === norm(b.bankShortName);
    return norm(a.bankName) === norm(b.bankName);
}
const byDefaultThenOldest = (a, b) => (b.isDefault - a.isDefault) || (new Date(a.createdAt) - new Date(b.createdAt));
const accLabel = c => `${c.bankName}${c.cardNumber ? ` ••${c.cardNumber}` : ''}`;

// ─── 1. Savings ────────────────────────────────────────────────────────────
async function settleMaturedSavings(userId, payAccounts, now = new Date()) {
    const due = await Card.find({
        userId, cardType: 'savings', isActive: true, settledAt: null,
        maturityDate: { $ne: null, $lte: now },
    }).sort({ maturityDate: 1 });

    const fallback = [...payAccounts].sort(byDefaultThenOldest)[0] || null;
    const results = [];
    for (const book of due) {
        // The user undid an auto tất toán for this exact maturity (e.g. the bank
        // actually rolled it over) — leave it alone until the date changes.
        if (book.skipAutoSettleFor && +book.skipAutoSettleFor === +book.maturityDate) continue;
        const dest = payAccounts.filter(a => a.cardType === 'debit' && sameBank(a, book)).sort(byDefaultThenOldest)[0]
            || payAccounts.filter(a => sameBank(a, book)).sort(byDefaultThenOldest)[0]
            || fallback;
        const principal = book.balance || 0;
        const interest = Math.round(principal * ((book.interestRate || 0) / 100) * ((book.term || 0) / 12));
        const total = principal + interest;

        const claimed = await Card.findOneAndUpdate(
            { _id: book._id, isActive: true, settledAt: null },
            { $set: { isActive: false, settledAt: now, settledAmount: total, settledToCardId: dest?._id || null } },
            { new: true }
        );
        if (!claimed) continue; // another run already settled it

        if (dest) {
            await Card.updateOne({ _id: dest._id }, { $inc: { balance: total } });
            dest.balance += total; // keep the in-memory copy right for later steps
        }
        let tx = null;
        if (interest > 0) {
            tx = await Transaction.create({
                userId, type: 'income', amount: interest, category: 'Tiền lãi',
                note: `Lãi tất toán sổ ${book.bankName}`,
                date: book.maturityDate || now, cardId: dest?._id, paymentMethod: 'transfer',
            });
        }
        const action = await AutoAction.create({
            userId, kind: 'savings_settle', cardId: book._id, accountId: dest?._id || null,
            amount: total, principal, interest, transactionId: tx?._id || null,
            cardLabel: `Sổ ${book.bankName}`, accountLabel: dest ? accLabel(dest) : '',
        });
        await createNotification({
            userId: userId.toString(),
            title: `Đã tự động tất toán sổ ${book.bankName}`,
            message: `Gốc ${fmt(principal)}đ + lãi ${fmt(interest)}đ = ${fmt(total)}đ`
                + (dest ? ` · đã cộng vào ${accLabel(dest)}` : ' · chưa có tài khoản thanh toán để nhận tiền'),
            type: 'saving', icon: '🏦', iconBg: '#ECFDF5', isImportant: true,
            relatedId: action._id, relatedModel: 'AutoAction', actionUrl: '/auto-actions', autoEvent: true,
        });
        results.push({ cardId: book._id, total, interest, destId: dest?._id || null });
    }
    return results;
}

// ─── 2. Credit card auto-debit ─────────────────────────────────────────────
async function autoPayCreditCards(userId, payAccounts, now = new Date()) {
    const cards = await Card.find({
        userId, cardType: 'credit', isActive: true, autoDebit: { $ne: false },
        statementDay: { $gt: 0 }, balance: { $gt: 0 },
    });
    const results = [];
    for (const card of cards) {
        const close = lastStatementClose(card.statementDay, now);
        if (card.autoPaidCycle === close.key) continue;

        const due = await dueThisCycle(card, close.end, now);
        if (due <= 0) {
            await Card.updateOne({ _id: card._id }, { $set: { autoPaidCycle: close.key } });
            continue;
        }

        const candidates = payAccounts
            .filter(a => a.cardType === 'debit' && sameBank(a, card))
            .sort((a, b) => (b.isDefault - a.isDefault) || (b.balance - a.balance));
        const source = candidates.find(a => a.balance >= due);

        if (!source) {
            // Tell the user once per cycle; keep retrying silently afterwards.
            const marked = await Card.findOneAndUpdate(
                { _id: card._id, autoPayFailCycle: { $ne: close.key } },
                { $set: { autoPayFailCycle: close.key } }
            );
            if (marked) {
                const best = candidates[0];
                await createNotification({
                    userId: userId.toString(),
                    title: `Chưa tự trừ được tiền thẻ ${card.bankName}`,
                    message: best
                        ? `Sao kê ${close.label} cần ${fmt(due)}đ nhưng ${accLabel(best)} chỉ còn ${fmt(best.balance)}đ. Nạp thêm tiền, app sẽ tự trừ ở lần quét sau.`
                        : `Sao kê ${close.label} cần ${fmt(due)}đ nhưng chưa có tài khoản thanh toán ${card.bankShortName || card.bankName}. Hãy thêm tài khoản hoặc thanh toán thủ công.`,
                    type: 'payment', icon: '⚠️', iconBg: '#FEF3C7', isImportant: true,
                    relatedId: card._id, relatedModel: 'Card', actionUrl: '/auto-actions', autoEvent: true,
                });
            }
            continue;
        }

        // Claim this cycle first so overlapping runs can't pay twice.
        const claimed = await Card.findOneAndUpdate(
            { _id: card._id, autoPaidCycle: { $ne: close.key } },
            { $set: { autoPaidCycle: close.key } }
        );
        if (!claimed) continue;
        const debited = await Card.findOneAndUpdate(
            { _id: source._id, balance: { $gte: due } },
            { $inc: { balance: -due } }
        );
        if (!debited) { // balance changed under us — release the claim, retry next scan
            await Card.updateOne({ _id: card._id }, { $set: { autoPaidCycle: card.autoPaidCycle || '' } });
            continue;
        }
        source.balance -= due;
        await Card.updateOne({ _id: card._id }, { $inc: { balance: -due } });

        // Same record shape as a manual payment (cardController.payCard).
        const tx = await Transaction.create({
            userId, type: 'expense', amount: due, category: 'Thanh toán thẻ',
            note: `Tự động thanh toán ${card.bankName} ••${card.cardNumber} từ ${source.bankName} (sao kê ${close.label})`,
            date: now, accountId: source._id, paymentMethod: 'card',
        });
        const action = await AutoAction.create({
            userId, kind: 'credit_autopay', cardId: card._id, accountId: source._id,
            amount: due, cycleKey: close.key, transactionId: tx._id,
            cardLabel: accLabel(card), accountLabel: accLabel(source),
        });
        await createNotification({
            userId: userId.toString(),
            title: `Đã tự động thanh toán thẻ ${card.bankName}`,
            message: `Trừ ${fmt(due)}đ từ ${accLabel(source)} cho sao kê ${close.label} · số dư TK còn ${fmt(source.balance)}đ`,
            type: 'payment', icon: '✅', iconBg: '#D1FAE5', isImportant: true,
            relatedId: action._id, relatedModel: 'AutoAction', actionUrl: '/auto-actions', autoEvent: true,
        });
        results.push({ cardId: card._id, paid: due, sourceId: source._id });
    }
    return results;
}

async function runAutoFinanceForUser(userId, now = new Date()) {
    // Shared, mutable list so money landing from a settled book can fund a
    // credit card payment in the same run.
    const payAccounts = await Card.find({ userId, isActive: true, cardType: { $in: PAYMENT_TYPES } });
    const savings = await settleMaturedSavings(userId, payAccounts, now);
    const credit = await autoPayCreditCards(userId, payAccounts, now);
    return { savings, credit };
}

let running = false;
async function runAutoFinanceForAll(now = new Date()) {
    if (running) return { skipped: true };
    running = true;
    try {
        const userIds = await Card.distinct('userId', {
            isActive: true,
            $or: [
                { cardType: 'savings', settledAt: null, maturityDate: { $ne: null, $lte: now } },
                { cardType: 'credit', autoDebit: { $ne: false }, statementDay: { $gt: 0 }, balance: { $gt: 0 } },
            ],
        });
        let savings = 0, credit = 0;
        for (const uid of userIds) {
            try {
                const r = await runAutoFinanceForUser(uid, now);
                savings += r.savings.length; credit += r.credit.length;
            } catch (e) { console.error('💸 auto-finance user', uid.toString(), e.message); }
        }
        return { users: userIds.length, savings, credit };
    } finally { running = false; }
}

module.exports = { runAutoFinanceForUser, runAutoFinanceForAll, lastStatementClose, dueThisCycle };
