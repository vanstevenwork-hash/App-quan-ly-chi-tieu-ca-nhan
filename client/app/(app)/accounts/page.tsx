'use client';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { safeCardImage } from '@/lib/cardArt';
import CardThumb from '@/components/cards/CardThumb';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import CardFormModal from '@/components/CardFormModal';
import CardPaymentModal from '@/components/CardPaymentModal';
import CreditCardCarousel from '@/components/cards/CreditCardCarousel';
import SavingsDeck from '@/components/cards/SavingsDeck';
import PageHeader from '@/components/PageHeader';
import RefreshButton from '@/components/RefreshButton';
import { cn, formatNumber } from '@/lib/utils';
import { useBankLogo } from '@/hooks/useBankLogo';
import { useBanks } from '@/hooks/useBanks';
import { useRouter } from 'next/navigation';

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt = (n: number) => formatNumber(Math.round(n));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1000)}k`;
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / 86_400_000);
}

// ─── Debit/eWallet/Crypto row ───────────────────────────────────────────────
function AccountRow({ card, onEdit, onDelete, onSetDefault }: {
    card: Card; onEdit: () => void; onDelete: () => void; onSetDefault: () => void;
}) {
    const logoOf = useBankLogo();
    const isCrypto = card.cardType === 'crypto';
    const isEWallet = card.cardType === 'eWallet';
    const isSavings = card.cardType === 'savings';
    const iconBg = isCrypto ? 'bg-yellow-50 text-yellow-600'
        : isEWallet ? 'bg-purple-50 text-purple-600'
            : isSavings ? 'bg-blue-50 text-blue-600'
                : 'bg-green-50 text-green-600';

    return (
        <div className="bg-white dark:bg-surface rounded-xl p-2.5 border border-gray-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-between hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-center gap-2.5">
                {(() => {
                    const logoUrl = logoOf(card.bankShortName, card.bankName);
                    if (safeCardImage(card.cardImage)) return <CardThumb card={card} size="md" showLast4 logoUrl={logoUrl} />;
                    return logoUrl ? (
                        <img
                            src={logoUrl}
                            alt={card.bankShortName || card.bankName}
                            className="w-10 h-10 rounded-lg object-contain bg-white dark:bg-white/90 p-1 border border-gray-100 dark:border-slate-800 shadow-sm flex-shrink-0"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    ) : (
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
                            {isCrypto ? <CustomIcon type="bitcoin" size={20} tile={false} color="currentColor" className="w-5 h-5" /> : 
                             isEWallet ? <UtilityIcon type="eWallet" size={20} tile={false} color="#8B5CF6" /> :
                             isSavings ? <UtilityIcon type="soTietKiem" size={20} tile={false} color="#F0A319" /> :
                             <UtilityIcon type="theGhiNo" size={20} tile={false} color="#3D7BF0" />}
                        </div>
                    );
                })()}
                <div>
                    <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{card.bankName}</p>
                        {card.isDefault && <CustomIcon type="badgeCheck" size={14} tile={false} color="currentColor" className="w-3.5 h-3.5 text-indigo-500" />}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">••{card.cardNumber} · {card.cardHolder}</p>
                </div>
            </div>
            {/* Amount at rest; edit/delete/set-default cross-fade in on hover — same pattern as the wealth page */}
            <div className="relative flex items-center justify-end min-w-[124px] flex-shrink-0 self-stretch">
                <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap transition-opacity duration-300 group-hover:opacity-0">{fmt(card.balance)}</p>
                <div className="absolute inset-0 flex items-center justify-end gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {!card.isDefault && (
                        <button onClick={(e) => { e.stopPropagation(); onSetDefault(); }} aria-label="Đặt mặc định"
                            className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors shadow-sm">
                            <CustomIcon type="star" size={15} tile={false} color="currentColor" className="w-4 h-4 text-yellow-500" />
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label="Chỉnh sửa"
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors shadow-sm">
                        <CustomIcon type="pencil" size={15} tile={false} color="currentColor" className="w-4 h-4 text-indigo-500" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label="Xoá"
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-sm">
                        <CustomIcon type="trash" size={15} tile={false} color="currentColor" className="w-4 h-4 text-red-500" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete confirm ────────────────────────────────────────────────────────
function DeleteConfirm({ card, onConfirm, onCancel }: { card: Card; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onCancel}>
            <div className="bg-white dark:bg-surface w-full max-w-md rounded-t-3xl p-6 space-y-4 shadow-2xl pb-10" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                    <CustomIcon type="trash" size={24} tile={false} color="currentColor" className="w-6 h-6 text-red-500" />
                </div>
                <div className="text-center">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">Xoá tài khoản</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
                        Xoá <strong>{card.bankName} ••{card.cardNumber}</strong>? Thao tác không thể hoàn tác.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">Huỷ</button>
                    <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all">Xoá</button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function AccountsPage() {
    const router = useRouter();
    const { cards, totalBalance, totalDebt, loading, error, createCard, updateCard, deleteCard, setDefaultCard, refetch } = useCards();
    const { banks: fetchedBanks, fetchBanks } = useBanks();
    const { transactions } = useTransactions();
    useEffect(() => { fetchBanks(); }, [fetchBanks]);
    const [activeTab, setActiveTab] = useState<'cards' | 'savings'>('cards');
    const [showForm, setShowForm] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [payTargetId, setPayTargetId] = useState('');
    const [editCard, setEditCard] = useState<Card | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);

    const banksByShortName = useMemo(() => {
        const map = new Map<string, any>();
        fetchedBanks.forEach((b: any) => { if (b.shortName) map.set(b.shortName.toUpperCase(), b); });
        return map;
    }, [fetchedBanks]);
    const findApiBank = useCallback((bankShortName?: string, bankName?: string) => {
        const direct = banksByShortName.get((bankShortName || '').toUpperCase());
        if (direct) return direct;
        return fetchedBanks.find((b: any) => b.name?.toUpperCase().includes((bankName || '').toUpperCase()));
    }, [banksByShortName, fetchedBanks]);
    const [defaultType, setDefaultType] = useState<typeof cards[0]['cardType']>('debit');
    const [paymentAccountsExpanded, setPaymentAccountsExpanded] = useState(true);

    const netWorth = totalBalance - totalDebt;
    const totalSavings = useMemo(() => cards.filter(c => c.cardType === 'savings').reduce((s, c) => s + c.balance, 0), [cards]);

    // grouped
    const creditCards = cards.filter(c => c.cardType === 'credit');
    const debitCards = cards.filter(c => c.cardType === 'debit' || c.cardType === 'eWallet' || c.cardType === 'crypto');
    const savingsCards = cards.filter(c => c.cardType === 'savings');

    // maturity alerts
    const maturityAlerts = savingsCards.filter(c => {
        const d = daysUntil(c.maturityDate);
        return d !== null && d <= 7;
    });

    const handleSave = async (data: Parameters<typeof createCard>[0]) => {
        if (editCard) await updateCard(editCard._id, data);
        else await createCard(data);
        setEditCard(null);
    };

    const openAdd = (type: typeof cards[0]['cardType']) => {
        setDefaultType(type);
        setEditCard(null);
        setShowForm(true);
    };

    return (
        <div className="min-h-screen pb-32 bg-[#F8F9FF] dark:bg-surface-deep transition-colors duration-200">
            {/* Background gradient blob - dark mode friendly */}
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(224,195,252,0.3), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(139,92,246,0.1), transparent)' }} />

            {/* ── Header ─────────────────────────────────────── */}
            <PageHeader
                title="Tài khoản & Tài sản"
                subtitle="Tài chính"
                rightActions={
                    <RefreshButton onRefresh={refetch} />
                }
            />

            <div className="relative z-10">
                {/* ── Fetch error banner ───────────────────────────── */}
                {!loading && error && (
                    <div className="px-5 pb-4">
                        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-4">
                            <CustomIcon type="alertTriangle" size={20} tile={false} color="currentColor" className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-red-700 dark:text-red-300">Không tải được dữ liệu</p>
                                <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{error}</p>
                            </div>
                            <button onClick={() => refetch()}
                                className="text-xs font-bold text-red-600 dark:text-red-300 bg-white dark:bg-red-900/40 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors flex-shrink-0">
                                Thử lại
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Summary & Net Worth — aurora hero, same style as Home ── */}
                <div className="px-5 pb-2">
                    <div className="relative overflow-hidden rounded-[20px] p-5 shadow-[0_4px_20px_-2px_rgba(139,92,246,0.12)] dark:shadow-xl bg-gradient-to-br from-white to-[#F5F3FF] dark:from-[#191E36] dark:via-[#151829] dark:to-[#141224] border border-[#E9D5FF] dark:border-slate-700/50">
                        {/* Aurora glow — confined to the bottom-right corner, matches the Home hero card */}
                        <div aria-hidden className="absolute inset-0 pointer-events-none">
                            <div
                                className="absolute -bottom-24 -right-24 w-72 h-56 opacity-35 dark:opacity-70"
                                style={{ background: 'radial-gradient(ellipse at center, rgba(109,40,217,0.45) 0%, rgba(91,33,182,0.22) 45%, transparent 70%)', filter: 'blur(24px)' }}
                            />
                            <div
                                className="absolute -bottom-14 -right-6 w-40 h-28 opacity-30 dark:opacity-60"
                                style={{ background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.45) 0%, transparent 65%)', filter: 'blur(14px)' }}
                            />
                            <svg className="absolute bottom-0 right-0 w-2/3 h-24 opacity-20 dark:opacity-35" viewBox="0 0 260 96" fill="none" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="acctSilk" x1="0" y1="0" x2="260" y2="0" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#C4B5FD" stopOpacity="0" />
                                        <stop offset="0.6" stopColor="#C4B5FD" stopOpacity="0.8" />
                                        <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <path d="M0 96 C 90 64, 170 92, 260 36" stroke="url(#acctSilk)" strokeWidth="0.8" />
                                <path d="M20 100 C 110 74, 190 96, 260 50" stroke="url(#acctSilk)" strokeWidth="0.6" />
                                <path d="M60 104 C 140 86, 210 100, 260 66" stroke="url(#acctSilk)" strokeWidth="0.5" />
                                <path d="M110 106 C 175 96, 225 104, 260 82" stroke="url(#acctSilk)" strokeWidth="0.4" />
                            </svg>
                            <div className="absolute bottom-0 right-6 left-1/2 h-px bg-gradient-to-r from-transparent via-purple-400/30 dark:via-purple-300/50 to-transparent" />
                        </div>

                        <div className="relative z-10">
                            {/* Net worth */}
                            <div className="text-center">
                                <p className="text-sm text-slate-500 dark:text-slate-300 font-medium mb-1">Tổng tài sản ròng</p>
                                <p className="text-[19px] font-bold text-slate-800 dark:text-white tracking-tight leading-none text-money">{fmt(netWorth)} đ</p>
                            </div>

                            {/* Breakdown — value on top, label below, split by dividers (Home style) */}
                            <div className="flex items-stretch justify-center mt-5">
                                {[
                                    { label: 'Tài sản', value: fmtShort(totalBalance), color: 'text-emerald-600 dark:text-emerald-400' },
                                    { label: 'Tiết kiệm', value: fmtShort(totalSavings), color: 'text-blue-600 dark:text-blue-400' },
                                    { label: 'Dư nợ thẻ', value: totalDebt > 0 ? `-${fmtShort(totalDebt)}` : '0', color: 'text-red-500 dark:text-red-400' },
                                ].map((item, i) => (
                                    <div key={item.label} className="flex flex-1 items-center min-w-0">
                                        {i > 0 && <div className="w-px h-9 self-center bg-slate-200 dark:bg-white/15 flex-shrink-0" />}
                                        <div className="flex-1 text-center min-w-0 px-1">
                                            <p className={cn('text-[13px] font-bold text-money tabular-nums', item.color)}>
                                                {item.value}
                                            </p>
                                            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5 truncate">{item.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mt-3 bg-slate-100/50 dark:bg-surface/50 backdrop-blur-sm rounded-xl p-1.5 flex gap-1.5 border border-slate-200/50 dark:border-slate-800/50">
                        {(['cards', 'savings'] as const).map(tab => (
                            <button key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    'flex-1 py-2 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2',
                                    activeTab === tab
                                        ? 'bg-brand text-white shadow-md shadow-brand/30 scale-[1.02]'
                                        : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                )}>
                                {tab === 'cards' ? (
                                    <>
                                        <UtilityIcon type="wallet" size={16} tile={false} color={activeTab === tab ? '#DDD6FE' : '#6B7280'} />
                                        <span>Thẻ & Ví</span>
                                        {(creditCards.length + debitCards.length) > 0 && (
                                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", activeTab === tab ? "bg-white text-brand" : "bg-brand-light/60 text-brand dark:text-purple-300")}>
                                                {creditCards.length + debitCards.length}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <UtilityIcon type="soTietKiem" size={16} tile={false} color={activeTab === tab ? '#DDD6FE' : '#6B7280'} />
                                        <span>Tiết kiệm</span>
                                        {savingsCards.length > 0 && (
                                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", activeTab === tab ? "bg-white text-brand" : "bg-brand-light/60 text-brand dark:text-purple-300")}>
                                                {savingsCards.length}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-5 py-4 space-y-3">

                    {/* ── Maturity alert ───────────────────────────────── */}
                    {maturityAlerts.map(card => (
                        <div key={card._id} className="bg-white dark:bg-surface rounded-xl p-4 border border-orange-100 dark:border-orange-900/20 flex items-start gap-3 shadow-sm shadow-orange-500/5">
                            <div className="bg-orange-100 dark:bg-orange-900/20 p-2 rounded-full text-orange-600 dark:text-orange-400 flex-shrink-0">
                                <CustomIcon type="alertTriangle" size={20} tile={false} color="currentColor" className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Sổ tiết kiệm sắp đáo hạn</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium leading-relaxed">
                                    {card.bankName} — {fmt(card.balance)} · còn {daysUntil(card.maturityDate)} ngày. Tất toán hoặc tái tục.
                                </p>
                            </div>
                        </div>
                    ))}

                    {/* ════════ TAB: CARDS ════════ */}
                    {activeTab === 'cards' && (
                        <>
                            {/* Credit cards — stacked deck view (same as /cards) */}
                            {creditCards.length > 0 && (
                                <section className="-mx-5">
                                    <CreditCardCarousel
                                        loading={loading}
                                        creditCards={creditCards}
                                        transactions={transactions}
                                        findApiBank={findApiBank}
                                        onEdit={(card) => { setEditCard(card); setShowForm(true); }}
                                        onDelete={(id) => setDeleteTarget(creditCards.find(c => c._id === id) || null)}
                                        onPay={(id) => { setPayTargetId(id); setShowPayment(true); }}
                                        onAddNew={() => openAdd('credit')}
                                        onViewDetail={(id) => router.push(`/cards/${id}`)}
                                    />
                                </section>
                            )}

                            {/* Debit / eWallet / Crypto accounts — collapsible */}
                            <section>
                                <div className="flex items-center justify-between mb-3 px-1">
                                    {debitCards.length > 0 ? (
                                        <button
                                            onClick={() => setPaymentAccountsExpanded(v => !v)}
                                            className="flex items-center gap-1.5 group"
                                        >
                                            <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">Tài khoản thanh toán</h2>
                                            <CustomIcon type="chevronDown" size={14} tile={false} color="currentColor" className={cn(
                                                'w-3.5 h-3.5 text-slate-400 transition-transform',
                                                !paymentAccountsExpanded && '-rotate-90'
                                            )} />
                                        </button>
                                    ) : (
                                        <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tài khoản thanh toán</h2>
                                    )}
                                    <button onClick={() => openAdd('debit')} aria-label="Thêm mới"
                                        className="flex items-center justify-center w-7 h-7 rounded-lg text-white bg-brand hover:bg-brand-dark shadow-sm shadow-brand/30 transition-all">
                                        <CustomIcon type="plus" size={14} tile={false} color="currentColor" />
                                    </button>
                                </div>
                                {debitCards.length > 0 ? (
                                    paymentAccountsExpanded ? (
                                        <div className="space-y-2">
                                            {debitCards.map(card => (
                                                <AccountRow key={card._id} card={card}
                                                    onEdit={() => { setEditCard(card); setShowForm(true); }}
                                                    onDelete={() => setDeleteTarget(card)}
                                                    onSetDefault={() => setDefaultCard(card._id)} />
                                            ))}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setPaymentAccountsExpanded(true)}
                                            className="w-full flex items-center justify-between p-4 bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:border-purple-200 dark:hover:border-purple-900 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <UtilityIcon type="wallet" size={40} tile />
                                                <div className="text-left">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{debitCards.length} tài khoản & ví</p>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                        Tổng số dư: {fmt(debitCards.reduce((s, c) => s + c.balance, 0))}đ
                                                    </p>
                                                </div>
                                            </div>
                                            <CustomIcon type="chevronRight" size={16} tile={false} color="currentColor" className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                        </button>
                                    )
                                ) : (
                                    <div className="text-center py-12 bg-white dark:bg-surface/30 rounded-[20px] border border-dashed border-slate-200 dark:border-slate-800">
                                        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium italic">Chưa có tài khoản thanh toán</p>
                                    </div>
                                )}
                            </section>

                            {/* If no credit cards at all, show add button */}
                            {creditCards.length === 0 && (
                                <button onClick={() => openAdd('credit')}
                                    className="w-full flex items-center gap-4 p-5 bg-white dark:bg-surface rounded-[20px] border border-slate-100 dark:border-slate-800 shadow-sm hover:border-purple-300 dark:hover:border-purple-900 transition-all group">
                                    <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <CustomIcon type="creditCard" size={24} tile={false} color="currentColor" className="w-6 h-6 text-purple-500" />
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 dark:text-slate-200">Thêm thẻ tín dụng</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium truncate">Theo dõi dư nợ và hạn thanh toán ngay</p>
                                    </div>
                                    <CustomIcon type="chevronRight" size={16} tile={false} color="currentColor" className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                                </button>
                            )}
                        </>
                    )}

                    {/* ════════ TAB: SAVINGS ════════ */}
                    {activeTab === 'savings' && (
                        <section>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sổ tiết kiệm online</h2>
                                <button onClick={() => openAdd('savings')}
                                    className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white hover:bg-brand-dark transition-all shadow-sm shadow-brand/30">
                                    <CustomIcon type="plus" size={16} tile={false} color="currentColor" className="w-4 h-4" />
                                </button>
                            </div>
                            {savingsCards.length > 0 ? (
                                <SavingsDeck
                                    cards={savingsCards}
                                    onEdit={(c) => { setEditCard(c); setShowForm(true); }}
                                    onDelete={(c) => setDeleteTarget(c)} />
                            ) : (
                                <div className="flex flex-col items-center py-20 gap-6 bg-white dark:bg-surface/30 rounded-[20px] border border-dashed border-slate-200 dark:border-slate-800">
                                    <div className="w-20 h-20 rounded-[2.5rem] bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center transform rotate-3">
                                        <UtilityIcon type="soTietKiem" size={40} tile={false} color="#A855F7" />
                                    </div>
                                    <div className="text-center px-6">
                                        <p className="font-bold text-slate-700 dark:text-slate-200 text-lg">Chưa có sổ tiết kiệm</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-2 max-w-[240px] leading-relaxed">
                                            Hãy thêm các sổ tiết kiệm của bạn để theo dõi lãi suất và ngày đáo hạn tự động.
                                        </p>
                                    </div>
                                    <button onClick={() => openAdd('savings')}
                                        className="bg-brand dark:bg-purple-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-purple-500/20 active:scale-95 transition-all">
                                        + Thêm sổ tiết kiệm
                                    </button>
                                </div>
                            )}
                        </section>
                    )}

                </div>

                {/* ── Modals ─────────────────────────────────────────── */}
                <CardFormModal
                    open={showForm}
                    onClose={() => { setShowForm(false); setEditCard(null); }}
                    onSave={handleSave}
                    editCard={editCard}
                    initialType={defaultType}
                />

                {deleteTarget && (
                    <DeleteConfirm
                        card={deleteTarget}
                        onConfirm={async () => { await deleteCard(deleteTarget._id); setDeleteTarget(null); }}
                        onCancel={() => setDeleteTarget(null)} />
                )}

                <CardPaymentModal
                    open={showPayment}
                    onClose={() => setShowPayment(false)}
                    onPaid={() => { refetch(); }}
                    creditCards={creditCards}
                    accounts={debitCards}
                    initialCardId={payTargetId}
                />
            </div>
        </div>
    );
}
