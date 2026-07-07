'use client';
import { useEffect } from 'react';
import { create } from 'zustand';
import { cashbackApi } from '@/lib/api';
import { registerStoreReset } from '@/store/useStore';

export interface CashbackRecord {
    _id: string;
    cardId: string;
    year: number;
    month: number; // 0-11
    estimatedAmount: number;
    receivedAmount: number | null;
    status: 'pending' | 'received';
    receivedAt: string | null;
}

interface CashbackRecordStore {
    records: CashbackRecord[];
    loading: boolean;
    error: string | null;
    hasFetched: boolean;
    fetch: (force?: boolean) => Promise<void>;
    reset: () => void;
    setStatus: (cardId: string, year: number, month: number, status: 'pending' | 'received', estimatedAmount: number, receivedAmount?: number) => Promise<void>;
}

export const useCashbackRecordStore = create<CashbackRecordStore>((set, get) => ({
    records: [],
    loading: false,
    error: null,
    hasFetched: false,
    reset: () => set({ records: [], loading: false, error: null, hasFetched: false }),
    fetch: async (force = false) => {
        if (get().loading || (get().hasFetched && !force)) return;
        set({ loading: true, error: null });
        try {
            const res = await cashbackApi.getAll();
            set({ records: res.data?.data || [], hasFetched: true, loading: false });
        } catch {
            set({ error: 'Không thể tải lịch sử hoàn tiền', loading: false });
        }
    },
    setStatus: async (cardId, year, month, status, estimatedAmount, receivedAmount) => {
        const res = await cashbackApi.upsert({ cardId, year, month, status, estimatedAmount, receivedAmount });
        const updated: CashbackRecord = res.data?.data;
        set({
            records: [
                ...get().records.filter(r => !(r.cardId === cardId && r.year === year && r.month === month)),
                updated,
            ],
        });
    },
}));
registerStoreReset(() => useCashbackRecordStore.getState().reset());

export function useCashbackRecords() {
    const store = useCashbackRecordStore();

    useEffect(() => {
        store.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        records: store.records,
        loading: store.loading,
        error: store.error,
        setStatus: store.setStatus,
        refetch: () => store.fetch(true),
    };
}
