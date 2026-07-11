const { verifyAuthToken } = require('../utils/authToken');
const GameMatch = require('../models/GameMatch');
const engines = require('../games');

// matchId(string) -> Set<userId(string)> currently connected — presence only,
// never authoritative for game state (that's the DB). Fine to lose on restart.
const presence = new Map();

function addPresence(matchId, userId) {
    if (!presence.has(matchId)) presence.set(matchId, new Set());
    presence.get(matchId).add(userId);
}
function removePresence(matchId, userId) {
    const set = presence.get(matchId);
    if (set) { set.delete(userId); if (set.size === 0) presence.delete(matchId); }
}

function isPlayerInMatch(match, userId) {
    return match.players.some(p => p.toString() === userId);
}

async function emitStateToPlayers(nsp, match) {
    const engine = engines[match.gameType];
    for (const socket of await nsp.in(`match:${match._id}`).fetchSockets()) {
        const uid = socket.user._id.toString();
        if (!isPlayerInMatch(match, uid)) continue;
        socket.emit('match:state', engine.toPlayerView(match.state, uid));
    }
}

module.exports = function attachGameSockets(io) {
    const gamesNsp = io.of('/games');

    gamesNsp.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            if (!token) return next(new Error('unauthorized'));
            socket.user = await verifyAuthToken(token);
            next();
        } catch {
            next(new Error('unauthorized'));
        }
    });

    gamesNsp.on('connection', (socket) => {
        const userId = socket.user._id.toString();

        socket.on('match:join', async ({ matchId }) => {
            try {
                const match = await GameMatch.findById(matchId);
                if (!match || !isPlayerInMatch(match, userId)) {
                    return socket.emit('match:error', { message: 'Không tìm thấy ván đấu hoặc bạn không có quyền tham gia' });
                }
                socket.data.matchId = matchId;
                socket.join(`match:${matchId}`);
                addPresence(matchId, userId);

                if (match.status === 'active' || match.status === 'finished') {
                    const engine = engines[match.gameType];
                    socket.emit('match:state', engine.toPlayerView(match.state, userId));
                }
                socket.to(`match:${matchId}`).emit('match:playerReconnected', { userId });
            } catch (err) {
                socket.emit('match:error', { message: err.message });
            }
        });

        socket.on('game:move', async ({ matchId, move }) => {
            try {
                const match = await GameMatch.findById(matchId);
                if (!match || !isPlayerInMatch(match, userId)) {
                    return socket.emit('match:error', { message: 'Không tìm thấy ván đấu hoặc bạn không có quyền tham gia' });
                }
                if (match.status !== 'active') {
                    return socket.emit('match:error', { message: 'Ván đấu chưa bắt đầu hoặc đã kết thúc' });
                }
                const engine = engines[match.gameType];
                if (!engine) return socket.emit('match:error', { message: 'Loại game không được hỗ trợ' });

                const { nextState, error } = engine.applyMove(match.state, move, userId);
                if (error) return socket.emit('match:error', { message: error });

                match.state = nextState;
                match.markModified('state'); // Mixed field — Mongoose won't autodetect deep mutation
                match.turnUserId = nextState.turnUserId;
                match.moves.push({ byUserId: userId, move, at: new Date() });
                if (nextState.winnerId) {
                    match.status = 'finished';
                    match.winnerId = nextState.winnerId;
                    match.finishedReason = 'normal';
                }
                await match.save();

                await emitStateToPlayers(gamesNsp, match);
                if (match.status === 'finished') {
                    gamesNsp.to(`match:${matchId}`).emit('match:ended', { winnerId: match.winnerId.toString() });
                }
            } catch (err) {
                socket.emit('match:error', { message: err.message });
            }
        });

        socket.on('match:leave', ({ matchId }) => {
            socket.leave(`match:${matchId}`);
            removePresence(matchId, userId);
        });

        socket.on('disconnect', () => {
            const matchId = socket.data.matchId;
            if (matchId) {
                removePresence(matchId, userId);
                socket.to(`match:${matchId}`).emit('match:playerLeft', { userId });
            }
        });
    });
};
