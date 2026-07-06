'use client';
import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
    Pencil, Trash2, CreditCard, AlertCircle, Star,
    ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp,
    User, Hash, Layers, CalendarClock, StickyNote,
} from 'lucide-react';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useBanks } from '@/hooks/useBanks';
import { getBankLogo } from '@/lib/bankLogos';
import CardFormModal from '@/components/CardFormModal';
import CardPaymentModal from '@/components/CardPaymentModal';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';

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

const CASHBACK_RATES: Record<string, number> = {
    'Ăn uống': 0.03, 'Siêu thị': 0.025, 'Di chuyển': 0.02,
    'Mua sắm': 0.015, 'Giải trí': 0.015, 'Sức khỏe': 0.01, 'Giáo dục': 0.01,
};
const DEFAULT_RATE = 0.005;
function getCashbackRate(category: string) {
    return CASHBACK_RATES[category] || DEFAULT_RATE;
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

    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    const [showForm, setShowForm] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [historyExpanded, setHistoryExpanded] = useState(false);

    const card = useMemo(() => cards.find(c => c._id === params.id), [cards, params.id]);
    const accounts = useMemo(
        () => cards.filter(c => ['debit', 'eWallet', 'crypto'].includes(c.cardType)),
        [cards]
    );

    const cardTxs = useMemo(() => {
        if (!card) return [];
        return transactions
            .filter(t => t.paymentMethod === 'card' && ((t.cardId as any)?._id || t.cardId) === card._id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, card]);

    const cashbackTotal = useMemo(
        () => cardTxs.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount * getCashbackRate(t.category) : 0), 0),
        [cardTxs]
    );

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
            <div className="min-h-screen pb-32 bg-gray-50 dark:bg-slate-900">
                <PageHeader title="Chi tiết thẻ" backHref="/cards" />
                <div className="px-5 pt-4 space-y-4">
                    <div className="h-48 rounded-3xl bg-gray-200 dark:bg-slate-800 animate-pulse" />
                    <div className="h-24 rounded-2xl bg-gray-200 dark:bg-slate-800 animate-pulse" />
                </div>
            </div>
        );
    }

    if (!card) {
        return (
            <div className="min-h-screen pb-32 bg-gray-50 dark:bg-slate-900">
                <PageHeader title="Chi tiết thẻ" backHref="/cards" />
                <div className="flex flex-col items-center justify-center gap-3 py-24 px-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <CreditCard className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-200">Không tìm thấy thẻ</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">Thẻ này có thể đã bị xoá.</p>
                </div>
            </div>
        );
    }

    const usedPct = card.creditLimit > 0 ? Math.min((card.balance / card.creditLimit) * 100, 100) : 0;
    const dueDays = daysUntilPayment(card.paymentDueDay);
    const isUrgent = dueDays !== null && dueDays <= 5;
    const ts = cardTextStyle(card.color);
    const logoUrl = (apiBank as any)?.logo || getBankLogo(card.bankShortName, card.bankName);
    const isCredit = card.cardType === 'credit';

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            <PageHeader
                title={card.bankName}
                subtitle="Chi tiết thẻ"
                backHref="/cards"
                rightActions={
                    <button onClick={() => setShowForm(true)}
                        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all flex-shrink-0">
                        <Pencil className="w-4 h-4" />
                    </button>
                }
            />

            <div className="px-5 pt-4 space-y-5">
                {/* ── Card visual ───────────────────────────────── */}
                <div className="relative rounded-3xl p-5 shadow-xl overflow-hidden"
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
                                <Star className="w-2.5 h-2.5" /> Mặc định
                            </span>
                        )}
                    </div>

                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <p className="text-xs mb-1" style={{ color: ts.subtext }}>{isCredit ? 'Dư nợ hiện tại' : 'Số dư'}</p>
                            <p className="text-3xl font-bold tracking-tight" style={{ color: ts.text }}>{fmt(card.balance)}₫</p>
                        </div>
                        {isCredit && dueDays !== null && (
                            <div className="text-right">
                                <p className="text-xs mb-1" style={{ color: ts.subtext }}>Hạn thanh toán</p>
                                <div className="flex items-center gap-1 justify-end">
                                    {isUrgent && <AlertCircle className="w-4 h-4 text-red-400" />}
                                    <p className={cn('text-sm font-bold', isUrgent ? 'text-red-400' : '')} style={isUrgent ? undefined : { color: ts.subtext }}>
                                        {dueDays <= 0 ? 'Đã quá hạn!' : `${dueDays} ngày nữa`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {isCredit && card.creditLimit > 0 && (
                        <>
                            <div className="flex justify-between text-[11px] mb-1.5" style={{ color: ts.subtext }}>
                                <span>Đã dùng {usedPct.toFixed(0)}%</span>
                                <span>Hạn mức: <strong className="text-sm">{fmtShort(card.creditLimit)}</strong></span>
                            </div>
                            <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                    style={{ width: `${usedPct}%`, backgroundColor: usedPct > 80 ? '#FCA5A5' : ts.subtext }} />
                            </div>
                        </>
                    )}
                </div>

                {/* ── Quick actions ─────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                    {isCredit && card.balance > 0 && (
                        <button onClick={() => setShowPayment(true)}
                            className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all">
                            <CreditCard className="w-4 h-4" /> Thanh toán ngay
                        </button>
                    )}
                    {!card.isDefault && (
                        <button onClick={() => setDefaultCard(card._id)}
                            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-yellow-300 dark:hover:border-yellow-700 active:scale-[0.98] transition-all">
                            <Star className="w-4 h-4 text-yellow-500" /> Đặt mặc định
                        </button>
                    )}
                    <button onClick={() => setDeleteConfirm(true)}
                        className={cn(
                            'flex items-center justify-center gap-2 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-sm font-bold text-red-500 hover:border-red-300 dark:hover:border-red-900 active:scale-[0.98] transition-all',
                            card.isDefault && 'col-span-2'
                        )}>
                        <Trash2 className="w-4 h-4" /> Xoá thẻ
                    </button>
                </div>

                {/* ── Info panel ────────────────────────────────── */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm divide-y divide-gray-50 dark:divide-slate-700/50 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                        <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-400 flex-1">Chủ thẻ</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{card.cardHolder || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                        <Hash className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-400 flex-1">Số thẻ</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-widest">•••• {card.cardNumber}</span>
                    </div>
                    {card.cardNetwork && (
                        <div className="flex items-center gap-3 px-4 py-3">
                            <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-400 flex-1">Mạng lưới</span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{NETWORK_LABELS[card.cardNetwork] || card.cardNetwork}</span>
                        </div>
                    )}
                    {isCredit && card.statementDay > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3">
                            <CalendarClock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-400 flex-1">Ngày sao kê</span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ngày {card.statementDay} hàng tháng</span>
                        </div>
                    )}
                    {isCredit && cashbackTotal > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3">
                            <CreditCard className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span className="text-xs text-slate-400 flex-1">Hoàn tiền ước tính</span>
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">+{fmtShort(cashbackTotal)}₫</span>
                        </div>
                    )}
                    {card.note && (
                        <div className="flex items-start gap-3 px-4 py-3">
                            <StickyNote className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{card.note}</span>
                        </div>
                    )}
                </div>

                {/* ── Transaction history ───────────────────────── */}
                {cardTxs.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2.5 px-1">
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Lịch sử giao dịch</h3>
                            <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                {cardTxs.length} giao dịch
                            </span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/50">
                            {(historyExpanded ? cardTxs : cardTxs.slice(0, 5)).map(t => {
                                const isExpense = t.type === 'expense';
                                const cb = isExpense ? t.amount * getCashbackRate(t.category) : 0;
                                const txDate = new Date(t.date);
                                const dateLabel = txDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                return (
                                    <div key={t._id} className="flex items-center gap-3 px-4 py-3">
                                        <div className={cn(
                                            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                                            isExpense ? 'bg-red-50 dark:bg-red-900/30' : 'bg-emerald-50 dark:bg-emerald-900/30'
                                        )}>
                                            {isExpense
                                                ? <ArrowUpRight className="w-4 h-4 text-red-500" />
                                                : <ArrowDownLeft className="w-4 h-4 text-emerald-600" />}
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
                                                {isExpense ? '-' : '+'}{fmt(t.amount)}₫
                                            </p>
                                            {isExpense && cb > 0 && (
                                                <p className="text-[10px] text-amber-500 font-semibold">+{Math.round(cb).toLocaleString('vi-VN')}₫ CB</p>
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
                                            <><ChevronUp className="w-3.5 h-3.5" /> Thu gọn</>
                                        ) : (
                                            <><ChevronDown className="w-3.5 h-3.5" /> Xem thêm {cardTxs.length - 5} giao dịch</>
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

            {deleteConfirm && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setDeleteConfirm(false)} />
                    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-white dark:bg-slate-800 rounded-t-3xl p-6 shadow-2xl">
                        <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-5" />
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                                <Trash2 className="w-6 h-6 text-red-500" />
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
