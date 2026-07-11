'use client';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { gameMatchesApi } from '@/lib/api';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { cn } from '@/lib/utils';

const GAME_LABELS: Record<string, string> = { tien_len: 'Tiến lên', phom: 'Phỏm' };

interface OpponentStat { userId: string; name: string; played: number; won: number; lost: number; }
interface Stats {
    totalMatches: number;
    wins: number;
    losses: number;
    byGameType: Record<string, { played: number; won: number }>;
    byOpponent: OpponentStat[];
    recentMatches: { _id: string; gameType: string; won: boolean; opponentName: string | null; finishedAt: string }[];
}

interface GameStatsModalProps {
    open: boolean;
    onClose: () => void;
}

// Compact in-match stats popup (dark, matches the table theme) — the full
// page at /games/stats stays as-is for Settings; this one is for a quick
// glance without leaving the table.
export default function GameStatsModal({ open, onClose }: GameStatsModalProps) {
    const [mounted, setMounted] = useState(false);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        gameMatchesApi.getStats()
            .then(res => setStats(res.data?.data || null))
            .catch(() => setStats(null))
            .finally(() => setLoading(false));
    }, [open]);

    if (!mounted || !open) return null;

    const winRate = stats && stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;

    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md max-h-[75vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/12 bg-[#032f34] shadow-[0_25px_60px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">🏆</span>
                        <h2 className="text-base font-black text-white">Thống kê chơi bài</h2>
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70" aria-label="Đóng">
                        <ActionIcon type="x" size={14} tile={false} color="currentColor" />
                    </button>
                </div>
                <div className="overflow-y-auto px-5 pb-8 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="w-7 h-7 border-2 border-white/20 border-t-emerald-300 rounded-full animate-spin" />
                        </div>
                    ) : !stats || stats.totalMatches === 0 ? (
                        <p className="py-10 text-center text-sm text-white/45">Chưa có ván nào hoàn thành</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: 'Trận', value: String(stats.totalMatches), color: 'text-white' },
                                    { label: 'Thắng', value: String(stats.wins), color: 'text-emerald-300' },
                                    { label: 'Thua', value: String(stats.losses), color: 'text-red-300' },
                                    { label: 'Tỷ lệ', value: `${winRate}%`, color: 'text-amber-300' },
                                ].map(item => (
                                    <div key={item.label} className="rounded-2xl border border-white/8 bg-white/5 p-3 text-center">
                                        <p className={cn('text-lg font-black', item.color)}>{item.value}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">{item.label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                                <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-emerald-300/80">Theo loại game</p>
                                {(['tien_len', 'phom'] as const).map(type => {
                                    const s = stats.byGameType[type];
                                    return (
                                        <div key={type} className="flex items-center justify-between py-1.5 text-[13px]">
                                            <span className="font-bold text-white/80">{GAME_LABELS[type]}</span>
                                            <span className="text-white/55">{s.played} trận · <span className="text-emerald-300 font-bold">{s.won} thắng</span></span>
                                        </div>
                                    );
                                })}
                            </div>

                            {stats.byOpponent.length > 0 && (
                                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                                    <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-emerald-300/80">Theo đối thủ</p>
                                    {stats.byOpponent.map(opp => (
                                        <div key={opp.userId} className="flex items-center justify-between py-1.5 text-[13px]">
                                            <span className="font-bold text-white/80 truncate mr-3">{opp.name}</span>
                                            <span className="flex-shrink-0 font-black">
                                                <span className="text-emerald-300">{opp.won}</span>
                                                <span className="text-white/30"> – </span>
                                                <span className="text-red-300">{opp.lost}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
