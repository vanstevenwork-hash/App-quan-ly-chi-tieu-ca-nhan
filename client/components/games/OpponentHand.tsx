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
        <div className="flex items-center justify-end gap-3 min-w-0">
            <div className="flex -space-x-3 overflow-hidden py-1 pl-1">
                {Array.from({ length: shown }).map((_, i) => (
                    <PlayingCard key={i} rank="" suit="" faceDown size="sm" />
                ))}
            </div>
            <span className="rounded-xl bg-black/20 px-3 py-2 text-sm font-extrabold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] whitespace-nowrap">
                {count} lá
            </span>
        </div>
    );
}
