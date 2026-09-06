const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/pushController');

// Public: the VAPID public key the browser needs to subscribe.
router.get('/public-key', ctrl.getPublicKey);

// Public: external scheduler triggers the morning batch (also wakes a
// sleeping host). Not user-scoped, so no auth — same pattern as /api/email/cron.
router.get('/cron', ctrl.cron);
router.post('/cron', ctrl.cron);

// Authenticated: manage this device's subscription + send a test.
router.post('/subscribe', protect, ctrl.subscribe);
router.post('/unsubscribe', protect, ctrl.unsubscribe);
router.post('/test', protect, ctrl.sendTest);

module.exports = router;
