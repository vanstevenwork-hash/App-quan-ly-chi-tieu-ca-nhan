'use client';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { useMemo, useCallback, useState } from 'react';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import RecentTransactionsList from '@/components/dashboard/RecentTransactionsList';
import ImportantAlertsSection from '@/components/dashboard/ImportantAlertsSection';
import dynamic from 'next/dynamic';

// ── Code-split heavy / interaction-only pieces out of the dashboard's initial JS.
// Modals render nothing until opened; the trend chart drags in recharts, so it
// streams in behind a skeleton instead of blocking first paint. ─────────────────
const SpendingTrendChart = dynamic(() => import('@/components/dashboard/SpendingTrendChart'), {
    ssr: false,
    loading: () => (
        <div>
            <div className="h-5 w-40 rounded-md bg-slate-200/70 dark:bg-slate-700/50 animate-pulse mb-2.5" />
            <div className="h-[236px] rounded-2xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-700 animate-pulse" />
        </div>
    ),
});
const AddTransactionModal = dynamic(() => import('@/components/AddTransactionModal'), { ssr: false });
const TransactionDetailModal = dynamic(() => import('@/components/TransactionDetailModal'), { ssr: false });
const NotificationPanel = dynamic(() => import('@/components/NotificationPanel'), { ssr: false });
const GameInvitePopupModal = dynamic(() => import('@/components/games/GameInvitePopupModal'), { ssr: false });
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
import { formatNumber } from '@/lib/utils';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return `${n}`;
};
const fmtFull = formatNumber;

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
    const savingsCount = useMemo(() => cards.filter(c => c.cardType === 'savings').length, [cards]);
    const creditCount = useMemo(() => cards.filter(c => c.cardType === 'credit').length, [cards]);

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
            return sum + getCappedCashbackTotal(cardMonthTxs, card.cashbackRate, card.cashbackCap, card.cashbackMinSpend);
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
        <div className="relative min-h-screen pb-28 bg-gradient-to-b from-[#F3EEFF] via-[#F8F9FF] to-[#F5F3FF] dark:from-[#141026] dark:via-[#0C0A16] dark:to-[#08070F] transition-colors duration-200">
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

            {/* ── Page ambience: soft brand glows behind everything ── */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[130%] h-80 opacity-40 dark:opacity-70"
                    style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.4) 0%, transparent 70%)', filter: 'blur(50px)' }} />
                <div className="absolute top-28 -right-24 w-72 h-72 rounded-full opacity-30 dark:opacity-55"
                    style={{ background: 'radial-gradient(circle at center, rgba(167,139,250,0.35) 0%, transparent 70%)', filter: 'blur(60px)' }} />
                <div className="absolute top-72 -left-24 w-72 h-72 rounded-full opacity-25 dark:opacity-45"
                    style={{ background: 'radial-gradient(circle at center, rgba(99,102,241,0.3) 0%, transparent 70%)', filter: 'blur(60px)' }} />
            </div>

            {/* ── Header: identity left, actions right — sticky like every other page ── */}
            <header
                className="sticky top-0 z-20 px-5 pb-2 flex items-center gap-3 bg-[#F5F3FF]/70 dark:bg-[#0C0A16]/70 backdrop-blur-lg"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.625rem)' }}
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
                    <div className="min-w-0 flex flex-col items-start gap-1">
                        <p className="text-slate-800 dark:text-white font-bold text-base truncate max-w-full">{user?.name || 'Người dùng'}</p>
                        {/* Cashback this month — moved up here, right under the name */}
                        <Link href="/cashback"
                            className="inline-flex items-center gap-1 bg-amber-50 dark:bg-black/25 hover:bg-amber-100 dark:hover:bg-black/35 transition-colors pl-1 pr-2 py-0.5 rounded-full border border-amber-100 dark:border-white/10">
                            <span className="text-sm leading-none flex-shrink-0">🪙</span>
                            <span className="text-amber-700 dark:text-amber-300 text-[11px] font-bold whitespace-nowrap">
                                {monthCashback > 0 ? `+${fmtFull(monthCashback)}đ` : '0đ'}
                            </span>
                        </Link>
                    </div>
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

            <main className="px-5 space-y-3">

                {/* ── Net worth — boxless, sits directly on the page background ── */}
                <div className="anim-scale-in relative px-1 pt-1 pb-1">
                    {/* Label + eye toggle */}
                    <div className="flex items-center gap-1.5">
                        <Link href="/wealth" className="text-slate-400 dark:text-slate-400 text-[15px] font-bold hover:text-purple-500 dark:hover:text-purple-300 transition-colors">Tài sản ròng</Link>
                        <button onClick={() => setHideBalance(v => !v)} className="text-slate-400 hover:text-purple-500 dark:hover:text-white transition-colors">
                            {hideBalance ? <CustomIcon type="eyeOff" size={15} tile={false} color="currentColor" className="w-[15px] h-[15px]" /> : <CustomIcon type="eye" size={15} tile={false} color="currentColor" className="w-[15px] h-[15px]" />}
                        </button>
                    </div>

                    <Link href="/wealth" className="inline-block text-slate-800 dark:text-white text-[21px] font-bold tracking-tight leading-none text-money mt-2.5 hover:opacity-80 transition-opacity">
                        {hideBalance ? '*******' : `${fmtFull(netWorth)}đ`}
                    </Link>

                    {/* Thu / Chi — plain coloured text + icon, no pill, no labels */}
                    <div className="flex items-center gap-4 mt-2.5">
                        <Link href="/analytics" className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[13px] font-bold tabular-nums active:scale-95 transition">
                            <UtilityIcon type="trendingUp" size={15} tile={false} color="#10B981" />
                            +{fmt(summary.income)}
                        </Link>
                        <Link href="/analytics" className="inline-flex items-center gap-1 text-red-500 dark:text-red-400 text-[13px] font-bold tabular-nums active:scale-95 transition">
                            <UtilityIcon type="trendingDown" size={15} tile={false} color="#EF4444" />
                            -{fmt(summary.expense)}
                        </Link>
                    </div>
                </div>

                {/* ── Savings & card debt shortcut tiles ── */}
                <div className="anim-fade-up-d1 grid grid-cols-2 gap-3">
                    <Link href="/savings"
                        className="bg-white dark:bg-surface rounded-xl px-3 pt-2 pb-3 flex items-center gap-3 border border-gray-100 dark:border-slate-700 shadow-sm hover:border-purple-200 dark:hover:border-purple-500/40 hover:shadow-md transition-all active:scale-95 group">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tiết kiệm</p>
                            <p className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 text-money leading-tight truncate">
                                {hideBalance ? '••' : fmt(totalSavings)}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                                {savingsCount > 0 ? `${savingsCount} sổ tiết kiệm` : 'Chưa có sổ nào'}
                            </p>
                        </div>
                        <CustomIcon type="chevronRight" size={16} tile={false} color="currentColor" className="anim-arrow-d1 w-4 h-4 text-purple-400 flex-shrink-0" />
                    </Link>
                    <Link href="/cards"
                        className="bg-white dark:bg-surface rounded-xl px-3 pt-2 pb-3 flex items-center gap-3 border border-gray-100 dark:border-slate-700 shadow-sm hover:border-blue-200 dark:hover:border-blue-500/40 hover:shadow-md transition-all active:scale-95 group">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Dư nợ thẻ</p>
                            <p className="text-[15px] font-bold text-red-500 text-money leading-tight truncate">
                                {hideBalance ? '••' : (totalDebt > 0 ? `-${fmt(totalDebt)}` : '0')}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                                {creditCount > 0 ? `${creditCount} thẻ tín dụng` : 'Chưa có thẻ nào'}
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

