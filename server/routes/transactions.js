const express = require('express');
const router = express.Router();
const { getTransactions, createTransaction, updateTransaction, deleteTransaction, getSummary, getCategoryBreakdown } = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getTransactions);
router.post('/', createTransaction);
router.get('/summary', getSummary);
router.get('/category-breakdown', getCategoryBreakdown);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
