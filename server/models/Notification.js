const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, required: true },
        message: { type: String, required: true },
        type: {
            type: String,
            enum: ['payment', 'saving', 'promo', 'security', 'transaction', 'budget'],
            default: 'transaction',
        },
        icon: { type: String, default: '🔔' },
        iconBg: { type: String, default: '#EEF2FF' },
        relatedId: { type: mongoose.Schema.Types.ObjectId },
        relatedModel: { type: String }, // 'Transaction' | 'Budget' | 'Goal'
        isRead: { type: Boolean, default: false },
        isImportant: { type: Boolean, default: false },
        actionUrl: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
