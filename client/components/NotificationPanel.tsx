'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Settings, History, ChevronRight, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/store/useStore';
import { useRouter } from 'next/navigation';

const TABS = [
    { label: 'Ưu đãi', key: 'promo', types: ['promo'] },
    { label: 'Giao dịch', key: 'transaction', types: ['transaction', 'payment', 'saving', 'transaction_expense', 'transaction_income'] },
    { label: 'Nhắc nhở', key: 'reminder', types: ['reminder', 'budget', 'security', 'system', 'general', 'budget_warning', 'budget_overspend', 'goal_milestone', 'goal_complete'] },
] as const;

const TYPE_MAP: Record<string, { icon: string; bg: string }> = {
    transaction_expense: { icon: '💸', bg: '#FEE2E2' },
    transaction_income: { icon: '💰', bg: '#ECFDF5' },
    budget_warning: { icon: '⚠️', bg: '#FEF3C7' },
    budget_overspend: { icon: '🚨', bg: '#FEE2E2' },
    goal_milestone: { icon: '🏆', bg: '#F0FDF4' },
    goal_complete: { icon: '🏆', bg: '#DCFCE7' },
    system: { icon: '🔔', bg: '#EFF6FF' },
    general: { icon: '📢', bg: '#F8FAFC' },
    promo: { icon: '🎁', bg: '#FFF1F2' },
};

interface NotificationPanelProps {
    open: boolean;
    onClose: () => void;
}

const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

const isYesterday = (date: Date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
};

const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${mins} ${day}/${month}/${year}`;
};

import { useBanks } from '@/hooks/useBanks';

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

function PanelContent({ onClose }: { onClose: () => void }) {
    const { isAuthenticated } = useAuthStore();
    const { notifications, loading, markRead, markAllRead } = useNotifications();
    const { banks: fetchedBanks, fetchBanks } = useBanks();

    useEffect(() => {
        fetchBanks();
    }, [fetchBanks]);

    const [activeTab, setActiveTab] = useState<'promo' | 'transaction' | 'reminder'>('transaction');
    const [historyTab, setHistoryTab] = useState<'all' | 'payment' | 'credit'>('all');
    const [selectedNotification, setSelectedNotification] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'notifications' | 'balance_history'>('notifications');
    const router = useRouter();
    const { Search, Filter, AlignJustify, Wallet, CreditCard: CreditCardIcon, Plus } = require('lucide-react');

    const getMatchingLogo = (text?: string) => {
        if (!text) return null;
        const lower = text.toLowerCase();
        for (const w of E_WALLETS) if (lower.includes(w.name.toLowerCase()) || lower.includes(w.short.toLowerCase())) return w.logo;
        for (const c of CRYPTOS) if (lower.includes(c.name.toLowerCase()) || lower.includes(c.short.toLowerCase())) return c.logo;
        for (const b of fetchedBanks) if (lower.includes(b.shortName.toLowerCase()) || lower.includes((b.name || '').toLowerCase())) return b.logo;
        return null;
    };

    if (!isAuthenticated) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center bg-white dark:bg-slate-900 h-full">
                <Bell className="w-12 h-12 text-gray-300 dark:text-slate-600" />
                <p className="text-gray-500 dark:text-slate-400 text-sm">Đăng nhập để xem thông báo</p>
            </div>
        );
    }

    const filtered = notifications.filter(n => {
        const types = TABS.find(t => t.key === activeTab)?.types || ([] as readonly string[]);
        return (types as readonly string[]).includes(n.type) || (activeTab === 'transaction' && !(TABS.flatMap(x => x.types) as readonly string[]).includes(n.type));
    });

    const grouped = filtered.reduce((acc, n) => {
        const date = new Date(n.createdAt);
        if (isToday(date)) acc.today.push(n);
        else if (isYesterday(date)) acc.yesterday.push(n);
        else acc.older.push(n);
        return acc;
    }, { today: [], yesterday: [], older: [] } as Record<'today' | 'yesterday' | 'older', any[]>);

    const renderGroup = (title: string, items: typeof notifications) => {
        if (items.length === 0) return null;
        return (
            <div className="mb-4">
                <h4 className="px-5 py-2 text-[14px] font-medium text-gray-500 dark:text-slate-400">{title}</h4>
                <div className="flex flex-col space-y-2 px-3">
                    {items.map(n => {
                        const meta = TYPE_MAP[n.type] || TYPE_MAP.general;
                        const matchLogo = getMatchingLogo(n.title) || getMatchingLogo(n.message);
                        return (
                            <div key={n._id} onClick={() => { if (!n.isRead) markRead(n._id); setSelectedNotification(n); }}
                                className={cn("flex px-4 py-3 gap-4 cursor-pointer rounded-2xl transition-colors", !n.isRead ? 'bg-[#F9FAFB] dark:bg-slate-800/60' : 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800')}>
                                <div className="w-12 h-12 rounded-full border border-gray-100 dark:border-transparent flex items-center justify-center text-xl flex-shrink-0 bg-[#F8FAFC] dark:bg-slate-800 overflow-hidden">
                                    {matchLogo ? (
                                        <div className="w-12 h-12 p-1.5 flex items-center justify-center bg-white rounded-full">
                                            <img src={matchLogo} alt="bank" className="w-full h-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: meta.bg || '#F8FAFC' }}>
                                            {n.icon || meta.icon}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn("text-[15px] leading-snug", !n.isRead ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-900 dark:text-slate-200')}>{n.title}</p>
                                    <p className="text-[13.5px] text-gray-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                                    <p className="text-[12px] text-gray-400 dark:text-slate-500 mt-1.5 font-medium">vào lúc {formatDateTime(n.createdAt)}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative">
            {/* Header */}
            {viewMode !== 'balance_history' && (
                <div className="flex items-center justify-between px-4 pt-12 pb-2 bg-white dark:bg-slate-900 sticky top-0 z-10 border-b border-transparent dark:border-slate-800">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0">
                        <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-slate-200" />
                    </button>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Thông báo</h2>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0">
                        <Settings className="w-6 h-6 text-gray-800 dark:text-slate-200" />
                    </button>
                </div>
            )}

            {viewMode === 'balance_history' ? (() => {
                const transactionTypes = TABS.find(t => t.key === 'transaction')?.types || ([] as readonly string[]);
                // We map notification data back to a unified "transaction-like" layout
                const hFiltered = notifications.filter(n => (transactionTypes as readonly string[]).includes(n.type as string) || !(TABS.flatMap(x => x.types) as readonly string[]).includes(n.type as string)).filter(n => {
                    if (historyTab === 'all') return true;
                    // Lacking actual paymentMethod field in Notification model, we use simple text matching or relatedModel assumptions for demonstration
                    if (historyTab === 'payment') return true; // everything in payment for now
                    return false;
                });

                const hGrouped = hFiltered.reduce((acc, n) => {
                    const d = new Date(n.createdAt);
                    const ds = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                    if (!acc[ds]) acc[ds] = [];
                    acc[ds].push(n);
                    return acc;
                }, {} as Record<string, typeof notifications>);

                const getHistoryIcon = (n: any) => {
                    const matchLogo = getMatchingLogo(n.title) || getMatchingLogo(n.message);
                    if (matchLogo) return <div className="w-full h-full p-2.5 rounded-full bg-white"><img src={matchLogo} alt="bank" className="w-full h-full object-contain" /></div>;
                    if (n.type === 'transaction_income') return <Plus className="w-5 h-5 text-[#10B981]" />;
                    if (n.title?.toLowerCase().includes('lãi')) return <AlignJustify className="w-5 h-5 text-gray-400" />;
                    if (n.title?.toLowerCase().includes('thẻ tín dụng')) return <CreditCardIcon className="w-5 h-5 text-gray-400" />;
                    return <Wallet className="w-5 h-5 text-gray-400" />;
                };

                return (
                    <div className="flex-1 overflow-y-auto pb-6 bg-[#F8F9FB] dark:bg-slate-950 flex flex-col">
                        <div className="bg-white dark:bg-slate-900 px-4 pt-12 pb-4 sticky top-0 z-10 flex flex-col gap-4 shadow-sm dark:shadow-none dark:border-b dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <button onClick={() => setViewMode('notifications')} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0">
                                    <ChevronLeft className="w-6 h-6 text-[#1E293B] dark:text-slate-200" />
                                </button>
                                <h2 className="text-[19px] font-bold text-[#1E293B] dark:text-white">Lịch sử</h2>
                                <div className="flex items-center gap-1">
                                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                        <Search className="w-[22px] h-[22px] text-[#475569] dark:text-slate-400" />
                                    </button>
                                    <button className="p-2 -mr-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                        <Filter className="w-[22px] h-[22px] text-[#475569] dark:text-slate-400" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                <button onClick={() => setHistoryTab('all')} className={cn("px-4 py-2 rounded-full whitespace-nowrap text-[14px]", historyTab === 'all' ? "bg-[#CCFBF1] dark:bg-teal-900/30 text-[#0F766E] dark:text-teal-400 font-semibold" : "bg-transparent border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 font-medium")}>Tổng quan</button>
                                <button onClick={() => setHistoryTab('payment')} className={cn("px-4 py-2 rounded-full whitespace-nowrap text-[14px]", historyTab === 'payment' ? "bg-[#CCFBF1] dark:bg-teal-900/30 text-[#0F766E] dark:text-teal-400 font-semibold" : "bg-transparent border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 font-medium")}>Tài khoản thanh toán</button>
                                <button onClick={() => setHistoryTab('credit')} className={cn("px-4 py-2 rounded-full whitespace-nowrap text-[14px]", historyTab === 'credit' ? "bg-[#CCFBF1] dark:bg-teal-900/30 text-[#0F766E] dark:text-teal-400 font-semibold" : "bg-transparent border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 font-medium")}>Tài khoản Ca...</button>
                            </div>
                        </div>

                        {loading && <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">Đang tải...</div>}
                        {!loading && hFiltered.length === 0 && (
                            <div className="flex flex-col items-center justify-center gap-3 p-10 mt-10">
                                <History className="w-12 h-12 text-gray-200 dark:text-slate-700" />
                                <p className="text-gray-400 dark:text-slate-500 text-sm">Không có giao dịch nào</p>
                            </div>
                        )}

                        <div className="p-4 space-y-6">
                            {Object.entries(hGrouped).map(([dateStr, items]) => (
                                <div key={dateStr}>
                                    <h4 className="text-[15px] font-semibold text-[#475569] dark:text-slate-400 mb-3 px-1">{dateStr}</h4>
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-2 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-50 dark:border-slate-800 divide-y divide-gray-50 dark:divide-slate-800">
                                        {items.map(n => {
                                            // Extract actual amount logically from the notification message text if possible
                                            // VD "Giao dịch 40.000 đ tại ..."
                                            const match = n.message?.match(/([\d\.]+)\s*đ/);
                                            const amountStr = match ? match[1] : '';
                                            const isIncome = n.type === 'transaction_income' || n.title?.toLowerCase().includes('nhận');

                                            return (
                                                <div key={n._id} className="flex items-center gap-4 p-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer rounded-2xl" onClick={() => setSelectedNotification(n)}>
                                                    <div className="w-12 h-12 rounded-full bg-[#F1F5F9] dark:bg-slate-800 border border-gray-100 dark:border-transparent flex items-center justify-center flex-shrink-0">
                                                        {getHistoryIcon(n)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[15px] text-[#334155] dark:text-slate-200 font-medium truncate">{n.title}</p>
                                                        <p className="text-[13px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">{n.message}</p>
                                                    </div>
                                                    <div className={cn("text-[15px] font-medium whitespace-nowrap", isIncome ? 'text-[#10B981] dark:text-emerald-400' : 'text-[#334155] dark:text-slate-200')}>
                                                        {isIncome ? '+' : '-'}{amountStr} đ
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })() : (
                <>
                    {/* Banner */}
                    <div className="px-4 py-2 mt-2">
                        <div className="flex items-center gap-4 bg-[#F8F9FB] dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors p-4 rounded-[20px] cursor-pointer" onClick={() => setViewMode('balance_history')}>
                            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-transparent flex items-center justify-center shadow-sm">
                                <History className="w-5 h-5 text-gray-700 dark:text-slate-300" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">Xem biến động số dư</h3>
                                <p className="text-[13px] text-gray-500 dark:text-slate-400 mt-0.5">Theo dõi lịch sử thay đổi số dư của bạn</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
                        {TABS.map(tab => {
                            const count = notifications.filter(n => (tab.types as readonly string[]).includes(n.type) || (tab.key === 'transaction' && !(TABS.flatMap(x => x.types) as readonly string[]).includes(n.type))).length;
                            const isActive = activeTab === tab.key;
                            return (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    className={cn('px-4 py-2 rounded-full text-[14px] whitespace-nowrap transition-colors',
                                        isActive ? 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-slate-400 font-medium bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800'
                                    )}>
                                    {tab.label} {count > 0 && `(${count})`}
                                </button>
                            )
                        })}
                    </div>

                    {/* Notifications List */}
                    <div className="flex-1 overflow-y-auto pb-24">
                        {loading && (
                            <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">Đang tải...</div>
                        )}
                        {!loading && filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center gap-3 p-10 mt-10">
                                <Bell className="w-12 h-12 text-gray-200 dark:text-slate-700" />
                                <p className="text-gray-400 dark:text-slate-500 text-sm">Không có thông báo nào</p>
                            </div>
                        )}
                        {renderGroup('Hôm nay', grouped.today)}
                        {renderGroup('Hôm qua', grouped.yesterday)}
                        {renderGroup('Cũ hơn', grouped.older)}
                    </div>

                    {/* Bottom Action */}
                    {filtered.length > 0 && (
                        <div className="absolute bottom-6 left-0 right-0 px-4">
                            <button onClick={markAllRead} className="w-full py-4 bg-[#F8F9FB] dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-semibold rounded-[20px] transition-colors shadow-sm border border-gray-100 dark:border-transparent">
                                Đánh dấu đã đọc tất cả
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Detail View Modal */}
            {selectedNotification && (
                <div className="absolute inset-0 z-20 bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden slide-in-bottom">
                    <div className="flex items-center justify-between px-4 pt-12 pb-2 bg-white dark:bg-slate-900 border-b border-gray-50 dark:border-slate-800">
                        <button onClick={() => setSelectedNotification(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0">
                            <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-slate-200" />
                        </button>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Chi tiết giao dịch</h2>
                        <div className="w-10"></div>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="w-20 h-20 mx-auto rounded-full bg-gray-50 dark:bg-slate-800 border dark:border-transparent flex items-center justify-center text-4xl mb-6 shadow-sm overflow-hidden">
                            {(() => {
                                const matchLogo = getMatchingLogo(selectedNotification.title) || getMatchingLogo(selectedNotification.message);
                                if (matchLogo) return <div className="w-full h-full p-3 bg-white"><img src={matchLogo} alt="bank" className="w-full h-full object-contain" /></div>;
                                return selectedNotification.icon || TYPE_MAP[selectedNotification.type]?.icon || '🔔';
                            })()}
                        </div>
                        <h3 className="text-center text-[18px] font-bold text-gray-900 dark:text-white mb-2">{selectedNotification.title}</h3>
                        <div className="bg-[#F8F9FB] dark:bg-slate-800 p-5 rounded-[20px] mt-6 leading-relaxed text-gray-600 dark:text-slate-300 text-[15px]">
                            {selectedNotification.message}
                        </div>
                        <div className="mt-8 space-y-5 px-1 text-[15px]">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-slate-800">
                                <span className="text-gray-500 dark:text-slate-400">Thời gian</span>
                                <span className="font-semibold text-gray-900 dark:text-slate-100">{formatDateTime(selectedNotification.createdAt)}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-slate-800">
                                <span className="text-gray-500 dark:text-slate-400">Loại thông báo</span>
                                <span className="font-semibold text-gray-900 dark:text-slate-100">{TABS.find(t => (t.types as readonly string[]).includes(selectedNotification.type))?.label || 'Hệ thống'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 dark:text-slate-400">Trạng thái</span>
                                <span className="font-semibold text-green-600 dark:text-green-500">Thành công</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function NotificationPanel({ open, onClose }: NotificationPanelProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    if (!mounted) return null;

    const panel = (
        <div className={cn(
            'fixed top-0 right-0 h-full w-full sm:w-[400px] z-[1000] shadow-2xl flex flex-col transition-transform duration-300 ease-out bg-white dark:bg-slate-900 overflow-hidden',
            open ? 'translate-x-0' : 'translate-x-full'
        )}>
            <PanelContent onClose={onClose} />
        </div>
    );

    return createPortal(panel, document.body);
}
