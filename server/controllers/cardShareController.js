const CardShare = require('../models/CardShare');
const Card = require('../models/Card');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { createNotification } = require('./notificationController');
const { hasCardAccess } = require('../utils/cardAccess');

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
            sharedWithUserId: { $ne: null },
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

        // Owner can revoke, or the shared user can leave. sharedWithUserId can be
        // null on legacy pre-rework rows (from before it was a required field) —
        // guard instead of crashing so those can still be cleaned up via revoke.
        const isOwner = share.ownerId.toString() === req.user._id.toString();
        const isSharedUser = !!share.sharedWithUserId && share.sharedWithUserId.toString() === req.user._id.toString();

        if (!isOwner && !isSharedUser) {
            return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
        }

        // A legacy row with no resolved user can never be accepted and its status
        // can no longer be saved either (schema now requires sharedWithUserId) —
        // just delete it outright instead of trying to mark it 'revoked'.
        if (!share.sharedWithUserId) {
            await CardShare.deleteOne({ _id: share._id });
            return res.json({ success: true, message: 'Đã xóa lời mời không hợp lệ' });
        }

        share.status = 'revoked';
        await share.save();

        // Notify the other party (skip if there's no resolved user to notify)
        if (isOwner && share.sharedWithUserId) {
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

// @desc  This month's real cashback for a card — combines spend from BOTH the
//        owner and whoever it's shared with, so the cap is applied correctly
//        (the bank doesn't care who swiped). Available to the owner or any
//        accepted shared user.
// @route GET /api/card-shares/:cardId/cashback
exports.getCashback = async (req, res) => {
    try {
        const { cardId } = req.params;
        const access = await hasCardAccess(req.user._id, cardId);
        if (!access.allowed) {
            return res.status(403).json({ success: false, message: 'Không có quyền xem thẻ này' });
        }
        const card = access.card;

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const txs = await Transaction.find({
            cardId,
            paymentMethod: 'card',
            type: 'expense',
            date: { $gte: start, $lte: end },
        }).select('amount');

        const totalSpend = txs.reduce((s, t) => s + t.amount, 0);
        const rawCashback = totalSpend * (card.cashbackRate || 0) / 100;
        const cap = card.cashbackCap || 0;
        const cashbackEarned = cap > 0 ? Math.min(rawCashback, cap) : rawCashback;

        res.json({
            success: true,
            data: {
                cardId: card._id,
                bankName: card.bankName,
                cashbackRate: card.cashbackRate || 0,
                cashbackCap: cap,
                month: now.getMonth(),
                year: now.getFullYear(),
                totalSpend,
                cashbackEarned,
                capped: cap > 0 && rawCashback > cap,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
