const { verifyAuthToken } = require('../utils/authToken');

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
        req.user = await verifyAuthToken(token);
        console.log('✅ AUTH: Token verified for user ID:', req.user._id.toString());
        next();
    } catch (err) {
        console.log('❌ AUTH: Token verification failed:', err.message);
        return res.status(401).json({ success: false, message: err.message === 'User not found' ? 'User not found' : 'Not authorized, token failed' });
    }
};

module.exports = { protect };
