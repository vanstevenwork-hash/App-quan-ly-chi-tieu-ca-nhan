'use client';
import { useState, useEffect, useCallback } from 'react';
import { notificationsApi } from '@/lib/api';

export interface NotificationItem {
    _id: string;
    title: string;
    message: string;
    type: string;
    icon: string;
    iconBg?: string;
    isRead: boolean;
    isImportant: boolean;
    createdAt: string;
    relatedId?: string;
}

export function useNotifications() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const res = await notificationsApi.getAll({ limit: 50 });
            setNotifications(res.data.data || []);
        } catch {
            setError('Không thể tải thông báo');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const markRead = async (id: string) => {
        setNotifications(prev =>
            prev.map(n => n._id === id ? { ...n, isRead: true } : n)
        );
        try { await notificationsApi.markRead(id); } catch { await fetch(); }
    };

    const markAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        try { await notificationsApi.markAllRead(); } catch { await fetch(); }
    };

    const deleteOne = async (id: string) => {
        setNotifications(prev => prev.filter(n => n._id !== id));
        try { await notificationsApi.deleteOne(id); } catch { await fetch(); }
    };

    const clearAll = async () => {
        setNotifications([]);
        try { await notificationsApi.clearAll(); } catch { await fetch(); }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return { notifications, loading, error, unreadCount, markRead, markAllRead, deleteOne, clearAll, refetch: fetch };
}
