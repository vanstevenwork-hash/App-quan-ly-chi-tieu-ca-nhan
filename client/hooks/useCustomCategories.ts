'use client';
import { useEffect } from 'react';
import { create } from 'zustand';
import { categoriesApi, type CustomCategory } from '@/lib/api';
import { syncCustomCategories } from '@/lib/mockData';
import { registerStoreReset } from '@/store/useStore';

interface CustomCategoriesState {
    categories: CustomCategory[];
    loading: boolean;
    fetched: boolean;
    fetch: (force?: boolean) => Promise<void>;
    add: (data: Omit<CustomCategory, '_id'>) => Promise<void>;
    update: (id: string, data: Partial<Omit<CustomCategory, '_id'>>) => Promise<void>;
    remove: (id: string) => Promise<void>;
    reset: () => void;
}

const applyList = (list: CustomCategory[], set: (p: Partial<CustomCategoriesState>) => void) => {
    syncCustomCategories(list); // keep CATEGORIES_MAP in sync so display resolves them
    set({ categories: list });
};

export const useCustomCategoriesStore = create<CustomCategoriesState>((set, get) => ({
    categories: [],
    loading: false,
    fetched: false,
    fetch: async (force = false) => {
        if (get().fetched && !force) return;
        set({ loading: true });
        try {
            const res = await categoriesApi.list();
            applyList(res.data.categories || [], set);
            set({ fetched: true });
        } catch { /* offline / demo — ignore */ }
        finally { set({ loading: false }); }
    },
    add: async (data) => { const res = await categoriesApi.create(data); applyList(res.data.categories || [], set); },
    update: async (id, data) => { const res = await categoriesApi.update(id, data); applyList(res.data.categories || [], set); },
    remove: async (id) => { const res = await categoriesApi.remove(id); applyList(res.data.categories || [], set); },
    reset: () => { syncCustomCategories([]); set({ categories: [], fetched: false }); },
}));

registerStoreReset(() => useCustomCategoriesStore.getState().reset());

export function useCustomCategories() {
    const store = useCustomCategoriesStore();
    useEffect(() => { store.fetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return store;
}
