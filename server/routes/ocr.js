const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { scanReceipt } = require('../controllers/ocrController');

// POST /api/ocr/scan-receipt — scan receipt image and extract data
router.post('/scan-receipt', protect, upload.single('file'), scanReceipt);

module.exports = router;
