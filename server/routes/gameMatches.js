const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    invite,
    respond,
    getIncoming,
    getActive,
    getById,
} = require('../controllers/gameMatchController');

router.use(protect);

router.post('/invite', invite);
router.patch('/:id/respond', respond);
router.get('/incoming', getIncoming);
router.get('/active', getActive);
router.get('/:id', getById);

module.exports = router;
