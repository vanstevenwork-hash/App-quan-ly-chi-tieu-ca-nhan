'use client';
import { useState, useEffect, useCallback } from 'react';
import { transactionsApi } from '@/lib/api';
import { registerStoreReset } from '@/store/useStore';

export interface Transaction {
    _id: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    note: string;
    date: string;
    paymentMethod: string;
    cardId?: string;
    // Installment
    isInstallment?: boolean;
    installmentMonths?: number;
    installmentMonthly?: number;
    installmentStartDate?: string;
}

import { create } from 'zustand';

interface TransactionStore {
    transactions: Transaction[];
    summary: { income: number; expense: number; balance: number };
    loading: boolean;
    hasFetched: boolean;
    fetch: (force?: boolean) => Promise<void>;
    reset: () => void;
    createTransaction: (data: object) => Promise<any>;
    updateTransaction: (id: string, data: object) => Promise<any>;
    deleteTransaction: (id: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
    transactions: [],
    summary: { income: 0, expense: 0, balance: 0 },
    loading: false,
    hasFetched: false,
    reset: () => set({ transactions: [], summary: { income: 0, expense: 0, balance: 0 }, loading: false, hasFetched: false }),
    fetch: async (force = false) => {
        if (get().loading || (get().hasFetched && !force)) return;
        set({ loading: true });
        try {
            const [txRes, sumRes] = await Promise.all([
                transactionsApi.getAll(),
                transactionsApi.getSummary(),
            ]);
            const s = sumRes.data?.data || {};
            set({
                transactions: txRes.data?.data || [],
                summary: { income: s.income || 0, expense: s.expense || 0, balance: (s.income || 0) - (s.expense || 0) },
                hasFetched: true,
                loading: false
            });
        } catch {
            // Demo mode fallback
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token === 'mock-token') {
                const { mockTransactions } = await import('@/lib/mockData');
                const income = mockTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
                const expense = mockTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                set({
                    transactions: mockTransactions as any,
                    summary: { income, expense, balance: income - expense },
                    hasFetched: true,
                    loading: false
                });
            } else {
                set({ loading: false });
            }
        }
    },
    createTransaction: async (data: object) => {
        const res = await transactionsApi.create(data);
        await get().fetch(true);
        return res.data?.data;
    },
    updateTransaction: async (id: string, data: object) => {
        const res = await transactionsApi.update(id, data);
        await get().fetch(true);
        return res.data?.data;
    },
    deleteTransaction: async (id: string) => {
        await transactionsApi.delete(id);
        set({ transactions: get().transactions.filter(t => t._id !== id) });
        await get().fetch(true);
    }
}));
registerStoreReset(() => useTransactionStore.getState().reset());

export function useTransactions(params?: object) {
    const store = useTransactionStore();

    useEffect(() => {
        store.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        transactions: store.transactions,
        summary: store.summary,
        loading: store.loading,
        createTransaction: store.createTransaction,
        updateTransaction: store.updateTransaction,
        deleteTransaction: store.deleteTransaction,
        refetch: () => store.fetch(true)
    };
}
