const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Shared by REST `protect` middleware and the Socket.io auth handshake so
// both paths verify tokens identically against the same secret/user lookup.
async function verifyAuthToken(token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) throw new Error('User not found');
    return user;
}

module.exports = { verifyAuthToken };
