import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLastStatementClose, getPostStatementCharges, getDueThisCycle } from './cardDue';

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
