'use client';
import { useState, useEffect, useCallback } from 'react';
import { transactionsApi } from '@/lib/api';

export interface Transaction {
    _id: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    note: string;
    date: string;
    paymentMethod: string;
}

export function useTransactions(params?: object) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const [txRes, sumRes] = await Promise.all([
                transactionsApi.getAll(params),
                transactionsApi.getSummary(params),
            ]);
            setTransactions(txRes.data.data || []);
            const s = sumRes.data.data || {};
            setSummary({ income: s.income || 0, expense: s.expense || 0, balance: (s.income || 0) - (s.expense || 0) });
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const createTransaction = async (data: object) => {
        const res = await transactionsApi.create(data);
        await fetch();
        return res.data.data;
    };

    const updateTransaction = async (id: string, data: object) => {
        const res = await transactionsApi.update(id, data);
        await fetch();
        return res.data.data;
    };

    const deleteTransaction = async (id: string) => {
        await transactionsApi.delete(id);
        setTransactions(prev => prev.filter(t => t._id !== id));
        await fetch();
    };

    return { transactions, summary, loading, createTransaction, updateTransaction, deleteTransaction, refetch: fetch };
}
