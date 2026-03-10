'use client';
import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { goalsApi } from '@/lib/api';
import { registerStoreReset } from '@/store/useStore';

export interface Contribution {
    _id: string;
    amount: number;
    type: 'deposit' | 'withdraw';
    note: string;
    date: string;
}

export interface Goal {
    _id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    deadline?: string;
    icon: string;
    color: string;
    category: string;
    description: string;
    status: 'active' | 'completed' | 'paused';
    progress: number;
    contributions: Contribution[];
    autoSaveAmount?: number;
    autoSaveFrequency?: 'daily' | 'weekly' | 'monthly' | '';
    completedAt?: string;
    createdAt: string;
}

export interface GoalFormData {
    name: string;
    targetAmount: number;
    deadline?: string;
    icon: string;
    color: string;
    category: string;
    description: string;
    autoSaveAmount?: number;
    autoSaveFrequency?: string;
}

interface GoalStore {
    goals: Goal[];
    loading: boolean;
    hasFetched: boolean;
    fetch: (force?: boolean) => Promise<void>;
    reset: () => void;
    createGoal: (data: GoalFormData) => Promise<Goal>;
    updateGoal: (id: string, data: Partial<GoalFormData>) => Promise<Goal>;
    deleteGoal: (id: string) => Promise<void>;
    deposit: (id: string, amount: number, note?: string) => Promise<Goal>;
    withdraw: (id: string, amount: number, note?: string) => Promise<Goal>;
}

export const useGoalStore = create<GoalStore>((set, get) => ({
    goals: [],
    loading: false,
    hasFetched: false,
    reset: () => set({ goals: [], loading: false, hasFetched: false }),
    fetch: async (force = false) => {
        if (get().loading || (get().hasFetched && !force)) return;
        set({ loading: true });
        try {
            const res = await goalsApi.getAll();
            set({ goals: res.data?.data || [], hasFetched: true, loading: false });
        } catch {
            set({ loading: false });
        }
    },
    createGoal: async (data) => {
        const res = await goalsApi.create(data);
        const goal = res.data?.data as Goal;
        set({ goals: [goal, ...get().goals] });
        return goal;
    },
    updateGoal: async (id, data) => {
        const res = await goalsApi.update(id, data);
        const updated = res.data?.data as Goal;
        set({ goals: get().goals.map(g => g._id === id ? updated : g) });
        return updated;
    },
    deleteGoal: async (id) => {
        await goalsApi.delete(id);
        set({ goals: get().goals.filter(g => g._id !== id) });
    },
    deposit: async (id, amount, note) => {
        const res = await goalsApi.deposit(id, amount, note);
        const updated = res.data?.data as Goal;
        set({ goals: get().goals.map(g => g._id === id ? updated : g) });
        return updated;
    },
    withdraw: async (id, amount, note) => {
        const res = await goalsApi.withdraw(id, amount, note);
        const updated = res.data?.data as Goal;
        set({ goals: get().goals.map(g => g._id === id ? updated : g) });
        return updated;
    },
}));

registerStoreReset(() => useGoalStore.getState().reset());

export function useGoals() {
    const store = useGoalStore();

    useEffect(() => {
        store.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        goals: store.goals,
        loading: store.loading,
        createGoal: store.createGoal,
        updateGoal: store.updateGoal,
        deleteGoal: store.deleteGoal,
        deposit: store.deposit,
        withdraw: store.withdraw,
        refetch: () => store.fetch(true),
    };
}
