'use client';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useBanks } from '@/hooks/useBanks';
import { useCardShares } from '@/hooks/useCardShares';
import { cardSharesApi } from '@/lib/api';
import { getBankLogo } from '@/lib/bankLogos';
import CardFormModal from '@/components/CardFormModal';
import AddTransactionModal from '@/components/AddTransactionModal';
import CardPaymentModal from '@/components/CardPaymentModal';
import CreditCardCarousel from '@/components/cards/CreditCardCarousel';
import PaymentAccountsList from '@/components/cards/PaymentAccountsList';
import PaymentAlertsCard from '@/components/cards/PaymentAlertsCard';
import CreditCardHistoryList from '@/components/cards/CreditCardHistoryList';
import PageHeader from '@/components/PageHeader';
import { useUIStore } from '@/store/useStore';
import { useRouter } from 'next/navigation';
import { resolveCardId, getCappedCashbackTotal } from '@/lib/cashback';
import { getDueThisCycle } from '@/lib/cardDue';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

// ── Real cashback for a shared card: combines the owner's + my own spend on
// it this month, so the shared cap is reflected correctly (a partial number
// counting only "my" transactions could easily be wrong or misleadingly high).
function SharedCardCashbackBadge({ cardId }: { cardId: string }) {
    const [data, setData] = useState<{ cashbackEarned: number; capped: boolean } | null>(null);

    useEffect(() => {
        let alive = true;
        cardSharesApi.getCashback(cardId)
            .then(res => { if (alive) setData(res.data?.data || null); })
            .catch(() => { if (alive) setData(null); });
        return () => { alive = false; };
    }, [cardId]);

    if (!data || data.cashbackEarned <= 0) return null;
    return (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5 truncate">
            🪙 +{fmt(data.cashbackEarned)}đ hoàn tiền tháng này{data.capped ? ' · đã chạm trần' : ''}
        </p>
    );
}

// ── Days until next payment -------------------------------------------------
function daysUntilPayment(paymentDueDay: number): number | null {
    if (!paymentDueDay) return null;
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), paymentDueDay);
    if (due <= now) due.setMonth(due.getMonth() + 1);
    return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CardsPage() {
    const { cards, totalDebt, totalCreditLimit, loading, createCard, updateCard, deleteCard, setDefaultCard, refetch: refetchCards } = useCards();
    const { isAddModalOpen, openAddModal, closeAddModal } = useUIStore();
    const { transactions, refetch: refetchTx } = useTransactions();
    const { banks: fetchedBanks, fetchBanks } = useBanks();
    const router = useRouter();
    const historyRef = useRef<HTMLDivElement>(null);
    const { sharedCards } = useCardShares();

    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    const [showForm, setShowForm] = useState(false);
    const [editCard, setEditCard] = useState<Card | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [addType] = useState<'expense'>('expense');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);


    const creditCards = useMemo(() => cards.filter(c => c.cardType === 'credit'), [cards]);
    const accounts = useMemo(() => cards.filter(c => ['debit', 'eWallet', 'crypto'].includes(c.cardType)), [cards]);

    // O(1) fast path for the common exact-shortName match; falls back to the
    // original substring scan only for the rare case a card's shortName doesn't match.
    const banksByShortName = useMemo(() => {
        const map = new Map<string, any>();
        fetchedBanks.forEach((b: any) => {
            if (b.shortName) map.set(b.shortName.toUpperCase(), b);
        });
        return map;
    }, [fetchedBanks]);

    const findApiBank = useCallback((bankShortName?: string, bankName?: string) => {
        const direct = banksByShortName.get((bankShortName || '').toUpperCase());
        if (direct) return direct;
        return fetchedBanks.find((b: any) => b.name?.toUpperCase().includes((bankName || '').toUpperCase()));
    }, [banksByShortName, fetchedBanks]);

    // ── Cashback per card, using each card's own real cashbackRate ──────────
    const now = new Date();

    const cardCashbacks = useMemo(() => {
        return creditCards.map(card => {
            const cardTxs = transactions.filter(t =>
                t.type === 'expense' && t.paymentMethod === 'card' && resolveCardId(t) === card._id
            );
            const monthTxs = cardTxs.filter(t => { const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
            const yearTxs = cardTxs.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
            const monthTotal = getCappedCashbackTotal(monthTxs, card.cashbackRate, card.cashbackCap, card.cashbackMinSpend);
            const yearTotal = getCappedCashbackTotal(yearTxs, card.cashbackRate, card.cashbackCap, card.cashbackMinSpend);
            return { card, monthTotal, yearTotal };
        }).sort((a, b) => b.monthTotal - a.monthTotal);
    }, [creditCards, transactions]);

    const cashbackTotal = useMemo(() => cardCashbacks.reduce((sum, c) => sum + c.monthTotal, 0), [cardCashbacks]);
    const yearlyCashback = useMemo(() => cardCashbacks.reduce((sum, c) => sum + c.yearTotal, 0), [cardCashbacks]);

    // Installment plans
    const installmentPlans = useMemo(() =>
        transactions.filter(t => (t as any).isInstallment && (t as any).installmentMonths > 0)
            .map(t => {
                const startDate = (t as any).installmentStartDate ? new Date((t as any).installmentStartDate) : new Date(t.date);
                const months = (t as any).installmentMonths as number;
                const monthly = (t as any).installmentMonthly as number;
                const now = new Date();
                const elapsed = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
                const remaining = Math.max(0, months - elapsed);
                const paid = Math.min(elapsed, months);
                return { t, months, monthly, remaining, paid, startDate };
            }).filter(p => p.remaining > 0),
        [transactions]);

    // ── Payment alerts (cards with amount due this cycle and due within 30d) ─
    // Uses dueThisCycle (not raw balance) so a card mid-installment doesn't
    // alert for the full remaining principal — only what's actually owed
    // by the next due date.
    const paymentAlerts = useMemo(() =>
        creditCards
            .map(c => ({ card: c, dueThisCycle: getDueThisCycle(c.balance, transactions, c._id), days: daysUntilPayment(c.paymentDueDay) }))
            .filter(x => x.dueThisCycle > 0 && x.card.paymentDueDay > 0)
            .filter(x => x.days !== null && x.days <= 30)
            .sort((a, b) => (a.days ?? 99) - (b.days ?? 99))
        , [creditCards, transactions]);

    // ── Credit card transactions ─────────────────────────────────────────────
    const creditCardTxs = useMemo(() =>
        transactions
            .filter(t => t.paymentMethod === 'card')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        [transactions]);

    const handleSave = async (data: Parameters<typeof createCard>[0]) => {
        if (editCard) await updateCard(editCard._id, data);
        else await createCard(data);
        setEditCard(null);
    };

    const handleEditCard = useCallback((card: Card) => { setEditCard(card); setShowForm(true); }, []);
    const handleDeleteCardClick = useCallback((id: string) => setDeleteConfirmId(id), []);
    const handlePayClick = useCallback(() => setShowPayment(true), []);
    const handleAddNewCard = useCallback(() => { setEditCard(null); setShowForm(true); }, []);

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep transition-colors duration-200">
            {/* Background gradient blob */}
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(199,210,254,0.4), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(139,92,246,0.1), transparent)' }} />

            <div className="relative z-10 pb-8">
                {/* ── Header ─────────────────────────────────────── */}
                <PageHeader
                    title="Quản lý Thẻ 💳"
                    subtitle="Tài chính"
                    rightActions={
                        <button onClick={refetchCards}
                            className="w-10 h-10 rounded-full bg-white dark:bg-surface border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all relative flex-shrink-0">
                            <CustomIcon type="refreshCw" size={16} tile={false} color="currentColor" className="w-4 h-4" />
                            {paymentAlerts.length > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800" />
                            )}
                        </button>
                    }
                />

                {/* ── Hero: Total debt ─────────────────────────── */}
                <div className="text-center px-5 mb-8">
                    <p className="text-sm text-slate-500 mb-1">Tổng dư nợ thẻ</p>
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {fmt(totalDebt)}₫
                    </h1>
                    {totalDebt > 0 ? (
                        <div className="flex items-center justify-center gap-1 mt-2 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                            <CustomIcon type="hoanTien" size={16} tile={false} color="currentColor" className="w-4 h-4" />
                            <span>Hoàn tiền cả năm: <strong>{fmt(yearlyCashback)}₫</strong></span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-1 mt-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                            <UtilityIcon type="checkCircle" size={16} tile={false} color="#10B981" />
                            <span>Không có dư nợ thẻ tín dụng</span>
                        </div>
                    )}
                </div>

                {/* ── Card carousel ───────────────────────────── */}
                <CreditCardCarousel
                    loading={loading}
                    creditCards={creditCards}
                    findApiBank={findApiBank}
                    onEdit={handleEditCard}
                    onDelete={handleDeleteCardClick}
                    onPay={handlePayClick}
                    onAddNew={handleAddNewCard}
                />

                {/* ── Quick actions ────────────────────────────── */}
                <div className="px-5 mb-6">
                    <div className="bg-white/70 dark:bg-surface/80 backdrop-blur-xl rounded-xl px-3.5 py-2.5 flex justify-between items-center shadow-sm border border-white/50 dark:border-slate-700/50">
                        {[
                            { icon: <ActionIcon type="creditCard" size={20} tile={false} color="#6366F1" />, label: 'Thanh toán', bg: '#EEF2FF', bgDark: '#312E81', onClick: () => setShowPayment(true) },
                            { icon: <CustomIcon type="wallet" size={20} tile={false} color="currentColor" className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />, label: 'Giao dịch', bg: '#D1FAE5', bgDark: '#064E3B', onClick: openAddModal },
                            { icon: <CustomIcon type="history" size={20} tile={false} color="currentColor" className="w-5 h-5 text-orange-600 dark:text-orange-400" />, label: 'Lịch sử', bg: '#FEF3C7', bgDark: '#78350F', onClick: () => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
                            { icon: <CustomIcon type="coPhieu" size={20} tile={false} color="currentColor" className="w-5 h-5 text-purple-600 dark:text-purple-400" />, label: 'Báo cáo', bg: '#EDE9FE', bgDark: '#4C1D95', onClick: () => router.push('/analytics') },
                        ].map((item: any) => (
                            <button key={item.label} onClick={item.onClick}
                                className="flex flex-col items-center gap-2 group">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                                    style={{ backgroundColor: typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? item.bgDark : item.bg }}>
                                    {item.icon}
                                </div>
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Payment accounts list ───────────────────── */}
                <PaymentAccountsList
                    accounts={accounts}
                    findApiBank={findApiBank}
                    onEdit={handleEditCard}
                    onDelete={handleDeleteCardClick}
                    onAddNew={handleAddNewCard}
                />

                {/* ── Payment alerts ───────────────────────────── */}
                <PaymentAlertsCard
                    paymentAlerts={paymentAlerts}
                    creditCardsCount={creditCards.length}
                    totalCreditLimit={totalCreditLimit}
                />

                {/* ── Cashback section ─────────────────────────── */}
                <div className="px-5 mb-5">
                    <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Hoàn tiền theo thẻ</h3>
                        <button onClick={() => router.push('/cashback')}
                            className="text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all uppercase tracking-tight">
                            Quản lý
                        </button>
                    </div>
                    <div className="bg-white dark:bg-surface rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                        {/* Total cashback hero — two cols: monthly + yearly */}
                        <div className="grid grid-cols-2 border-b border-gray-100 dark:border-slate-700">
                            <div className="flex flex-col items-center justify-center p-4 border-r border-gray-100 dark:border-slate-700"
                                style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
                                <p className="text-[10px] text-emerald-700 font-semibold mb-1">Tháng này ⭐</p>
                                <p className="text-lg font-bold text-emerald-700">+{fmtShort(cashbackTotal)}₫</p>
                                <span className="mt-1 text-[9px] font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700">
                                    Chờ duyệt
                                </span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4"
                                style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}>
                                <p className="text-[10px] text-blue-700 font-semibold mb-1">Cả năm {now.getFullYear()} 📅</p>
                                <p className="text-lg font-bold text-blue-700">+{fmtShort(yearlyCashback)}₫</p>
                                <span className="mt-1 text-[9px] font-bold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-700">
                                    Tích lũy
                                </span>
                            </div>
                        </div>

                        {/* Per-card breakdown */}
                        {cardCashbacks.length > 0 ? (
                            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                {cardCashbacks.map(({ card, monthTotal }) => (
                                    <button
                                        key={card._id}
                                        onClick={() => router.push(`/cards/${card._id}`)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition text-left"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                            <ActionIcon type="creditCard" size={16} tile={false} color="#6366F1" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{card.bankName} •••• {card.cardNumber}</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                                {card.cashbackRate > 0
                                                    ? `${card.cashbackRate}% hoàn tiền${card.cashbackCap > 0 ? ` · tối đa ${fmtShort(card.cashbackCap)}₫/tháng` : ''}`
                                                    : 'Chưa thiết lập tỷ lệ — bấm để sửa'}
                                            </p>
                                        </div>
                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">+{fmtShort(monthTotal)}₫</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center">
                                <p className="text-sm text-slate-400 dark:text-slate-500">Chưa có thẻ tín dụng nào</p>
                            </div>
                        )}

                        {/* Info note */}
                        <div className="mx-4 border-t border-gray-100 dark:border-slate-700 py-3">
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center">
                                * Tính theo tỷ lệ hoàn tiền bạn thiết lập cho từng thẻ. Số thực tế nhận về tùy chính sách ngân hàng.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Installment plans ─────────────────────────── */}
                {installmentPlans.length > 0 && (
                    <div className="px-5 mb-5">
                        <div className="flex items-center justify-between mb-2.5">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Kế hoạch trả góp</h3>
                            <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                {installmentPlans.length} gói
                            </span>
                        </div>
                        <div className="bg-white dark:bg-surface rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden divide-y divide-gray-100 dark:divide-slate-700">
                            {installmentPlans.map(({ t, months, monthly, remaining, paid }) => {
                                const paidPct = months > 0 ? Math.round((paid / months) * 100) : 0;
                                return (
                                    <div key={t._id} className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                                                    <CustomIcon type="calendar" size={16} tile={false} color="currentColor" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.category}</p>
                                                    {t.note && <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[140px]">{t.note}</p>}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmtShort(monthly)}₫/th</p>
                                                <p className="text-xs text-slate-400">{remaining} kỳ còn lại</p>
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all"
                                                    style={{ width: `${paidPct}%` }} />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 w-8 text-right">{paidPct}%</span>
                                        </div>
                                        <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                                            <span>Tổng: {fmtShort(t.amount)}₫</span>
                                            <span>{paid}/{months} kỳ</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Credit card transaction history ──────────── */}
                {creditCardTxs.length > 0 && (
                    <div className="px-5 mb-5 scroll-mt-24" ref={historyRef}>
                        <CreditCardHistoryList transactions={creditCardTxs} cards={creditCards} />
                    </div>
                )}


                {/* ── Shared Cards Section (Thẻ chung) ─────────── */}
                {sharedCards.length > 0 && (
                    <div className="px-5 mb-5">
                        <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-base">🤝</span>
                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Thẻ chung</h3>
                            </div>
                            <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                {sharedCards.length} thẻ
                            </span>
                        </div>
                        <div className="space-y-2">
                            {sharedCards.map(({ share, card: sc, owner }) => {
                                const logoUrl = (() => {
                                    const bankByShort = fetchedBanks.find((b: any) => b.shortName?.toUpperCase() === sc.bankShortName?.toUpperCase());
                                    return (bankByShort as any)?.logo || getBankLogo(sc.bankShortName, sc.bankName);
                                })();
                                const fmt2 = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
                                return (
                                    <button
                                        key={share._id}
                                        onClick={() => router.push(`/cards/${sc._id}`)}
                                        className="w-full flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm transition-all hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-[0.98] text-left"
                                    >
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white shadow-sm border border-gray-100 overflow-hidden">
                                            {logoUrl ? (
                                                <img src={logoUrl} alt={sc.bankName} className="w-full h-full object-contain p-1.5" />
                                            ) : (
                                                <span className="text-xs font-bold text-slate-500">{(sc.bankShortName || sc.bankName).substring(0, 3).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{sc.bankName}</p>
                                            </div>
                                            <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">
                                                Chia sẻ bởi {owner?.name || 'N/A'}
                                            </p>
                                            <SharedCardCashbackBadge cardId={sc._id} />
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{fmt2(sc.balance)}đ</p>
                                            <p className="text-[10px] text-slate-400">•••• {sc.cardNumber}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Delete Confirm Sheet ─────────────────────────── */}
            {deleteConfirmId && (() => {
                const card = cards.find(c => c._id === deleteConfirmId);
                const typeText = card?.cardType === 'credit' ? 'thẻ' :
                    card?.cardType === 'eWallet' ? 'ví' :
                        card?.cardType === 'crypto' ? 'tài khoản crypto'
                            // :card?.cardType === 'savings' ? 'sổ tiết kiệm' 
                            : 'tài khoản';

                return (
                    <>
                        <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setDeleteConfirmId(null)} />
                        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-white dark:bg-surface rounded-t-3xl p-6 shadow-2xl">
                            <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-5" />
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                                    <CustomIcon type="trash" size={24} tile={false} color="currentColor" className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-100 text-base uppercase">Xoá {typeText}?</p>
                                    <p className="text-sm text-slate-400 mt-0.5">{card?.bankName} {card?.cardNumber ? `••• ${card.cardNumber}` : ''}</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                                Thao tác này không thể hoàn tác. Tất cả dữ liệu liên quan đến {typeText} này sẽ bị xoá vĩnh viễn.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                                    Huỷ
                                </button>
                                <button
                                    onClick={() => { deleteCard(deleteConfirmId); setDeleteConfirmId(null); }}
                                    className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-bold text-white transition active:scale-95">
                                    Xoá {typeText}
                                </button>
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* ── FAB ─────────────────────────────────────────── */}
            <button
                onClick={() => { setEditCard(null); setShowForm(true); }}
                className="fixed bottom-28 right-5 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #818CF8, #6C63FF)' }}>
                <CustomIcon type="plus" size={28} tile={false} color="currentColor" className="w-7 h-7 text-white" />
            </button>

            {/* ── Modals ──────────────────────────────────────── */}
            <CardFormModal
                open={showForm}
                onClose={() => { setShowForm(false); setEditCard(null); }}
                onSave={handleSave}
                editCard={editCard}
            />
            <AddTransactionModal
                open={isAddModalOpen}
                onClose={closeAddModal}
                onSaved={refetchTx}
                defaultType={addType}
            />
            <CardPaymentModal
                open={showPayment}
                onClose={() => setShowPayment(false)}
                onPaid={() => { refetchCards(); refetchTx(); }}
                creditCards={creditCards}
                accounts={accounts}
            />
        </div >
    );
}
