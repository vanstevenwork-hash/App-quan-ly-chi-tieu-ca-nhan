const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadImage, deleteImage } = require('../controllers/uploadController');

// POST /api/upload             — upload single image
router.post('/', protect, upload.single('file'), uploadImage);

// DELETE /api/upload/:publicId — delete image by publicId
router.delete('/:publicId', protect, deleteImage);

module.exports = router;
