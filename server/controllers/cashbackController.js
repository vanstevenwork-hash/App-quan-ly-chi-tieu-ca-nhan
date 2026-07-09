const CashbackRecord = require('../models/CashbackRecord');
const Card = require('../models/Card');

// @desc  Get all cashback received/pending records for the user
// @route GET /api/cashback-records
exports.getAll = async (req, res) => {
    try {
        const records = await CashbackRecord.find({ userId: req.user.id });
        res.json({ success: true, data: records });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Mark a card's cashback for a given month as received/pending (upsert)
// @route PUT /api/cashback-records
exports.upsert = async (req, res) => {
    try {
        const { cardId, year, month, status, estimatedAmount, receivedAmount } = req.body;
        if (!cardId || year === undefined || month === undefined) {
            return res.status(400).json({ success: false, message: 'Thiếu cardId/year/month' });
        }

        const isReceived = status === 'received';

        // Cashback is credited straight onto the card that earned it: marking
        // "received" reduces a credit card's debt (balance), un-marking reverses
        // it. Apply only the delta so repeated upserts stay consistent.
        const existing = await CashbackRecord.findOne({ userId: req.user.id, cardId, year, month });
        const prevApplied = existing && existing.status === 'received'
            ? (existing.receivedAmount ?? existing.estimatedAmount ?? 0)
            : 0;
        const newApplied = isReceived ? (receivedAmount ?? estimatedAmount ?? 0) : 0;
        const delta = newApplied - prevApplied;
        if (delta !== 0) {
            const card = await Card.findOne({ _id: cardId, userId: req.user.id });
            if (card) {
                if (card.cardType === 'credit') card.balance -= delta;
                else card.balance += delta;
                await card.save();
            }
        }

        const record = await CashbackRecord.findOneAndUpdate(
            { userId: req.user.id, cardId, year, month },
            {
                $set: {
                    estimatedAmount: estimatedAmount ?? 0,
                    status: isReceived ? 'received' : 'pending',
                    receivedAmount: isReceived ? (receivedAmount ?? estimatedAmount ?? 0) : null,
                    receivedAt: isReceived ? new Date() : null,
                },
                $setOnInsert: { userId: req.user.id, cardId, year, month },
            },
            { upsert: true, new: true }
        );
        res.json({ success: true, data: record });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
