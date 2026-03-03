const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['bank', 'wallet', 'credit', 'saving'], default: 'bank' },
    balance: { type: Number, default: 0 },
    color: { type: String, default: '#6C63FF' },
    icon: { type: String, default: 'credit-card' },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
