'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, Trash2, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/store/useStore';

const TABS = [
    { label: 'Tất cả', key: 'all' },
    { label: 'Quan trọng', key: 'important' },
    { label: 'Giao dịch', key: 'transaction' },
] as const;

// Map notification type → icon/bg 
const TYPE_MAP: Record<string, { icon: string; bg: string }> = {
    transaction_expense: { icon: '💸', bg: '#FEE2E2' },
    transaction_income: { icon: '💰', bg: '#ECFDF5' },
    budget_warning: { icon: '⚠️', bg: '#FEF3C7' },
    budget_overspend: { icon: '🚨', bg: '#FEE2E2' },
    goal_milestone: { icon: '🏆', bg: '#F0FDF4' },
    goal_complete: { icon: '🏆', bg: '#DCFCE7' },
    system: { icon: '🔔', bg: '#EFF6FF' },
    general: { icon: '📢', bg: '#F8FAFC' },
};

interface NotificationPanelProps {
    open: boolean;
    onClose: () => void;
}

function PanelContent({ onClose }: { onClose: () => void }) {
    const { isAuthenticated } = useAuthStore();
    const { notifications, unreadCount, loading, markRead, markAllRead, deleteOne, clearAll } = useNotifications();
    const [activeTab, setActiveTab] = useState<'all' | 'important' | 'transaction'>('all');

    const filtered = notifications.filter(n => {
        if (activeTab === 'all') return true;
        if (activeTab === 'important') return n.isImportant;
        if (activeTab === 'transaction') return n.type?.startsWith('transaction');
        return true;
    });

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (mins < 60) return `${mins} phút trước`;
        if (hours < 24) return `${hours} giờ trước`;
        return `${days} ngày trước`;
    };

    // If not logged in, show login prompt
    if (!isAuthenticated) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300" />
                <p className="text-gray-500 text-sm">Đăng nhập để xem thông báo</p>
            </div>
        );
    }

    return (
        <>
            {/* Tabs */}
            <div className="px-5 pt-4 pb-0 border-b border-gray-100 flex gap-5">
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={cn('pb-2.5 text-sm font-semibold border-b-2 transition-all',
                            activeTab === tab.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-700'
                        )}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Actions */}
            {notifications.length > 0 && (
                <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-50">
                    {unreadCount > 0 && (
                        <button onClick={markAllRead}
                            className="flex items-center gap-1 text-indigo-600 text-xs font-semibold hover:underline">
                            <CheckCheck className="w-3.5 h-3.5" /> Đánh dấu tất cả đã đọc
                        </button>
                    )}
                    <button onClick={clearAll}
                        className="flex items-center gap-1 text-red-400 text-xs font-semibold hover:underline ml-auto">
                        <Trash2 className="w-3.5 h-3.5" /> Xoá tất cả
                    </button>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50 pb-8">
                {loading && (
                    <div className="p-8 text-center text-gray-400 text-sm">Đang tải...</div>
                )}
                {!loading && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 p-10">
                        <Bell className="w-10 h-10 text-gray-200" />
                        <p className="text-gray-400 text-sm">Không có thông báo nào</p>
                    </div>
                )}
                {filtered.map(n => {
                    const meta = TYPE_MAP[n.type] || TYPE_MAP.general;
                    const icon = n.icon || meta.icon;
                    const bg = meta.bg;
                    const isUnread = !n.isRead;
                    return (
                        <div key={n._id}
                            className={cn('flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer', isUnread && 'bg-indigo-50/40')}
                            onClick={() => markRead(n._id)}>
                            <div className="relative flex-shrink-0">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: bg }}>
                                    {icon}
                                </div>
                                {isUnread && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={cn('text-sm leading-snug', isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700')}>
                                    {n.title}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-xs text-gray-300 mt-1">{timeAgo(n.createdAt)}</p>
                            </div>
                            <button onClick={e => { e.stopPropagation(); deleteOne(n._id); }}
                                className="p-1. rounded-full hover:bg-gray-100 text-gray-300 hover:text-red-400 transition-colors ml-1 flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

export default function NotificationPanel({ open, onClose }: NotificationPanelProps) {
    const [mounted, setMounted] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    if (!mounted) return null;

    const panel = (
        <>
            {/* Backdrop */}
            <div ref={overlayRef}
                onClick={onClose}
                className={cn('fixed inset-0 bg-black/40 z-[999] transition-opacity duration-300',
                    open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                )} />

            {/* Drawer from right */}
            <div className={cn(
                'fixed top-0 right-0 h-full w-full max-w-sm bg-white z-[1000] shadow-2xl flex flex-col transition-transform duration-300 ease-out',
                open ? 'translate-x-0' : 'translate-x-full'
            )}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-14 pb-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-gray-900">Thông báo</h2>
                    </div>
                    <button onClick={onClose}
                        className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <X className="w-4 h-4 text-gray-600" />
                    </button>
                </div>
                <PanelContent onClose={onClose} />
            </div>
        </>
    );

    return createPortal(panel, document.body);
}
