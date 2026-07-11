'use client';
import { useEffect } from 'react';
import { create } from 'zustand';
import { gameMatchesApi } from '@/lib/api';
import { registerStoreReset } from '@/store/useStore';

export type GameType = 'tien_len' | 'phom';

export interface GameMatchPlayer {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
}

export interface GameMatch {
    _id: string;
    gameType: GameType;
    players: GameMatchPlayer[] | string[];
    hostId: GameMatchPlayer | string;
    status: 'pending_invite' | 'active' | 'finished' | 'declined' | 'abandoned';
    turnUserId?: string;
    winnerId?: string;
    settings?: { turnSeconds?: number };
    state?: {
        gameType?: GameType;
        youAre?: string;
        opponents?: { userId: string; handCount: number }[];
        yourHand?: { id: string; rank: string; suit: string }[];
        opponentHandCount?: number;
        turnUserId?: string;
        phase?: 'discard' | 'draw_or_eat' | 'finished';
        stockCount?: number;
        deadwoodScore?: number;
        turnSeconds?: number;
    };
    createdAt: string;
    updatedAt: string;
}

interface GameMatchListStore {
    incomingInvites: GameMatch[];
    sentInvites: GameMatch[];
    activeMatches: GameMatch[];
    loading: boolean;
    hasFetched: boolean;
    error: string | null;
    fetch: (force?: boolean) => Promise<void>;
    reset: () => void;
    invite: (emails: string | string[], gameType: GameType, turnSeconds?: number) => Promise<GameMatch>;
    respond: (id: string, accept: boolean) => Promise<{ data?: GameMatch }>;
    cancel: (id: string) => Promise<void>;
}

export const useGameMatchListStore = create<GameMatchListStore>((set, get) => ({
    incomingInvites: [],
    sentInvites: [],
    activeMatches: [],
    loading: false,
    hasFetched: false,
    error: null,
    reset: () => set({ incomingInvites: [], sentInvites: [], activeMatches: [], loading: false, hasFetched: false, error: null }),
    fetch: async (force = false) => {
        if (get().loading || (get().hasFetched && !force)) return;
        set({ loading: true, error: null });
        try {
            const [incomingRes, sentRes, activeRes] = await Promise.all([
                gameMatchesApi.getIncoming(),
                gameMatchesApi.getSent(),
                gameMatchesApi.getActive(),
            ]);
            set({
                incomingInvites: incomingRes.data?.data || [],
                sentInvites: sentRes.data?.data || [],
                activeMatches: activeRes.data?.data || [],
                hasFetched: true,
                loading: false,
            });
        } catch {
            set({ error: 'Không thể tải danh sách ván đấu', loading: false });
        }
    },
    invite: async (emails: string | string[], gameType: GameType, turnSeconds = 30) => {
        const res = await gameMatchesApi.invite(emails, gameType, turnSeconds);
        return res.data?.data;
    },
    respond: async (id: string, accept: boolean) => {
        const res = await gameMatchesApi.respond(id, accept);
        set({ incomingInvites: get().incomingInvites.filter(i => i._id !== id) });
        await get().fetch(true);
        return res.data;
    },
    cancel: async (id: string) => {
        await gameMatchesApi.cancel(id);
        set({ sentInvites: get().sentInvites.filter(i => i._id !== id) });
    },
}));
registerStoreReset(() => useGameMatchListStore.getState().reset());

export function useGameMatches() {
    const store = useGameMatchListStore();

    useEffect(() => {
        store.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        incomingInvites: store.incomingInvites,
        sentInvites: store.sentInvites,
        activeMatches: store.activeMatches,
        loading: store.loading,
        error: store.error,
        invite: store.invite,
        respond: store.respond,
        cancel: store.cancel,
        refetch: () => store.fetch(true),
    };
}
