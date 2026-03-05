const mongoose = require('mongoose');

const wealthSourceSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        name: { type: String, required: true, trim: true },
        icon: { type: String, default: '💰' },           // emoji
        color: { type: String, default: '#6C63FF' },      // hex color for card
        balance: { type: Number, default: 0, min: 0 },
        category: {
            type: String,
            enum: ['savings', 'gold', 'crypto', 'cashback', 'affiliate', 'stock', 'real_estate', 'other'],
            default: 'other',
        },
        note: { type: String, default: '' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('WealthSource', wealthSourceSchema);
