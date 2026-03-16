const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
        // Fallback for SSE connections (EventSource cannot set custom headers)
        token = req.query.token;
    }
    if (!token) {
        console.log('❌ AUTH: No token provided');
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ AUTH: Token verified for user ID:', decoded.id);
        req.user = await User.findById(decoded.id).select('-password');
        if (!req.user) {
            console.log('❌ AUTH: User not found in DB');
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        next();
    } catch (err) {
        console.log('❌ AUTH: Token verification failed:', err.message);
        return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
};

module.exports = { protect };
