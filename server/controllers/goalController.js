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
        const goal = await Goal.create({ ...req.body, userId: req.user._id, status: 'active' });
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

// Notify at milestone
async function notifyMilestone(userId, goal, pct) {
    const milestones = [
        { pct: 25, icon: '🎉', msg: 'Good start! Bạn đã đi được 1/4 chặng đường!' },
        { pct: 50, icon: '🚀', msg: 'Halfway there! Đã đi được nửa chặng đường!' },
        { pct: 75, icon: '🔥', msg: 'Almost done! Chỉ còn 25% nữa thôi!' },
        { pct: 100, icon: '🎯', msg: 'Goal completed! Bạn đã đạt mục tiêu tài chính này!' },
    ];
    const milestone = milestones.find(m => m.pct === pct);
    if (!milestone) return;
    await createNotification({
        userId: userId.toString(),
        title: `${milestone.icon} Mục tiêu "${goal.name}" — ${pct}%`,
        message: milestone.msg,
        type: 'saving',
        icon: milestone.icon,
        iconBg: '#ECFDF5',
        isImportant: pct === 100,
        relatedId: goal._id,
        relatedModel: 'Goal',
    });
}

// POST /api/goals/:id/deposit — add money to a goal
exports.deposit = async (req, res) => {
    try {
        const { amount, note = '' } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });
        const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
        if (!goal) return res.status(404).json({ success: false, message: 'Không tìm thấy mục tiêu' });
        if (goal.status === 'completed') return res.status(400).json({ success: false, message: 'Mục tiêu đã hoàn thành' });

        const prevPct = Math.floor((goal.currentAmount / goal.targetAmount) * 100);
        goal.currentAmount = Math.min(goal.currentAmount + amount, goal.targetAmount);
        goal.contributions.push({ amount, type: 'deposit', note, date: new Date() });

        const newPct = Math.round((goal.currentAmount / goal.targetAmount) * 100);

        // Check milestones
        for (const m of [25, 50, 75, 100]) {
            if (prevPct < m && newPct >= m) {
                await notifyMilestone(req.user._id, goal, m);
            }
        }

        // Auto-complete
        if (newPct >= 100) {
            goal.status = 'completed';
            goal.completedAt = new Date();
        }

        await goal.save();
        res.json({ success: true, data: goal });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/goals/:id/withdraw — remove money from a goal
exports.withdraw = async (req, res) => {
    try {
        const { amount, note = '' } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });
        const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
        if (!goal) return res.status(404).json({ success: false, message: 'Không tìm thấy mục tiêu' });

        goal.currentAmount = Math.max(0, goal.currentAmount - amount);
        goal.contributions.push({ amount, type: 'withdraw', note, date: new Date() });

        // Reopen if was completed
        if (goal.status === 'completed' && goal.currentAmount < goal.targetAmount) {
            goal.status = 'active';
            goal.completedAt = undefined;
        }

        await goal.save();
        res.json({ success: true, data: goal });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
