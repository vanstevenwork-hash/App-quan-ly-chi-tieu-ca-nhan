const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/mailboxController');

router.use(protect);
router.get('/access', ctrl.access);

router.use(ctrl.requireOwner);
router.get('/folders', ctrl.folders);
router.get('/messages', ctrl.list);
router.get('/traveloka', ctrl.traveloka);
router.patch('/messages/flags', ctrl.flags);
router.post('/messages/delete', ctrl.remove);
router.post('/messages/move', ctrl.move);
router.get('/messages/:uid', ctrl.get);
router.get('/messages/:uid/attachments/:index', ctrl.attachment);
router.post('/send', ctrl.send);

module.exports = router;
