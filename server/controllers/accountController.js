const Account = require('../models/Account');

exports.getAccounts = async (req, res) => {
    try {
        const accounts = await Account.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, data: accounts });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createAccount = async (req, res) => {
    try {
        const account = await Account.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: account });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateAccount = async (req, res) => {
    try {
        const account = await Account.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id }, req.body, { new: true }
        );
        if (!account) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: account });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAccount = async (req, res) => {
    try {
        const account = await Account.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!account) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
