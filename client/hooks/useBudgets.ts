'use client';
import { useState, useEffect, useCallback } from 'react';
import { budgetsApi } from '@/lib/api';

export interface Budget {
    _id: string;
    category: string;
    amount: number;
    spent: number;
    period: 'monthly' | 'weekly' | 'yearly';
    month: number;
    year: number;
    color?: string;
}

export function useBudgets(month?: number, year?: number) {
    const now = new Date();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const res = await budgetsApi.getAll({ month: month ?? now.getMonth() + 1, year: year ?? now.getFullYear() });
            setBudgets(res.data.data || []);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [month, year]);

    useEffect(() => { fetch(); }, [fetch]);

    const createBudget = async (data: object) => {
        const res = await budgetsApi.create(data);
        await fetch();
        return res.data.data;
    };

    const updateBudget = async (id: string, data: object) => {
        const res = await budgetsApi.update(id, data);
        setBudgets(prev => prev.map(b => b._id === id ? { ...b, ...res.data.data } : b));
        return res.data.data;
    };

    const deleteBudget = async (id: string) => {
        await budgetsApi.delete(id);
        setBudgets(prev => prev.filter(b => b._id !== id));
    };

    const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

    return { budgets, totalBudget, totalSpent, loading, createBudget, updateBudget, deleteBudget, refetch: fetch };
}
