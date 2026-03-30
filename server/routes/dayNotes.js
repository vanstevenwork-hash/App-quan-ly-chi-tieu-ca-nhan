const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getByMonth, addImage, removeImage } = require('../controllers/dayNoteController');

router.get('/', protect, getByMonth);
router.post('/add-image', protect, addImage);
router.delete('/remove-image', protect, removeImage);

module.exports = router;
