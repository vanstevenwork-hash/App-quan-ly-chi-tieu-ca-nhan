'use client';
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/api';
import { registerStoreReset } from '@/store/useStore';
import type { GameType } from './useGameMatches';

export interface CardId {
    id: string;
    rank: string;
    suit: string;
}

export interface LastPlay {
    type: 'single' | 'pair' | 'triple' | 'straight' | 'quad' | 'three_pair_run' | 'four_pair_run' | 'discard';
    cards: CardId[];
}

export interface MatchStateView {
    gameType: GameType;
    youAre: string;
    opponentId: string | null;
    opponents?: { userId: string; handCount: number }[];
    yourHand: CardId[];
    opponentHandCount: number;
    lastPlay: LastPlay | null;
    lastPlayBy: string | null;
    turnUserId: string;
    isFirstMove: boolean;
    winnerId: string | null;
    turnSeconds?: number;
    turnExpiresAt: string | null;
    phase?: 'discard' | 'draw_or_eat' | 'finished';
    stockCount?: number;
    discardCount?: number;
    lastDiscard?: CardId | null;
    canEatLastDiscard?: boolean;
    deadwoodScore?: number;
    melds?: CardId[][];
    scores?: Record<string, number> | null;
}

export interface GameChatMessage {
    id: string;
    matchId: string;
    byUserId: string;
    byName: string;
    text: string;
    kind: 'text' | 'emoji';
    at: string;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface GameMatchStore {
    socket: Socket | null;
    matchId: string | null;
    connectionStatus: ConnectionStatus;
    matchState: MatchStateView | null;
    matchEnded: { winnerId: string | null; reason?: 'normal' | 'abandoned'; byUserId?: string } | null;
    chatMessages: GameChatMessage[];
    errorMessage: string | null;
    connect: (matchId: string) => void;
    disconnect: () => void;
    playCombo: (cards: string[]) => void;
    pass: () => void;
    drawStock: () => void;
    eatDiscard: () => void;
    sendChat: (text: string, kind?: 'text' | 'emoji') => void;
    clearError: () => void;
}

export const useGameMatchStore = create<GameMatchStore>((set, get) => ({
    socket: null,
    matchId: null,
    connectionStatus: 'idle',
    matchState: null,
    matchEnded: null,
    chatMessages: [],
    errorMessage: null,

    connect: (matchId: string) => {
        if (get().socket && get().matchId === matchId) return; // already connected to this match
        get().disconnect();

        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const socket = io(`${SOCKET_URL}/games`, {
            auth: { token },
            transports: ['websocket', 'polling'],
        });

        set({ socket, matchId, connectionStatus: 'connecting', matchState: null, matchEnded: null, chatMessages: [], errorMessage: null });

        socket.on('connect', () => {
            set({ connectionStatus: 'connected' });
            socket.emit('match:join', { matchId });
        });
        socket.on('connect_error', () => set({ connectionStatus: 'error' }));
        socket.on('match:state', (state: MatchStateView) => set({ matchState: state }));
        socket.on('match:error', ({ message }: { message: string }) => set({ errorMessage: message }));
        socket.on('match:ended', (payload: { winnerId: string | null; reason?: 'normal' | 'abandoned'; byUserId?: string }) => set({ matchEnded: payload }));
        socket.on('game:chat', (message: GameChatMessage) => {
            set(state => ({ chatMessages: [...state.chatMessages, message].slice(-40) }));
        });
    },

    disconnect: () => {
        const { socket, matchId } = get();
        if (socket) {
            if (matchId) socket.emit('match:leave', { matchId });
            socket.removeAllListeners();
            socket.disconnect();
        }
        set({ socket: null, matchId: null, connectionStatus: 'idle', matchState: null, matchEnded: null, chatMessages: [], errorMessage: null });
    },

    playCombo: (cards: string[]) => {
        const { socket, matchId } = get();
        if (!socket || !matchId) return;
        socket.emit('game:move', { matchId, move: { type: 'play', cards } });
    },

    pass: () => {
        const { socket, matchId } = get();
        if (!socket || !matchId) return;
        socket.emit('game:move', { matchId, move: { type: 'pass' } });
    },

    drawStock: () => {
        const { socket, matchId } = get();
        if (!socket || !matchId) return;
        socket.emit('game:move', { matchId, move: { type: 'draw' } });
    },

    eatDiscard: () => {
        const { socket, matchId } = get();
        if (!socket || !matchId) return;
        socket.emit('game:move', { matchId, move: { type: 'eat' } });
    },

    sendChat: (text: string, kind = 'text') => {
        const { socket, matchId } = get();
        const trimmed = text.trim();
        if (!socket || !matchId || !trimmed) return;
        socket.emit('game:chat', { matchId, text: trimmed, kind });
    },

    clearError: () => set({ errorMessage: null }),
}));

registerStoreReset(() => useGameMatchStore.getState().disconnect());
