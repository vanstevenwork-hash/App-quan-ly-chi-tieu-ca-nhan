const Budget = require('../models/Budget');

exports.getBudgets = async (req, res) => {
    try {
        const { month, year } = req.query;
        const now = new Date();
        const filter = { userId: req.user._id };
        if (month) filter.month = Number(month);
        if (year) filter.year = Number(year);
        else filter.year = now.getFullYear();
        const budgets = await Budget.find(filter).sort({ category: 1 });
        res.json({ success: true, data: budgets });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createBudget = async (req, res) => {
    try {
        const budget = await Budget.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: budget });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateBudget = async (req, res) => {
    try {
        const budget = await Budget.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id }, req.body, { new: true }
        );
        if (!budget) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: budget });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteBudget = async (req, res) => {
    try {
        const budget = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!budget) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
