'use client';
import { useMemo, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications';
import { TYPE_MAP } from '@/components/NotificationPanel';

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

export default function NotificationsPage() {
    const { notifications, loading, error, unreadCount, markRead, markAllRead } = useNotifications();
    const [activeTab, setActiveTab] = useState<'all' | 'important' | 'transaction'>('all');

    const filtered = useMemo(() => notifications.filter((n) => {
        if (activeTab === 'important') return n.isImportant;
        if (activeTab === 'transaction') return TRANSACTION_TYPES.includes(n.type);
        return true;
    }), [notifications, activeTab]);

    const handleSelect = (n: NotificationItem) => {
        if (!n.isRead) markRead(n._id);
    };

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950">
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
                            <CheckCheck className="w-4 h-4 text-foreground" />
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
            {!loading && !error && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <Bell className="w-12 h-12 text-gray-200 dark:text-slate-700" />
                    <p className="text-muted-foreground text-sm">Không có thông báo nào</p>
                </div>
            )}

            {/* Notification list */}
            <div className="divide-y divide-gray-50 dark:divide-slate-800/50 pb-24">
                {filtered.map((notif) => {
                    const meta = TYPE_MAP[notif.type] || TYPE_MAP.general;
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
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                                    style={{ backgroundColor: iconBg }}
                                >
                                    {icon}
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
