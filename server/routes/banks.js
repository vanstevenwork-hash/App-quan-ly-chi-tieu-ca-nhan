const express = require('express');
const router = express.Router();
const axios = require('axios');

// @route   GET /api/banks
// @desc    Get full list of Vietnamese banks from VietQR
// @access  Public
router.get('/', async (req, res) => {
    try {
        const response = await axios.get('https://api.vietqr.io/v2/banks');
        res.json(response.data);
    } catch (err) {
        console.error('Error fetching banks from VietQR:', err.message);
        res.status(500).json({ success: false, message: 'Server Error: Cannot fetch banks list' });
    }
});

module.exports = router;
