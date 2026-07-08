'use client';
import { useMemo, useCallback, useState } from 'react';
import {
    Bell, Plus, Eye, EyeOff, TrendingUp, TrendingDown,
    ChevronRight, Search, ScanLine,
} from 'lucide-react';
import AddTransactionModal from '@/components/AddTransactionModal';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import NotificationPanel from '@/components/NotificationPanel';
import SpendingTrendChart from '@/components/dashboard/SpendingTrendChart';
import RecentTransactionsList from '@/components/dashboard/RecentTransactionsList';
import ImportantAlertsSection from '@/components/dashboard/ImportantAlertsSection';
import { useAuthStore, useUIStore } from '@/store/useStore';
import { useTransactions } from '@/hooks/useTransactions';
import { toast } from 'sonner';
import { useCards } from '@/hooks/useCards';
import { useNotifications } from '@/hooks/useNotifications';
import { useWealth } from '@/hooks/useWealth';
import { getDueThisCycle } from '@/lib/cardDue';
import { resolveCardId, getCappedCashbackTotal } from '@/lib/cashback';
import Link from 'next/link';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return `${n}`;
};
const fmtFull = (n: number) => n.toLocaleString('vi-VN');

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const { user } = useAuthStore();
    const { isAddModalOpen, openAddModal, closeAddModal } = useUIStore();
    const [showNoti, setShowNoti] = useState(false);
    const [addType, setAddType] = useState<'expense' | 'income'>('expense');
    const [autoOpenScanner, setAutoOpenScanner] = useState(false);
    const [hideBalance, setHideBalance] = useState(true);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [selectedTx, setSelectedTx] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<any>(null);

    // ── Real data ──
    const { transactions, summary, refetch, deleteTransaction } = useTransactions();
    const { cards, totalBalance, totalDebt } = useCards();
    const { unreadCount } = useNotifications();
    const { sources: wealthSources, total: wealthTotal } = useWealth();

    // ── Derived values ──
    const netWorth = totalBalance + wealthTotal - totalDebt;
    const totalSavings = useMemo(
        () => cards.filter(c => c.cardType === 'savings').reduce((s, c) => s + c.balance, 0),
        [cards]
    );

    const creditCardsForCashback = useMemo(() => cards.filter(c => c.cardType === 'credit'), [cards]);
    const monthCashback = useMemo(() => {
        const now = new Date();
        return creditCardsForCashback.reduce((sum, card) => {
            const cardMonthTxs = transactions.filter(t => {
                if (t.type !== 'expense' || t.paymentMethod !== 'card' || resolveCardId(t) !== card._id) return false;
                const d = new Date(t.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
            return sum + getCappedCashbackTotal(cardMonthTxs, card.cashbackRate, card.cashbackCap);
        }, 0);
    }, [creditCardsForCashback, transactions]);
    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase()
        : 'NN';

    const creditAlerts = useMemo(
        () => cards
            .filter(c => c.cardType === 'credit' && c.balance > 0)
            .map(card => ({ card, dueThisCycle: getDueThisCycle(card.balance, transactions, card._id) }))
            .filter(x => x.dueThisCycle > 0)
            .slice(0, 2),
        [cards, transactions]
    );
    const savingsCards = useMemo(
        () => cards.filter(c => c.cardType === 'savings').slice(0, 1),
        [cards]
    );

    // ── Chart data: last 7 days expenses & income ──
    const chartData = useMemo(() => {
        const days: Record<string, { expense: number, income: number }> = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86_400_000);
            days[`${d.getDate()}/${d.getMonth() + 1}`] = { expense: 0, income: 0 };
        }
        transactions.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getDate()}/${d.getMonth() + 1}`;
            if (key in days) {
                if (t.type === 'expense') days[key].expense -= t.amount;
                if (t.type === 'income') days[key].income += t.amount;
            }
        });
        return Object.entries(days).map(([name, data], i, arr) => ({
            name: i === arr.length - 1 ? 'Hôm nay' : name,
            expense: data.expense,
            income: data.income,
        }));
    }, [transactions]);

    const handleEditTx = (tx: any) => {
        setIsDetailOpen(false);
        setEditingTx(tx);
        openAddModal();
    };

    const handleDeleteTx = async (id: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) {
            try {
                await deleteTransaction(id);
                toast.success('Đã xóa giao dịch');
                setIsDetailOpen(false);
                setSelectedTx(null);
            } catch (err) {
                toast.error('Xóa giao dịch thất bại');
            }
        }
    };

    const handleSelectTx = useCallback((t: any) => { setSelectedTx(t); setIsDetailOpen(true); }, []);
    const handleAddFirstTx = useCallback(() => { setAddType('expense'); openAddModal(); }, [openAddModal]);

    return (
        <div className="min-h-screen pb-28 bg-[#F8F9FF] dark:bg-slate-900 transition-colors duration-200">
            <style>{`
                @keyframes arrowSlide {
                    0%,100% { transform: translateX(0); opacity: 1; }
                    40%     { transform: translateX(5px); opacity: 0.6; }
                    60%     { transform: translateX(5px); opacity: 0.6; }
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.93); }
                    to   { opacity: 1; transform: scale(1); }
                }
                @keyframes pulseGlow {
                    0%,100% { opacity: 1; transform: scale(1); }
                    50%     { opacity: 0.7; transform: scale(1.15); }
                }
                .anim-arrow { animation: arrowSlide 2s ease-in-out infinite; }
                .anim-arrow-d1 { animation: arrowSlide 2s ease-in-out infinite 0.3s; }
                .anim-arrow-d2 { animation: arrowSlide 2s ease-in-out infinite 0.6s; }
                .anim-fade-up { animation: fadeUp 0.5s ease both; }
                .anim-fade-up-d1 { animation: fadeUp 0.5s ease 0.1s both; }
                .anim-fade-up-d2 { animation: fadeUp 0.5s ease 0.2s both; }
                .anim-fade-up-d3 { animation: fadeUp 0.5s ease 0.3s both; }
                .anim-fade-up-d4 { animation: fadeUp 0.5s ease 0.4s both; }
                .anim-scale-in  { animation: scaleIn 0.4s ease both; }
                .anim-pulse-icon { animation: pulseGlow 2.5s ease-in-out infinite; }
            `}</style>

            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="px-5 pb-3 flex items-center gap-2.5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
                <Link
                    href="/search"
                    className="flex-1 min-w-0 h-11 pl-4 pr-3 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-between text-slate-400 dark:text-slate-500 hover:border-purple-200 dark:hover:border-purple-500/50 transition-colors active:scale-[0.98]"
                >
                    <span className="text-sm">Tìm kiếm...</span>
                    <Search className="w-4 h-4 flex-shrink-0" />
                </Link>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => { setAddType('expense'); setAutoOpenScanner(true); openAddModal(); }}
                        className="w-11 h-11 bg-white dark:bg-slate-800 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-500 dark:text-slate-400 hover:border-purple-200 transition-colors active:scale-90"
                    >
                        <ScanLine className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setShowNoti(true)}
                        className="w-11 h-11 bg-white dark:bg-slate-800 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center relative text-slate-500 dark:text-slate-400 hover:border-purple-200 transition-colors active:scale-90"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-white animate-pulse" />
                        )}
                    </button>
                </div>
            </header>

            <main className="px-5 space-y-5">

                {/* ── Asset card: same layout for light & dark mode ── */}
                <div className="anim-scale-in relative overflow-hidden rounded-[24px] p-5 shadow-[0_4px_20px_-2px_rgba(139,92,246,0.12)] dark:shadow-xl bg-gradient-to-br from-white to-[#F5F3FF] dark:from-[#1B1E30] dark:via-[#15182A] dark:to-[#0F1120] border border-[#E9D5FF] dark:border-slate-700/40">
                    <div className="hidden dark:block absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'linear-gradient(115deg, transparent 40%, white 50%, transparent 60%)' }} />
                    <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none bg-purple-300/25 dark:bg-purple-500/10" />

                    <div className="relative z-10">
                        {/* Avatar + name + cashback badge, all in one row */}
                        <div className="flex items-center gap-2.5 mb-4">
                            {user?.avatar ? (
                                <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-white/10 flex-shrink-0" />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {initials}
                                </div>
                            )}
                            <p className="text-slate-800 dark:text-white font-bold text-[15px] truncate flex-1 min-w-0">{user?.name || 'Người dùng'}</p>

                            {/* Cashback badge — always shown, even at 0, so the feature is discoverable */}
                            <Link href="/cashback"
                                className="inline-flex items-center gap-1 bg-amber-50 dark:bg-black/25 hover:bg-amber-100 dark:hover:bg-black/35 transition-colors px-2 py-1 rounded-full border border-amber-100 dark:border-transparent flex-shrink-0">
                                <span className="text-sm leading-none flex-shrink-0">🪙</span>
                                <span className="text-amber-700 dark:text-amber-300 text-[11px] font-bold whitespace-nowrap">
                                    {monthCashback > 0 ? `+${fmtFull(monthCashback)}đ` : '0đ'}
                                </span>
                            </Link>
                        </div>

                        {/* Net worth label + toggle */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Link href="/wealth" className="text-slate-400 text-xs font-medium hover:text-purple-500 dark:hover:text-slate-300 transition-colors">Tài sản ròng</Link>
                            <button onClick={() => setHideBalance(v => !v)} className="text-slate-400 hover:text-purple-500 dark:hover:text-white transition-colors">
                                {hideBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        <p className="text-slate-800 dark:text-white text-[26px] font-bold tracking-tight leading-none text-money mb-3">
                            {hideBalance ? '********' : `${fmtFull(netWorth)}đ`}
                        </p>

                        {/* Thu/Chi */}
                        <div className="flex items-center gap-2.5">
                            <Link href="/analytics" className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                                <TrendingUp className="w-3 h-3" /> +{fmt(summary.income)}
                            </Link>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <Link href="/analytics" className="inline-flex items-center gap-1 text-red-500 dark:text-red-400 text-xs font-bold">
                                <TrendingDown className="w-3 h-3" /> -{fmt(summary.expense)}
                            </Link>
                        </div>
                    </div>
                </div>

                {/* ── Savings & card debt (separate from net worth card) ── */}
                <div className="anim-fade-up-d1 grid grid-cols-2 gap-3">
                    <Link href="/savings"
                        className="bg-white dark:bg-slate-800 rounded-xl p-2.5 pl-3 flex flex-col items-start border border-gray-100 dark:border-slate-700 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-900/50 hover:shadow-md transition-all active:scale-95 group">
                        <div className="w-full flex justify-between items-start mb-1">
                            <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tiết kiệm</p>
                                <p className="text-lg font-bold mt-1 text-money text-left text-emerald-600 dark:text-emerald-400">
                                    {hideBalance ? '••' : fmt(totalSavings)}
                                </p>
                            </div>
                            <ChevronRight className="anim-arrow-d1 w-4 h-4 text-purple-400 dark:text-purple-400" />
                        </div>

                        {cards.filter(c => c.cardType === 'savings').length > 0 ?
                            <p className="text-[10px] text-slate-400 mt-0.5">{cards.filter(c => c.cardType === 'savings').length} sổ tiết kiệm</p>
                            : <p className="text-[10px] text-slate-400 mt-0.5">Bạn chưa có sổ tiết kiệm</p>}
                    </Link>
                    <Link href="/cards"
                        className="bg-white dark:bg-slate-800 rounded-xl p-2.5 pl-3 flex flex-col items-start border border-gray-100 dark:border-slate-700 shadow-sm hover:border-red-200 dark:hover:border-red-900/50 hover:shadow-md transition-all active:scale-95 group">
                        <div className="w-full flex justify-between items-start mb-1">
                            <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Dư nợ thẻ</p>
                                <p className="text-lg font-bold text-red-500 mt-1 text-money text-left">
                                    {hideBalance ? '••' : (totalDebt > 0 ? `-${fmt(totalDebt)}` : '0')}
                                </p>
                            </div>
                            <ChevronRight className="anim-arrow-d2 w-4 h-4 text-purple-400 dark:text-purple-400" />
                        </div>

                        {cards.filter(c => c.cardType === 'credit').length > 0 && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{cards.filter(c => c.cardType === 'credit').length} thẻ tín dụng</p>
                        )}
                    </Link>
                </div>


                {/* ── Important notifications ──────────────────────── */}
                <ImportantAlertsSection
                    creditAlerts={creditAlerts}
                    savingsCards={savingsCards}
                />

                {/* ── Spending trend chart ─────────────────────────── */}
                <SpendingTrendChart chartData={chartData} />

                {/* ── Recent transactions ──────────────────────────── */}
                <RecentTransactionsList
                    transactions={transactions}
                    onSelectTx={handleSelectTx}
                    onAddFirst={handleAddFirstTx}
                />

            </main >

            {/* ── FAB ──────────────────────────────────────────────── */}
            <button
                onClick={() => { setAddType('expense'); openAddModal(); }}
                className="fixed bottom-28 right-5 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.4)] flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)' }}
            >
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
            </button>

            {/* ── Modals ───────────────────────────────────────────── */}
            <AddTransactionModal
                open={isAddModalOpen}
                onClose={() => { closeAddModal(); setEditingTx(null); setAutoOpenScanner(false); }}
                onSaved={refetch}
                defaultType={addType}
                initialData={editingTx}
                autoOpenScanner={autoOpenScanner}
            />
            <NotificationPanel open={showNoti} onClose={() => setShowNoti(false)} />
            <TransactionDetailModal
                open={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                transaction={selectedTx}
                onEdit={handleEditTx}
                onDelete={handleDeleteTx}
            />
        </div>
    );
}

