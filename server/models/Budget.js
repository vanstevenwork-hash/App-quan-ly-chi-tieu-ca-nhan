const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    limit: { type: Number, required: true, min: 0 },
    spent: { type: Number, default: 0 },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    color: { type: String, default: '#6C63FF' },
    icon: { type: String, default: 'circle' },
}, { timestamps: true });

module.exports = mongoose.model('Budget', budgetSchema);
