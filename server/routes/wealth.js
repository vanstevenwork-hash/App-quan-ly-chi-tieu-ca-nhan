const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAll, create, update, remove } = require('../controllers/wealthController');

router.use(protect);

router.route('/').get(getAll).post(create);
router.route('/:id').put(update).delete(remove);

module.exports = router;
