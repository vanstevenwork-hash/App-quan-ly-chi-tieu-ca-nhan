'use client';
import { useState, useEffect, useCallback } from 'react';
import { cardsApi } from '@/lib/api';

export interface Card {
    _id: string;
    bankName: string;
    bankShortName: string;
    cardType: 'credit' | 'debit' | 'savings' | 'eWallet' | 'crypto';
    cardNumber: string;
    cardHolder: string;
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
    note: string;
}

export interface CardFormData {
    bankName: string;
    bankShortName: string;
    cardType: 'credit' | 'debit' | 'savings' | 'eWallet' | 'crypto';
    cardNumber: string;
    cardHolder: string;
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
    note: string;
}

export function useCards() {
    const [cards, setCards] = useState<Card[]>([]);
    const [totalBalance, setTotalBalance] = useState(0);
    const [totalDebt, setTotalDebt] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const res = await cardsApi.getAll();
            setCards(res.data.data || []);
            setTotalBalance(res.data.totalBalance || 0);
            setTotalDebt(res.data.totalDebt || 0);
        } catch {
            setError('Không thể tải danh sách thẻ');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const createCard = async (data: CardFormData) => {
        const res = await cardsApi.create(data);
        await fetch();
        return res.data.data;
    };

    const updateCard = async (id: string, data: Partial<CardFormData>) => {
        const res = await cardsApi.update(id, data);
        setCards(prev => prev.map(c => c._id === id ? { ...c, ...res.data.data } : c));
        return res.data.data;
    };

    const deleteCard = async (id: string) => {
        await cardsApi.delete(id);
        setCards(prev => prev.filter(c => c._id !== id));
    };

    const setDefaultCard = async (id: string) => {
        await cardsApi.setDefault(id);
        setCards(prev => prev.map(c => ({ ...c, isDefault: c._id === id })));
    };

    return { cards, totalBalance, totalDebt, loading, error, createCard, updateCard, deleteCard, setDefaultCard, refetch: fetch };
}
