'use client';
import { useState, useEffect, useCallback } from 'react';
import { goalsApi } from '@/lib/api';

export interface Goal {
    _id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string;
    category: string;
    icon: string;
    color: string;
    status: 'active' | 'completed' | 'paused';
}

export function useGoals() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const res = await goalsApi.getAll();
            setGoals(res.data.data || []);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const createGoal = async (data: object) => {
        const res = await goalsApi.create(data);
        await fetch();
        return res.data.data;
    };

    const updateGoal = async (id: string, data: object) => {
        const res = await goalsApi.update(id, data);
        setGoals(prev => prev.map(g => g._id === id ? { ...g, ...res.data.data } : g));
        return res.data.data;
    };

    const deleteGoal = async (id: string) => {
        await goalsApi.delete(id);
        setGoals(prev => prev.filter(g => g._id !== id));
    };

    const deposit = async (id: string, amount: number) => {
        await goalsApi.deposit(id, amount);
        await fetch();
    };

    const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
    const completedCount = goals.filter(g => g.status === 'completed' || g.currentAmount >= g.targetAmount).length;

    return { goals, totalSaved, totalTarget, completedCount, loading, createGoal, updateGoal, deleteGoal, deposit, refetch: fetch };
}
