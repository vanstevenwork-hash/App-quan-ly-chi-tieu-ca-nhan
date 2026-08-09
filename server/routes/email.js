const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/emailController');

router.post('/sync', protect, ctrl.sync);    // manual auto-import (legacy)
router.post('/scan', protect, ctrl.scan);    // stream progress + preview to review
router.post('/commit', protect, ctrl.commit); // create the confirmed transactions
router.get('/cron', ctrl.cron);              // external scheduler
router.post('/cron', ctrl.cron);

module.exports = router;
