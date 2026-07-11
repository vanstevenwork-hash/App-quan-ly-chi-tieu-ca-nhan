const { verifyAuthToken } = require('../utils/authToken');
const GameMatch = require('../models/GameMatch');
const engines = require('../games');
const { setIO } = require('./emitter');
const { computeSeriesScore } = require('../controllers/gameMatchController');

// matchId(string) -> Set<userId(string)> currently connected — presence only,
// never authoritative for game state (that's the DB). Fine to lose on restart.
const presence = new Map();
const turnTimers = new Map();

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
    setIO(io);
    const gamesNsp = io.of('/games');

    function clearTurnTimer(matchId) {
        const key = matchId.toString();
        const timer = turnTimers.get(key);
        if (timer) clearTimeout(timer);
        turnTimers.delete(key);
    }

    function scheduleTurnTimeout(match) {
        const matchId = match._id.toString();
        clearTurnTimer(matchId);

        if (match.status !== 'active') return;
        const needsLastPlayForTimeout = match.gameType === 'tien_len';
        if (needsLastPlayForTimeout && !match.state?.lastPlay) return;
        if (!match.state?.turnExpiresAt || match.state?.winnerId) return;

        const delay = Math.max(0, new Date(match.state.turnExpiresAt).getTime() - Date.now());
        const timer = setTimeout(async () => {
            try {
                const freshMatch = await GameMatch.findById(matchId);
                if (!freshMatch || freshMatch.status !== 'active') return;
                const freshNeedsLastPlay = freshMatch.gameType === 'tien_len';
                if (freshNeedsLastPlay && !freshMatch.state?.lastPlay) return;
                if (freshMatch.state?.winnerId) return;
                if (freshMatch.state.turnExpiresAt && new Date(freshMatch.state.turnExpiresAt).getTime() > Date.now()) {
                    scheduleTurnTimeout(freshMatch);
                    return;
                }

                const engine = engines[freshMatch.gameType];
                if (!engine) return;
                const byUserId = freshMatch.state.turnUserId;
                const { nextState, error } = engine.applyMove(freshMatch.state, { type: 'pass', auto: true }, byUserId);
                if (error) return;

                freshMatch.state = nextState;
                freshMatch.markModified('state');
                freshMatch.turnUserId = nextState.turnUserId;
                freshMatch.moves.push({ byUserId, move: { type: 'pass', auto: true }, at: new Date() });
                await freshMatch.save();

                gamesNsp.to(`match:${matchId}`).emit('game:autoPass', { byUserId });
                await emitStateToPlayers(gamesNsp, freshMatch);
                scheduleTurnTimeout(freshMatch);
            } catch (err) {
                gamesNsp.to(`match:${matchId}`).emit('match:error', { message: err.message });
            }
        }, delay);
        turnTimers.set(matchId, timer);
    }

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
                // Dead matches (abandoned/declined) never produce a match:state —
                // without an explicit error here, a client that lands on this match
                // (e.g. a stale link, or clicking back in after leaving) waits on
                // "connecting" forever with no signal telling it to stop.
                if (match.status === 'abandoned' || match.status === 'declined') {
                    return socket.emit('match:error', { message: 'Ván đấu đã kết thúc' });
                }

                socket.data.matchId = matchId;
                socket.join(`match:${matchId}`);
                addPresence(matchId, userId);

                if (match.status === 'active' || match.status === 'finished') {
                    const engine = engines[match.gameType];
                    if (match.status === 'active' && (match.gameType === 'phom' || match.state?.lastPlay) && !match.state?.turnExpiresAt) {
                        const turnSeconds = match.state?.turnSeconds || match.settings?.turnSeconds || 30;
                        match.state.turnExpiresAt = new Date(Date.now() + turnSeconds * 1000).toISOString();
                        match.markModified('state');
                        await match.save();
                    }
                    socket.emit('match:state', engine.toPlayerView(match.state, userId));
                    scheduleTurnTimeout(match);
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
                    clearTurnTimer(matchId);
                    const seriesScore = await computeSeriesScore(match.seriesId || match._id, match.players);
                    gamesNsp.to(`match:${matchId}`).emit('match:ended', { winnerId: match.winnerId.toString(), reason: 'normal', seriesScore });
                } else {
                    scheduleTurnTimeout(match);
                }
            } catch (err) {
                socket.emit('match:error', { message: err.message });
            }
        });

        socket.on('game:chat', async ({ matchId, text, kind }) => {
            try {
                const match = await GameMatch.findById(matchId);
                if (!match || !isPlayerInMatch(match, userId)) {
                    return socket.emit('match:error', { message: 'Không tìm thấy ván đấu hoặc bạn không có quyền tham gia' });
                }

                const cleanText = String(text || '').trim().slice(0, 160);
                const cleanKind = kind === 'emoji' ? 'emoji' : 'text';
                if (!cleanText) return;

                gamesNsp.to(`match:${matchId}`).emit('game:chat', {
                    id: `${Date.now()}-${socket.id}`,
                    matchId,
                    byUserId: userId,
                    byName: socket.user.name || 'Người chơi',
                    text: cleanText,
                    kind: cleanKind,
                    at: new Date().toISOString(),
                });
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
