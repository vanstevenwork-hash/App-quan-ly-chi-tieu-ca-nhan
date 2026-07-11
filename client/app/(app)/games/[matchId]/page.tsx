'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { gameMatchesApi } from '@/lib/api';
import { useGameMatchStore } from '@/hooks/useGameMatchStore';
import Hand from '@/components/games/Hand';
import OpponentHand from '@/components/games/OpponentHand';
import LastPlayDisplay from '@/components/games/LastPlayDisplay';
import TurnIndicator from '@/components/games/TurnIndicator';
import GameActions from '@/components/games/GameActions';
import EndScreen from '@/components/games/EndScreen';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { toast } from 'sonner';

export default function GameMatchPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.matchId as string;

    const [loadError, setLoadError] = useState<string | null>(null);
    const [opponentName, setOpponentName] = useState('đối thủ');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const { connect, disconnect, matchState, matchEnded, connectionStatus, errorMessage, clearError, playCombo, pass } = useGameMatchStore();

    useEffect(() => {
        if (!matchId) return;
        gameMatchesApi.getById(matchId)
            .then(res => {
                const match = res.data?.data;
                if (match?.status === 'pending_invite') {
                    setLoadError('Ván đấu chưa bắt đầu — chờ đối thủ chấp nhận lời mời');
                    return;
                }
                const players = (match?.players || []).filter((p: any) => typeof p === 'object');
                const opp = players.find((p: any) => p._id !== match?.state?.youAre);
                if (opp) setOpponentName(opp.name);
                connect(matchId);
            })
            .catch(err => setLoadError(err.response?.data?.message || 'Không thể tải ván đấu'));

        return () => disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchId]);

    useEffect(() => {
        if (errorMessage) {
            toast.error(errorMessage);
            clearError();
        }
    }, [errorMessage, clearError]);

    useEffect(() => { setSelectedIds([]); }, [matchState?.turnUserId, matchState?.lastPlayBy]);

    const isYourTurn = matchState?.turnUserId === matchState?.youAre;
    const canPass = isYourTurn && !!matchState?.lastPlay;
    const canPlay = isYourTurn && selectedIds.length > 0;

    const handleToggle = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handlePlay = () => {
        if (selectedIds.length === 0) return;
        playCombo(selectedIds);
        setSelectedIds([]);
    };

    if (loadError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm text-slate-400">{loadError}</p>
                <button onClick={() => router.push('/games')} className="text-sm font-bold text-indigo-600">Quay lại</button>
            </div>
        );
    }

    if (!matchState || connectionStatus === 'connecting') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-800 to-emerald-950">
            <div className="flex items-center justify-between px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
                <button onClick={() => router.push('/games')} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
                    <ActionIcon type="arrowLeft" size={18} tile={false} color="#fff" />
                </button>
                <span className="text-white/80 text-xs font-bold">Tiến lên miền Nam</span>
                <div className="w-9" />
            </div>

            {/* Opponent */}
            <div className="flex items-center justify-between px-5 mt-4">
                <span className="text-white/70 text-xs font-semibold">{opponentName}</span>
                <OpponentHand count={matchState.opponentHandCount} />
            </div>

            {/* Center table */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
                <LastPlayDisplay lastPlay={matchState.lastPlay} isYourLead={isYourTurn && !matchState.lastPlay} />
                <TurnIndicator isYourTurn={isYourTurn} opponentName={opponentName} />
            </div>

            {/* Your hand */}
            <div className="bg-white dark:bg-surface rounded-t-3xl pt-3">
                <div className="flex items-center justify-between px-4 mb-1">
                    <span className="text-xs font-bold text-slate-400">Bài của bạn ({matchState.yourHand.length})</span>
                    {selectedIds.length > 0 && (
                        <button onClick={() => setSelectedIds([])} className="text-xs font-bold text-indigo-600">Bỏ chọn</button>
                    )}
                </div>
                <Hand cards={matchState.yourHand} selectedIds={selectedIds} onToggle={handleToggle} />
                <GameActions canPlay={canPlay} canPass={canPass} isYourTurn={isYourTurn} onPlay={handlePlay} onPass={pass} />
            </div>

            {matchEnded && <EndScreen youWon={matchEnded.winnerId === matchState.youAre} />}
        </div>
    );
}
