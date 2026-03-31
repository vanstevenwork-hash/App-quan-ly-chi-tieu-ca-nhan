const mongoose = require('mongoose');

// Stores receipt/photo entries attached to a specific calendar day
const DayNoteSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Date stored as YYYY-MM-DD string for easy lookup
    date: { type: String, required: true }, // e.g. "2026-03-27"
    images: [{
        url: { type: String, required: true },  // Cloudinary secure_url
        amount: { type: Number, default: 0 },      // positive = expense
        label: { type: String, default: '' },     // optional description
    }],
    note: { type: String, default: '' },
}, { timestamps: true });

// One document per user per date
DayNoteSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DayNote', DayNoteSchema);
