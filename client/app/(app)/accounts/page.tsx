'use client';
import { useState, useMemo } from 'react';
import {
    Plus, RefreshCw, Trash2, Pencil, Star, MoreHorizontal,
    TrendingDown, AlertTriangle, PiggyBank, CreditCard,
    Wallet, Smartphone, Bitcoin, ChevronRight, BadgeCheck,
} from 'lucide-react';
import { useCards, type Card } from '@/hooks/useCards';
import CardFormModal from '@/components/CardFormModal';
import { cn } from '@/lib/utils';

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
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

function getUrgencyColor(days: number | null) {
    if (days === null) return '#6B7280';
    if (days <= 3) return '#EF4444';
    if (days <= 7) return '#F59E0B';
    return '#10B981';
}

const CARD_GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

function getCardGradient(card: Card, idx: number) {
    if (card.bankColor && card.color && card.bankColor !== '#1B4FD8') {
        return `linear-gradient(135deg, ${card.bankColor} 0%, ${card.color} 100%)`;
    }
    return CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
}

// ─── Card Context Menu ─────────────────────────────────────────────────────
function CardMenu({ onEdit, onDelete, onSetDefault, isDefault }: {
    onEdit: () => void; onDelete: () => void; onSetDefault: () => void; isDefault: boolean;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button onClick={() => setOpen(v => !v)}
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition">
                <MoreHorizontal className="w-3.5 h-3.5 text-white" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute top-9 right-0 z-20 bg-white rounded-2xl shadow-xl py-1 min-w-[150px] overflow-hidden border border-gray-100">
                        {!isDefault && (
                            <button onClick={() => { setOpen(false); onSetDefault(); }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                                <Star className="w-4 h-4 text-yellow-500" /> Đặt mặc định
                            </button>
                        )}
                        <button onClick={() => { setOpen(false); onEdit(); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                            <Pencil className="w-4 h-4 text-indigo-500" /> Chỉnh sửa
                        </button>
                        <button onClick={() => { setOpen(false); onDelete(); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" /> Xoá
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Credit Card Slide ─────────────────────────────────────────────────────
function CreditCardSlide({ card, idx, onEdit, onDelete, onSetDefault }: {
    card: Card; idx: number;
    onEdit: () => void; onDelete: () => void; onSetDefault: () => void;
}) {
    const usedPct = card.creditLimit > 0 ? (card.balance / card.creditLimit) * 100 : 0;
    const gradient = getCardGradient(card, idx);
    const dueDays = card.paymentDueDay
        ? (() => {
            const now = new Date();
            const due = new Date(now.getFullYear(), now.getMonth(), card.paymentDueDay);
            if (due < now) due.setMonth(due.getMonth() + 1);
            return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
        })()
        : null;

    return (
        <div className="snap-center shrink-0 w-[85%] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden"
            style={{ background: gradient }}>
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
            <div className="flex justify-between items-start mb-6">
                <div>
                    <p className="text-xs opacity-80 font-semibold tracking-wider uppercase">{card.bankName}</p>
                    <p className="text-xl font-bold mt-1 tracking-widest">•••• {card.cardNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                    {card.isDefault && (
                        <span className="bg-yellow-400/90 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" /> Mặc định
                        </span>
                    )}
                    <CardMenu onEdit={onEdit} onDelete={onDelete} onSetDefault={onSetDefault} isDefault={card.isDefault} />
                </div>
            </div>
            <div className="flex justify-between items-end mb-4">
                <div>
                    <p className="text-xs opacity-70 mb-1">Dư nợ hiện tại</p>
                    <p className="text-2xl font-bold">{fmt(card.balance)}₫</p>
                </div>
                {dueDays !== null && (
                    <div className="text-right">
                        <p className="text-xs opacity-70 mb-1">Hạn thanh toán</p>
                        <p className={cn('text-sm font-bold', dueDays <= 3 ? 'text-red-200' : 'text-white/90')}>
                            {dueDays <= 0 ? 'Đã quá hạn!' : `${dueDays} ngày nữa`}
                        </p>
                    </div>
                )}
            </div>
            {card.creditLimit > 0 && (
                <>
                    <div className="flex justify-between text-[10px] opacity-80 mb-1">
                        <span>Đã dùng {usedPct.toFixed(0)}%</span>
                        <span>Hạn mức: {fmtShort(card.creditLimit)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                            style={{
                                width: `${Math.min(usedPct, 100)}%`,
                                backgroundColor: usedPct > 80 ? '#FCA5A5' : 'rgba(255,255,255,0.85)',
                            }} />
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Savings Book Card ──────────────────────────────────────────────────────
function SavingsCard({ card, onEdit, onDelete }: {
    card: Card; onEdit: () => void; onDelete: () => void;
}) {
    const matDays = daysUntil(card.maturityDate);
    const urgColor = getUrgencyColor(matDays);
    const estimatedInterest = card.interestRate > 0 && card.term > 0
        ? card.balance * (card.interestRate / 100) * (card.term / 12)
        : 0;

    const formatDate = (d: string | null) => d
        ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—';

    return (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"
                style={{ backgroundColor: '#8B5CF620' }} />
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                        <PiggyBank className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 text-sm">{card.bankName}</p>
                        <p className="text-xs text-slate-400">
                            {card.term > 0 ? `Kỳ hạn ${card.term} tháng` : 'Không kỳ hạn'}
                            {card.cardNumber && ` · ••${card.cardNumber}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {matDays !== null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                            style={{ backgroundColor: `${urgColor}15`, color: urgColor }}>
                            {matDays <= 0 ? 'Đã đáo hạn' : matDays <= 30 ? `${matDays}N nữa` : 'Đang hoạt động'}
                        </span>
                    )}
                    <div className="flex gap-1">
                        <button onClick={onEdit} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-purple-100 hover:text-purple-600 transition">
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={onDelete} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-500 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-slate-400 mb-1">Số tiền gốc</p>
                    <p className="text-lg font-bold text-slate-800">{fmt(card.balance)}₫</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-400 mb-1">Lãi tạm tính</p>
                    <p className="text-lg font-bold text-purple-600">
                        {estimatedInterest > 0 ? `+${fmtShort(estimatedInterest)}` : '—'}
                    </p>
                </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center text-xs">
                <div className="text-center flex-1 border-r border-gray-200">
                    <p className="text-slate-400 mb-0.5">Lãi suất</p>
                    <p className="font-semibold text-slate-700">{card.interestRate ? `${card.interestRate}%/năm` : '—'}</p>
                </div>
                <div className="text-center flex-1 border-r border-gray-200">
                    <p className="text-slate-400 mb-0.5">Ngày gửi</p>
                    <p className="font-semibold text-slate-700">{formatDate(card.depositDate)}</p>
                </div>
                <div className="text-center flex-1">
                    <p className="text-slate-400 mb-0.5">Đáo hạn</p>
                    <p className="font-semibold" style={{ color: urgColor }}>{formatDate(card.maturityDate)}</p>
                </div>
            </div>
            {card.note && (
                <p className="text-xs text-slate-400 mt-2 italic">{card.note}</p>
            )}
        </div>
    );
}

// ─── Debit/eWallet/Crypto row ───────────────────────────────────────────────
function AccountRow({ card, onEdit, onDelete, onSetDefault }: {
    card: Card; onEdit: () => void; onDelete: () => void; onSetDefault: () => void;
}) {
    const TypeIcon = card.cardType === 'crypto' ? Bitcoin
        : card.cardType === 'eWallet' ? Smartphone
            : card.cardType === 'savings' ? PiggyBank
                : Wallet;
    const iconBg = card.cardType === 'crypto' ? 'bg-yellow-50 text-yellow-600'
        : card.cardType === 'eWallet' ? 'bg-purple-50 text-purple-600'
            : 'bg-green-50 text-green-600';

    return (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-between hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-center gap-3">
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', iconBg)}>
                    <TypeIcon className="w-5 h-5" />
                </div>
                <div>
                    <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-800 text-sm">{card.bankName}</p>
                        {card.isDefault && <BadgeCheck className="w-3.5 h-3.5 text-indigo-500" />}
                    </div>
                    <p className="text-xs text-slate-400">••{card.cardNumber} · {card.cardHolder}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="text-right">
                    <p className="font-bold text-slate-800 text-sm">{fmt(card.balance)}₫</p>
                </div>
                <CardMenu onEdit={onEdit} onDelete={onDelete} onSetDefault={onSetDefault} isDefault={card.isDefault} />
            </div>
        </div>
    );
}

// ─── Delete confirm ────────────────────────────────────────────────────────
function DeleteConfirm({ card, onConfirm, onCancel }: { card: Card; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
            <div className="bg-white w-full max-w-md rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
                    <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div className="text-center">
                    <h3 className="font-bold text-gray-900 text-lg">Xoá tài khoản</h3>
                    <p className="text-gray-500 text-sm mt-1">
                        Xoá <strong>{card.bankName} ••{card.cardNumber}</strong>? Thao tác không thể hoàn tác.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50">Huỷ</button>
                    <button onClick={onConfirm} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600">Xoá</button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function AccountsPage() {
    const { cards, totalBalance, totalDebt, loading, createCard, updateCard, deleteCard, setDefaultCard, refetch } = useCards();
    const [activeTab, setActiveTab] = useState<'cards' | 'savings'>('cards');
    const [showForm, setShowForm] = useState(false);
    const [editCard, setEditCard] = useState<Card | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);
    const [defaultType, setDefaultType] = useState<typeof cards[0]['cardType']>('debit');

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
        <div className="min-h-screen pb-32" style={{ backgroundColor: '#F8F9FF' }}>

            {/* ── Header gradient ──────────────────────────────────── */}
            <div className="relative overflow-hidden px-5 pt-14 pb-6"
                style={{ background: 'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)' }}>
                <div className="absolute inset-0 opacity-30 pointer-events-none rounded-b-[2.5rem]"
                    style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)' }} />

                <div className="relative flex justify-between items-center mb-5">
                    <h1 className="text-xl font-bold text-slate-800">Tài khoản & Tài sản</h1>
                    <button onClick={refetch}
                        className="w-9 h-9 rounded-full bg-white/40 backdrop-blur-sm flex items-center justify-center text-slate-600 hover:bg-white/60 transition">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {/* Net worth */}
                <div className="text-center mb-5 relative">
                    <p className="text-sm text-slate-600 mb-1">Tổng tài sản ròng</p>
                    <p className="text-4xl font-bold text-slate-900 tracking-tight">{fmt(netWorth)}₫</p>
                    <div className="flex items-center justify-center gap-1 mt-2 text-emerald-700 text-sm font-medium">
                        <TrendingDown className="w-4 h-4" />
                        <span>Dư nợ: {fmtShort(totalDebt)}</span>
                    </div>
                </div>

                {/* Summary pills */}
                <div className="grid grid-cols-3 gap-2 relative">
                    {[
                        { label: 'Tài sản', value: fmtShort(totalBalance), color: 'text-emerald-700' },
                        { label: 'Tiết kiệm', value: fmtShort(totalSavings), color: 'text-blue-700' },
                        { label: 'Dư nợ thẻ', value: `-${fmtShort(totalDebt)}`, color: 'text-red-600' },
                    ].map(item => (
                        <div key={item.label} className="bg-white/50 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/30">
                            <p className="text-[10px] text-slate-500 mb-0.5">{item.label}</p>
                            <p className={cn('font-bold text-sm', item.color)}>{item.value}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="mt-4 bg-white/40 backdrop-blur-sm rounded-2xl p-1 flex relative">
                    {(['cards', 'savings'] as const).map(tab => (
                        <button key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
                                activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                            )}>
                            {tab === 'cards' ? '💳 Thẻ & Ví' : '🐷 Sổ tiết kiệm'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-5 py-4 space-y-5">

                {/* ── Maturity alert ───────────────────────────────── */}
                {maturityAlerts.map(card => (
                    <div key={card._id} className="bg-white rounded-2xl p-4 border border-orange-100 flex items-start gap-3">
                        <div className="bg-orange-100 p-2 rounded-full text-orange-600 flex-shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-sm text-slate-800">Sổ tiết kiệm sắp đáo hạn</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {card.bankName} — {fmt(card.balance)}₫ · còn {daysUntil(card.maturityDate)} ngày. Tất toán hoặc tái tục.
                            </p>
                        </div>
                    </div>
                ))}

                {/* ════════ TAB: CARDS ════════ */}
                {activeTab === 'cards' && (
                    <>
                        {/* Credit card horizontal scroll */}
                        {creditCards.length > 0 && (
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-base font-bold text-slate-800">Thẻ tín dụng</h2>
                                    <button onClick={() => refetch()} className="text-xs text-purple-600 font-semibold">Cập nhật</button>
                                </div>
                                <div className="flex gap-4 overflow-x-auto pb-2 snap-x hide-scroll -mx-1 px-1">
                                    {creditCards.map((card, idx) => (
                                        <CreditCardSlide key={card._id} card={card} idx={idx}
                                            onEdit={() => { setEditCard(card); setShowForm(true); }}
                                            onDelete={() => setDeleteTarget(card)}
                                            onSetDefault={() => setDefaultCard(card._id)} />
                                    ))}
                                    {/* Add credit card slide */}
                                    <button onClick={() => openAdd('credit')}
                                        className="snap-center shrink-0 w-40 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-purple-300 hover:text-purple-500 transition min-h-[160px]">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                            <Plus className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-semibold">Thêm thẻ</span>
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* Debit / eWallet / Crypto accounts */}
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-bold text-slate-800">Tài khoản thanh toán</h2>
                                <button onClick={() => openAdd('debit')}
                                    className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 hover:bg-purple-200 transition">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            {debitCards.length > 0 ? (
                                <div className="space-y-2.5">
                                    {debitCards.map(card => (
                                        <AccountRow key={card._id} card={card}
                                            onEdit={() => { setEditCard(card); setShowForm(true); }}
                                            onDelete={() => setDeleteTarget(card)}
                                            onSetDefault={() => setDefaultCard(card._id)} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    Chưa có tài khoản thanh toán
                                </div>
                            )}
                        </section>

                        {/* If no credit cards at all, show add button */}
                        {creditCards.length === 0 && (
                            <button onClick={() => openAdd('credit')}
                                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600 transition">
                                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className="font-semibold text-sm">Thêm thẻ tín dụng</p>
                                    <p className="text-xs text-gray-400">Theo dõi dư nợ và hạn thanh toán</p>
                                </div>
                                <ChevronRight className="w-4 h-4 ml-auto" />
                            </button>
                        )}
                    </>
                )}

                {/* ════════ TAB: SAVINGS ════════ */}
                {activeTab === 'savings' && (
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-bold text-slate-800">Sổ tiết kiệm online</h2>
                            <button onClick={() => openAdd('savings')}
                                className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 hover:bg-purple-200 transition">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        {savingsCards.length > 0 ? (
                            <div className="space-y-3">
                                {savingsCards.map(card => (
                                    <SavingsCard key={card._id} card={card}
                                        onEdit={() => { setEditCard(card); setShowForm(true); }}
                                        onDelete={() => setDeleteTarget(card)} />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-16 gap-4">
                                <div className="w-16 h-16 rounded-3xl bg-purple-100 flex items-center justify-center">
                                    <PiggyBank className="w-8 h-8 text-purple-400" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-slate-700">Chưa có sổ tiết kiệm</p>
                                    <p className="text-slate-400 text-sm mt-1">Thêm sổ tiết kiệm để theo dõi lãi và kỳ hạn</p>
                                </div>
                                <button onClick={() => openAdd('savings')}
                                    className="gradient-primary text-white px-6 py-3 rounded-2xl font-bold shadow-md">
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
            />

            {deleteTarget && (
                <DeleteConfirm
                    card={deleteTarget}
                    onConfirm={async () => { await deleteCard(deleteTarget._id); setDeleteTarget(null); }}
                    onCancel={() => setDeleteTarget(null)} />
            )}
        </div>
    );
}
