'use client';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { ActionIcon } from '@/components/icons/ActionIcon';

const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return `${n}`;
};

export interface DayCellData {
    hasTx: boolean;
    combinedImages: { url: string; amount: number }[];
    totalExpense: number;
    totalIncome: number;
}

interface DayCellProps {
    day: number;
    dayData: DayCellData;
    isSelected: boolean;
    isToday: boolean;
    filterType: 'all' | 'expense' | 'income';
    onSelect: (day: number) => void;
    onPlus: (day: number, e: React.MouseEvent) => void;
}

function DayCellBase({ day, dayData, isSelected, isToday, filterType, onSelect, onPlus }: DayCellProps) {
    const { hasTx, combinedImages, totalExpense, totalIncome } = dayData;
    const showExpense = (filterType === 'all' || filterType === 'expense') && totalExpense > 0;
    const showIncome = (filterType === 'all' || filterType === 'income') && totalIncome > 0;

    return (
        <button
            onClick={() => onSelect(day)}
            className={cn(
                'h-20 p-1.5 flex flex-col transition-all active:scale-95 group/day outline-none focus:outline-none relative w-full text-left',
                isSelected
                    ? 'bg-white dark:bg-surface border-2 border-primary/20 z-10 shadow-lg rounded-md scale-[1.02]'
                    : 'bg-white dark:bg-surface-deep hover:bg-slate-50 dark:hover:bg-slate-900/50'
            )}
        >
            {/* Day number - Top Left */}
            <span className={cn(
                'text-xs transition-all block',
                isSelected ? 'font-extrabold text-primary' : 'font-bold text-on-surface/40',
                !isSelected && isToday ? 'font-extrabold text-primary' : ''
            )}>
                {day}
            </span>

            {/* Day content area */}
            <div className="flex-1 w-full flex flex-col justify-center items-center gap-0.5">
                {/* Image thumbnails — overlapping circles */}
                {combinedImages.length > 0 && (
                    <div className="flex items-center justify-center -space-x-3 mb-1">
                        {combinedImages.slice(0, 2).map((img) => (
                            <img
                                key={img.url}
                                src={img.url}
                                alt=""
                                className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 object-cover shadow-sm bg-slate-100"
                            />
                        ))}
                        {combinedImages.length > 2 && (
                            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-500 shadow-sm z-10">
                                +{combinedImages.length - 2}
                            </div>
                        )}
                    </div>
                )}

                {/* Transaction amounts */}
                {showExpense && (
                    <span className="text-[9px] font-bold text-red-500 leading-tight truncate">
                        -{fmt(totalExpense)}
                    </span>
                )}
                {showIncome && (
                    <span className="text-[9px] font-bold text-emerald-500 leading-tight truncate">
                        +{fmt(totalIncome)}
                    </span>
                )}

                {/* Quick-add "+" only makes sense on today — past days clutter the
                    grid with a dashed circle on every empty cell, and future
                    days can't have a transaction yet anyway. Backdating still
                    works via the main Add Transaction flow's free date picker. */}
                {isToday && ((!hasTx && combinedImages.length === 0) ? (
                    <div
                        className="w-5 h-5 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover/day:bg-purple-100 group-hover/day:text-purple-600 transition-all shadow-sm border border-dashed border-slate-200 dark:border-slate-700"
                        onClick={(e) => onPlus(day, e)}
                    >
                        <ActionIcon type="plus" size={12} tile={false} color="currentColor" />
                    </div>
                ) : (
                    <div
                        className="absolute bottom-1 right-1 opacity-0 group-hover/day:opacity-100 transition-opacity"
                        onClick={(e) => onPlus(day, e)}
                    >
                        <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-purple-600 shadow-lg border border-purple-100 dark:border-purple-900/50">
                            <ActionIcon type="plus" size={16} tile={false} color="currentColor" />
                        </div>
                    </div>
                ))}
            </div>
        </button>
    );
}

export default memo(DayCellBase);
