'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useCashbackRecords } from '@/hooks/useCashbackRecords';
import { useCardShares } from '@/hooks/useCardShares';
import { useBanks } from '@/hooks/useBanks';
import { getBankLogo } from '@/lib/bankLogos';
import { resolveCardId, getCappedCashbackTotal } from '@/lib/cashback';
import { cardSharesApi } from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.', ',')}tỷ`.replace(',0tỷ', 'tỷ');
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}tr`.replace(',0tr', 'tr');
    return `${Math.round(n / 1_000)}k`;
};

// Value labels above trend bars, in thousands ("5.667" = 5.667.340đ)
const renderBarLabel = (props: any) => {
    const { x, y, width, value } = props;
    return (
        <text x={x + width / 2} y={y - 7} textAnchor="middle" fontSize={10} fontWeight={700}
            fill={value > 0 ? '#34D399' : '#64748B'}>
            {value > 0 ? fmt(value / 1000) : '0'}
        </text>
    );
};

// Theme-aware tooltip — recharts' default is a hardcoded white box that breaks in dark mode
const TrendTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl px-3 py-2 bg-white dark:bg-surface border border-gray-100 dark:border-slate-600 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
            <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
                Hoàn tiền: <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(payload[0]?.value || 0)}đ</span>
            </p>
        </div>
    );
};

// Fully-rounded bars: current month glows with a gradient, past months muted green, empty months a gray stub
const TrendBarShape = (props: any) => {
    const { x, y, width, height, payload } = props;
    const r = Math.min(7, height / 2, width / 2);
    const fill = payload?.now ? 'url(#cbBarNow)' : payload?.total > 0 ? '#15803D' : 'rgba(148,163,184,0.35)';
    return <rect x={x} y={y} width={width} height={height} rx={r} fill={fill} />;
};

const MONTHS_WINDOW = 6;

export default function CashbackPage() {
    const { cards, loading: cardsLoading, refetch: refetchCards } = useCards();
    const { transactions, loading: txLoading } = useTransactions();
    const { records, setStatus, loading: recordsLoading } = useCashbackRecords();
    const [updatingKey, setUpdatingKey] = useState<string | null>(null);
    const [viewTab, setViewTab] = useState<'month' | 'card'>('month');
    const { banks: fetchedBanks, fetchBanks } = useBanks();
    const { sharedCards } = useCardShares();

    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    // This month's real (combined owner + invitee spend) cashback for every card
    // shared with me — fetched from the same endpoint the Cards page badge uses,
    // so the number here is always identical to what the card owner sees.
    type SharedCashback = { cardId: string; bankName: string; cashbackEarned: number; capped: boolean };
    const [sharedCashback, setSharedCashback] = useState<SharedCashback[]>([]);
    useEffect(() => {
        if (sharedCards.length === 0) { setSharedCashback([]); return; }
        let alive = true;
        Promise.all(sharedCards.map(sc =>
            cardSharesApi.getCashback(sc.card._id)
                .then(res => res.data?.data)
                .catch(() => null)
        )).then(results => {
            if (!alive) return;
            setSharedCashback(
                results.filter(Boolean).map((d: any) => ({
                    cardId: d.cardId, bankName: d.bankName, cashbackEarned: d.cashbackEarned, capped: d.capped,
                }))
            );
        });
        return () => { alive = false; };
    }, [sharedCards]);
    const sharedCashbackTotal = useMemo(
        () => sharedCashback.reduce((s, c) => s + c.cashbackEarned, 0),
        [sharedCashback]
    );

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
            return { year: d.getFullYear(), month: d.getMonth(), label: `Th${d.getMonth() + 1}/${d.getFullYear()}`, short: `T${d.getMonth() + 1}` };
        });
    }, []);
    const curMonth = months[months.length - 1];

    // Every (card, month) combination in the window with its estimated cashback
    const rawMonthly = useMemo(() => {
        return creditCards.flatMap(card => {
            const cardTxs = transactions.filter(t =>
                t.type === 'expense' && t.paymentMethod === 'card' && resolveCardId(t) === card._id
            );
            return months.map(({ year, month, label }) => {
                const monthTxs = cardTxs.filter(t => { const d = new Date(t.date); return d.getFullYear() === year && d.getMonth() === month; });
                const estimatedAmount = getCappedCashbackTotal(monthTxs, card.cashbackRate, card.cashbackCap);
                // Uncapped total — when it exceeds the cap, the row shows "chạm trần"
                const rawAmount = monthTxs.reduce((s, t) => s + t.amount, 0) * (card.cashbackRate || 0) / 100;
                const capped = card.cashbackCap > 0 && rawAmount > card.cashbackCap;
                return { card, year, month, label, estimatedAmount, capped };
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

    // Current-month snapshot per card, for the "Theo thẻ" tab (amount, status, cap progress)
    const currentMonthCards = useMemo(() => {
        return creditCards
            .map(card => {
                const rm = rawMonthly.find(r => r.card._id === card._id && r.year === curMonth.year && r.month === curMonth.month);
                const record = records.find(r => r.cardId === card._id && r.year === curMonth.year && r.month === curMonth.month);
                const estimatedAmount = rm?.estimatedAmount ?? 0;
                const status: 'pending' | 'received' = record?.status || 'pending';
                const displayAmount = status === 'received' ? (record?.receivedAmount ?? estimatedAmount) : estimatedAmount;
                return { card, estimatedAmount, displayAmount, status, capped: rm?.capped ?? false, hasRecord: !!record };
            })
            .filter(x => x.estimatedAmount > 0 || x.hasRecord)
            .sort((a, b) => b.displayAmount - a.displayAmount);
    }, [creditCards, rawMonthly, records, curMonth]);

    // Complete roster of every credit card (own + shared) with this month's
    // cashback — a bottom reference list so no card is hidden, unlike the tabs
    // above which drop cards with no activity.
    const allCardsCashback = useMemo(() => {
        const own = creditCards.map(card => {
            const rm = rawMonthly.find(r => r.card._id === card._id && r.year === curMonth.year && r.month === curMonth.month);
            const record = records.find(r => r.cardId === card._id && r.year === curMonth.year && r.month === curMonth.month);
            const est = rm?.estimatedAmount ?? 0;
            const status: 'pending' | 'received' = record?.status || 'pending';
            const amount = status === 'received' ? (record?.receivedAmount ?? est) : est;
            return { key: card._id, name: `${card.bankName} •••• ${card.cardNumber}`, sub: `Hoàn ${card.cashbackRate || 0}%`, logo: getCardLogo(card) as string | null, amount, shared: false };
        });
        const shared = sharedCashback.map(sc => {
            const owner = sharedCards.find(x => x.card._id === sc.cardId)?.owner;
            return { key: sc.cardId, name: sc.bankName, sub: `Thẻ chung${owner ? ` · của ${owner.name}` : ''}`, logo: null as string | null, amount: sc.cashbackEarned, shared: true };
        });
        return [...own, ...shared].sort((a, b) => b.amount - a.amount);
    }, [creditCards, rawMonthly, records, curMonth, sharedCashback, sharedCards, getCardLogo]);
    const allCardsCashbackTotal = useMemo(() => allCardsCashback.reduce((s, c) => s + c.amount, 0), [allCardsCashback]);

    // Insight: when cards hit their monthly cap, suggest the best card to move spending to
    const insight = useMemo(() => {
        const rows = creditCards.map(card => {
            const rm = rawMonthly.find(r => r.card._id === card._id && r.year === curMonth.year && r.month === curMonth.month);
            return { card, est: rm?.estimatedAmount ?? 0, capped: rm?.capped ?? false };
        });
        const cappedCount = rows.filter(r => r.capped).length;
        if (cappedCount === 0) return null;
        const best = rows
            .filter(r => !r.capped && (r.card.cashbackRate || 0) > 0)
            .map(r => ({ ...r, remaining: r.card.cashbackCap > 0 ? r.card.cashbackCap - r.est : Infinity }))
            .filter(r => r.remaining > 0)
            .sort((a, b) => (b.card.cashbackRate - a.card.cashbackRate) || (b.remaining - a.remaining))[0];
        if (!best) return null;
        return { cappedCount, best };
    }, [creditCards, rawMonthly, curMonth]);

    // ── Month-first grouping for the "Theo tháng" view ──────────────
    // Newest month first; consecutive months with no cashback collapse into one muted range row.
    type MonthRow = { card: Card; estimatedAmount: number; displayAmount: number; status: 'pending' | 'received'; capped: boolean };
    type MonthGroup =
        | { kind: 'month'; key: string; year: number; month: number; rows: MonthRow[]; total: number; pending: number }
        | { kind: 'empty'; key: string; months: { year: number; month: number }[] };

    const monthGroups = useMemo<MonthGroup[]>(() => {
        const list: MonthGroup[] = [];
        let emptyRun: { year: number; month: number }[] = [];
        const flushEmpty = () => {
            if (emptyRun.length) {
                list.push({ kind: 'empty', key: `empty-${emptyRun[0].year}-${emptyRun[0].month}`, months: [...emptyRun] });
                emptyRun = [];
            }
        };
        [...months].reverse().forEach(({ year, month }) => {
            const rows: MonthRow[] = [];
            rawMonthly.forEach(rm => {
                if (rm.year !== year || rm.month !== month) return;
                const record = records.find(r => r.cardId === rm.card._id && r.year === year && r.month === month);
                if (rm.estimatedAmount <= 0 && !record) return;
                const status: 'pending' | 'received' = record?.status || 'pending';
                const displayAmount = status === 'received' ? (record?.receivedAmount ?? rm.estimatedAmount) : rm.estimatedAmount;
                rows.push({ card: rm.card, estimatedAmount: rm.estimatedAmount, displayAmount, status, capped: rm.capped });
            });
            if (rows.length === 0) { emptyRun.push({ year, month }); return; }
            flushEmpty();
            rows.sort((a, b) => b.displayAmount - a.displayAmount);
            list.push({
                kind: 'month', key: `${year}-${month}`, year, month, rows,
                total: rows.reduce((s, r) => s + r.displayAmount, 0),
                pending: rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.estimatedAmount, 0),
            });
        });
        flushEmpty();
        return list;
    }, [months, rawMonthly, records]);

    // Newest month with data starts expanded; user toggles from there
    const [expandedMonth, setExpandedMonth] = useState<string | null | undefined>(undefined);
    const defaultExpanded = monthGroups.find(g => g.kind === 'month')?.key ?? null;
    const openMonthKey = expandedMonth === undefined ? defaultExpanded : expandedMonth;

    // Trend: total estimated cashback per month across all credit cards
    const trendData = useMemo(() => months.map(({ year, month, short }, i) => ({
        name: short,
        total: rawMonthly
            .filter(rm => rm.year === year && rm.month === month)
            .reduce((s, rm) => s + rm.estimatedAmount, 0),
        now: i === months.length - 1,
    })), [rawMonthly, months]);

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
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep transition-colors duration-200">
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
                            {fmt(totalReceived + totalPending + sharedCashbackTotal)}<span className="text-lg text-slate-400 font-medium ml-0.5">₫</span>
                        </p>
                        {sharedCashbackTotal > 0 && (
                            <p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold mt-1">
                                Gồm +{fmt(sharedCashbackTotal)}₫ từ thẻ chung
                            </p>
                        )}

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
                            {sharedCashbackTotal > 0 && (
                                <>
                                    <div className="w-px h-9 bg-slate-200 dark:bg-white/15" />
                                    <div className="flex-1 flex items-center gap-2.5">
                                        <UtilityIcon type="coins" size={32} tile />
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-medium">Thẻ chung</p>
                                            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmt(sharedCashbackTotal)}₫</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Insight: cards at their cap this month → where to move spending */}
                {insight && (
                    <div className="flex items-center gap-3 rounded-[20px] p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/25">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                            <UtilityIcon type="sparkles" size={18} tile={false} color="#8B5CF6" />
                        </div>
                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            <b className="text-slate-800 dark:text-white">{insight.cappedCount} thẻ</b> đã chạm trần hoàn tiền tháng {curMonth.month + 1}. Chuyển chi tiêu sang <b className="text-slate-800 dark:text-white">{insight.best.card.bankShortName || insight.best.card.bankName}</b>
                            {insight.best.remaining !== Infinity
                                ? <> — còn <b className="text-slate-800 dark:text-white">{fmtShort(insight.best.remaining)}</b> hạn mức hoàn {insight.best.card.cashbackRate}%.</>
                                : <> — hoàn {insight.best.card.cashbackRate}% không giới hạn.</>}
                        </p>
                    </div>
                )}

                {/* Trend chart — value labels on top, current month highlighted */}
                <div>
                    <div className="flex items-baseline gap-2 mb-2.5 px-1">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Xu hướng {MONTHS_WINDOW} tháng</h3>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">· đơn vị: nghìn đ</span>
                    </div>
                    <div className="bg-white dark:bg-surface rounded-[20px] p-4 border border-gray-100 dark:border-slate-700 shadow-sm">
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={trendData} margin={{ top: 22, right: 4, bottom: 0, left: 4 }}>
                                <defs>
                                    <linearGradient id="cbBarNow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0" stopColor="#6EE7B7" />
                                        <stop offset="1" stopColor="#10B981" />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} dy={4} />
                                <Tooltip
                                    content={<TrendTooltip />}
                                    cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                                />
                                <Bar dataKey="total" maxBarSize={44} minPointSize={6} shape={<TrendBarShape />}>
                                    <LabelList dataKey="total" content={renderBarLabel} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Per-card breakdown */}
                <div>
                    <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white px-1">
                            {viewTab === 'card' ? `Chi tiết tháng ${curMonth.month + 1}` : 'Chi tiết theo tháng'}
                        </h3>
                        <div className="bg-white dark:bg-surface border border-gray-100 dark:border-slate-700 p-1 rounded-full flex gap-1 shadow-sm">
                            <button
                                onClick={() => setViewTab('month')}
                                className={cn(
                                    'px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all',
                                    viewTab === 'month' ? 'bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/25' : 'text-slate-500 dark:text-slate-400'
                                )}
                            >
                                Theo tháng
                            </button>
                            <button
                                onClick={() => setViewTab('card')}
                                className={cn(
                                    'px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all',
                                    viewTab === 'card' ? 'bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/25' : 'text-slate-500 dark:text-slate-400'
                                )}
                            >
                                Theo thẻ
                            </button>
                        </div>
                    </div>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-200 dark:bg-surface animate-pulse" />)}
                        </div>
                    ) : viewTab === 'card' ? (
                        currentMonthCards.length === 0 && sharedCashback.length === 0 ? (
                            <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 p-6 text-center">
                                <p className="text-sm text-slate-400">Chưa có hoàn tiền trong tháng {curMonth.month + 1}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {currentMonthCards.map(({ card, estimatedAmount, displayAmount, status, capped }) => {
                                    const key = `${card._id}-${curMonth.year}-${curMonth.month}`;
                                    const logoUrl = getCardLogo(card);
                                    const cap = card.cashbackCap || 0;
                                    const pct = cap > 0 ? Math.min(100, (estimatedAmount / cap) * 100) : 0;
                                    return (
                                        <div key={card._id} className="rounded-[20px] bg-white dark:bg-surface border border-gray-100 dark:border-slate-700 shadow-sm p-4">
                                            <div className="flex items-start gap-3">
                                                {logoUrl ? (
                                                    <Image src={logoUrl} width={48} height={48} alt={card.bankShortName}
                                                        className="w-12 h-12 rounded-2xl object-contain bg-white p-1.5 border border-gray-100 dark:border-slate-700 flex-shrink-0" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                                        <ActionIcon type="creditCard" size={20} tile={false} color="#6366F1" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[15px] font-bold text-slate-800 dark:text-white truncate">{card.bankName} •••• {card.cardNumber}</p>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                        Hoàn {card.cashbackRate}%{cap > 0 ? ` · trần ${fmtShort(cap)}/tháng` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                    <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{fmt(displayAmount)}đ</span>
                                                    <button
                                                        onClick={() => handleToggleStatus(card._id, curMonth.year, curMonth.month, status, estimatedAmount)}
                                                        disabled={updatingKey === key}
                                                        className={cn(
                                                            'text-[10px] font-bold px-2.5 py-1 rounded-full transition-all active:scale-95 disabled:opacity-50',
                                                            status === 'received'
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                                        )}
                                                    >
                                                        {status === 'received' ? 'Đã nhận' : 'Chờ nhận'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Progress toward this month's cap */}
                                            {cap > 0 && (
                                                <div className="mt-3.5 flex items-center gap-3">
                                                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700/70 overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-500"
                                                            style={{
                                                                width: `${pct}%`,
                                                                background: capped
                                                                    ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                                                                    : 'linear-gradient(90deg, #34D399, #10B981)',
                                                            }} />
                                                    </div>
                                                    {capped ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 dark:text-amber-400 flex-shrink-0">
                                                            Đã chạm trần
                                                            <ActionIcon type="lock" size={12} tile={false} color="#F59E0B" />
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 tabular-nums flex-shrink-0">
                                                            {fmtShort(estimatedAmount)} / {fmtShort(cap)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {sharedCashback.filter(c => c.cashbackEarned > 0).map(sc => {
                                    const owner = sharedCards.find(x => x.card._id === sc.cardId)?.owner;
                                    return (
                                        <div key={sc.cardId} className="rounded-[20px] bg-white dark:bg-surface border border-indigo-100 dark:border-indigo-500/25 shadow-sm p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                                    <ActionIcon type="creditCard" size={20} tile={false} color="#6366F1" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[15px] font-bold text-slate-800 dark:text-white truncate">{sc.bankName}</p>
                                                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                                                        Thẻ chung{owner ? ` · của ${owner.name}` : ''}{sc.capped ? ' · đã chạm trần' : ''}
                                                    </p>
                                                </div>
                                                <span className="text-[15px] font-bold text-indigo-600 dark:text-indigo-400 tabular-nums flex-shrink-0">+{fmt(sc.cashbackEarned)}đ</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    ) : monthGroups.every(g => g.kind === 'empty') ? (
                        <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 p-6 text-center">
                            <p className="text-sm text-slate-400">Chưa có dữ liệu hoàn tiền</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {monthGroups.map(group => {
                                if (group.kind === 'empty') {
                                    // Quiet range row for months with no cashback: "Th2 – Th6, 2026"
                                    const asc = [...group.months].reverse();
                                    const first = asc[0], last = asc[asc.length - 1];
                                    const sameYear = first.year === last.year;
                                    const title = asc.length === 1
                                        ? `Th${first.month + 1}, ${first.year}`
                                        : sameYear
                                            ? `Th${first.month + 1} – Th${last.month + 1}, ${first.year}`
                                            : `Th${first.month + 1}/${first.year} – Th${last.month + 1}/${last.year}`;
                                    const tileNum = asc.length === 1 ? `${first.month + 1}` : `${first.month + 1}–${last.month + 1}`;
                                    return (
                                        <div key={group.key} className="flex items-center gap-3.5 p-3.5 rounded-[20px] bg-white/70 dark:bg-surface/50 border border-gray-100 dark:border-slate-700/60 opacity-75">
                                            <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 bg-slate-100 dark:bg-surface border border-slate-200/70 dark:border-slate-700">
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-none">Thg</span>
                                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-tight whitespace-nowrap">{tileNum}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[15px] font-bold text-slate-500 dark:text-slate-300">{title}</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Không phát sinh hoàn tiền</p>
                                            </div>
                                            <span className="text-[15px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">0đ</span>
                                        </div>
                                    );
                                }

                                const isOpen = openMonthKey === group.key;
                                return (
                                    <div key={group.key} className={cn(
                                        'rounded-[20px] bg-white dark:bg-surface border shadow-sm overflow-hidden transition-all',
                                        isOpen ? 'border-emerald-200/70 dark:border-slate-600/60' : 'border-gray-100 dark:border-slate-700'
                                    )}>
                                        {/* Month header — whole row toggles */}
                                        <button
                                            onClick={() => setExpandedMonth(isOpen ? null : group.key)}
                                            className="w-full text-left flex items-center gap-3.5 p-3.5"
                                        >
                                            <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200/70 dark:border-emerald-500/25">
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-300/70 leading-none">Thg</span>
                                                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-tight">{group.month + 1}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[15px] font-bold text-slate-800 dark:text-white">Tháng {group.month + 1}, {group.year}</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{group.rows.length} thẻ phát sinh hoàn tiền</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{fmt(group.total)}đ</span>
                                                {group.pending > 0 ? (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                                                        Chờ nhận {fmtShort(group.pending)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                                                        Đã nhận đủ
                                                    </span>
                                                )}
                                            </div>
                                            <ActionIcon type="chevronDown" size={14} tile={false} color="#94A3B8"
                                                className={cn('transition-transform duration-200 flex-shrink-0', !isOpen && '-rotate-90')} />
                                        </button>

                                        {/* Card rows for the month */}
                                        {isOpen && (
                                            <div className="border-t border-gray-100 dark:border-slate-700/60 divide-y divide-gray-50 dark:divide-slate-700/40">
                                                {group.rows.map(row => {
                                                    const key = `${row.card._id}-${group.year}-${group.month}`;
                                                    const logoUrl = getCardLogo(row.card);
                                                    return (
                                                        <div key={key} className="flex items-center gap-3 px-4 py-3">
                                                            {logoUrl ? (
                                                                <Image src={logoUrl} width={40} height={40} alt={row.card.bankShortName}
                                                                    className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-gray-100 dark:border-slate-700 flex-shrink-0" />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                                                    <ActionIcon type="creditCard" size={16} tile={false} color="#6366F1" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{row.card.bankName} •••• {row.card.cardNumber}</p>
                                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                                    Hoàn {row.card.cashbackRate}%{row.capped ? ' · chạm trần' : ''}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{fmt(row.displayAmount)}đ</span>
                                                                <button
                                                                    onClick={() => handleToggleStatus(row.card._id, group.year, group.month, row.status, row.estimatedAmount)}
                                                                    disabled={updatingKey === key}
                                                                    className={cn(
                                                                        'text-[10px] font-bold px-2.5 py-1 rounded-full transition-all active:scale-95 disabled:opacity-50',
                                                                        row.status === 'received'
                                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                                                    )}
                                                                >
                                                                    {row.status === 'received' ? 'Đã nhận' : 'Chờ nhận'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* All cards — complete roster with this month's cashback (own + shared) */}
                {allCardsCashback.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2.5 px-1">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Tất cả thẻ hoàn tiền</h3>
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Tháng {curMonth.month + 1}</span>
                        </div>
                        <div className="bg-white dark:bg-surface rounded-[20px] border border-gray-100 dark:border-slate-700 shadow-sm divide-y divide-gray-50 dark:divide-slate-700/40 overflow-hidden">
                            {allCardsCashback.map(c => (
                                <div key={c.key} className="flex items-center gap-3 px-4 py-3">
                                    {c.logo ? (
                                        <Image src={c.logo} width={40} height={40} alt={c.name}
                                            className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-gray-100 dark:border-slate-700 flex-shrink-0" />
                                    ) : (
                                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', c.shared ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-slate-800')}>
                                            <ActionIcon type="creditCard" size={16} tile={false} color={c.shared ? '#6366F1' : '#94A3B8'} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{c.name}</p>
                                        <p className={cn('text-xs mt-0.5 truncate', c.shared ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500')}>{c.sub}</p>
                                    </div>
                                    <span className={cn('text-sm font-bold tabular-nums flex-shrink-0',
                                        c.amount > 0 ? (c.shared ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400') : 'text-slate-300 dark:text-slate-600')}>
                                        {c.amount > 0 ? `+${fmt(c.amount)}đ` : '0đ'}
                                    </span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 dark:bg-white/[0.03]">
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-300">Tổng cộng</span>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{fmt(allCardsCashbackTotal)}đ</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
