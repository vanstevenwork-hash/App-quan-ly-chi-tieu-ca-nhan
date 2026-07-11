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

    if (sorted.length === 6 || sorted.length === 8) {
        const pairs = [];
        for (let i = 0; i < sorted.length; i += 2) {
            const a = sorted[i];
            const b = sorted[i + 1];
            if (!b || a.rank !== b.rank) return null;
            if (rankValue(a.rank) === rankValue('2')) return null;
            pairs.push([a, b]);
        }

        for (let i = 1; i < pairs.length; i++) {
            if (rankValue(pairs[i][0].rank) !== rankValue(pairs[i - 1][0].rank) + 1) return null;
        }

        return {
            type: sorted.length === 6 ? 'three_pair_run' : 'four_pair_run',
            cards: sorted,
            power,
        };
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

function isSingleTwo(play) {
    return play.type === 'single' && play.power.rank === '2';
}

function isPairTwos(play) {
    return play.type === 'pair' && play.cards.every(c => c.rank === '2');
}

// Can `play` legally be placed on top of `lastPlay`? `lastPlay === null` means
// this player is leading the trick — any valid combo is playable.
function canBeat(play, lastPlay) {
    if (!lastPlay) return true;

    if (play.type === 'four_pair_run') {
        if (lastPlay.type === 'four_pair_run') return compareCards(play.power, lastPlay.power) > 0;
        return isSingleTwo(lastPlay) || isPairTwos(lastPlay) || lastPlay.type === 'quad' || lastPlay.type === 'three_pair_run';
    }

    if (play.type === 'three_pair_run') {
        if (lastPlay.type === 'three_pair_run') return compareCards(play.power, lastPlay.power) > 0;
        return isSingleTwo(lastPlay);
    }

    if (play.type === 'quad') {
        if (lastPlay.type === 'quad') return rankValue(play.power.rank) > rankValue(lastPlay.power.rank);
        return isSingleTwo(lastPlay) || isPairTwos(lastPlay);
    }
    if (lastPlay.type === 'quad' || lastPlay.type === 'three_pair_run' || lastPlay.type === 'four_pair_run') return false;
    if (play.type !== lastPlay.type) return false;
    if (play.cards.length !== lastPlay.cards.length) return false;
    return compareCards(play.power, lastPlay.power) > 0;
}

module.exports = { classifyCombo, canBeat };
