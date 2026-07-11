const mongoose = require('mongoose');

const cardShareSchema = new mongoose.Schema({
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Resolved to a real User at invite time (invitee must already have an account) —
    // no token/email-link needed, accept/decline happens in-app, authenticated as this user.
    sharedWithUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWithEmail: { type: String, required: true, lowercase: true, trim: true },
    permission: {
        type: String,
        enum: ['collaborative', 'view-only'],
        default: 'collaborative',
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'revoked'],
        default: 'pending',
    },
}, { timestamps: true });

// Fast lookup: shared/pending cards for a user
cardShareSchema.index({ sharedWithUserId: 1, status: 1 });
// Fast lookup: shares on a specific card
cardShareSchema.index({ cardId: 1, status: 1 });

module.exports = mongoose.model('CardShare', cardShareSchema);
