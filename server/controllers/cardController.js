const Card = require('../models/Card');

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
        res.json({ success: true, data: card });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
