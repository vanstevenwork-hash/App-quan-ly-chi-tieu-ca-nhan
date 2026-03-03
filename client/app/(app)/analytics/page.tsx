'use client';
import { useState, useCallback } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { transactionsApi } from '@/lib/api';
import { CATEGORIES } from '@/lib/mockData';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChevronLeft, Plus, Trash2, Pencil, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import AddTransactionModal from '@/components/AddTransactionModal';
import { toast } from 'sonner';

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
}) => {
    if (percent < 0.05) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">{`${(percent * 100).toFixed(0)}%`}</text>;
};

const fmt = (n: number) => {
    if (n >= 1000000000) return `${(n / 1000000000).toFixed(1)}tỷ`;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}tr`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return `${n}`;
};

const PERIOD_TABS = ['Tháng này', 'Tuần này', 'Tháng trước'] as const;

export default function AnalyticsPage() {
    const router = useRouter();
    const [periodTab, setPeriodTab] = useState<typeof PERIOD_TABS[number]>('Tháng này');
    const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editTx, setEditTx] = useState<string | null>(null);

    const now = new Date();
    const paramsForPeriod = () => {
        if (periodTab === 'Tháng này') return { month: now.getMonth() + 1, year: now.getFullYear() };
        if (periodTab === 'Tháng trước') return { month: now.getMonth() === 0 ? 12 : now.getMonth(), year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear() };
        return {}; // Tuần này — no month filter, let hook handle
    };

    const { transactions, summary, loading, refetch } = useTransactions(paramsForPeriod());

    // Category breakdown (client-computed from transactions)
    const categoryBreakdown = (() => {
        const arr = transactions.filter(t => t.type === 'expense');
        const map: Record<string, number> = {};
        arr.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
        return Object.entries(map)
            .map(([cat, total]) => {
                const cfg = CATEGORIES.find(c => c.label === cat);
                return { category: cat, total, color: cfg?.color || '#6C63FF', icon: cfg?.icon || '💰' };
            })
            .sort((a, b) => b.total - a.total);
    })();

    // Chart data — last 14 days
    const chartData = (() => {
        const days: Record<string, { income: number; expense: number }> = {};
        for (let i = 13; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            days[`${d.getDate()}/${d.getMonth() + 1}`] = { income: 0, expense: 0 };
        }
        transactions.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getDate()}/${d.getMonth() + 1}`;
            if (key in days) days[key][t.type as 'income' | 'expense'] += t.amount;
        });
        return Object.entries(days).map(([name, v]) => ({ name, ...v }));
    })();

    const filteredTx = transactions.filter(t => filterType === 'all' || t.type === filterType);

    const handleDelete = async (id: string) => {
        try {
            await transactionsApi.delete(id);
            toast.success('Đã xoá giao dịch');
            refetch();
        } catch { toast.error('Xoá thất bại'); }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F0F2F8] flex items-center justify-center">
                <p className="text-gray-400">Đang tải...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F0F2F8]">
            {/* Header */}
            <div className="gradient-primary px-5 pt-12 pb-6">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()}
                            className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
                            <ChevronLeft className="w-5 h-5 text-white" />
                        </button>
                        <h1 className="font-bold text-white text-lg">Báo cáo chi tiêu</h1>
                    </div>
                    <button onClick={() => setShowAddModal(true)}
                        className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                        <Plus className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Period tabs */}
                <div className="flex gap-1.5 bg-white/15 rounded-2xl p-1">
                    {PERIOD_TABS.map(p => (
                        <button key={p} onClick={() => setPeriodTab(p)}
                            className={cn('flex-1 py-2 rounded-xl text-xs font-bold transition-all',
                                periodTab === p ? 'bg-white text-indigo-600' : 'text-white/80')}>
                            {p}
                        </button>
                    ))}
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                        { label: 'Thu nhập', value: summary.income, color: 'text-green-300' },
                        { label: 'Chi tiêu', value: summary.expense, color: 'text-red-300' },
                        { label: 'Tiết kiệm', value: summary.income - summary.expense, color: 'text-white' },
                    ].map(s => (
                        <div key={s.label} className="bg-white/15 rounded-2xl p-3 text-center">
                            <p className="text-white/60 text-[10px]">{s.label}</p>
                            <p className={cn('font-bold text-sm', s.color)}>{fmt(Math.abs(s.value))}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-4 py-4 space-y-4 pb-28">
                {/* Trend chart */}
                <div className="bg-white rounded-3xl shadow-sm p-4">
                    <p className="font-bold text-gray-900 mb-3">Xu hướng 14 ngày</p>
                    <ResponsiveContainer width="100%" height={140}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -30 }}>
                            <defs>
                                <linearGradient id="aIncome" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="aExpense" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                            <Area type="monotone" dataKey="income" stroke="#10B981" fill="url(#aIncome)" strokeWidth={2} dot={false} name="Thu nhập" />
                            <Area type="monotone" dataKey="expense" stroke="#EF4444" fill="url(#aExpense)" strokeWidth={2} dot={false} name="Chi tiêu" />
                        </AreaChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-4 mt-2 justify-center">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-xs text-gray-500">Thu nhập</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="text-xs text-gray-500">Chi tiêu</span></div>
                    </div>
                </div>

                {/* Category pie chart */}
                {categoryBreakdown.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-sm p-4">
                        <p className="font-bold text-gray-900 mb-3">Chi tiêu theo danh mục</p>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={categoryBreakdown} cx="50%" cy="50%" labelLine={false}
                                    label={renderCustomLabel} outerRadius={80} innerRadius={35}
                                    dataKey="total" nameKey="category">
                                    {categoryBreakdown.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v: number | undefined) => v != null ? [`${fmt(v)}đ`, ''] : ['-', '']}
                                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-2">
                            {categoryBreakdown.map(c => {
                                const pct = summary.expense > 0 ? Math.round((c.total / summary.expense) * 100) : 0;
                                return (
                                    <div key={c.category} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: `${c.color}20` }}>{c.icon}</div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-xs font-semibold text-gray-700">{c.category}</span>
                                                <span className="text-xs font-bold text-gray-800">{fmt(c.total)}đ</span>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Transaction list with filter */}
                <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
                        <p className="font-bold text-gray-900">Lịch sử giao dịch</p>
                        <div className="flex gap-1.5">
                            {(['all', 'expense', 'income'] as const).map(f => (
                                <button key={f} onClick={() => setFilterType(f)}
                                    className={cn('px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all',
                                        filterType === f ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500')}>
                                    {f === 'all' ? 'Tất cả' : f === 'expense' ? 'Chi' : 'Thu'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredTx.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-gray-400 text-sm">Chưa có giao dịch nào</p>
                            <button onClick={() => setShowAddModal(true)}
                                className="mt-2 text-indigo-600 text-sm font-semibold">+ Thêm giao dịch</button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {filteredTx.map(t => {
                                const cat = CATEGORIES.find(c => c.label === t.category) || CATEGORIES[CATEGORIES.length - 1];
                                const isIncome = t.type === 'income';
                                return (
                                    <div key={t._id} className="flex items-center gap-3 px-4 py-3">
                                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: `${cat.color}20` }}>
                                            {cat.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-gray-800 truncate">{t.note || t.category}</p>
                                            <p className="text-gray-400 text-xs mt-0.5">
                                                {t.category} · {new Date(t.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                            </p>
                                        </div>
                                        <p className={cn('font-bold text-sm flex-shrink-0 mr-1', isIncome ? 'text-emerald-500' : 'text-gray-800')}>
                                            {isIncome ? '+' : '-'}{fmt(t.amount)}
                                        </p>
                                        <button onClick={() => handleDelete(t._id)}
                                            className="p-1.5 rounded-full hover:bg-red-50 transition-colors flex-shrink-0">
                                            <Trash2 className="w-3.5 h-3.5 text-gray-300 hover:text-red-400" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} onSaved={refetch} />
        </div>
    );
}
