'use client';
import { useState, useMemo } from 'react';
import {
    Plus, ArrowLeft, RefreshCw, Trash2, Pencil, Star, MoreHorizontal,
    TrendingDown, AlertTriangle, PiggyBank, CreditCard,
    Wallet, Smartphone, Bitcoin, ChevronRight, BadgeCheck,
} from 'lucide-react';
import { useCards, type Card } from '@/hooks/useCards';
import CardFormModal from '@/components/CardFormModal';
import { cn } from '@/lib/utils';
import { getBankLogo } from '@/lib/bankLogos';
import { useRouter } from 'next/navigation';

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

function getCardGradient(card: Card, idx: number): string {
    if (card.color === '#111111' || card.color === '#FFFFFF') return card.color;
    if (card.bankColor && card.color && card.bankColor !== '#1B4FD8') {
        return `linear-gradient(135deg, ${card.bankColor} 0%, ${card.color} 100%)`;
    }
    return CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
}

function cardTextStyle(color: string) {
    if (color === '#111111') return { text: '#F59E0B', subtext: '#FCD34D', border: '1px solid #374151' };
    if (color === '#FFFFFF') return { text: '#1E293B', subtext: '#64748B', border: '1px solid #E2E8F0' };
    return { text: '#FFFFFF', subtext: 'rgba(255,255,255,0.75)', border: undefined };
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
                    <div className="absolute top-9 right-0 z-20 bg-white dark:bg-slate-800 rounded-xl shadow-xl py-1 min-w-[150px] overflow-hidden border border-gray-100 dark:border-slate-700">
                        {!isDefault && (
                            <button onClick={() => { setOpen(false); onSetDefault(); }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                                <Star className="w-4 h-4 text-yellow-500" /> Đặt mặc định
                            </button>
                        )}
                        <button onClick={() => { setOpen(false); onEdit(); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                            <Pencil className="w-4 h-4 text-indigo-500" /> Chỉnh sửa
                        </button>
                        <button onClick={() => { setOpen(false); onDelete(); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
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
    const gradient = getCardGradient(card, idx);
    const ts = cardTextStyle(card.color);
    const usedPct = card.creditLimit > 0 ? (card.balance / card.creditLimit) * 100 : 0;
    const dueDays = card.paymentDueDay
        ? (() => {
            const now = new Date();
            const due = new Date(now.getFullYear(), now.getMonth(), card.paymentDueDay);
            if (due < now) due.setMonth(due.getMonth() + 1);
            return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
        })()
        : null;
    const logoUrl = getBankLogo(card.bankShortName, card.bankName);

    return (
        <div className="snap-center shrink-0 w-[85%] rounded-xl p-6 shadow-xl relative overflow-hidden"
            style={{ background: gradient, border: ts.border }}>
            {card.color !== '#111111' && card.color !== '#FFFFFF' && (
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
            )}
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2">
                    {/* Bank logo */}
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt={card.bankShortName || card.bankName}
                            className="w-9 h-9 rounded-xl object-contain bg-white/90 p-0.5 flex-shrink-0 shadow-sm"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold" style={{ color: ts.text }}>
                                {(card.bankShortName || card.bankName || '?').substring(0, 3).toUpperCase()}
                            </span>
                        </div>
                    )}
                    <div>
                        <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: ts.subtext }}>{card.bankName}</p>
                        <p className="text-base font-bold mt-0.5 tracking-widest" style={{ color: ts.text }}>•••• {card.cardNumber}</p>
                    </div>
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
            <div className="flex justify-between items-end mb-3">
                <div>
                    <p className="text-xs mb-1" style={{ color: ts.subtext }}>Dư nợ hiện tại</p>
                    <p className="text-2xl font-bold" style={{ color: ts.text }}>{fmt(card.balance)}</p>
                </div>
                {dueDays !== null && (
                    <div className="text-right">
                        <p className="text-xs mb-1" style={{ color: ts.subtext }}>Hạn thanh toán</p>
                        <p className={cn('text-sm font-bold', dueDays <= 3 ? 'text-red-400' : '')} style={dueDays > 3 ? { color: ts.subtext } : undefined}>
                            {dueDays <= 0 ? 'Đã quá hạn!' : `${dueDays} ngày nữa`}
                        </p>
                    </div>
                )}
            </div>
            {card.creditLimit > 0 && (
                <>
                    <div className="flex justify-between text-[10px] mb-1" style={{ color: ts.subtext }}>
                        <span>Đã dùng {usedPct.toFixed(0)}%</span>
                        <span>Hạn mức: {fmtShort(card.creditLimit)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                            style={{
                                width: `${Math.min(usedPct, 100)}%`,
                                backgroundColor: usedPct > 80 ? '#FCA5A5' : ts.subtext,
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
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-100 dark:border-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"
                style={{ backgroundColor: '#8B5CF620' }} />
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    {(() => {
                        const logoUrl = getBankLogo(card.bankShortName, card.bankName);
                        return logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={card.bankShortName || card.bankName}
                                className="w-10 h-10 rounded-xl object-contain bg-white dark:bg-white/90 p-1 border border-gray-100 dark:border-slate-700 shadow-sm flex-shrink-0"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50 flex items-center justify-center flex-shrink-0">
                                <PiggyBank className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                            </div>
                        );
                    })()}
                    <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{card.bankName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
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
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-1 font-medium">Số tiền gốc</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{fmt(card.balance)}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-400 mb-1">Lãi tạm tính</p>
                    <p className="text-lg font-bold text-purple-600">
                        {estimatedInterest > 0 ? `+${fmtShort(estimatedInterest)}` : '—'}
                    </p>
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 flex justify-between items-center text-xs border border-gray-100 dark:border-slate-800/50">
                <div className="text-center flex-1 border-r border-gray-200 dark:border-slate-700/50">
                    <p className="text-slate-400 dark:text-slate-500 mb-0.5">Lãi suất</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{card.interestRate ? `${card.interestRate}%/năm` : '—'}</p>
                </div>
                <div className="text-center flex-1 border-r border-gray-200 dark:border-slate-700/50">
                    <p className="text-slate-400 dark:text-slate-500 mb-0.5">Ngày gửi</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{formatDate(card.depositDate)}</p>
                </div>
                <div className="text-center flex-1">
                    <p className="text-slate-400 dark:text-slate-500 mb-0.5">Đáo hạn</p>
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
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-between hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-center gap-3">
                {(() => {
                    const logoUrl = getBankLogo(card.bankShortName, card.bankName);
                    return logoUrl ? (
                        <img
                            src={logoUrl}
                            alt={card.bankShortName || card.bankName}
                            className="w-12 h-12 rounded-xl object-contain bg-white dark:bg-white/90 p-1.5 border border-gray-100 dark:border-slate-800 shadow-sm flex-shrink-0"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    ) : (
                        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
                            <TypeIcon className="w-5 h-5" />
                        </div>
                    );
                })()}
                <div>
                    <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{card.bankName}</p>
                        {card.isDefault && <BadgeCheck className="w-3.5 h-3.5 text-indigo-500" />}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">••{card.cardNumber} · {card.cardHolder}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="text-right">
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{fmt(card.balance)}</p>
                </div>
                <CardMenu onEdit={onEdit} onDelete={onDelete} onSetDefault={onSetDefault} isDefault={card.isDefault} />
            </div>
        </div>
    );
}

// ─── Delete confirm ────────────────────────────────────────────────────────
function DeleteConfirm({ card, onConfirm, onCancel }: { card: Card; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onCancel}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl p-6 space-y-4 shadow-2xl pb-10" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                    <Trash2 className="w-6 h-6 text-red-500" />
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
    const { cards, totalBalance, totalDebt, loading, createCard, updateCard, deleteCard, setDefaultCard, refetch } = useCards();
    const router = useRouter();
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
        <div className="min-h-screen pb-32 bg-[#F8F9FF] dark:bg-slate-950 transition-colors duration-200">
            {/* Background gradient blob - dark mode friendly */}
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(224,195,252,0.3), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(139,92,246,0.1), transparent)' }} />

            {/* ── Header ─────────────────────────────────────── */}
            <header className="pt-14 px-5 pb-2 flex items-center gap-4 sticky top-0 z-20 backdrop-blur-lg">
                <button onClick={() => router.push('/dashboard')}
                    className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 active:scale-95 transition-all flex-shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-tight">Tài chính</p>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Tài khoản & Tài sản</h1>
                </div>
                <button onClick={refetch}
                    className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 active:scale-95 transition-all relative flex-shrink-0">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </header>

            <div className="relative z-10">
                {/* ── Summary & Net Worth ──────────────────────────── */}
                <div className="px-5 pb-6">
                    <div className="relative overflow-hidden rounded-3xl p-6 shadow-sm border border-white/50 dark:border-slate-800/50 bg-gradient-to-br from-[#E0C3FC]/20 to-[#8EC5FC]/20 dark:from-purple-900/10 dark:to-blue-900/10">
                        {/* Net worth */}
                        <div className="text-center mb-6">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">Tổng tài sản ròng</p>
                            <p className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-2">{fmt(netWorth)} đ</p>
                            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                <TrendingDown className="w-4 h-4" />
                                <span>Dư nợ: {fmtShort(totalDebt)}</span>
                            </div>
                        </div>

                        {/* Summary pills */}
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: 'Tài sản', value: fmtShort(totalBalance), color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/50 dark:bg-emerald-900/20' },
                                { label: 'Tiết kiệm', value: fmtShort(totalSavings), color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-900/20' },
                                { label: 'Dư nợ thẻ', value: `-${fmtShort(totalDebt)}`, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50/50 dark:bg-red-900/20' },
                            ].map(item => (
                                <div key={item.label} className={cn('rounded-xl p-2.5 text-center transition-all', item.bg)}>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-0.5">{item.label}</p>
                                    <p className={cn('font-bold text-sm leading-none', item.color)}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mt-5 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl p-1.5 flex gap-1.5 border border-slate-200/50 dark:border-slate-800/50">
                        {(['cards', 'savings'] as const).map(tab => (
                            <button key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
                                    activeTab === tab
                                        ? 'bg-white dark:bg-slate-800 text-[#7f19e6] dark:text-purple-400 shadow-md scale-[1.02]'
                                        : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                )}>
                                {tab === 'cards' ? (
                                    <>
                                        <Wallet className="w-4 h-4" />
                                        <span>Thẻ & Ví</span>
                                        {(creditCards.length + debitCards.length) > 0 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#7f19e6]/10 text-[#7f19e6] dark:text-purple-400">
                                                {creditCards.length + debitCards.length}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <PiggyBank className="w-4 h-4" />
                                        <span>Tiết kiệm</span>
                                        {savingsCards.length > 0 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#7f19e6]/10 text-[#7f19e6] dark:text-purple-400">
                                                {savingsCards.length}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-5 py-4 space-y-5">

                    {/* ── Maturity alert ───────────────────────────────── */}
                    {maturityAlerts.map(card => (
                        <div key={card._id} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-orange-100 dark:border-orange-900/20 flex items-start gap-3 shadow-sm shadow-orange-500/5">
                            <div className="bg-orange-100 dark:bg-orange-900/20 p-2 rounded-full text-orange-600 dark:text-orange-400 flex-shrink-0">
                                <AlertTriangle className="w-5 h-5" />
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
                            {/* Credit card horizontal scroll */}
                            {creditCards.length > 0 && (
                                <section>
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Thẻ tín dụng</h2>
                                        <button onClick={() => refetch()} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-900/20 px-2.5 py-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all uppercase tracking-tight">Cập nhật</button>
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar -mx-5 px-5">
                                        {creditCards.map((card, idx) => (
                                            <CreditCardSlide key={card._id} card={card} idx={idx}
                                                onEdit={() => { setEditCard(card); setShowForm(true); }}
                                                onDelete={() => setDeleteTarget(card)}
                                                onSetDefault={() => setDefaultCard(card._id)} />
                                        ))}
                                        {/* Add credit card slide */}
                                        <button onClick={() => openAdd('credit')}
                                            className="snap-center shrink-0 w-40 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-purple-300 dark:hover:border-purple-800 hover:text-purple-500 transition-all min-h-[160px] shadow-sm">
                                            <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                                                <Plus className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-tight">Thêm thẻ</span>
                                        </button>
                                    </div>
                                </section>
                            )}

                            {/* Debit / eWallet / Crypto accounts */}
                            <section>
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tài khoản thanh toán</h2>
                                    <button onClick={() => openAdd('debit')}
                                        className="text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-900/20 px-2.5 py-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all uppercase tracking-tight">
                                        Thêm mới
                                    </button>
                                </div>
                                {debitCards.length > 0 ? (
                                    <div className="space-y-3">
                                        {debitCards.map(card => (
                                            <AccountRow key={card._id} card={card}
                                                onEdit={() => { setEditCard(card); setShowForm(true); }}
                                                onDelete={() => setDeleteTarget(card)}
                                                onSetDefault={() => setDefaultCard(card._id)} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-white dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                                        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium italic">Chưa có tài khoản thanh toán</p>
                                    </div>
                                )}
                            </section>

                            {/* If no credit cards at all, show add button */}
                            {creditCards.length === 0 && (
                                <button onClick={() => openAdd('credit')}
                                    className="w-full flex items-center gap-4 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-purple-300 dark:hover:border-purple-900 transition-all group">
                                    <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <CreditCard className="w-6 h-6 text-purple-500" />
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 dark:text-slate-200">Thêm thẻ tín dụng</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium truncate">Theo dõi dư nợ và hạn thanh toán ngay</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
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
                                    className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-all shadow-sm">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            {savingsCards.length > 0 ? (
                                <div className="space-y-4">
                                    {savingsCards.map(card => (
                                        <SavingsCard key={card._id} card={card}
                                            onEdit={() => { setEditCard(card); setShowForm(true); }}
                                            onDelete={() => setDeleteTarget(card)} />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center py-20 gap-6 bg-white dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                                    <div className="w-20 h-20 rounded-[2.5rem] bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center transform rotate-3">
                                        <PiggyBank className="w-10 h-10 text-purple-400 dark:text-purple-500" />
                                    </div>
                                    <div className="text-center px-6">
                                        <p className="font-bold text-slate-700 dark:text-slate-200 text-lg">Chưa có sổ tiết kiệm</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-2 max-w-[240px] leading-relaxed">
                                            Hãy thêm các sổ tiết kiệm của bạn để theo dõi lãi suất và ngày đáo hạn tự động.
                                        </p>
                                    </div>
                                    <button onClick={() => openAdd('savings')}
                                        className="bg-[#7f19e6] dark:bg-purple-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-purple-500/20 active:scale-95 transition-all">
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
            </div>
        </div>
    );
}
