const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAll, create, update, remove, setDefault, getSavingsSummary, updateBalance, payCard } = require('../controllers/cardController');

router.use(protect);

// Static routes MUST be before dynamic /:id
router.get('/savings/summary', getSavingsSummary);

router.route('/')
    .get(getAll)
    .post(create);

router.route('/:id')
    .put(update)
    .delete(remove);

router.patch('/:id/set-default', setDefault);
router.patch('/:id/balance', updateBalance);
router.patch('/:id/pay', payCard);


module.exports = router;

