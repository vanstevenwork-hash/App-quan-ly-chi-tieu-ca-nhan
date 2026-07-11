'use client';
import PlayingCard from './PlayingCard';

interface OpponentHandProps {
    count: number;
}

// Renders only a count of face-down cards — the server never sends the
// opponent's actual hand (see toPlayerView redaction on the engine side).
export default function OpponentHand({ count }: OpponentHandProps) {
    const shown = Math.min(count, 13);
    return (
        <div className="flex items-center gap-2">
            <div className="flex -space-x-6">
                {Array.from({ length: shown }).map((_, i) => (
                    <PlayingCard key={i} rank="" suit="" faceDown size="sm" />
                ))}
            </div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{count} lá</span>
        </div>
    );
}
