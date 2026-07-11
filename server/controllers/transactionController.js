const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const CardShare = require('../models/CardShare');
const { createNotification } = require('./notificationController');

// Helper: check if user has collaborative access to a card
async function hasCardAccess(userId, cardId) {
    // Owner?
    const ownCard = await Card.findOne({ _id: cardId, userId, isActive: true });
    if (ownCard) return { allowed: true, card: ownCard, isOwner: true };
    // Shared?
    const share = await CardShare.findOne({ cardId, sharedWithUserId: userId, status: 'accepted' });
    if (share) {
        const card = await Card.findOne({ _id: cardId, isActive: true });
        if (card) return { allowed: true, card, isOwner: false };
    }
    return { allowed: false, card: null, isOwner: false };
}

// GET /api/transactions
exports.getTransactions = async (req, res) => {
    try {
        const { type, category, month, year, startDate, endDate, limit = 20, page = 1 } = req.query;
        const filter = { userId: req.user._id };
        if (type) filter.type = type;
        if (category) filter.category = category;
        if (startDate && endDate) {
            const s = new Date(startDate);
            const e = new Date(endDate);
            e.setHours(23, 59, 59, 999);
            filter.date = { $gte: s, $lte: e };
        } else if (month && year) {
            const s = new Date(year, month - 1, 1);
            const e = new Date(year, month, 0, 23, 59, 59);
            filter.date = { $gte: s, $lte: e };
        }
        const transactions = await Transaction.find(filter)
            .populate('cardId')
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));
        const total = await Transaction.countDocuments(filter);
        res.json({ success: true, data: transactions, total });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/transactions/:id
exports.getTransaction = async (req, res) => {
    try {
        const t = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
        if (!t) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
        res.json({ success: true, data: t });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/transactions
exports.createTransaction = async (req, res) => {
    try {
        console.log('🚀 SERVER: createTransaction REACHED!');
        const { type, amount, category, note, date, cardId, paymentMethod, isInstallment, installmentMonths, installmentMonthly, installmentStartDate, receiptImage } = req.body;

        // Determine the userId for the transaction:
        // If creating on a shared card, userId = card owner (so it shows up in card history)
        let txUserId = req.user._id;
        let accessResult = null;

        if (paymentMethod === 'card' && cardId) {
            accessResult = await hasCardAccess(req.user._id, cardId);
            if (!accessResult.allowed) {
                return res.status(403).json({ success: false, message: 'Không có quyền tạo giao dịch trên thẻ này' });
            }
            // Transaction belongs to the card owner so it appears in their history
            txUserId = accessResult.card.userId;
        }

        const t = await Transaction.create({
            userId: txUserId,
            type, amount, category, note,
            date: date ? new Date(date) : new Date(),
            cardId, paymentMethod,
            receiptImage,
            isInstallment, installmentMonths, installmentMonthly, installmentStartDate,
            createdBy: req.user._id,
        });

        console.log('--- CREATE TRANSACTION DEBUG ---');
        console.log('Body:', req.body);
        console.log('Payment Method:', paymentMethod);
        console.log('Card ID:', cardId);
        console.log('Created By:', req.user._id, 'Tx User:', txUserId);

        // Update Card Balance
        if (paymentMethod === 'card' && cardId && accessResult?.card) {
            const card = accessResult.card;
            console.log('Card found:', card.bankShortName, 'Type:', card.cardType, 'Current Balance:', card.balance);
            const isCredit = card.cardType === 'credit';
            if (type === 'income') {
                if (isCredit) card.balance -= Number(amount);
                else card.balance += Number(amount);
            } else {
                if (isCredit) card.balance += Number(amount);
                else card.balance -= Number(amount);
            }
            console.log('New Balance to save:', card.balance);
            await card.save();
            console.log('Card balance saved successfully');
        } else if (paymentMethod !== 'card' || !cardId) {
            console.log('Skipping card balance update: paymentMethod is', paymentMethod, 'and cardId is', cardId);
        }

        // Notification for transaction
        await createNotification({
            userId: req.user._id.toString(),
            title: `Giao dịch ${type === 'income' ? 'thu nhập' : 'chi tiêu'} mới`,
            message: `${category}: ${amount.toLocaleString('vi-VN')}đ${note ? ` - ${note}` : ''}`,
            type: 'transaction',
            icon: type === 'income' ? '💰' : '💸',
            iconBg: type === 'income' ? '#ECFDF5' : '#FEE2E2',
            relatedId: t._id,
            relatedModel: 'Transaction',
        });

        res.status(201).json({ success: true, data: t });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/transactions/:id
exports.updateTransaction = async (req, res) => {
    try {
        // Find by id first, then check permission
        const old = await Transaction.findById(req.params.id);
        if (!old) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });

        // Permission check: own transaction OR created by this user on a shared card
        const isOwnTx = old.userId.toString() === req.user._id.toString();
        const isCreator = old.createdBy && old.createdBy.toString() === req.user._id.toString();
        if (!isOwnTx && !isCreator) {
            return res.status(403).json({ success: false, message: 'Bạn chỉ được sửa giao dịch do mình tạo' });
        }
        // If shared card user, only allow editing transactions they created
        if (!isOwnTx && isCreator) {
            // Verify they still have access to the card
            if (old.cardId) {
                const access = await hasCardAccess(req.user._id, old.cardId);
                if (!access.allowed) {
                    return res.status(403).json({ success: false, message: 'Không còn quyền truy cập thẻ này' });
                }
            }
        }

        const updated = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

        // Reconciliation: Revert OLD impact and apply NEW impact
        // 1. Revert Old
        if (old.paymentMethod === 'card' && old.cardId) {
            const oldCard = await Card.findById(old.cardId);
            if (oldCard) {
                const isCredit = oldCard.cardType === 'credit';
                if (old.type === 'income') {
                    if (isCredit) oldCard.balance += old.amount;
                    else oldCard.balance -= old.amount;
                } else {
                    if (isCredit) oldCard.balance -= old.amount;
                    else oldCard.balance += old.amount;
                }
                await oldCard.save();
            }
        }

        // 2. Apply New
        if (updated.paymentMethod === 'card' && updated.cardId) {
            const newCard = await Card.findById(updated.cardId);
            if (newCard) {
                const isCredit = newCard.cardType === 'credit';
                if (updated.type === 'income') {
                    if (isCredit) newCard.balance -= updated.amount;
                    else newCard.balance += updated.amount;
                } else {
                    if (isCredit) newCard.balance += updated.amount;
                    else newCard.balance -= updated.amount;
                }
                await newCard.save();
            }
        }

        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/transactions/:id
exports.deleteTransaction = async (req, res) => {
    try {
        const t = await Transaction.findById(req.params.id);
        if (!t) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });

        // Permission check: own transaction OR created by this user
        const isOwnTx = t.userId.toString() === req.user._id.toString();
        const isCreator = t.createdBy && t.createdBy.toString() === req.user._id.toString();
        if (!isOwnTx && !isCreator) {
            return res.status(403).json({ success: false, message: 'Bạn chỉ được xóa giao dịch do mình tạo' });
        }

        // Revert balance before deleting
        if (t.paymentMethod === 'card' && t.cardId) {
            const card = await Card.findById(t.cardId);
            if (card) {
                const isCredit = card.cardType === 'credit';
                if (t.type === 'income') {
                    if (isCredit) card.balance += t.amount;
                    else card.balance -= t.amount;
                } else {
                    if (isCredit) card.balance -= t.amount;
                    else card.balance += t.amount;
                }
                await card.save();
            }
        }

        await Transaction.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Đã xóa giao dịch' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/transactions/summary — income/expense totals for a month
exports.getSummary = async (req, res) => {
    try {
        const { month, year, startDate, endDate } = req.query;
        let start, end;
        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            const m = month || new Date().getMonth() + 1;
            const y = year || new Date().getFullYear();
            start = new Date(y, m - 1, 1);
            end = new Date(y, m, 0, 23, 59, 59);
        }
        const agg = await Transaction.aggregate([
            { $match: { userId: req.user._id, date: { $gte: start, $lte: end } } },
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);
        const result = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
        agg.forEach(r => {
            if (r._id === 'income') { result.income = r.total; result.incomeCount = r.count; }
            else { result.expense = r.total; result.expenseCount = r.count; }
        });
        result.balance = result.income - result.expense;
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/transactions/category-breakdown
exports.getCategoryBreakdown = async (req, res) => {
    try {
        const { month, year, startDate, endDate, type = 'expense' } = req.query;
        let start, end;
        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            const m = month || new Date().getMonth() + 1;
            const y = year || new Date().getFullYear();
            start = new Date(y, m - 1, 1);
            end = new Date(y, m, 0, 23, 59, 59);
        }
        const agg = await Transaction.aggregate([
            { $match: { userId: req.user._id, type, date: { $gte: start, $lte: end } } },
            { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { total: -1 } },
        ]);
        const grandTotal = agg.reduce((s, r) => s + r.total, 0);
        const breakdown = agg.map(r => ({
            category: r._id,
            total: r.total,
            count: r.count,
            percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
        }));
        res.json({ success: true, data: breakdown, grandTotal });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
