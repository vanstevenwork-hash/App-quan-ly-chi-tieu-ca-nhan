const { randomInt } = require('crypto');
const { makeDeck, shuffle, sortHand } = require('../shared/card');

const THREE_SPADES_ID = '3_spades';

// Fixed 13 cards per player (matches the standard deal everyone expects —
// for 2 players that leaves 26 cards undealt/unused, same as a real deck).
// The one thing we must never allow: 3♠ landing in the UNDEALT remainder,
// because the opening move is required to contain it — if nobody was dealt
// it, the match soft-locks with neither player able to legally open. So if
// the shuffle puts it outside the dealt range, swap it into a random dealt
// slot. This barely perturbs the shuffle (a single swap) and only ever
// triggers when 3♠ would otherwise be unreachable.
function dealHandsByPlayerCount(playerCount) {
    const deck = shuffle(makeDeck());
    const dealtCount = playerCount * 13;

    const threeSpadesIndex = deck.findIndex(c => c.id === THREE_SPADES_ID);
    if (threeSpadesIndex >= dealtCount) {
        const swapIndex = randomInt(0, dealtCount);
        [deck[threeSpadesIndex], deck[swapIndex]] = [deck[swapIndex], deck[threeSpadesIndex]];
    }

    return Array.from({ length: playerCount }, (_, index) => sortHand(deck.slice(index * 13, index * 13 + 13)));
}

module.exports = { dealHandsByPlayerCount };
