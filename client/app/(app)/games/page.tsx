'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { useGameMatches, type GameMatch, type GameMatchPlayer } from '@/hooks/useGameMatches';
import GameInviteModal from '@/components/games/GameInviteModal';
import InviteCard from '@/components/InviteCard';
import { useAuthStore } from '@/store/useStore';
import { toast } from 'sonner';

const GAME_LABELS: Record<string, string> = { tien_len: 'Tiến lên miền Nam', phom: 'Phỏm' };

export default function GamesLobbyPage() {
    const router = useRouter();
    const { incomingInvites, activeMatches, respond, refetch, loading } = useGameMatches();
    const { user } = useAuthStore();
    const [inviteOpen, setInviteOpen] = useState(false);

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep transition-colors duration-200">
            <PageHeader title="Chơi bài" subtitle="Với vợ/chồng" backHref="/settings" />

            <div className="px-5 pt-2 space-y-5">
                <button
                    onClick={() => setInviteOpen(true)}
                    className="w-full rounded-[20px] p-5 flex items-center gap-4 bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all"
                >
                    <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl flex-shrink-0">
                        🃏
                    </div>
                    <div className="flex-1 text-left">
                        <p className="text-base font-bold">Mời chơi bài</p>
                        <p className="text-xs text-white/70 mt-0.5">Tiến lên miền Nam · Phỏm</p>
                    </div>
                </button>

                {incomingInvites.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white px-1 mb-2.5">Lời mời đến</h3>
                        <div className="space-y-2.5">
                            {incomingInvites.map(item => {
                                const host = typeof item.hostId === 'object' ? item.hostId : null;
                                return (
                                    <InviteCard
                                        key={item._id}
                                        icon={<span className="text-lg leading-none">🃏</span>}
                                        iconBg="bg-purple-50 dark:bg-purple-500/15"
                                        title={`${host?.name || 'Ai đó'} mời chơi bài`}
                                        sub={GAME_LABELS[item.gameType] || item.gameType}
                                        onAccept={async () => {
                                            const res = await respond(item._id, true);
                                            toast.success('Đã chấp nhận, vào chơi thôi!');
                                            router.push(`/games/${res?.data?._id || item._id}`);
                                        }}
                                        onDecline={async () => { await respond(item._id, false); toast.success('Đã từ chối lời mời'); }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white px-1 mb-2.5">Ván đang chơi</h3>
                    {loading ? (
                        <div className="h-20 rounded-2xl bg-gray-200 dark:bg-surface animate-pulse" />
                    ) : activeMatches.length === 0 ? (
                        <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 p-6 text-center">
                            <p className="text-sm text-slate-400">Chưa có ván nào đang chơi</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {activeMatches.map((match: GameMatch) => {
                                const players = match.players as GameMatchPlayer[];
                                const opponent = players.find(p => p._id !== user?._id);
                                return (
                                    <button
                                        key={match._id}
                                        onClick={() => router.push(`/games/${match._id}`)}
                                        className="w-full flex items-center gap-3.5 p-4 rounded-[20px] bg-white dark:bg-surface border border-gray-100 dark:border-slate-700 shadow-sm text-left active:scale-[0.99] transition-all"
                                    >
                                        <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-xl flex-shrink-0">
                                            🃏
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                                {GAME_LABELS[match.gameType] || match.gameType}
                                            </p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                {opponent ? `Với ${opponent.name} — bấm để tiếp tục` : 'Đang chơi — bấm để tiếp tục'}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <GameInviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={refetch} />
        </div>
    );
}
