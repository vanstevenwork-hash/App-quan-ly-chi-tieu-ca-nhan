const mongoose = require('mongoose');

const cardShareSchema = new mongoose.Schema({
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWithUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sharedWithEmail: { type: String, required: true, lowercase: true, trim: true },
    permission: {
        type: String,
        enum: ['collaborative', 'view-only'],
        default: 'collaborative',
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'revoked'],
        default: 'pending',
    },
    inviteToken: { type: String, required: true, unique: true },
}, { timestamps: true });

// Fast lookup: shared cards for a user
cardShareSchema.index({ sharedWithUserId: 1, status: 1 });
// Fast lookup: shares on a specific card
cardShareSchema.index({ cardId: 1, status: 1 });
// Token lookup for accept flow
cardShareSchema.index({ inviteToken: 1 }, { unique: true });

module.exports = mongoose.model('CardShare', cardShareSchema);
