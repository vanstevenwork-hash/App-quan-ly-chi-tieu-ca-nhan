'use client';
import { useState, useMemo, useEffect } from 'react';
import {
    Plus, ArrowLeft, RefreshCw, Target, CheckCircle2,
    TrendingUp, Clock, Pencil, Trash2, ChevronRight,
    Coins, Calendar, Flame, Trophy, Star,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useGoals, type Goal } from '@/hooks/useGoals';
import GoalFormModal from '@/components/GoalFormModal';
import GoalContributeModal from '@/components/GoalContributeModal';
import { toast } from 'sonner';

// ─── Formatters ───────────────────────────────────────────────────
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
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl z-10">
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
            'relative bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border shadow-sm transition-all',
            isCompleted ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-gray-100 dark:border-slate-700'
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
                            <button onClick={onEdit} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition">
                                <Pencil className="w-3 h-3 text-slate-500" />
                            </button>
                        )}
                        <button onClick={onDelete} className="w-7 h-7 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/50 transition">
                            <Trash2 className="w-3 h-3 text-red-500" />
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
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
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
                                    'bg-slate-50 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    )}>
                        {isCompleted ? <Trophy className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                        {isCompleted ? `Hoàn thành ${goal.completedAt ? new Date(goal.completedAt).toLocaleDateString('vi-VN') : ''}` :
                            isOverdue ? 'Đã quá hạn!' :
                                `${days} ngày còn lại`}
                    </div>
                )}

                {/* Savings plan */}
                {plan && !isCompleted && (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-3 mb-3">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">Kế hoạch tiết kiệm</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-2">
                                <p className="text-[9px] text-slate-400 mb-0.5">Hàng ngày</p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmtShort(plan.daily)}₫</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-2">
                                <p className="text-[9px] text-slate-400 mb-0.5">Hàng tuần</p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmtShort(plan.weekly)}₫</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-2">
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
                        <Coins className="w-4 h-4" />
                        Đóng góp tiền
                    </button>
                )}

                {isCompleted && (
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                        <CheckCircle2 className="w-4 h-4" />
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
            <div className="w-24 h-24 rounded-3xl mb-6 flex items-center justify-center text-5xl"
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

// ─── Main Page ───────────────────────────────────────────────────
type FilterTab = 'all' | 'active' | 'completed' | 'deadline';

export default function GoalsPage() {
    const router = useRouter();
    const { goals, loading, createGoal, updateGoal, deleteGoal, deposit, withdraw, refetch } = useGoals();

    const [showForm, setShowForm] = useState(false);
    const [editGoal, setEditGoal] = useState<Goal | null>(null);
    const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
    const [filterTab, setFilterTab] = useState<FilterTab>('all');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'deadline' | 'progress' | 'amount'>('deadline');

    // ── Stats ──────────────────────────────────────────────────────
    const totalGoals = goals.length;
    const activeGoals = goals.filter(g => g.status === 'active').length;
    const completedGoals = goals.filter(g => g.status === 'completed').length;
    const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);

    // ── Filter + Sort ──────────────────────────────────────────────
    const now = new Date();
    const filtered = useMemo(() => {
        let list = [...goals];
        if (filterTab === 'active') list = list.filter(g => g.status === 'active');
        else if (filterTab === 'completed') list = list.filter(g => g.status === 'completed');
        else if (filterTab === 'deadline') list = list.filter(g => g.deadline && daysLeft(g.deadline) <= 30 && g.status !== 'completed');

        list.sort((a, b) => {
            if (sortBy === 'progress') return (b.progress ?? 0) - (a.progress ?? 0);
            if (sortBy === 'amount') return b.targetAmount - a.targetAmount;
            // deadline: no deadline goes last
            const da = a.deadline ? daysLeft(a.deadline) : 999999;
            const db = b.deadline ? daysLeft(b.deadline) : 999999;
            return da - db;
        });
        return list;
    }, [goals, filterTab, sortBy]);

    const soonDeadline = goals.filter(g => g.deadline && daysLeft(g.deadline) <= 30 && g.status !== 'completed').length;

    // ── Handlers ───────────────────────────────────────────────────
    const handleSave = async (data: any) => {
        try {
            if (editGoal) {
                await updateGoal(editGoal._id, data);
                toast.success('✅ Đã cập nhật mục tiêu!');
            } else {
                await createGoal(data);
                toast.success('🎯 Đã tạo mục tiêu mới!');
            }
            setEditGoal(null);
            setShowForm(false);
        } catch {
            toast.error('Lỗi khi lưu mục tiêu');
            throw new Error('save failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteGoal(id);
            toast.success('🗑 Đã xóa mục tiêu');
        } catch {
            toast.error('Lỗi khi xóa mục tiêu');
        } finally {
            setDeleteConfirm(null);
        }
    };

    const handleDeposit = async (id: string, amount: number, note?: string) => {
        const updated = await deposit(id, amount, note);
        const pct = updated.progress;
        if (pct >= 100) toast.success('🎯 Chúc mừng! Bạn đã đạt mục tiêu!', { duration: 4000 });
        else if (pct >= 75) toast.success('🔥 Almost done! Còn 25% nữa thôi!');
        else if (pct >= 50) toast.success('🚀 Halfway there! Đã đi được nửa chặng!');
        else if (pct >= 25) toast.success('🎉 Good start! Đã đi được 25%!');
        else toast.success(`💰 Đã nạp ${amount.toLocaleString('vi-VN')}₫`);
    };

    const handleWithdraw = async (id: string, amount: number, note?: string) => {
        await withdraw(id, amount, note);
        toast.success(`➖ Đã rút ${amount.toLocaleString('vi-VN')}₫`);
    };

    const tabs: { id: FilterTab; label: string; count?: number }[] = [
        { id: 'all', label: 'Tất cả', count: totalGoals },
        { id: 'active', label: 'Đang thực hiện', count: activeGoals },
        { id: 'completed', label: 'Hoàn thành', count: completedGoals },
        { id: 'deadline', label: '⚡ Sắp hết hạn', count: soonDeadline },
    ];

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            {/* Background gradient */}
            <div className="fixed top-0 left-0 w-full h-80 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(108,99,255,0.12), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-80 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(108,99,255,0.08), transparent)' }} />

            <div className="relative z-10 pb-8">
                {/* ── Header ──────────────────────────────────────── */}
                <header className="pt-4 px-5 pb-3 flex items-center gap-3">
                    <button onClick={() => router.push('/dashboard')}
                        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 active:scale-95 transition-all flex-shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <p className="text-xs text-slate-400 font-medium">Theo dõi</p>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Mục tiêu 🎯</h1>
                    </div>
                    <button onClick={refetch} className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 active:scale-95 transition-all">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </header>

                {/* ── Stats row ──────────────────────────────────── */}
                {goals.length > 0 && (
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
                )}

                {/* ── Filter tabs ────────────────────────────────── */}
                {goals.length > 0 && (
                    <div className="px-5 mb-4">
                        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {tabs.map(tab => (
                                <button key={tab.id} onClick={() => setFilterTab(tab.id)}
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
                            {[['deadline', 'Deadline'], ['progress', 'Tiến độ'], ['amount', 'Số tiền']].map(([val, label]) => (
                                <button key={val} onClick={() => setSortBy(val as any)}
                                    className={cn('px-2 py-1 rounded-lg text-[10px] font-bold transition',
                                        sortBy === val ? 'bg-[#6C63FF]/10 text-[#6C63FF]' : 'text-slate-400 hover:text-slate-600')}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Goal Cards ─────────────────────────────────── */}
                <div className="px-5 space-y-4">
                    {loading && (
                        <div className="space-y-4">
                            {[1, 2].map(i => (
                                <div key={i} className="h-48 rounded-3xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
                            ))}
                        </div>
                    )}

                    {!loading && goals.length === 0 && (
                        <EmptyState onAdd={() => setShowForm(true)} />
                    )}

                    {!loading && filtered.length === 0 && goals.length > 0 && (
                        <div className="text-center py-12">
                            <p className="text-slate-400 dark:text-slate-500 text-sm">Không có mục tiêu nào trong tab này</p>
                        </div>
                    )}

                    {!loading && filtered.map(goal => (
                        <GoalCard
                            key={goal._id}
                            goal={goal}
                            onContribute={() => setContributeGoal(goal)}
                            onEdit={() => { setEditGoal(goal); setShowForm(true); }}
                            onDelete={() => setDeleteConfirm(goal._id)}
                        />
                    ))}
                </div>
            </div>

            {/* ── FAB ───────────────────────────────────────────── */}
            <button
                onClick={() => { setEditGoal(null); setShowForm(true); }}
                className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(108,99,255,0.4)] flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #6C63FF, #8B5CF6)' }}>
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
            </button>

            {/* ── Delete Confirm ────────────────────────────────── */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end px-4 pb-8" onClick={() => setDeleteConfirm(null)}>
                    <div className="w-full bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Xoá mục tiêu?</h3>
                        <p className="text-sm text-slate-500 mb-5">Hành động này không thể hoàn tác.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm">
                                Huỷ
                            </button>
                            <button onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm">
                                🗑 Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modals ────────────────────────────────────────── */}
            <GoalFormModal
                open={showForm}
                onClose={() => { setShowForm(false); setEditGoal(null); }}
                onSave={handleSave}
                editGoal={editGoal}
            />
            <GoalContributeModal
                open={!!contributeGoal}
                onClose={() => setContributeGoal(null)}
                goal={contributeGoal}
                onDeposit={handleDeposit}
                onWithdraw={handleWithdraw}
            />
        </div>
    );
}
