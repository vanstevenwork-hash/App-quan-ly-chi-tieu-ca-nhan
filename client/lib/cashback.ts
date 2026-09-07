// Cashback is calculated from each card's own real cashbackRate (%),
// set by the user in CardFormModal — not an estimate by spending category.

export function resolveCardId(t: any): string {
    return (t?.cardId as any)?._id || t?.cardId || '';
}

export function getCashbackAmount(cashbackRate: number | undefined, amount: number): number {
    return amount * ((cashbackRate || 0) / 100);
}

/**
 * Sums cashback across transactions, respecting a monthly cap AND an optional
 * minimum-spend requirement: earnings are bucketed by calendar month; a month
 * that didn't reach `minSpend` earns nothing (some cards only pay cashback once
 * you've spent e.g. 15tr that month), and each qualifying month is capped
 * independently before being added (a cap that resets monthly, not lifetime).
 */
export function getCappedCashbackTotal(
    txs: { date: string; amount: number; feeAmount?: number }[],
    cashbackRate: number | undefined,
    cashbackCap: number | undefined,
    minSpend: number | undefined = 0,
): number {
    const hasCap = !!cashbackCap && cashbackCap > 0;
    const hasMin = !!minSpend && minSpend > 0;
    // Net cashback = cashback earned − transaction fees (phí quẹt thẻ). Fees are
    // NOT capped and reduce the net directly, so the total can go negative when
    // fees outweigh the reward (a real "lỗ" worth surfacing).
    // Fast path: no cap and no min-spend gate → simple sum
    if (!hasCap && !hasMin) {
        return txs.reduce((sum, t) => sum + getCashbackAmount(cashbackRate, t.amount) - (t.feeAmount || 0), 0);
    }
    const byMonth = new Map<string, { spend: number; cashback: number; fee: number }>();
    txs.forEach(t => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const b = byMonth.get(key) || { spend: 0, cashback: 0, fee: 0 };
        b.spend += t.amount;
        b.cashback += getCashbackAmount(cashbackRate, t.amount);
        b.fee += t.feeAmount || 0;
        byMonth.set(key, b);
    });
    let total = 0;
    byMonth.forEach(({ spend, cashback, fee }) => {
        // Min-spend not met → no cashback this month, but fees still apply.
        const earned = hasMin && spend < (minSpend as number) ? 0 : (hasCap ? Math.min(cashback, cashbackCap as number) : cashback);
        total += earned - fee;
    });
    return total;
}
