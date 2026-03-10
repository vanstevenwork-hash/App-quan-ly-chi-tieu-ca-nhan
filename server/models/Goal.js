const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    type: { type: String, enum: ['deposit', 'withdraw'], default: 'deposit' },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now },
}, { _id: true });

const goalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true, min: 0 },
    currentAmount: { type: Number, default: 0 },
    deadline: { type: Date },
    icon: { type: String, default: '🎯' },
    color: { type: String, default: '#6C63FF' },
    category: { type: String, default: 'other' },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
    contributions: [contributionSchema],
    // Auto-save settings
    autoSaveAmount: { type: Number, default: 0 },
    autoSaveFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', ''], default: '' },
    completedAt: { type: Date },
}, { timestamps: true });

goalSchema.virtual('progress').get(function () {
    if (this.targetAmount === 0) return 0;
    return Math.min(Math.round((this.currentAmount / this.targetAmount) * 100), 100);
});

goalSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Goal', goalSchema);
