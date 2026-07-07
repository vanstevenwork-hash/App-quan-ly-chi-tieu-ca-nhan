'use client';
import { useMemo, useState } from 'react';
import { CreditCard, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useCashbackRecords } from '@/hooks/useCashbackRecords';
import { resolveCardId, getCappedCashbackTotal } from '@/lib/cashback';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

const MONTHS_WINDOW = 6;

export default function CashbackPage() {
    const { cards, loading: cardsLoading } = useCards();
    const { transactions, loading: txLoading } = useTransactions();
    const { records, setStatus, loading: recordsLoading } = useCashbackRecords();
    const [updatingKey, setUpdatingKey] = useState<string | null>(null);

    const creditCards = useMemo(() => cards.filter(c => c.cardType === 'credit'), [cards]);

    // Last N months window, oldest first: [{ year, month, label }]
    const months = useMemo(() => {
        const now = new Date();
        return Array.from({ length: MONTHS_WINDOW }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_WINDOW - 1 - i), 1);
            return { year: d.getFullYear(), month: d.getMonth(), label: `Th${d.getMonth() + 1}/${d.getFullYear()}` };
        });
    }, []);

    // Every (card, month) combination in the window with its estimated cashback
    const rawMonthly = useMemo(() => {
        return creditCards.flatMap(card => {
            const cardTxs = transactions.filter(t =>
                t.type === 'expense' && t.paymentMethod === 'card' && resolveCardId(t) === card._id
            );
            return months.map(({ year, month, label }) => {
                const monthTxs = cardTxs.filter(t => { const d = new Date(t.date); return d.getFullYear() === year && d.getMonth() === month; });
                const estimatedAmount = getCappedCashbackTotal(monthTxs, card.cashbackRate, card.cashbackCap);
                return { card, year, month, label, estimatedAmount };
            });
        });
    }, [creditCards, transactions, months]);

    // Grouped per card, dropping months with no activity and no existing record
    const cardMonthly = useMemo(() => {
        const byCard = new Map<string, { card: Card; monthRows: { year: number; month: number; label: string; estimatedAmount: number; displayAmount: number; status: 'pending' | 'received' }[] }>();
        rawMonthly.forEach(({ card, year, month, label, estimatedAmount }) => {
            const record = records.find(r => r.cardId === card._id && r.year === year && r.month === month);
            if (estimatedAmount <= 0 && !record) return;
            const status: 'pending' | 'received' = record?.status || 'pending';
            const displayAmount = status === 'received' ? (record?.receivedAmount ?? estimatedAmount) : estimatedAmount;
            if (!byCard.has(card._id)) byCard.set(card._id, { card, monthRows: [] });
            byCard.get(card._id)!.monthRows.push({ year, month, label, estimatedAmount, displayAmount, status });
        });
        return Array.from(byCard.values()).map(c => ({ ...c, monthRows: c.monthRows.reverse() }));
    }, [rawMonthly, records]);

    // Trend: total estimated cashback per month across all credit cards
    const trendData = useMemo(() => {
        const totals = new Map<string, number>();
        months.forEach(({ label }) => totals.set(label, 0));
        rawMonthly.forEach(({ label, estimatedAmount }) => totals.set(label, (totals.get(label) || 0) + estimatedAmount));
        return Array.from(totals.entries()).map(([name, total]) => ({ name, total }));
    }, [rawMonthly, months]);

    const totalReceived = useMemo(() =>
        records.filter(r => r.status === 'received').reduce((sum, r) => sum + (r.receivedAmount ?? r.estimatedAmount), 0),
        [records]);

    const totalPending = useMemo(() =>
        cardMonthly.reduce((sum, c) => sum + c.monthRows.filter(r => r.status === 'pending').reduce((s, r) => s + r.estimatedAmount, 0), 0),
        [cardMonthly]);

    const handleToggleStatus = async (cardId: string, year: number, month: number, currentStatus: 'pending' | 'received', estimatedAmount: number) => {
        const key = `${cardId}-${year}-${month}`;
        setUpdatingKey(key);
        try {
            await setStatus(cardId, year, month, currentStatus === 'received' ? 'pending' : 'received', estimatedAmount);
        } finally {
            setUpdatingKey(null);
        }
    };

    const loading = cardsLoading || txLoading || recordsLoading;

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            <PageHeader title="Hoàn tiền" subtitle="Quản lý" backHref="/cards" />

            <div className="px-5 pt-2 space-y-5">
                {/* Hero stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl p-4 border border-gray-100 dark:border-slate-800 shadow-sm"
                        style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
                        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold mb-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Đã nhận
                        </div>
                        <p className="text-xl font-bold text-emerald-700">{fmt(totalReceived)}₫</p>
                    </div>
                    <div className="rounded-2xl p-4 border border-gray-100 dark:border-slate-800 shadow-sm"
                        style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)' }}>
                        <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold mb-1.5">
                            <Clock className="w-3.5 h-3.5" /> Đang chờ
                        </div>
                        <p className="text-xl font-bold text-amber-700">{fmt(totalPending)}₫</p>
                    </div>
                </div>

                {/* Trend chart */}
                <div>
                    <div className="flex items-center gap-2 mb-2.5">
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Xu hướng {MONTHS_WINDOW} tháng</h3>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-gray-100 dark:border-slate-700 shadow-sm">
                        <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={trendData} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 8, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                                    tickFormatter={v => `${Math.round(v / 1000)}k`} />
                                <Tooltip
                                    formatter={(v?: number) => [`${fmt(v || 0)}₫`, 'Hoàn tiền']}
                                    contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E2E8F0' }}
                                />
                                <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#10B981" maxBarSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Per-card breakdown */}
                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2.5">Chi tiết theo thẻ</h3>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-200 dark:bg-slate-800 animate-pulse" />)}
                        </div>
                    ) : cardMonthly.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 text-center">
                            <p className="text-sm text-slate-400">Chưa có dữ liệu hoàn tiền</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {cardMonthly.map(({ card, monthRows }) => (
                                <div key={card._id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                            <CreditCard className="w-4 h-4 text-indigo-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{card.bankName} •••• {card.cardNumber}</p>
                                            <p className="text-[11px] text-slate-400">
                                                {card.cashbackRate}% hoàn tiền{card.cashbackCap > 0 ? ` · tối đa ${fmtShort(card.cashbackCap)}₫/tháng` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                                        {monthRows.map(row => {
                                            const key = `${card._id}-${row.year}-${row.month}`;
                                            return (
                                                <div key={key} className="flex items-center gap-3 px-4 py-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{row.label}</p>
                                                        <p className="text-xs text-slate-400">+{fmt(row.displayAmount)}₫</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggleStatus(card._id, row.year, row.month, row.status, row.estimatedAmount)}
                                                        disabled={updatingKey === key}
                                                        className={cn(
                                                            'text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-50 flex-shrink-0',
                                                            row.status === 'received'
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        )}
                                                    >
                                                        {row.status === 'received' ? '✓ Đã nhận' : 'Chờ nhận'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
