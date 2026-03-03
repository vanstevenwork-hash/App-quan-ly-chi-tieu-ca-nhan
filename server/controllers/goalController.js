const Goal = require('../models/Goal');
const { createNotification } = require('./notificationController');

// GET /api/goals
exports.getGoals = async (req, res) => {
    try {
        const goals = await Goal.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, data: goals });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/goals/:id
exports.getGoal = async (req, res) => {
    try {
        const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
        if (!goal) return res.status(404).json({ success: false, message: 'Không tìm thấy mục tiêu' });
        res.json({ success: true, data: goal });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/goals
exports.createGoal = async (req, res) => {
    try {
        const goal = await Goal.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: goal });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/goals/:id
exports.updateGoal = async (req, res) => {
    try {
        const goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!goal) return res.status(404).json({ success: false, message: 'Không tìm thấy mục tiêu' });
        res.json({ success: true, data: goal });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/goals/:id
exports.deleteGoal = async (req, res) => {
    try {
        const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!goal) return res.status(404).json({ success: false, message: 'Không tìm thấy mục tiêu' });
        res.json({ success: true, message: 'Đã xóa mục tiêu' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/goals/:id/deposit — add money to a goal
exports.deposit = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });
        const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
        if (!goal) return res.status(404).json({ success: false, message: 'Không tìm thấy mục tiêu' });

        goal.currentAmount = Math.min(goal.currentAmount + amount, goal.targetAmount);
        await goal.save();

        const pct = Math.round((goal.currentAmount / goal.targetAmount) * 100);
        // Notify on milestone
        if (pct >= 100) {
            await createNotification({
                userId: req.user._id.toString(),
                title: `🎉 Đạt mục tiêu "${goal.name}"!`,
                message: 'Chúc mừng! Bạn đã đạt được mục tiêu tài chính này!',
                type: 'saving', icon: '🏆', iconBg: '#ECFDF5',
                isImportant: true, relatedId: goal._id, relatedModel: 'Goal',
            });
        } else if (pct >= 50 && pct < 55) {
            await createNotification({
                userId: req.user._id.toString(),
                title: `Đã đạt 50% mục tiêu "${goal.name}"`,
                message: `Còn ${(goal.targetAmount - goal.currentAmount).toLocaleString('vi-VN')}đ nữa là bạn đạt mục tiêu!`,
                type: 'saving', icon: '🐷', iconBg: '#ECFDF5',
                relatedId: goal._id, relatedModel: 'Goal',
            });
        }

        res.json({ success: true, data: goal });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
