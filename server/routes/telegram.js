const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/telegramController');

// Public — Telegram calls this. Verified by the secret-token header inside the
// controller (NOT the JWT middleware; Telegram can't send a Bearer token).
router.post('/webhook', ctrl.webhook);

// App-facing, JWT-protected
router.get('/link', protect, ctrl.getLink);
router.get('/status', protect, ctrl.status);
router.post('/unlink', protect, ctrl.unlink);

module.exports = router;
