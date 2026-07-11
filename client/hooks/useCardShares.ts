'use client';
import { useEffect } from 'react';
import { create } from 'zustand';
import { cardSharesApi } from '@/lib/api';
import { registerStoreReset } from '@/store/useStore';
import type { Card } from './useCards';

export interface CardShareOwner {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
}

export interface CardShare {
    _id: string;
    cardId: Card | string;
    ownerId: CardShareOwner | string;
    sharedWithUserId?: string | { _id: string; name: string; email: string; avatar?: string };
    sharedWithEmail: string;
    permission: 'collaborative' | 'view-only';
    status: 'pending' | 'accepted' | 'revoked';
    inviteToken: string;
    createdAt: string;
    updatedAt: string;
}

export interface SharedCardItem {
    share: CardShare;
    card: Card;
    owner: CardShareOwner;
}

interface CardShareStore {
    sharedCards: SharedCardItem[];
    loading: boolean;
    hasFetched: boolean;
    error: string | null;
    fetch: (force?: boolean) => Promise<void>;
    reset: () => void;
    invite: (cardId: string, email: string) => Promise<any>;
    accept: (token: string) => Promise<any>;
    revoke: (id: string) => Promise<void>;
    getCardShares: (cardId: string) => Promise<CardShare[]>;
}

export const useCardShareStore = create<CardShareStore>((set, get) => ({
    sharedCards: [],
    loading: false,
    hasFetched: false,
    error: null,
    reset: () => set({ sharedCards: [], loading: false, hasFetched: false, error: null }),
    fetch: async (force = false) => {
        if (get().loading || (get().hasFetched && !force)) return;
        set({ loading: true, error: null });
        try {
            const res = await cardSharesApi.getMyShares();
            const data = res.data?.data || [];
            const items: SharedCardItem[] = data
                .filter((s: any) => s.cardId) // card must exist
                .map((s: any) => ({
                    share: s,
                    card: s.cardId as Card,
                    owner: s.ownerId as CardShareOwner,
                }));
            set({ sharedCards: items, hasFetched: true, loading: false });
        } catch {
            set({ error: 'Không thể tải danh sách thẻ chung', loading: false });
        }
    },
    invite: async (cardId: string, email: string) => {
        const res = await cardSharesApi.invite(cardId, email);
        return res.data?.data;
    },
    accept: async (token: string) => {
        const res = await cardSharesApi.accept(token);
        await get().fetch(true);
        return res.data;
    },
    revoke: async (id: string) => {
        await cardSharesApi.revoke(id);
        set({ sharedCards: get().sharedCards.filter(sc => sc.share._id !== id) });
    },
    getCardShares: async (cardId: string) => {
        const res = await cardSharesApi.getCardShares(cardId);
        return res.data?.data || [];
    },
}));
registerStoreReset(() => useCardShareStore.getState().reset());

export function useCardShares() {
    const store = useCardShareStore();

    useEffect(() => {
        store.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        sharedCards: store.sharedCards,
        loading: store.loading,
        error: store.error,
        invite: store.invite,
        accept: store.accept,
        revoke: store.revoke,
        getCardShares: store.getCardShares,
        refetch: () => store.fetch(true),
    };
}
