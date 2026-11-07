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
    // When true, this card pools its credit limit with sibling credit cards
    // of the same bank (same userId + bankShortName) that also have this on —
    // common for banks that issue a main + supplementary card under one
    // shared limit. The effective limit becomes the max across the group.
    sharedLimit: { type: Boolean, default: false },
    // Full bank account/card number + a saved QR code image, used only to
    // render the "chia bill" receipt (ExpenseShare) — never shown in the
    // regular card list UI (which only ever shows the last-4 cardNumber).
    receiveAccountNumber: { type: String, default: '' },
    receiveQrImage: { type: String, default: '' },
    color: { type: String, default: '#6C63FF' },
    bankColor: { type: String, default: '#1B4FD8' },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    // === Savings-specific fields ===
    interestRate: { type: Number, default: 0 },       // % per year, e.g. 7.2
    depositDate: { type: Date, default: null },         // date deposited
    maturityDate: { type: Date, default: null },        // date matures
    term: { type: Number, default: 0 },                // months, e.g. 12
    // Set when the book is closed out ("tất toán") — automatically once it
    // matures. A settled book is also flipped to isActive=false.
    settledAt: { type: Date, default: null },
    settledAmount: { type: Number, default: 0 },       // principal + interest paid out
    settledToCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', default: null },
    // Set when the user undoes an auto tất toán: don't auto-settle again for
    // this same maturityDate (renewing to a new date re-enables it).
    skipAutoSettleFor: { type: Date, default: null },
    // === Credit-specific fields ===
    paymentDueDay: { type: Number, default: 0 },       // day of month, e.g. 25
    statementDay: { type: Number, default: 0 },        // statement cut day
    cashbackRate: { type: Number, default: 0 },        // % hoàn tiền, e.g. 1.5 = 1.5%
    cashbackCap: { type: Number, default: 0 },         // hoàn tiền tối đa/tháng (VNĐ), 0 = không giới hạn
    cashbackMinSpend: { type: Number, default: 0 },    // chi tiêu tối thiểu/tháng mới được hoàn (VNĐ), 0 = không yêu cầu
    annualFee: { type: Number, default: 0 },           // phí thường niên (VNĐ), 0 = miễn phí/không có
    // Trích nợ tự động: after the statement closes, pay the amount due from a
    // payment account at the same bank (services/autoFinance.js).
    autoDebit: { type: Boolean, default: true },
    autoPaidCycle: { type: String, default: '' },      // statement-close key (YYYY-MM-DD) already handled
    autoPayFailCycle: { type: String, default: '' },   // cycle we already warned "không đủ tiền" for
    // === General ===
    expirationDate: { type: String, default: '' }, // MM/YY or similar
    note: { type: String, default: '' },
}, { timestamps: true });


module.exports = mongoose.model('Card', cardSchema);
