const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// @desc Register
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ success: false, message: 'Please fill all fields' });
        const exists = await User.findOne({ email });
        if (exists)
            return res.status(400).json({ success: false, message: 'Email already exists' });
        const user = await User.create({ name, email, password });
        const token = generateToken(user._id);
        res.status(201).json({
            success: true,
            token,
            user: { _id: user._id, name: user.name, email: user.email, avatar: user.avatar, currency: user.currency },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password)))
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const token = generateToken(user._id);
        res.json({
            success: true,
            token,
            user: { _id: user._id, name: user.name, email: user.email, avatar: user.avatar, currency: user.currency },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc Get profile
exports.getProfile = async (req, res) => {
    res.json({ success: true, user: req.user });
};

// @desc Update profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, avatar, currency } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user._id, { name, avatar, currency }, { new: true, select: '-password' }
        );
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
