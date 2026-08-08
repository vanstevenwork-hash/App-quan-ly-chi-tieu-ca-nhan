const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/emailController');

router.post('/sync', protect, ctrl.sync);   // manual (from the app)
router.get('/cron', ctrl.cron);              // external scheduler
router.post('/cron', ctrl.cron);

module.exports = router;
