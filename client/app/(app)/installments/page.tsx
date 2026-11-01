'use client';
import { useMemo } from 'react';
import { useCards } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import PageHeader from '@/components/PageHeader';
import { getInstallmentPlans, getInstallmentSchedule } from '@/lib/cardDue';
import { formatNumber } from '@/lib/utils';

const fmt = (n: number) => formatNumber(Math.round(n));
const monthLabel = (d: Date) => `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
const fullMonth = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

export default function InstallmentsPage() {
    const { cards } = useCards();
    const { transactions, loading } = useTransactions();

    const plans = useMemo(() => {
        const creditIds = new Set(cards.filter(c => c.cardType === 'credit').map(c => c._id));
        return getInstallmentPlans(transactions as any[])
            .filter(p => creditIds.has(p.cardId))
            .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    }, [transactions, cards]);
    const schedule = useMemo(() => getInstallmentSchedule(plans, 12), [plans]);

    const totals = useMemo(() => {
        const monthly = schedule[0]?.amount ?? 0;
        const outstanding = schedule.reduce((s, m) => s + m.amount, 0)
            + plans.reduce((s, p) => s + Math.max(0, p.remaining - 12) * p.monthly, 0);
        const original = plans.reduce((s, p) => s + p.total, 0);
        const lastEnd = plans.reduce<Date | null>((m, p) => (!m || p.endDate > m ? p.endDate : m), null);
        return { monthly, outstanding, original, lastEnd };
    }, [plans, schedule]);

    const byCard = useMemo(() => {
        const map = new Map<string, { name: string; monthly: number; outstanding: number; count: number }>();
        plans.forEach(p => {
            const card = cards.find(c => c._id === p.cardId);
            const row = map.get(p.cardId) || { name: `${card?.bankShortName ?? ''} •••• ${(card?.cardNumber || '').slice(-4)}`.trim(), monthly: 0, outstanding: 0, count: 0 };
            row.monthly += p.monthly;
            row.outstanding += p.remaining * p.monthly;
            row.count += 1;
            map.set(p.cardId, row);
        });
        return Array.from(map.values()).sort((a, b) => b.monthly - a.monthly);
    }, [plans, cards]);

    const maxMonth = Math.max(1, ...schedule.map(m => m.amount));

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep">
            <PageHeader title="Tổng trả góp" subtitle="Theo dõi các khoản đang trả góp" backHref="/cards" />

            <div className="px-5 pt-3 space-y-4">
                {plans.length === 0 ? (
                    <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 p-8 text-center">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{loading ? 'Đang tải...' : 'Chưa có khoản trả góp nào'}</p>
                        {!loading && <p className="text-xs text-slate-400 mt-1">Bật “Trả góp” khi thêm chi tiêu bằng thẻ tín dụng.</p>}
                    </div>
                ) : (
                    <>
                        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                            <p className="text-xs opacity-80">Phải trả tháng này</p>
                            <p className="text-3xl font-bold mt-1">{fmt(totals.monthly)}₫</p>
                            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                                <div><p className="text-[10px] opacity-75">Còn phải trả</p><p className="text-sm font-bold">{fmt(totals.outstanding)}₫</p></div>
                                <div><p className="text-[10px] opacity-75">Số khoản</p><p className="text-sm font-bold">{plans.length}</p></div>
                                <div><p className="text-[10px] opacity-75">Tất toán</p><p className="text-sm font-bold">{totals.lastEnd ? fullMonth(totals.lastEnd) : '—'}</p></div>
                            </div>
                        </div>

                        <section className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 p-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3">12 tháng tới</h3>
                            <div className="flex items-end gap-1.5 h-28">
                                {schedule.map((m, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                                        <div className={`w-full rounded-t-md ${i === 0 ? 'bg-indigo-500' : 'bg-indigo-200 dark:bg-indigo-900/60'}`}
                                            style={{ height: `${Math.max(m.amount > 0 ? 4 : 0, (m.amount / maxMonth) * 100)}%` }} />
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-1.5 mt-1">
                                {schedule.map((m, i) => <span key={i} className="flex-1 text-[9px] text-slate-400 text-center">{m.month.getMonth() + 1}</span>)}
                            </div>
                            <div className="mt-3 divide-y divide-gray-100 dark:divide-slate-700">
                                {schedule.filter(m => m.amount > 0).map(m => (
                                    <div key={m.month.getTime()} className="flex justify-between py-1.5 text-xs">
                                        <span className="text-slate-500">{monthLabel(m.month)} · {m.planCount} khoản</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-100">{fmt(m.amount)}₫</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {byCard.length > 0 && (
                            <section className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 p-4">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Theo thẻ</h3>
                                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {byCard.map(r => (
                                        <div key={r.name} className="flex justify-between items-center py-2">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.name}</p>
                                                <p className="text-[11px] text-slate-400">{r.count} khoản · còn {fmt(r.outstanding)}₫</p>
                                            </div>
                                            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmt(r.monthly)}₫/th</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Chi tiết từng khoản</h3>
                            {plans.map(p => {
                                const pct = Math.round((p.paid / p.months) * 100);
                                return (
                                    <div key={p.tx._id} className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 p-4">
                                        <div className="flex justify-between">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{p.tx.category}</p>
                                                {p.tx.note && <p className="text-xs text-slate-400 truncate">{p.tx.note}</p>}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmt(p.monthly)}₫/th</p>
                                                <p className="text-[11px] text-slate-400">tổng {fmt(p.total)}₫</p>
                                            </div>
                                        </div>
                                        <div className="h-2 mt-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-500" style={{ width: `${pct}%` }} />
                                        </div>
                                        <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                                            <span>{p.paid}/{p.months} kỳ · còn {p.remaining} kỳ</span>
                                            <span>Hết {fullMonth(p.endDate)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
