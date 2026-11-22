import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLastStatementClose, getPostStatementCharges, getDueThisCycle, getStatementAmount } from './cardDue';

describe('getLastStatementClose', () => {
    it('returns null without a statement day', () => {
        expect(getLastStatementClose(undefined, new Date(2026, 8, 6))).toBeNull();
    });
    it('uses THIS month when the close day already passed', () => {
        // today Sep 20, statementDay 5 → close Sep 5
        const c = getLastStatementClose(5, new Date(2026, 8, 20))!;
        expect(c.getMonth()).toBe(8);
        expect(c.getDate()).toBe(5);
    });
    it('uses LAST month when the close day has not passed yet', () => {
        // today Sep 6, statementDay 20 → close Aug 20
        const c = getLastStatementClose(20, new Date(2026, 8, 6))!;
        expect(c.getMonth()).toBe(7);
        expect(c.getDate()).toBe(20);
    });
});

// getPostStatementCharges / getDueThisCycle read the real clock, so pin it.
describe('statement-cycle due (now = 2026-09-06)', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 6, 12, 0, 0)); });
    afterEach(() => { vi.useRealTimers(); });

    const tx = (amount: number, date: string, extra = {}) => ({ amount, date, type: 'expense', cardId: 'c1', ...extra }) as any;

    it('excludes charges posted AFTER the last close from what is due now', () => {
        // statementDay 31 → last close Aug 31. A charge on Sep 6 bills NEXT cycle.
        expect(getDueThisCycle(500_000, [tx(500_000, '2026-09-06')], 'c1', 31)).toBe(0);
    });

    it('includes charges posted BEFORE the close', () => {
        expect(getDueThisCycle(300_000, [tx(300_000, '2026-08-20')], 'c1', 31)).toBe(300_000);
    });

    it('post-statement sum counts only non-installment card expenses after the close', () => {
        const txs = [
            tx(500_000, '2026-09-06'),                                           // post-close → counted
            tx(300_000, '2026-08-20'),                                           // pre-close → not
            tx(200_000, '2026-09-05', { isInstallment: true, installmentMonths: 6 }), // installment → not
        ];
        expect(getPostStatementCharges(txs, 'c1', 31)).toBe(500_000);
    });

    it('no statement day → nothing excluded (full balance due)', () => {
        expect(getDueThisCycle(500_000, [tx(500_000, '2026-09-06')], 'c1', undefined)).toBe(500_000);
    });
});

describe('getInstallmentPlans / schedule (now = 2026-09-06)', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 6, 12, 0, 0)); });
    afterEach(() => { vi.useRealTimers(); });

    const plan = { isInstallment: true, installmentMonths: 9, installmentMonthly: 100_000, amount: 900_000, date: '2026-07-10', installmentStartDate: '2026-07-10', cardId: 'c1' } as any;

    it('supports a 9-month plan and tracks progress', async () => {
        const { getInstallmentPlans } = await import('./cardDue');
        const [p] = getInstallmentPlans([plan]);
        expect(p.months).toBe(9);
        expect(p.paid).toBe(2);
        expect(p.remaining).toBe(7);
        expect(p.endDate.getMonth()).toBe(2); // Mar 2027
    });

    it('schedule sums to remaining principal and ends after the last period', async () => {
        const { getInstallmentPlans, getInstallmentSchedule } = await import('./cardDue');
        const s = getInstallmentSchedule(getInstallmentPlans([plan]), 12);
        expect(s.reduce((a, m) => a + m.amount, 0)).toBe(700_000);
        expect(s[7].amount).toBe(0);
    });
});

describe('getStatementAmount', () => {
    // VIB-like card: close 28, due 15. Today Nov 22 → Oct-28 statement was due
    // Nov 15 (passed), next close Nov 28.
    const now = new Date(2026, 10, 22);
    const card = { _id: 'c1', balance: 27_395_000, statementDay: 28 };
    const open = { dueIsForClosedStatement: false, nextClose: new Date(2026, 10, 28) };
    const txs = [
        { _id: 'a', cardId: 'c1', type: 'expense', amount: 15_300_000, date: '2026-09-10', isInstallment: true, installmentMonths: 6, installmentMonthly: 2_550_000, installmentStartDate: '2026-09-10' },
        { _id: 'b', cardId: 'c1', type: 'expense', amount: 12_000_000, date: '2026-11-10', isInstallment: true, installmentMonths: 9, installmentMonthly: 1_333_334, installmentStartDate: '2026-11-10' },
        { _id: 'x', cardId: 'c1', type: 'expense', amount: 95_000, date: '2026-11-01' },   // after Oct-28 close
        { _id: 'y', cardId: 'c1', type: 'expense', amount: 500_000, date: '2026-10-20' },  // on the old statement
    ];

    it('open statement: includes installment periods billing on the next close', () => {
        const r = getStatementAmount(card, txs, open, now);
        expect(r.estimated).toBe(true);
        expect(r.installment).toBe(2_550_000 + 1_333_334);
        expect(r.amount).toBe(95_000 + 2_550_000 + 1_333_334);
    });

    it('open statement: a finished plan adds nothing', () => {
        const done = [{ ...txs[0], installmentStartDate: '2025-01-10', date: '2025-01-10' }];
        expect(getStatementAmount(card, done, open, now).installment).toBe(0);
    });

    it('open statement: purchase after the close day starts on the following close', () => {
        // bought Nov 29 (after close 28) → first period on Dec 28, not Nov 28
        const late = [{ ...txs[1], date: '2026-11-29', installmentStartDate: '2026-11-29' }];
        expect(getStatementAmount(card, late, open, now).installment).toBe(0);
        const decOpen = { dueIsForClosedStatement: false, nextClose: new Date(2026, 11, 28) };
        expect(getStatementAmount(card, late, decOpen, new Date(2026, 11, 20)).installment).toBe(1_333_334);
    });

    it('last period is adjusted so periods sum to the principal', () => {
        const p = [{ _id: 'p', cardId: 'c1', type: 'expense', amount: 1_000_000, date: '2026-09-10', isInstallment: true, installmentMonths: 3, installmentMonthly: 333_334, installmentStartDate: '2026-09-10' }];
        // Sep 28 = p0, Oct 28 = p1, Nov 28 = p2 (last)
        expect(getStatementAmount(card, p, open, now).installment).toBe(1_000_000 - 333_334 * 2);
    });

    it('closed statement still due: same amount as getDueThisCycle, with installment part', () => {
        const closed = { dueIsForClosedStatement: true, nextClose: new Date(2026, 10, 28) };
        const r = getStatementAmount(card, txs, closed, now);
        expect(r.estimated).toBe(false);
        expect(r.amount).toBe(getDueThisCycle(card.balance, txs as any, 'c1', 28));
        expect(r.installment).toBeGreaterThan(0);
        expect(r.installment).toBeLessThanOrEqual(r.amount);
    });
});
