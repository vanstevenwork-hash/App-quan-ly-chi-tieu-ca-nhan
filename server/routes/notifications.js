const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getAll, markRead, markAllRead, deleteOne, clearAll,
} = require('../controllers/notificationController');

router.use(protect);

router.get('/', getAll);
router.patch('/read-all', markAllRead);
router.delete('/clear-all', clearAll);
router.patch('/:id/read', markRead);
router.delete('/:id', deleteOne);

module.exports = router;
