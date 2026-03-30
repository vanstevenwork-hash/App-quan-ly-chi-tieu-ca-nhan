'use client';
import { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, TrendingUp, TrendingDown, PieChartIcon, X, ImageIcon } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { useUIStore } from '@/store/useStore';
import { useDayNotes } from '@/hooks/useDayNotes';
import { uploadApi } from '@/lib/api';
import AddTransactionModal from '@/components/AddTransactionModal';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import { CATEGORIES } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingDate, setUploadingDate] = useState<string | null>(null);

    const { isAddModalOpen, openAddModal, closeAddModal } = useUIStore();
    const { transactions, summary, refetch, deleteTransaction } = useTransactions();
    const { notesByDate, addImage, removeImage, refetch: refetchNotes } = useDayNotes(viewDate.month, viewDate.year);

    /* ── Calendar grid helpers ── */
    const firstDay = new Date(viewDate.year, viewDate.month, 1);
    const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
    const startOffset = getMonOffset(firstDay.getDay()); // 0 = Mon, ..., 6 = Sun

    /* ── Build per-day aggregation ── */
    const txByDay = useMemo(() => {
        const map: Record<number, { expense: number; income: number; txs: any[] }> = {};
        transactions.forEach(t => {
            const d = new Date(t.date);
            if (d.getMonth() === viewDate.month && d.getFullYear() === viewDate.year) {
                const day = d.getDate();
                if (!map[day]) map[day] = { expense: 0, income: 0, txs: [] };
                if (t.type === 'expense') map[day].expense += t.amount;
                if (t.type === 'income') map[day].income += t.amount;
                map[day].txs.push(t);
            }
        });
        return map;
    }, [transactions, viewDate]);

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

    // Handle + tap on empty day -> show action sheet
    const handleDayPlus = (day: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedDay(day);
        setActionDay(day);
    };

    // Upload image for a day
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingDate) return;
        e.target.value = '';
        try {
            toast.loading('Đang upload ảnh...');
            const { url } = await uploadApi.uploadImage(file, 'chi_tieu/calendar');
            await addImage(uploadingDate, url);
            toast.dismiss();
            toast.success('Đã thêm ảnh!');
        } catch {
            toast.dismiss();
            toast.error('Upload thất bại');
        } finally {
            setUploadingDate(null);
            setActionDay(null);
        }
    };

    const triggerImageUpload = (dateStr: string) => {
        setUploadingDate(dateStr);
        setActionDay(null);
        fileInputRef.current?.click();
    };

    return (
        <div className="min-h-screen bg-[#F8F9FF] dark:bg-slate-900 pb-32">
            {/* Hidden file input for image upload */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {/* ── Header ── */}
            <header className="px-6 py-5 flex justify-between items-center">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">LỊCH GIAO DỊCH</p>
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                        {MONTHS[viewDate.month]}, {viewDate.year}
                    </h2>
                </div>
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
            </header>

            <main className="px-6 space-y-8">
                {/* ── Summary Card: Tonal Layering ── */}
                <section className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-[0_32px_32px_-4px_rgba(98,69,208,0.08)] border border-slate-50 dark:border-slate-700/50">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-on-surface/40 dark:text-slate-500">Tổng quan tháng {viewDate.month + 1}</h2>
                        <span className="w-5 h-5 flex items-center justify-center text-on-surface/20 dark:text-slate-600">
                            <ImageIcon className="w-4 h-4 opacity-0" /> {/* Placeholder for material symbol */}
                            <ChevronRight className="w-4 h-4 opacity-20 rotate-90" />
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-1 border-r border-slate-100 dark:border-slate-700">
                            <p className="text-xs font-medium text-on-surface/60 dark:text-slate-400">Chi (Expenses)</p>
                            <p className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                                {fmtFull(monthSummary.expense)}đ
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-on-surface/60 dark:text-slate-400">Thu (Income)</p>
                            <p className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                                {fmtFull(monthSummary.income)}đ
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

                            const dayData = txByDay[day];
                            const hasTx = !!dayData;
                            const expense = dayData?.expense || 0;
                            const income = dayData?.income || 0;
                            const isSelected = selectedDay === day;
                            const isSunday = (i + 1) % 7 === 0;
                            const today = isToday(day);

                            // For filtered view: decide what balance to show
                            const showExpense = (filterType === 'all' || filterType === 'expense') && expense > 0;
                            const showIncome = (filterType === 'all' || filterType === 'income') && income > 0;

                            const dayNote = notesByDate[dayToDateStr(day)];
                            const dayImages = dayNote?.images || [];

                            return (
                                <button
                                    key={day}
                                    onClick={() => { setSelectedDay(day); setActionDay(null); }}
                                    className={cn(
                                        'h-24 p-2 flex flex-col transition-all active:scale-95 group/day outline-none focus:outline-none relative w-full text-left',
                                        isSelected
                                            ? 'bg-white dark:bg-slate-900 border-2 border-primary/20 z-10 shadow-lg rounded-md scale-[1.02]'
                                            : 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                                    )}
                                >
                                    {/* Day number - Top Left */}
                                    <span className={cn(
                                        'text-xs transition-all block',
                                        isSelected ? 'font-extrabold text-primary' : 'font-bold text-on-surface/40',
                                        !isSelected && today ? 'font-extrabold text-primary' : ''
                                    )}>
                                        {day}
                                    </span>

                                    {/* Day content area - Centered */}
                                    <div className="flex-1 w-full flex flex-col justify-center items-center gap-1">
                                        {/* Image thumbnails */}
                                        {dayImages.length > 0 && (
                                            <div className="flex flex-wrap gap-0.5 justify-center mb-0.5">
                                                {dayImages.slice(0, 2).map((url, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={url}
                                                        alt=""
                                                        className="w-5 h-5 rounded-full object-cover shadow-sm flex-shrink-0"
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* Transaction amounts */}
                                        {showExpense && (
                                            <div className="text-[9px] font-bold text-primary truncate px-1 bg-secondary-container dark:bg-primary-container/20 rounded-sm w-fit mx-auto leading-tight">
                                                -{fmt(expense)}k
                                            </div>
                                        )}
                                        {showIncome && (
                                            <div className="text-[9px] font-bold text-emerald-600 truncate px-1 bg-emerald-50 dark:bg-emerald-900/10 rounded-sm w-fit mx-auto leading-tight">
                                                +{fmt(income)}k
                                            </div>
                                        )}

                                        {/* + button centered */}
                                        {!hasTx && dayImages.length === 0 && (
                                            <div className="flex justify-center items-center">
                                                <div
                                                    className="w-6 h-6 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary hover:bg-primary hover:text-on-primary transition-all shadow-sm"
                                                    onClick={(e) => handleDayPlus(day, e)}
                                                >
                                                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                                                </div>
                                            </div>
                                        )}

                                        {/* Extra indicator for hidden items */}
                                        {dayImages.length > 2 && (
                                            <span className="text-[7px] font-bold text-slate-400">+{dayImages.length - 2} ảnh</span>
                                        )}
                                    </div>
                                </button>
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
                                {txByDay[selectedDay] && (
                                    <span className="ml-2 text-[10px] font-semibold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
                                        {txByDay[selectedDay].txs.length} giao dịch
                                    </span>
                                )}
                            </h3>
                            <button
                                onClick={() => openAddModal()}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors active:scale-95"
                            >
                                <Plus className="w-3 h-3" />
                                Thêm
                            </button>
                        </div>

                        {/* Images section for selected day */}
                        {(() => {
                            const dateStr = selectedDay ? dayToDateStr(selectedDay) : '';
                            const imgs = notesByDate[dateStr]?.images || [];
                            return (
                                <div className="space-y-2">
                                    {imgs.length > 0 && (
                                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-gray-100 dark:border-slate-700 shadow-sm">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Ảnh ngày này</p>
                                            <div className="flex flex-wrap gap-2">
                                                {imgs.map((url, idx) => (
                                                    <div key={idx} className="relative group/img">
                                                        <img
                                                            src={url}
                                                            alt=""
                                                            onClick={() => setLightboxImg(url)}
                                                            className="w-16 h-16 rounded-xl object-cover cursor-pointer hover:scale-105 transition-transform shadow-sm"
                                                        />
                                                        <button
                                                            onClick={() => removeImage(dateStr, url)}
                                                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group/img:opacity-100 hover:bg-red-600 transition-all shadow"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {/* Add more images */}
                                                <button
                                                    onClick={() => triggerImageUpload(dateStr)}
                                                    className="w-16 h-16 rounded-xl border-2 border-dashed border-purple-200 dark:border-purple-900/40 flex items-center justify-center text-purple-400 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                                                >
                                                    <Plus className="w-5 h-5" />
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
                                    const cat = CATEGORIES.find(c => c.label === t.category) || CATEGORIES[CATEGORIES.length - 1];
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
                        href="/budget"
                        className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-2xl space-y-3 border border-violet-100 dark:border-violet-900/30 hover:border-violet-200 active:scale-95 transition-all"
                    >
                        <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                            <PieChartIcon className="w-5 h-5 text-purple-500" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Ngân sách</p>
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
            {actionDay !== null && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                        onClick={() => setActionDay(null)}
                    />
                    <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center animate-in slide-in-from-bottom duration-300">
                        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
                            {/* Handle */}
                            <button className="flex h-5 w-full items-center justify-center shrink-0 pt-2 pb-1 bg-white dark:bg-slate-900 z-10" onClick={() => setActionDay(null)}>
                                <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                            </button>

                            {/* Header */}
                            <div className="flex items-center px-4 pb-2 shrink-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                                <h2 className="text-xl font-bold flex-1 text-center text-[#000000] dark:text-white">
                                    Ngày {actionDay}/{viewDate.month + 1}/{viewDate.year}
                                </h2>
                            </div>

                            <div className="p-6 pb-24 grid grid-cols-2 gap-4">
                                <button
                                    onClick={(e) => { setActionDay(null); openModalForDay(actionDay, e as any); }}
                                    className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all active:scale-95 border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-700"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                        <Plus className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Giao dịch</span>
                                </button>
                                <button
                                    onClick={() => triggerImageUpload(dayToDateStr(actionDay))}
                                    className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all active:scale-95 border-2 border-transparent hover:border-emerald-200 dark:hover:border-emerald-700"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                        <ImageIcon className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Ảnh / Ghi chú</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

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
        </div>
    );
}
