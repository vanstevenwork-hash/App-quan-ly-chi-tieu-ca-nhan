const GameMatch = require('../models/GameMatch');
const User = require('../models/User');
const { createNotification } = require('./notificationController');
const engines = require('../games');

const GAME_LABELS = { tien_len: 'Tiến lên miền Nam', phom: 'Phỏm' };

function normalizeTurnSeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 30;
    return Math.max(10, Math.min(120, Math.round(parsed)));
}

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

        const match = await GameMatch.create({
            gameType,
            players: playerIds,
            acceptedPlayerIds: [req.user._id],
            hostId: req.user._id,
            settings: { turnSeconds: normalizeTurnSeconds(turnSeconds) },
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

        res.json({ success: true, data: { ...match.toObject(), state } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
