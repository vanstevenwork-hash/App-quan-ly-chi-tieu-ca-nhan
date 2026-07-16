'use client';
import { useState, useMemo, useCallback, useRef } from 'react';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { useTransactions } from '@/hooks/useTransactions';
import { useCards } from '@/hooks/useCards';
import { useUIStore } from '@/store/useStore';
import { useDayNotes } from '@/hooks/useDayNotes';
import { resolveCardId, getCappedCashbackTotal } from '@/lib/cashback';
import AddTransactionModal from '@/components/AddTransactionModal';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import DayCell from '@/components/calendar/DayCell';
import DayActionSheet from '@/components/calendar/DayActionSheet';
import ImageNoteUploadModal, { type ImageNoteUploadModalHandle } from '@/components/calendar/ImageNoteUploadModal';
import PageHeader from '@/components/PageHeader';
import { CATEGORIES, CATEGORIES_MAP } from '@/lib/mockData';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return `${n}`;
};
const fmtFull = (n: number) => n.toLocaleString('vi-VN');

// Get Monday-based week offset for a day-of-week (0=Sun → 6, 1=Mon → 0, ..., 6=Sat → 5)
function getMonOffset(dayOfWeek: number) {
    return (dayOfWeek + 6) % 7;
}

/* ── Donut Chart Component ── */
const DonutChart = ({ expensePct }: { expensePct: number }) => {
    const radius = 40;
    const strokeW = 9;
    const circumference = 2 * Math.PI * radius;
    const expenseLen = (expensePct / 100) * circumference;
    const incomeLen = circumference - expenseLen;
    const gap = 6;

    return (
        <div className="relative w-[100px] h-[100px] flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="expGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#EC4899" />
                        <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                    <linearGradient id="incGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#06B6D4" />
                        <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                </defs>
                {/* Background track */}
                <circle cx="50" cy="50" r={radius} fill="transparent" className="stroke-slate-200 dark:stroke-[#1E1B31]" strokeWidth={strokeW} />
                {/* Expense arc */}
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="url(#expGrad)" strokeWidth={strokeW}
                    strokeDasharray={`${Math.max(expenseLen - gap, 0)} ${circumference - Math.max(expenseLen - gap, 0)}`}
                    strokeLinecap="round" />
                {/* Income arc */}
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="url(#incGrad)" strokeWidth={strokeW}
                    strokeDasharray={`${Math.max(incomeLen - gap, 0)} ${circumference - Math.max(incomeLen - gap, 0)}`}
                    strokeDashoffset={`${-expenseLen}`}
                    strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[15px] font-black text-slate-800 dark:text-white leading-none">{expensePct.toFixed(0)}%</span>
                <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-400 mt-0.5">Chi tiêu</span>
            </div>
        </div>
    );
};

export default function CalendarPage() {
    const now = new Date();
    const [viewDate, setViewDate] = useState({ month: now.getMonth(), year: now.getFullYear() });
    const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
    const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
    const [selectedTx, setSelectedTx] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<any>(null);
    const [presetDate, setPresetDate] = useState<string | null>(null);
    const [actionDay, setActionDay] = useState<number | null>(null); // for action sheet
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);
    const imageUploadRef = useRef<ImageNoteUploadModalHandle>(null);

    const { isAddModalOpen, openAddModal, closeAddModal } = useUIStore();
    const { transactions, refetch, deleteTransaction } = useTransactions();
    const { cards } = useCards();
    const { notesByDate, addImage, removeImage, refetch: refetchNotes } = useDayNotes(viewDate.month, viewDate.year);

    const creditCards = useMemo(() => cards.filter(c => c.cardType === 'credit'), [cards]);

    /* ── Calendar grid helpers ── */
    const firstDay = new Date(viewDate.year, viewDate.month, 1);
    const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
    const startOffset = getMonOffset(firstDay.getDay()); // 0 = Mon, ..., 6 = Sun

    /* ── Build per-day aggregation (transactions + day-note images + totals), once per month/data change ── */
    const txByDay = useMemo(() => {
        const base: Record<number, { expense: number; income: number; txs: any[] }> = {};
        transactions.forEach(t => {
            const d = new Date(t.date);
            if (d.getMonth() === viewDate.month && d.getFullYear() === viewDate.year) {
                const day = d.getDate();
                if (!base[day]) base[day] = { expense: 0, income: 0, txs: [] };
                if (t.type === 'expense') base[day].expense += t.amount;
                if (t.type === 'income') base[day].income += t.amount;
                base[day].txs.push(t);
            }
        });

        const map: Record<number, {
            expense: number; income: number; txs: any[]; hasTx: boolean;
            combinedImages: { url: string; amount: number }[]; totalExpense: number; totalIncome: number;
        }> = {};

        for (let day = 1; day <= daysInMonth; day++) {
            const entry = base[day];
            const expense = entry?.expense || 0;
            const income = entry?.income || 0;
            const txs = entry?.txs || [];

            const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayImages = notesByDate[dateStr]?.images || [];
            const txImages = txs.filter(t => t.receiptImage).map(t => ({ url: t.receiptImage, amount: 0 }));

            map[day] = {
                expense, income, txs, hasTx: !!entry,
                combinedImages: [...dayImages, ...txImages],
                totalExpense: expense + dayImages.reduce((sum, img) => sum + (img.amount > 0 ? img.amount : 0), 0),
                totalIncome: income + dayImages.reduce((sum, img) => sum + (img.amount < 0 ? Math.abs(img.amount) : 0), 0),
            };
        }
        return map;
    }, [transactions, viewDate, notesByDate, daysInMonth]);

    /* ── Cashback earned in a given month, across all credit cards ── */
    const getCashbackForMonth = useCallback((year: number, month: number) => {
        return creditCards.reduce((sum, card) => {
            const cardMonthTxs = transactions.filter(t => {
                if (t.type !== 'expense' || t.paymentMethod !== 'card' || resolveCardId(t) !== card._id) return false;
                const d = new Date(t.date);
                return d.getMonth() === month && d.getFullYear() === year;
            });
            return sum + getCappedCashbackTotal(cardMonthTxs, card.cashbackRate, card.cashbackCap, card.cashbackMinSpend);
        }, 0);
    }, [creditCards, transactions]);

    const monthCashback = useMemo(
        () => getCashbackForMonth(viewDate.year, viewDate.month),
        [getCashbackForMonth, viewDate]
    );

    /* ── Month summary (income includes cashback earned this month) ── */
    const monthSummary = useMemo(() => {
        let income = 0, expense = 0;
        Object.values(txByDay).forEach(d => { income += d.income; expense += d.expense; });
        return { income: income + monthCashback, expense };
    }, [txByDay, monthCashback]);

    /* ── Previous month summary, for the real "so với tháng trước" % change ── */
    const prevMonthSummary = useMemo(() => {
        const prevMonth = viewDate.month === 0 ? 11 : viewDate.month - 1;
        const prevYear = viewDate.month === 0 ? viewDate.year - 1 : viewDate.year;
        let income = 0, expense = 0;
        transactions.forEach(t => {
            const d = new Date(t.date);
            if (d.getMonth() !== prevMonth || d.getFullYear() !== prevYear) return;
            if (t.type === 'expense') expense += t.amount;
            if (t.type === 'income') income += t.amount;
        });
        return { income: income + getCashbackForMonth(prevYear, prevMonth), expense };
    }, [transactions, viewDate, getCashbackForMonth]);

    // % change vs previous month — null when there's no prior data to compare against
    // (avoids a misleading "+100%" the very first month a card/account is used).
    const pctChange = (current: number, previous: number): number | null => {
        if (previous <= 0) return current > 0 ? null : 0;
        return ((current - previous) / previous) * 100;
    };
    const expenseChangePct = pctChange(monthSummary.expense, prevMonthSummary.expense);
    const incomeChangePct = pctChange(monthSummary.income, prevMonthSummary.income);

    /* ── Selected day transactions ── */
    const selectedDayTxs = useMemo(() => {
        if (!selectedDay) return [];
        const dayData = txByDay[selectedDay]?.txs || [];
        return filterType === 'all' ? dayData : dayData.filter(t => t.type === filterType);
    }, [selectedDay, txByDay, filterType]);

    const prevMonth = () => setViewDate(v => {
        const m = v.month === 0 ? 11 : v.month - 1;
        const y = v.month === 0 ? v.year - 1 : v.year;
        return { month: m, year: y };
    });
    const nextMonth = () => setViewDate(v => {
        const m = v.month === 11 ? 0 : v.month + 1;
        const y = v.month === 11 ? v.year + 1 : v.year;
        return { month: m, year: y };
    });

    const isToday = (day: number) =>
        day === now.getDate() && viewDate.month === now.getMonth() && viewDate.year === now.getFullYear();

    /* ── Grid cells ── */
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const cells: (number | null)[] = Array.from({ length: totalCells }, (_, i) => {
        const d = i - startOffset + 1;
        return d >= 1 && d <= daysInMonth ? d : null;
    });

    const handleDeleteTx = async (id: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) {
            await deleteTransaction(id);
            setIsDetailOpen(false);
            setSelectedTx(null);
            refetch();
        }
    };

    // Open modal with a specific day pre-filled
    const openModalForDay = (day: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setPresetDate(dateStr);
        setSelectedDay(day);
        openAddModal();
    };

    // Day string helper
    const dayToDateStr = (day: number) =>
        `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Tap a day cell -> select it and close any open action sheet
    const handleSelectDay = useCallback((day: number) => {
        setSelectedDay(day);
        setActionDay(null);
    }, []);

    // Handle + tap on empty day -> show action sheet
    const handleDayPlus = useCallback((day: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedDay(day);
        setActionDay(day);
    }, []);

    const triggerImageUpload = (dateStr: string) => {
        setActionDay(null);
        imageUploadRef.current?.open(dateStr);
    };

    return (
        <div className="min-h-screen bg-[#F8F9FF] dark:bg-surface-deep pb-32">
            {/* ── Header ── */}
            <PageHeader
                title={`${MONTHS[viewDate.month]}, ${viewDate.year}`}
                subtitle="LỊCH GIAO DỊCH"
                backHref="/dashboard"
                rightActions={
                    <div className="flex gap-2">
                        <button
                            onClick={prevMonth}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-surface/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ActionIcon type="chevronLeft" size={20} tile={false} color="#6B7280" />
                        </button>
                        <button
                            onClick={nextMonth}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-surface/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ActionIcon type="chevronRight" size={20} tile={false} color="#6B7280" />
                        </button>
                    </div>
                }
            />

            <main className="px-5 space-y-5">
                {/* ── Summary Card: white in light mode, dark gradient + Donut in dark mode ── */}
                <section className="bg-white dark:bg-gradient-to-br dark:from-[#1A1730] dark:via-[#161328] dark:to-[#121020] rounded-[20px] p-5 shadow-sm dark:shadow-2xl border border-gray-100 dark:border-slate-700/40 relative overflow-hidden">
                    {/* Subtle glow — dark mode only */}
                    <div className="hidden dark:block absolute -top-20 -right-20 w-52 h-52 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="hidden dark:block absolute -bottom-16 -left-16 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

                    {/* <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400 mb-4 relative z-10">Tổng quan tháng {viewDate.month + 1}</p> */}

                    <div className="flex items-center justify-between relative z-10">
                        {/* Left: Chi tiêu */}
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center border border-red-100 dark:border-red-900/30 shrink-0">
                                    <UtilityIcon type="trendingDown" size={14} tile={false} color="#EF4444" />
                                </div>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">Chi tiêu</p>
                            </div>
                            <p className="text-[18px] font-black text-slate-800 dark:text-white tracking-tight leading-tight">đ{fmtFull(monthSummary.expense)}</p>
                            {expenseChangePct !== null ? (
                                <span className={cn(
                                    'inline-flex items-center gap-0.5 text-[10px] font-bold mt-1',
                                    expenseChangePct <= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                                )}>
                                    {expenseChangePct <= 0 ? <UtilityIcon type="trendingDown" size={10} tile={false} color="#10B981" /> : <UtilityIcon type="trendingUp" size={10} tile={false} color="#EF4444" />}
                                    {Math.abs(expenseChangePct).toFixed(1)}%
                                </span>
                            ) : (
                                <span className="inline-block text-[10px] font-bold text-slate-300 dark:text-slate-600 mt-1">Chưa có dữ liệu</span>
                            )}
                        </div>

                        {/* Center: Donut */}
                        <div className="mx-2 shrink-0">
                            <DonutChart expensePct={
                                monthSummary.expense + monthSummary.income > 0
                                    ? Math.round((monthSummary.expense / (monthSummary.expense + monthSummary.income)) * 100)
                                    : 0
                            } />
                        </div>

                        {/* Right: Thu nhập */}
                        <div className="flex-1 text-right">
                            <div className="flex items-center justify-end gap-2 mb-1.5">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">Thu nhập</p>
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-[#1A2A2D] flex items-center justify-center border border-emerald-100 dark:border-[#243A3E] shrink-0">
                                    <UtilityIcon type="wallet" size={14} tile={false} color="#10B981" />
                                </div>
                            </div>
                            <p className="text-[18px] font-black text-slate-800 dark:text-white tracking-tight leading-tight">đ{fmtFull(monthSummary.income)}</p>
                            {incomeChangePct !== null ? (
                                <span className={cn(
                                    'inline-flex items-center gap-0.5 text-[10px] font-bold mt-1',
                                    incomeChangePct >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                                )}>
                                    {incomeChangePct >= 0 ? <UtilityIcon type="trendingUp" size={10} tile={false} color="#10B981" /> : <UtilityIcon type="trendingDown" size={10} tile={false} color="#EF4444" />}
                                    {Math.abs(incomeChangePct).toFixed(1)}%
                                </span>
                            ) : (
                                <span className="inline-block text-[10px] font-bold text-slate-300 dark:text-slate-600 mt-1">Chưa có dữ liệu</span>
                            )}
                            {monthCashback > 0 && (
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1 whitespace-nowrap">gồm {fmt(monthCashback)}đ hoàn tiền</p>
                            )}
                        </div>
                    </div>
                </section>

                {/* ── Filter Tabs ── */}
                <div className="bg-slate-100 dark:bg-surface p-1 rounded-xl flex gap-1">
                    {(['all', 'expense', 'income'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterType(f)}
                            className={cn(
                                'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                                filterType === f
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            )}
                        >
                            {f === 'all' ? 'Tất cả' : f === 'expense' ? 'Wallet' : 'Bank'}
                        </button>
                    ))}
                </div>

                {/* ── Calendar Grid ── */}
                <div className="bg-white dark:bg-surface-deep rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="grid grid-cols-7">
                        {/* Day headers */}
                        {DAYS.map((d, i) => (
                            <div key={d} className={cn(
                                'py-3 text-center text-[10px] font-extrabold uppercase tracking-tighter bg-white dark:bg-surface-deep',
                                i === 6 ? 'text-red-400' : 'text-slate-400'
                            )}>
                                {d}
                            </div>
                        ))}

                        {/* Day cells */}
                        {cells.map((day, i) => {
                            if (!day) {
                                return <div key={`empty-${i}`} className="h-20 p-1.5 bg-white dark:bg-surface-deep opacity-20" />;
                            }
                            return (
                                <DayCell
                                    key={day}
                                    day={day}
                                    dayData={txByDay[day]}
                                    isSelected={selectedDay === day}
                                    isToday={isToday(day)}
                                    filterType={filterType}
                                    onSelect={handleSelectDay}
                                    onPlus={handleDayPlus}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* ── Selected Day Panel ── */}
                {selectedDay && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                Ngày {selectedDay}/{viewDate.month + 1}/{viewDate.year}
                                {txByDay[selectedDay]?.hasTx && (
                                    <span className="text-[10px] font-semibold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                        {txByDay[selectedDay].txs.length} giao dịch
                                    </span>
                                )}
                            </h3>
                            <div className="flex gap-2 flex-shrink-0">
                                <button
                                    onClick={() => triggerImageUpload(dayToDateStr(selectedDay))}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors active:scale-95 whitespace-nowrap"
                                >
                                    <ActionIcon type="image" size={12} tile={false} color="currentColor" />
                                    Thêm ảnh
                                </button>
                                <button
                                    onClick={() => openAddModal()}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors active:scale-95 whitespace-nowrap"
                                >
                                    <ActionIcon type="plus" size={12} tile={false} color="currentColor" />
                                    Giao dịch
                                </button>
                            </div>
                        </div>

                        {/* Images section for selected day */}
                        {(() => {
                            const dateStr = selectedDay ? dayToDateStr(selectedDay) : '';
                            const imgs = notesByDate[dateStr]?.images || [];
                            return (
                                <div className="space-y-2">
                                    {imgs.length > 0 && (
                                        <div className="bg-white dark:bg-surface rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-sm">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">ẢNH NGÀY NÀY</p>
                                            <div className="flex flex-wrap gap-3">
                                                {imgs.map((img) => {
                                                    const imgCat = img.label ? CATEGORIES_MAP.get(img.label) : null;
                                                    return (
                                                        <div key={img.url} className="relative group/img">
                                                            <img
                                                                src={img.url}
                                                                alt=""
                                                                onClick={() => setLightboxImg(img.url)}
                                                                className="w-16 h-16 rounded-xl object-cover cursor-pointer hover:scale-105 transition-transform shadow-md ring-1 ring-black/5"
                                                            />
                                                            {/* Category icon - bottom left */}
                                                            {imgCat && (
                                                                <div className="absolute -bottom-1.5 -left-1.5 w-7 h-7 rounded-full bg-white dark:bg-surface border-2 border-white dark:border-slate-800 shadow-md flex items-center justify-center z-10 overflow-hidden">
                                                                    <CategoryIcon
                                                                        type={imgCat.catIconType || 'khac'}
                                                                        size={28}
                                                                        tile={false}
                                                                    />
                                                                </div>
                                                            )}
                                                            {/* Amount badge - bottom right */}
                                                            {img.amount > 0 && (
                                                                <div className="absolute -bottom-1.5 -right-1.5 bg-slate-900 dark:bg-slate-700 px-1.5 py-0.5 rounded-sm shadow-lg z-10">
                                                                    <span className="text-[9px] font-black text-red-400">-{fmt(img.amount)}</span>
                                                                </div>
                                                            )}
                                                            {/* Delete button */}
                                                            <button
                                                                onClick={() => removeImage(dateStr, img.url)}
                                                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 hover:bg-red-600 transition-all shadow-lg z-20"
                                                            >
                                                                <ActionIcon type="x" size={12} tile={false} color="#FFFFFF" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                {/* Add more images */}
                                                <button
                                                    onClick={() => triggerImageUpload(dateStr)}
                                                    className="w-16 h-16  rounded-2xl border-2 border-dashed border-purple-300 dark:border-purple-800 flex items-center justify-center text-purple-400 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                                                >
                                                    <ActionIcon type="plus" size={24} tile={false} color="currentColor" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {selectedDayTxs.length === 0 ? (
                            <div className="bg-white dark:bg-surface rounded-2xl p-8 text-center border border-dashed border-slate-200 dark:border-slate-700">
                                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-2xl">
                                    📅
                                </div>
                                <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">
                                    {filterType !== 'all'
                                        ? `Không có giao dịch ${filterType === 'expense' ? 'chi tiêu' : 'thu nhập'} ngày này`
                                        : 'Chưa có giao dịch ngày này'}
                                </p>
                                <button
                                    onClick={() => openAddModal()}
                                    className="mt-3 text-xs font-bold text-purple-600 bg-purple-50 px-4 py-2 rounded-xl hover:bg-purple-100 transition-colors"
                                >
                                    + Thêm giao dịch
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm divide-y divide-slate-50 dark:divide-slate-700/50 overflow-hidden">
                                {selectedDayTxs.map((t: any) => {
                                    const cat = CATEGORIES_MAP.get(t.category) || CATEGORIES[CATEGORIES.length - 1];
                                    const isIncome = t.type === 'income';
                                    return (
                                        <button
                                            key={t._id}
                                            onClick={() => { setSelectedTx(t); setIsDetailOpen(true); }}
                                            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <CategoryIcon
                                                    type={cat.catIconType || 'khac'}
                                                    size={40}
                                                    tile
                                                    className="flex-shrink-0 group-hover:scale-105 transition-transform"
                                                />
                                                <div className="text-left">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{t.note || t.category}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{t.category}</p>
                                                </div>
                                            </div>
                                            <span className={cn(
                                                'text-sm font-extrabold flex-shrink-0',
                                                isIncome ? 'text-emerald-500' : 'text-red-500'
                                            )}>
                                                {isIncome ? '+' : '-'}{fmt(t.amount)}đ
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Insights Bento ── */}
                <section className="grid grid-cols-2 gap-3 pb-4">
                    <Link
                        href="/goals"
                        className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-2xl space-y-3 border border-violet-100 dark:border-violet-900/30 hover:border-violet-200 active:scale-95 transition-all"
                    >
                        <div className="w-9 h-9 bg-white dark:bg-surface rounded-xl flex items-center justify-center shadow-sm">
                            <UtilityIcon type="target" size={20} tile={false} color="#A78BFA" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Mục tiêu</p>
                        {monthSummary.expense > 0 && monthSummary.income > 0 ? (
                            <div className="space-y-1">
                                <div className="w-full bg-white dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-purple-500 h-full rounded-full transition-all duration-700"
                                        style={{ width: `${Math.min((monthSummary.expense / monthSummary.income) * 100, 100).toFixed(0)}%` }}
                                    />
                                </div>
                                <p className="text-[9px] font-semibold text-slate-400">
                                    {Math.min(Math.round((monthSummary.expense / monthSummary.income) * 100), 999)}% thu nhập đã chi
                                </p>
                            </div>
                        ) : monthSummary.expense > 0 ? (
                            <p className="text-[9px] text-slate-400">Chưa có thu nhập tháng này</p>
                        ) : (
                            <p className="text-[9px] text-slate-400">Chưa có chi tiêu</p>
                        )}
                    </Link>

                    <Link
                        href="/analytics"
                        className="bg-white dark:bg-surface p-4 rounded-2xl space-y-2 border border-gray-100 dark:border-slate-700 hover:border-emerald-200 active:scale-95 transition-all"
                    >
                        <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                            <UtilityIcon type="trendingUp" size={20} tile={false} color="#10B981" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Tiết kiệm tháng</p>
                        <p className="text-lg font-extrabold text-emerald-500">
                            {monthSummary.income > 0
                                ? `+${fmt(Math.max(monthSummary.income - monthSummary.expense, 0))}`
                                : '+0'}đ
                        </p>
                    </Link>
                </section>
            </main>

            {/* ── FAB ── */}
            <button
                onClick={() => openAddModal()}
                className="fixed bottom-28 right-5 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.4)] flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)' }}
            >
                <ActionIcon type="plus" size={28} tile={false} color="#FFFFFF" />
            </button>

            {/* ── Action Sheet (+ button tapped on a day) ── */}
            <DayActionSheet
                day={actionDay}
                dateLabel={actionDay !== null ? `${actionDay}/${viewDate.month + 1}/${viewDate.year}` : ''}
                dateStr={actionDay !== null ? dayToDateStr(actionDay) : ''}
                onClose={() => setActionDay(null)}
                onAddTransaction={(day, e) => { setActionDay(null); openModalForDay(day, e); }}
                onAddImage={triggerImageUpload}
            />

            {/* ── Lightbox ── */}
            {lightboxImg && (
                <div
                    className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightboxImg(null)}
                >
                    <button
                        onClick={() => setLightboxImg(null)}
                        className="absolute top-5 right-5 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                    >
                        <ActionIcon type="x" size={20} tile={false} color="#FFFFFF" />
                    </button>
                    <img
                        src={lightboxImg}
                        alt=""
                        className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
            <AddTransactionModal
                open={isAddModalOpen}
                onClose={() => { closeAddModal(); setEditingTx(null); setPresetDate(null); }}
                onSaved={refetch}
                defaultType="expense"
                initialData={editingTx || (presetDate ? { date: presetDate } : null)}
            />
            <TransactionDetailModal
                open={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                transaction={selectedTx}
                onEdit={(t) => { setIsDetailOpen(false); setEditingTx(t); openAddModal(); }}
                onDelete={handleDeleteTx}
            />

            {/* ── Image Upload Modal ── */}
            <ImageNoteUploadModal ref={imageUploadRef} addImage={addImage} />
        </div>
    );
}
