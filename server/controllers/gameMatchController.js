const GameMatch = require('../models/GameMatch');
const User = require('../models/User');
const { createNotification } = require('./notificationController');
const engines = require('../games');

const GAME_LABELS = { tien_len: 'Tiến lên miền Nam', phom: 'Phỏm' };

// @desc  Invite a registered user to a 2-player game
// @route POST /api/game-matches/invite
exports.invite = async (req, res) => {
    try {
        const { email, gameType } = req.body;
        if (!email || !gameType) {
            return res.status(400).json({ success: false, message: 'Thiếu email hoặc gameType' });
        }
        if (!engines[gameType]) {
            return res.status(400).json({ success: false, message: 'Loại game không được hỗ trợ' });
        }
        const normalizedEmail = email.toLowerCase().trim();
        if (normalizedEmail === req.user.email.toLowerCase()) {
            return res.status(400).json({ success: false, message: 'Không thể mời chính mình' });
        }

        const invitee = await User.findOne({ email: normalizedEmail });
        if (!invitee) {
            return res.status(404).json({ success: false, message: 'Người này chưa có tài khoản trong app' });
        }

        const existing = await GameMatch.findOne({
            players: { $all: [req.user._id, invitee._id] },
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
            players: [req.user._id, invitee._id],
            hostId: req.user._id,
        });

        await createNotification({
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
        });

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
            const engine = engines[match.gameType];
            const playerIds = match.players.map(p => p.toString());
            match.state = engine.dealHands(playerIds);
            match.turnUserId = match.state.turnUserId;
            match.status = 'active';
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
        const matches = await GameMatch.find({ players: req.user._id, status: 'pending_invite', hostId: { $ne: req.user._id } })
            .populate('hostId', 'name email avatar')
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
        res.json({ success: true, data: matches });
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
