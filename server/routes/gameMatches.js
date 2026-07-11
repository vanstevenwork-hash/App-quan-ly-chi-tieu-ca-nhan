const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    invite,
    respond,
    getIncoming,
    getSent,
    getActive,
    cancel,
    getById,
} = require('../controllers/gameMatchController');

router.use(protect);

router.post('/invite', invite);
router.patch('/:id/respond', respond);
router.get('/incoming', getIncoming);
router.get('/sent', getSent);
router.get('/active', getActive);
router.delete('/:id', cancel);
router.get('/:id', getById);

module.exports = router;
