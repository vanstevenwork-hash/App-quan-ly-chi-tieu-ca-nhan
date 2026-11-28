import { describe, it, expect } from 'vitest';
import { getCashbackAmount, getCappedCashbackTotal, cashbackPeriodOf, cashbackPeriodLabel, cashbackPeriodRange, getCardCashback, getTxCashback } from './cashback';

describe('getCashbackAmount', () => {
    it('computes rate% of amount', () => {
        expect(getCashbackAmount(2, 1_000_000)).toBe(20_000);
    });
    it('treats missing/zero rate as 0', () => {
        expect(getCashbackAmount(undefined, 1_000_000)).toBe(0);
        expect(getCashbackAmount(0, 1_000_000)).toBe(0);
    });
});

describe('getCappedCashbackTotal', () => {
    const tx = (amount: number, feeAmount = 0, date = '2026-03-10') => ({ date, amount, feeAmount });

    it('sums cashback with no cap/min (fast path)', () => {
        expect(getCappedCashbackTotal([tx(1_000_000), tx(500_000)], 2, 0, 0)).toBe(30_000);
    });

    it('subtracts fees → net, and may go negative', () => {
        // 2% of 1tr = 20k; fee 50k → net -30k
        expect(getCappedCashbackTotal([tx(1_000_000, 50_000)], 2, 0, 0)).toBe(-30_000);
    });

    it('applies the monthly cap BEFORE subtracting the fee', () => {
        // 2% of 5tr = 100k, capped at 50k, fee 10k → 50k - 10k = 40k
        expect(getCappedCashbackTotal([tx(5_000_000, 10_000)], 2, 50_000, 0)).toBe(40_000);
    });

    it('min-spend gate: below min earns no cashback, but the fee still applies', () => {
        // spend 1tr < min 2tr → 0 cashback; fee 5k → net -5k
        expect(getCappedCashbackTotal([tx(1_000_000, 5_000)], 2, 0, 2_000_000)).toBe(-5_000);
    });

    it('min-spend met → cashback earned', () => {
        expect(getCappedCashbackTotal([tx(3_000_000)], 2, 0, 2_000_000)).toBe(60_000);
    });

    it('caps each calendar month independently', () => {
        // two months, each 5tr @2% = 100k capped at 50k → 100k total
        const txs = [tx(5_000_000, 0, '2026-01-10'), tx(5_000_000, 0, '2026-02-10')];
        expect(getCappedCashbackTotal(txs, 2, 50_000, 0)).toBe(100_000);
    });
});

describe('cashback period (kỳ sao kê / tháng)', () => {
    const stmt = { cashbackRate: 2, cashbackCap: 100_000, statementDay: 20 } as const;
    const month = { ...stmt, cashbackPeriod: 'month' as const };

    it('statement mode: after the close day belongs to the next period', () => {
        expect(cashbackPeriodOf(stmt, new Date(2026, 10, 20))).toEqual({ year: 2026, month: 10 });
        expect(cashbackPeriodOf(stmt, new Date(2026, 10, 28))).toEqual({ year: 2026, month: 11 });
        expect(cashbackPeriodOf(stmt, new Date(2026, 11, 25))).toEqual({ year: 2027, month: 0 });
        expect(cashbackPeriodLabel(stmt, 2026, 11)).toBe('21/11–20/12');
    });

    it('month mode, or no statement day: calendar month', () => {
        expect(cashbackPeriodOf(month, new Date(2026, 10, 28))).toEqual({ year: 2026, month: 10 });
        expect(cashbackPeriodOf({ statementDay: 0 }, new Date(2026, 10, 28))).toEqual({ year: 2026, month: 10 });
        expect(cashbackPeriodLabel(month, 2026, 10)).toBe('');
    });

    it('clamps the close day to short months (statementDay 31)', () => {
        const c = { statementDay: 31 };
        expect(cashbackPeriodOf(c, new Date(2027, 1, 28))).toEqual({ year: 2027, month: 1 });
        expect(cashbackPeriodRange(c, 2027, 2).start).toEqual(new Date(2027, 2, 1));
    });

    it('cap applies per statement period, not per calendar month', () => {
        // 21/11–20/12 and 21/12–20/01: 4tr each side of the 20/12 close → 2 caps
        const txs = [tx2('2026-12-10', 4_000_000), tx2('2026-12-25', 4_000_000)];
        expect(getCardCashback(stmt, txs)).toBe(160_000);
        // same txs in one calendar month → one cap
        expect(getCardCashback(month, txs)).toBe(100_000);
    });

    it('noCashback: earns nothing, excluded from min-spend, fee still applies', () => {
        const c = { cashbackRate: 2, cashbackMinSpend: 2_000_000, statementDay: 20 };
        const txs = [tx2('2026-11-25', 1_500_000), { ...tx2('2026-11-26', 1_000_000, 5_000), noCashback: true }];
        expect(getCardCashback(c, txs)).toBe(-5_000); // eligible 1.5tr < 2tr min
        expect(getTxCashback(2, txs[1])).toBe(0);
    });
});

function tx2(day: string, amount: number, feeAmount = 0) {
    return { date: `${day}T10:00:00`, amount, feeAmount };
}
