const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    create,
    getByTransaction,
    update,
    markParticipantPaid,
    unmarkParticipantPaid,
    getQrDataUrl,
    remove,
} = require('../controllers/expenseShareController');

router.use(protect);

router.post('/', create);
router.get('/transaction/:transactionId', getByTransaction);
router.get('/:id/qr', getQrDataUrl);
router.put('/:id', update);
router.patch('/:id/participants/:participantId/pay', markParticipantPaid);
router.patch('/:id/participants/:participantId/unpay', unmarkParticipantPaid);
router.delete('/:id', remove);

module.exports = router;
