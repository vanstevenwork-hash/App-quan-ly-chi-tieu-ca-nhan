const CardShare = require('../models/CardShare');
const Card = require('../models/Card');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

// @desc  Invite a registered user to collaborate on a card
// @route POST /api/card-shares/invite
exports.invite = async (req, res) => {
    try {
        const { cardId, email } = req.body;
        if (!cardId || !email) {
            return res.status(400).json({ success: false, message: 'Thiếu cardId hoặc email' });
        }
        const normalizedEmail = email.toLowerCase().trim();

        // Only the card owner can invite
        const card = await Card.findOne({ _id: cardId, userId: req.user._id, isActive: true });
        if (!card) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ hoặc bạn không phải chủ thẻ' });
        }

        if (normalizedEmail === req.user.email.toLowerCase()) {
            return res.status(400).json({ success: false, message: 'Không thể chia sẻ thẻ cho chính mình' });
        }

        // Invitee must already have an account — no email-link flow, accept happens
        // in-app authenticated as this user, so we resolve them up front.
        const invitee = await User.findOne({ email: normalizedEmail });
        if (!invitee) {
            return res.status(404).json({ success: false, message: 'Người này chưa có tài khoản trong app' });
        }

        const existing = await CardShare.findOne({
            cardId,
            sharedWithUserId: invitee._id,
            status: { $in: ['pending', 'accepted'] },
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: existing.status === 'accepted'
                    ? 'Thẻ đã được chia sẻ với người này'
                    : 'Lời mời đang chờ được chấp nhận',
            });
        }

        const share = await CardShare.create({
            cardId,
            ownerId: req.user._id,
            sharedWithUserId: invitee._id,
            sharedWithEmail: normalizedEmail,
        });

        // Notify the invitee in-app — this is the entire invite channel, no email required.
        await createNotification({
            userId: invitee._id.toString(),
            title: 'Lời mời chia sẻ thẻ',
            message: `${req.user.name} mời bạn cùng quản lý thẻ ${card.bankName} •••• ${card.cardNumber}`,
            type: 'card_share_invite',
            icon: '🤝',
            iconBg: '#EEF2FF',
            isImportant: true,
            relatedId: share._id,
            relatedModel: 'CardShare',
            actionUrl: '/cards',
        });

        res.status(201).json({ success: true, data: share });
    } catch (err) {
        console.error('CardShare invite error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Accept or decline a pending card-share invite (in-app, authenticated as the invitee)
// @route PATCH /api/card-shares/:id/respond
exports.respond = async (req, res) => {
    try {
        const { accept } = req.body;
        const share = await CardShare.findOne({ _id: req.params.id, sharedWithUserId: req.user._id });
        if (!share) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời' });
        }
        if (share.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Lời mời này đã được xử lý' });
        }

        share.status = accept ? 'accepted' : 'declined';
        await share.save();

        const card = await Card.findById(share.cardId);
        await createNotification({
            userId: share.ownerId.toString(),
            title: accept ? 'Lời mời chia sẻ thẻ đã được chấp nhận' : 'Lời mời chia sẻ thẻ đã bị từ chối',
            message: `${req.user.name} đã ${accept ? 'chấp nhận' : 'từ chối'} lời mời chia sẻ thẻ ${card ? card.bankName : ''}`,
            type: 'system',
            icon: accept ? '🤝' : '👋',
            iconBg: accept ? '#ECFDF5' : '#FEF3C7',
            relatedId: share.cardId,
            relatedModel: 'Card',
        });

        res.json({ success: true, data: share, card });
    } catch (err) {
        console.error('CardShare respond error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Pending invites addressed to me
// @route GET /api/card-shares/incoming
exports.getIncoming = async (req, res) => {
    try {
        const shares = await CardShare.find({ sharedWithUserId: req.user._id, status: 'pending' })
            .populate('cardId')
            .populate('ownerId', 'name email avatar')
            .sort({ createdAt: -1 });
        const active = shares.filter(s => s.cardId && s.cardId.isActive);
        res.json({ success: true, data: active });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Get all cards shared WITH me (accepted)
// @route GET /api/card-shares/my-shares
exports.getMyShares = async (req, res) => {
    try {
        const shares = await CardShare.find({
            sharedWithUserId: req.user._id,
            status: 'accepted',
        })
            .populate('cardId')
            .populate('ownerId', 'name email avatar');

        // Filter out inactive cards
        const active = shares.filter(s => s.cardId && s.cardId.isActive);

        res.json({ success: true, data: active });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Get all shares for a specific card (owner only)
// @route GET /api/card-shares/card/:cardId
exports.getCardShares = async (req, res) => {
    try {
        const card = await Card.findOne({ _id: req.params.cardId, userId: req.user._id });
        if (!card) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ' });
        }

        const shares = await CardShare.find({
            cardId: req.params.cardId,
            status: { $in: ['pending', 'accepted'] },
        }).populate('sharedWithUserId', 'name email avatar');

        res.json({ success: true, data: shares });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Revoke/cancel a card share
// @route DELETE /api/card-shares/:id
exports.revoke = async (req, res) => {
    try {
        const share = await CardShare.findById(req.params.id);
        if (!share) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy chia sẻ' });
        }

        // Owner can revoke, or the shared user can leave
        const isOwner = share.ownerId.toString() === req.user._id.toString();
        const isSharedUser = share.sharedWithUserId.toString() === req.user._id.toString();

        if (!isOwner && !isSharedUser) {
            return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
        }

        share.status = 'revoked';
        await share.save();

        // Notify the other party
        if (isOwner) {
            await createNotification({
                userId: share.sharedWithUserId.toString(),
                title: 'Quyền chia sẻ thẻ đã bị thu hồi',
                message: 'Chủ thẻ đã thu hồi quyền truy cập của bạn',
                type: 'system',
                icon: '🔒',
                iconBg: '#FEE2E2',
                relatedId: share.cardId,
                relatedModel: 'Card',
            });
        } else {
            await createNotification({
                userId: share.ownerId.toString(),
                title: 'Người dùng đã rời khỏi thẻ chung',
                message: `${req.user.name} đã rời khỏi thẻ được chia sẻ`,
                type: 'system',
                icon: '👋',
                iconBg: '#FEF3C7',
                relatedId: share.cardId,
                relatedModel: 'Card',
            });
        }

        res.json({ success: true, message: 'Đã thu hồi chia sẻ' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
