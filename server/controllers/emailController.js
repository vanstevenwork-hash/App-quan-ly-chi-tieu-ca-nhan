const { ingestBankEmails, scanBankEmails, commitItems } = require('../services/emailIngestService');

// @desc  Pull recent Gmail bank notifications → transactions (auto, no review)
// @route POST /api/email/sync   body: { days? }
// @access Private
exports.sync = async (req, res) => {
    try {
        const days = Math.min(30, Math.max(1, Number(req.body?.days) || 7));
        // Assign imports to the logged-in user (not the env cron user)
        const result = await ingestBankEmails({ days, user: req.user });
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('❌ Email sync error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc  Scan Gmail and STREAM progress (NDJSON), returning a preview list to
//        review before anything is saved. Each line is a JSON object:
//        {type:'progress',done,total} … then {type:'done',items,statements}.
// @route POST /api/email/scan   body: { days? }
// @access Private
exports.scan = async (req, res) => {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no'); // don't let a proxy buffer the stream
    const send = (obj) => { try { res.write(JSON.stringify(obj) + '\n'); } catch { /* client gone */ } };
    try {
        const days = Math.min(30, Math.max(1, Number(req.body?.days) || 7));
        const out = await scanBankEmails({
            days,
            user: req.user,
            onProgress: (done, total) => send({ type: 'progress', done, total }),
        });
        send({ type: 'done', items: out.items, statements: out.statements, notTx: out.notTx, txSkipped: out.txSkipped });
    } catch (err) {
        console.error('❌ Email scan error:', err.message);
        send({ type: 'error', message: err.message });
    } finally {
        res.end();
    }
};

// @desc  Create the transactions the user confirmed from a scan preview.
// @route POST /api/email/commit   body: { items: [...] }
// @access Private
exports.commit = async (req, res) => {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const result = await commitItems({ user: req.user, items });
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('❌ Email commit error:', err.message);
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
