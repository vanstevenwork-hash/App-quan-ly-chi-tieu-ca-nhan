'use client';
import { memo, useMemo, useState } from 'react';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const fmtFull = (n: number) => n.toLocaleString('vi-VN');

// "5,6tr" / "820k" — Vietnamese compact amounts
const fmtViShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}tỷ`.replace(',0tỷ', 'tỷ');
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1).replace('.', ',')}tr`.replace(',0tr', 'tr');
    if (abs >= 1_000) return `${Math.round(abs / 1_000)}k`;
    return `${Math.round(abs)}`;
};

type Range = 'week' | 'month' | 'year';

const RANGES: { key: Range; label: string }[] = [
    { key: 'week', label: 'Tuần' },
    { key: 'month', label: 'Tháng' },
    { key: 'year', label: 'Năm' },
];

const renderCustomTick = (props: any) => {
    const { x, y, payload } = props;
    const isToday = payload.value === 'Nay';
    return (
        <text x={x} y={y + 12} className={isToday ? 'fill-purple-600 dark:fill-purple-400 font-bold' : 'fill-slate-400 dark:fill-slate-500'} fontSize={isToday ? 10 : 9} textAnchor="middle">
            {payload.value}
        </text>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const income = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
        const expense = payload.find((p: any) => p.dataKey === 'expense')?.value || 0;
        const diff = income - expense;
        const isPositive = diff >= 0;

        return (
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 shadow-xl min-w-[180px]">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{label}</p>

                <div className="space-y-2.5 mb-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-[#34D399]" />
                            <span className="text-xs font-medium text-slate-400">Thu nhập</span>
                        </div>
                        <span className="text-xs font-bold text-white">+{fmtFull(Math.abs(income))}đ</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-[#F87171]" />
                            <span className="text-xs font-medium text-slate-400">Chi tiêu</span>
                        </div>
                        <span className="text-xs font-bold text-white">-{fmtFull(Math.abs(expense))}đ</span>
                    </div>
                </div>

                <div className="pt-3 border-t border-slate-700/50 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                            isPositive ? 'bg-emerald-500/20' : 'bg-rose-500/20'
                        )}>
                            <UtilityIcon
                                type={isPositive ? 'trendingUp' : 'trendingDown'}
                                size={14}
                                tile={false}
                                color={isPositive ? '#10B981' : '#F43F5E'}
                            />
                        </div>
                        <span className={cn(
                            'text-sm font-black',
                            isPositive ? 'text-emerald-500' : 'text-rose-500'
                        )}>
                            {isPositive ? '+' : ''}{fmtFull(diff)}đ
                        </span>
                    </div>
                    {isPositive && (
                        <div className="px-1.5 py-0.5 rounded-lg bg-emerald-500/10 text-[8px] font-bold text-emerald-500 uppercase tracking-tighter">
                            Thặng dư
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

interface SpendingTrendChartProps {
    transactions: any[];
}

function SpendingTrendChartBase({ transactions }: SpendingTrendChartProps) {
    const [range, setRange] = useState<Range>('week');

    // Buckets per selected range — both series positive so the lines share one scale
    const data = useMemo(() => {
        const now = new Date();
        if (range === 'year') {
            const buckets = Array.from({ length: 12 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
                return { key: `${d.getFullYear()}-${d.getMonth()}`, name: i === 11 ? 'Nay' : `T${d.getMonth() + 1}`, income: 0, expense: 0 };
            });
            const byKey = new Map(buckets.map(b => [b.key, b]));
            transactions.forEach(t => {
                const d = new Date(t.date);
                const b = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
                if (!b) return;
                if (t.type === 'income') b.income += t.amount;
                else b.expense += t.amount;
            });
            return buckets;
        }
        const days = range === 'week' ? 7 : 30;
        const buckets = Array.from({ length: days }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i));
            return {
                key: d.toDateString(),
                name: i === days - 1 ? 'Nay' : `${d.getDate()}/${d.getMonth() + 1}`,
                income: 0, expense: 0,
            };
        });
        const byKey = new Map(buckets.map(b => [b.key, b]));
        transactions.forEach(t => {
            const b = byKey.get(new Date(t.date).toDateString());
            if (!b) return;
            if (t.type === 'income') b.income += t.amount;
            else b.expense += t.amount;
        });
        return buckets;
    }, [transactions, range]);

    // Highest spending point gets the "-5,6tr · 8/7" annotation
    const peakIdx = useMemo(() => {
        let idx = -1, max = 0;
        data.forEach((d, i) => { if (d.expense > max) { max = d.expense; idx = i; } });
        return idx;
    }, [data]);

    const expenseDot = (props: any) => {
        const { cx, cy, index } = props;
        if (index === peakIdx && peakIdx >= 0 && index !== data.length - 1) {
            const label = `-${fmtViShort(data[peakIdx].expense)} · ${data[peakIdx].name}`;
            const w = label.length * 6.2 + 18;
            return (
                <g key={`peak-${index}`}>
                    <rect x={cx - w / 2} y={cy - 40} width={w} height={22} rx={11}
                        className="fill-slate-700 dark:fill-slate-600" opacity={0.95} />
                    <text x={cx} y={cy - 29} fill="#F1F5F9" textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={700}>
                        {label}
                    </text>
                    <circle cx={cx} cy={cy} r={6} className="fill-white dark:fill-slate-900" stroke="#F87171" strokeWidth={2.5} />
                </g>
            );
        }
        if (index === data.length - 1) {
            return (
                <g key={`now-${index}`}>
                    <circle cx={cx} cy={cy} r={8} fill="#8B5CF6" fillOpacity={0.3} />
                    <circle cx={cx} cy={cy} r={4.5} fill="#8B5CF6" />
                </g>
            );
        }
        return <g key={`d-${index}`} />;
    };

    const tickInterval = range === 'week' ? 0 : range === 'month' ? 4 : 1;

    return (
        <section>
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Xu hướng thu chi</h2>
                <Link href="/analytics" aria-label="Xem chi tiết"
                    className="flex items-center justify-center w-[30px] h-[30px] rounded-[8px] text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-white/10 bg-purple-50 dark:bg-slate-900/60 shadow-sm hover:bg-purple-100 dark:hover:bg-slate-800/70 transition-all">
                    <ActionIcon type="arrowRight" size={16} tile={false} color="currentColor" />
                </Link>
            </div>

            <div className="bg-white dark:bg-surface rounded-[20px] p-4 border border-gray-100 dark:border-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                {/* Range segmented control */}
                <div className="inline-flex p-1 rounded-xl border border-slate-200/70 dark:border-slate-700 bg-slate-50 dark:bg-surface/40 mb-2">
                    {RANGES.map(r => (
                        <button key={r.key}
                            onClick={() => setRange(r.key)}
                            className={cn(
                                'px-5 py-1.5 rounded-[8px] text-sm font-bold transition-all',
                                range === r.key
                                    ? 'bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/25'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            )}>
                            {r.label}
                        </button>
                    ))}
                </div>

                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data} margin={{ top: 44, right: 10, bottom: 0, left: -18 }}>
                        <defs>
                            <linearGradient id="trendGreen" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#34D399" stopOpacity={0.28} />
                                <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="trendRed" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F87171" stopOpacity={0.28} />
                                <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" tick={renderCustomTick} axisLine={false} tickLine={false} interval={tickInterval} />
                        <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                            tickFormatter={v => (v > 0 ? fmtViShort(v) : '0')} />
                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        {peakIdx >= 0 && peakIdx !== data.length - 1 && (
                            <ReferenceLine x={data[peakIdx].name} stroke="#94A3B8" strokeDasharray="4 4" strokeOpacity={0.5} />
                        )}
                        <Area type="monotone" dataKey="income"
                            stroke="#34D399" strokeWidth={3} fill="url(#trendGreen)"
                            dot={false} activeDot={{ r: 4, fill: '#34D399' }}
                        />
                        <Area type="monotone" dataKey="expense"
                            stroke="#F87171" strokeWidth={3} fill="url(#trendRed)"
                            dot={expenseDot} activeDot={{ r: 4, fill: '#F87171' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}

export default memo(SpendingTrendChartBase);
