const crypto = require('crypto');
const CardShare = require('../models/CardShare');
const Card = require('../models/Card');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { createNotification } = require('./notificationController');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// @desc  Invite someone to share a card
// @route POST /api/card-shares/invite
exports.invite = async (req, res) => {
    try {
        const { cardId, email } = req.body;
        if (!cardId || !email) {
            return res.status(400).json({ success: false, message: 'Thiếu cardId hoặc email' });
        }

        // Only card owner can invite
        const card = await Card.findOne({ _id: cardId, userId: req.user._id, isActive: true });
        if (!card) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ hoặc bạn không phải chủ thẻ' });
        }

        // Cannot share to yourself
        if (email.toLowerCase() === req.user.email.toLowerCase()) {
            return res.status(400).json({ success: false, message: 'Không thể chia sẻ thẻ cho chính mình' });
        }

        // Check if already shared/pending for this card+email
        const existing = await CardShare.findOne({
            cardId,
            sharedWithEmail: email.toLowerCase(),
            status: { $in: ['pending', 'accepted'] },
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: existing.status === 'accepted'
                    ? 'Thẻ đã được chia sẻ với email này'
                    : 'Lời mời đang chờ được chấp nhận',
            });
        }

        // Generate secure invite token
        const inviteToken = crypto.randomBytes(32).toString('hex');

        const share = await CardShare.create({
            cardId,
            ownerId: req.user._id,
            sharedWithEmail: email.toLowerCase(),
            inviteToken,
        });

        // Send invitation email
        const inviteLink = `${FRONTEND_URL}/cards/accept-invite?token=${inviteToken}`;
        const bankLabel = `${card.bankName} •••• ${card.cardNumber}`;

        try {
            await sendEmail({
                email: email.toLowerCase(),
                subject: `${req.user.name} mời bạn cùng quản lý thẻ — Zenith Finance`,
                message: `${req.user.name} đã mời bạn cùng quản lý thẻ ${bankLabel}.\n\nBấm vào link sau để chấp nhận:\n${inviteLink}\n\nNếu bạn chưa có tài khoản Zenith Finance, hãy đăng ký trước rồi bấm link trên.`,
                html: `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
                        <h2 style="color: #1e293b; margin-bottom: 8px;">Lời mời chia sẻ thẻ 💳</h2>
                        <p style="color: #64748b; font-size: 15px; line-height: 1.6;">
                            <strong style="color: #334155;">${req.user.name}</strong> đã mời bạn cùng quản lý thẻ
                            <strong style="color: #334155;">${bankLabel}</strong> trên Zenith Finance.
                        </p>
                        <p style="color: #64748b; font-size: 14px;">
                            Bạn sẽ có thể thêm, sửa và xóa giao dịch trên thẻ này.
                        </p>
                        <div style="text-align: center; margin: 28px 0;">
                            <a href="${inviteLink}"
                               style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(99,102,241,0.3);">
                                Chấp nhận lời mời
                            </a>
                        </div>
                        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                            Nếu bạn chưa có tài khoản, hãy đăng ký trước rồi bấm nút ở trên.
                        </p>
                    </div>
                `,
            });
        } catch (emailErr) {
            console.error('📧 Failed to send invite email:', emailErr.message);
            // Still return success — the share is created, email might be logged to console
        }

        // Notify the owner
        await createNotification({
            userId: req.user._id.toString(),
            title: 'Đã gửi lời mời chia sẻ thẻ',
            message: `Lời mời đã được gửi đến ${email}`,
            type: 'system',
            icon: '📤',
            iconBg: '#EEF2FF',
            relatedId: card._id,
            relatedModel: 'Card',
        });

        res.status(201).json({ success: true, data: share });
    } catch (err) {
        console.error('CardShare invite error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Accept a card share invitation
// @route POST /api/card-shares/accept
exports.accept = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Thiếu token' });
        }

        const share = await CardShare.findOne({ inviteToken: token });
        if (!share) {
            return res.status(404).json({ success: false, message: 'Lời mời không tồn tại hoặc đã hết hạn' });
        }

        if (share.status === 'accepted') {
            return res.status(400).json({ success: false, message: 'Lời mời đã được chấp nhận trước đó' });
        }

        if (share.status === 'revoked') {
            return res.status(400).json({ success: false, message: 'Lời mời đã bị thu hồi' });
        }

        // Assign the current logged-in user as the shared user
        share.sharedWithUserId = req.user._id;
        share.status = 'accepted';
        await share.save();

        // Populate card info for response
        const card = await Card.findById(share.cardId);

        // Notify the card owner
        await createNotification({
            userId: share.ownerId.toString(),
            title: 'Lời mời đã được chấp nhận!',
            message: `${req.user.name} đã chấp nhận chia sẻ thẻ ${card ? card.bankName : ''}`,
            type: 'system',
            icon: '🤝',
            iconBg: '#ECFDF5',
            relatedId: share.cardId,
            relatedModel: 'Card',
        });

        // Notify the accepting user
        await createNotification({
            userId: req.user._id.toString(),
            title: 'Đã chấp nhận chia sẻ thẻ',
            message: `Bạn giờ có thể quản lý giao dịch trên thẻ ${card ? card.bankName : ''}`,
            type: 'system',
            icon: '💳',
            iconBg: '#EEF2FF',
            relatedId: share.cardId,
            relatedModel: 'Card',
        });

        res.json({ success: true, data: share, card });
    } catch (err) {
        console.error('CardShare accept error:', err);
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
        const isSharedUser = share.sharedWithUserId && share.sharedWithUserId.toString() === req.user._id.toString();

        if (!isOwner && !isSharedUser) {
            return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
        }

        share.status = 'revoked';
        await share.save();

        // Notify the other party
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
        } else if (isSharedUser) {
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
