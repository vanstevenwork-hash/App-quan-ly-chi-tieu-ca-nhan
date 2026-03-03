const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    paymentMethod: { type: String, default: 'cash' },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
