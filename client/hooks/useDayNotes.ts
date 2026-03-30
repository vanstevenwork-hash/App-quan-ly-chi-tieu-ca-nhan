'use client';
import { useState, useEffect, useCallback } from 'react';
import { dayNotesApi } from '@/lib/api';

export interface DayNote {
    _id: string;
    date: string; // YYYY-MM-DD
    images: string[];
    note: string;
}

export function useDayNotes(month: number, year: number) {
    const [notes, setNotes] = useState<DayNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMock, setIsMock] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const res = await dayNotesApi.getByMonth(month + 1, year); // month is 0-indexed
            setNotes(res.data?.data || []);
            setIsMock(false);
        } catch {
            // Demo mode — ignore errors and keep current mock notes
            setIsMock(true);
        } finally {
            setLoading(false);
        }
    }, [month, year]);

    useEffect(() => { fetch(); }, [fetch]);

    // Returns a map: { "2026-03-27": DayNote, ... }
    const notesByDate: Record<string, DayNote> = {};
    notes.forEach(n => { notesByDate[n.date] = n; });

    const addImage = async (date: string, imageUrl: string) => {
        if (isMock) {
            setNotes(prev => {
                const existing = prev.find(n => n.date === date);
                if (existing) {
                    return prev.map(n => n.date === date ? { ...n, images: [...n.images, imageUrl] } : n);
                }
                return [...prev, { _id: Date.now().toString(), date, images: [imageUrl], note: '' }];
            });
            return;
        }
        try {
            await dayNotesApi.addImage(date, imageUrl);
            await fetch();
        } catch (err) {
            throw err;
        }
    };

    const removeImage = async (date: string, imageUrl: string) => {
        if (isMock) {
            setNotes(prev => prev.map(n => n.date === date ? { ...n, images: n.images.filter(i => i !== imageUrl) } : n));
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
