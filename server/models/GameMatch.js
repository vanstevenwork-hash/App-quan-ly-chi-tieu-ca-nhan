const mongoose = require('mongoose');

const gameMatchSchema = new mongoose.Schema(
    {
        gameType: { type: String, enum: ['tien_len', 'phom'], required: true },
        players: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            validate: { validator: v => v.length >= 2 && v.length <= 4, message: 'GameMatch requires 2 to 4 players' },
        },
        acceptedPlayerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        settings: {
            turnSeconds: { type: Number, default: 30, min: 10, max: 120 },
        },
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
        // Chains rematches together so a running score can be tallied across a
        // sitting without inventing a separate "session" collection. Set to
        // this match's own _id at creation (a fresh match starts its own
        // series); a rematch inherits the original match's seriesId.
        seriesId: { type: mongoose.Schema.Types.ObjectId },
        previousMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameMatch' },
    },
    { timestamps: true }
);

gameMatchSchema.index({ players: 1, status: 1 });
gameMatchSchema.index({ seriesId: 1, status: 1 });
gameMatchSchema.index({ previousMatchId: 1 });

module.exports = mongoose.model('GameMatch', gameMatchSchema);
