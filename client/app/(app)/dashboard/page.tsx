'use client';
import { useEffect, useState } from 'react';
import {
    Bell, Plus, Eye, EyeOff, TrendingUp, TrendingDown,
    PiggyBank, CreditCard, Wallet, Bitcoin, Smartphone,
    Send, ScanLine, MoreHorizontal, ChevronRight, ArrowDownLeft, ArrowDownRight,
    Copy, Edit2, Trash2, X, Calendar, FileText, CheckCircle2, Clock
} from 'lucide-react';
import AddTransactionModal from '@/components/AddTransactionModal';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import NotificationPanel from '@/components/NotificationPanel';
import { useAuthStore, useUIStore } from '@/store/useStore';
import { useTransactions } from '@/hooks/useTransactions';
import { toast } from 'sonner';
import { useCards } from '@/hooks/useCards';
import { useNotifications } from '@/hooks/useNotifications';
import { useWealth } from '@/hooks/useWealth';
import { useBanks } from '@/hooks/useBanks';
import { CATEGORIES } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return `${n}`;
};
const fmtFull = (n: number) => n.toLocaleString('vi-VN');

// ─── Card type icon ───────────────────────────────────────────────────────────
function CardTypeIcon({ type }: { type: string }) {
    if (type === 'credit') return <CreditCard className="w-3.5 h-3.5" />;
    if (type === 'savings') return <PiggyBank className="w-3.5 h-3.5" />;
    if (type === 'crypto') return <Bitcoin className="w-3.5 h-3.5" />;
    if (type === 'eWallet') return <Smartphone className="w-3.5 h-3.5" />;
    return <Wallet className="w-3.5 h-3.5" />;
}

// ─── Transaction row ──────────────────────────────────────────────────────────
function TransactionRow({ t, onClick }: { t: any; onClick: () => void }) {
    const cat = CATEGORIES.find(c => c.label === t.category) || CATEGORIES[CATEGORIES.length - 1];
    const isIncome = t.type === 'income';
    return (
        <div
            onClick={onClick}
            className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors cursor-pointer group"
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: `${cat.color}18` }}>
                    {cat.icon}
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{t.note || t.category}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                        {t.category} · {new Date(t.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </p>
                </div>
            </div>
            <span className={cn('text-sm font-bold flex-shrink-0', isIncome ? 'text-emerald-500' : 'text-red-500')}>
                {isIncome ? '+' : '-'}{fmt(t.amount)}
            </span>
        </div>
    );
}

// ─── Alert card ───────────────────────────────────────────────────────────────
function AlertCard({
    icon, iconBg, title, sub, amount, badge, badgeColor, accentColor,
}: {
    icon: React.ReactNode; iconBg: string; title: string; sub: string;
    amount: string; badge: string; badgeColor: string; accentColor: string;
}) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700/50 shadow-[0_2px_10px_rgba(0,0,0,0.03)] relative group hover:shadow-md transition-all duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: accentColor }} />
            <div className="p-4 pl-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center border"
                    style={{ backgroundColor: iconBg, borderColor: `${accentColor}22` }}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{title}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap flex-shrink-0"
                            style={{ backgroundColor: `${badgeColor}15`, color: badgeColor }}>
                            {badge}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
                    <p className="font-bold text-base mt-1" style={{ color: accentColor }}>{amount}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Custom Chart Details ──────────────────────────────────────────────────────────
const createCustomDot = (color: string, dataKey: string) => {
    return (props: any) => {
        const { cx, cy, payload, index } = props;
        const val = payload[dataKey] || 0;
        if (index === 6) { // Last item (today)
            const absVal = Math.abs(val);
            const sign = val < 0 ? '-' : '';
            const valStr = absVal >= 1000000
                ? `${sign}${(absVal / 1000000).toFixed(1).replace('.0', '')}tr`
                : `${sign}${absVal >= 1000 ? Math.round(absVal / 1000) + 'k' : absVal}`;
            const rectW = valStr.length > 3 ? 46 : 38;
            return (
                <g key={`dot-${index}-${dataKey}`}>
                    <circle cx={cx} cy={cy} r={12} fill={color} fillOpacity={0.15} />
                    <circle cx={cx} cy={cy} r={7} className="fill-white dark:fill-slate-800" />
                    <circle cx={cx} cy={cy} r={4.5} fill={color} />
                    <rect x={cx - rectW / 2} y={cy - 38} width={rectW} height={22} rx={10} fill={color} />
                    <text x={cx} y={cy - 27} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                        {valStr}
                    </text>
                </g>
            );
        }
        return (
            <circle key={`dot-${index}-${dataKey}`} cx={cx} cy={cy} r={4.5} className="fill-white dark:fill-slate-800" stroke={color} strokeWidth={2.5} />
        );
    };
};

const renderCustomTick = (props: any) => {
    const { x, y, payload } = props;
    const isToday = payload.value === 'Hôm nay';
    return (
        <text x={x} y={y + 12} className={isToday ? "fill-purple-600 dark:fill-purple-400 font-bold" : "fill-slate-400 dark:fill-slate-500"} fontSize={isToday ? 11 : 9} textAnchor="middle">
            {payload.value}
        </text>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const { user } = useAuthStore();
    const { isAddModalOpen, openAddModal, closeAddModal } = useUIStore();
    const [showNoti, setShowNoti] = useState(false);
    const [addType, setAddType] = useState<'expense' | 'income'>('expense');
    const [hideBalance, setHideBalance] = useState(true);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [selectedTx, setSelectedTx] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<any>(null);
    const { banks: fetchedBanks, fetchBanks } = useBanks();

    useEffect(() => {
        fetchBanks();
    }, [fetchBanks]);

    // ── Real data ──
    const { transactions, summary, refetch, deleteTransaction } = useTransactions();
    const { cards, totalBalance, totalDebt } = useCards();
    const { unreadCount, notifications } = useNotifications();
    const { sources: wealthSources, total: wealthTotal } = useWealth();

    // ── Derived values ──
    const netWorth = totalBalance + wealthTotal - totalDebt;
    const totalSavings = cards.filter(c => c.cardType === 'savings').reduce((s, c) => s + c.balance, 0);

    const creditAlerts = cards.filter(c => c.cardType === 'credit' && c.balance > 0).slice(0, 2);
    const savingsCards = cards.filter(c => c.cardType === 'savings').slice(0, 1);

    // ── Chart data: last 7 days expenses & income ──
    const chartData = (() => {
        const days: Record<string, { expense: number, income: number }> = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86_400_000);
            days[`${d.getDate()}/${d.getMonth() + 1}`] = { expense: 0, income: 0 };
        }
        transactions.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getDate()}/${d.getMonth() + 1}`;
            if (key in days) {
                if (t.type === 'expense') days[key].expense -= t.amount;
                if (t.type === 'income') days[key].income += t.amount;
            }
        });
        return Object.entries(days).map(([name, data], i, arr) => ({
            name: i === arr.length - 1 ? 'Hôm nay' : name,
            expense: data.expense,
            income: data.income,
        }));
    })();

    const E_WALLETS = [
        { name: 'MoMo', short: 'MoMo', color: '#A21CAF', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-MoMo-Transparent.png' },
        { name: 'ZaloPay', short: 'ZLP', color: '#0284C7', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-ZaloPay-Square.png' },
        { name: 'Khác', short: '???', color: '#6C63FF', logo: '' },
    ];

    const CRYPTOS = [
        { name: 'Binance', short: 'BNB', color: '#F0B90B', logo: '' },
        { name: 'OKX', short: 'OKX', color: '#1C1C1E', logo: '' },
        { name: 'Bybit', short: 'BBT', color: '#F7A600', logo: '' },
    ];

    const handleEditTx = (tx: any) => {
        setIsDetailOpen(false);
        setEditingTx(tx);
        openAddModal();
    };

    const handleDeleteTx = async (id: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) {
            try {
                await deleteTransaction(id);
                toast.success('Đã xóa giao dịch');
                setIsDetailOpen(false);
                setSelectedTx(null);
            } catch (err) {
                toast.error('Xóa giao dịch thất bại');
            }
        }
    };

    return (
        <div className="min-h-screen pb-28 bg-[#F8F9FF] dark:bg-slate-900 transition-colors duration-200">
            <style>{`
                @keyframes arrowSlide {
                    0%,100% { transform: translateX(0); opacity: 1; }
                    40%     { transform: translateX(5px); opacity: 0.6; }
                    60%     { transform: translateX(5px); opacity: 0.6; }
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.93); }
                    to   { opacity: 1; transform: scale(1); }
                }
                @keyframes pulseGlow {
                    0%,100% { opacity: 1; transform: scale(1); }
                    50%     { opacity: 0.7; transform: scale(1.15); }
                }
                .anim-arrow { animation: arrowSlide 2s ease-in-out infinite; }
                .anim-arrow-d1 { animation: arrowSlide 2s ease-in-out infinite 0.3s; }
                .anim-arrow-d2 { animation: arrowSlide 2s ease-in-out infinite 0.6s; }
                .anim-fade-up { animation: fadeUp 0.5s ease both; }
                .anim-fade-up-d1 { animation: fadeUp 0.5s ease 0.1s both; }
                .anim-fade-up-d2 { animation: fadeUp 0.5s ease 0.2s both; }
                .anim-fade-up-d3 { animation: fadeUp 0.5s ease 0.3s both; }
                .anim-fade-up-d4 { animation: fadeUp 0.5s ease 0.4s both; }
                .anim-scale-in  { animation: scaleIn 0.4s ease both; }
                .anim-pulse-icon { animation: pulseGlow 2.5s ease-in-out infinite; }
            `}</style>

            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="px-5 pt-4 pb-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-sm">
                        {(user?.name || 'N').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Hello 👋</p>
                        <p className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">{user?.name || 'Bạn'}</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowNoti(true)}
                    className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center relative text-slate-500 dark:text-slate-400 hover:border-purple-200 transition-colors active:scale-90"
                >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-white animate-pulse" />
                    )}
                </button>
            </header>

            <main className="px-5 space-y-5">

                {/* ── Asset card (light lavender gradient) ─────────── */}
                <div className="anim-scale-in relative overflow-hidden rounded-[20px] p-2.5 pb-2 shadow-[0_4px_20px_-2px_rgba(139,92,246,0.12)] border border-[#E9D5FF] dark:border-purple-900/30 bg-gradient-to-br from-white to-[#F5F3FF] dark:from-slate-800 dark:to-slate-800/80">
                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(167,139,250,0.25)' }} />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(147,197,253,0.2)' }} />

                    <div className="text-center mb-2 relative z-10">
                        <div className="flex items-center justify-center gap-2 mb-1">

                            <Link href="/wealth"
                                className="flex items-center justify-center transition-colors">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest pr-2">Tổng tài sản ròng</p>
                                <ChevronRight className="anim-arrow w-4 h-4 text-purple-400 dark:text-purple-400" />
                            </Link>
                        </div>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight leading-none text-money">
                                {hideBalance ? '• • • • • •' : fmtFull(netWorth)}
                            </span>
                            <span className="text-lg text-slate-400 font-medium align-top mt-0.5">đ</span>
                            <button
                                onClick={() => setHideBalance(v => !v)}
                                className="p-1 rounded-full text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                            >
                                {hideBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-3">

                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-full border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
                                <TrendingUp className="anim-pulse-icon w-3.5 h-3.5 text-emerald-500" />
                                <Link href="/analytics" className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    Thu: +{fmt(summary.income)}
                                </Link>
                            </div>

                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-500/10 rounded-full border border-red-100 dark:border-red-500/20 shadow-sm">
                                <TrendingDown className="anim-pulse-icon w-3.5 h-3.5 text-red-500" style={{ animationDelay: '1.25s' }} />
                                <Link href="/analytics" className="text-xs font-bold text-red-600 dark:text-red-400">
                                    Chi: -{fmt(summary.expense)}
                                </Link>
                            </div>

                        </div>

                        <div className="grid grid-cols-2 gap-3 relative z-10 pt-4">
                            <Link href="/savings"
                                className="bg-white dark:bg-slate-800 rounded-xl p-2.5 pl-3 flex flex-col items-start border border-gray-100 dark:border-slate-700 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-900/50 hover:shadow-md transition-all active:scale-95 group">
                                <div className="w-full flex justify-between items-start mb-1">
                                    <div>
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tiết kiệm</p>
                                        <p className="text-lg font-bold mt-1 text-money text-left text-emerald-600 dark:text-emerald-400">
                                            {hideBalance ? '••' : fmt(totalSavings)}
                                        </p>
                                    </div>
                                    <ChevronRight className="anim-arrow-d1 w-4 h-4 text-purple-400 dark:text-purple-400" />
                                </div>

                                {cards.filter(c => c.cardType === 'savings').length > 0 ?
                                    <p className="text-[10px] text-slate-400 mt-0.5">{cards.filter(c => c.cardType === 'savings').length} sổ tiết kiệm</p>
                                    : <p className="text-[10px] text-slate-400 mt-0.5">Bạn chưa có sổ tiết kiệm</p>}
                            </Link>
                            <Link href="/cards"
                                className="bg-white dark:bg-slate-800 rounded-xl p-2.5 pl-3 flex flex-col items-start border border-gray-100 dark:border-slate-700 shadow-sm hover:border-red-200 dark:hover:border-red-900/50 hover:shadow-md transition-all active:scale-95 group">
                                <div className="w-full flex justify-between items-start mb-1">
                                    <div>
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Dư nợ thẻ</p>
                                        <p className="text-lg font-bold text-red-500 mt-1 text-money text-left">
                                            {hideBalance ? '••' : (totalDebt > 0 ? `-${fmt(totalDebt)}` : '0')}
                                        </p>
                                    </div>
                                    <ChevronRight className="anim-arrow-d2 w-4 h-4 text-purple-400 dark:text-purple-400" />
                                </div>

                                {cards.filter(c => c.cardType === 'credit').length > 0 && (
                                    <p className="text-[10px] text-slate-400 mt-0.5">{cards.filter(c => c.cardType === 'credit').length} thẻ tín dụng</p>
                                )}
                            </Link>
                        </div>
                    </div>

                </div>
                {/* ── Quick actions ───────────────────────────────────── */}
                <div className="anim-fade-up-d1 flex justify-between items-center gap-3">
                    {[
                        { icon: <Plus className="w-6 h-6 text-purple-500" />, label: 'Thêm giao dịch', onClick: () => { setAddType('expense'); openAddModal(); } },
                        { icon: <Send className="w-6 h-6 text-purple-500" />, label: 'Chuyển tiền', onClick: () => { setAddType('income'); openAddModal(); } },
                        { icon: <ScanLine className="w-6 h-6 text-purple-500" />, label: 'Quét QR', onClick: () => { } },
                        { icon: <MoreHorizontal className="w-6 h-6 text-purple-500" />, label: 'Thêm', onClick: () => setAddType('expense') },
                    ].map(item => (
                        <button key={item.label} onClick={item.onClick}
                            className="flex-1 flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 dark:border-slate-700 group-active:scale-95 transition-transform group-hover:border-purple-200 dark:group-hover:border-purple-500/50">
                                {item.icon}
                            </div>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{item.label}</span>
                        </button>
                    ))}
                </div>


                {/* ── Important notifications ──────────────────────── */}
                {
                    (creditAlerts.length > 0 || savingsCards.length > 0) && (
                        <section className="anim-fade-up-d2">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="text-base font-bold text-slate-800 dark:text-white">Thông báo quan trọng</h2>
                                <span className="w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xs font-bold">
                                    {creditAlerts.length + savingsCards.length}
                                </span>
                            </div>
                            <div className="space-y-2.5 max-h-[280px] overflow-y-auto hide-scrollbar pb-2">
                                {creditAlerts.map(card => {
                                    const b = fetchedBanks.find(x => x.shortName === card.bankShortName) || E_WALLETS.find(x => x.short === card.bankShortName) || CRYPTOS.find(x => x.short === card.bankShortName) as any;
                                    return (
                                        <AlertCard
                                            key={card._id}
                                            icon={b?.logo ? <img src={b.logo} className="w-8 h-8 object-contain bg-white p-1 rounded-md shadow-sm" alt="logo" /> : <span className="font-black text-red-600 text-xs">{card.bankShortName}</span>}
                                            iconBg="#FEF2F2"
                                            title={`Sao kê ${card.bankName}`}
                                            sub="Dư nợ thẻ tín dụng"
                                            amount={`${fmtFull(card.balance)}đ`}
                                            badge="Cần thanh toán"
                                            badgeColor="#EF4444"
                                            accentColor="#EF4444"
                                        />
                                    );
                                })}
                                {savingsCards.map(card => {
                                    const b = fetchedBanks.find(x => x.shortName === card.bankShortName) || E_WALLETS.find(x => x.short === card.bankShortName) || CRYPTOS.find(x => x.short === card.bankShortName) as any;
                                    return (
                                        <AlertCard
                                            key={card._id}
                                            icon={b?.logo ? <img src={b.logo} className="w-8 h-8 object-contain bg-white p-1 rounded-md shadow-sm" alt="logo" /> : <PiggyBank className="w-5 h-5 text-amber-600" />}
                                            iconBg="#FFFBEB"
                                            title={`Sổ tiết kiệm ${card.bankShortName}`}
                                            sub="Kiểm tra kỳ hạn"
                                            amount={`${fmtFull(card.balance)}đ`}
                                            badge="Xem chi tiết"
                                            badgeColor="#F59E0B"
                                            accentColor="#F59E0B"
                                        />
                                    );
                                })}
                            </div>
                        </section>
                    )
                }

                {/* ── Unread app notifications ─────────────────────── */}
                {
                    unreadCount > 0 && notifications.slice(0, 2).map(n => (
                        <div key={n._id}
                            className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-purple-100 dark:border-purple-900/30 flex items-center gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                                style={{ backgroundColor: n.iconBg || '#EDE9FE' }}>
                                {n.icon || '🔔'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{n.title}</p>
                                <p className="text-xs text-slate-400 truncate mt-0.5">{n.message}</p>
                            </div>
                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />}
                        </div>
                    ))
                }

                {/* ── Spending trend chart ─────────────────────────── */}
                <section>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-slate-800 dark:text-white">Xu hướng thu chi</h2>
                        <Link href="/analytics"
                            className="text-xs font-semibold text-purple-600 px-3 py-1 bg-purple-50 rounded-lg hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 transition-colors">
                            Xem chi tiết
                        </Link>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={chartData} margin={{ top: 45, right: 30, bottom: 0, left: -30 }}>
                                <defs>
                                    <linearGradient id="lavGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" tick={renderCustomTick} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 8, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                                    tickFormatter={v => `${Math.round(v / 1000)}k`} />
                                <Tooltip
                                    formatter={(v?: number | string, name?: string) => v != null ? [`${fmt(Math.abs(Number(v)))}đ`, name === 'income' ? 'Thu nhập' : 'Chi tiêu'] : ['-', '']}
                                    contentStyle={{
                                        borderRadius: 16, border: 'none',
                                        boxShadow: '0 4px 20px rgba(139,92,246,0.15)', fontSize: 11,
                                    }}
                                    cursor={{ stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area type="monotone" dataKey="expense"
                                    stroke="#EF4444" strokeWidth={3} fill="url(#redGrad)"
                                    dot={createCustomDot('#EF4444', 'expense')}
                                    activeDot={false}
                                />
                                <Area type="monotone" dataKey="income"
                                    stroke="#8B5CF6" strokeWidth={3} fill="url(#lavGrad)"
                                    dot={createCustomDot('#8B5CF6', 'income')}
                                    activeDot={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* ── Recent transactions ──────────────────────────── */}
                <section>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-slate-800 dark:text-white">Giao dịch gần đây</h2>
                        <Link href="/analytics"
                            className="text-xs font-semibold text-purple-600 px-3 py-1 bg-purple-50 rounded-lg hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 transition-colors">
                            Lịch sử
                        </Link>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-2 border border-gray-100 dark:border-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.03)] max-h-[300px] overflow-y-auto hide-scrollbar">
                        {transactions.length === 0 ? (
                            <div className="py-10 text-center">
                                <p className="text-slate-400 text-sm">Chưa có giao dịch nào</p>
                                <button
                                    onClick={() => { setAddType('expense'); openAddModal(); }}
                                    className="mt-3 text-xs font-bold text-purple-600 bg-purple-50 px-4 py-2 rounded-xl hover:bg-purple-100 transition-colors"
                                >
                                    + Thêm giao dịch đầu tiên
                                </button>
                            </div>
                        ) : (
                            transactions.slice(0, 5).map((t, i) => (
                                <div key={t._id}>
                                    {i > 0 && <div className="mx-3 border-t border-dashed border-gray-100" />}
                                    <TransactionRow t={t} onClick={() => { setSelectedTx(t); setIsDetailOpen(true); }} />
                                </div>
                            ))
                        )}
                    </div>
                </section>

            </main >

            {/* ── FAB ──────────────────────────────────────────────── */}
            <button
                onClick={() => { setAddType('expense'); openAddModal(); }}
                className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.4)] flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)' }}
            >
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
            </button>

            {/* ── Modals ───────────────────────────────────────────── */}
            <AddTransactionModal
                open={isAddModalOpen}
                onClose={() => { closeAddModal(); setEditingTx(null); }}
                onSaved={refetch}
                defaultType={addType}
                initialData={editingTx}
            />
            <NotificationPanel open={showNoti} onClose={() => setShowNoti(false)} />
            <TransactionDetailModal
                open={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                transaction={selectedTx}
                onEdit={handleEditTx}
                onDelete={handleDeleteTx}
            />
        </div>
    );
}

