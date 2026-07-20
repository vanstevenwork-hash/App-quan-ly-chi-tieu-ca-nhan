const Card = require('../models/Card');
const { createNotification } = require('./notificationController');

// Groups credit cards that have sharedLimit=true by bank (bankShortName ||
// bankName) and attaches derived fields: effectiveCreditLimit (max limit in
// the group), groupBalance (sum of debt across the group), sharedGroupSize
// (how many cards are pooled together, including itself). Cards not opted
// into sharing — or alone in their group — just mirror their own values.
function attachSharedLimitInfo(cards) {
    const groups = new Map();
    cards.forEach(c => {
        if (c.cardType !== 'credit' || !c.sharedLimit) return;
        const key = c.bankShortName || c.bankName;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
    });

    const infoByCardId = new Map();
    groups.forEach(group => {
        const effectiveCreditLimit = Math.max(...group.map(c => c.creditLimit || 0));
        const groupBalance = group.reduce((sum, c) => sum + (c.balance || 0), 0);
        group.forEach(c => {
            infoByCardId.set(c._id.toString(), { effectiveCreditLimit, groupBalance, sharedGroupSize: group.length });
        });
    });

    return cards.map(c => {
        const info = infoByCardId.get(c._id.toString());
        const obj = c.toObject ? c.toObject() : c;
        return {
            ...obj,
            effectiveCreditLimit: info ? info.effectiveCreditLimit : obj.creditLimit,
            groupBalance: info ? info.groupBalance : obj.balance,
            sharedGroupSize: info ? info.sharedGroupSize : 1,
        };
    });
}

// Writes the max creditLimit across a shared-limit bank group back onto every
// card in that group, so the DB value itself stays in sync (not just the
// derived effectiveCreditLimit computed at read time in attachSharedLimitInfo).
// Called after any create/update/removal that could change a group's members
// or its max limit.
async function syncSharedLimitGroup(userId, bankShortName) {
    if (!bankShortName) return;
    const group = await Card.find({ userId, cardType: 'credit', sharedLimit: true, isActive: true, bankShortName });
    if (group.length < 2) return; // nothing to pool when alone (or empty)
    const maxLimit = Math.max(...group.map(c => c.creditLimit || 0));
    await Promise.all(
        group.filter(c => c.creditLimit !== maxLimit).map(c => { c.creditLimit = maxLimit; return c.save(); })
    );
}

// @desc  Get all cards for user
// @route GET /api/cards
exports.getAll = async (req, res) => {
    try {
        const rawCards = await Card.find({ userId: req.user.id, isActive: true }).sort({ isDefault: -1, createdAt: -1 });
        const cards = attachSharedLimitInfo(rawCards);
        const totalBalance = cards
            .filter(c => c.cardType !== 'credit')
            .reduce((sum, c) => sum + c.balance, 0);
        const totalDebt = cards
            .filter(c => c.cardType === 'credit')
            .reduce((sum, c) => sum + c.balance, 0);
        // Dedupe shared groups so a pooled limit isn't counted once per card.
        const countedGroups = new Set();
        const totalCreditLimit = cards
            .filter(c => c.cardType === 'credit')
            .reduce((sum, c) => {
                if (c.sharedLimit && c.sharedGroupSize > 1) {
                    const key = c.bankShortName || c.bankName;
                    if (countedGroups.has(key)) return sum;
                    countedGroups.add(key);
                    return sum + c.effectiveCreditLimit;
                }
                return sum + (c.creditLimit || 0);
            }, 0);
        res.json({ success: true, data: cards, totalBalance, totalDebt, totalCreditLimit });
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
            paymentDueDay, statementDay, cashbackRate, cashbackCap, cashbackMinSpend, sharedLimit,
            receiveAccountNumber, receiveQrImage, annualFee,
            cardNetwork, expirationDate,
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
            cashbackRate: cashbackRate || 0,
            cashbackCap: cashbackCap || 0,
            sharedLimit: sharedLimit || false,
            receiveAccountNumber: receiveAccountNumber || '',
            receiveQrImage: receiveQrImage || '',
            cashbackMinSpend: cashbackMinSpend || 0,
            annualFee: annualFee || 0,
            cardNetwork: cardNetwork || '',
            expirationDate: expirationDate || '',
            note: note || '',
        });
        if (card.cardType === 'credit' && card.sharedLimit) await syncSharedLimitGroup(req.user.id, card.bankShortName);
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
        const oldBankShortName = card.bankShortName;
        const wasShared = card.sharedLimit;

        const fields = [
            'bankName', 'bankShortName', 'cardType', 'cardHolder',
            'balance', 'creditLimit', 'color', 'bankColor',
            'interestRate', 'depositDate', 'maturityDate', 'term',
            'paymentDueDay', 'statementDay', 'cashbackRate', 'cashbackCap', 'cashbackMinSpend', 'sharedLimit',
            'receiveAccountNumber', 'receiveQrImage', 'annualFee', 'cardNetwork', 'expirationDate', 'note',
        ];
        fields.forEach(f => { if (req.body[f] !== undefined) card[f] = req.body[f]; });
        if (req.body.cardNumber) card.cardNumber = String(req.body.cardNumber).slice(-4);

        await card.save();

        // Keep every card's stored creditLimit in sync with its shared-limit
        // group (not just the derived effectiveCreditLimit read at GET time).
        if (card.cardType === 'credit' && card.sharedLimit) await syncSharedLimitGroup(req.user.id, card.bankShortName);
        // Left the group or switched banks — re-max the group left behind so
        // it doesn't keep holding a limit only this card used to justify.
        if (wasShared && (oldBankShortName !== card.bankShortName || !card.sharedLimit))
            await syncSharedLimitGroup(req.user.id, oldBankShortName);

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
        if (card.cardType === 'credit' && card.sharedLimit) await syncSharedLimitGroup(req.user.id, card.bankShortName);

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

// @desc  Renew ("tái tục") a matured savings book — realise the earned
//        interest as an income transaction, then roll principal + interest
//        (or a user-chosen amount) into a fresh term with a new rate.
// @route POST /api/cards/:id/renew-savings
exports.renewSavings = async (req, res) => {
    try {
        const card = await Card.findOne({ _id: req.params.id, userId: req.user.id });
        if (!card) return res.status(404).json({ success: false, message: 'Không tìm thấy sổ' });
        if (card.cardType !== 'savings')
            return res.status(400).json({ success: false, message: 'Chỉ áp dụng cho sổ tiết kiệm' });

        const newAmount = Number(req.body.newAmount);
        const newRate = Number(req.body.newRate) || 0;
        const newTerm = Number(req.body.newTerm) || 0;
        if (!newAmount || newAmount <= 0) return res.status(400).json({ success: false, message: 'Số tiền mới không hợp lệ' });
        if (newTerm <= 0) return res.status(400).json({ success: false, message: 'Kỳ hạn mới không hợp lệ' });

        // Interest earned over the just-finished term (full-term simple interest).
        const interestEarned = Math.round(card.balance * ((card.interestRate || 0) / 100) * ((card.term || 0) / 12));

        // Record the interest as income so reports/net worth reflect it.
        if (interestEarned > 0) {
            const Transaction = require('../models/Transaction');
            await Transaction.create({
                userId: req.user.id,
                type: 'income',
                amount: interestEarned,
                category: 'Tiền lãi',
                note: `Lãi tái tục sổ ${card.bankName}`,
                date: new Date(),
                paymentMethod: 'transfer',
            });
        }

        // Roll into a fresh term: new term starts at the old maturity date.
        const start = card.maturityDate ? new Date(card.maturityDate) : new Date();
        const maturity = new Date(start);
        maturity.setMonth(maturity.getMonth() + newTerm);

        card.balance = newAmount;
        card.interestRate = newRate;
        card.term = newTerm;
        card.depositDate = start;
        card.maturityDate = maturity;
        await card.save();

        await createNotification({
            userId: req.user.id.toString(),
            title: `Đã tái tục sổ ${card.bankName}`,
            message: `Lãi nhận: ${interestEarned.toLocaleString('vi-VN')}đ · Gửi lại: ${newAmount.toLocaleString('vi-VN')}đ · ${newRate}%/năm · ${newTerm} tháng`,
            type: 'system',
            icon: '🐷',
            iconBg: '#ECFDF5',
            isImportant: true,
            relatedId: card._id,
            relatedModel: 'Card',
        });

        res.json({ success: true, data: card, interestEarned });
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
        const sourceId = req.body.sourceId;
        if (!amount || amount <= 0)
            return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });

        let sourceAccount = null;
        if (sourceId) {
            sourceAccount = await Card.findOne({ _id: sourceId, userId: req.user.id });
            if (!sourceAccount) return res.status(404).json({ success: false, message: 'Nguồn tiền không tồn tại' });
            if (sourceAccount.balance < amount) return res.status(400).json({ success: false, message: 'Số dư nguồn tiền không đủ' });
        }

        const MathPaid = Math.min(amount, card.balance); // cannot pay more than balance (renamed to avoid conflict)
        const paid = MathPaid;
        card.balance = Math.max(0, card.balance - paid);
        await card.save();

        if (sourceAccount) {
            sourceAccount.balance -= paid;
            await sourceAccount.save();
        }

        // Create expense transaction for the payment
        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: req.user.id,
            type: 'expense',
            amount: paid,
            category: 'Thanh toán thẻ',
            note: `Thanh toán ${card.bankName} ••${card.cardNumber}${sourceAccount ? ` từ ${sourceAccount.bankName}` : ''}`,
            date: new Date(),
            accountId: sourceId || null,
            paymentMethod: sourceId ? 'card' : 'cash',
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

