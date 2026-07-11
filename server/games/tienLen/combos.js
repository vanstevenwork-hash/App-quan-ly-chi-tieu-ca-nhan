const { rankValue, compareCards } = require('../shared/card');

// Classifies a set of cards into a Tiến Lên combo, or returns null if the
// cards don't form any recognized shape. `power` is what canBeat() compares.
function classifyCombo(cards) {
    if (!cards || cards.length === 0) return null;
    const sorted = cards.slice().sort(compareCards);
    const power = sorted[sorted.length - 1]; // highest card decides power for same-type comparisons

    if (sorted.length === 1) return { type: 'single', cards: sorted, power };

    const sameRank = sorted.every(c => c.rank === sorted[0].rank);
    if (sameRank) {
        if (sorted.length === 2) return { type: 'pair', cards: sorted, power };
        if (sorted.length === 3) return { type: 'triple', cards: sorted, power };
        if (sorted.length === 4) return { type: 'quad', cards: sorted, power };
        return null;
    }

    if (sorted.length >= 3) {
        // Straight: strictly consecutive ranks, no duplicates, '2' cannot appear.
        const ranks = sorted.map(c => rankValue(c.rank));
        if (ranks.some(r => r === rankValue('2'))) return null;
        for (let i = 1; i < ranks.length; i++) {
            if (ranks[i] !== ranks[i - 1] + 1) return null;
        }
        const uniqueRanks = new Set(sorted.map(c => c.rank));
        if (uniqueRanks.size !== sorted.length) return null; // one card per rank in a straight
        return { type: 'straight', cards: sorted, power };
    }

    return null;
}

// Can `play` legally be placed on top of `lastPlay`? `lastPlay === null` means
// this player is leading the trick — any valid combo is playable.
function canBeat(play, lastPlay) {
    if (!lastPlay) return true;
    if (play.type === 'quad') {
        // Bomb: beats anything lower-power, regardless of type/length — including a lone "2".
        if (lastPlay.type === 'quad') return rankValue(play.power.rank) > rankValue(lastPlay.power.rank);
        return true;
    }
    if (lastPlay.type === 'quad') return false; // only a higher quad can beat a quad
    if (play.type !== lastPlay.type) return false;
    if (play.cards.length !== lastPlay.cards.length) return false;
    return compareCards(play.power, lastPlay.power) > 0;
}

module.exports = { classifyCombo, canBeat };
