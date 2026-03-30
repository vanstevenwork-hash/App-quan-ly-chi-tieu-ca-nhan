const DayNote = require('../models/DayNote');

// GET /api/day-notes?month=3&year=2026
// Returns all notes for the user in a given month
exports.getByMonth = async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) return res.status(400).json({ success: false, message: 'Cần month và year' });

        const mm = String(month).padStart(2, '0');
        const prefix = `${year}-${mm}-`;

        const notes = await DayNote.find({
            user: req.user._id,
            date: { $regex: `^${prefix}` },
        });

        res.json({ success: true, data: notes });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/day-notes/add-image
// Body: { date: "2026-03-27", imageUrl: "https://..." }
// Adds an image URL to the day's note (upserts)
exports.addImage = async (req, res) => {
    try {
        const { date, imageUrl } = req.body;
        if (!date || !imageUrl) return res.status(400).json({ success: false, message: 'Cần date và imageUrl' });

        const note = await DayNote.findOneAndUpdate(
            { user: req.user._id, date },
            { $push: { images: imageUrl } },
            { new: true, upsert: true }
        );

        res.json({ success: true, data: note });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/day-notes/remove-image
// Body: { date: "2026-03-27", imageUrl: "https://..." }
exports.removeImage = async (req, res) => {
    try {
        const { date, imageUrl } = req.body;
        if (!date || !imageUrl) return res.status(400).json({ success: false, message: 'Cần date và imageUrl' });

        const note = await DayNote.findOneAndUpdate(
            { user: req.user._id, date },
            { $pull: { images: imageUrl } },
            { new: true }
        );

        res.json({ success: true, data: note });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
