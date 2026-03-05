const Card = require('../models/Card');
const { createNotification } = require('./notificationController');

// @desc  Get all cards for user
// @route GET /api/cards
exports.getAll = async (req, res) => {
    try {
        const cards = await Card.find({ userId: req.user.id, isActive: true }).sort({ isDefault: -1, createdAt: -1 });
        const totalBalance = cards
            .filter(c => c.cardType !== 'credit')
            .reduce((sum, c) => sum + c.balance, 0);
        const totalDebt = cards
            .filter(c => c.cardType === 'credit')
            .reduce((sum, c) => sum + c.balance, 0);
        res.json({ success: true, data: cards, totalBalance, totalDebt });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Create a card
// @route POST /api/cards
exports.create = async (req, res) => {
    try {
        const {
            bankName, bankShortName, cardType, cardNumber, cardHolder,
            balance, creditLimit, color, bankColor, isDefault,
            // Savings fields
            interestRate, depositDate, maturityDate, term,
            // Credit fields
            paymentDueDay, statementDay,
            note,
        } = req.body;

        const count = await Card.countDocuments({ userId: req.user.id });
        const shouldBeDefault = isDefault || count === 0;

        const card = await Card.create({
            userId: req.user.id,
            bankName, bankShortName, cardType,
            cardNumber: String(cardNumber).slice(-4),
            cardHolder: cardHolder || req.user.name,
            balance: balance || 0,
            creditLimit: creditLimit || 0,
            color: color || '#6C63FF',
            bankColor: bankColor || '#1B4FD8',
            isDefault: shouldBeDefault,
            interestRate: interestRate || 0,
            depositDate: depositDate || null,
            maturityDate: maturityDate || null,
            term: term || 0,
            paymentDueDay: paymentDueDay || 0,
            statementDay: statementDay || 0,
            note: note || '',
        });
        // Notification for card/savings creation
        const typeLabel = {
            credit: 'Thẻ tín dụng',
            debit: 'Thẻ ghi nợ',
            savings: 'Sổ tiết kiệm',
            eWallet: 'Ví điện tử',
            crypto: 'Ví crypto',
        }[card.cardType] || 'Thẻ';
        const icon = card.cardType === 'savings' ? '🏦' :
            card.cardType === 'credit' ? '💳' :
                card.cardType === 'eWallet' ? '📱' : '💳';
        await createNotification({
            userId: req.user.id.toString(),
            title: `Đã thêm ${typeLabel} mới`,
            message: `${card.bankName} – Số dư: ${(card.balance || 0).toLocaleString('vi-VN')}đ`,
            type: 'system',
            icon,
            iconBg: '#EEF2FF',
            relatedId: card._id,
            relatedModel: 'Card',
        });
        res.status(201).json({ success: true, data: card });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc  Update a card
// @route PUT /api/cards/:id
exports.update = async (req, res) => {
    try {
        const card = await Card.findOne({ _id: req.params.id, userId: req.user.id });
        if (!card) return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ' });

        const fields = [
            'bankName', 'bankShortName', 'cardType', 'cardHolder',
            'balance', 'creditLimit', 'color', 'bankColor',
            'interestRate', 'depositDate', 'maturityDate', 'term',
            'paymentDueDay', 'statementDay', 'note',
        ];
        fields.forEach(f => { if (req.body[f] !== undefined) card[f] = req.body[f]; });
        if (req.body.cardNumber) card.cardNumber = String(req.body.cardNumber).slice(-4);

        await card.save();
        res.json({ success: true, data: card });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc  Delete (deactivate) a card
// @route DELETE /api/cards/:id
exports.remove = async (req, res) => {
    try {
        const card = await Card.findOne({ _id: req.params.id, userId: req.user.id });
        if (!card) return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ' });

        card.isActive = false;
        await card.save();

        // If deleted card was default, set another card as default
        if (card.isDefault) {
            const nextCard = await Card.findOne({ userId: req.user.id, isActive: true });
            if (nextCard) { nextCard.isDefault = true; await nextCard.save(); }
        }
        await createNotification({
            userId: req.user.id.toString(),
            title: 'Đã xoá thẻ',
            message: `${card.bankName} đã được xoá khỏi danh sách`,
            type: 'system',
            icon: '🗑️',
            iconBg: '#FEE2E2',
            relatedId: card._id,
            relatedModel: 'Card',
        });
        res.json({ success: true, message: 'Đã xoá thẻ' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Set a card as default
// @route PATCH /api/cards/:id/set-default
exports.setDefault = async (req, res) => {
    try {
        const card = await Card.findOne({ _id: req.params.id, userId: req.user.id });
        if (!card) return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ' });

        await Card.updateMany({ userId: req.user.id }, { isDefault: false });
        card.isDefault = true;
        await card.save();
        res.json({ success: true, data: card });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Get savings summary stats
// @route GET /api/cards/savings/summary
exports.getSavingsSummary = async (req, res) => {
    try {
        const savings = await Card.find({
            userId: req.user.id,
            cardType: 'savings',
            isActive: true,
        }).sort({ maturityDate: 1 });

        const now = new Date();
        const totalBalance = savings.reduce((s, c) => s + c.balance, 0);

        const totalInterest = savings.reduce((s, c) => {
            if (!c.interestRate || !c.term) return s;
            return s + c.balance * (c.interestRate / 100) * (c.term / 12);
        }, 0);

        const maturingSoon = savings
            .filter(c => {
                if (!c.maturityDate) return false;
                const diff = (new Date(c.maturityDate) - now) / 86_400_000;
                return diff >= 0 && diff <= 30;
            })
            .map(c => ({
                _id: c._id,
                bankName: c.bankName,
                bankShortName: c.bankShortName,
                balance: c.balance,
                maturityDate: c.maturityDate,
                daysLeft: Math.ceil((new Date(c.maturityDate) - now) / 86_400_000),
            }));

        const bestRate = savings.reduce((best, c) => Math.max(best, c.interestRate || 0), 0);

        res.json({
            success: true,
            data: {
                totalBalance,
                totalInterest,
                totalAccounts: savings.length,
                maturingSoon,
                bestRate,
                accounts: savings,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Update savings balance (renew / top-up)
// @route PATCH /api/cards/:id/balance
exports.updateBalance = async (req, res) => {
    try {
        const card = await Card.findOne({ _id: req.params.id, userId: req.user.id });
        if (!card) return res.status(404).json({ success: false, message: 'Không tìm thấy sổ' });
        if (!['savings', 'debit', 'eWallet', 'crypto'].includes(card.cardType))
            return res.status(400).json({ success: false, message: 'Không hợp lệ' });

        const { amount, action } = req.body; // action: 'add' | 'set'
        if (action === 'add') card.balance += Number(amount) || 0;
        else card.balance = Number(amount) || 0;

        await card.save();
        const actionLabel = action === 'add' ? 'Nạp tiền' : 'Cập nhật số dư';
        await createNotification({
            userId: req.user.id.toString(),
            title: `${actionLabel}: ${card.bankName}`,
            message: `Số dư mới: ${card.balance.toLocaleString('vi-VN')}đ`,
            type: 'system',
            icon: '💰',
            iconBg: '#ECFDF5',
            relatedId: card._id,
            relatedModel: 'Card',
        });
        res.json({ success: true, data: card });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc  Pay credit card bill
// @route PATCH /api/cards/:id/pay
exports.payCard = async (req, res) => {
    try {
        const card = await Card.findOne({ _id: req.params.id, userId: req.user.id });
        if (!card) return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ' });
        if (card.cardType !== 'credit')
            return res.status(400).json({ success: false, message: 'Chỉ áp dụng cho thẻ tín dụng' });

        const amount = Number(req.body.amount);
        if (!amount || amount <= 0)
            return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });

        const paid = Math.min(amount, card.balance); // cannot pay more than balance
        card.balance = Math.max(0, card.balance - paid);
        await card.save();

        // Create expense transaction for the payment
        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: req.user.id,
            type: 'expense',
            amount: paid,
            category: 'Thanh toán thẻ',
            note: `Thanh toán ${card.bankName} ••${card.cardNumber}`,
            date: new Date(),
        });

        await createNotification({
            userId: req.user.id.toString(),
            title: `Đã thanh toán thẻ ${card.bankName}`,
            message: `Số tiền: ${paid.toLocaleString('vi-VN')}đ — Dư nợ còn lại: ${card.balance.toLocaleString('vi-VN')}đ`,
            type: 'payment',
            icon: '✅',
            iconBg: '#D1FAE5',
            isImportant: true,
            relatedId: card._id,
            relatedModel: 'Card',
        });

        res.json({ success: true, data: card, paid });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

