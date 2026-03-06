const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bankName: { type: String, required: true, trim: true },
    bankShortName: { type: String, required: true, trim: true },
    cardType: {
        type: String,
        enum: ['credit', 'debit', 'savings', 'eWallet', 'crypto'],
        required: true,
    },
    cardNumber: { type: String, required: true, maxlength: 4 },
    cardHolder: { type: String, required: true, trim: true },
    cardNetwork: { type: String, enum: ['visa', 'mastercard', 'jcb', 'amex', 'napas', 'other', ''], default: '' },
    balance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },
    color: { type: String, default: '#6C63FF' },
    bankColor: { type: String, default: '#1B4FD8' },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    // === Savings-specific fields ===
    interestRate: { type: Number, default: 0 },       // % per year, e.g. 7.2
    depositDate: { type: Date, default: null },         // date deposited
    maturityDate: { type: Date, default: null },        // date matures
    term: { type: Number, default: 0 },                // months, e.g. 12
    // === Credit-specific fields ===
    paymentDueDay: { type: Number, default: 0 },       // day of month, e.g. 25
    statementDay: { type: Number, default: 0 },        // statement cut day
    // === General ===
    expirationDate: { type: String, default: '' }, // MM/YY or similar
    note: { type: String, default: '' },
}, { timestamps: true });


module.exports = mongoose.model('Card', cardSchema);
