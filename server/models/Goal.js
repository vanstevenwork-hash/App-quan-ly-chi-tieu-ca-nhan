const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true, min: 0 },
    currentAmount: { type: Number, default: 0 },
    deadline: { type: Date },
    icon: { type: String, default: 'target' },
    color: { type: String, default: '#6C63FF' },
    description: { type: String, default: '' },
}, { timestamps: true });

goalSchema.virtual('progress').get(function () {
    if (this.targetAmount === 0) return 0;
    return Math.min(Math.round((this.currentAmount / this.targetAmount) * 100), 100);
});

goalSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Goal', goalSchema);
