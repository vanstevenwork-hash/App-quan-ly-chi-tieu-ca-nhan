const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Budget = require('../models/Budget');
const { createNotification } = require('./notificationController');

// Helper: recalculate and update Budget.spent for a category/month/year
async function syncBudgetSpent(userId, category, month, year) {
    const budget = await Budget.findOne({ userId, category, month, year });
    if (!budget) return;

    const now = new Date();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const agg = await Transaction.aggregate([
        {
            $match: {
                userId,
                category,
                type: 'expense',
                date: { $gte: startDate, $lte: endDate },
            },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const spent = agg[0]?.total || 0;
    budget.spent = spent;
    await budget.save();

    // Create budget-warning notification when 80%+ usage
    const pct = Math.round((spent / budget.limit) * 100);
    if (pct >= 80 && pct < 100) {
        await createNotification({
            userId: userId.toString(),
            title: `Ngân sách ${category} sắp hết`,
            message: `Bạn đã sử dụng ${pct}% ngân sách ${category}. Hãy cân nhắc chi tiêu thêm!`,
            type: 'budget',
            icon: '⚠️',
            iconBg: '#FFF7ED',
            isImportant: true,
            relatedId: budget._id,
            relatedModel: 'Budget',
        });
    } else if (pct >= 100) {
        await createNotification({
            userId: userId.toString(),
            title: `Đã vượt ngân sách ${category}`,
            message: `Bạn đã vượt ngân sách ${category} ${pct - 100}%. Hãy kiểm soát chi tiêu!`,
            type: 'budget',
            icon: '🚨',
            iconBg: '#FEE2E2',
            isImportant: true,
            relatedId: budget._id,
            relatedModel: 'Budget',
        });
    }
}

// GET /api/transactions
exports.getTransactions = async (req, res) => {
    try {
        const { type, category, month, year, limit = 20, page = 1 } = req.query;
        const filter = { userId: req.user._id };
        if (type) filter.type = type;
        if (category) filter.category = category;
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            filter.date = { $gte: startDate, $lte: endDate };
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
        const { type, amount, category, note, date, cardId, paymentMethod, isInstallment, installmentMonths, installmentMonthly, installmentStartDate } = req.body;

        const t = await Transaction.create({
            userId: req.user._id,
            type, amount, category, note,
            date: date ? new Date(date) : new Date(),
            cardId, paymentMethod,
            isInstallment, installmentMonths, installmentMonthly, installmentStartDate
        });

        console.log('--- CREATE TRANSACTION DEBUG ---');
        console.log('Body:', req.body);
        console.log('Payment Method:', paymentMethod);
        console.log('Card ID:', cardId);

        // Update Card Balance
        if (paymentMethod === 'card' && cardId) {
            console.log('Attempting to find card with ID:', cardId);
            const card = await Card.findOne({ _id: cardId, userId: req.user._id });
            if (card) {
                console.log('Card found:', card.bankShortName, 'Type:', card.cardType, 'Current Balance:', card.balance);
                const isCredit = card.cardType === 'credit';
                if (type === 'income') {
                    // Income: Asset increases (+), Debt decreases (-)
                    if (isCredit) card.balance -= Number(amount);
                    else card.balance += Number(amount);
                } else {
                    // Expense: Asset decreases (-), Debt increases (+)
                    if (isCredit) card.balance += Number(amount);
                    else card.balance -= Number(amount);
                }
                console.log('New Balance to save:', card.balance);
                await card.save();
                console.log('Card balance saved successfully');
            } else {
                console.log('❌ Card NOT FOUND for ID:', cardId, 'and User:', req.user._id);
            }
        } else {
            console.log('Skipping card balance update: paymentMethod is', paymentMethod, 'and cardId is', cardId);
        }

        // Auto-sync budget spent for expense transactions
        if (type === 'expense' && category) {
            const d = t.date;
            await syncBudgetSpent(req.user._id, category, d.getMonth() + 1, d.getFullYear());
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
        const old = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
        if (!old) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });

        const updated = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

        // Reconciliation: Revert OLD impact and apply NEW impact
        // 1. Revert Old
        if (old.paymentMethod === 'card' && old.cardId) {
            const oldCard = await Card.findOne({ _id: old.cardId, userId: req.user._id });
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
            const newCard = await Card.findOne({ _id: updated.cardId, userId: req.user._id });
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

        // 3. Re-sync budget for old category and new category
        const d = updated.date;
        if (old.type === 'expense') await syncBudgetSpent(req.user._id, old.category, d.getMonth() + 1, d.getFullYear());
        if (updated.type === 'expense') await syncBudgetSpent(req.user._id, updated.category, d.getMonth() + 1, d.getFullYear());

        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/transactions/:id
exports.deleteTransaction = async (req, res) => {
    try {
        const t = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
        if (!t) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });

        // Revert balance before deleting
        if (t.paymentMethod === 'card' && t.cardId) {
            const card = await Card.findOne({ _id: t.cardId, userId: req.user._id });
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

        // Re-sync budget
        if (t.type === 'expense') {
            const d = t.date;
            await syncBudgetSpent(req.user._id, t.category, d.getMonth() + 1, d.getFullYear());
        }
        res.json({ success: true, message: 'Đã xóa giao dịch' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/transactions/summary — income/expense totals for a month
exports.getSummary = async (req, res) => {
    try {
        const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        const agg = await Transaction.aggregate([
            { $match: { userId: req.user._id, date: { $gte: startDate, $lte: endDate } } },
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
        const { month = new Date().getMonth() + 1, year = new Date().getFullYear(), type = 'expense' } = req.query;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        const agg = await Transaction.aggregate([
            { $match: { userId: req.user._id, type, date: { $gte: startDate, $lte: endDate } } },
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
