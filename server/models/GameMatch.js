const mongoose = require('mongoose');

const gameMatchSchema = new mongoose.Schema(
    {
        gameType: { type: String, enum: ['tien_len', 'phom'], required: true },
        players: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            validate: { validator: v => v.length === 2, message: 'GameMatch requires exactly 2 players' },
        },
        hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        status: {
            type: String,
            enum: ['pending_invite', 'active', 'finished', 'declined', 'abandoned'],
            default: 'pending_invite',
        },
        turnUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        state: { type: mongoose.Schema.Types.Mixed }, // full authoritative engine snapshot
        moves: [{
            byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            move: { type: mongoose.Schema.Types.Mixed },
            at: { type: Date, default: Date.now },
        }],
        winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        finishedReason: { type: String, enum: ['normal', 'abandoned', 'declined'] },
    },
    { timestamps: true }
);

gameMatchSchema.index({ players: 1, status: 1 });

module.exports = mongoose.model('GameMatch', gameMatchSchema);
