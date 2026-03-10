'use client';
import { useState, useEffect, useCallback } from 'react';
import { wealthApi } from '@/lib/api';
import { registerStoreReset } from '@/store/useStore';

export interface WealthSource {
    _id: string;
    name: string;
    icon: string;
    color: string;
    balance: number;
    category: string;
    note: string;
    createdAt: string;
}

export interface WealthFormData {
    name: string;
    icon: string;
    color: string;
    balance: number;
    category: string;
    note: string;
}

import { create } from 'zustand';

interface WealthStore {
    sources: WealthSource[];
    total: number;
    loading: boolean;
    error: string | null;
    hasFetched: boolean;
    fetch: (force?: boolean) => Promise<void>;
    reset: () => void;
    createSource: (data: WealthFormData) => Promise<any>;
    updateSource: (id: string, data: Partial<WealthFormData>) => Promise<any>;
    deleteSource: (id: string) => Promise<void>;
}

export const useWealthStore = create<WealthStore>((set, get) => ({
    sources: [],
    total: 0,
    loading: false,
    error: null,
    hasFetched: false,
    reset: () => set({ sources: [], total: 0, loading: false, error: null, hasFetched: false }),
    fetch: async (force = false) => {
        if (get().loading || (get().hasFetched && !force)) return;
        set({ loading: true, error: null });
        try {
            const res = await wealthApi.getAll();
            set({
                sources: res.data?.data || [],
                total: res.data?.total || 0,
                hasFetched: true,
                loading: false
            });
        } catch {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token === 'mock-token') {
                set({ sources: [], total: 0, hasFetched: true, loading: false });
            } else {
                set({ error: 'Không thể tải nguồn tài sản', loading: false });
            }
        }
    },
    createSource: async (data: WealthFormData) => {
        const res = await wealthApi.create(data);
        await get().fetch(true);
        return res.data?.data;
    },
    updateSource: async (id: string, data: Partial<WealthFormData>) => {
        const res = await wealthApi.update(id, data);
        set({ sources: get().sources.map(s => s._id === id ? { ...s, ...res.data.data } : s) });
        set({
            total: get().total - (get().sources.find(s => s._id === id)?.balance || 0) + (res.data.data.balance || 0)
        });
        return res.data?.data;
    },
    deleteSource: async (id: string) => {
        await wealthApi.delete(id);
        const removed = get().sources.find(s => s._id === id);
        set({
            total: get().total - (removed?.balance || 0),
            sources: get().sources.filter(s => s._id !== id)
        });
    }
}));
registerStoreReset(() => useWealthStore.getState().reset());

export function useWealth() {
    const store = useWealthStore();

    useEffect(() => {
        store.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        sources: store.sources,
        total: store.total,
        loading: store.loading,
        error: store.error,
        createSource: store.createSource,
        updateSource: store.updateSource,
        deleteSource: store.deleteSource,
        refetch: () => store.fetch(true)
    };
}
