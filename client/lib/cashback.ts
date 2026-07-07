// Cashback is calculated from each card's own real cashbackRate (%),
// set by the user in CardFormModal — not an estimate by spending category.

export function resolveCardId(t: any): string {
    return (t?.cardId as any)?._id || t?.cardId || '';
}

export function getCashbackAmount(cashbackRate: number | undefined, amount: number): number {
    return amount * ((cashbackRate || 0) / 100);
}

/**
 * Sums cashback across transactions, respecting a monthly cap: earnings are
 * bucketed by calendar month and each bucket is capped independently before
 * being added to the total (a cap that resets every month, not a lifetime cap).
 */
export function getCappedCashbackTotal(
    txs: { date: string; amount: number }[],
    cashbackRate: number | undefined,
    cashbackCap: number | undefined,
): number {
    if (!cashbackCap || cashbackCap <= 0) {
        return txs.reduce((sum, t) => sum + getCashbackAmount(cashbackRate, t.amount), 0);
    }
    const byMonth = new Map<string, number>();
    txs.forEach(t => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        byMonth.set(key, (byMonth.get(key) || 0) + getCashbackAmount(cashbackRate, t.amount));
    });
    let total = 0;
    byMonth.forEach(monthRaw => { total += Math.min(monthRaw, cashbackCap); });
    return total;
}
