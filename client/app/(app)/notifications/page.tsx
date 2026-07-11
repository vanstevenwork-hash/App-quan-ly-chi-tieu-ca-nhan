'use client';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { cn } from '@/lib/utils';
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications';
import { useImportantAlerts } from '@/hooks/useImportantAlerts';
import { TYPE_MAP, renderNotifIcon } from '@/components/NotificationPanel';
import { toast } from 'sonner';

const fmtFull = (n: number) => n.toLocaleString('vi-VN');

const TABS = [
    { label: 'Tất cả', key: 'all' },
    { label: 'Quan trọng', key: 'important' },
    { label: 'Giao dịch', key: 'transaction' },
] as const;

const TRANSACTION_TYPES = ['transaction', 'payment', 'saving', 'transaction_expense', 'transaction_income'];

const timeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function NotificationsContent() {
    const { notifications, loading, error, unreadCount, markRead, markAllRead } = useNotifications();
    const { creditAlerts, savingsAlerts, shareInvites, respondToShare, count: alertCount } = useImportantAlerts();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<'all' | 'important' | 'transaction'>(
        initialTab === 'important' || initialTab === 'transaction' ? initialTab : 'all'
    );
    const router = useRouter();
    const [respondingShareId, setRespondingShareId] = useState<string | null>(null);

    const handleRespondShare = async (shareId: string, accept: boolean) => {
        setRespondingShareId(shareId);
        try {
            await respondToShare(shareId, accept);
            toast.success(accept ? 'Đã tham gia thẻ chung' : 'Đã từ chối lời mời');
        } catch {
            toast.error('Không thể xử lý lời mời, thử lại sau');
        } finally {
            setRespondingShareId(null);
        }
    };

    const filtered = useMemo(() => notifications.filter((n) => {
        if (activeTab === 'important') return n.isImportant;
        if (activeTab === 'transaction') return TRANSACTION_TYPES.includes(n.type);
        return true;
    }), [notifications, activeTab]);

    const handleSelect = (n: NotificationItem) => {
        if (!n.isRead) markRead(n._id);
    };

    return (
        <div className="min-h-screen bg-white dark:bg-surface-deep">
            {/* Header */}
            <div className="px-5 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-foreground">Thông báo</h1>
                        {unreadCount > 0 && (
                            <span className="min-w-5 h-5 px-1 rounded-full bg-primary flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold">{unreadCount}</span>
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={() => markAllRead()}
                            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center"
                            aria-label="Đánh dấu đã đọc tất cả"
                        >
                            <ActionIcon type="checkCheck" size={16} tile={false} color="currentColor" />
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-5">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'pb-2 text-sm font-semibold border-b-2 transition-all',
                                activeTab === tab.key
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* States */}
            {loading && notifications.length === 0 && (
                <div className="p-10 text-center text-muted-foreground text-sm">Đang tải...</div>
            )}
            {!loading && error && notifications.length === 0 && (
                <div className="p-10 text-center text-muted-foreground text-sm">{error}</div>
            )}
            {!loading && !error && filtered.length === 0 && !(activeTab === 'important' && alertCount > 0) && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <UtilityIcon type="bell" size={48} tile={false} color="#E2E8F0" />
                    <p className="text-muted-foreground text-sm">Không có thông báo nào</p>
                </div>
            )}

            {/* Live important alerts — same source as the Home "Thông báo quan trọng" section */}
            {activeTab === 'important' && alertCount > 0 && (
                <div className="divide-y divide-gray-50 dark:divide-slate-800/50 border-b border-gray-50 dark:border-slate-800/50">
                    {shareInvites.map(item => (
                        <div key={item.share._id} className="px-5 py-4">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-indigo-50 dark:bg-indigo-500/15">
                                    🤝
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm leading-snug font-bold text-foreground">{item.owner?.name || 'Ai đó'} mời chia sẻ thẻ</p>
                                    <p className="text-xs mt-0.5 text-muted-foreground">{item.card.bankName} •••• {item.card.cardNumber}</p>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-3 pl-16">
                                <button
                                    onClick={() => handleRespondShare(item.share._id, false)}
                                    disabled={respondingShareId !== null}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    Từ chối
                                </button>
                                <button
                                    onClick={() => handleRespondShare(item.share._id, true)}
                                    disabled={respondingShareId !== null}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {respondingShareId === item.share._id ? 'Đang xử lý…' : 'Chấp nhận'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {creditAlerts.map(({ card, dueThisCycle }) => (
                        <button key={card._id}
                            onClick={() => router.push(`/cards/${card._id}`)}
                            className="w-full flex items-start gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-red-50 dark:bg-red-500/15">
                                💳
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm leading-snug font-bold text-foreground">Sao kê {card.bankName}</p>
                                <p className="text-xs mt-0.5 text-red-500 font-medium">Cần thanh toán kỳ này: {fmtFull(dueThisCycle)}đ</p>
                                <p className="text-muted-foreground text-xs mt-1">Đang hiệu lực</p>
                            </div>
                        </button>
                    ))}
                    {savingsAlerts.map(card => (
                        <button key={card._id}
                            onClick={() => router.push('/savings')}
                            className="w-full flex items-start gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-amber-50 dark:bg-amber-500/15">
                                🏦
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm leading-snug font-bold text-foreground">Sổ tiết kiệm {card.bankShortName}</p>
                                <p className="text-xs mt-0.5 text-amber-600 dark:text-amber-400 font-medium">Kiểm tra kỳ hạn — {fmtFull(card.balance)}đ</p>
                                <p className="text-muted-foreground text-xs mt-1">Đang hiệu lực</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Notification list */}
            <div className="divide-y divide-gray-50 dark:divide-slate-800/50 pb-24">
                {filtered.map((notif) => {
                    const meta = TYPE_MAP[notif.type] || TYPE_MAP.general;
                    // Vector category icon for transaction notifs; stored emoji only as fallback
                    const customIcon = renderNotifIcon(notif);
                    const icon = notif.icon || meta.icon;
                    const iconBg = notif.iconBg || meta.bg;
                    const isUnread = !notif.isRead;
                    return (
                        <button
                            key={notif._id}
                            onClick={() => handleSelect(notif)}
                            className="w-full flex items-start gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                        >
                            {/* Icon */}
                            <div className="relative flex-shrink-0">
                                <div
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl overflow-hidden"
                                    style={customIcon ? undefined : { backgroundColor: iconBg }}
                                >
                                    {customIcon ?? icon}
                                </div>
                                {isUnread && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white dark:border-slate-950" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className={cn('text-sm leading-snug', isUnread ? 'font-bold text-foreground' : 'font-medium text-foreground/80')}>
                                    {notif.title}
                                </p>
                                <p className={cn('text-xs mt-0.5 line-clamp-2', notif.isImportant ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                                    {notif.message}
                                </p>
                                <p className="text-muted-foreground text-xs mt-1">{timeAgo(notif.createdAt)}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// useSearchParams needs a Suspense boundary for static rendering
export default function NotificationsPage() {
    return (
        <Suspense fallback={null}>
            <NotificationsContent />
        </Suspense>
    );
}
