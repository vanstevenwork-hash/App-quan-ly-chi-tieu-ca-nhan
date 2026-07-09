'use client';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { ActionIcon } from '@/components/icons/ActionIcon';
import type { Goal } from '@/hooks/useGoals';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const fmtShort = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

function daysLeft(deadline: string): number {
    return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

// ─── Savings plan calculator ──────────────────────────────────────
function calcSavingPlan(remaining: number, deadline?: string) {
    if (!deadline || remaining <= 0) return null;
    const days = daysLeft(deadline);
    if (days <= 0) return null;
    const weeks = days / 7;
    const months = days / 30;
    return {
        daily: Math.ceil(remaining / days),
        weekly: Math.ceil(remaining / weeks),
        monthly: Math.ceil(remaining / Math.max(months, 1)),
    };
}

// ─── Milestone badge ──────────────────────────────────────────────
function getMilestone(pct: number) {
    if (pct >= 100) return { emoji: '🎯', label: 'Goal completed!' };
    if (pct >= 75) return { emoji: '🔥', label: 'Almost done!' };
    if (pct >= 50) return { emoji: '🚀', label: 'Halfway there!' };
    if (pct >= 25) return { emoji: '🎉', label: 'Good start!' };
    return null;
}

// ─── Confetti burst ───────────────────────────────────────────────
function Confetti({ active }: { active: boolean }) {
    if (!active) return null;
    const dots = Array.from({ length: 20 });
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px] z-10">
            {dots.map((_, i) => (
                <div key={i}
                    className="absolute w-2 h-2 rounded-full animate-bounce"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        backgroundColor: ['#F59E0B', '#10B981', '#6C63FF', '#EF4444', '#3B82F6'][i % 5],
                        animationDelay: `${(i * 0.1).toFixed(1)}s`,
                        animationDuration: `${0.5 + Math.random() * 0.5}s`,
                    }} />
            ))}
        </div>
    );
}

// ─── Goal Card ───────────────────────────────────────────────────
function GoalCard({ goal, onContribute, onEdit, onDelete }: {
    goal: Goal;
    onContribute: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const pct = goal.progress ?? 0;
    const remaining = goal.targetAmount - goal.currentAmount;
    const plan = calcSavingPlan(remaining, goal.deadline);
    const milestone = getMilestone(pct);
    const days = goal.deadline ? daysLeft(goal.deadline) : null;
    const isUrgent = days !== null && days <= 7 && days > 0;
    const isOverdue = days !== null && days <= 0;
    const isCompleted = goal.status === 'completed';
    const showConfetti = pct === 100;

    return (
        <div className={cn(
            'relative bg-white dark:bg-slate-900 rounded-[20px] overflow-hidden border shadow-sm transition-all',
            isCompleted ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-gray-100 dark:border-slate-800'
        )}>
            <Confetti active={showConfetti} />

            {/* Color top bar */}
            <div className="h-1.5 w-full" style={{ backgroundColor: goal.color }} />

            <div className="p-4">
                {/* Row 1: icon + name + actions */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                            style={{ backgroundColor: goal.color + '18' }}>
                            {goal.icon}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{goal.name}</h3>
                            {goal.description && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{goal.description}</p>}
                        </div>
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                        {!isCompleted && (
                            <button onClick={onEdit} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                                <ActionIcon type="pencil" size={12} tile={false} color="#64748B" />
                            </button>
                        )}
                        <button onClick={onDelete} className="w-7 h-7 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/50 transition">
                            <ActionIcon type="trash" size={12} tile={false} color="#EF4444" />
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{fmt(goal.currentAmount)}₫</span>
                        <div className="flex items-center gap-2">
                            {milestone && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ backgroundColor: goal.color + '15', color: goal.color }}>{milestone.emoji} {milestone.label}</span>}
                            <span className="text-sm font-bold" style={{ color: goal.color }}>{pct}%</span>
                        </div>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: goal.color }} />
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-slate-400">Đã tiết kiệm</span>
                        <span className="text-[10px] text-slate-400">Mục tiêu: {fmtShort(goal.targetAmount)}₫</span>
                    </div>
                </div>

                {/* Deadline & days left */}
                {goal.deadline && (
                    <div className={cn(
                        'flex items-center gap-1.5 text-xs font-semibold mb-3 px-3 py-1.5 rounded-xl w-fit',
                        isCompleted ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            isOverdue ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                isUrgent ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                    'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    )}>
                        {isCompleted ? <UtilityIcon type="trophy" size={12} tile={false} color="#F59E0B" /> : <ActionIcon type="calendar" size={12} tile={false} color="currentColor" />}
                        {isCompleted ? `Hoàn thành ${goal.completedAt ? new Date(goal.completedAt).toLocaleDateString('vi-VN') : ''}` :
                            isOverdue ? 'Đã quá hạn!' :
                                `${days} ngày còn lại`}
                    </div>
                )}

                {/* Savings plan */}
                {plan && !isCompleted && (
                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 mb-3">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">Kế hoạch tiết kiệm</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-2">
                                <p className="text-[9px] text-slate-400 mb-0.5">Hàng ngày</p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmtShort(plan.daily)}₫</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-2">
                                <p className="text-[9px] text-slate-400 mb-0.5">Hàng tuần</p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmtShort(plan.weekly)}₫</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-2">
                                <p className="text-[9px] text-slate-400 mb-0.5">Hàng tháng</p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmtShort(plan.monthly)}₫</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Contribute button */}
                {!isCompleted && (
                    <button onClick={onContribute}
                        className="w-full py-2.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        style={{ background: `linear-gradient(135deg, ${goal.color}, ${goal.color}bb)` }}>
                        <UtilityIcon type="coins" size={16} tile={false} color="#FFFFFF" />
                        Đóng góp tiền
                    </button>
                )}

                {isCompleted && (
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                        <UtilityIcon type="checkCircle" size={16} tile={false} color="#10B981" />
                        Đã hoàn thành! 🎉
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Empty State ──────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
            <div className="w-24 h-24 rounded-[20px] mb-6 flex items-center justify-center text-5xl"
                style={{ background: 'linear-gradient(135deg, #6C63FF22, #6C63FF44)' }}>
                🎯
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Chưa có mục tiêu nào</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                Đặt mục tiêu tài chính và theo dõi tiến độ để đạt được ước mơ của bạn!
            </p>
            <div className="grid grid-cols-2 gap-3 w-full mb-8">
                {[
                    { icon: '🏠', label: 'Mua nhà' }, { icon: '✈️', label: 'Du lịch' },
                    { icon: '🚗', label: 'Mua xe' }, { icon: '💰', label: 'Quỹ khẩn cấp' },
                ].map(g => (
                    <button key={g.label} onClick={onAdd}
                        className="flex items-center gap-2 p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#6C63FF] hover:bg-[#6C63FF]/5 transition text-left">
                        <span className="text-xl">{g.icon}</span>
                        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{g.label}</span>
                    </button>
                ))}
            </div>
            <button onClick={onAdd}
                className="px-8 py-4 rounded-2xl text-white font-bold text-base shadow-lg transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #6C63FF, #8B5CF6)' }}>
                ✨ Tạo mục tiêu đầu tiên
            </button>
        </div>
    );
}

interface GoalsListProps {
    loading: boolean;
    hasGoals: boolean;
    filtered: Goal[];
    onAdd: () => void;
    onContribute: (goal: Goal) => void;
    onEdit: (goal: Goal) => void;
    onDelete: (id: string) => void;
}

function GoalsListBase({ loading, hasGoals, filtered, onAdd, onContribute, onEdit, onDelete }: GoalsListProps) {
    return (
        <div className="px-5 space-y-4">
            {loading && (
                <div className="space-y-4">
                    {[1, 2].map(i => (
                        <div key={i} className="h-48 rounded-[20px] bg-gray-100 dark:bg-slate-900 animate-pulse" />
                    ))}
                </div>
            )}

            {!loading && !hasGoals && (
                <EmptyState onAdd={onAdd} />
            )}

            {!loading && filtered.length === 0 && hasGoals && (
                <div className="text-center py-12">
                    <p className="text-slate-400 dark:text-slate-500 text-sm">Không có mục tiêu nào trong tab này</p>
                </div>
            )}

            {!loading && filtered.map(goal => (
                <GoalCard
                    key={goal._id}
                    goal={goal}
                    onContribute={() => onContribute(goal)}
                    onEdit={() => onEdit(goal)}
                    onDelete={() => onDelete(goal._id)}
                />
            ))}
        </div>
    );
}

export default memo(GoalsListBase);
