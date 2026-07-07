const mongoose = require('mongoose');

// Tracks whether a card's estimated cashback for a given calendar month has
// actually been credited by the bank yet ("Chờ nhận" vs "Đã nhận").
const cashbackRecordSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true, index: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 0-11
    estimatedAmount: { type: Number, default: 0 },
    receivedAmount: { type: Number, default: null },
    status: { type: String, enum: ['pending', 'received'], default: 'pending' },
    receivedAt: { type: Date, default: null },
}, { timestamps: true });

cashbackRecordSchema.index({ userId: 1, cardId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('CashbackRecord', cashbackRecordSchema);
