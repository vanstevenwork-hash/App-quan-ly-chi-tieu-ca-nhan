'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { transactionsApi } from '@/lib/api';
import { CATEGORIES, CATEGORIES_MAP } from '@/lib/mockData';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { cn } from '@/lib/utils';
import AddTransactionModal from '@/components/AddTransactionModal';
import PageHeader from '@/components/PageHeader';
import { toast } from 'sonner';
import { exportTransactionsToCsv } from '@/lib/exportCsv';

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">{`${(percent * 100).toFixed(0)}%`}</text>;
};

const fmt = (n: number) => {
    const absRes = Math.abs(n);
    if (absRes >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (absRes >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (absRes >= 1_000) return `${(n / 1000).toFixed(0)}k`;
    return `${n}`;
};
const fmtFull = (n: number) => n.toLocaleString('vi-VN');

// ─── Custom Chart Dots ───────────────────────────────────────────────────
const createCustomDot = (color: string, dataKey: string) => {
    return (props: any) => {
        const { cx, cy, payload, index, data } = props;
        const val = payload[dataKey] || 0;
        // Show detail dot for the last point
        if (index === 13) {
            const valStr = Math.abs(val) >= 1_000_000
                ? `${(val / 1_000_000).toFixed(1).replace('.0', '')}tr`
                : `${val >= 1000 ? Math.round(val / 1000) + 'k' : val}`;
            const rectW = valStr.length > 3 ? 46 : 38;
            return (
                <g key={`dot-${index}-${dataKey}`}>
                    <circle cx={cx} cy={cy} r={12} fill={color} fillOpacity={0.15} />
                    <circle cx={cx} cy={cy} r={7} className="fill-white dark:fill-slate-900" />
                    <circle cx={cx} cy={cy} r={4.5} fill={color} />
                    <rect x={cx - rectW / 2} y={cy - 38} width={rectW} height={22} rx={10} fill={color} />
                    <text x={cx} y={cy - 27} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                        {valStr}
                    </text>
                </g>
            );
        }
        return (
            <circle key={`dot-${index}-${dataKey}`} cx={cx} cy={cy} r={4.5} className="fill-white dark:fill-slate-900" stroke={color} strokeWidth={2.5} />
        );
    };
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const income = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
        const expense = payload.find((p: any) => p.dataKey === 'expense')?.value || 0;
        const diff = income - expense;
        const isPositive = diff >= 0;

        return (
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 shadow-xl min-w-[200px] anim-scale-in">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{label}</p>
                <div className="space-y-2.5 mb-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-[#10B981]" />
                            <span className="text-xs font-medium text-slate-400">Thu nhập</span>
                        </div>
                        <span className="text-xs font-bold text-white">+{fmtFull(Math.abs(income))}đ</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-[#F43F5E]" />
                            <span className="text-xs font-medium text-slate-400">Chi tiêu</span>
                        </div>
                        <span className="text-xs font-bold text-white">-{fmtFull(Math.abs(expense))}đ</span>
                    </div>
                </div>
                <div className="pt-3 border-t border-white/5 border-slate-700/50 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                            isPositive ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
                        )}>
                            {isPositive ? <CustomIcon type="trendingUp" size={14} tile={false} color="#10B981" /> : <CustomIcon type="trendingDown" size={14} tile={false} color="#EF4444" />}
                        </div>
                        <span className={cn(
                            "text-sm font-black",
                            isPositive ? "text-emerald-500" : "text-rose-500"
                        )}>
                            {isPositive ? '+' : ''}{fmtFull(diff)}đ
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const PERIOD_TABS = ['Tháng này', 'Tuần này', 'Tháng trước', 'Tùy chỉnh'] as const;

const toISODate = (d: Date) => {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export default function AnalyticsPage() {
    const [periodTab, setPeriodTab] = useState<typeof PERIOD_TABS[number]>('Tháng này');
    const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingTx, setEditingTx] = useState<any>(null);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState(() => toISODate(new Date()));

    // Global store: only used for the always-recent 14-day trend chart and CRUD (create/update/delete).
    const { transactions: recentTransactions, deleteTransaction } = useTransactions();

    // Period-scoped data (summary/category-breakdown/list), fetched straight from the
    // backend's already-existing month/year-aware endpoints so each tab reflects its own period.
    const [periodTx, setPeriodTx] = useState<any[]>([]);
    const [summary, setSummary] = useState({ income: 0, expense: 0 });
    const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; total: number; color: string; catIconType: string }[]>([]);
    const [loading, setLoading] = useState(true);

    const paramsForPeriod = useCallback((): { month: number; year: number } | { startDate: string; endDate: string } | null => {
        const now = new Date();
        if (periodTab === 'Tùy chỉnh') {
            if (!customStart || !customEnd) return null;
            return { startDate: customStart, endDate: customEnd };
        }
        if (periodTab === 'Tháng trước') {
            return {
                month: now.getMonth() === 0 ? 12 : now.getMonth(),
                year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
            };
        }
        // 'Tháng này' and 'Tuần này' both scope to the current month; the week tab
        // narrows further client-side since the backend only filters by month/year.
        return { month: now.getMonth() + 1, year: now.getFullYear() };
    }, [periodTab, customStart, customEnd]);

    const fetchPeriodData = useCallback(async () => {
        const params = paramsForPeriod();
        if (!params) {
            setPeriodTx([]);
            setSummary({ income: 0, expense: 0 });
            setCategoryBreakdown([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [txRes, sumRes, catRes] = await Promise.all([
                transactionsApi.getAll({ ...params, limit: 1000 }),
                transactionsApi.getSummary(params),
                transactionsApi.getCategoryBreakdown({ ...params, type: 'expense' }),
            ]);
            let tx = txRes.data?.data || [];
            let sum = sumRes.data?.data || { income: 0, expense: 0 };
            let catBreakdown = (catRes.data?.data || []).map((c: any) => {
                const cfg = CATEGORIES_MAP.get(c.category);
                return { category: c.category, total: c.total, color: cfg?.color || '#6C63FF', catIconType: cfg?.catIconType || 'khac' };
            });

            if (periodTab === 'Tuần này') {
                const weekAgo = Date.now() - 6 * 86400000;
                tx = tx.filter((t: any) => new Date(t.date).getTime() >= weekAgo);
                const catMap: Record<string, number> = {};
                let income = 0, expense = 0;
                tx.forEach((t: any) => {
                    if (t.type === 'income') income += t.amount;
                    else { expense += t.amount; catMap[t.category] = (catMap[t.category] || 0) + t.amount; }
                });
                sum = { income, expense };
                catBreakdown = Object.entries(catMap)
                    .map(([category, total]) => {
                        const cfg = CATEGORIES_MAP.get(category);
                        return { category, total: total as number, color: cfg?.color || '#6C63FF', catIconType: cfg?.catIconType || 'khac' };
                    })
                    .sort((a, b) => b.total - a.total);
            }

            setPeriodTx(tx);
            setSummary({ income: sum.income || 0, expense: sum.expense || 0 });
            setCategoryBreakdown(catBreakdown);
        } catch {
            setPeriodTx([]);
            setSummary({ income: 0, expense: 0 });
            setCategoryBreakdown([]);
        } finally {
            setLoading(false);
        }
    }, [periodTab, paramsForPeriod]);

    useEffect(() => { fetchPeriodData(); }, [fetchPeriodData]);

    // Chart data — last 14 real calendar days, independent of the selected period tab
    const chartData = useMemo(() => {
        const days: Record<string, { income: number; expense: number }> = {};
        for (let i = 13; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            days[`${d.getDate()}/${d.getMonth() + 1}`] = { income: 0, expense: 0 };
        }
        recentTransactions.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getDate()}/${d.getMonth() + 1}`;
            if (key in days) days[key][t.type as 'income' | 'expense'] += t.amount;
        });
        return Object.entries(days).map(([name, v]) => ({ name, ...v }));
    }, [recentTransactions]);

    const filteredTx = useMemo(
        () => periodTx.filter(t => filterType === 'all' || t.type === filterType),
        [periodTx, filterType]
    );

    const handleExport = () => {
        if (filteredTx.length === 0) {
            toast.error('Không có giao dịch nào để xuất');
            return;
        }
        const periodLabel = periodTab === 'Tùy chỉnh'
            ? `${customStart}_den_${customEnd}`
            : periodTab.toLowerCase().replace(/\s+/g, '-');
        exportTransactionsToCsv(filteredTx, `giao-dich_${periodLabel}.csv`);
        toast.success(`Đã xuất ${filteredTx.length} giao dịch`);
    };

    // Last 6 months of income/expense, computed from the same globally-loaded
    // transaction list used for the 14-day trend chart — a real, side-by-side
    // "so với tháng trước" view instead of having to flip between period tabs.
    const monthlyHistory = useMemo(() => {
        const now = new Date();
        const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            return { year: d.getFullYear(), month: d.getMonth(), label: `Th${d.getMonth() + 1}/${d.getFullYear()}` };
        });
        return months.map(({ year, month, label }) => {
            let income = 0, expense = 0;
            recentTransactions.forEach(t => {
                const d = new Date(t.date);
                if (d.getFullYear() !== year || d.getMonth() !== month) return;
                if (t.type === 'income') income += t.amount;
                else expense += t.amount;
            });
            return { label, income, expense };
        });
    }, [recentTransactions]);

    const refetch = fetchPeriodData;

    const handleDelete = async (id: string) => {
        if (!confirm('Xoá giao dịch này?')) return;
        try {
            await deleteTransaction(id);
            await fetchPeriodData();
            toast.success('Đã xoá giao dịch');
        } catch { toast.error('Xoá thất bại'); }
    };

    const handleEdit = (t: any) => {
        setEditingTx(t);
        setShowAddModal(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8F9FF] dark:bg-surface-deep flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <p className="text-gray-400 dark:text-gray-500 font-medium text-sm">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8F9FF] dark:bg-surface-deep transition-colors duration-200">
            {/* Background blobs */}
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(224,195,252,0.2), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(139,92,246,0.05), transparent)' }} />

            {/* ── Sticky Header ─────────────────────────────────────── */}
            <PageHeader
                title="Báo cáo chi tiêu"
                subtitle="Thống kê"
                className="bg-[#F8F9FF]/80 dark:bg-surface-deep/80"
                zIndexClassName="z-30"
                rightActions={
                    <div className="flex items-center gap-2">
                        <button onClick={refetch}
                            className="w-10 h-10 rounded-full bg-white dark:bg-surface border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 active:scale-95 transition-all flex-shrink-0">
                            <CustomIcon type="refreshCw" size={16} tile={false} color="currentColor" />
                        </button>
                        <button onClick={() => setShowAddModal(true)}
                            className="w-10 h-10 rounded-full gradient-primary text-white shadow-lg shadow-purple-500/20 flex items-center justify-center active:scale-95 transition-all">
                            <CustomIcon type="plus" size={20} tile={false} color="currentColor" />
                        </button>
                    </div>
                }
            />

            <div className="relative z-10 px-5 pb-32">
                {/* ── Period Selector Hero ────────────────────────────── */}
                <div className="py-4">
                    <div className="bg-white/50 dark:bg-surface/40 backdrop-blur-md rounded-[20px] p-1.5 flex gap-1.5 border border-white/50 dark:border-slate-800/50 shadow-sm mb-6">
                        {PERIOD_TABS.map(p => (
                            <button key={p} onClick={() => setPeriodTab(p)}
                                className={cn('flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center',
                                    periodTab === p
                                        ? 'bg-white dark:bg-surface text-purple-600 dark:text-purple-400 shadow-sm'
                                        : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>
                                {p}
                            </button>
                        ))}
                    </div>

                    {periodTab === 'Tùy chỉnh' && (
                        <div className="bg-white/50 dark:bg-surface/40 backdrop-blur-md rounded-[20px] p-3 flex items-center gap-2 border border-white/50 dark:border-slate-800/50 shadow-sm mb-6">
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                max={customEnd || undefined}
                                className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-medium bg-white dark:bg-surface text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[#6C63FF] transition"
                            />
                            <span className="text-slate-400 text-xs font-bold flex-shrink-0">→</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                min={customStart || undefined}
                                max={toISODate(new Date())}
                                className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-medium bg-white dark:bg-surface text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[#6C63FF] transition"
                            />
                        </div>
                    )}

                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Thu nhập', value: summary.income, color: 'text-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10', icon: <CustomIcon type="trendingUp" size={10} tile={false} color="currentColor" /> },
                            { label: 'Chi tiêu', value: summary.expense, color: 'text-rose-500', bg: 'bg-rose-50/50 dark:bg-rose-900/10', icon: <CustomIcon type="trendingDown" size={10} tile={false} color="currentColor" /> },
                            { label: 'Số dư', value: summary.income - summary.expense, color: 'text-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-900/10', icon: <CustomIcon type="wallet" size={10} tile={false} color="currentColor" /> },
                        ].map(item => (
                            <div key={item.label} className={cn('rounded-[1.25rem] p-3 transition-all border border-white/50 dark:border-slate-800/10 shadow-sm', item.bg)}>
                                <div className="flex items-center gap-1 mb-1.5 opacity-70">
                                    <div className={cn('p-1 rounded-md bg-white/50 dark:bg-black/20', item.color)}>{item.icon}</div>
                                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">{item.label}</span>
                                </div>
                                <p className={cn('text-xs font-black truncate', item.color)}>{fmt(Math.abs(item.value))}₫</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    {/* ── Trend chart ─────────────────────────────────── */}
                    <section className="bg-white dark:bg-surface rounded-[2rem] p-4 border border-slate-100 dark:border-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-none">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Xu hướng 14 ngày</h2>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[9px] text-slate-400">Thu</span></div>
                                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /><span className="text-[9px] text-slate-400">Chi</span></div>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
                                <defs>
                                    <linearGradient id="aIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="aExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.1)" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(148, 163, 184, 0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Area type="monotone" dataKey="income" stroke="#10B981" fill="url(#aIncome)" strokeWidth={3} dot={createCustomDot('#10B981', 'income')} activeDot={false} name="Thu" />
                                <Area type="monotone" dataKey="expense" stroke="#F43F5E" fill="url(#aExpense)" strokeWidth={3} dot={createCustomDot('#F43F5E', 'expense')} activeDot={false} name="Chi" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </section>

                    {/* ── Monthly history: real month-over-month comparison ── */}
                    <section className="bg-white dark:bg-surface rounded-[2rem] p-4 border border-slate-100 dark:border-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-none">
                        <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-1">Lịch sử theo tháng</h2>
                        <div className="space-y-1.5">
                            {monthlyHistory.map((m, i) => {
                                const prev = i > 0 ? monthlyHistory[i - 1] : null;
                                const expenseDelta = prev && prev.expense > 0 ? ((m.expense - prev.expense) / prev.expense) * 100 : null;
                                const isCurrent = i === monthlyHistory.length - 1;
                                return (
                                    <div key={m.label} className={cn(
                                        'flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-colors',
                                        isCurrent ? 'bg-purple-50/60 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30' : 'border border-transparent'
                                    )}>
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 w-14 flex-shrink-0">{m.label}</span>
                                        <span className="text-[10px] font-bold text-emerald-500 flex-1 text-right">+{fmt(m.income)}₫</span>
                                        <span className="text-[10px] font-bold text-rose-500 flex-1 text-right">-{fmt(m.expense)}₫</span>
                                        <span className={cn(
                                            'text-[9px] font-bold flex-shrink-0 w-11 text-right',
                                            expenseDelta === null ? 'text-slate-300 dark:text-slate-600' : expenseDelta <= 0 ? 'text-emerald-500' : 'text-rose-500'
                                        )}>
                                            {expenseDelta === null ? '—' : `${expenseDelta <= 0 ? '↓' : '↑'}${Math.abs(expenseDelta).toFixed(0)}%`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[9px] text-slate-300 dark:text-slate-600 text-center mt-3">Chi tiêu so với tháng liền trước</p>
                    </section>

                    {/* ── Category pie chart ──────────────────────────── */}
                    {categoryBreakdown.length > 0 && (
                        <section className="bg-white dark:bg-surface rounded-[2rem] p-4 border border-slate-100 dark:border-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-none">
                            <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-1">Cơ cấu chi tiêu</h2>
                            <div className="flex flex-col items-center">
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={categoryBreakdown} cx="50%" cy="50%" labelLine={false}
                                            label={renderCustomLabel} outerRadius={100} innerRadius={50}
                                            stroke="none"
                                            dataKey="total" nameKey="category">
                                            {categoryBreakdown.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(v: number | undefined) => v != null ? [`${fmt(v)}đ`, ''] : ['-', '']}
                                            contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', fontSize: 12 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>

                                <div className="w-full space-y-2 mt-4">
                                    {categoryBreakdown.map(c => {
                                        const pct = summary.expense > 0 ? Math.round((c.total / summary.expense) * 100) : 0;
                                        return (
                                            <div key={c.category} className="bg-slate-50/50 dark:bg-surface/30 rounded-2xl p-2.5 flex items-center gap-3 group hover:scale-[1.01] transition-all">
                                                <CategoryIcon
                                                    type={c.catIconType || 'khac'}
                                                    size={32}
                                                    tile
                                                    className="flex-shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1 px-0.5">
                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{c.category}</span>
                                                        <span className="text-[11px] font-black text-slate-900 dark:text-white">{fmt(c.total)}₫</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 w-8 inline-block">{pct}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ── Transaction List ────────────────────────────── */}
                    <section>
                        <div className="flex items-center justify-between flex-wrap gap-y-2 mb-3 px-1 gap-2">
                            <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex-shrink-0">Giao dịch gần nhất</h2>
                            <div className="flex items-center gap-1.5">
                                <button onClick={handleExport}
                                    title="Xuất CSV"
                                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-surface border border-slate-200/50 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex-shrink-0">
                                    <CustomIcon type="upload" size={14} tile={false} color="currentColor" />
                                </button>
                                <div className="bg-slate-100 dark:bg-surface rounded-xl p-1 flex gap-1 border border-slate-200/50 dark:border-slate-800">
                                    {(['all', 'expense', 'income'] as const).map(f => (
                                        <button key={f} onClick={() => setFilterType(f)}
                                            className={cn('px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase',
                                                filterType === f ? 'bg-white dark:bg-surface text-purple-600 dark:text-purple-400 shadow-sm' : 'text-slate-400 dark:text-slate-600')}>
                                            {f === 'all' ? 'Tất cả' : f === 'expense' ? 'Chi' : 'Thu'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {filteredTx.length === 0 ? (
                                <div className="py-12 text-center bg-white dark:bg-surface/30 rounded-[20px] border border-dashed border-slate-200 dark:border-slate-800">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-surface flex items-center justify-center mx-auto mb-3 border border-slate-100 dark:border-slate-800">
                                        <CustomIcon type="filter" size={24} tile={false} color="currentColor" className="text-slate-300" />
                                    </div>
                                    <p className="text-slate-400 dark:text-slate-500 text-xs font-medium italic">Không tìm thấy giao dịch nào</p>
                                </div>
                            ) : (
                                filteredTx.map(t => {
                                    const cat = CATEGORIES_MAP.get(t.category) || CATEGORIES[CATEGORIES.length - 1];
                                    const isIncome = t.type === 'income';
                                    return (
                                        <div key={t._id} className="bg-white dark:bg-surface rounded-2xl p-3 flex items-center justify-between border border-slate-100 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-900 group transition-all">
                                            <div className="flex items-center gap-3">
                                                <CategoryIcon
                                                    type={cat.catIconType || 'khac'}
                                                    size={36}
                                                    tile
                                                    className="flex-shrink-0"
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-bold text-[13px] text-slate-800 dark:text-slate-200 truncate">{t.note || t.category}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{t.category}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                                        <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                                                            {new Date(t.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="relative h-10 min-w-[80px] overflow-hidden flex items-center justify-end">
                                                {/* Amount View */}
                                                <div className="flex flex-col items-end transition-all duration-300 group-hover:-translate-y-full group-hover:opacity-0">
                                                    <p className={cn('text-[13px] font-black leading-none', isIncome ? 'text-emerald-500' : 'text-slate-900 dark:text-white')}>
                                                        {isIncome ? '+' : '-'}{fmt(t.amount)}₫
                                                    </p>
                                                    {isIncome && <span className="text-[7px] font-bold text-emerald-400 uppercase mt-1">Đã cộng</span>}
                                                </div>

                                                {/* Hover Actions */}
                                                <div className="absolute inset-0 flex items-center justify-end gap-1.5 translate-y-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }}
                                                        className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 flex-shrink-0 text-slate-500 dark:text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900/40 transition-all shadow-sm">
                                                        <CustomIcon type="pencil" size={16} tile={false} color="currentColor" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t._id); }}
                                                        className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 flex-shrink-0 text-slate-500 dark:text-slate-400 hover:bg-rose-100 hover:text-rose-500 dark:hover:bg-rose-900/40 transition-all shadow-sm">
                                                        <CustomIcon type="trash" size={16} tile={false} color="currentColor" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>
                </div>
            </div>

            <AddTransactionModal
                open={showAddModal}
                onClose={() => { setShowAddModal(false); setEditingTx(null); }}
                onSaved={refetch}
                initialData={editingTx}
            />
        </div>
    );
}
