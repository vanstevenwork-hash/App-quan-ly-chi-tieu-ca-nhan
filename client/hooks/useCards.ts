'use client';
import { useState, useEffect, useCallback } from 'react';
import { cardsApi } from '@/lib/api';
import { registerStoreReset } from '@/store/useStore';

export interface Card {
    _id: string;
    bankName: string;
    bankShortName: string;
    cardType: 'credit' | 'debit' | 'savings' | 'eWallet' | 'crypto';
    cardNumber: string;
    cardHolder: string;
    cardNetwork: 'visa' | 'mastercard' | 'jcb' | 'amex' | 'napas' | 'other' | '';
    balance: number;
    creditLimit: number;
    color: string;
    bankColor: string;
    isDefault: boolean;
    createdAt: string;
    // savings
    interestRate: number;
    depositDate: string | null;
    maturityDate: string | null;
    term: number;
    // credit
    paymentDueDay: number;
    statementDay: number;
    expirationDate: string;
    note: string;
}

export interface CardFormData {
    bankName: string;
    bankShortName: string;
    cardType: 'credit' | 'debit' | 'savings' | 'eWallet' | 'crypto';
    cardNumber: string;
    cardHolder: string;
    cardNetwork: 'visa' | 'mastercard' | 'jcb' | 'amex' | 'napas' | 'other' | '';
    balance: number;
    creditLimit: number;
    color: string;
    bankColor: string;
    isDefault: boolean;
    // savings
    interestRate: number;
    depositDate: string;
    maturityDate: string;
    term: number;
    // credit
    paymentDueDay: number;
    statementDay: number;
    expirationDate: string;
    note: string;
}

import { create } from 'zustand';

interface CardStore {
    cards: Card[];
    totalBalance: number;
    totalDebt: number;
    loading: boolean;
    error: string | null;
    hasFetched: boolean;
    fetch: (force?: boolean) => Promise<void>;
    reset: () => void;
    createCard: (data: CardFormData) => Promise<any>;
    updateCard: (id: string, data: Partial<CardFormData>) => Promise<any>;
    deleteCard: (id: string) => Promise<void>;
    setDefaultCard: (id: string) => Promise<void>;
}

export const useCardStore = create<CardStore>((set, get) => ({
    cards: [],
    totalBalance: 0,
    totalDebt: 0,
    loading: false,
    error: null,
    hasFetched: false,
    reset: () => set({ cards: [], totalBalance: 0, totalDebt: 0, loading: false, error: null, hasFetched: false }),
    fetch: async (force = false) => {
        if (get().loading || (get().hasFetched && !force)) return;
        set({ loading: true, error: null });
        try {
            const res = await cardsApi.getAll();
            set({
                cards: res.data?.data || [],
                totalBalance: res.data?.totalBalance || 0,
                totalDebt: res.data?.totalDebt || 0,
                hasFetched: true,
                loading: false
            });
        } catch {
            // Demo mode fallback: if using mock token, load sample data
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token === 'mock-token') {
                const { mockCards } = await import('@/lib/mockData');
                const totalBalance = mockCards.filter(c => c.cardType !== 'credit').reduce((s, c) => s + c.balance, 0);
                const totalDebt = mockCards.filter(c => c.cardType === 'credit').reduce((s, c) => s + c.balance, 0);
                set({ cards: mockCards as any, totalBalance, totalDebt, hasFetched: true, loading: false });
            } else {
                set({ error: 'Không thể tải danh sách thẻ', loading: false });
            }
        }
    },
    createCard: async (data: CardFormData) => {
        const res = await cardsApi.create(data);
        await get().fetch(true);
        return res.data?.data;
    },
    updateCard: async (id: string, data: Partial<CardFormData>) => {
        const res = await cardsApi.update(id, data);
        set({ cards: get().cards.map(c => c._id === id ? { ...c, ...res.data.data } : c) });
        return res.data?.data;
    },
    deleteCard: async (id: string) => {
        await cardsApi.delete(id);
        set({ cards: get().cards.filter(c => c._id !== id) });
    },
    setDefaultCard: async (id: string) => {
        await cardsApi.setDefault(id);
        set({ cards: get().cards.map(c => ({ ...c, isDefault: c._id === id })) });
    }
}));
registerStoreReset(() => useCardStore.getState().reset());

export function useCards() {
    const store = useCardStore();

    useEffect(() => {
        store.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        cards: store.cards,
        totalBalance: store.totalBalance,
        totalDebt: store.totalDebt,
        loading: store.loading,
        error: store.error,
        createCard: store.createCard,
        updateCard: store.updateCard,
        deleteCard: store.deleteCard,
        setDefaultCard: store.setDefaultCard,
        refetch: () => store.fetch(true)
    };
}
