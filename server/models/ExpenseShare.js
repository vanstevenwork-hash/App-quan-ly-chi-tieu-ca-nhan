const mongoose = require('mongoose');

// One "chia bill" record per transaction: the list of people who owe the
// payer their portion, plus which of the payer's accounts collects the
// transfer. There is no per-participant login/token — the payer fills this
// in, gets a receipt-style view to screenshot and send into a group chat,
// and manually marks people paid after checking their bank statement.
const participantSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    // Optional detail of what this person's portion covers (e.g. "phở + trà đá")
    // — lets one transaction that mixes food and drinks be split with a
    // breakdown per person instead of forcing 2 separate transactions.
    note: { type: String, default: '', trim: true },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt: { type: Date, default: null },
    // Links to the income Transaction created when this participant was
    // marked paid, so un-marking can delete that exact entry and reverse
    // the balance bump instead of leaving a stray transaction behind.
    reimbursementTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
}, { _id: true });

const expenseShareSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true, unique: true },
    totalAmount: { type: Number, required: true }, // snapshot of the transaction amount at share time
    receiveCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
    participants: {
        type: [participantSchema],
        validate: { validator: v => v.length > 0, message: 'Cần ít nhất 1 người tham gia' },
    },
}, { timestamps: true });

module.exports = mongoose.model('ExpenseShare', expenseShareSchema);
