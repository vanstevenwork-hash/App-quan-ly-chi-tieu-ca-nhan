import { describe, it, expect } from 'vitest';
import { getCashbackAmount, getCappedCashbackTotal } from './cashback';

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
