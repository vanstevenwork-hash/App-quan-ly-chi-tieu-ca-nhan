const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAll, upsert } = require('../controllers/cashbackController');

router.use(protect);

router.route('/')
    .get(getAll)
    .put(upsert);

module.exports = router;
