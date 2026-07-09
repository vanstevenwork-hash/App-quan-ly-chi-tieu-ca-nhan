'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useGoals, type Goal } from '@/hooks/useGoals';
import GoalFormModal from '@/components/GoalFormModal';
import GoalContributeModal from '@/components/GoalContributeModal';
import GoalsList from '@/components/goals/GoalsList';
import GoalsStatsAndFilters, { type FilterTab, type SortBy } from '@/components/goals/GoalsStatsAndFilters';
import PageHeader from '@/components/PageHeader';
import { toast } from 'sonner';

function daysLeft(deadline: string): number {
    return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

// ─── Main Page ───────────────────────────────────────────────────

export default function GoalsPage() {
    const { goals, loading, createGoal, updateGoal, deleteGoal, deposit, withdraw, refetch } = useGoals();

    const [showForm, setShowForm] = useState(false);
    const [editGoal, setEditGoal] = useState<Goal | null>(null);
    const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
    const [filterTab, setFilterTab] = useState<FilterTab>('all');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortBy>('deadline');

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

    const handleAddClick = useCallback(() => setShowForm(true), []);
    const handleContributeClick = useCallback((goal: Goal) => setContributeGoal(goal), []);
    const handleEditClick = useCallback((goal: Goal) => { setEditGoal(goal); setShowForm(true); }, []);
    const handleDeleteClick = useCallback((id: string) => setDeleteConfirm(id), []);

    return (
        <div className="min-h-screen pb-32 bg-[#F8F9FF] dark:bg-slate-950 transition-colors duration-200">
            {/* Background gradient blob - dark mode friendly */}
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(224,195,252,0.3), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(139,92,246,0.1), transparent)' }} />

            <div className="relative z-10 pb-8">
                {/* ── Header ──────────────────────────────────────── */}
                <PageHeader
                    title="Mục tiêu 🎯"
                    subtitle="Theo dõi"
                    rightActions={
                        <button onClick={refetch} className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 active:scale-95 transition-all">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    }
                />

                <GoalsStatsAndFilters
                    hasGoals={goals.length > 0}
                    totalGoals={totalGoals}
                    activeGoals={activeGoals}
                    completedGoals={completedGoals}
                    totalSaved={totalSaved}
                    soonDeadline={soonDeadline}
                    filterTab={filterTab}
                    sortBy={sortBy}
                    onFilterChange={setFilterTab}
                    onSortChange={setSortBy}
                />

                {/* ── Goal Cards ─────────────────────────────────── */}
                <GoalsList
                    loading={loading}
                    hasGoals={goals.length > 0}
                    filtered={filtered}
                    onAdd={handleAddClick}
                    onContribute={handleContributeClick}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                />
            </div>

            {/* ── FAB ───────────────────────────────────────────── */}
            <button
                onClick={() => { setEditGoal(null); setShowForm(true); }}
                className="fixed bottom-28 right-5 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(108,99,255,0.4)] flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #6C63FF, #8B5CF6)' }}>
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
            </button>

            {/* ── Delete Confirm ────────────────────────────────── */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end px-4 pb-8" onClick={() => setDeleteConfirm(null)}>
                    <div className="w-full bg-white dark:bg-slate-800 rounded-[20px] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
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
