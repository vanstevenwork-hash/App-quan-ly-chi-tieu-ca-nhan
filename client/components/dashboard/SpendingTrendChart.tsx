'use client';
import { memo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const fmtFull = (n: number) => n.toLocaleString('vi-VN');

const createCustomDot = (color: string, dataKey: string) => {
    return (props: any) => {
        const { cx, cy, payload, index } = props;
        const val = payload[dataKey] || 0;
        if (index === 6) { // Last item (today)
            const absVal = Math.abs(val);
            const sign = val < 0 ? '-' : '';
            const valStr = absVal >= 1000000
                ? `${sign}${(absVal / 1000000).toFixed(1).replace('.0', '')}tr`
                : `${sign}${absVal >= 1000 ? Math.round(absVal / 1000) + 'k' : absVal}`;
            const rectW = valStr.length > 3 ? 46 : 38;
            return (
                <g key={`dot-${index}-${dataKey}`}>
                    <circle cx={cx} cy={cy} r={12} fill={color} fillOpacity={0.15} />
                    <circle cx={cx} cy={cy} r={7} className="fill-white dark:fill-slate-800" />
                    <circle cx={cx} cy={cy} r={4.5} fill={color} />
                    <rect x={cx - rectW / 2} y={cy - 38} width={rectW} height={22} rx={10} fill={color} />
                    <text x={cx} y={cy - 27} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                        {valStr}
                    </text>
                </g>
            );
        }
        return (
            <circle key={`dot-${index}-${dataKey}`} cx={cx} cy={cy} r={4.5} className="fill-white dark:fill-slate-800" stroke={color} strokeWidth={2.5} />
        );
    };
};

const renderCustomTick = (props: any) => {
    const { x, y, payload } = props;
    const isToday = payload.value === 'Hôm nay';
    return (
        <text x={x} y={y + 12} className={isToday ? "fill-purple-600 dark:fill-purple-400 font-bold" : "fill-slate-400 dark:fill-slate-500"} fontSize={isToday ? 11 : 9} textAnchor="middle">
            {payload.value}
        </text>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const income = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
        const expense = payload.find((p: any) => p.dataKey === 'expense')?.value || 0;
        const diff = income + expense; // expense is negative
        const isPositive = diff >= 0;

        return (
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 shadow-xl min-w-[180px] anim-scale-in">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{label}</p>

                <div className="space-y-2.5 mb-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-[#8B5CF6]" />
                            <span className="text-xs font-medium text-slate-400">Thu nhập</span>
                        </div>
                        <span className="text-xs font-bold text-white">+{fmtFull(Math.abs(income))}đ</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-[#EF4444]" />
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
                            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        </div>
                        <span className={cn(
                            "text-sm font-black",
                            isPositive ? "text-emerald-500" : "text-rose-500"
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
    chartData: { name: string; expense: number; income: number }[];
}

function SpendingTrendChartBase({ chartData }: SpendingTrendChartProps) {
    return (
        <section>
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Xu hướng thu chi</h2>
                <Link href="/analytics"
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all uppercase tracking-tight">
                    Xem chi tiết
                </Link>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-gray-100 dark:border-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData} margin={{ top: 45, right: 30, bottom: 0, left: -30 }}>
                        <defs>
                            <linearGradient id="lavGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" tick={renderCustomTick} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 8, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                            tickFormatter={v => `${Math.round(v / 1000)}k`} />
                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area type="monotone" dataKey="expense"
                            stroke="#EF4444" strokeWidth={3} fill="url(#redGrad)"
                            dot={createCustomDot('#EF4444', 'expense')}
                            activeDot={false}
                        />
                        <Area type="monotone" dataKey="income"
                            stroke="#8B5CF6" strokeWidth={3} fill="url(#lavGrad)"
                            dot={createCustomDot('#8B5CF6', 'income')}
                            activeDot={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}

export default memo(SpendingTrendChartBase);
