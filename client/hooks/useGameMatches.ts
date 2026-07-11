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
    createdAt: string;
    updatedAt: string;
}

interface GameMatchListStore {
    incomingInvites: GameMatch[];
    activeMatches: GameMatch[];
    loading: boolean;
    hasFetched: boolean;
    error: string | null;
    fetch: (force?: boolean) => Promise<void>;
    reset: () => void;
    invite: (email: string, gameType: GameType) => Promise<GameMatch>;
    respond: (id: string, accept: boolean) => Promise<any>;
}

export const useGameMatchListStore = create<GameMatchListStore>((set, get) => ({
    incomingInvites: [],
    activeMatches: [],
    loading: false,
    hasFetched: false,
    error: null,
    reset: () => set({ incomingInvites: [], activeMatches: [], loading: false, hasFetched: false, error: null }),
    fetch: async (force = false) => {
        if (get().loading || (get().hasFetched && !force)) return;
        set({ loading: true, error: null });
        try {
            const [incomingRes, activeRes] = await Promise.all([
                gameMatchesApi.getIncoming(),
                gameMatchesApi.getActive(),
            ]);
            set({
                incomingInvites: incomingRes.data?.data || [],
                activeMatches: activeRes.data?.data || [],
                hasFetched: true,
                loading: false,
            });
        } catch {
            set({ error: 'Không thể tải danh sách ván đấu', loading: false });
        }
    },
    invite: async (email: string, gameType: GameType) => {
        const res = await gameMatchesApi.invite(email, gameType);
        return res.data?.data;
    },
    respond: async (id: string, accept: boolean) => {
        const res = await gameMatchesApi.respond(id, accept);
        set({ incomingInvites: get().incomingInvites.filter(i => i._id !== id) });
        await get().fetch(true);
        return res.data;
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
        activeMatches: store.activeMatches,
        loading: store.loading,
        error: store.error,
        invite: store.invite,
        respond: store.respond,
        refetch: () => store.fetch(true),
    };
}
