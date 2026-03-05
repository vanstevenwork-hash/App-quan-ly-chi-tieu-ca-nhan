'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
    const esRef = useRef<EventSource | null>(null);

    const fetchAll = useCallback(async () => {
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

    // Initial load
    useEffect(() => { fetchAll(); }, [fetchAll]);

    // SSE — realtime push from server
    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;

        const connect = () => {
            // Close existing connection before reconnecting
            esRef.current?.close();

            // Pass token as query param since EventSource cannot set custom headers
            const es = new EventSource(`${API_URL}/notifications/stream?token=${token}`);
            esRef.current = es;

            es.onmessage = (e) => {
                try {
                    const payload = JSON.parse(e.data);
                    if (payload.type === 'notification' && payload.data) {
                        setNotifications(prev => {
                            // Avoid duplicate if already exists
                            if (prev.some(n => n._id === payload.data._id)) return prev;
                            return [payload.data, ...prev];
                        });
                    }
                } catch { /* ignore malformed events */ }
            };

            es.onerror = () => {
                es.close();
                // Reconnect after 5s on failure
                setTimeout(connect, 5_000);
            };
        };

        connect();

        return () => {
            esRef.current?.close();
            esRef.current = null;
        };
    }, []);

    const markRead = async (id: string) => {
        setNotifications(prev =>
            prev.map(n => n._id === id ? { ...n, isRead: true } : n)
        );
        try { await notificationsApi.markRead(id); } catch { await fetchAll(); }
    };

    const markAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        try { await notificationsApi.markAllRead(); } catch { await fetchAll(); }
    };

    const deleteOne = async (id: string) => {
        setNotifications(prev => prev.filter(n => n._id !== id));
        try { await notificationsApi.deleteOne(id); } catch { await fetchAll(); }
    };

    const clearAll = async () => {
        setNotifications([]);
        try { await notificationsApi.clearAll(); } catch { await fetchAll(); }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return { notifications, loading, error, unreadCount, markRead, markAllRead, deleteOne, clearAll, refetch: fetchAll };
}
