const crypto = require('crypto');
const mongoose = require('mongoose');
const GameMatch = require('../models/GameMatch');
const User = require('../models/User');
const { createNotification } = require('./notificationController');
const engines = require('../games');
const { emitToMatch } = require('../sockets/emitter');

const GAME_LABELS = { tien_len: 'Tiến lên miền Nam', phom: 'Phỏm' };

function normalizeTurnSeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 30;
    return Math.max(10, Math.min(120, Math.round(parsed)));
}

// URL-safe short code; retries on the (astronomically rare) collision.
async function generateJoinCode() {
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = crypto.randomBytes(6).toString('base64url'); // ~8 chars
        const exists = await GameMatch.exists({ joinCode: code });
        if (!exists) return code;
    }
    throw new Error('Không tạo được mã phòng, thử lại');
}

// Tallies wins per player across every finished match in a rematch chain, so
// the UI can show a running "Bạn 2 - 1 Đối thủ" score instead of the session
// resetting to zero every time someone clicks "Chơi tiếp".
async function computeSeriesScore(seriesId, players) {
    if (!seriesId) return null;
    const matches = await GameMatch.find({ seriesId, status: 'finished' }).select('winnerId');
    const score = {};
    players.forEach(p => { score[p.toString()] = 0; });
    matches.forEach(m => {
        if (!m.winnerId) return;
        const key = m.winnerId.toString();
        score[key] = (score[key] || 0) + 1;
    });
    return { score, roundsPlayed: matches.length };
}
exports.computeSeriesScore = computeSeriesScore;

// @desc  Invite registered users to a 2-4 player game
// @route POST /api/game-matches/invite
exports.invite = async (req, res) => {
    try {
        const { email, emails, gameType, turnSeconds } = req.body;
        const rawEmails = Array.isArray(emails) ? emails : [email].filter(Boolean);
        const normalizedEmails = Array.from(new Set(rawEmails.map(e => String(e).toLowerCase().trim()).filter(Boolean)));
        if (normalizedEmails.length === 0 || !gameType) {
            return res.status(400).json({ success: false, message: 'Thiếu email hoặc gameType' });
        }
        if (normalizedEmails.length > 3) {
            return res.status(400).json({ success: false, message: 'Một ván chỉ hỗ trợ tối đa 4 người chơi' });
        }
        if (!engines[gameType]) {
            return res.status(400).json({ success: false, message: 'Loại game không được hỗ trợ' });
        }
        if (normalizedEmails.includes(req.user.email.toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Không thể mời chính mình' });
        }

        const invitees = await User.find({ email: { $in: normalizedEmails } });
        if (invitees.length !== normalizedEmails.length) {
            const found = new Set(invitees.map(u => u.email.toLowerCase()));
            const missing = normalizedEmails.filter(e => !found.has(e));
            return res.status(404).json({ success: false, message: `Chưa có tài khoản: ${missing.join(', ')}` });
        }

        const playerIds = [req.user._id, ...invitees.map(u => u._id)];
        // $all alone only checks that playerIds is a SUBSET of the match's players —
        // combined with $size it becomes an exact-set match. Without $size, a stuck
        // pending 3-player match [O,A,B] would falsely block a brand-new 2-player
        // invite to just A (or just B), since {O,A} is a subset of {O,A,B}.
        const existing = await GameMatch.findOne({
            players: { $all: playerIds, $size: playerIds.length },
            gameType,
            status: { $in: ['pending_invite', 'active'] },
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: existing.status === 'active' ? 'Đang có ván đấu với người này' : 'Lời mời đang chờ được chấp nhận',
            });
        }

        // Pre-generate the _id so a fresh match can self-reference as the start
        // of its own rematch series (seriesId === _id) in a single write.
        const newMatchId = new mongoose.Types.ObjectId();
        const match = await GameMatch.create({
            _id: newMatchId,
            gameType,
            players: playerIds,
            acceptedPlayerIds: [req.user._id],
            hostId: req.user._id,
            settings: { turnSeconds: normalizeTurnSeconds(turnSeconds) },
            seriesId: newMatchId,
        });

        await Promise.all(invitees.map(invitee => createNotification({
            userId: invitee._id.toString(),
            title: 'Lời mời chơi bài',
            message: `${req.user.name} mời bạn chơi ${GAME_LABELS[gameType] || gameType}`,
            type: 'game_invite',
            icon: '🃏',
            iconBg: '#EEF2FF',
            isImportant: true,
            relatedId: match._id,
            relatedModel: 'GameMatch',
            actionUrl: `/games/${match._id}`,
        })));

        res.status(201).json({ success: true, data: match });
    } catch (err) {
        console.error('GameMatch invite error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Create an OPEN room the host shares via link — starts with just the
//        host and a joinCode; the first person to open the link fills it to 2
//        and the game auto-starts. Reuses an existing empty open room of the
//        same game type so repeated "Share" taps don't pile up dead rooms.
// @route POST /api/game-matches/room
exports.createRoom = async (req, res) => {
    try {
        const { gameType, turnSeconds, maxPlayers } = req.body;
        if (!gameType || !engines[gameType]) {
            return res.status(400).json({ success: false, message: 'Loại game không được hỗ trợ' });
        }
        const targetPlayers = Math.max(2, Math.min(4, Math.round(Number(maxPlayers) || 2)));

        // Reuse an existing empty open room of the same type + headcount so
        // repeated "Share" taps don't pile up dead rooms.
        const existing = await GameMatch.findOne({
            hostId: req.user._id,
            gameType,
            status: 'pending_invite',
            players: { $size: 1 },
            'settings.maxPlayers': targetPlayers,
            joinCode: { $ne: null },
        });
        if (existing) {
            return res.json({ success: true, data: existing });
        }

        const newMatchId = new mongoose.Types.ObjectId();
        const match = await GameMatch.create({
            _id: newMatchId,
            gameType,
            players: [req.user._id],
            acceptedPlayerIds: [req.user._id],
            hostId: req.user._id,
            settings: { turnSeconds: normalizeTurnSeconds(turnSeconds), maxPlayers: targetPlayers },
            seriesId: newMatchId,
            joinCode: await generateJoinCode(),
        });

        res.status(201).json({ success: true, data: match });
    } catch (err) {
        console.error('GameMatch createRoom error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Join an open room via its share code. Idempotent for players already
//        in; adds newcomers if there's room; auto-deals & activates once the
//        room reaches 2 players.
// @route POST /api/game-matches/join/:code
exports.joinByCode = async (req, res) => {
    try {
        const match = await GameMatch.findOne({ joinCode: req.params.code });
        if (!match) return res.status(404).json({ success: false, message: 'Phòng không tồn tại hoặc đã hết hạn' });

        const uid = req.user._id.toString();
        const alreadyIn = match.players.some(p => p.toString() === uid);

        // Already a player — just let them back in (reconnect / re-open link).
        if (alreadyIn) {
            return res.json({ success: true, data: { _id: match._id } });
        }
        if (match.status !== 'pending_invite') {
            return res.status(400).json({ success: false, message: 'Ván đã bắt đầu hoặc đã kết thúc' });
        }
        const targetPlayers = Math.max(2, Math.min(4, match.settings?.maxPlayers || 2));
        if (match.players.length >= targetPlayers) {
            return res.status(400).json({ success: false, message: 'Phòng đã đủ người' });
        }

        match.players.push(req.user._id);
        match.acceptedPlayerIds.push(req.user._id);

        // Only start once the room hits its configured headcount — a 3-4 player
        // room stays open until enough people have joined.
        if (match.players.length >= targetPlayers) {
            const engine = engines[match.gameType];
            const playerIds = match.players.map(p => p.toString());
            match.state = engine.dealHands(playerIds, { turnSeconds: match.settings?.turnSeconds || 30 });
            match.turnUserId = match.state.turnUserId;
            match.status = 'active';
        }
        await match.save();

        // Nudge everyone already sitting in the room (e.g. the waiting host) to
        // re-request their per-player state now that the match is live.
        emitToMatch(match._id.toString(), 'match:refresh', {});

        if (match.hostId.toString() !== uid) {
            await createNotification({
                userId: match.hostId.toString(),
                title: 'Có người vào phòng!',
                message: `${req.user.name} đã tham gia ván ${GAME_LABELS[match.gameType] || match.gameType}`,
                type: 'system',
                icon: '🃏',
                iconBg: '#ECFDF5',
                relatedId: match._id,
                relatedModel: 'GameMatch',
                actionUrl: `/games/${match._id}`,
            });
        }

        res.json({ success: true, data: { _id: match._id } });
    } catch (err) {
        console.error('GameMatch joinByCode error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Host starts an open room immediately (before it's full), as long as
//        at least 2 people have joined.
// @route POST /api/game-matches/:id/start
exports.startNow = async (req, res) => {
    try {
        const match = await GameMatch.findOne({ _id: req.params.id, hostId: req.user._id });
        if (!match) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng hoặc bạn không phải chủ phòng' });
        if (match.status !== 'pending_invite') {
            return res.status(400).json({ success: false, message: 'Ván đã bắt đầu hoặc đã kết thúc' });
        }
        if (match.players.length < 2) {
            return res.status(400).json({ success: false, message: 'Cần ít nhất 2 người để bắt đầu' });
        }

        const engine = engines[match.gameType];
        const playerIds = match.players.map(p => p.toString());
        match.state = engine.dealHands(playerIds, { turnSeconds: match.settings?.turnSeconds || 30 });
        match.turnUserId = match.state.turnUserId;
        match.status = 'active';
        await match.save();

        emitToMatch(match._id.toString(), 'match:refresh', {});
        res.json({ success: true, data: { _id: match._id } });
    } catch (err) {
        console.error('GameMatch startNow error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Accept or decline a pending game invite
// @route PATCH /api/game-matches/:id/respond
exports.respond = async (req, res) => {
    try {
        const { accept } = req.body;
        const match = await GameMatch.findOne({ _id: req.params.id, players: req.user._id });
        if (!match) return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời' });
        if (match.status !== 'pending_invite') {
            return res.status(400).json({ success: false, message: 'Lời mời này đã được xử lý' });
        }
        if (match.hostId.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'Không thể tự phản hồi lời mời của chính mình' });
        }

        if (accept) {
            const acceptedIds = new Set((match.acceptedPlayerIds || []).map(id => id.toString()));
            acceptedIds.add(req.user._id.toString());
            match.acceptedPlayerIds = Array.from(acceptedIds);
            const allAccepted = match.players.every(p => acceptedIds.has(p.toString()));
            if (allAccepted) {
                const engine = engines[match.gameType];
                const playerIds = match.players.map(p => p.toString());
                match.state = engine.dealHands(playerIds, { turnSeconds: match.settings?.turnSeconds || 30 });
                match.turnUserId = match.state.turnUserId;
                match.status = 'active';
            }
        } else {
            match.status = 'declined';
        }
        await match.save();

        await createNotification({
            userId: match.hostId.toString(),
            title: accept ? 'Lời mời chơi bài đã được chấp nhận' : 'Lời mời chơi bài đã bị từ chối',
            message: `${req.user.name} đã ${accept ? 'chấp nhận' : 'từ chối'} lời mời chơi ${GAME_LABELS[match.gameType] || match.gameType}`,
            type: 'system',
            icon: accept ? '🃏' : '👋',
            iconBg: accept ? '#ECFDF5' : '#FEF3C7',
            relatedId: match._id,
            relatedModel: 'GameMatch',
            actionUrl: `/games/${match._id}`,
        });

        res.json({ success: true, data: match });
    } catch (err) {
        console.error('GameMatch respond error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Pending invites addressed to me
// @route GET /api/game-matches/incoming
exports.getIncoming = async (req, res) => {
    try {
        const matches = await GameMatch.find({
            players: req.user._id,
            status: 'pending_invite',
            hostId: { $ne: req.user._id },
            acceptedPlayerIds: { $ne: req.user._id },
        })
            .populate('hostId', 'name email avatar')
            .populate('players', 'name email avatar')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: matches });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  My active/in-progress matches
// @route GET /api/game-matches/active
exports.getActive = async (req, res) => {
    try {
        const matches = await GameMatch.find({ players: req.user._id, status: 'active' })
            .populate('players', 'name email avatar')
            .sort({ updatedAt: -1 });
        const userId = req.user._id.toString();
        const data = matches.map(match => {
            const obj = match.toObject();
            const engine = engines[match.gameType];
            if (obj.state && engine) obj.state = engine.toPlayerView(match.state, userId);
            return obj;
        });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Pending invites I sent that are still awaiting a response
// @route GET /api/game-matches/sent
exports.getSent = async (req, res) => {
    try {
        const matches = await GameMatch.find({ hostId: req.user._id, status: 'pending_invite' })
            .populate('players', 'name email avatar')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: matches });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Cancel a pending invite you created — otherwise a stuck pending_invite
//        match (e.g. nobody ever responded) permanently blocks any new invite
//        that overlaps with its player set (see the exact-set check in invite()).
// @route DELETE /api/game-matches/:id
exports.cancel = async (req, res) => {
    try {
        const match = await GameMatch.findOne({ _id: req.params.id, hostId: req.user._id });
        if (!match) return res.status(404).json({ success: false, message: 'Không tìm thấy ván đấu' });
        if (match.status !== 'pending_invite') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể hủy lời mời đang chờ chấp nhận' });
        }
        match.status = 'abandoned';
        await match.save();
        res.json({ success: true, message: 'Đã hủy lời mời' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Deliberately leave an active match — marks it abandoned and tells the
//        other player(s) both live (socket, if they're in the match room) and
//        via a persisted notification (if they're not currently connected).
// @route POST /api/game-matches/:id/leave
exports.leave = async (req, res) => {
    try {
        const match = await GameMatch.findOne({ _id: req.params.id, players: req.user._id });
        if (!match) return res.status(404).json({ success: false, message: 'Không tìm thấy ván đấu' });
        if (match.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Ván đấu không ở trạng thái đang chơi' });
        }

        match.status = 'abandoned';
        match.finishedReason = 'abandoned';
        await match.save();

        const others = match.players.filter(p => p.toString() !== req.user._id.toString());
        await Promise.all(others.map(uid => createNotification({
            userId: uid.toString(),
            title: 'Đối thủ đã rời ván đấu',
            message: `${req.user.name} đã rời khỏi ván ${GAME_LABELS[match.gameType] || match.gameType}`,
            type: 'system',
            icon: '🚪',
            iconBg: '#FEE2E2',
            relatedId: match._id,
            relatedModel: 'GameMatch',
            actionUrl: '/games',
        })));

        emitToMatch(match._id.toString(), 'match:ended', {
            winnerId: null,
            reason: 'abandoned',
            byUserId: req.user._id.toString(),
        });

        res.json({ success: true, message: 'Đã rời ván đấu' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Start a new round with the same players/settings right after a
//        finished match — reuses the existing invite/accept flow (the other
//        player still has to explicitly accept) but skips the email lookup
//        since both players are already known from the match just played.
// @route POST /api/game-matches/:id/rematch
exports.rematch = async (req, res) => {
    try {
        const previous = await GameMatch.findOne({ _id: req.params.id, players: req.user._id });
        if (!previous) return res.status(404).json({ success: false, message: 'Không tìm thấy ván đấu' });
        if (previous.status !== 'finished') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể chơi tiếp sau khi ván đã kết thúc' });
        }

        // Someone already requested a rematch off this match — hand back that
        // same one instead of creating a duplicate (covers both players
        // tapping "Chơi tiếp" around the same time).
        const existingRematch = await GameMatch.findOne({ previousMatchId: previous._id });
        if (existingRematch) {
            return res.json({ success: true, data: existingRematch });
        }

        const seriesId = previous.seriesId || previous._id;
        const newMatchId = new mongoose.Types.ObjectId();
        const match = await GameMatch.create({
            _id: newMatchId,
            gameType: previous.gameType,
            players: previous.players,
            acceptedPlayerIds: [req.user._id],
            hostId: req.user._id,
            settings: previous.settings,
            seriesId,
            previousMatchId: previous._id,
        });

        const others = previous.players.filter(p => p.toString() !== req.user._id.toString());
        await Promise.all(others.map(uid => createNotification({
            userId: uid.toString(),
            title: 'Muốn chơi tiếp!',
            message: `${req.user.name} muốn chơi tiếp ván ${GAME_LABELS[previous.gameType] || previous.gameType}`,
            type: 'game_invite',
            icon: '🃏',
            iconBg: '#EEF2FF',
            isImportant: true,
            relatedId: match._id,
            relatedModel: 'GameMatch',
            actionUrl: `/games/${match._id}`,
        })));

        res.status(201).json({ success: true, data: match });
    } catch (err) {
        console.error('GameMatch rematch error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Fetch one match (initial HTTP load before the socket takes over)
// @route GET /api/game-matches/:id
exports.getById = async (req, res) => {
    try {
        const match = await GameMatch.findOne({ _id: req.params.id, players: req.user._id })
            .populate('players', 'name email avatar')
            .populate('hostId', 'name email avatar');
        if (!match) return res.status(404).json({ success: false, message: 'Không tìm thấy ván đấu' });

        let state = match.state;
        if (state && match.status !== 'pending_invite') {
            const engine = engines[match.gameType];
            state = engine.toPlayerView(match.state, req.user._id.toString());
        }

        const seriesScore = await computeSeriesScore(match.seriesId || match._id, match.players.map(p => p._id));

        res.json({ success: true, data: { ...match.toObject(), state, seriesScore } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Overall win/loss stats across every finished match (any series),
//        broken down by game type and by opponent, for the Settings stats page.
// @route GET /api/game-matches/stats
exports.getStats = async (req, res) => {
    try {
        const uid = req.user._id.toString();
        const matches = await GameMatch.find({ players: req.user._id, status: 'finished' })
            .populate('players', 'name email avatar')
            .sort({ updatedAt: -1 });

        let wins = 0;
        let losses = 0;
        const byGameType = { tien_len: { played: 0, won: 0 }, phom: { played: 0, won: 0 } };
        const byOpponent = new Map();

        matches.forEach(match => {
            const won = !!match.winnerId && match.winnerId.toString() === uid;
            if (won) wins++; else losses++;

            if (byGameType[match.gameType]) {
                byGameType[match.gameType].played++;
                if (won) byGameType[match.gameType].won++;
            }

            // A match can have up to 4 players — .find() would silently drop
            // every opponent past the first, so 3-4 player matches under-counted
            // everyone except whoever happened to be first in `players`.
            const opponents = match.players.filter(p => p._id.toString() !== uid);
            opponents.forEach(opponent => {
                const key = opponent._id.toString();
                if (!byOpponent.has(key)) {
                    byOpponent.set(key, { userId: key, name: opponent.name, avatar: opponent.avatar, played: 0, won: 0, lost: 0 });
                }
                const record = byOpponent.get(key);
                record.played++;
                if (won) record.won++; else record.lost++;
            });
        });

        const recentMatches = matches.slice(0, 15).map(match => {
            const opponents = match.players.filter(p => p._id.toString() !== uid);
            return {
                _id: match._id,
                gameType: match.gameType,
                won: !!match.winnerId && match.winnerId.toString() === uid,
                opponentName: opponents.map(p => p.name).join(', ') || null,
                finishedAt: match.updatedAt,
            };
        });

        res.json({
            success: true,
            data: {
                totalMatches: matches.length,
                wins,
                losses,
                byGameType,
                byOpponent: Array.from(byOpponent.values()).sort((a, b) => b.played - a.played),
                recentMatches,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
