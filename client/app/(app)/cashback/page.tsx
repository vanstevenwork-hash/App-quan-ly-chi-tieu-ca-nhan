'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useCashbackRecords } from '@/hooks/useCashbackRecords';
import { useBanks } from '@/hooks/useBanks';
import { getBankLogo } from '@/lib/bankLogos';
import { resolveCardId, getCappedCashbackTotal } from '@/lib/cashback';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

const MONTHS_WINDOW = 6;

export default function CashbackPage() {
    const { cards, loading: cardsLoading, refetch: refetchCards } = useCards();
    const { transactions, loading: txLoading } = useTransactions();
    const { records, setStatus, loading: recordsLoading } = useCashbackRecords();
    const [updatingKey, setUpdatingKey] = useState<string | null>(null);
    const [viewTab, setViewTab] = useState<'month' | 'card'>('month');
    const { banks: fetchedBanks, fetchBanks } = useBanks();

    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    // O(1) fast path for the common exact-shortName match; falls back to the
    // original substring scan only for the rare case a card's shortName doesn't match.
    const banksByShortName = useMemo(() => {
        const map = new Map<string, any>();
        fetchedBanks.forEach((b: any) => {
            if (b.shortName) map.set(b.shortName.toUpperCase(), b);
        });
        return map;
    }, [fetchedBanks]);

    const getCardLogo = useCallback((card: Card) => {
        const apiBank = banksByShortName.get((card.bankShortName || '').toUpperCase())
            || fetchedBanks.find((b: any) => b.name?.toUpperCase().includes((card.bankName || '').toUpperCase()));
        return (apiBank as any)?.logo || getBankLogo(card.bankShortName, card.bankName);
    }, [banksByShortName, fetchedBanks]);

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

    // Per-card total across the whole window (received + still pending), for the "Theo thẻ" tab
    const cardTotals = useMemo(() => {
        return creditCards
            .map(card => {
                const entry = cardMonthly.find(c => c.card._id === card._id);
                const total = entry ? entry.monthRows.reduce((sum, r) => sum + r.displayAmount, 0) : 0;
                return { card, total };
            })
            .sort((a, b) => b.total - a.total);
    }, [creditCards, cardMonthly]);

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
            const nextStatus = currentStatus === 'received' ? 'pending' : 'received';
            await setStatus(cardId, year, month, nextStatus, estimatedAmount);
            // Server credits/reverses the cashback on the card itself — reload cards
            // so debt totals on Home/Accounts reflect it immediately.
            refetchCards();
            toast.success(nextStatus === 'received'
                ? `Đã nhận ${fmt(estimatedAmount)}₫ — trừ vào dư nợ thẻ`
                : 'Đã chuyển về chờ nhận — hoàn tác trên dư nợ thẻ');
        } catch {
            toast.error('Cập nhật thất bại, thử lại sau');
        } finally {
            setUpdatingKey(null);
        }
    };

    const loading = cardsLoading || txLoading || recordsLoading;

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            <PageHeader title="Hoàn tiền" subtitle="Quản lý" backHref="/dashboard" />

            <div className="px-5 pt-2 space-y-5">
                {/* Hero stats — unified card with premium styling */}
                <div className="relative overflow-hidden rounded-[20px] p-5 shadow-[0_4px_20px_-2px_rgba(16,185,129,0.12)] dark:shadow-xl bg-gradient-to-br from-white to-[#F0FDF4] dark:from-[#162A23] dark:via-[#151D29] dark:to-[#141224] border border-emerald-100 dark:border-slate-700/50">
                    {/* Decorative glow */}
                    <div aria-hidden className="absolute inset-0 pointer-events-none">
                        <div
                            className="absolute -bottom-20 -right-20 w-64 h-48 opacity-30 dark:opacity-60"
                            style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.35) 0%, rgba(245,158,11,0.15) 50%, transparent 70%)', filter: 'blur(20px)' }}
                        />
                        <div
                            className="absolute -top-16 -left-16 w-48 h-40 opacity-20 dark:opacity-40"
                            style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.3) 0%, transparent 65%)', filter: 'blur(16px)' }}
                        />
                        {/* Silk light lines */}
                        <svg className="absolute bottom-0 right-0 w-2/3 h-20 opacity-15 dark:opacity-25" viewBox="0 0 260 80" fill="none" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="cbSilk" x1="0" y1="0" x2="260" y2="0" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#6EE7B7" stopOpacity="0" />
                                    <stop offset="0.5" stopColor="#6EE7B7" stopOpacity="0.8" />
                                    <stop offset="1" stopColor="#FBBF24" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <path d="M0 80 C 80 56, 160 76, 260 32" stroke="url(#cbSilk)" strokeWidth="0.7" />
                            <path d="M20 84 C 100 66, 180 80, 260 46" stroke="url(#cbSilk)" strokeWidth="0.5" />
                            <path d="M60 88 C 130 76, 200 84, 260 62" stroke="url(#cbSilk)" strokeWidth="0.4" />
                        </svg>
                        <div className="absolute bottom-0 right-6 left-1/2 h-px bg-gradient-to-r from-transparent via-emerald-400/25 dark:via-emerald-300/40 to-transparent" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-500 dark:text-slate-300 text-sm font-medium">Tổng hoàn tiền</p>
                            <UtilityIcon type="coins" size={32} tile={false} />
                        </div>
                        <p className="text-slate-800 dark:text-white text-[30px] font-bold tracking-tight leading-none">
                            {fmt(totalReceived + totalPending)}<span className="text-lg text-slate-400 font-medium ml-0.5">₫</span>
                        </p>

                        <div className="flex items-center gap-4 mt-5">
                            <div className="flex-1 flex items-center gap-2.5">
                                <UtilityIcon type="checkCircle" size={32} tile />
                                <div>
                                    <p className="text-[10px] text-slate-400 font-medium">Đã nhận</p>
                                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalReceived)}₫</p>
                                </div>
                            </div>
                            <div className="w-px h-9 bg-slate-200 dark:bg-white/15" />
                            <div className="flex-1 flex items-center gap-2.5">
                                <UtilityIcon type="clock" size={32} tile />
                                <div>
                                    <p className="text-[10px] text-slate-400 font-medium">Đang chờ</p>
                                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{fmt(totalPending)}₫</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trend chart */}
                <div>
                    <div className="flex items-center gap-2 mb-2.5">
                        <UtilityIcon type="trendingUp" size={14} tile={false} color="#6366F1" />
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Xu hướng {MONTHS_WINDOW} tháng</h3>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-gray-100 dark:border-slate-700 shadow-sm">
                        <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={trendData} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 8, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                                    tickFormatter={v => `${Math.round(v / 1000)}k`} />
                                <Tooltip
                                    formatter={(v?: number) => [`${fmt(v || 0)}đ`, 'Hoàn tiền']}
                                    contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E2E8F0' }}
                                />
                                <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#10B981" maxBarSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Per-card breakdown */}
                <div>
                    <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Chi tiết</h3>
                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex gap-1">
                            <button
                                onClick={() => setViewTab('month')}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                                    viewTab === 'month' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400'
                                )}
                            >
                                Theo tháng
                            </button>
                            <button
                                onClick={() => setViewTab('card')}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                                    viewTab === 'card' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400'
                                )}
                            >
                                Theo thẻ
                            </button>
                        </div>
                    </div>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-200 dark:bg-slate-800 animate-pulse" />)}
                        </div>
                    ) : viewTab === 'card' ? (
                        cardTotals.length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 text-center">
                                <p className="text-sm text-slate-400">Chưa có thẻ tín dụng nào</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden divide-y divide-gray-50 dark:divide-slate-700/50">
                                {cardTotals.map(({ card, total }) => {
                                    const logoUrl = getCardLogo(card);
                                    return (
                                    <div key={card._id} className="flex items-center gap-3 px-4 py-3.5">
                                        {logoUrl ? (
                                            <Image src={logoUrl} width={40} height={40} alt={card.bankShortName}
                                                className="w-10 h-10 rounded-lg object-contain bg-white p-1 border border-gray-100 dark:border-slate-700 flex-shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                                <ActionIcon type="creditCard" size={16} tile={false} color="#6366F1" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{card.bankName} •••• {card.cardNumber}</p>
                                            <p className="text-[11px] text-slate-400">
                                                {card.cashbackRate}% hoàn tiền{card.cashbackCap > 0 ? ` · tối đa ${fmtShort(card.cashbackCap)}đ/tháng` : ''}
                                            </p>
                                        </div>
                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">+{fmt(total)}đ</span>
                                    </div>
                                    );
                                })}
                            </div>
                        )
                    ) : cardMonthly.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 text-center">
                            <p className="text-sm text-slate-400">Chưa có dữ liệu hoàn tiền</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {cardMonthly.map(({ card, monthRows }) => {
                                const logoUrl = getCardLogo(card);
                                return (
                                <div key={card._id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                                        {logoUrl ? (
                                            <Image src={logoUrl} width={36} height={36} alt={card.bankShortName}
                                                className="w-9 h-9 rounded-lg object-contain bg-white p-1 border border-gray-100 dark:border-slate-700 flex-shrink-0" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                                <ActionIcon type="creditCard" size={16} tile={false} color="#6366F1" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{card.bankName} •••• {card.cardNumber}</p>
                                            <p className="text-[11px] text-slate-400">
                                                {card.cashbackRate}% hoàn tiền{card.cashbackCap > 0 ? ` · tối đa ${fmtShort(card.cashbackCap)}đ/tháng` : ''}
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
                                                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+{fmt(row.displayAmount)}đ</p>
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
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
