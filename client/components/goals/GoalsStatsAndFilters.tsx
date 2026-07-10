'use client';
import { memo } from 'react';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { cn } from '@/lib/utils';

// "120tr" / "1,5 tỷ" — Vietnamese compact amounts
const fmtViShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} tỷ`.replace(/,?0+ tỷ$/, ' tỷ');
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1).replace('.', ',')}tr`.replace(',0tr', 'tr');
    if (abs >= 1_000) return `${Math.round(abs / 1_000)}k`;
    return `${Math.round(abs)}`;
};

export type FilterTab = 'all' | 'active' | 'completed' | 'deadline';
export type SortBy = 'deadline' | 'progress' | 'amount';

const SORT_ORDER: SortBy[] = ['deadline', 'progress', 'amount'];
const SORT_LABELS: Record<SortBy, string> = { deadline: 'Hạn chót', progress: 'Tiến độ', amount: 'Số tiền' };

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
    hasGoals, totalGoals, completedGoals, totalSaved,
    filterTab, sortBy, onFilterChange, onSortChange,
}: GoalsStatsAndFiltersProps) {
    if (!hasGoals) return null;

    const tabs: { id: FilterTab; label: string }[] = [
        { id: 'all', label: 'Tất cả' },
        { id: 'active', label: 'Đang thực hiện' },
        { id: 'completed', label: 'Hoàn thành' },
    ];

    const cycleSort = () => {
        const next = SORT_ORDER[(SORT_ORDER.indexOf(sortBy) + 1) % SORT_ORDER.length];
        onSortChange(next);
    };

    return (
        <>
            {/* ── One-line stats strip ────────────────────────── */}
            <div className="px-5 mb-3">
                <div className="rounded-xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-800 shadow-sm px-3 py-2.5 flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-[13px]">
                    <span><b className="text-slate-900 dark:text-white">{totalGoals}</b> <span className="text-slate-400 dark:text-slate-500 font-medium">mục tiêu</span></span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span><b className="text-slate-900 dark:text-white">{completedGoals}</b> <span className="text-slate-400 dark:text-slate-500 font-medium">hoàn thành</span></span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span><span className="text-slate-400 dark:text-slate-500 font-medium">đã để dành</span> <b className="text-slate-900 dark:text-white">{fmtViShort(totalSaved)}đ</b></span>
                </div>
            </div>

            {/* ── Filter pills + sort — one compact row ───────── */}
            <div className="px-5 mb-3 flex items-center gap-1.5 flex-wrap">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => onFilterChange(tab.id)}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                            filterTab === tab.id
                                ? 'bg-[#6C63FF] border-transparent text-white shadow-md shadow-[#6C63FF]/25'
                                : 'bg-white dark:bg-surface border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-[#6C63FF]/40'
                        )}>
                        {tab.label}
                    </button>
                ))}
                <button onClick={cycleSort}
                    className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface text-slate-600 dark:text-slate-300 flex items-center gap-1 active:scale-95 transition-all">
                    {SORT_LABELS[sortBy]}
                    <ActionIcon type="chevronDown" size={11} tile={false} color="currentColor" />
                </button>
            </div>
        </>
    );
}

export default memo(GoalsStatsAndFiltersBase);
