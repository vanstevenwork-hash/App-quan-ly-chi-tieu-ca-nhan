import { resolveCardId } from './cashback';

interface InstallmentTx {
    isInstallment?: boolean;
    installmentMonths?: number;
    installmentMonthly?: number;
    installmentStartDate?: string;
    date: string;
    cardId?: any;
    type?: string;
    amount?: number;
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
export interface InstallmentPlan {
    tx: InstallmentTx & { _id?: string; category?: string; note?: string };
    cardId: string;
    months: number;
    monthly: number;
    total: number;
    remaining: number;   // kỳ còn lại, tính cả kỳ của tháng hiện tại
    paid: number;
    startDate: Date;
    endDate: Date;       // tháng của kỳ cuối
}

// Every plan that still has periods left, optionally limited to one card.
export function getInstallmentPlans(transactions: InstallmentTx[], cardId?: string, now: Date = new Date()): InstallmentPlan[] {
    return transactions
        .filter(t => t.isInstallment && (t.installmentMonths || 0) > 0 && (!cardId || resolveCardId(t) === cardId))
        .map(t => {
            const startDate = t.installmentStartDate ? new Date(t.installmentStartDate) : new Date(t.date);
            const months = t.installmentMonths as number;
            const monthly = t.installmentMonthly || Math.ceil((t.amount || 0) / months);
            const elapsed = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
            const remaining = Math.max(0, months - Math.max(0, elapsed));
            const paid = Math.min(Math.max(0, elapsed), months);
            const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months - 1, 1);
            return { tx: t as InstallmentPlan['tx'], cardId: resolveCardId(t), months, monthly, total: t.amount || 0, remaining, paid, startDate, endDate };
        })
        .filter(p => p.remaining > 0);
}

export function getActiveInstallmentPlans(transactions: InstallmentTx[], cardId: string) {
    return getInstallmentPlans(transactions, cardId);
}

// Tiền phải trả mỗi tháng trong `count` tháng tới (bắt đầu từ tháng hiện tại).
// Kỳ cuối của một gói được điều chỉnh để tổng các kỳ đúng bằng tổng gốc.
export function getInstallmentSchedule(plans: InstallmentPlan[], count = 12, now: Date = new Date()) {
    return Array.from({ length: count }, (_, i) => {
        const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
        let amount = 0;
        let planCount = 0;
        for (const p of plans) {
            if (i >= p.remaining) continue;
            const periodIdx = p.paid + i; // 0-based kỳ thứ mấy của gói
            const isLast = periodIdx === p.months - 1;
            amount += isLast ? Math.max(0, p.total - p.monthly * (p.months - 1)) : p.monthly;
            planCount++;
        }
        return { month, amount, planCount };
    });
}

// The date the most recent statement closed. Given a card's statement-closing
// day, this is `statementDay` of the current month if that day has already
// passed, otherwise `statementDay` of the previous month. Charges posted AFTER
// this date belong to the NEXT statement — they are not due at the upcoming
// payment date. Returns null when the card has no statement day configured.
export function getLastStatementClose(statementDay: number | undefined, now: Date = new Date()): Date | null {
    if (!statementDay) return null;
    const closedThisMonth = now.getDate() > statementDay;
    // Date() clamps an out-of-range day (e.g. 31 in a 30-day month) to the
    // month end, which is the right behaviour for "end of month" statements.
    return new Date(now.getFullYear(), now.getMonth() - (closedThisMonth ? 0 : 1), statementDay, 23, 59, 59, 999);
}

// Ordinary (non-installment) card charges posted AFTER the last statement
// close — these roll into the next statement, so they must NOT count toward
// what's due at the upcoming payment date. Installment plans are handled
// separately (their monthly slices), so they're excluded here to avoid
// double-counting.
export function getPostStatementCharges(transactions: InstallmentTx[], cardId: string, statementDay: number | undefined): number {
    const close = getLastStatementClose(statementDay);
    if (!close) return 0;
    return transactions
        .filter(t => !t.isInstallment && t.type === 'expense' && resolveCardId(t) === cardId && new Date(t.date) > close)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
}

// The slice of `balance` actually due this statement cycle: strip out every
// active installment plan's not-yet-reached future months AND any ordinary
// charges posted after the last statement close (those bill next cycle),
// keeping only this cycle's installment slice plus revolving debt that was
// already on the closed statement.
export function getDueThisCycle(balance: number, transactions: InstallmentTx[], cardId: string, statementDay?: number): number {
    const plans = getActiveInstallmentPlans(transactions, cardId);
    const notYetDuePrincipal = plans.reduce((sum, p) => sum + Math.max(0, p.remaining - 1) * p.monthly, 0);
    const postClose = getPostStatementCharges(transactions, cardId, statementDay);
    return Math.max(0, balance - notYetDuePrincipal - postClose);
}
