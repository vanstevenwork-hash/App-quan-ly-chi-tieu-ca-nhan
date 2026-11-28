// Cashback is calculated from each card's own real cashbackRate (%),
// set by the user in CardFormModal — not an estimate by spending category.

export function resolveCardId(t: any): string {
    return (t?.cardId as any)?._id || t?.cardId || '';
}

export function getCashbackAmount(cashbackRate: number | undefined, amount: number): number {
    return amount * ((cashbackRate || 0) / 100);
}

export interface CashbackTx { date: string; amount: number; feeAmount?: number; noCashback?: boolean }

/**
 * Sums cashback across transactions, respecting a cap AND an optional
 * minimum-spend requirement per period: earnings are bucketed by period
 * (calendar month by default, or `bucketKey`); a period that didn't reach
 * `minSpend` earns nothing (some cards only pay cashback once you've spent
 * e.g. 15tr), and each qualifying period is capped independently before being
 * added (a cap that resets every period, not lifetime).
 * Transactions flagged `noCashback` earn nothing and don't count towards
 * the min-spend, but their fee still reduces the net.
 */
export function getCappedCashbackTotal(
    txs: CashbackTx[],
    cashbackRate: number | undefined,
    cashbackCap: number | undefined,
    minSpend: number | undefined = 0,
    bucketKey: (d: Date) => string = d => `${d.getFullYear()}-${d.getMonth()}`,
): number {
    const hasCap = !!cashbackCap && cashbackCap > 0;
    const hasMin = !!minSpend && minSpend > 0;
    const eligible = (t: CashbackTx) => (t.noCashback ? 0 : t.amount);
    // Net cashback = cashback earned − transaction fees (phí quẹt thẻ). Fees are
    // NOT capped and reduce the net directly, so the total can go negative when
    // fees outweigh the reward (a real "lỗ" worth surfacing).
    // Fast path: no cap and no min-spend gate → simple sum
    if (!hasCap && !hasMin) {
        return txs.reduce((sum, t) => sum + getCashbackAmount(cashbackRate, eligible(t)) - (t.feeAmount || 0), 0);
    }
    const byPeriod = new Map<string, { spend: number; cashback: number; fee: number }>();
    txs.forEach(t => {
        const key = bucketKey(new Date(t.date));
        const b = byPeriod.get(key) || { spend: 0, cashback: 0, fee: 0 };
        b.spend += eligible(t);
        b.cashback += getCashbackAmount(cashbackRate, eligible(t));
        b.fee += t.feeAmount || 0;
        byPeriod.set(key, b);
    });
    let total = 0;
    byPeriod.forEach(({ spend, cashback, fee }) => {
        // Min-spend not met → no cashback this period, but fees still apply.
        const earned = hasMin && spend < (minSpend as number) ? 0 : (hasCap ? Math.min(cashback, cashbackCap as number) : cashback);
        total += earned - fee;
    });
    return total;
}

// ─── Cashback period (kỳ tính hoàn tiền) per card ──────────────────────────
// card.cashbackPeriod 'statement' (default, needs a statementDay): the
// statement cycle — the day after one close through the next close; a period
// is named by the {year, month} its close falls in (statementDay 20:
// 21/10–20/11 is month 10 = "Th11"). 'month', or no statementDay: calendar
// month. Mirrored on the server in utils/cashbackPeriod.js.
export type CashbackPeriodMode = 'statement' | 'month';
export interface CashbackCard {
    cashbackRate?: number;
    cashbackCap?: number;
    cashbackMinSpend?: number;
    cashbackPeriod?: CashbackPeriodMode;
    statementDay?: number;
}
export interface CashbackPeriod { year: number; month: number } // month 0-based

export const usesStatementPeriod = (card?: CashbackCard | null) =>
    card?.cashbackPeriod !== 'month' && (card?.statementDay || 0) > 0;

const closeDay = (statementDay: number, y: number, m: number) =>
    Math.min(statementDay, new Date(y, m + 1, 0).getDate());

export function cashbackPeriodOf(card: CashbackCard | null | undefined, date: Date | string): CashbackPeriod {
    const d = new Date(date);
    const y = d.getFullYear(), m = d.getMonth();
    if (!usesStatementPeriod(card) || d.getDate() <= closeDay(card!.statementDay!, y, m)) return { year: y, month: m };
    const n = new Date(y, m + 1, 1);
    return { year: n.getFullYear(), month: n.getMonth() };
}

export const currentCashbackPeriod = (card: CashbackCard | null | undefined, now: Date = new Date()) => cashbackPeriodOf(card, now);

export function inCashbackPeriod(card: CashbackCard | null | undefined, date: Date | string, year: number, month: number): boolean {
    const p = cashbackPeriodOf(card, date);
    return p.year === year && p.month === month;
}

// First and last day of the period named {year, month}.
export function cashbackPeriodRange(card: CashbackCard | null | undefined, year: number, month: number): { start: Date; end: Date } {
    if (!usesStatementPeriod(card)) return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
    const sd = card!.statementDay!;
    const prev = new Date(year, month - 1, 1);
    return {
        start: new Date(prev.getFullYear(), prev.getMonth(), closeDay(sd, prev.getFullYear(), prev.getMonth()) + 1),
        end: new Date(year, month, closeDay(sd, year, month)),
    };
}

// "21/10–20/11" for a statement period, "" for a calendar month.
export function cashbackPeriodLabel(card: CashbackCard | null | undefined, year: number, month: number): string {
    if (!usesStatementPeriod(card)) return '';
    const { start, end } = cashbackPeriodRange(card, year, month);
    const f = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${f(start)}–${f(end)}`;
}

// Short unit for cap / min-spend copy: "kỳ" or "tháng".
export const cashbackPeriodUnit = (card?: CashbackCard | null) => (usesStatementPeriod(card) ? 'kỳ' : 'tháng');

// Net cashback of `txs` on `card`, with cap + min-spend applied per the
// card's own period.
export function getCardCashback(card: CashbackCard | null | undefined, txs: CashbackTx[]): number {
    return getCappedCashbackTotal(txs, card?.cashbackRate, card?.cashbackCap, card?.cashbackMinSpend, d => {
        const p = cashbackPeriodOf(card, d);
        return `${p.year}-${p.month}`;
    });
}

// Cashback a single transaction earns (0 when flagged noCashback).
export const getTxCashback = (cashbackRate: number | undefined, t: { amount: number; noCashback?: boolean }) =>
    t.noCashback ? 0 : getCashbackAmount(cashbackRate, t.amount);
