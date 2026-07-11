'use client';
import { cn } from '@/lib/utils';

interface GameActionsProps {
    canPlay: boolean;
    canPass: boolean;
    isYourTurn: boolean;
    onPlay: () => void;
    onPass: () => void;
}

export default function GameActions({ canPlay, canPass, isYourTurn, onPlay, onPass }: GameActionsProps) {
    return (
        <div className="flex gap-2.5 px-4 pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
            <button
                onClick={onPass}
                disabled={!isYourTurn || !canPass}
                className={cn(
                    'flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95',
                    !isYourTurn || !canPass
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                )}
            >
                Bỏ lượt
            </button>
            <button
                onClick={onPlay}
                disabled={!isYourTurn || !canPlay}
                className={cn(
                    'flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95',
                    !isYourTurn || !canPlay
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
                )}
            >
                Đánh bài
            </button>
        </div>
    );
}
