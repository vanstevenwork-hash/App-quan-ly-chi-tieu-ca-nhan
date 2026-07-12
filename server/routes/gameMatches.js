const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    invite,
    createRoom,
    joinByCode,
    respond,
    getIncoming,
    getSent,
    getActive,
    cancel,
    leave,
    rematch,
    getStats,
    getById,
} = require('../controllers/gameMatchController');

router.use(protect);

router.post('/invite', invite);
router.post('/room', createRoom);
router.post('/join/:code', joinByCode);
router.patch('/:id/respond', respond);
router.get('/incoming', getIncoming);
router.get('/sent', getSent);
router.get('/active', getActive);
router.get('/stats', getStats);
router.post('/:id/leave', leave);
router.post('/:id/rematch', rematch);
router.delete('/:id', cancel);
router.get('/:id', getById);

module.exports = router;
