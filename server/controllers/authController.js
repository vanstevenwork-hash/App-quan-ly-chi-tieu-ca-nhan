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

// @desc  Check whether an email has a registered account — used before sending
//        card-share/game invites so the UI can confirm "mời [Tên] tham gia?"
//        instead of only finding out after the invite call fails with 404.
// @route GET /api/auth/check-email?email=...
exports.checkEmail = async (req, res) => {
    try {
        const email = (req.query.email || '').toString().toLowerCase().trim();
        if (!email) {
            return res.status(400).json({ success: false, message: 'Thiếu email' });
        }
        const user = await User.findOne({ email }).select('name avatar');
        if (!user) {
            return res.json({ success: true, exists: false });
        }
        res.json({ success: true, exists: true, name: user.name, avatar: user.avatar });
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

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const gen6 = () => String(Math.floor(100000 + Math.random() * 900000));

// @desc  Step 1 — request an email change: emails a 6-digit code to the NEW address
// @route POST /api/auth/change-email/request  body: { newEmail }
// @access Private
exports.requestEmailChange = async (req, res) => {
    try {
        const newEmail = (req.body.newEmail || '').toLowerCase().trim();
        if (!isEmail(newEmail)) return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
        if (newEmail === req.user.email) return res.status(400).json({ success: false, message: 'Email mới trùng email hiện tại' });
        const taken = await User.findOne({ email: newEmail });
        if (taken) return res.status(400).json({ success: false, message: 'Email này đã được dùng cho tài khoản khác' });

        const code = gen6();
        const user = await User.findById(req.user._id);
        user.emailChangeNew = newEmail;
        user.emailChangeCode = code;
        user.emailChangeExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        const message = `Xin chào ${user.name},\n\nMã xác nhận đổi email cho tài khoản Zenith Finance là: ${code}\n\nMã có hiệu lực trong 15 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.\n\nTrân trọng.`;
        const html = `<div style="font-family:system-ui,sans-serif;max-width:440px;margin:auto"><p>Xin chào <b>${user.name}</b>,</p><p>Mã xác nhận đổi email tài khoản <b>Zenith Finance</b> của bạn là:</p><p style="font-size:30px;font-weight:800;letter-spacing:6px;color:#36255C;text-align:center;margin:18px 0">${code}</p><p style="color:#64748B;font-size:13px">Mã có hiệu lực trong 15 phút. Nếu bạn không yêu cầu đổi email, hãy bỏ qua email này.</p></div>`;
        await sendEmail({ email: newEmail, subject: 'Mã xác nhận đổi email - Zenith Finance', message, html });

        res.json({ success: true, message: `Đã gửi mã xác nhận tới ${newEmail}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Step 2 — confirm the email change with the code sent to the new address
// @route POST /api/auth/change-email/confirm  body: { code }
// @access Private
exports.confirmEmailChange = async (req, res) => {
    try {
        const code = (req.body.code || '').trim();
        const user = await User.findById(req.user._id);
        if (!user.emailChangeNew || !user.emailChangeCode) return res.status(400).json({ success: false, message: 'Chưa có yêu cầu đổi email nào' });
        if (!user.emailChangeExpires || user.emailChangeExpires < new Date()) return res.status(400).json({ success: false, message: 'Mã đã hết hạn, vui lòng gửi lại mã' });
        if (code !== user.emailChangeCode) return res.status(400).json({ success: false, message: 'Mã xác nhận không đúng' });
        // Re-check the address is still free (someone could have grabbed it meanwhile)
        const taken = await User.findOne({ email: user.emailChangeNew, _id: { $ne: user._id } });
        if (taken) return res.status(400).json({ success: false, message: 'Email này vừa bị tài khoản khác sử dụng' });

        user.email = user.emailChangeNew;
        user.emailChangeNew = null;
        user.emailChangeCode = null;
        user.emailChangeExpires = null;
        await user.save();

        const safe = user.toObject();
        delete safe.password;
        res.json({ success: true, user: safe, message: 'Đã đổi email thành công' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

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
