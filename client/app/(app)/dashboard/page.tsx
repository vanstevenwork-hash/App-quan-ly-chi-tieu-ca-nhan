'use client';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { useMemo, useCallback, useState } from 'react';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import AddTransactionModal from '@/components/AddTransactionModal';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import NotificationPanel from '@/components/NotificationPanel';
import SpendingTrendChart from '@/components/dashboard/SpendingTrendChart';
import RecentTransactionsList from '@/components/dashboard/RecentTransactionsList';
import ImportantAlertsSection from '@/components/dashboard/ImportantAlertsSection';
import GameInvitePopupModal from '@/components/games/GameInvitePopupModal';
import { useAuthStore, useUIStore } from '@/store/useStore';
import { useTransactions } from '@/hooks/useTransactions';
import { toast } from 'sonner';
import { useCards } from '@/hooks/useCards';
import { useNotifications } from '@/hooks/useNotifications';
import { useWealth } from '@/hooks/useWealth';
import { useImportantAlerts } from '@/hooks/useImportantAlerts';
import { resolveCardId, getCappedCashbackTotal } from '@/lib/cashback';
import { useSharedCashback } from '@/hooks/useSharedCashback';
import { useCardShares } from '@/hooks/useCardShares';
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
    const [notiTab, setNotiTab] = useState<'important' | undefined>(undefined);
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
    // Shared cards (e.g. my wife's credit card) are our spending too — fold
    // their cashback into the dashboard badge alongside my own cards'.
    const { sharedCashbackTotal } = useSharedCashback();
    // Map of shared card id → owner name (e.g. wife's), for tagging her card's
    // transactions in the recent list so they're easy to tell apart from mine.
    const { sharedCards } = useCardShares();
    const sharedCardOwners = useMemo(
        () => Object.fromEntries(sharedCards.map(sc => [sc.card._id, sc.owner?.name || 'Thẻ chung'])),
        [sharedCards]
    );
    const ownCashback = useMemo(() => {
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
    const monthCashback = ownCashback + sharedCashbackTotal;
    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase()
        : 'NN';

    const { creditAlerts: allCreditAlerts, savingsAlerts, shareInvites, respondToShare, gameInvites, respondToGame, count: importantCount } = useImportantAlerts();
    const creditAlerts = useMemo(() => allCreditAlerts.slice(0, 2), [allCreditAlerts]);
    const savingsCards = useMemo(() => savingsAlerts.slice(0, 1), [savingsAlerts]);

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
        <div className="min-h-screen pb-28 bg-[#F8F9FF] dark:bg-surface-deep transition-colors duration-200">
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

            {/* ── Header: identity left, actions right — sticky like every other page ── */}
            <header
                className="sticky top-0 z-20 px-5 pb-3 flex items-center gap-3 bg-[#F8F9FF]/80 dark:bg-surface-deep/80 backdrop-blur-lg"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
            >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {user?.avatar ? (
                        <div className="relative rounded-full shadow-[0_6px_14px_-4px_rgba(109,40,217,0.45)] ring-[2.5px] ring-white dark:ring-slate-800 flex-shrink-0">
                            <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                        </div>
                    ) : (
                        <div
                            className="relative w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0"
                            style={{
                                background: 'radial-gradient(circle at 32% 28%, #B8A6FF 0%, #8B7CF6 35%, #6C63FF 65%, #5B21B6 100%)',
                                boxShadow: 'inset 0 1.5px 2px rgba(255,255,255,0.55), inset 0 -4px 8px rgba(35,15,80,0.35), 0 6px 14px -4px rgba(109,40,217,0.55)',
                            }}
                        >
                            <div aria-hidden className="absolute top-1.5 left-2 w-3.5 h-2 rounded-full bg-white/40 blur-[2px]" />
                            <span className="relative">{initials}</span>
                        </div>
                    )}
                    <p className="text-slate-800 dark:text-white font-bold text-base truncate">{user?.name || 'Người dùng'}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                        href="/search"
                        className="w-10 h-10 bg-white dark:bg-surface rounded-full border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-500 dark:text-slate-400 hover:border-purple-200 transition-colors active:scale-90"
                    >
                        <CustomIcon type="search" size={18} tile={false} color="currentColor" className="w-[18px] h-[18px]" />
                    </Link>
                    <button
                        onClick={() => { setAddType('expense'); setAutoOpenScanner(true); openAddModal(); }}
                        className="w-10 h-10 bg-white dark:bg-surface rounded-full border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-500 dark:text-slate-400 hover:border-purple-200 transition-colors active:scale-90"
                    >
                        <CustomIcon type="scanLine" size={18} tile={false} color="currentColor" className="w-[18px] h-[18px]" />
                    </button>
                    <button
                        onClick={() => { setNotiTab(undefined); setShowNoti(true); }}
                        className="w-10 h-10 bg-white dark:bg-surface rounded-full border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center relative text-slate-500 dark:text-slate-400 hover:border-purple-200 transition-colors active:scale-90"
                    >
                        <CustomIcon type="bell" size={18} tile={false} color="currentColor" className="w-[18px] h-[18px]" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-white dark:border-slate-800 animate-pulse" />
                        )}
                    </button>
                </div>
            </header>

            <main className="px-5 space-y-5">

                {/* ── Asset card: light lavender / dark navy→purple with aurora glow ── */}
                <div className="anim-scale-in relative overflow-hidden rounded-[20px] p-5 shadow-[0_4px_20px_-2px_rgba(139,92,246,0.12)] dark:shadow-xl bg-gradient-to-br from-white to-[#F5F3FF] dark:from-[#191E36] dark:via-[#151829] dark:to-[#141224] border border-[#E9D5FF] dark:border-slate-700/50">
                    {/* Aurora glow — confined to the bottom-right corner, card stays mostly dark navy */}
                    <div aria-hidden className="absolute inset-0 pointer-events-none">
                        {/* deep-purple bloom hugging the corner */}
                        <div
                            className="absolute -bottom-24 -right-24 w-72 h-56 opacity-35 dark:opacity-70"
                            style={{ background: 'radial-gradient(ellipse at center, rgba(109,40,217,0.45) 0%, rgba(91,33,182,0.22) 45%, transparent 70%)', filter: 'blur(24px)' }}
                        />
                        {/* small bright core, right at the corner */}
                        <div
                            className="absolute -bottom-14 -right-6 w-40 h-28 opacity-30 dark:opacity-60"
                            style={{ background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.45) 0%, transparent 65%)', filter: 'blur(14px)' }}
                        />
                        {/* silk light-lines, right half only */}
                        <svg className="absolute bottom-0 right-0 w-2/3 h-24 opacity-20 dark:opacity-35" viewBox="0 0 260 96" fill="none" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="assetSilk" x1="0" y1="0" x2="260" y2="0" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#C4B5FD" stopOpacity="0" />
                                    <stop offset="0.6" stopColor="#C4B5FD" stopOpacity="0.8" />
                                    <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <path d="M0 96 C 90 64, 170 92, 260 36" stroke="url(#assetSilk)" strokeWidth="0.8" />
                            <path d="M20 100 C 110 74, 190 96, 260 50" stroke="url(#assetSilk)" strokeWidth="0.6" />
                            <path d="M60 104 C 140 86, 210 100, 260 66" stroke="url(#assetSilk)" strokeWidth="0.5" />
                            <path d="M110 106 C 175 96, 225 104, 260 82" stroke="url(#assetSilk)" strokeWidth="0.4" />
                        </svg>
                        {/* rim light, bottom-right edge only */}
                        <div className="absolute bottom-0 right-6 left-1/2 h-px bg-gradient-to-r from-transparent via-purple-400/30 dark:via-purple-300/50 to-transparent" />
                    </div>

                    <div className="relative z-10">
                        {/* Label + eye toggle left, cashback coin badge right */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-1.5">
                                <Link href="/wealth" className="text-slate-500 dark:text-slate-300 text-sm font-medium hover:text-purple-500 dark:hover:text-white transition-colors">Tài sản ròng</Link>
                                <button onClick={() => setHideBalance(v => !v)} className="text-slate-400 hover:text-purple-500 dark:hover:text-white transition-colors">
                                    {hideBalance ? <CustomIcon type="eyeOff" size={16} tile={false} color="currentColor" className="w-4 h-4" /> : <CustomIcon type="eye" size={16} tile={false} color="currentColor" className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Cashback badge — always shown, even at 0, so the feature is discoverable */}
                            <Link href="/cashback"
                                className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-black/25 hover:bg-amber-100 dark:hover:bg-black/35 transition-colors pl-1.5 pr-2.5 py-1 rounded-full border border-amber-100 dark:border-white/10 flex-shrink-0">
                                <span className="text-base leading-none flex-shrink-0">🪙</span>
                                <span className="text-amber-700 dark:text-amber-300 text-xs font-bold whitespace-nowrap">
                                    {monthCashback > 0 ? `+${fmtFull(monthCashback)}đ` : '0đ'}
                                </span>
                            </Link>
                        </div>

                        <p className="text-slate-800 dark:text-white text-[30px] font-bold tracking-tight leading-none text-money">
                            {hideBalance ? '*******' : `${fmtFull(netWorth)}đ`}
                        </p>

                        {/* Thu/Chi — value on top, label below, split by divider */}
                        <div className="flex items-center gap-6 mt-5">
                            <Link href="/analytics" className="group">
                                <p className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                                    <UtilityIcon type="trendingUp" size={14} tile={false} color="#10B981" /> +{fmt(summary.income)}
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors">Thu nhập</p>
                            </Link>
                            <div className="w-px h-9 bg-slate-200 dark:bg-white/15" />
                            <Link href="/analytics" className="group">
                                <p className="inline-flex items-center gap-1 text-red-500 dark:text-red-400 text-sm font-bold">
                                    <UtilityIcon type="trendingDown" size={14} tile={false} color="#EF4444" /> -{fmt(summary.expense)}
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors">Chi tiêu</p>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* ── Savings & card debt shortcut tiles ── */}
                <div className="anim-fade-up-d1 grid grid-cols-2 gap-3">
                    <Link href="/savings"
                        className="bg-white dark:bg-surface rounded-xl p-3 flex items-center gap-3 border border-gray-100 dark:border-slate-700 shadow-sm hover:border-purple-200 dark:hover:border-purple-500/40 hover:shadow-md transition-all active:scale-95 group">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tiết kiệm</p>
                            <p className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 text-money leading-tight truncate">
                                {hideBalance ? '••' : fmt(totalSavings)}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                                {cards.filter(c => c.cardType === 'savings').length > 0
                                    ? `${cards.filter(c => c.cardType === 'savings').length} sổ tiết kiệm`
                                    : 'Chưa có sổ nào'}
                            </p>
                        </div>
                        <CustomIcon type="chevronRight" size={16} tile={false} color="currentColor" className="anim-arrow-d1 w-4 h-4 text-purple-400 flex-shrink-0" />
                    </Link>
                    <Link href="/cards"
                        className="bg-white dark:bg-surface rounded-xl p-3 flex items-center gap-3 border border-gray-100 dark:border-slate-700 shadow-sm hover:border-blue-200 dark:hover:border-blue-500/40 hover:shadow-md transition-all active:scale-95 group">
                        {/* <div className="w-11 h-11 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <CustomIcon type="creditCard" size={20} tile={false} color="currentColor" className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                        </div> */}
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Dư nợ thẻ</p>
                            <p className="text-[15px] font-bold text-red-500 text-money leading-tight truncate">
                                {hideBalance ? '••' : (totalDebt > 0 ? `-${fmt(totalDebt)}` : '0')}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                                {cards.filter(c => c.cardType === 'credit').length > 0
                                    ? `${cards.filter(c => c.cardType === 'credit').length} thẻ tín dụng`
                                    : 'Chưa có thẻ nào'}
                            </p>
                        </div>
                        <CustomIcon type="chevronRight" size={16} tile={false} color="currentColor" className="anim-arrow-d2 w-4 h-4 text-purple-400 flex-shrink-0" />
                    </Link>
                </div>


                {/* ── Important notifications ──────────────────────── */}
                <ImportantAlertsSection
                    creditAlerts={creditAlerts}
                    savingsCards={savingsCards}
                    shareInvites={shareInvites}
                    onRespondShare={respondToShare}
                    gameInvites={gameInvites}
                    onRespondGame={respondToGame}
                    totalCount={importantCount}
                    onOpen={() => { setNotiTab('important'); setShowNoti(true); }}
                />

                {/* ── Spending trend chart ─────────────────────────── */}
                <SpendingTrendChart transactions={transactions} />

                {/* ── Recent transactions ──────────────────────────── */}
                <RecentTransactionsList
                    transactions={transactions}
                    cards={cards}
                    sharedCardOwners={sharedCardOwners}
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
                <CustomIcon type="plus" size={28} tile={false} color="currentColor" className="w-7 h-7 text-white" />
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
            <NotificationPanel open={showNoti} onClose={() => setShowNoti(false)} initialTab={notiTab} />
            <GameInvitePopupModal invites={gameInvites} onRespond={respondToGame} />
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

