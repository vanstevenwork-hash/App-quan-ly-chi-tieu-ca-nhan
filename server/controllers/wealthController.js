const WealthSource = require('../models/WealthSource');
const { createNotification } = require('./notificationController');

// GET /api/wealth
exports.getAll = async (req, res) => {
    try {
        const sources = await WealthSource.find({ userId: req.user._id }).sort({ createdAt: -1 });
        const total = sources.reduce((s, w) => s + w.balance, 0);
        res.json({ success: true, data: sources, total });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/wealth
exports.create = async (req, res) => {
    try {
        const { name, icon, color, balance, category, note } = req.body;
        const source = await WealthSource.create({
            userId: req.user._id,
            name, icon: icon || '💰', color: color || '#6C63FF',
            balance: Number(balance) || 0,
            category: category || 'other',
            note: note || '',
        });

        await createNotification({
            userId: req.user._id.toString(),
            title: `Đã thêm nguồn tài sản: ${source.name}`,
            message: `${source.icon} ${source.name} — ${source.balance.toLocaleString('vi-VN')}đ`,
            type: 'system',
            icon: source.icon,
            iconBg: '#EEF2FF',
            relatedId: source._id,
            relatedModel: 'WealthSource',
        });

        res.status(201).json({ success: true, data: source });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// PUT /api/wealth/:id
exports.update = async (req, res) => {
    try {
        const source = await WealthSource.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!source) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
        res.json({ success: true, data: source });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// DELETE /api/wealth/:id
exports.remove = async (req, res) => {
    try {
        const source = await WealthSource.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!source) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
        res.json({ success: true, message: 'Đã xoá' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
