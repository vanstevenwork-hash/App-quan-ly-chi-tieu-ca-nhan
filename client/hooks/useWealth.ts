'use client';
import { useState, useEffect, useCallback } from 'react';
import { wealthApi } from '@/lib/api';

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

export function useWealth() {
    const [sources, setSources] = useState<WealthSource[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const res = await wealthApi.getAll();
            setSources(res.data.data || []);
            setTotal(res.data.total || 0);
        } catch {
            setError('Không thể tải nguồn tài sản');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const createSource = async (data: WealthFormData) => {
        const res = await wealthApi.create(data);
        await fetch();
        return res.data.data;
    };

    const updateSource = async (id: string, data: Partial<WealthFormData>) => {
        const res = await wealthApi.update(id, data);
        setSources(prev => prev.map(s => s._id === id ? { ...s, ...res.data.data } : s));
        setTotal(prev => {
            const old = sources.find(s => s._id === id);
            return prev - (old?.balance || 0) + (res.data.data.balance || 0);
        });
        return res.data.data;
    };

    const deleteSource = async (id: string) => {
        await wealthApi.delete(id);
        setSources(prev => {
            const removed = prev.find(s => s._id === id);
            setTotal(t => t - (removed?.balance || 0));
            return prev.filter(s => s._id !== id);
        });
    };

    return { sources, total, loading, error, createSource, updateSource, deleteSource, refetch: fetch };
}
