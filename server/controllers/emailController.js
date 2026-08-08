const { ingestBankEmails } = require('../services/emailIngestService');

// @desc  Pull recent Gmail bank notifications → transactions
// @route POST /api/email/sync   body: { days? }
// @access Private
exports.sync = async (req, res) => {
    try {
        const days = Math.min(30, Math.max(1, Number(req.body?.days) || 7));
        const result = await ingestBankEmails({ days });
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('❌ Email sync error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Same, for an external scheduler (cron-job.org) so it can run on a timer.
// @route GET/POST /api/email/cron?key=<TELEGRAM_WEBHOOK_SECRET>
// @access Public (guarded by the shared secret)
exports.cron = async (req, res) => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && req.query.key !== secret) return res.sendStatus(401);
    res.json({ success: true });
    try { await ingestBankEmails({ days: 2 }); }
    catch (e) { console.error('❌ Email cron error:', e.message); }
};
