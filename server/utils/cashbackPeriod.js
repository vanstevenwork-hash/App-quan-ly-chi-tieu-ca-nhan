// Cashback periods (kỳ tính hoàn tiền) — server mirror of client/lib/cashback.ts.
//
// A card's cap and min-spend apply per period:
//  - cashbackPeriod 'statement' (default, needs a statementDay): the statement
//    cycle — the day after one close through the next close. A period is named
//    by the {year, month} its close falls in (statementDay 20: 21/10–20/11 is
//    "11/2026").
//  - 'month', or no statementDay: the calendar month.
// Dates are read in Vietnam time so the result doesn't depend on the host TZ.
// Transactions flagged noCashback earn nothing and don't count towards the
// min-spend, but their fee still reduces the net.

const VN_OFFSET_MS = 7 * 3600_000;

const vnParts = (date) => {
    const d = new Date(new Date(date).getTime() + VN_OFFSET_MS);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
};
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
// Instant of VN wall-clock y/m/d h:mm:ss.ms (month may overflow, Date.UTC normalises).
const vnInstant = (y, m, d, h = 0, mi = 0, s = 0, ms = 0) => new Date(Date.UTC(y, m, d, h, mi, s, ms) - VN_OFFSET_MS);

const usesStatement = (card) => card?.cashbackPeriod !== 'month' && (card?.statementDay || 0) > 0;
const closeDay = (card, y, m) => Math.min(card.statementDay, daysInMonth(y, m));

// {year, month (0-based)} of the period `date` belongs to.
function cashbackPeriodOf(card, date) {
    const p = vnParts(date);
    if (!usesStatement(card) || p.d <= closeDay(card, p.y, p.m)) return { year: p.y, month: p.m };
    const n = new Date(Date.UTC(p.y, p.m + 1, 1));
    return { year: n.getUTCFullYear(), month: n.getUTCMonth() };
}

// [start, end] instants of the period named {year, month}.
function cashbackPeriodRange(card, year, month) {
    if (!usesStatement(card)) {
        return { start: vnInstant(year, month, 1), end: vnInstant(year, month + 1, 0, 23, 59, 59, 999) };
    }
    const prev = new Date(Date.UTC(year, month - 1, 1));
    const py = prev.getUTCFullYear(), pm = prev.getUTCMonth();
    return {
        start: vnInstant(py, pm, closeDay(card, py, pm) + 1),
        end: vnInstant(year, month, closeDay(card, year, month), 23, 59, 59, 999),
    };
}

const currentCashbackPeriod = (card, now = new Date()) => cashbackPeriodOf(card, now);

// Net cashback over `txs` (expenses on this card), bucketed by the card's
// period so cap + min-spend apply per period.
function summarizeCashback(card, txs) {
    const rate = card.cashbackRate || 0;
    const cap = card.cashbackCap || 0;
    const minSpend = card.cashbackMinSpend || 0;
    const buckets = new Map();
    for (const t of txs) {
        const { year, month } = cashbackPeriodOf(card, t.date);
        const key = `${year}-${month}`;
        const b = buckets.get(key) || { spend: 0, fee: 0 };
        if (!t.noCashback) b.spend += t.amount || 0;
        b.fee += t.feeAmount || 0;
        buckets.set(key, b);
    }
    let net = 0, gross = 0, earned = 0, spend = 0, fee = 0, capped = false, reached = true;
    buckets.forEach((b) => {
        const g = b.spend * rate / 100;
        const ok = !(minSpend > 0 && b.spend < minSpend);
        const e = !ok ? 0 : (cap > 0 ? Math.min(g, cap) : g);
        if (ok && cap > 0 && g > cap) capped = true;
        if (!ok) reached = false;
        gross += g; earned += e; spend += b.spend; fee += b.fee;
        net += e - b.fee;
    });
    return { rate, cap, minSpend, spend, gross, earned, fee, net, capped, reached };
}

// Short label for a period: "21/10–20/11" (statement) or "tháng 11" (month).
function cashbackPeriodLabel(card, year, month) {
    if (!usesStatement(card)) return `tháng ${month + 1}`;
    const { start, end } = cashbackPeriodRange(card, year, month);
    const f = (d) => { const p = vnParts(d); return `${String(p.d).padStart(2, '0')}/${String(p.m + 1).padStart(2, '0')}`; };
    return `${f(start)}–${f(end)}`;
}

module.exports = { usesStatement, cashbackPeriodOf, cashbackPeriodRange, currentCashbackPeriod, summarizeCashback, cashbackPeriodLabel };
