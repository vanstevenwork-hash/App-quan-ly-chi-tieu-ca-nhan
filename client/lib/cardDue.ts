import { resolveCardId } from './cashback';

interface InstallmentTx {
    isInstallment?: boolean;
    installmentMonths?: number;
    installmentMonthly?: number;
    installmentStartDate?: string;
    date: string;
    cardId?: any;
}

// A card's `balance` is the FULL outstanding debt — correct for net worth
// (accounts/wealth), and correctly includes the entire installment principal
// the moment it's purchased (that's how banks count it against your limit
// too). But nothing auto-decrements `balance` month by month as an
// installment plan progresses — only an actual payment does. So for a card
// with an active installment plan, `balance` conflates "money due right now"
// with "money due in future months you haven't reached yet". Using raw
// `balance` for a payment-due notification overstates what's actually owed
// this cycle.
export function getActiveInstallmentPlans(transactions: InstallmentTx[], cardId: string) {
    const now = new Date();
    return transactions
        .filter(t => t.isInstallment && (t.installmentMonths || 0) > 0 && resolveCardId(t) === cardId)
        .map(t => {
            const startDate = t.installmentStartDate ? new Date(t.installmentStartDate) : new Date(t.date);
            const months = t.installmentMonths as number;
            const monthly = t.installmentMonthly as number;
            const elapsed = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
            const remaining = Math.max(0, months - elapsed);
            const paid = Math.min(elapsed, months);
            return { months, monthly, remaining, paid };
        })
        .filter(p => p.remaining > 0);
}

// The slice of `balance` actually due this statement cycle: strip out every
// active installment plan's not-yet-reached future months, keeping only
// this cycle's installment slice (plus any ordinary revolving debt, which
// was never part of an installment plan to begin with).
export function getDueThisCycle(balance: number, transactions: InstallmentTx[], cardId: string): number {
    const plans = getActiveInstallmentPlans(transactions, cardId);
    const notYetDuePrincipal = plans.reduce((sum, p) => sum + Math.max(0, p.remaining - 1) * p.monthly, 0);
    return Math.max(0, balance - notYetDuePrincipal);
}
