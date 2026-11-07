import { describe, it, expect } from 'vitest';
import { getCardCycle, dueAfterClose } from './statement';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);
const ymd = (x: Date) => `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;

describe('getCardCycle (statement 5, due 25)', () => {
    it('just after the close: longest free period, due is for the closed statement', () => {
        const c = getCardCycle(5, 25, d(2026, 9, 6));
        expect(ymd(c.nextClose)).toBe('2026-10-5');
        expect(ymd(c.dueDate)).toBe('2026-9-25');
        expect(c.dueIsForClosedStatement).toBe(true);
        expect(c.daysToDue).toBe(19);
        expect(c.freeDaysIfSwipedToday).toBe(49); // Sep 6 → Oct 25
    });

    it('on the close day the purchase is still on this statement (short free period)', () => {
        const c = getCardCycle(5, 25, d(2026, 9, 5));
        expect(c.freeDaysIfSwipedToday).toBe(20); // Sep 5 → Sep 25
    });

    it('after the due date the next due belongs to the still-open statement', () => {
        const c = getCardCycle(5, 25, d(2026, 9, 28));
        expect(c.dueIsForClosedStatement).toBe(false);
        expect(ymd(c.dueDate)).toBe('2026-10-25');
    });
});

describe('edge cases', () => {
    it('due day before statement day rolls into the following month', () => {
        expect(ymd(dueAfterClose(d(2026, 9, 20), 10))).toBe('2026-10-10');
    });
    it('day 31 is clamped to short months', () => {
        const c = getCardCycle(31, 15, d(2026, 2, 10));
        expect(ymd(c.nextClose)).toBe('2026-2-28');
    });
});
