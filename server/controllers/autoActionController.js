const AutoAction = require('../models/AutoAction');
const Card = require('../models/Card');
const Transaction = require('../models/Transaction');
const { createNotification } = require('./notificationController');
const { lastStatementClose, dueThisCycle } = require('../services/autoFinance');

const fmt = n => Math.round(n || 0).toLocaleString('vi-VN');

// @desc  Tổng hợp giao dịch tự động: history + cards still waiting for money
// @route GET /api/cards/auto-actions
exports.list = async (req, res) => {
    try {
        const actions = await AutoAction.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();

        // Credit cards whose current statement couldn't be auto-paid yet.
        const pending = [];
        const cards = await Card.find({
            userId: req.user.id, cardType: 'credit', isActive: true,
            autoDebit: { $ne: false }, statementDay: { $gt: 0 }, balance: { $gt: 0 },
        });
        for (const c of cards) {
            const close = lastStatementClose(c.statementDay);
            if (c.autoPaidCycle === close.key || c.autoPayFailCycle !== close.key) continue;
            const due = await dueThisCycle(c, close.end);
            if (due > 0) pending.push({ cardId: c._id, bankName: c.bankName, cardNumber: c.cardNumber, due, cycleLabel: close.label });
        }
        res.json({ success: true, data: { actions, pending } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Undo an automatic action (it didn't really happen at the bank)
// @route POST /api/cards/auto-actions/:id/revert
exports.revert = async (req, res) => {
    try {
        // Claim first so a double-click can't revert twice.
        const action = await AutoAction.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id, status: 'done' },
            { $set: { status: 'reverted', revertedAt: new Date() } },
            { new: true }
        );
        if (!action) return res.status(404).json({ success: false, message: 'Không tìm thấy hoặc đã hoàn tác' });

        if (action.kind === 'credit_autopay') {
            // Debt comes back on the card, money comes back to the account.
            // autoPaidCycle stays set, so this cycle is NOT auto-paid again —
            // the user pays it manually.
            await Card.updateOne({ _id: action.cardId, userId: req.user.id }, { $inc: { balance: action.amount } });
            if (action.accountId) await Card.updateOne({ _id: action.accountId, userId: req.user.id }, { $inc: { balance: action.amount } });
        } else {
            // Re-open the book and take the payout back out of the account.
            const book = await Card.findOne({ _id: action.cardId, userId: req.user.id });
            if (book) {
                book.isActive = true;
                book.settledAt = null;
                book.settledAmount = 0;
                book.settledToCardId = null;
                book.skipAutoSettleFor = book.maturityDate;
                await book.save();
            }
            if (action.accountId) await Card.updateOne({ _id: action.accountId, userId: req.user.id }, { $inc: { balance: -action.amount } });
        }
        if (action.transactionId) await Transaction.deleteOne({ _id: action.transactionId, userId: req.user.id });

        await createNotification({
            userId: req.user.id.toString(),
            title: action.kind === 'credit_autopay'
                ? `Đã hoàn tác thanh toán ${action.cardLabel}`
                : `Đã hoàn tác tất toán ${action.cardLabel}`,
            message: action.kind === 'credit_autopay'
                ? `Trả lại ${fmt(action.amount)}đ vào ${action.accountLabel}, dư nợ thẻ được khôi phục. Hãy thanh toán thủ công khi đã trả.`
                : `Sổ được mở lại, đã trừ ${fmt(action.amount)}đ khỏi ${action.accountLabel || 'tài khoản nhận'}.`,
            type: 'system', icon: '↩️', iconBg: '#F1F5F9',
            relatedId: action._id, relatedModel: 'AutoAction', actionUrl: '/auto-actions',
        });
        res.json({ success: true, data: action });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
