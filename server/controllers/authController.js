const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// @desc Register
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin' });
        const exists = await User.findOne({ email });
        if (exists)
            return res.status(400).json({ success: false, message: 'Email đã được sử dụng' });
        const user = await User.create({ name, email, password });
        const token = generateToken(user._id);
        res.status(201).json({
            success: true,
            token,
            user: { _id: user._id, name: user.name, email: user.email, avatar: user.avatar, currency: user.currency, language: user.language },
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
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
        const token = generateToken(user._id);
        res.json({
            success: true,
            token,
            user: { _id: user._id, name: user.name, email: user.email, avatar: user.avatar, currency: user.currency, language: user.language },
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
        const { name, avatar, currency, language } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user._id, { name, avatar, currency, language }, { new: true, select: '-password' }
        );
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const sendEmail = require('../utils/sendEmail');

// @desc Forgot Password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email' });
        }

        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này' });
        }

        // Generate a new 8-character random password
        const newPassword = Math.random().toString(36).slice(-8);

        // Update user password
        user.password = newPassword;
        await user.save(); // This will trigger the pre('save') hook to hash the new password

        // Send email
        const message = `Xin chào ${user.name},\n\nMật khẩu mới của bạn cho tài khoản Zenith Finance là: ${newPassword}\n\nVui lòng đăng nhập và đổi mật khẩu ngay.\n\nTrân trọng,\nĐội ngũ Zenith`;
        
        try {
            await sendEmail({
                email: user.email,
                subject: 'Yêu cầu Đặt lại Mật khẩu - Zenith Finance',
                message,
            });

            res.status(200).json({ success: true, message: 'Mật khẩu mới đã được gửi vào email của bạn' });
        } catch (err) {
            console.error('Email error:', err);
            // Even if email fails, the password was reset. In a real app we might revert it.
            res.status(500).json({ success: false, message: 'Lỗi khi gửi email' });
        }

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
