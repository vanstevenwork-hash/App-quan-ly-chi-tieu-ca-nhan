'use client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface RankingRow {
    userId: string;
    rank: number;
    cardsLeft: number;
}

interface FinalScore {
    cardsLeft: number;
    heoLeft: number;
    cong: boolean;
    thoiBonus: number;
    score: number;
}

interface EndScreenProps {
    youWon: boolean;
    abandoned?: boolean;
    /** Rounds won so far in this rematch chain — omitted/zero-zero hides the row. */
    myWins?: number;
    opponentWins?: number;
    onRematch?: () => void;
    rematchRequested?: boolean;
    /** Tiến Lên 3-4 player games: full ranking + "tính thối" score breakdown. */
    rankings?: RankingRow[] | null;
    finalScores?: Record<string, FinalScore> | null;
    playerNames?: Record<string, string>;
    myUserId?: string;
}

const RANK_LABEL: Record<number, string> = { 1: 'Nhất', 2: 'Nhì', 3: 'Ba', 4: 'Bét' };

export default function EndScreen({
    youWon, abandoned, myWins = 0, opponentWins = 0, onRematch, rematchRequested,
    rankings, finalScores, playerNames = {}, myUserId,
}: EndScreenProps) {
    const router = useRouter();
    const isMultiplayer = (rankings?.length || 0) > 2;
    const showScore = !abandoned && !isMultiplayer && (myWins > 0 || opponentWins > 0);
    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-6">
            <div className="w-full max-w-sm bg-white dark:bg-surface rounded-3xl p-6 text-center shadow-2xl">
                <div className="text-5xl mb-3">{abandoned ? '🚪' : youWon ? '🏆' : '😅'}</div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
                    {abandoned ? 'Đối thủ đã rời ván đấu' : youWon ? 'Bạn đã thắng!' : 'Bạn đã thua'}
                </h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
                    {abandoned ? 'Ván đấu đã kết thúc' : youWon ? 'Chúc mừng, ván bài kết thúc 🎉' : 'Chơi lại để gỡ nhé!'}
                </p>
                {showScore && (
                    <div className="flex items-center justify-center gap-3 mb-6 text-sm font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400">Bạn {myWins}</span>
                        <span className="text-slate-300 dark:text-slate-600">–</span>
                        <span className="text-slate-500 dark:text-slate-400">{opponentWins} Đối thủ</span>
                    </div>
                )}
                {!abandoned && isMultiplayer && rankings && (
                    <div className="mb-6 rounded-2xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-700/60 text-left overflow-hidden">
                        {rankings.map(row => {
                            const isMe = row.userId === myUserId;
                            const name = isMe ? 'Bạn' : (playerNames[row.userId] || 'Người chơi');
                            const fs = finalScores?.[row.userId];
                            return (
                                <div key={row.userId} className={cn('flex items-center gap-3 px-3 py-2.5', isMe && 'bg-indigo-50/60 dark:bg-indigo-500/10')}>
                                    <span className={cn(
                                        'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                                        row.rank === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                                            : row.rank === rankings.length ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                    )}>
                                        {row.rank}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{name}</p>
                                        <p className="text-[11px] text-slate-400">{RANK_LABEL[row.rank] || `Hạng ${row.rank}`} · {row.cardsLeft} lá</p>
                                    </div>
                                    {fs && fs.score > 0 && (
                                        <span className="text-xs font-bold text-red-500 dark:text-red-400 flex-shrink-0">
                                            +{fs.score}đ{fs.cong ? ' (cóng)' : ''}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="space-y-2.5">
                    {!abandoned && onRematch && (
                        <button
                            onClick={onRematch}
                            disabled={rematchRequested}
                            className={cn(
                                'w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95',
                                rematchRequested
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25'
                            )}
                        >
                            {rematchRequested ? 'Đang gửi yêu cầu…' : 'Chơi tiếp'}
                        </button>
                    )}
                    <button
                        onClick={() => router.push('/games')}
                        className="w-full py-3.5 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-95"
                    >
                        Về trang chơi bài
                    </button>
                    <button
                        onClick={() => router.push('/games/stats')}
                        className="w-full py-2.5 rounded-2xl text-xs font-bold text-slate-400 dark:text-slate-500"
                    >
                        Xem thống kê
                    </button>
                </div>
            </div>
        </div>
    );
}
