const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    create,
    getByTransaction,
    update,
    markParticipantPaid,
    remove,
} = require('../controllers/expenseShareController');

router.use(protect);

router.post('/', create);
router.get('/transaction/:transactionId', getByTransaction);
router.put('/:id', update);
router.patch('/:id/participants/:participantId/pay', markParticipantPaid);
router.delete('/:id', remove);

module.exports = router;
