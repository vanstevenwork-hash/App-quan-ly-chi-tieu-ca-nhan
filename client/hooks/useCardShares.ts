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
    status: 'pending' | 'accepted' | 'declined' | 'revoked';
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
    incomingInvites: SharedCardItem[];
    loading: boolean;
    hasFetched: boolean;
    error: string | null;
    fetch: (force?: boolean) => Promise<void>;
    reset: () => void;
    invite: (cardId: string, email: string) => Promise<any>;
    respond: (id: string, accept: boolean) => Promise<any>;
    revoke: (id: string) => Promise<void>;
    getCardShares: (cardId: string) => Promise<CardShare[]>;
}

const toItems = (list: any[]): SharedCardItem[] =>
    list
        .filter((s: any) => s.cardId) // card must exist
        .map((s: any) => ({
            share: s,
            card: s.cardId as Card,
            owner: s.ownerId as CardShareOwner,
        }));

export const useCardShareStore = create<CardShareStore>((set, get) => ({
    sharedCards: [],
    incomingInvites: [],
    loading: false,
    hasFetched: false,
    error: null,
    reset: () => set({ sharedCards: [], incomingInvites: [], loading: false, hasFetched: false, error: null }),
    fetch: async (force = false) => {
        if (get().loading || (get().hasFetched && !force)) return;
        set({ loading: true, error: null });
        try {
            const [sharedRes, incomingRes] = await Promise.all([
                cardSharesApi.getMyShares(),
                cardSharesApi.getIncoming(),
            ]);
            set({
                sharedCards: toItems(sharedRes.data?.data || []),
                incomingInvites: toItems(incomingRes.data?.data || []),
                hasFetched: true,
                loading: false,
            });
        } catch {
            set({ error: 'Không thể tải danh sách thẻ chung', loading: false });
        }
    },
    invite: async (cardId: string, email: string) => {
        const res = await cardSharesApi.invite(cardId, email);
        return res.data?.data;
    },
    respond: async (id: string, accept: boolean) => {
        const res = await cardSharesApi.respond(id, accept);
        // Drop it from incoming immediately; re-fetch to pick up the newly accepted card
        set({ incomingInvites: get().incomingInvites.filter(i => i.share._id !== id) });
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
        incomingInvites: store.incomingInvites,
        loading: store.loading,
        error: store.error,
        invite: store.invite,
        respond: store.respond,
        revoke: store.revoke,
        getCardShares: store.getCardShares,
        refetch: () => store.fetch(true),
    };
}
