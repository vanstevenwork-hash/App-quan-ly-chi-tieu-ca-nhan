'use client';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { gameMatchesApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const GAME_LABELS: Record<string, string> = { tien_len: 'Tiến lên miền Nam', phom: 'Phỏm' };

interface GameTypeStat { played: number; won: number; }
interface OpponentStat { userId: string; name: string; avatar?: string; played: number; won: number; lost: number; }
interface RecentMatch { _id: string; gameType: string; won: boolean; opponentName: string | null; finishedAt: string; }
interface Stats {
    totalMatches: number;
    wins: number;
    losses: number;
    byGameType: Record<string, GameTypeStat>;
    byOpponent: OpponentStat[];
    recentMatches: RecentMatch[];
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function GameStatsPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        gameMatchesApi.getStats()
            .then(res => setStats(res.data?.data || null))
            .finally(() => setLoading(false));
    }, []);

    const winRate = stats && stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep transition-colors duration-200">
            <PageHeader title="Thống kê chơi bài" subtitle="Tiến lên · Phỏm" backHref="/games" />

            <div className="px-5 pt-2 space-y-5">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-200 dark:bg-surface animate-pulse" />)}
                    </div>
                ) : !stats || stats.totalMatches === 0 ? (
                    <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 p-8 text-center">
                        <div className="text-4xl mb-3">🃏</div>
                        <p className="text-sm text-slate-400">Chưa có ván nào hoàn thành</p>
                    </div>
                ) : (
                    <>
                        {/* Hero: overall record */}
                        <div className="rounded-[20px] p-5 bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
                            <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">Tổng số trận</p>
                            <p className="text-3xl font-bold mb-3">{stats.totalMatches}</p>
                            <div className="flex items-center gap-4">
                                <div>
                                    <p className="text-xs text-white/70">Thắng</p>
                                    <p className="text-lg font-bold text-emerald-300">{stats.wins}</p>
                                </div>
                                <div className="w-px h-8 bg-white/20" />
                                <div>
                                    <p className="text-xs text-white/70">Thua</p>
                                    <p className="text-lg font-bold text-red-300">{stats.losses}</p>
                                </div>
                                <div className="w-px h-8 bg-white/20" />
                                <div>
                                    <p className="text-xs text-white/70">Tỷ lệ thắng</p>
                                    <p className="text-lg font-bold">{winRate}%</p>
                                </div>
                            </div>
                        </div>

                        {/* By game type */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white px-1 mb-2.5">Theo loại game</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {(['tien_len', 'phom'] as const).map(type => {
                                    const s = stats.byGameType[type];
                                    const rate = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0;
                                    return (
                                        <div key={type} className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 p-4">
                                            <p className="text-xs font-semibold text-slate-400 mb-1">{GAME_LABELS[type]}</p>
                                            <p className="text-xl font-bold text-slate-800 dark:text-white">{s.played} <span className="text-xs font-medium text-slate-400">trận</span></p>
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">{s.won} thắng · {rate}%</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* By opponent */}
                        {stats.byOpponent.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white px-1 mb-2.5">Theo đối thủ</h3>
                                <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-700/60">
                                    {stats.byOpponent.map(opp => (
                                        <div key={opp.userId} className="flex items-center gap-3 px-4 py-3.5">
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-300 flex-shrink-0">
                                                {opp.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{opp.name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{opp.played} trận</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-bold">
                                                    <span className="text-emerald-600 dark:text-emerald-400">{opp.won}</span>
                                                    <span className="text-slate-300 dark:text-slate-600"> – </span>
                                                    <span className="text-red-500 dark:text-red-400">{opp.lost}</span>
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recent matches */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white px-1 mb-2.5">Lịch sử gần đây</h3>
                            <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-700/60">
                                {stats.recentMatches.map(match => (
                                    <div key={match._id} className="flex items-center gap-3 px-4 py-3.5">
                                        <div className={cn(
                                            'w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0',
                                            match.won ? 'bg-emerald-50 dark:bg-emerald-500/15' : 'bg-red-50 dark:bg-red-500/15'
                                        )}>
                                            {match.won ? '🏆' : '😅'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                                {GAME_LABELS[match.gameType] || match.gameType} · {match.opponentName || 'Đối thủ'}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">{fmtDate(match.finishedAt)}</p>
                                        </div>
                                        <span className={cn('text-xs font-bold px-2 py-1 rounded-full flex-shrink-0', match.won ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400')}>
                                            {match.won ? 'Thắng' : 'Thua'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
