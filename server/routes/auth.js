const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile, forgotPassword, checkEmail, requestEmailChange, confirmEmailChange } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/check-email', protect, checkEmail);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/change-email/request', protect, requestEmailChange);
router.post('/change-email/confirm', protect, confirmEmailChange);

module.exports = router;
