const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    invite,
    accept,
    getMyShares,
    getCardShares,
    revoke,
} = require('../controllers/cardShareController');

router.use(protect);

router.post('/invite', invite);
router.post('/accept', accept);
router.get('/my-shares', getMyShares);
router.get('/card/:cardId', getCardShares);
router.delete('/:id', revoke);

module.exports = router;
