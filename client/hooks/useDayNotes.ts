'use client';
import { useState, useEffect, useCallback } from 'react';
import { dayNotesApi } from '@/lib/api';

export interface DayImage {
    url: string;
    amount: number; // expense amount for this photo (positive = expense)
    label: string;
}

export interface DayNote {
    _id: string;
    date: string; // YYYY-MM-DD
    images: DayImage[];
    note: string;
}

export function useDayNotes(month: number, year: number) {
    const [notes, setNotes] = useState<DayNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMock, setIsMock] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const res = await dayNotesApi.getByMonth(month + 1, year);
            setNotes(res.data?.data || []);
            setIsMock(false);
        } catch {
            setIsMock(true);
        } finally {
            setLoading(false);
        }
    }, [month, year]);

    useEffect(() => { fetch(); }, [fetch]);

    // Returns a map: { "2026-03-27": DayNote, ... }
    const notesByDate: Record<string, DayNote> = {};
    notes.forEach(n => { notesByDate[n.date] = n; });

    const addImage = async (date: string, imageUrl: string, amount = 0, label = '') => {
        if (isMock) {
            const entry: DayImage = { url: imageUrl, amount, label };
            setNotes(prev => {
                const existing = prev.find(n => n.date === date);
                if (existing) {
                    return prev.map(n => n.date === date ? { ...n, images: [...n.images, entry] } : n);
                }
                return [...prev, { _id: Date.now().toString(), date, images: [entry], note: '' }];
            });
            return;
        }
        try {
            await dayNotesApi.addImage(date, imageUrl, amount, label);
            await fetch();
        } catch (err) {
            throw err;
        }
    };

    const removeImage = async (date: string, imageUrl: string) => {
        if (isMock) {
            setNotes(prev => prev.map(n =>
                n.date === date ? { ...n, images: n.images.filter(i => i.url !== imageUrl) } : n
            ));
            return;
        }
        try {
            await dayNotesApi.removeImage(date, imageUrl);
            await fetch();
        } catch (err) {
            throw err;
        }
    };

    return { notesByDate, loading, refetch: fetch, addImage, removeImage };
}
