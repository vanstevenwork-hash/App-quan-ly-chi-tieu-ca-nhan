'use client';
import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useBanks } from '@/hooks/useBanks';
import { useCardShares } from '@/hooks/useCardShares';
import { useAuthStore } from '@/store/useStore';
import { getBankLogo } from '@/lib/bankLogos';
import CardFormModal from '@/components/CardFormModal';
import CardPaymentModal from '@/components/CardPaymentModal';
import CardShareModal from '@/components/CardShareModal';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { resolveCardId, getCashbackAmount, getCappedCashbackTotal } from '@/lib/cashback';
import { getActiveInstallmentPlans, getDueThisCycle } from '@/lib/cardDue';

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

const CARD_GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
];

function getGradient(card: Card): string {
    if (card.color === '#111111' || card.color === '#FFFFFF') return card.color;
    if (card.bankColor && card.color && card.bankColor !== '#1B4FD8')
        return `linear-gradient(135deg, ${card.bankColor} 0%, ${card.color} 100%)`;
    return CARD_GRADIENTS[card.bankName.length % CARD_GRADIENTS.length];
}

function cardTextStyle(color: string) {
    if (color === '#111111') return { text: '#F59E0B', subtext: '#FCD34D', border: '1px solid #374151' };
    if (color === '#FFFFFF') return { text: '#1E293B', subtext: '#64748B', border: '1px solid #E2E8F0' };
    return { text: '#FFFFFF', subtext: 'rgba(255,255,255,0.85)', border: undefined };
}

function daysUntilPayment(paymentDueDay: number): number | null {
    if (!paymentDueDay) return null;
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), paymentDueDay);
    if (due <= now) due.setMonth(due.getMonth() + 1);
    return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

const NETWORK_LABELS: Record<string, string> = {
    visa: 'Visa', mastercard: 'Mastercard', jcb: 'JCB', amex: 'American Express', napas: 'Napas', other: 'Khác',
};

export default function CardDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { cards, loading, updateCard, deleteCard, setDefaultCard } = useCards();
    const { transactions } = useTransactions();
    const { banks: fetchedBanks, fetchBanks } = useBanks();
    const { sharedCards } = useCardShares();
    const currentUser = useAuthStore(s => s.user);

    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    const [showForm, setShowForm] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [historyExpanded, setHistoryExpanded] = useState(false);

    // Check if this card is owned by me or shared with me
    const ownCard = useMemo(() => cards.find(c => c._id === params.id), [cards, params.id]);
    const sharedItem = useMemo(() => sharedCards.find(sc => sc.card._id === params.id), [sharedCards, params.id]);
    const card = useMemo(() => ownCard || sharedItem?.card || null, [ownCard, sharedItem]);
    const isOwner = !!ownCard;
    const isShared = !!sharedItem;
    const sharedOwnerName = sharedItem?.owner?.name || '';

    const accounts = useMemo(
        () => cards.filter(c => ['debit', 'eWallet', 'crypto'].includes(c.cardType)),
        [cards]
    );

    const cardTxs = useMemo(() => {
        if (!card) return [];
        return transactions
            .filter(t => t.paymentMethod === 'card' && resolveCardId(t) === card._id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, card]);

    const cashbackThisMonth = useMemo(() => {
        const now = new Date();
        const monthTxs = cardTxs
            .filter(t => t.type === 'expense')
            .filter(t => { const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
        return getCappedCashbackTotal(monthTxs, card?.cashbackRate, card?.cashbackCap);
    }, [cardTxs, card]);

    const cashbackTotal = useMemo(() => {
        const expenseTxs = cardTxs.filter(t => t.type === 'expense');
        return getCappedCashbackTotal(expenseTxs, card?.cashbackRate, card?.cashbackCap);
    }, [cardTxs, card]);

    const activeInstallmentPlans = useMemo(() => {
        if (!card) return [];
        return getActiveInstallmentPlans(transactions, card._id);
    }, [transactions, card]);

    const dueThisCycle = useMemo(() => {
        if (!card) return 0;
        return getDueThisCycle(card.balance, transactions, card._id);
    }, [card, transactions]);

    const apiBank = useMemo(() => {
        if (!card) return undefined;
        return fetchedBanks.find((b: any) => b.shortName?.toUpperCase() === card.bankShortName.toUpperCase())
            || fetchedBanks.find((b: any) => b.name?.toUpperCase().includes(card.bankName.toUpperCase()));
    }, [fetchedBanks, card]);

    const handleSave = async (data: Parameters<typeof updateCard>[1]) => {
        if (!card) return;
        await updateCard(card._id, data);
        setShowForm(false);
    };

    const handleDelete = async () => {
        if (!card) return;
        await deleteCard(card._id);
        router.push('/cards');
    };

    if (loading) {
        return (
            <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep">
                <PageHeader title="Chi tiết thẻ" backHref="/cards" />
                <div className="px-5 pt-4 space-y-4">
                    <div className="h-48 rounded-[20px] bg-gray-200 dark:bg-surface animate-pulse" />
                    <div className="h-24 rounded-2xl bg-gray-200 dark:bg-surface animate-pulse" />
                </div>
            </div>
        );
    }

    if (!card) {
        return (
            <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep">
                <PageHeader title="Chi tiết thẻ" backHref="/cards" />
                <div className="flex flex-col items-center justify-center gap-3 py-24 px-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-surface flex items-center justify-center">
                        <CustomIcon type="creditCard" size={32} tile={false} color="currentColor" className="text-slate-300" />
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-200">Không tìm thấy thẻ</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">Thẻ này có thể đã bị xoá.</p>
                </div>
            </div>
        );
    }

    // When this card shares a limit with sibling cards of the same bank, the
    // real cap/usage is the pooled group total, not this card's own fields.
    const isPooled = card.sharedLimit && (card.sharedGroupSize ?? 1) > 1;
    const effLimit = isPooled ? (card.effectiveCreditLimit ?? card.creditLimit) : card.creditLimit;
    const effBalance = isPooled ? (card.groupBalance ?? card.balance) : card.balance;
    const usedPct = effLimit > 0 ? Math.min((effBalance / effLimit) * 100, 100) : 0;
    const dueDays = daysUntilPayment(card.paymentDueDay);
    const isUrgent = dueDays !== null && dueDays <= 5;
    const ts = cardTextStyle(card.color);
    const logoUrl = (apiBank as any)?.logo || getBankLogo(card.bankShortName, card.bankName);
    const isCredit = card.cardType === 'credit';

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep transition-colors duration-200">
            <PageHeader
                title={card.bankName}
                subtitle={isShared ? `Thẻ chung · ${sharedOwnerName}` : 'Chi tiết thẻ'}
                backHref="/cards"
                rightActions={isOwner ? (
                    <button onClick={() => setShowForm(true)}
                        className="w-10 h-10 rounded-full bg-white dark:bg-surface border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all flex-shrink-0">
                        <CustomIcon type="pencil" size={16} tile={false} color="currentColor" />
                    </button>
                ) : undefined}
            />

            <div className="px-5 pt-4 space-y-5">
                {/* ── Card visual ───────────────────────────────── */}
                <div className="relative rounded-[20px] p-5 shadow-xl overflow-hidden"
                    style={{ background: getGradient(card), border: ts.border }}>
                    {card.color !== '#111111' && card.color !== '#FFFFFF' && (
                        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
                    )}
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            {logoUrl ? (
                                <Image src={logoUrl} width={44} height={44} alt={card.bankShortName}
                                    className="w-11 h-11 rounded-xl object-contain bg-white/90 p-1 flex-shrink-0 shadow-sm" />
                            ) : (
                                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-bold" style={{ color: ts.text }}>
                                        {(card.bankShortName || card.bankName).substring(0, 3).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: ts.subtext }}>{card.bankName}</p>
                                <p className="text-lg font-bold mt-0.5 tracking-widest" style={{ color: ts.text }}>•••• {card.cardNumber}</p>
                            </div>
                        </div>
                        {card.isDefault && (
                            <span className="bg-yellow-400/90 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                                <CustomIcon type="star" size={10} tile={false} color="#F59E0B" /> Mặc định
                            </span>
                        )}
                    </div>

                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <p className="text-xs mb-1" style={{ color: ts.subtext }}>{isCredit ? 'Dư nợ hiện tại' : 'Số dư'}</p>
                            <p className="text-3xl font-bold tracking-tight" style={{ color: ts.text }}>{fmt(card.balance)}đ</p>
                        </div>
                        {isCredit && dueDays !== null && (
                            <div className="text-right">
                                <p className="text-xs mb-1" style={{ color: ts.subtext }}>Hạn thanh toán</p>
                                <div className="flex items-center gap-1 justify-end">
                                    {isUrgent && <CustomIcon type="alertCircle" size={16} tile={false} color="#EF4444" />}
                                    <p className={cn('text-sm font-bold', isUrgent ? 'text-red-400' : '')} style={isUrgent ? undefined : { color: ts.subtext }}>
                                        {dueDays <= 0 ? 'Đã quá hạn!' : `${dueDays} ngày nữa`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {isCredit && effLimit > 0 && (
                        <>
                            <div className="flex justify-between text-[11px] mb-1.5" style={{ color: ts.subtext }}>
                                <span>Đã dùng {usedPct.toFixed(0)}%{isPooled ? ' (chung hạn mức)' : ''}</span>
                                <span>Hạn mức: <strong className="text-sm">{fmtShort(effLimit)}</strong></span>
                            </div>
                            <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                    style={{ width: `${usedPct}%`, backgroundColor: usedPct > 80 ? '#FCA5A5' : ts.subtext }} />
                            </div>
                            {isPooled && (
                                <p className="text-[10px] mt-1.5" style={{ color: ts.subtext }}>
                                    🔗 Chung hạn mức với {(card.sharedGroupSize ?? 1) - 1} thẻ khác cùng ngân hàng
                                </p>
                            )}
                        </>
                    )}
                </div>

                {/* ── Quick actions ─────────────────────────────── */}
                {/* Shared card banner */}
                {isShared && (
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                            <span className="text-base">🤝</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Thẻ chung</p>
                            <p className="text-[11px] text-indigo-500 dark:text-indigo-400 truncate">
                                Chia sẻ bởi {sharedOwnerName}
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    {isCredit && card.balance > 0 && isOwner && (
                        <button onClick={() => setShowPayment(true)}
                            className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all">
                            <CustomIcon type="creditCard" size={16} tile={false} color="currentColor" /> Thanh toán ngay
                        </button>
                    )}
                    {isOwner && (
                        <button onClick={() => setShowShare(true)}
                            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-700 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-[0.98] transition-all">
                            <span className="text-base">🤝</span> Chia sẻ thẻ
                        </button>
                    )}
                    {!card.isDefault && isOwner && (
                        <button onClick={() => setDefaultCard(card._id)}
                            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-yellow-300 dark:hover:border-yellow-700 active:scale-[0.98] transition-all">
                            <CustomIcon type="star" size={16} tile={false} color="#F59E0B" /> Đặt mặc định
                        </button>
                    )}
                    {isOwner && (
                        <button onClick={() => setDeleteConfirm(true)}
                            className={cn(
                                'flex items-center justify-center gap-2 py-3 rounded-2xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-700 text-sm font-bold text-red-500 hover:border-red-300 dark:hover:border-red-900 active:scale-[0.98] transition-all',
                            )}>
                            <CustomIcon type="trash" size={16} tile={false} color="currentColor" /> Xoá thẻ
                        </button>
                    )}
                </div>

                {/* ── Installment breakdown ─────────────────────── */}
                {isCredit && activeInstallmentPlans.length > 0 && (
                    <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Đang trả góp</h3>
                            <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                {activeInstallmentPlans.length} khoản
                            </span>
                        </div>
                        <div className="grid grid-cols-2 border-t border-gray-100 dark:border-slate-700">
                            <div className="flex flex-col items-center justify-center p-4 border-r border-gray-100 dark:border-slate-700">
                                <p className="text-[10px] text-slate-400 font-semibold mb-1 text-center">Cần thanh toán kỳ này</p>
                                <p className="text-lg font-bold text-red-500">{fmtShort(dueThisCycle)}đ</p>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4">
                                <p className="text-[10px] text-slate-400 font-semibold mb-1 text-center">Tổng dư nợ (gồm trả góp)</p>
                                <p className="text-lg font-bold text-slate-500">{fmtShort(card.balance)}đ</p>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center px-4 py-2.5 border-t border-gray-100 dark:border-slate-700">
                            Chỉ "Cần thanh toán kỳ này" là bắt buộc trả trước hạn — phần trả góp còn lại sẽ tính vào các kỳ sau.
                        </p>
                    </div>
                )}

                {/* ── Cashback summary ──────────────────────────── */}
                {isCredit && (
                    <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Hoàn tiền</h3>
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                {card.cashbackRate > 0 ? `${card.cashbackRate}%` : 'Chưa thiết lập'}
                            </span>
                        </div>
                        {card.cashbackRate > 0 && card.cashbackCap > 0 && (
                            <p className="text-[11px] text-slate-400 px-4 pb-2 -mt-1">Tối đa {fmtShort(card.cashbackCap)}đ/tháng</p>
                        )}
                        <div className="grid grid-cols-2 border-t border-gray-100 dark:border-slate-700">
                            <div className="flex flex-col items-center justify-center p-4 border-r border-gray-100 dark:border-slate-700"
                                style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
                                <p className="text-[10px] text-emerald-700 font-semibold mb-1">Tháng này</p>
                                <p className="text-lg font-bold text-emerald-700">+{fmtShort(cashbackThisMonth)}đ</p>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4"
                                style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}>
                                <p className="text-[10px] text-blue-700 font-semibold mb-1">Tích lũy</p>
                                <p className="text-lg font-bold text-blue-700">+{fmtShort(cashbackTotal)}đ</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Info panel ────────────────────────────────── */}
                <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm divide-y divide-gray-50 dark:divide-slate-700/50 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                        <CustomIcon type="user" size={16} tile={false} color="currentColor" className="text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-400 flex-1">Chủ thẻ</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{card.cardHolder || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                        <CustomIcon type="alignJustify" size={16} tile={false} color="currentColor" className="text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-400 flex-1">Số thẻ</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-widest">•••• {card.cardNumber}</span>
                    </div>
                    {card.cardNetwork && (
                        <div className="flex items-center gap-3 px-4 py-3">
                            <CustomIcon type="package" size={16} tile={false} color="currentColor" className="text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-400 flex-1">Mạng lưới</span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{NETWORK_LABELS[card.cardNetwork] || card.cardNetwork}</span>
                        </div>
                    )}
                    {isCredit && card.statementDay > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3">
                            <CustomIcon type="calendar" size={16} tile={false} color="currentColor" className="text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-400 flex-1">Ngày sao kê</span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ngày {card.statementDay} hàng tháng</span>
                        </div>
                    )}
                    {card.note && (
                        <div className="flex items-start gap-3 px-4 py-3">
                            <CustomIcon type="fileText" size={16} tile={false} color="currentColor" className="text-slate-400 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{card.note}</span>
                        </div>
                    )}
                </div>

                {/* ── Transaction history ───────────────────────── */}
                {cardTxs.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2.5 px-1">
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Lịch sử giao dịch</h3>
                            <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-surface px-2 py-0.5 rounded-full">
                                {cardTxs.length} giao dịch
                            </span>
                        </div>
                        <div className="bg-white dark:bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/50">
                            {(historyExpanded ? cardTxs : cardTxs.slice(0, 5)).map(t => {
                                const isExpense = t.type === 'expense';
                                const cb = isExpense ? getCashbackAmount(card.cashbackRate, t.amount) : 0;
                                const txDate = new Date(t.date);
                                const dateLabel = txDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                return (
                                    <div key={t._id} className="flex items-center gap-3 px-4 py-3">
                                        <div className={cn(
                                            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                                            isExpense ? 'bg-red-50 dark:bg-red-900/30' : 'bg-emerald-50 dark:bg-emerald-900/30'
                                        )}>
                                            {isExpense
                                                ? <CustomIcon type="arrowUpRight" size={16} tile={false} color="#EF4444" />
                                                : <CustomIcon type="arrowDownLeft" size={16} tile={false} color="#10B981" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{t.category}</p>
                                            <div className="flex items-center gap-2">
                                                {t.note && <p className="text-xs text-slate-400 truncate max-w-[140px]">{t.note}</p>}
                                                <span className="text-[10px] text-slate-300 dark:text-slate-600 flex-shrink-0">{dateLabel}</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className={cn('text-sm font-bold', isExpense ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                                                {isExpense ? '-' : '+'}{fmt(t.amount)}đ
                                            </p>
                                            {isExpense && cb > 0 && (
                                                <p className="text-[10px] text-amber-500 font-semibold">+{Math.round(cb).toLocaleString('vi-VN')}đ CB</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {cardTxs.length > 5 && (
                                <div className="p-2">
                                    <button
                                        onClick={() => setHistoryExpanded(v => !v)}
                                        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                                        {historyExpanded ? (
                                            <><CustomIcon type="chevronUp" size={14} tile={false} color="currentColor" /> Thu gọn</>
                                        ) : (
                                            <><CustomIcon type="chevronDown" size={14} tile={false} color="currentColor" /> Xem thêm {cardTxs.length - 5} giao dịch</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modals ─────────────────────────────────────── */}
            <CardFormModal
                open={showForm}
                onClose={() => setShowForm(false)}
                onSave={handleSave}
                editCard={card}
            />
            <CardPaymentModal
                open={showPayment}
                onClose={() => setShowPayment(false)}
                onPaid={() => setShowPayment(false)}
                creditCards={[card]}
                accounts={accounts}
            />
            <CardShareModal
                open={showShare}
                onClose={() => setShowShare(false)}
                cardId={card._id}
                cardName={`${card.bankName} •••• ${card.cardNumber}`}
            />

            {deleteConfirm && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setDeleteConfirm(false)} />
                    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-white dark:bg-surface rounded-t-3xl p-6 shadow-2xl">
                        <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-5" />
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                                <CustomIcon type="trash" size={24} tile={false} color="#EF4444" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-slate-100 text-base uppercase">Xoá thẻ?</p>
                                <p className="text-sm text-slate-400 mt-0.5">{card.bankName} ••• {card.cardNumber}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                            Thao tác này không thể hoàn tác. Dữ liệu liên quan đến thẻ này sẽ bị xoá vĩnh viễn.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(false)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                                Huỷ
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-bold text-white transition active:scale-95">
                                Xoá thẻ
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
