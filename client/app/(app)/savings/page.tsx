'use client';
import { formatNumber } from '@/lib/utils';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { useCards, type Card } from '@/hooks/useCards';
import CardFormModal from '@/components/CardFormModal';
import SavingsDeck, { type SavingsDeckHandle } from '@/components/cards/SavingsDeck';
import { RefreshDuotone } from '@/components/icons/RefreshDuotone';
import SavingsRenewModal from '@/components/SavingsRenewModal';
import PageHeader from '@/components/PageHeader';
import api from '@/lib/api';
import { toast } from 'sonner';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) => formatNumber(Math.round(Math.abs(n)));
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
    const [renewCard, setRenewCard] = useState<Card | null>(null);
    const deckRef = useRef<SavingsDeckHandle>(null);

    const savingsCards = useMemo(() => cards.filter(c => c.cardType === 'savings'), [cards]);
    // Matured books (đáo hạn) — soonest-matured first, for the "Tái tục" shortcut.
    const maturedCards = useMemo(
        () => savingsCards.filter(c => { const d = daysUntil(c.maturityDate); return d !== null && d <= 0; }),
        [savingsCards]
    );

    const handleQuickRenew = () => {
        if (maturedCards.length > 0) setRenewCard(maturedCards[0]);
        else toast.info('Chưa có sổ nào đáo hạn để tái tục');
    };

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
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep transition-colors duration-200">
            {/* Gradient bg blob */}
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(167,243,208,0.3), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(16,185,129,0.1), transparent)' }} />

            <div className="relative z-10 pb-8">
                {/* ── Header ─────────────────────────────────────── */}
                <PageHeader
                    title="Tiết kiệm 🐷"
                    subtitle="Tài chính"
                    rightActions={
                        <button onClick={refresh}
                            className="w-10 h-10 rounded-full bg-white dark:bg-surface border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all relative flex-shrink-0">
                            <RefreshDuotone className="w-4 h-4" />
                            {maturingSoon.length > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border border-white dark:border-slate-800" />
                            )}
                        </button>
                    }
                />

                {/* ── Hero ─────────────────────────────────────── */}
                <div className="text-center px-5 mb-8">
                    <p className="text-sm text-slate-500 mb-1">Tổng tiền đang gửi</p>
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {fmt(totalBalance)}₫
                    </h1>
                    {totalInterest > 0 && (
                        <div className="flex items-center justify-center gap-1 mt-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                            <UtilityIcon type="trendingUp" size={16} tile={false} color="#10B981" />
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
                        {savingsCards.length > 0 && (
                            <button onClick={() => deckRef.current?.openAll()}
                                aria-label="Xem tất cả sổ tiết kiệm"
                                className="flex items-center justify-center w-[30px] h-[30px] rounded-[8px] text-emerald-600 dark:text-emerald-300 border border-emerald-200/60 dark:border-white/10 bg-emerald-50 dark:bg-slate-900/60 shadow-sm hover:bg-emerald-100 dark:hover:bg-slate-800/70 transition-all">
                                <CustomIcon type="arrowRight" size={16} tile={false} color="currentColor" />
                            </button>
                        )}
                    </div>
                    <div className="pr-6">
                        {savingsCards.length === 0 ? (
                            <button onClick={() => { setEditCard(null); setShowForm(true); }}
                                className="w-full min-h-[160px] rounded-[22px] border-2 border-dashed border-gray-300 dark:border-slate-700 bg-white/70 dark:bg-surface/80 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-slate-500 hover:border-emerald-300 hover:text-emerald-500 dark:hover:border-emerald-500 transition">
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                                    <CustomIcon type="plus" size={24} tile={false} color="currentColor" className="w-6 h-6" />
                                </div>
                                <span className="font-semibold text-sm">Thêm sổ tiết kiệm</span>
                            </button>
                        ) : (
                            <SavingsDeck ref={deckRef} cards={savingsCards} hideFooterSeeAll
                                onEdit={(c) => { setEditCard(c); setShowForm(true); }}
                                onDelete={(c) => handleDelete(c._id)} />
                        )}
                    </div>
                </div>

                {/* ── Quick actions ─────────────────────────────── */}
                <div className="px-5 mb-6">
                    <div className="bg-white/70 dark:bg-surface/80 backdrop-blur-xl rounded-2xl p-4 flex justify-between items-center shadow-sm border border-white/50 dark:border-slate-700/50">
                        {[
                            { icon: <UtilityIcon type="soTietKiem" size={24} tile={false} color="#059669" />, bg: '#D1FAE5', bgDark: '#064E3B', label: 'Gửi thêm', onClick: () => { setEditCard(null); setShowForm(true); } },
                            { icon: <RefreshDuotone className="w-5 h-5 text-blue-600 dark:text-blue-400" />, bg: '#DBEAFE', bgDark: '#1E3A8A', label: 'Tái tục', onClick: handleQuickRenew },
                            { icon: <CustomIcon type="history" size={20} tile={false} color="currentColor" className="w-5 h-5 text-orange-600 dark:text-orange-400" />, bg: '#FEF3C7', bgDark: '#78350F', label: 'Lịch sử', onClick: () => { } },
                            { icon: <CustomIcon type="coPhieu" size={20} tile={false} color="currentColor" className="w-5 h-5 text-purple-600 dark:text-purple-400" />, bg: '#EDE9FE', bgDark: '#4C1D95', label: 'Báo cáo', onClick: () => { } },
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
                    <div className="px-5 mb-5">
                        <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-4">
                            <CustomIcon type="alertTriangle" size={20} tile={false} color="currentColor" className="w-5 h-5 text-orange-500 dark:text-orange-400 flex-shrink-0 mt-0.5" />
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
                <div className="px-5 mb-5">
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3">Thông tin chi tiết</h3>
                    <div className="bg-white dark:bg-surface rounded-[20px] shadow-sm overflow-hidden border border-gray-100 dark:border-slate-800">

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
                                        icon={<CustomIcon type="calendar" size={20} tile={false} color="currentColor" className="w-5 h-5" style={{ color: urg }} />}
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
                                icon={<UtilityIcon type="checkCircle" size={20} tile={false} color="#10B981" />}
                                iconBg={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#064E3B' : '#D1FAE5'}
                                title="Không có sổ sắp đáo hạn"
                                sub="Tất cả đang hoạt động bình thường"
                                value="Tốt 👍"
                            />
                        )}

                        <div className="mx-4 border-t border-gray-100 dark:border-slate-700" />

                        {/* Total estimated interest */}
                        <DetailRow
                            icon={<CustomIcon type="percent" size={20} tile={false} color="currentColor" className="w-5 h-5 text-emerald-500" />}
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
                            icon={<UtilityIcon type="trendingUp" size={20} tile={false} color="#6366F1" />}
                            iconBg={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#312E81' : '#EEF2FF'}
                            title="Lãi suất cao nhất"
                            sub="Trong danh mục của bạn"
                            value={bestRate > 0 ? `${bestRate}%/năm` : '—'}
                        />
                    </div>
                </div>

                {/* ── Promo banner ──────────────────────────────── */}
                <div className="px-5">
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
                                <CustomIcon type="thuong" size={32} tile={false} color="currentColor" className="w-8 h-8 text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── FAB ─────────────────────────────────────────── */}
            <button
                onClick={() => { setEditCard(null); setShowForm(true); }}
                className="fixed bottom-28 right-5 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #4a3575, #36255C)' }}>
                <CustomIcon type="plus" size={28} tile={false} color="currentColor" className="w-7 h-7 text-white" />
            </button>

            {/* ── Modal ───────────────────────────────────────── */}
            <CardFormModal
                open={showForm}
                onClose={() => { setShowForm(false); setEditCard(null); }}
                onSave={handleSave}
                editCard={editCard}
                initialType="savings"
            />

            <SavingsRenewModal
                open={!!renewCard}
                card={renewCard}
                onClose={() => setRenewCard(null)}
                onRenewed={refresh}
            />
        </div>
    );
}
