const Notification = require('../models/Notification');

// GET /api/notifications — list, with optional type filter + pagination
exports.getAll = async (req, res) => {
    try {
        const { type, page = 1, limit = 20 } = req.query;
        const filter = { userId: req.user._id };
        if (type && type !== 'all') {
            if (type === 'important') filter.isImportant = true;
            else filter.type = type;
        }
        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));
        const total = await Notification.countDocuments(filter);
        const unread = await Notification.countDocuments({ userId: req.user._id, isRead: false });
        res.json({ success: true, data: notifications, total, unread });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
    try {
        const notif = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { isRead: true },
            { new: true }
        );
        if (!notif) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
        res.json({ success: true, data: notif });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/notifications/read-all — mark all as read
exports.markAllRead = async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
        res.json({ success: true, message: 'Đã đọc tất cả thông báo' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/notifications/:id
exports.deleteOne = async (req, res) => {
    try {
        const notif = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!notif) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
        res.json({ success: true, message: 'Đã xóa thông báo' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/notifications/clear-all — clear all for user
exports.clearAll = async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.user._id });
        res.json({ success: true, message: 'Đã xóa tất cả thông báo' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Helper — create notification from other controllers
exports.createNotification = async ({ userId, title, message, type = 'transaction', icon = '🔔', iconBg = '#EEF2FF', isImportant = false, relatedId, relatedModel, actionUrl }) => {
    try {
        const notif = await Notification.create({ userId, title, message, type, icon, iconBg, isImportant, relatedId, relatedModel, actionUrl });
        // Push realtime to browser via SSE
        try {
            const { pushSSE } = require('../sse');
            pushSSE(userId.toString(), { type: 'notification', data: notif });
        } catch { /* server may not be fully loaded yet — ignore */ }
        return notif;
    } catch (err) {
        console.error('Notification creation failed:', err.message);
    }
};
