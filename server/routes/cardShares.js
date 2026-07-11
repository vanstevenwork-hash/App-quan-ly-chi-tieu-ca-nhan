const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    invite,
    respond,
    getIncoming,
    getMyShares,
    getCardShares,
    getCashback,
    revoke,
} = require('../controllers/cardShareController');

router.use(protect);

router.post('/invite', invite);
router.patch('/:id/respond', respond);
router.get('/incoming', getIncoming);
router.get('/my-shares', getMyShares);
router.get('/card/:cardId', getCardShares);
router.get('/:cardId/cashback', getCashback);
router.delete('/:id', revoke);

module.exports = router;
