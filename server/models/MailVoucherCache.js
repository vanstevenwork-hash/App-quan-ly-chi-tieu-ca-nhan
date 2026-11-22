const mongoose = require('mongoose');

// Parsed Traveloka gift-voucher codes per mail, so the voucher screen only
// downloads + parses mails it hasn't seen before (a mail's content never
// changes). Keyed by mailbox account + IMAP UIDVALIDITY + UID: if Gmail ever
// resets UIDVALIDITY the old entries simply stop matching.
const schema = new mongoose.Schema({
    account: { type: String, required: true },
    uidValidity: { type: String, required: true },
    uid: { type: Number, required: true },
    subject: { type: String, default: '' },
    date: { type: Date },
    sender: { type: String, default: '' },
    expiresAt: { type: String, default: null },
    vouchers: [{ _id: false, code: String, currency: String, amount: Number }],
    parserVersion: { type: Number, default: 1 },
}, { timestamps: true });

schema.index({ account: 1, uidValidity: 1, uid: 1 }, { unique: true });

module.exports = mongoose.model('MailVoucherCache', schema);
