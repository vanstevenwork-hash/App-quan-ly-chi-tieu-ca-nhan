// Statement-cycle helpers for credit cards: when the statement closes, when
// the payment is due, and how many interest-free days a purchase made today gets.

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// `day` of the given month, clamped to the month's last day (31 → 28/30).
function dayOfMonth(year: number, month: number, day: number): Date {
    const last = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, last));
}

export function daysBetween(from: Date, to: Date): number {
    return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

// Next occurrence of `day`, counting today.
export function nextOccurrence(day: number, now: Date = new Date()): Date {
    const today = startOfDay(now);
    const thisMonth = dayOfMonth(now.getFullYear(), now.getMonth(), day);
    return thisMonth >= today ? thisMonth : dayOfMonth(now.getFullYear(), now.getMonth() + 1, day);
}

// Most recent statement close, counting today (a purchase on the close day is
// still on that statement, matching getLastStatementClose in cardDue).
export function lastClose(statementDay: number, now: Date = new Date()): Date {
    const today = startOfDay(now);
    const thisMonth = dayOfMonth(now.getFullYear(), now.getMonth(), statementDay);
    return thisMonth < today ? thisMonth : dayOfMonth(now.getFullYear(), now.getMonth() - 1, statementDay);
}

// First payment-due date that falls after a statement closed on `close`.
export function dueAfterClose(close: Date, paymentDueDay: number): Date {
    const sameMonth = dayOfMonth(close.getFullYear(), close.getMonth(), paymentDueDay);
    return sameMonth > close ? sameMonth : dayOfMonth(close.getFullYear(), close.getMonth() + 1, paymentDueDay);
}

export interface CardCycle {
    nextClose: Date;      // chốt sao kê sắp tới
    dueDate: Date;        // hạn thanh toán gần nhất sắp tới
    daysToDue: number;
    // true: hạn này thuộc kỳ đã chốt (có số tiền phải trả); false: kỳ chưa chốt
    dueIsForClosedStatement: boolean;
    // hạn trả của khoản quẹt hôm nay, và số ngày miễn lãi tương ứng
    freeUntil: Date;
    freeDaysIfSwipedToday: number;
}

export function getCardCycle(statementDay: number, paymentDueDay: number, now: Date = new Date()): CardCycle {
    const today = startOfDay(now);
    const nextClose = nextOccurrence(statementDay, now);
    const closedDue = dueAfterClose(lastClose(statementDay, now), paymentDueDay);
    const freeUntil = dueAfterClose(nextClose, paymentDueDay);
    const dueIsForClosedStatement = closedDue >= today;
    const dueDate = dueIsForClosedStatement ? closedDue : dueAfterClose(nextClose, paymentDueDay);
    return {
        nextClose,
        dueDate,
        daysToDue: daysBetween(today, dueDate),
        dueIsForClosedStatement,
        freeUntil,
        freeDaysIfSwipedToday: daysBetween(today, freeUntil),
    };
}
