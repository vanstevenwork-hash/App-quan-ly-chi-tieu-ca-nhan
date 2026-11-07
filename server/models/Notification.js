const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, required: true },
        message: { type: String, required: true },
        type: {
            type: String,
            enum: ['payment', 'saving', 'promo', 'security', 'transaction', 'system', 'general', 'card_share_invite', 'game_invite'],
            default: 'transaction',
        },
        icon: { type: String, default: '🔔' },
        iconBg: { type: String, default: '#EEF2FF' },
        relatedId: { type: mongoose.Schema.Types.ObjectId },
        relatedModel: { type: String }, // 'Transaction' | 'Goal'
        isRead: { type: Boolean, default: false },
        isImportant: { type: Boolean, default: false },
        actionUrl: { type: String },
        // Created by an automatic job (auto tất toán / trích nợ). Surfaced as a
        // toast the next time the user opens the app, then toastShown=true.
        autoEvent: { type: Boolean, default: false },
        toastShown: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
