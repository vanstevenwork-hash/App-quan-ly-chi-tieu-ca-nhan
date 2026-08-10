const User = require('../models/User');

const clean = (b = {}) => ({
    label: String(b.label || '').trim().slice(0, 40),
    catIconType: String(b.catIconType || 'khac'),
    color: /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : '#6B7280',
    type: b.type === 'income' ? 'income' : 'expense',
});

// GET /api/categories — the logged-in user's custom categories
exports.list = async (req, res) => {
    const user = await User.findById(req.user._id).select('customCategories');
    res.json({ success: true, categories: user?.customCategories || [] });
};

// POST /api/categories — add one (label must be unique vs the user's existing ones)
exports.create = async (req, res) => {
    try {
        const data = clean(req.body);
        if (!data.label) return res.status(400).json({ success: false, message: 'Thiếu tên danh mục' });
        const user = await User.findById(req.user._id);
        if ((user.customCategories || []).some(c => c.label.toLowerCase() === data.label.toLowerCase()))
            return res.status(400).json({ success: false, message: 'Danh mục này đã tồn tại' });
        user.customCategories.push(data);
        await user.save();
        res.json({ success: true, categories: user.customCategories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/categories/:id — edit one
exports.update = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const cat = user.customCategories.id(req.params.id);
        if (!cat) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
        const data = clean({ ...cat.toObject(), ...req.body });
        if (!data.label) return res.status(400).json({ success: false, message: 'Thiếu tên danh mục' });
        Object.assign(cat, data);
        await user.save();
        res.json({ success: true, categories: user.customCategories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/categories/:id
exports.remove = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const cat = user.customCategories.id(req.params.id);
        if (cat) { cat.deleteOne(); await user.save(); }
        res.json({ success: true, categories: user.customCategories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
