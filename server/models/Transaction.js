const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
    paymentMethod: { type: String, default: 'cash' },
    // Installment (trả góp)
    isInstallment: { type: Boolean, default: false },
    installmentMonths: { type: Number, default: 0 },
    installmentMonthly: { type: Number, default: 0 },
    installmentStartDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
