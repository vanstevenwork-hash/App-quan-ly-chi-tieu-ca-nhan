'use client';
import { useState } from 'react';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notification {
    id: string;
    icon: string;
    iconBg: string;
    iconColor: string;
    title: string;
    subtitle: string;
    subtitleColor?: string;
    timeAgo: string;
    isUnread: boolean;
    hasAction: boolean;
    type: 'important' | 'transaction' | 'general';
}

const NOTIFICATIONS: Notification[] = [
    {
        id: '1',
        icon: '💳',
        iconBg: '#FEE2E2',
        iconColor: '#EF4444',
        title: 'Thanh toán thẻ tín dụng VIB',
        subtitle: 'Đến hạn thanh toán - 15.000.000đ',
        subtitleColor: '#EF4444',
        timeAgo: '2 giờ trước',
        isUnread: true,
        hasAction: true,
        type: 'important',
    },
    {
        id: '2',
        icon: '🏦',
        iconBg: '#FFF7ED',
        iconColor: '#F97316',
        title: 'Sao kê Techcombank',
        subtitle: 'Sắp có sao kê tháng này',
        timeAgo: '5 giờ trước',
        isUnread: false,
        hasAction: false,
        type: 'important',
    },
    {
        id: '3',
        icon: '🐷',
        iconBg: '#ECFDF5',
        iconColor: '#10B981',
        title: 'Số tiết kiệm đến hạn',
        subtitle: 'Vietcombank - Đã tất toán gốc lãi',
        subtitleColor: '#10B981',
        timeAgo: '1 ngày trước',
        isUnread: true,
        hasAction: true,
        type: 'transaction',
    },
    {
        id: '4',
        icon: '📢',
        iconBg: '#F0FDF4',
        iconColor: '#22C55E',
        title: 'Khuyến mãi mới từ ShopeePay',
        subtitle: 'Hoàn tiền 50% cho hóa đơn điện nước',
        timeAgo: '2 ngày trước',
        isUnread: false,
        hasAction: false,
        type: 'general',
    },
    {
        id: '5',
        icon: '🔒',
        iconBg: '#F1F5F9',
        iconColor: '#64748B',
        title: 'Cảnh báo đăng nhập lạ',
        subtitle: 'Phát hiện đăng nhập trên thiết bị mới',
        timeAgo: '3 ngày trước',
        isUnread: false,
        hasAction: false,
        type: 'important',
    },
];

const TABS = [
    { label: 'Tất cả', key: 'all' },
    { label: 'Quan trọng', key: 'important' },
    { label: 'Giao dịch', key: 'transaction' },
] as const;

export default function NotificationsPage() {
    const [activeTab, setActiveTab] = useState<'all' | 'important' | 'transaction'>('all');
    const [readIds, setReadIds] = useState<Set<string>>(new Set());

    const filtered = NOTIFICATIONS.filter(n => {
        if (activeTab === 'all') return true;
        return n.type === activeTab;
    }).filter(n => true);

    const markRead = (id: string) => setReadIds(prev => new Set(Array.from(prev).concat(id)));
    const unreadCount = NOTIFICATIONS.filter(n => n.isUnread && !readIds.has(n.id)).length;

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950">
            {/* Header */}
            <div className="px-5 pt-14 pb-3">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-foreground">Thông báo</h1>
                        {unreadCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold">{unreadCount}</span>
                            </span>
                        )}
                    </div>
                    <button className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                        <Filter className="w-4 h-4 text-foreground" />
                    </button>
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

            {/* Notification list */}
            <div className="divide-y divide-gray-50 dark:divide-slate-800/50 pb-24">
                {filtered.map((notif) => {
                    const isUnread = notif.isUnread && !readIds.has(notif.id);
                    return (
                        <button
                            key={notif.id}
                            onClick={() => markRead(notif.id)}
                            className="w-full flex items-start gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                        >
                            {/* Icon */}
                            <div className="relative flex-shrink-0">
                                <div
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                                    style={{ backgroundColor: notif.iconBg }}
                                >
                                    {notif.icon}
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
                                <p className="text-xs mt-0.5" style={{ color: notif.subtitleColor || undefined }}>
                                    {!notif.subtitleColor && <span className="text-muted-foreground">{notif.subtitle}</span>}
                                    {notif.subtitleColor && notif.subtitle}
                                </p>
                                <p className="text-muted-foreground text-xs mt-1">{notif.timeAgo}</p>
                            </div>

                            {/* Action dot */}
                            {notif.hasAction && (
                                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
