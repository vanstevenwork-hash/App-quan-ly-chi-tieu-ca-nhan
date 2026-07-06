'use client';
import { memo } from 'react';
import { Target, Flame, Trophy, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmtShort = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

export type FilterTab = 'all' | 'active' | 'completed' | 'deadline';
export type SortBy = 'deadline' | 'progress' | 'amount';

interface GoalsStatsAndFiltersProps {
    hasGoals: boolean;
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    totalSaved: number;
    soonDeadline: number;
    filterTab: FilterTab;
    sortBy: SortBy;
    onFilterChange: (tab: FilterTab) => void;
    onSortChange: (sort: SortBy) => void;
}

function GoalsStatsAndFiltersBase({
    hasGoals, totalGoals, activeGoals, completedGoals, totalSaved, soonDeadline,
    filterTab, sortBy, onFilterChange, onSortChange,
}: GoalsStatsAndFiltersProps) {
    if (!hasGoals) return null;

    const tabs: { id: FilterTab; label: string; count?: number }[] = [
        { id: 'all', label: 'Tất cả', count: totalGoals },
        { id: 'active', label: 'Đang thực hiện', count: activeGoals },
        { id: 'completed', label: 'Hoàn thành', count: completedGoals },
        { id: 'deadline', label: '⚡ Sắp hết hạn', count: soonDeadline },
    ];

    return (
        <>
            {/* ── Stats row ──────────────────────────────────── */}
            <div className="px-5 mb-5">
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { icon: <Target className="w-4 h-4 text-[#6C63FF]" />, label: 'Tổng', value: totalGoals, bg: '#6C63FF15' },
                        { icon: <Flame className="w-4 h-4 text-orange-500" />, label: 'Đang TH', value: activeGoals, bg: '#F97316' + '15' },
                        { icon: <Trophy className="w-4 h-4 text-amber-500" />, label: 'Hoàn thành', value: completedGoals, bg: '#F59E0B15' },
                        { icon: <Coins className="w-4 h-4 text-emerald-600" />, label: 'Đã tiết kiệm', value: fmtShort(totalSaved), bg: '#10B98115' },
                    ].map(s => (
                        <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center border border-gray-100 dark:border-slate-700 shadow-sm">
                            <div className="w-8 h-8 rounded-xl mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                                {s.icon}
                            </div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.value}</p>
                            <p className="text-[9px] text-slate-400 leading-tight mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Filter tabs ────────────────────────────────── */}
            <div className="px-5 mb-4">
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => onFilterChange(tab.id)}
                            className={cn(
                                'flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                                filterTab === tab.id
                                    ? 'bg-[#6C63FF] text-white border-[#6C63FF] shadow-md shadow-[#6C63FF]/20'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-gray-100 dark:border-slate-700 hover:border-[#6C63FF]/30'
                            )}>
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={cn('ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full',
                                    filterTab === tab.id ? 'bg-white/30 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500')}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Sort */}
                <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400 font-medium">Sắp xếp:</span>
                    {(['deadline', 'progress', 'amount'] as const).map((val) => {
                        const label = val === 'deadline' ? 'Deadline' : val === 'progress' ? 'Tiến độ' : 'Số tiền';
                        return (
                            <button key={val} onClick={() => onSortChange(val)}
                                className={cn('px-2 py-1 rounded-lg text-[10px] font-bold transition',
                                    sortBy === val ? 'bg-[#6C63FF]/10 text-[#6C63FF]' : 'text-slate-400 hover:text-slate-600')}>
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

export default memo(GoalsStatsAndFiltersBase);
