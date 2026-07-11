const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, forgotPassword, checkEmail } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/check-email', protect, checkEmail);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

module.exports = router;
