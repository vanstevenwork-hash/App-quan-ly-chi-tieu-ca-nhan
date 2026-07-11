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
        <div className="flex gap-1.5 overflow-x-auto pb-2 px-1 hide-scrollbar">
            {cards.map(c => (
                <PlayingCard
                    key={c.id}
                    rank={c.rank}
                    suit={c.suit}
                    selected={selectedIds.includes(c.id)}
                    onClick={() => onToggle(c.id)}
                />
            ))}
        </div>
    );
}
