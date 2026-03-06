import { create } from 'zustand';
import { banksApi } from '@/lib/api';

interface BankStore {
    banks: any[];
    loading: boolean;
    error: string | null;
    fetchBanks: () => Promise<void>;
}

export const useBanks = create<BankStore>((set, get) => ({
    banks: [],
    loading: false,
    error: null,
    fetchBanks: async () => {
        if (get().banks.length > 0 || get().loading) return;

        set({ loading: true, error: null });
        try {
            const res = await banksApi.getAll();
            set({ banks: res.data?.data || [], loading: false });
        } catch (error: any) {
            console.error('Failed to load banks', error);
            set({ error: error.message, loading: false });
        }
    }
}));
