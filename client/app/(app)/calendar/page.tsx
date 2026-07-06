'use client';
import { useState, useMemo, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, TrendingUp, TrendingDown, X, ImageIcon, Target, Wallet } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { useUIStore } from '@/store/useStore';
import { useDayNotes } from '@/hooks/useDayNotes';
import AddTransactionModal from '@/components/AddTransactionModal';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import DayCell from '@/components/calendar/DayCell';
import DayActionSheet from '@/components/calendar/DayActionSheet';
import ImageNoteUploadModal, { type ImageNoteUploadModalHandle } from '@/components/calendar/ImageNoteUploadModal';
import PageHeader from '@/components/PageHeader';
import { CATEGORIES, CATEGORIES_MAP } from '@/lib/mockData';
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
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#1E1B31" strokeWidth={strokeW} />
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
                <span className="text-[15px] font-black text-white leading-none">{expensePct.toFixed(0)}%</span>
                <span className="text-[9px] font-semibold text-slate-400 mt-0.5">Chi tiêu</span>
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
    const { transactions, summary, refetch, deleteTransaction } = useTransactions();
    const { notesByDate, addImage, removeImage, refetch: refetchNotes } = useDayNotes(viewDate.month, viewDate.year);

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

    /* ── Month summary ── */
    const monthSummary = useMemo(() => {
        let income = 0, expense = 0;
        Object.values(txByDay).forEach(d => { income += d.income; expense += d.expense; });
        return { income, expense };
    }, [txByDay]);

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
        <div className="min-h-screen bg-[#F8F9FF] dark:bg-slate-900 pb-32">
            {/* ── Header ── */}
            <PageHeader
                title={`${MONTHS[viewDate.month]}, ${viewDate.year}`}
                subtitle="LỊCH GIAO DỊCH"
                showBackButton={false}
                rightActions={
                    <div className="flex gap-2">
                        <button
                            onClick={prevMonth}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-500" />
                        </button>
                        <button
                            onClick={nextMonth}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                }
            />

            <main className="px-6 space-y-8">
                {/* ── Summary Card: Dark Gradient + Donut ── */}
                <section className="bg-gradient-to-br from-[#1A1730] via-[#161328] to-[#121020] rounded-3xl p-5 shadow-2xl border border-slate-700/40 relative overflow-hidden">
                    {/* Subtle glow */}
                    <div className="absolute -top-20 -right-20 w-52 h-52 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 relative z-10">Tổng quan tháng {viewDate.month + 1}</p>

                    <div className="flex items-center justify-between relative z-10">
                        {/* Left: Chi tiêu */}
                        <div className="flex-1 space-y-1">
                            <p className="text-[11px] font-semibold text-slate-400">Chi tiêu</p>
                            <p className="text-[18px] font-black text-white tracking-tight leading-tight">đ{fmtFull(monthSummary.expense)}</p>
                            <p className="text-[9px] font-bold text-red-400 flex items-center gap-0.5 mt-1">
                                <TrendingDown className="w-3 h-3" /> 12.5% <span className="text-slate-500 font-medium">so với tháng {viewDate.month === 0 ? 12 : viewDate.month}</span>
                            </p>
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
                        <div className="flex-1 space-y-1 text-right">
                            <div className="flex items-center justify-end gap-2 mb-1">
                                <p className="text-[11px] font-semibold text-slate-400">Thu nhập</p>
                                <div className="w-7 h-7 rounded-lg bg-[#1A2A2D] flex items-center justify-center border border-[#243A3E]">
                                    <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                                </div>
                            </div>
                            <p className="text-[18px] font-black text-white tracking-tight leading-tight">đ{fmtFull(monthSummary.income)}</p>
                            <p className="text-[9px] font-bold text-emerald-400 flex items-center justify-end gap-0.5 mt-1">
                                <TrendingUp className="w-3 h-3" /> 8.4% <span className="text-slate-500 font-medium">so với tháng {viewDate.month === 0 ? 12 : viewDate.month}</span>
                            </p>
                        </div>
                    </div>
                </section>

                {/* ── Filter Tabs ── */}
                <div className="flex gap-3 overflow-x-auto hide-scrollbar py-2">
                    {(['all', 'expense', 'income'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterType(f)}
                            className={cn(
                                'px-6 py-2.5 rounded-full text-sm font-semibold transition-all flex-shrink-0',
                                filterType === f
                                    ? 'bg-primary text-white shadow-lg shadow-primary/10'
                                    : 'bg-slate-100 dark:bg-slate-800 text-on-surface/60 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            )}
                        >
                            {f === 'all' ? 'Tất cả' : f === 'expense' ? 'Wallet' : 'Bank'}
                        </button>
                    ))}
                </div>

                {/* ── Calendar Grid ── */}
                <div className="bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="grid grid-cols-7 gap-[1px]">
                        {/* Day headers */}
                        {DAYS.map((d, i) => (
                            <div key={d} className={cn(
                                'py-3 text-center text-[10px] font-extrabold uppercase tracking-tighter bg-white dark:bg-slate-950',
                                i === 6 ? 'text-red-400' : 'text-slate-400'
                            )}>
                                {d}
                            </div>
                        ))}

                        {/* Day cells */}
                        {cells.map((day, i) => {
                            if (!day) {
                                return <div key={`empty-${i}`} className="h-24 p-2 bg-white dark:bg-slate-950 opacity-20" />;
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
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                Ngày {selectedDay}/{viewDate.month + 1}/{viewDate.year}
                                {txByDay[selectedDay]?.hasTx && (
                                    <span className="ml-2 text-[10px] font-semibold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
                                        {txByDay[selectedDay].txs.length} giao dịch
                                    </span>
                                )}
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => triggerImageUpload(dayToDateStr(selectedDay))}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors active:scale-95"
                                >
                                    <ImageIcon className="w-3 h-3" />
                                    Thêm ảnh
                                </button>
                                <button
                                    onClick={() => openAddModal()}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors active:scale-95"
                                >
                                    <Plus className="w-3 h-3" />
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
                                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-sm">
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
                                                                <div className="absolute -bottom-1.5 -left-1.5 w-7 h-7 rounded-full bg-white dark:bg-slate-900 border-2 border-white dark:border-slate-800 shadow-md flex items-center justify-center text-sm z-10">
                                                                    {imgCat.icon}
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
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                {/* Add more images */}
                                                <button
                                                    onClick={() => triggerImageUpload(dateStr)}
                                                    className="w-16 h-16  rounded-2xl border-2 border-dashed border-purple-300 dark:border-purple-800 flex items-center justify-center text-purple-400 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                                                >
                                                    <Plus className="w-6 h-6" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {selectedDayTxs.length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-dashed border-slate-200 dark:border-slate-700">
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
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm divide-y divide-slate-50 dark:divide-slate-700/50 overflow-hidden">
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
                                                <div
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-105 transition-transform"
                                                    style={{ backgroundColor: `${cat.color}18` }}
                                                >
                                                    {cat.icon}
                                                </div>
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
                        <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                            <Target className="w-5 h-5 text-purple-500" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Mục tiêu</p>
                        {monthSummary.expense > 0 ? (
                            <div className="space-y-1">
                                <div className="w-full bg-white dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-purple-500 h-full rounded-full transition-all duration-700"
                                        style={{ width: `${Math.min((monthSummary.expense / (summary.income || 1)) * 100, 100).toFixed(0)}%` }}
                                    />
                                </div>
                                <p className="text-[9px] font-semibold text-slate-400">
                                    {((monthSummary.expense / (summary.income || 1)) * 100).toFixed(0)}% thu nhập đã chi
                                </p>
                            </div>
                        ) : (
                            <p className="text-[9px] text-slate-400">Chưa có chi tiêu</p>
                        )}
                    </Link>

                    <Link
                        href="/analytics"
                        className="bg-white dark:bg-slate-800 p-4 rounded-2xl space-y-2 border border-gray-100 dark:border-slate-700 hover:border-emerald-200 active:scale-95 transition-all"
                    >
                        <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
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
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
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
                        <X className="w-5 h-5" />
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
