'use client';
import { useState, useMemo } from 'react';
import {
    Plus, ArrowLeft, TrendingDown, TrendingUp,
    CreditCard, History, BarChart3, Wallet,
    AlertCircle, Calendar, Gift, Pencil, Trash2,
    Star, BadgePercent, CheckCircle2, Clock, RefreshCw,
} from 'lucide-react';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
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

function getGradient(card: Card, idx: number) {
    if (card.bankColor && card.color && card.bankColor !== '#1B4FD8')
        return `linear-gradient(135deg, ${card.bankColor} 0%, ${card.color} 100%)`;
    return CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
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
function CreditCardSlide({ card, idx, onEdit, onDelete, onPay }: {
    card: Card; idx: number;
    onEdit: () => void; onDelete: () => void; onPay: () => void;
}) {
    const usedPct = card.creditLimit > 0 ? Math.min((card.balance / card.creditLimit) * 100, 100) : 0;
    const dueDays = daysUntilPayment(card.paymentDueDay);
    const isUrgent = dueDays !== null && dueDays <= 5;

    return (
        <div className="snap-center shrink-0 w-[85%] relative rounded-3xl p-6 text-white shadow-xl overflow-hidden
                        transform transition-transform hover:scale-[1.02]"
            style={{ background: getGradient(card, idx) }}>
            {/* Glow blob */}
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />

            <div className="flex justify-between items-start mb-6">
                <div>
                    <p className="text-xs opacity-80 font-semibold tracking-widest uppercase">{card.bankName}</p>
                    <p className="text-2xl font-bold mt-1 tracking-widest">•••• {card.cardNumber}</p>
                </div>
                <div className="flex gap-2 items-center">
                    {card.isDefault && (
                        <span className="bg-yellow-400/80 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" /> Chính
                        </span>
                    )}
                    <div className="flex gap-1">
                        <button onClick={onEdit}
                            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                            <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={onDelete}
                            className="w-7 h-7 rounded-full bg-red-400/30 hover:bg-red-400/50 flex items-center justify-center transition">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-end mb-4">
                <div>
                    <p className="text-xs opacity-70 mb-1">Dư nợ hiện tại</p>
                    <p className="text-2xl font-bold tracking-tight">{fmt(card.balance)}₫</p>
                </div>
                {dueDays !== null ? (
                    <div className="text-right">
                        <p className="text-xs opacity-70 mb-1">Hạn thanh toán</p>
                        <div className="flex items-center gap-1 justify-end">
                            {isUrgent && <AlertCircle className="w-4 h-4 text-red-300" />}
                            <p className={cn('text-sm font-bold', isUrgent ? 'text-red-200' : 'text-white/90')}>
                                {dueDays <= 0 ? 'Đã quá hạn!' : `${dueDays} ngày nữa`}
                            </p>
                        </div>
                    </div>
                ) : (
                    card.statementDay > 0 && (
                        <div className="text-right">
                            <p className="text-xs opacity-70 mb-1">Sao kê ngày</p>
                            <p className="text-sm font-bold">{card.statementDay}/{new Date().getMonth() + 1}</p>
                        </div>
                    )
                )}
            </div>

            {card.creditLimit > 0 && (
                <>
                    <div className="flex justify-between text-[10px] opacity-80 mb-1.5">
                        <span>Đã dùng {usedPct.toFixed(0)}%</span>
                        <span>Hạn mức: {fmtShort(card.creditLimit)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden mb-3">
                        <div className="h-full rounded-full transition-all"
                            style={{
                                width: `${usedPct}%`,
                                backgroundColor: usedPct > 80 ? '#FCA5A5' : 'rgba(255,255,255,0.85)',
                            }} />
                    </div>
                </>
            )}

            {/* Pay button on card */}
            {card.balance > 0 && (
                <button onClick={onPay}
                    className="w-full mt-1 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex items-center justify-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Thanh toán ngay
                </button>
            )}
        </div>
    );
}

// ── Detail info row ---------------------------------------------------------
function DetailRow({ icon, iconBg, title, sub, value, badge, badgeColor }: {
    icon: React.ReactNode; iconBg: string;
    title: string; sub: string; value: string;
    badge?: string; badgeColor?: string;
}) {
    return (
        <div className="flex items-center p-4 hover:bg-gray-50 rounded-2xl transition group cursor-pointer">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 flex-shrink-0"
                style={{ backgroundColor: iconBg }}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                    <h4 className="font-semibold text-slate-800 text-sm truncate">{title}</h4>
                    {badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                            style={{ backgroundColor: `${badgeColor}18`, color: badgeColor }}>
                            {badge}
                        </span>
                    )}
                </div>
                <div className="flex justify-between items-end mt-0.5">
                    <p className="text-xs text-slate-400">{sub}</p>
                    <p className="font-bold text-slate-800 text-sm">{value}</p>
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

    const [showForm, setShowForm] = useState(false);
    const [editCard, setEditCard] = useState<Card | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [addType] = useState<'expense'>('expense');
    const router = useRouter();

    const creditCards = useMemo(() => cards.filter(c => c.cardType === 'credit'), [cards]);

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

    // ── Payment alerts (cards with balance and due within 30d) ──────────────
    const paymentAlerts = useMemo(() =>
        creditCards
            .filter(c => c.balance > 0 && c.paymentDueDay > 0)
            .map(c => ({ card: c, days: daysUntilPayment(c.paymentDueDay) }))
            .filter(x => x.days !== null && x.days <= 30)
            .sort((a, b) => (a.days ?? 99) - (b.days ?? 99))
        , [creditCards]);

    const handleSave = async (data: Parameters<typeof createCard>[0]) => {
        if (editCard) await updateCard(editCard._id, data);
        else await createCard(data);
        setEditCard(null);
    };

    return (
        <div className="min-h-screen pb-32 bg-gray-50">
            {/* Background gradient blob */}
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0"
                style={{ background: 'linear-gradient(to bottom, rgba(199,210,254,0.4), transparent)' }} />

            <div className="relative z-10 pb-8">
                {/* ── Header ─────────────────────────────────────── */}
                <header className="pt-14 px-5 pb-2 flex items-center gap-4">
                    <button onClick={() => router.push('/dashboard')}
                        className="w-10 h-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-slate-600 hover:bg-gray-50 active:scale-95 transition-all flex-shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <p className="text-xs text-slate-400 font-medium">Tài chính</p>
                        <h1 className="text-xl font-bold text-slate-900 leading-tight">Quản lý Thẻ 💳</h1>
                    </div>
                    <button onClick={refetchCards}
                        className="w-10 h-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-slate-600 hover:bg-gray-50 active:scale-95 transition-all relative flex-shrink-0">
                        <RefreshCw className="w-4 h-4" />
                        {paymentAlerts.length > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
                        )}
                    </button>
                </header>

                {/* ── Hero: Total debt ─────────────────────────── */}
                <div className="text-center px-6 mb-8">
                    <p className="text-sm text-slate-500 mb-1">Tổng dư nợ thẻ</p>
                    <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
                        {fmt(totalDebt)}₫
                    </h1>
                    {totalDebt > 0 ? (
                        <div className="flex items-center justify-center gap-1 mt-2 text-emerald-600 text-sm font-medium">
                            <TrendingDown className="w-4 h-4" />
                            <span>Thanh toán đúng hạn để tiết kiệm lãi</span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-1 mt-2 text-emerald-600 text-sm font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Không có dư nợ thẻ tín dụng</span>
                        </div>
                    )}
                </div>

                {/* ── Card carousel ───────────────────────────── */}
                <div className="pl-6 mb-2 overflow-hidden">
                    <div className="flex items-center justify-between pr-6 mb-4">
                        <h2 className="text-base font-bold text-slate-800">Thẻ của tôi</h2>
                        <Link href="/accounts" className="text-xs font-semibold text-indigo-600 hover:opacity-80">
                            Xem tất cả
                        </Link>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x pr-6"
                        style={{ scrollbarWidth: 'none' }}>
                        {loading && (
                            <div className="snap-center shrink-0 w-[85%] min-h-[200px] rounded-3xl bg-gray-100 animate-pulse" />
                        )}
                        {!loading && creditCards.map((card, idx) => (
                            <CreditCardSlide key={card._id} card={card} idx={idx}
                                onEdit={() => { setEditCard(card); setShowForm(true); }}
                                onDelete={() => deleteCard(card._id)}
                                onPay={() => setShowPayment(true)} />
                        ))}
                        {/* Add new card slide */}
                        <button
                            onClick={() => { setEditCard(null); setShowForm(true); }}
                            className="snap-center shrink-0 w-[60%] min-h-[180px] rounded-3xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="font-semibold text-sm">Thêm thẻ mới</span>
                        </button>
                    </div>
                </div>

                {/* ── Quick actions ────────────────────────────── */}
                <div className="px-6 mb-6">
                    <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 flex justify-between items-center shadow-sm border border-white/50">
                        {[
                            { icon: <CreditCard className="w-5 h-5 text-indigo-600" />, label: 'Thanh toán', bg: '#EEF2FF', onClick: () => setShowPayment(true) },
                            { icon: <Wallet className="w-5 h-5 text-emerald-600" />, label: 'Giao dịch', bg: '#D1FAE5', onClick: openAddModal },
                            { icon: <History className="w-5 h-5 text-orange-600" />, label: 'Lịch sử', bg: '#FEF3C7', onClick: () => router.push('/dashboard') },
                            { icon: <BarChart3 className="w-5 h-5 text-purple-600" />, label: 'Báo cáo', bg: '#EDE9FE', onClick: () => router.push('/analytics') },
                        ].map(item => (
                            <button key={item.label} onClick={item.onClick}
                                className="flex flex-col items-center gap-2 group">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                                    style={{ backgroundColor: item.bg }}>
                                    {item.icon}
                                </div>
                                <span className="text-xs font-medium text-slate-600">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Payment alerts ───────────────────────────── */}
                <div className="px-6 mb-5">
                    <h3 className="text-base font-bold text-slate-800 mb-3">Hạn thanh toán</h3>
                    <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
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
                                iconBg="#D1FAE5"
                                title="Không có hạn thanh toán gần"
                                sub="Tất cả thẻ đều ổn"
                                value="Tốt 👍"
                            />
                        )}

                        <div className="mx-4 border-t border-gray-100" />

                        <DetailRow
                            icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
                            iconBg="#EEF2FF"
                            title="Tổng hạn mức tín dụng"
                            sub={`${creditCards.length} thẻ tín dụng`}
                            value={`${fmtShort(creditCards.reduce((s, c) => s + c.creditLimit, 0))}₫`}
                        />
                    </div>
                </div>

                {/* ── Cashback section ─────────────────────────── */}
                <div className="px-6 mb-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold text-slate-800">Hoàn tiền ước tính</h3>
                        <span className="text-xs text-slate-400">{monthLabel}</span>
                    </div>
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Total cashback hero */}
                        <div className="flex items-center gap-4 p-4 border-b border-gray-100"
                            style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <BadgePercent className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-emerald-700 font-medium">Tổng hoàn tiền tháng này</p>
                                <p className="text-2xl font-bold text-emerald-700 tracking-tight">+{fmtShort(cashbackTotal)}₫</p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">
                                Chờ duyệt
                            </span>
                        </div>

                        {/* Per-category breakdown */}
                        {cashbackByCategory.length > 0 ? cashbackByCategory.map(([cat, cb]) => (
                            <div key={cat} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-700 truncate">{cat}</p>
                                    <p className="text-xs text-slate-400">
                                        {Math.round((CASHBACK_RATES[cat] || DEFAULT_RATE) * 100 * 10) / 10}% hoàn tiền
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-emerald-600 flex-shrink-0">+{fmtShort(cb)}₫</span>
                            </div>
                        )) : (
                            <div className="p-6 text-center">
                                <p className="text-sm text-slate-400">Chưa có giao dịch tháng này</p>
                            </div>
                        )}

                        {/* Info note */}
                        <div className="mx-4 border-t border-gray-100 py-3">
                            <p className="text-[10px] text-gray-400 text-center">
                                * Ước tính dựa trên tỷ lệ hoàn tiền trung bình. Số thực tế tùy theo chính sách ngân hàng.
                            </p>
                        </div>
                    </div>
                </div>

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
            />
        </div>
    );
}
