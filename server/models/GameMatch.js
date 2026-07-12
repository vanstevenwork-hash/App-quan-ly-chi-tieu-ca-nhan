const mongoose = require('mongoose');

const gameMatchSchema = new mongoose.Schema(
    {
        gameType: { type: String, enum: ['tien_len', 'phom'], required: true },
        players: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            // Min 1: an "open room" created for a share-link starts with just the
            // host and fills up as people join via the link (never deals until 2+).
            validate: { validator: v => v.length >= 1 && v.length <= 4, message: 'GameMatch requires 1 to 4 players' },
        },
        // Short code backing the shareable join link (/games/join/:code). Only
        // set on open rooms; sparse so targeted email-invite matches (no code)
        // don't collide on the unique index.
        joinCode: { type: String, unique: true, sparse: true },
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
