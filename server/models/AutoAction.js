const mongoose = require('mongoose');

// One automatic money movement done by services/autoFinance.js, kept so the
// user can review it in "Giao dịch tự động" and undo it if it didn't really
// happen at the bank (e.g. the card wasn't actually paid).
const autoActionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['savings_settle', 'credit_autopay'], required: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },    // sổ / thẻ tín dụng
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', default: null },  // TK nhận / TK bị trừ
    amount: { type: Number, required: true },        // tiền chuyển (gốc + lãi | số trừ)
    principal: { type: Number, default: 0 },
    interest: { type: Number, default: 0 },
    cycleKey: { type: String, default: '' },         // kỳ sao kê (credit_autopay)
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    // Snapshot labels so the list still reads right if a card is renamed/removed.
    cardLabel: { type: String, default: '' },
    accountLabel: { type: String, default: '' },
    status: { type: String, enum: ['done', 'reverted'], default: 'done' },
    revertedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AutoAction', autoActionSchema);
