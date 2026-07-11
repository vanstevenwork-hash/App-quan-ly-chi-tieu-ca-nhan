'use client';
import PlayingCard from './PlayingCard';
import type { CardId } from '@/hooks/useGameMatchStore';

interface HandProps {
    cards: CardId[];
    selectedIds: string[];
    onToggle: (id: string) => void;
}

export default function Hand({ cards, selectedIds, onToggle }: HandProps) {
    return (
        <div className="flex overflow-x-auto hide-scrollbar px-3 pb-3 pt-1">
            {cards.map(c => (
                <PlayingCard
                    key={c.id}
                    rank={c.rank}
                    suit={c.suit}
                    selected={selectedIds.includes(c.id)}
                    onClick={() => onToggle(c.id)}
                    size="lg"
                    className="-mr-2 last:mr-0"
                />
            ))}
        </div>
    );
}
