'use client';
import { useState, useMemo, useEffect } from 'react';
import {
    Plus, ArrowLeft, TrendingDown, TrendingUp,
    CreditCard, History, BarChart3, Wallet,
    AlertCircle, Calendar, Gift, Pencil, Trash2,
    Star, BadgePercent, CheckCircle2, Clock, RefreshCw, CalendarDays,
    ChevronDown, ChevronUp, ArrowDownLeft, ArrowUpRight,
    Bitcoin, Smartphone,
} from 'lucide-react';
import { getBankLogo } from '@/lib/bankLogos';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useBanks } from '@/hooks/useBanks';
import CardFormModal from '@/components/CardFormModal';
import AddTransactionModal from '@/components/AddTransactionModal';
import CardPaymentModal from '@/components/CardPaymentModal';
import { useUIStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ─── Formatters ───────────────────────────────────────────────────────────────
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

function getGradient(card: Card, idx: number): string {
    if (card.color === '#111111' || card.color === '#FFFFFF') return card.color;
    if (card.bankColor && card.color && card.bankColor !== '#1B4FD8')
        return `linear-gradient(135deg, ${card.bankColor} 0%, ${card.color} 100%)`;
    return CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
}

function cardTextStyle(color: string) {
    if (color === '#111111') return { text: '#F59E0B', subtext: '#FCD34D', border: '1px solid #374151' };
    if (color === '#FFFFFF') return { text: '#1E293B', subtext: '#64748B', border: '1px solid #E2E8F0' };
    return { text: '#FFFFFF', subtext: 'rgba(255,255,255,0.85)', border: undefined };
}

// ── Cashback rate by category ──────────────────────────────────────────────
const CASHBACK_RATES: Record<string, number> = {
    'Ăn uống': 0.03,
    'Siêu thị': 0.025,
    'Di chuyển': 0.02,
    'Mua sắm': 0.015,
    'Giải trí': 0.015,
    'Sức khỏe': 0.01,
    'Giáo dục': 0.01,
};
const DEFAULT_RATE = 0.005;

function getCashbackRate(category: string) {
    return CASHBACK_RATES[category] || DEFAULT_RATE;
}

// ── Days until next payment -------------------------------------------------
function daysUntilPayment(paymentDueDay: number): number | null {
    if (!paymentDueDay) return null;
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), paymentDueDay);
    if (due <= now) due.setMonth(due.getMonth() + 1);
    return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

// ── Credit card slide -------------------------------------------------------
function CreditCardSlide({ card, idx, onEdit, onDelete, onPay, bankLogoUrl }: {
    card: Card; idx: number; bankLogoUrl?: string;
    onEdit: () => void; onDelete: () => void; onPay: () => void;
}) {
    const usedPct = card.creditLimit > 0 ? Math.min((card.balance / card.creditLimit) * 100, 100) : 0;
    const dueDays = daysUntilPayment(card.paymentDueDay);
    const isUrgent = dueDays !== null && dueDays <= 5;
    const ts = cardTextStyle(card.color);
    const [logoError, setLogoError] = useState(false);
    // Use bank API logo first, then static CDN fallback
    const logoUrl = bankLogoUrl || getBankLogo(card.bankShortName, card.bankName);
    const showLogo = logoUrl && !logoError;

    return (
        <div className="snap-center shrink-0 w-[85%] relative rounded-xl p-3 pb-2.5 pt-2.5 shadow-xl overflow-hidden
                        transform transition-transform hover:scale-[1.02] flex flex-col h-[192px]"
            style={{ background: getGradient(card, idx), border: ts.border }}>
            {/* Default badge — absolute top-right */}
            {card.isDefault && (
                <span className="absolute top-0 right-0 z-10 bg-yellow-400/90 text-yellow-900 text-[10px] font-bold px-1 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Star className="w-2.5 h-2.5" />
                </span>
            )}
            {card.color !== '#111111' && card.color !== '#FFFFFF' && (
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
            )}

            <div className="flex justify-between items-start mb-2.5">
                <div className="flex items-center gap-2">
                    {/* Bank logo */}
                    {showLogo ? (
                        <img
                            src={logoUrl!}
                            alt={card.bankShortName || card.bankName}
                            className="w-9 h-9 rounded-xl object-contain bg-white/90 p-0.5 flex-shrink-0 shadow-sm"
                            onError={() => setLogoError(true)}
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold" style={{ color: ts.text }}>
                                {(card.bankShortName || card.bankName || '?').substring(0, 3).toUpperCase()}
                            </span>
                        </div>
                    )}
                    <div>
                        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: ts.subtext }}>{card.bankName}</p>
                        <p className="text-base font-bold mt-0.5 tracking-widest" style={{ color: ts.text }}>•••• {card.cardNumber}</p>
                    </div>
                </div>
                <div className="flex gap-1">
                    <button onClick={onEdit}
                        className="w-7 h-7 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition">
                        <Pencil className="w-3 h-3" style={{ color: ts.text }} />
                    </button>
                    <button onClick={onDelete}
                        className="w-7 h-7 rounded-full bg-red-400/20 hover:bg-red-400/40 flex items-center justify-center transition">
                        <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                </div>
            </div>
            {/* </div> */}

            <div className="flex justify-between items-end mb-2.5">
                <div>
                    <p className="text-xs mb-1" style={{ color: ts.subtext }}>Dư nợ hiện tại</p>
                    <p className="text-xl font-bold tracking-tight" style={{ color: ts.text }}>{fmt(card.balance)}₫</p>
                </div>
                {dueDays !== null ? (
                    <div className="text-right">
                        <p className="text-xs mb-1" style={{ color: ts.subtext }}>Hạn thanh toán</p>
                        <div className="flex items-center gap-1 justify-end">
                            {isUrgent && <AlertCircle className="w-4 h-4 text-red-400" />}
                            <p className={cn('text-sm font-bold', isUrgent ? 'text-red-400' : '')} style={isUrgent ? undefined : { color: ts.subtext }}>
                                {dueDays <= 0 ? 'Đã quá hạn!' : `${dueDays} ngày nữa`}
                            </p>
                        </div>
                    </div>
                ) : (
                    card.statementDay > 0 && (
                        <div className="text-right">
                            <p className="text-xs mb-1" style={{ color: ts.subtext }}>Sao kê ngày</p>
                            <p className="text-sm font-bold" style={{ color: ts.text }}>{card.statementDay}/{new Date().getMonth() + 1}</p>
                        </div>
                    )
                )}
            </div>

            {
                card.creditLimit > 0 && (
                    <>
                        <div className="flex justify-between text-[10px] mb-1.5" style={{ color: ts.subtext }}>
                            <span>Đã dùng {usedPct.toFixed(0)}%</span>
                            <span>Hạn mức:<span className="text-base ml-0.5 font-bold">{fmtShort(card.creditLimit)}</span></span>
                        </div>
                        <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden mb-2">
                            <div className="h-full rounded-full transition-all"
                                style={{
                                    width: `${usedPct}%`,
                                    backgroundColor: usedPct > 80 ? '#FCA5A5' : ts.subtext,
                                }} />
                        </div>
                    </>
                )
            }

            {/* Pay button on card */}
            {
                card.balance > 0 && (
                    <button onClick={onPay}
                        className="w-full mt-auto py-2 rounded-xl bg-black/10 hover:bg-black/20 text-xs font-bold transition flex items-center justify-center gap-1.5"
                        style={{ color: ts.text }}>
                        <CreditCard className="w-3.5 h-3.5" /> Thanh toán ngay
                    </button>
                )
            }
        </div >
    );
}

// ── Detail info row ---------------------------------------------------------
function DetailRow({ icon, iconBg, title, sub, value, badge, badgeColor }: {
    icon: React.ReactNode; iconBg: string;
    title: string; sub: string; value: string;
    badge?: string; badgeColor?: string;
}) {
    return (
        <div className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-2xl transition group cursor-pointer">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 flex-shrink-0"
                style={{ backgroundColor: iconBg }}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{title}</h4>
                    {badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                            style={{ backgroundColor: `${badgeColor}18`, color: badgeColor }}>
                            {badge}
                        </span>
                    )}
                </div>
                <div className="flex justify-between items-end mt-0.5">
                    <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{value}</p>
                </div>
            </div>
        </div>
    );
}

// ── Account row for debit/wallet/crypto ──
function AccountRow({ card, onEdit, onDelete, bankLogoUrl }: {
    card: Card; onEdit: () => void; onDelete: () => void; bankLogoUrl?: string;
}) {
    const TypeIcon = card.cardType === 'crypto' ? Bitcoin
        : card.cardType === 'eWallet' ? Smartphone
            : Wallet;
    const iconBg = card.cardType === 'crypto' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
        : card.cardType === 'eWallet' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400';
    const logoUrl = bankLogoUrl || getBankLogo(card.bankShortName, card.bankName);
    const balanceColor = card.balance < 0 ? 'text-red-500' : 'text-emerald-500 dark:text-emerald-400';

    return (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm transition-all hover:border-indigo-200 dark:hover:border-indigo-900/50 group">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 overflow-hidden', !logoUrl ? iconBg : 'bg-white shadow-sm border border-gray-100')}>
                {logoUrl ? (
                    <img src={logoUrl} alt={card.bankName} className="w-full h-full object-contain p-1.5" />
                ) : (
                    <TypeIcon className="w-5 h-5" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{card.bankName}</p>
                    {card.isDefault && <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-tight uppercase">
                    {card.cardHolder} {card.cardNumber ? `• ${card.cardNumber}` : ''}
                </p>
            </div>

            <div className="relative h-10 min-w-[80px] overflow-hidden flex items-center justify-end">
                {/* Balance View */}
                <div className="flex flex-col items-end transition-all duration-300 group-hover:-translate-y-full group-hover:opacity-0">
                    <p className={cn('text-sm font-bold leading-none', balanceColor)}>
                        {fmt(card.balance)}₫
                    </p>
                    {/* <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 mt-1 uppercase">Số dư</p> */}
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 flex items-center justify-end gap-1.5 translate-y-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900/40 transition-colors shadow-sm"
                        title="Chỉnh sửa"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40 transition-colors shadow-sm"
                        title="Xóa"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CardsPage() {
    const { cards, totalDebt, loading, createCard, updateCard, deleteCard, setDefaultCard, refetch: refetchCards } = useCards();
    const { isAddModalOpen, openAddModal, closeAddModal } = useUIStore();
    const { transactions, refetch: refetchTx } = useTransactions();
    const { banks: fetchedBanks, fetchBanks } = useBanks();

    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    const [showForm, setShowForm] = useState(false);
    const [editCard, setEditCard] = useState<Card | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [addType] = useState<'expense'>('expense');
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const router = useRouter();

    const creditCards = useMemo(() => cards.filter(c => c.cardType === 'credit'), [cards]);
    const accounts = useMemo(() => cards.filter(c => ['debit', 'eWallet', 'crypto'].includes(c.cardType)), [cards]);

    // ── Cashback breakdown per card ─────────────────────────────────────────
    const now = new Date();
    const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

    const thisMonthTx = useMemo(() =>
        transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear() &&
                t.type === 'expense' &&
                t.category !== 'Thanh toán thẻ';
        }), [transactions]);

    // Total cashback estimated
    const cashbackTotal = useMemo(() =>
        thisMonthTx.reduce((sum, t) => sum + t.amount * getCashbackRate(t.category), 0),
        [thisMonthTx]);

    // Cashback by category
    const cashbackByCategory = useMemo(() => {
        const map: Record<string, number> = {};
        thisMonthTx.forEach(t => {
            const cb = t.amount * getCashbackRate(t.category);
            map[t.category] = (map[t.category] || 0) + cb;
        });
        return Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);
    }, [thisMonthTx]);

    // Yearly cashback
    const yearlyCashback = useMemo(() =>
        transactions
            .filter(t => {
                const d = new Date(t.date);
                return d.getFullYear() === now.getFullYear() && t.type === 'expense' && t.category !== 'Thanh toán thẻ';
            })
            .reduce((sum, t) => sum + t.amount * getCashbackRate(t.category), 0),
        [transactions]);

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

    // ── Payment alerts (cards with balance and due within 30d) ──────────────
    const paymentAlerts = useMemo(() =>
        creditCards
            .filter(c => c.balance > 0 && c.paymentDueDay > 0)
            .map(c => ({ card: c, days: daysUntilPayment(c.paymentDueDay) }))
            .filter(x => x.days !== null && x.days <= 30)
            .sort((a, b) => (a.days ?? 99) - (b.days ?? 99))
        , [creditCards]);

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

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            {/* Background gradient blob */}
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(199,210,254,0.4), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(139,92,246,0.1), transparent)' }} />

            <div className="relative z-10 pb-8">
                {/* ── Header ─────────────────────────────────────── */}
                <header className="pt-4 px-5 pb-2 flex items-center gap-4">
                    <button onClick={() => router.push('/dashboard')}
                        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all flex-shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Tài chính</p>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Quản lý Thẻ 💳</h1>
                    </div>
                    <button onClick={refetchCards}
                        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all relative flex-shrink-0">
                        <RefreshCw className="w-4 h-4" />
                        {paymentAlerts.length > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800" />
                        )}
                    </button>
                </header>

                {/* ── Hero: Total debt ─────────────────────────── */}
                <div className="text-center px-6 mb-8">
                    <p className="text-sm text-slate-500 mb-1">Tổng dư nợ thẻ</p>
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {fmt(totalDebt)}₫
                    </h1>
                    {totalDebt > 0 ? (
                        <div className="flex items-center justify-center gap-1 mt-2 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                            <BadgePercent className="w-4 h-4" />
                            <span>Hoàn tiền cả năm: <strong>{fmt(yearlyCashback)}₫</strong></span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-1 mt-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Không có dư nợ thẻ tín dụng</span>
                        </div>
                    )}
                </div>

                {/* ── Card carousel ───────────────────────────── */}
                <div className="pl-6 mb-2 overflow-hidden">
                    <div className="flex items-center justify-between pr-6 mb-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Thẻ của tôi</h2>
                            {creditCards.length > 0 && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                                    {creditCards.length} thẻ
                                </span>
                            )}
                        </div>
                        <Link href="/accounts" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:opacity-80">
                            Xem tất cả
                        </Link>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x pr-6"
                        style={{ scrollbarWidth: 'none' }}>
                        {loading && (
                            <div className="snap-center shrink-0 w-[85%] min-h-[200px] rounded-3xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
                        )}
                        {!loading && creditCards.map((card, idx) => {
                            const apiBank = fetchedBanks.find(
                                (b: any) => b.shortName?.toUpperCase() === (card.bankShortName || '').toUpperCase()
                                    || b.name?.toUpperCase().includes((card.bankName || '').toUpperCase())
                            );
                            const bankLogoUrl = apiBank?.logo || undefined;
                            return (
                                <CreditCardSlide key={card._id} card={card} idx={idx}
                                    bankLogoUrl={bankLogoUrl}
                                    onEdit={() => { setEditCard(card); setShowForm(true); }}
                                    onDelete={() => setDeleteConfirmId(card._id)}
                                    onPay={() => setShowPayment(true)} />
                            );
                        })}
                        {/* Add new card slide */}
                        <button
                            onClick={() => { setEditCard(null); setShowForm(true); }}
                            className="snap-center shrink-0 w-[60%] min-h-[180px] rounded-3xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition">
                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="font-semibold text-sm">Thêm thẻ mới</span>
                        </button>
                    </div>
                </div>

                {/* ── Quick actions ────────────────────────────── */}
                <div className="px-6 mb-6">
                    <div className="bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl p-4 flex justify-between items-center shadow-sm border border-white/50 dark:border-slate-700/50">
                        {[
                            { icon: <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />, label: 'Thanh toán', bg: '#EEF2FF', bgDark: '#312E81', onClick: () => setShowPayment(true) },
                            { icon: <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />, label: 'Giao dịch', bg: '#D1FAE5', bgDark: '#064E3B', onClick: openAddModal },
                            { icon: <History className="w-5 h-5 text-orange-600 dark:text-orange-400" />, label: 'Lịch sử', bg: '#FEF3C7', bgDark: '#78350F', onClick: () => router.push('/dashboard') },
                            { icon: <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />, label: 'Báo cáo', bg: '#EDE9FE', bgDark: '#4C1D95', onClick: () => router.push('/analytics') },
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
                <div className="px-6 mb-6">
                    <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px] opacity-70">Tài khoản & Ví</h3>
                        <button onClick={() => { setEditCard(null); setShowForm(true); }} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Thêm mới</button>
                    </div>
                    <div className="space-y-2.5">
                        {accounts.length > 0 ? accounts.map(acc => {
                            const apiBank = fetchedBanks.find(
                                (b: any) => b.shortName?.toUpperCase() === (acc.bankShortName || '').toUpperCase()
                                    || b.name?.toUpperCase().includes((acc.bankName || '').toUpperCase())
                            );
                            const bankLogoUrl = apiBank?.logo || undefined;
                            return (
                                <AccountRow key={acc._id} card={acc}
                                    bankLogoUrl={bankLogoUrl}
                                    onEdit={() => { setEditCard(acc); setShowForm(true); }}
                                    onDelete={() => setDeleteConfirmId(acc._id)} />
                            );
                        }) : (
                            <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-4 text-center border border-dashed border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-400">Chưa có tài khoản thanh toán hoặc ví</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Payment alerts ───────────────────────────── */}
                <div className="px-6 mb-5">
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2.5">Hạn thanh toán</h3>
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-slate-800">
                        {paymentAlerts.length > 0 ? paymentAlerts.map(({ card, days }) => {
                            const isUrgent = (days ?? 99) <= 5;
                            const minPay = card.balance * 0.05;
                            return (
                                <DetailRow
                                    key={card._id}
                                    icon={<Clock className={cn('w-5 h-5', isUrgent ? 'text-red-500' : 'text-orange-500')} />}
                                    iconBg={isUrgent ? '#FEE2E2' : '#FEF3C7'}
                                    title={`${card.bankShortName} — Hạn thanh toán`}
                                    sub={`Tối thiểu: ${fmtShort(minPay)}₫`}
                                    value={`${card.paymentDueDay}/${new Date().getMonth() + 1 > 12 ? 1 : new Date().getMonth() + 1}`}
                                    badge={isUrgent ? 'Gấp' : `${days}N nữa`}
                                    badgeColor={isUrgent ? '#EF4444' : '#F59E0B'}
                                />
                            );
                        }) : (
                            <DetailRow
                                icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                iconBg={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#064E3B' : '#D1FAE5'}
                                title="Không có hạn thanh toán gần"
                                sub="Tất cả thẻ đều ổn"
                                value="Tốt 👍"
                            />
                        )}

                        <div className="mx-4 border-t border-gray-100 dark:border-slate-700" />

                        <DetailRow
                            icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
                            iconBg={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#312E81' : '#EEF2FF'}
                            title="Tổng hạn mức tín dụng"
                            sub={`${creditCards.length} thẻ tín dụng`}
                            value={`${fmtShort(creditCards.reduce((s, c) => s + c.creditLimit, 0))}₫`}
                        />
                    </div>
                </div>

                {/* ── Cashback section ─────────────────────────── */}
                <div className="px-6 mb-5">
                    <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Hoàn tiền ước tính</h3>
                        <span className="text-xs text-slate-400">{monthLabel}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
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

                        {/* Per-category breakdown */}
                        {cashbackByCategory.length > 0 ? (
                            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                {cashbackByCategory.map(([cat, cb]) => (
                                    <div key={cat} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{cat}</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                                {Math.round((CASHBACK_RATES[cat] || DEFAULT_RATE) * 100 * 10) / 10}% hoàn tiền
                                            </p>
                                        </div>
                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">+{fmtShort(cb)}₫</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center">
                                <p className="text-sm text-slate-400 dark:text-slate-500">Chưa có giao dịch tháng này</p>
                            </div>
                        )}

                        {/* Info note */}
                        <div className="mx-4 border-t border-gray-100 dark:border-slate-700 py-3">
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center">
                                * Ước tính dựa trên tỷ lệ hoàn tiền trung bình. Số thực tế tùy theo chính sách ngân hàng.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Installment plans ─────────────────────────── */}
                {installmentPlans.length > 0 && (
                    <div className="px-6 mb-5">
                        <div className="flex items-center justify-between mb-2.5">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Kế hoạch trả góp</h3>
                            <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                {installmentPlans.length} gói
                            </span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden divide-y divide-gray-100 dark:divide-slate-700">
                            {installmentPlans.map(({ t, months, monthly, remaining, paid }) => {
                                const paidPct = months > 0 ? Math.round((paid / months) * 100) : 0;
                                return (
                                    <div key={t._id} className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                                                    <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
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
                    <div className="px-6 mb-5">
                        <div className="flex items-center justify-between mb-2.5">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <History className="w-4 h-4 text-indigo-500" />
                                Lịch sử giao dịch
                            </h3>
                            <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                {creditCardTxs.length} giao dịch
                            </span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/50">
                            {(historyExpanded ? creditCardTxs : creditCardTxs.slice(0, 5)).map(t => {
                                const isExpense = t.type === 'expense';
                                const isInstallment = (t as any).isInstallment;
                                const cb = isExpense ? t.amount * getCashbackRate(t.category) : 0;
                                const txDate = new Date(t.date);
                                const isToday = txDate.toDateString() === new Date().toDateString();
                                const isYesterday = txDate.toDateString() === new Date(Date.now() - 86400000).toDateString();
                                const dateLabel = isToday ? 'Hôm nay' : isYesterday ? 'Hôm qua' :
                                    txDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                                return (
                                    <div key={t._id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                                        {/* Icon */}
                                        <div className={cn(
                                            'w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0',
                                            isExpense
                                                ? 'bg-red-50 dark:bg-red-900/30'
                                                : 'bg-emerald-50 dark:bg-emerald-900/30'
                                        )}>
                                            {isExpense
                                                ? <ArrowUpRight className="w-4 h-4 text-red-500" />
                                                : <ArrowDownLeft className="w-4 h-4 text-emerald-600" />}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{t.category}</p>
                                                {isInstallment && (
                                                    <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                                                        TG {(t as any).installmentMonths}th
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {t.note && <p className="text-xs text-slate-400 truncate max-w-[120px]">{t.note}</p>}
                                                <span className="text-[10px] text-slate-300 dark:text-slate-600 flex-shrink-0">{dateLabel}</span>
                                            </div>
                                        </div>

                                        {/* Amount + cashback */}
                                        <div className="text-right flex-shrink-0">
                                            <p className={cn('text-sm font-bold',
                                                isExpense ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                                                {isExpense ? '-' : '+'}{fmt(t.amount)}₫
                                            </p>
                                            {isExpense && cb > 0 && (
                                                <p className="text-[10px] text-amber-500 font-semibold">+{Math.round(cb).toLocaleString('vi-VN')}₫ CB</p>
                                            )}
                                            {isInstallment && (
                                                <p className="text-[10px] text-indigo-400 font-semibold">{fmtShort((t as any).installmentMonthly || 0)}/th</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Show more / less */}
                            {creditCardTxs.length > 5 && (
                                <button
                                    onClick={() => setHistoryExpanded(prev => !prev)}
                                    className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition">
                                    {historyExpanded ? (
                                        <><ChevronUp className="w-3.5 h-3.5" /> Thu gọn</>
                                    ) : (
                                        <><ChevronDown className="w-3.5 h-3.5" /> Xem thêm {creditCardTxs.length - 5} giao dịch</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Promo banner ────────────────────────────── */}
                <div className="px-6">
                    <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' }}>
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full pointer-events-none" />
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <p className="text-xs font-semibold opacity-80 mb-1">Ưu đãi thẻ</p>
                                <p className="font-bold text-lg leading-tight">Hoàn tiền không giới hạn<br />với thẻ chính</p>
                                <button onClick={() => setShowPayment(true)}
                                    className="mt-3 bg-white text-indigo-700 text-xs font-bold py-1.5 px-3 rounded-xl shadow-sm hover:bg-indigo-50 transition">
                                    Thanh toán ngay
                                </button>
                            </div>
                            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm flex-shrink-0">
                                <Gift className="w-8 h-8 text-white" />
                            </div>
                        </div>
                    </div>
                </div>
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
                        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-white dark:bg-slate-800 rounded-t-3xl p-6 shadow-2xl">
                            <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-5" />
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 text-red-500" />
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
                                    className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                                    Huỷ
                                </button>
                                <button
                                    onClick={() => { deleteCard(deleteConfirmId); setDeleteConfirmId(null); }}
                                    className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-sm font-bold text-white transition active:scale-95">
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
                className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #818CF8, #6C63FF)' }}>
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
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
