'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi } from '@/lib/api';
import { registerStoreReset } from '@/store/useStore';

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
import { create } from 'zustand';

interface NotificationStore {
    notifications: NotificationItem[];
    loading: boolean;
    error: string | null;
    hasFetched: boolean;
    esConnected: boolean;
    fetch: (force?: boolean) => Promise<void>;
    setupSSE: () => void;
    reset: () => void;
    markRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    deleteOne: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
}

let esRef: EventSource | null = null;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    notifications: [],
    loading: false,
    error: null,
    hasFetched: false,
    esConnected: false,
    reset: () => {
        if (esRef) { esRef.close(); esRef = null; }
        set({ notifications: [], loading: false, error: null, hasFetched: false, esConnected: false });
    },
    fetch: async (force = false) => {
        if (get().loading || (get().hasFetched && !force)) return;
        set({ loading: true, error: null });
        try {
            const res = await notificationsApi.getAll({ limit: 50 });
            set({
                notifications: res.data?.data || [],
                hasFetched: true,
                loading: false
            });
        } catch {
            // In demo mode, just show empty notifications (no error)
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token === 'mock-token') {
                set({ notifications: [], hasFetched: true, loading: false });
            } else {
                set({ error: 'Không thể tải thông báo', loading: false });
            }
        }
    },
    setupSSE: () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token || token === 'mock-token' || get().esConnected) return;

        set({ esConnected: true });

        const connect = () => {
            if (esRef) esRef.close();
            const es = new EventSource(`${API_URL}/notifications/stream?token=${token}`);
            esRef = es;

            es.onmessage = (e) => {
                try {
                    const payload = JSON.parse(e.data);
                    if (payload.type === 'notification' && payload.data) {
                        set(state => {
                            if (state.notifications.some(n => n._id === payload.data._id)) return state;
                            return { notifications: [payload.data, ...state.notifications] };
                        });
                    }
                } catch { /* ignore */ }
            };

            es.onerror = () => {
                es.close();
                setTimeout(connect, 5000);
            };
        };

        connect();
    },
    markRead: async (id: string) => {
        set(state => ({
            notifications: state.notifications.map(n => n._id === id ? { ...n, isRead: true } : n)
        }));
        try { await notificationsApi.markRead(id); } catch { await get().fetch(true); }
    },
    markAllRead: async () => {
        set(state => ({
            notifications: state.notifications.map(n => ({ ...n, isRead: true }))
        }));
        try { await notificationsApi.markAllRead(); } catch { await get().fetch(true); }
    },
    deleteOne: async (id: string) => {
        set(state => ({
            notifications: state.notifications.filter(n => n._id !== id)
        }));
        try { await notificationsApi.deleteOne(id); } catch { await get().fetch(true); }
    },
    clearAll: async () => {
        set({ notifications: [] });
        try { await notificationsApi.clearAll(); } catch { await get().fetch(true); }
    }
}));
registerStoreReset(() => useNotificationStore.getState().reset());

export function useNotifications() {
    const store = useNotificationStore();

    useEffect(() => {
        store.fetch();
        store.setupSSE();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const unreadCount = store.notifications.filter(n => !n.isRead).length;

    return {
        notifications: store.notifications,
        loading: store.loading,
        error: store.error,
        unreadCount,
        markRead: store.markRead,
        markAllRead: store.markAllRead,
        deleteOne: store.deleteOne,
        clearAll: store.clearAll,
        refetch: () => store.fetch(true)
    };
}
