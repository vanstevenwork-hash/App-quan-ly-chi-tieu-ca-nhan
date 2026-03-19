'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Plus, ArrowLeft, TrendingUp,
    PiggyBank, History, BarChart3, RefreshCw,
    AlertTriangle, CalendarCheck, Percent, CheckCircle2,
    Pencil, Trash2, Gift,
} from 'lucide-react';
import { useCards, type Card } from '@/hooks/useCards';
import CardFormModal from '@/components/CardFormModal';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${(n / 1_000).toFixed(0)}k`;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(d: string | null): number | null {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

function urgencyColor(days: number | null) {
    if (days === null) return '#6B7280';
    if (days <= 0) return '#EF4444';
    if (days <= 7) return '#F97316';
    if (days <= 30) return '#F59E0B';
    return '#10B981';
}

function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

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

// ─── Savings book card slide ──────────────────────────────────────────────────
function SavingsSlide({ card, idx, onEdit, onDelete }: {
    card: Card; idx: number; onEdit: () => void; onDelete: () => void;
}) {
    const matDays = daysUntil(card.maturityDate);
    const urg = urgencyColor(matDays);
    const interest = card.interestRate > 0 && card.term > 0
        ? card.balance * (card.interestRate / 100) * (card.term / 12)
        : 0;
    const elapsedPct = (() => {
        if (!card.depositDate || !card.maturityDate) return 0;
        const total = new Date(card.maturityDate).getTime() - new Date(card.depositDate).getTime();
        const elapsed = Date.now() - new Date(card.depositDate).getTime();
        return Math.min(100, Math.max(0, (elapsed / total) * 100));
    })();

    return (
        <div className="snap-center shrink-0 w-[85%] relative rounded-3xl p-6 text-white shadow-xl overflow-hidden transition hover:scale-[1.02]"
            style={{ background: getGradient(card, idx) }}>
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />

            <div className="flex justify-between items-start mb-5">
                <div>
                    <p className="text-xs opacity-80 font-semibold tracking-widest uppercase">{card.bankName}</p>
                    <p className="text-2xl font-bold mt-1 tracking-tight">{fmt(card.balance)}₫</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                    <span className="bg-white/20 rounded-xl px-2.5 py-1 text-xs font-bold">
                        {card.interestRate ? `${card.interestRate}%/năm` : 'Linh hoạt'}
                    </span>
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

            <div className="grid grid-cols-3 gap-2 mb-5 text-center">
                <div className="bg-black/10 rounded-2xl p-2.5">
                    <p className="text-[9px] opacity-70 mb-0.5">Kỳ hạn</p>
                    <p className="text-xs font-bold">{card.term > 0 ? `${card.term}T` : '—'}</p>
                </div>
                <div className="bg-black/10 rounded-2xl p-2.5">
                    <p className="text-[9px] opacity-70 mb-0.5">Lãi tạm tính</p>
                    <p className="text-xs font-bold text-yellow-200">{interest > 0 ? `+${fmtShort(interest)}` : '—'}</p>
                </div>
                <div className="bg-black/10 rounded-2xl p-2.5">
                    <p className="text-[9px] opacity-70 mb-0.5">Đáo hạn</p>
                    <p className="text-xs font-bold" style={{ color: matDays !== null && matDays <= 7 ? '#FCA5A5' : 'white' }}>
                        {matDays !== null ? (matDays <= 0 ? 'Đã đáo' : `${matDays}N`) : '—'}
                    </p>
                </div>
            </div>

            {card.depositDate && card.maturityDate && (
                <>
                    <div className="flex justify-between text-[10px] opacity-75 mb-1.5">
                        <span>Ngày gửi: {fmtDate(card.depositDate)}</span>
                        <span>Đáo hạn: {fmtDate(card.maturityDate)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                            style={{
                                width: `${elapsedPct}%`,
                                backgroundColor: matDays !== null && matDays <= 7 ? '#FCA5A5' : 'rgba(255,255,255,0.85)',
                            }} />
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Detail info row ──────────────────────────────────────────────────────────
function DetailRow({ icon, iconBg, title, sub, value, badge, badgeColor }: {
    icon: React.ReactNode; iconBg: string;
    title: string; sub: string; value: string;
    badge?: string; badgeColor?: string;
}) {
    return (
        <div className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-2xl transition">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 flex-shrink-0"
                style={{ backgroundColor: iconBg }}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2 mb-0.5">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{title}</h4>
                    {badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                            style={{ backgroundColor: `${badgeColor}18`, color: badgeColor }}>
                            {badge}
                        </span>
                    )}
                </div>
                <div className="flex justify-between items-end">
                    <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{value}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Summary API hook ─────────────────────────────────────────────────────────
interface SavingsSummary {
    totalBalance: number;
    totalInterest: number;
    totalAccounts: number;
    bestRate: number;
    maturingSoon: { _id: string; bankName: string; bankShortName: string; balance: number; maturityDate: string; daysLeft: number }[];
}

function useSavingsSummary() {
    const [summary, setSummary] = useState<SavingsSummary | null>(null);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/cards/savings/summary');
            setSummary(res.data.data);
        } catch { /* ignore */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);
    return { summary, loading, refetch: fetch };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SavingsPage() {
    const { cards, createCard, updateCard, deleteCard, refetch: refetchCards } = useCards();
    const { summary, refetch: refetchSummary } = useSavingsSummary();

    const [showForm, setShowForm] = useState(false);
    const [editCard, setEditCard] = useState<Card | null>(null);
    const router = useRouter();

    const savingsCards = useMemo(() => cards.filter(c => c.cardType === 'savings'), [cards]);

    const handleSave = async (data: Parameters<typeof createCard>[0]) => {
        if (editCard) await updateCard(editCard._id, data);
        else await createCard(data);
        setEditCard(null);
        refetchSummary();
    };

    const handleDelete = async (id: string) => {
        await deleteCard(id);
        refetchSummary();
    };

    const refresh = () => { refetchCards(); refetchSummary(); };

    const totalInterest = summary?.totalInterest ?? 0;
    const totalBalance = summary?.totalBalance
        ?? savingsCards.reduce((s, c) => s + c.balance, 0);
    const bestRate = summary?.bestRate
        ?? Math.max(0, ...savingsCards.map(c => c.interestRate || 0));
    const maturingSoon = summary?.maturingSoon ?? [];

    const now = new Date();
    const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            {/* Gradient bg blob */}
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(167,243,208,0.3), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(16,185,129,0.1), transparent)' }} />

            <div className="relative z-10 pb-8">
                {/* ── Header ─────────────────────────────────────── */}
                <header className="pt-4 px-5 pb-2 flex items-center gap-4 sticky top-0 z-20 backdrop-blur-lg">
                    <button onClick={() => router.push('/dashboard')}
                        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all flex-shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Tài chính</p>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Tiết kiệm 🐷</h1>
                    </div>
                    <button onClick={refresh}
                        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all relative flex-shrink-0">
                        <RefreshCw className="w-4 h-4" />
                        {maturingSoon.length > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border border-white dark:border-slate-800" />
                        )}
                    </button>
                </header>

                {/* ── Hero ─────────────────────────────────────── */}
                <div className="text-center px-6 mb-8">
                    <p className="text-sm text-slate-500 mb-1">Tổng tiền đang gửi</p>
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {fmt(totalBalance)}₫
                    </h1>
                    {totalInterest > 0 && (
                        <div className="flex items-center justify-center gap-1 mt-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                            <TrendingUp className="w-4 h-4" />
                            <span>Lãi tạm tính: +{fmtShort(totalInterest)}₫</span>
                        </div>
                    )}
                    {totalBalance === 0 && (
                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">Chưa có sổ tiết kiệm nào</p>
                    )}
                </div>

                {/* ── Savings carousel ─────────────────────────── */}
                <div className="pl-6 mb-2 overflow-hidden">
                    <div className="flex items-center justify-between pr-6 mb-4">
                        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Sổ của tôi</h2>
                        <Link href="/accounts?tab=savings"
                            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:opacity-80">
                            Xem tất cả
                        </Link>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x pr-6"
                        style={{ scrollbarWidth: 'none' }}>

                        {savingsCards.length === 0 && (
                            <div className="snap-center shrink-0 w-[85%] min-h-[185px] rounded-3xl border-2 border-dashed border-gray-300 dark:border-slate-700 bg-white/70 dark:bg-slate-800/80 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-slate-500">
                                <PiggyBank className="w-10 h-10 text-gray-300 dark:text-slate-600" />
                                <p className="text-sm font-medium">Chưa có sổ tiết kiệm</p>
                            </div>
                        )}

                        {savingsCards.map((card, idx) => (
                            <SavingsSlide key={card._id} card={card} idx={idx}
                                onEdit={() => { setEditCard(card); setShowForm(true); }}
                                onDelete={() => handleDelete(card._id)} />
                        ))}

                        <button onClick={() => { setEditCard(null); setShowForm(true); }}
                            className="snap-center shrink-0 w-[55%] min-h-[185px] rounded-3xl border-2 border-dashed border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-slate-500 hover:border-emerald-300 hover:text-emerald-500 dark:hover:border-emerald-500 transition">
                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="font-semibold text-sm">Thêm sổ mới</span>
                        </button>
                    </div>
                </div>

                {/* ── Quick actions ─────────────────────────────── */}
                <div className="px-6 mb-6">
                    <div className="bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl p-4 flex justify-between items-center shadow-sm border border-white/50 dark:border-slate-700/50">
                        {[
                            { icon: <PiggyBank className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />, bg: '#D1FAE5', bgDark: '#064E3B', label: 'Gửi thêm', onClick: () => { setEditCard(null); setShowForm(true); } },
                            { icon: <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />, bg: '#DBEAFE', bgDark: '#1E3A8A', label: 'Tái tục', onClick: () => { setEditCard(null); setShowForm(true); } },
                            { icon: <History className="w-5 h-5 text-orange-600 dark:text-orange-400" />, bg: '#FEF3C7', bgDark: '#78350F', label: 'Lịch sử', onClick: () => { } },
                            { icon: <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />, bg: '#EDE9FE', bgDark: '#4C1D95', label: 'Báo cáo', onClick: () => { } },
                        ].map(item => (
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

                {/* ── Maturity alerts ───────────────────────────── */}
                {maturingSoon.length > 0 && (
                    <div className="px-6 mb-5">
                        <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-4">
                            <AlertTriangle className="w-5 h-5 text-orange-500 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm text-orange-800 dark:text-orange-300">
                                    {maturingSoon.length} sổ sắp đáo hạn trong 30 ngày
                                </p>
                                {maturingSoon.map(m => (
                                    <p key={m._id} className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                        · {m.bankName} — {fmt(m.balance)}₫ · còn {m.daysLeft} ngày
                                    </p>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Detail info ───────────────────────────────── */}
                <div className="px-6 mb-5">
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3">Thông tin chi tiết</h3>
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-slate-800">

                        {/* Maturity countdown — best upcoming */}
                        {savingsCards.filter(c => c.maturityDate).length > 0 ? (
                            (() => {
                                const upcoming = [...savingsCards]
                                    .filter(c => c.maturityDate)
                                    .sort((a, b) => new Date(a.maturityDate!).getTime() - new Date(b.maturityDate!).getTime())[0];
                                const days = daysUntil(upcoming?.maturityDate ?? null);
                                const urg = urgencyColor(days);
                                return (
                                    <DetailRow
                                        icon={<CalendarCheck className="w-5 h-5" style={{ color: urg }} />}
                                        iconBg={`${urg}18`}
                                        title={`${upcoming.bankShortName} — Sắp đáo hạn`}
                                        sub={`Ngày đáo hạn: ${fmtDate(upcoming.maturityDate)}`}
                                        value={`${fmt(upcoming.balance)}₫`}
                                        badge={days !== null ? (days <= 0 ? 'Đã đáo hạn' : `${days}N nữa`) : '—'}
                                        badgeColor={urg}
                                    />
                                );
                            })()
                        ) : (
                            <DetailRow
                                icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                iconBg={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#064E3B' : '#D1FAE5'}
                                title="Không có sổ sắp đáo hạn"
                                sub="Tất cả đang hoạt động bình thường"
                                value="Tốt 👍"
                            />
                        )}

                        <div className="mx-4 border-t border-gray-100 dark:border-slate-700" />

                        {/* Total estimated interest */}
                        <DetailRow
                            icon={<Percent className="w-5 h-5 text-emerald-500" />}
                            iconBg={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#064E3B' : '#D1FAE5'}
                            title="Lãi tạm tính toàn bộ"
                            sub={`${savingsCards.length} sổ tiết kiệm`}
                            value={totalInterest > 0 ? `+${fmtShort(totalInterest)}₫` : '—'}
                            badge={totalInterest > 0 ? `+${fmtShort(totalInterest)}` : undefined}
                            badgeColor="#10B981"
                        />

                        <div className="mx-4 border-t border-gray-100 dark:border-slate-700" />

                        {/* Best interest rate */}
                        <DetailRow
                            icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
                            iconBg={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#312E81' : '#EEF2FF'}
                            title="Lãi suất cao nhất"
                            sub="Trong danh mục của bạn"
                            value={bestRate > 0 ? `${bestRate}%/năm` : '—'}
                        />
                    </div>
                </div>

                {/* ── Promo banner ──────────────────────────────── */}
                <div className="px-6">
                    <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #059669 0%, #0EA5E9 100%)' }}>
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full pointer-events-none" />
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <p className="text-xs font-semibold opacity-80 mb-1">Mẹo tiết kiệm</p>
                                <p className="font-bold text-base leading-tight">Tái tục tự động để không<br />bỏ lỡ chu kỳ lãi suất</p>
                                <button className="mt-3 bg-white text-emerald-700 text-xs font-bold py-1.5 px-3 rounded-xl shadow-sm hover:bg-emerald-50 transition">
                                    Tìm hiểu thêm
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
                className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #34D399, #059669)' }}>
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
            </button>

            {/* ── Modal ───────────────────────────────────────── */}
            <CardFormModal
                open={showForm}
                onClose={() => { setShowForm(false); setEditCard(null); }}
                onSave={handleSave}
                editCard={editCard}
                initialType="savings"
            />
        </div>
    );
}
