'use client';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useBanks } from '@/hooks/useBanks';
import PageHeader from '@/components/PageHeader';
import AddTransactionModal from '@/components/AddTransactionModal';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { getBankLogo } from '@/lib/bankLogos';
import { getInstallmentPlans, getInstallmentSchedule, type InstallmentPlan } from '@/lib/cardDue';
import { cn, formatNumber } from '@/lib/utils';

const fmt = (n: number) => formatNumber(Math.round(n));
const pad = (n: number) => String(n).padStart(2, '0');
const fmtMonthYear = (d: Date) => `${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtDayMonth = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

// Next occurrence of a card's payment-due day (today counts).
function nextDueDate(day: number, now = new Date()): Date {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(now.getFullYear(), now.getMonth(), day);
    if (due < today) due.setMonth(due.getMonth() + 1);
    return due;
}

type Tab = 'all' | 'active' | 'done';
const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'active', label: 'Đang trả' },
    { key: 'done', label: 'Đã hoàn tất' },
];

function StatIcon({ type }: { type: 'layers' | 'calendar' }) {
    return (
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 text-indigo-500">
            {type === 'layers' ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /><path d="m3 17.5 9 5 9-5" opacity=".5" />
                </svg>
            ) : (
                <CustomIcon type="calendar" size={20} tile={false} color="currentColor" className="w-5 h-5" />
            )}
        </div>
    );
}

export default function InstallmentsPage() {
    const router = useRouter();
    const { cards, refetch: refetchCards } = useCards();
    const { transactions, loading, refetch: refetchTx } = useTransactions();
    const { banks, fetchBanks } = useBanks();
    const [tab, setTab] = useState<Tab>('all');
    const [showAllMonths, setShowAllMonths] = useState(false);
    const [showAdd, setShowAdd] = useState(false);

    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    const creditCards = useMemo(() => cards.filter(c => c.cardType === 'credit'), [cards]);
    const cardById = useMemo(() => new Map(creditCards.map(c => [c._id, c])), [creditCards]);

    const logoFor = (card?: Card): string | undefined => {
        if (!card) return undefined;
        const short = (card.bankShortName || '').toUpperCase();
        return banks.find((b: any) => b.shortName?.toUpperCase() === short)?.logo || getBankLogo(card.bankShortName, card.bankName);
    };

    // Every plan on an existing credit card, completed ones included.
    const allPlans = useMemo(() =>
        getInstallmentPlans(transactions as any[], undefined, new Date(), true)
            .filter(p => cardById.has(p.cardId))
            .sort((a, b) => a.endDate.getTime() - b.endDate.getTime()),
        [transactions, cardById]);

    const activePlans = useMemo(() => allPlans.filter(p => p.remaining > 0), [allPlans]);
    const donePlans = useMemo(() => allPlans.filter(p => p.remaining === 0), [allPlans]);
    const shownPlans = tab === 'all' ? allPlans : tab === 'active' ? activePlans : donePlans;

    const maxRemaining = Math.max(0, ...activePlans.map(p => p.remaining));
    const schedule = useMemo(() => getInstallmentSchedule(activePlans, maxRemaining || 1), [activePlans, maxRemaining]);

    const thisMonth = schedule[0]?.amount ?? 0;
    const outstanding = schedule.reduce((s, m) => s + m.amount, 0);
    const lastEnd = activePlans.reduce<Date | null>((m, p) => (!m || p.endDate > m ? p.endDate : m), null);

    // Nearest due date among the cards that currently carry an installment.
    const dueDate = useMemo(() => {
        const days = activePlans
            .map(p => cardById.get(p.cardId)?.paymentDueDay || 0)
            .filter(d => d > 0)
            .map(d => nextDueDate(d));
        return days.length ? days.sort((a, b) => a.getTime() - b.getTime())[0] : null;
    }, [activePlans, cardById]);

    const monthsShown = showAllMonths ? schedule : schedule.slice(0, 3);
    const singlePlan = activePlans.length === 1 ? activePlans[0] : null;

    const countByCard = useMemo(() => {
        const m = new Map<string, number>();
        activePlans.forEach(p => m.set(p.cardId, (m.get(p.cardId) || 0) + 1));
        return m;
    }, [activePlans]);

    const planCurrentSlice = (p: InstallmentPlan) =>
        p.remaining === 1 ? Math.max(0, p.total - p.monthly * (p.months - 1)) : p.monthly;

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep transition-colors duration-200">
            <PageHeader
                title="Trả góp thẻ tín dụng"
                subtitle="Quản lý các khoản trả góp của bạn"
                backHref="/dashboard"
                rightActions={
                    <button
                        onClick={() => setShowAdd(true)}
                        aria-label="Thêm khoản trả góp"
                        className="w-10 h-10 rounded-xl bg-brand-light/60 dark:bg-slate-800 text-brand dark:text-brand-light flex items-center justify-center active:scale-95 transition-all flex-shrink-0"
                    >
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                }
            />

            <div className="px-5 pt-3 space-y-4">
                {/* ── Hero ─────────────────────────────────────── */}
                <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #7C5CF0 0%, #5B3FD0 55%, #2E2A7A 100%)' }}>
                    <div aria-hidden className="absolute -right-6 top-3 w-44 h-28 pointer-events-none">
                        <div className="absolute right-12 top-2 w-28 h-[72px] rounded-xl bg-white/25 border border-white/30 -rotate-[14deg]" />
                        <div className="absolute right-0 top-8 w-28 h-[72px] rounded-xl bg-gradient-to-br from-white/35 to-indigo-400/30 border border-white/30 -rotate-[8deg]">
                            <span className="absolute right-3 bottom-2.5 flex">
                                <i className="w-5 h-5 rounded-full bg-red-500/90 block" />
                                <i className="w-5 h-5 rounded-full bg-amber-400/90 block -ml-2" />
                            </span>
                        </div>
                    </div>
                    <p className="text-xs opacity-90">Phải trả tháng này</p>
                    <p className="text-2xl leading-tight font-bold mt-1 tracking-tight text-money">{fmt(thisMonth)}₫</p>
                    <div className="flex items-center gap-2 mt-2.5 text-xs opacity-95">
                        <CustomIcon type="calendar" size={18} tile={false} color="currentColor" className="w-[18px] h-[18px]" />
                        <span>Đến hạn: {dueDate ? `${fmtDayMonth(dueDate)}/${dueDate.getFullYear()}` : '—'}</span>
                    </div>
                </div>

                {/* ── Stats ────────────────────────────────────── */}
                <div className="bg-white dark:bg-surface rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-3 grid grid-cols-3 gap-1 divide-x divide-gray-100 dark:divide-slate-700">
                    <div className="flex items-center gap-2 px-1 min-w-0">
                        <StatIcon type="layers" />
                        <div className="min-w-0">
                            <p className="text-[11px] text-slate-400">Còn phải trả</p>
                            <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{fmt(outstanding)}₫</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-2 min-w-0">
                        <StatIcon type="layers" />
                        <div className="min-w-0">
                            <p className="text-[11px] text-slate-400">Số khoản</p>
                            <p className="text-[13px] font-bold text-slate-900 dark:text-white">{activePlans.length}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-2 min-w-0">
                        <StatIcon type="calendar" />
                        <div className="min-w-0">
                            <p className="text-[11px] text-slate-400">Kết thúc</p>
                            <p className="text-[13px] font-bold text-slate-900 dark:text-white">{lastEnd ? fmtMonthYear(lastEnd) : '—'}</p>
                        </div>
                    </div>
                </div>

                {/* ── Tabs ─────────────────────────────────────── */}
                <div className="flex p-1.5 rounded-xl bg-indigo-50/70 dark:bg-slate-800/70">
                    {TABS.map(t => {
                        const count = t.key === 'all' ? allPlans.length : t.key === 'active' ? activePlans.length : donePlans.length;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={cn(
                                    'flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all',
                                    tab === t.key
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                                        : 'text-slate-600 dark:text-slate-400'
                                )}
                            >
                                {t.label}{t.key !== 'done' ? ` (${count})` : ''}
                            </button>
                        );
                    })}
                </div>

                {/* ── Plan cards ───────────────────────────────── */}
                {shownPlans.length === 0 ? (
                    <div className="bg-white dark:bg-surface rounded-xl border border-gray-100 dark:border-slate-800 p-8 text-center">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {loading ? 'Đang tải...' : tab === 'done' ? 'Chưa có khoản nào hoàn tất' : 'Chưa có khoản trả góp nào'}
                        </p>
                        {!loading && tab !== 'done' && (
                            <p className="text-xs text-slate-400 mt-1">Bật “Trả góp” khi thêm chi tiêu bằng thẻ tín dụng.</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {shownPlans.map(p => {
                            const card = cardById.get(p.cardId);
                            const done = p.remaining === 0;
                            const pct = Math.round((p.paid / p.months) * 100);
                            return (
                                <div key={p.tx._id} className="bg-white dark:bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
                                    <div className="flex gap-3">
                                        <div
                                            className="w-[92px] h-[62px] rounded-xl flex-shrink-0 relative overflow-hidden shadow-md"
                                            style={{ background: `linear-gradient(135deg, ${card?.color || '#6C63FF'}, ${card?.bankColor || '#1B4FD8'})` }}
                                        >
                                            <span className="absolute left-2 top-1.5 text-[11px] font-extrabold text-white drop-shadow">{card?.bankShortName}</span>
                                            <span className="absolute left-2 bottom-1.5 text-[9px] text-white/90 tracking-wider">•••• {(card?.cardNumber || '').slice(-4)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-[15px] font-bold text-slate-900 dark:text-white truncate">{p.tx.note || p.tx.category}</p>
                                                <span className={cn(
                                                    'flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0',
                                                    done
                                                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                )}>
                                                    <i className={cn('w-1.5 h-1.5 rounded-full block', done ? 'bg-slate-400' : 'bg-emerald-500')} />
                                                    {done ? 'Hoàn tất' : 'Đang trả'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">Trả góp 0% · {p.months} tháng</p>
                                            <div className="h-2 mt-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="flex justify-between mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                <span>Đã trả {p.paid}/{p.months} kỳ</span>
                                                <span>{done ? 'Đã tất toán' : `Còn ${p.remaining} kỳ`}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => router.push(`/cards/${p.cardId}`)}
                                        className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 w-full flex items-center gap-3 text-left active:opacity-70"
                                    >
                                        <StatIcon type="calendar" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{done ? 'Tổng đã trả' : 'Phải trả tháng này'}</p>
                                            <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 text-money">
                                                {fmt(done ? p.total : planCurrentSlice(p))} ₫
                                            </p>
                                        </div>
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Lịch trả góp ─────────────────────────────── */}
                {activePlans.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-2.5 mt-2">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Lịch trả góp</h3>
                            {schedule.length > 3 && (
                                <button onClick={() => setShowAllMonths(v => !v)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                    {showAllMonths ? 'Thu gọn ‹' : `Xem tất cả (${schedule.length}) ›`}
                                </button>
                            )}
                        </div>
                        <div className="bg-white dark:bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-2">
                            {monthsShown.map((m, i) => {
                                const current = i === 0;
                                const kyLabel = singlePlan ? ` · Kỳ ${singlePlan.paid + i + 1}/${singlePlan.months}` : ` · ${m.planCount} khoản`;
                                return (
                                    <div key={m.month.getTime()} className={cn('flex items-center gap-3 px-3 py-3.5 rounded-xl', current && 'bg-indigo-50 dark:bg-indigo-900/20', i > 0 && !current && 'border-t border-gray-100 dark:border-slate-700 rounded-none')}>
                                        <span className={cn(
                                            'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2',
                                            current ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-200 dark:border-slate-600'
                                        )}>
                                            {current && <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                                        </span>
                                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                            <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                                                T{m.month.getMonth() + 1}/{m.month.getFullYear()}
                                                <span className="font-normal text-slate-500 dark:text-slate-400">{kyLabel}</span>
                                            </span>
                                            {current && dueDate && (
                                                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400">
                                                    <CustomIcon type="calendar" size={12} tile={false} color="currentColor" className="w-3 h-3" />
                                                    Đến hạn {fmtDayMonth(dueDate)}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[13px] font-bold text-slate-900 dark:text-white flex-shrink-0 text-money">{fmt(m.amount)} ₫</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ── Các thẻ có trả góp ───────────────────────── */}
                {creditCards.length > 0 && (
                    <section>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2.5 mt-2">Các thẻ có trả góp</h3>
                        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                            {creditCards.map(card => {
                                const logo = logoFor(card);
                                const n = countByCard.get(card._id) || 0;
                                return (
                                    <button
                                        key={card._id}
                                        onClick={() => router.push(`/cards/${card._id}`)}
                                        className="bg-white dark:bg-surface rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                                    >
                                        <div className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {logo
                                                // eslint-disable-next-line @next/next/no-img-element
                                                ? <img src={logo} alt={card.bankShortName} className="w-10 h-10 object-contain" />
                                                : <span className="text-xs font-bold text-slate-500">{card.bankShortName}</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{card.bankShortName}</p>
                                            <p className="text-xs text-slate-400 tracking-wide">•••• {(card.cardNumber || '').slice(-4)}</p>
                                        </div>
                                        <span className={cn(
                                            'text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0',
                                            n > 0 ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                        )}>{n} khoản</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>

            <AddTransactionModal
                open={showAdd}
                onClose={() => setShowAdd(false)}
                onSaved={() => { refetchTx(); refetchCards(); }}
            />
        </div>
    );
}
