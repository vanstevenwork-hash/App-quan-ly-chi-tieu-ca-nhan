// Period keys for goal auto-save, in Vietnam time (no DST):
//   daily → '2026-11-24' · weekly → '2026-W48' (ISO week) · monthly → '2026-11'
const VN_OFFSET_MS = 7 * 3600_000;
const pad = n => String(n).padStart(2, '0');

function autoSavePeriodKey(frequency, now = new Date()) {
    const d = new Date(now.getTime() + VN_OFFSET_MS); // read with getUTC* = VN wall clock
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    if (frequency === 'daily') return `${y}-${pad(m)}-${pad(day)}`;
    if (frequency === 'monthly') return `${y}-${pad(m)}`;
    if (frequency === 'weekly') {
        // ISO-8601 week: Thursday of this week decides the year.
        const t = new Date(Date.UTC(y, m - 1, day));
        const dow = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - dow);
        const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        const week = Math.ceil(((t - yearStart) / 86_400_000 + 1) / 7);
        return `${t.getUTCFullYear()}-W${pad(week)}`;
    }
    return null;
}

module.exports = { autoSavePeriodKey };
