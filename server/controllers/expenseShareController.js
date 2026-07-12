const ExpenseShare = require('../models/ExpenseShare');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');

// @desc  Create (or replace) the split for a transaction
// @route POST /api/expense-shares
exports.create = async (req, res) => {
    try {
        const { transactionId, receiveCardId, participants } = req.body;

        const transaction = await Transaction.findOne({ _id: transactionId, userId: req.user.id });
        if (!transaction) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
        if (transaction.type !== 'expense') return res.status(400).json({ success: false, message: 'Chỉ chia được giao dịch chi tiêu' });

        const receiveCard = await Card.findOne({ _id: receiveCardId, userId: req.user.id });
        if (!receiveCard) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản nhận tiền' });

        if (!Array.isArray(participants) || participants.length === 0)
            return res.status(400).json({ success: false, message: 'Cần ít nhất 1 người tham gia' });
        const cleaned = participants.map(p => ({ name: String(p.name || '').trim(), amount: Number(p.amount) || 0 }));
        if (cleaned.some(p => !p.name || p.amount <= 0))
            return res.status(400).json({ success: false, message: 'Tên và số tiền không hợp lệ' });
        const sum = cleaned.reduce((s, p) => s + p.amount, 0);
        if (sum > transaction.amount)
            return res.status(400).json({ success: false, message: 'Tổng số tiền chia vượt quá giá trị giao dịch' });

        // One share per transaction — re-sharing replaces the previous split
        // (only allowed while nobody has been marked paid yet, otherwise the
        // payer should edit via PUT instead).
        const existing = await ExpenseShare.findOne({ transactionId });
        if (existing) {
            if (existing.participants.some(p => p.status === 'paid'))
                return res.status(400).json({ success: false, message: 'Đã có người được xác nhận thanh toán — hãy sửa thay vì tạo lại' });
            await existing.deleteOne();
        }

        const share = await ExpenseShare.create({
            userId: req.user.id,
            transactionId,
            totalAmount: transaction.amount,
            receiveCardId,
            participants: cleaned,
        });
        await share.populate('receiveCardId', 'bankName bankShortName receiveAccountNumber receiveQrImage cardHolder');

        res.status(201).json({ success: true, data: share });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc  Get the split for a given transaction (if any)
// @route GET /api/expense-shares/transaction/:transactionId
exports.getByTransaction = async (req, res) => {
    try {
        const share = await ExpenseShare.findOne({ transactionId: req.params.transactionId, userId: req.user.id })
            .populate('receiveCardId', 'bankName bankShortName receiveAccountNumber receiveQrImage cardHolder');
        res.json({ success: true, data: share || null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Edit participants (name/amount) on an existing share
// @route PUT /api/expense-shares/:id
exports.update = async (req, res) => {
    try {
        const share = await ExpenseShare.findOne({ _id: req.params.id, userId: req.user.id });
        if (!share) return res.status(404).json({ success: false, message: 'Không tìm thấy bản chia' });

        const { participants, receiveCardId } = req.body;
        if (participants) {
            const cleaned = participants.map(p => ({
                name: String(p.name || '').trim(),
                amount: Number(p.amount) || 0,
                status: p.status === 'paid' ? 'paid' : 'pending',
                paidAt: p.status === 'paid' ? (p.paidAt || new Date()) : null,
            }));
            if (cleaned.some(p => !p.name || p.amount <= 0))
                return res.status(400).json({ success: false, message: 'Tên và số tiền không hợp lệ' });
            const sum = cleaned.reduce((s, p) => s + p.amount, 0);
            if (sum > share.totalAmount)
                return res.status(400).json({ success: false, message: 'Tổng số tiền chia vượt quá giá trị giao dịch' });
            share.participants = cleaned;
        }
        if (receiveCardId) {
            const receiveCard = await Card.findOne({ _id: receiveCardId, userId: req.user.id });
            if (!receiveCard) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản nhận tiền' });
            share.receiveCardId = receiveCardId;
        }

        await share.save();
        await share.populate('receiveCardId', 'bankName bankShortName receiveAccountNumber receiveQrImage cardHolder');
        res.json({ success: true, data: share });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc  Mark one participant as paid — only the payer can confirm this
//        (there's no bank webhook, so it's a manual check-off), and doing so
//        actually credits the receiving account so the app's balance/reports
//        reflect the money that came back.
// @route PATCH /api/expense-shares/:id/participants/:participantId/pay
exports.markParticipantPaid = async (req, res) => {
    try {
        const share = await ExpenseShare.findOne({ _id: req.params.id, userId: req.user.id });
        if (!share) return res.status(404).json({ success: false, message: 'Không tìm thấy bản chia' });

        const participant = share.participants.id(req.params.participantId);
        if (!participant) return res.status(404).json({ success: false, message: 'Không tìm thấy người này' });
        if (participant.status === 'paid') return res.status(400).json({ success: false, message: 'Người này đã được xác nhận trước đó' });

        const receiveCard = await Card.findOne({ _id: share.receiveCardId, userId: req.user.id });
        if (!receiveCard) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản nhận tiền' });

        participant.status = 'paid';
        participant.paidAt = new Date();
        await share.save();

        // Reflect the reimbursement in the receiving account's balance —
        // credit cards "receiving" a payment reduces their debt instead.
        if (receiveCard.cardType === 'credit') receiveCard.balance = Math.max(0, receiveCard.balance - participant.amount);
        else receiveCard.balance += participant.amount;
        await receiveCard.save();

        const transaction = await Transaction.findById(share.transactionId);
        await Transaction.create({
            userId: req.user.id,
            type: 'income',
            amount: participant.amount,
            category: 'Khác',
            note: `${participant.name} trả tiền chia bill${transaction ? ` — ${transaction.note || transaction.category}` : ''}`,
            date: new Date(),
            cardId: receiveCard._id,
            paymentMethod: 'transfer',
        });

        await share.populate('receiveCardId', 'bankName bankShortName receiveAccountNumber receiveQrImage cardHolder');
        res.json({ success: true, data: share });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc  Delete a share record
// @route DELETE /api/expense-shares/:id
exports.remove = async (req, res) => {
    try {
        const share = await ExpenseShare.findOne({ _id: req.params.id, userId: req.user.id });
        if (!share) return res.status(404).json({ success: false, message: 'Không tìm thấy bản chia' });
        await share.deleteOne();
        res.json({ success: true, message: 'Đã xoá' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
