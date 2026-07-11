// Shared card primitives — used by both Tiến Lên and Phỏm engines.

const SUITS = ['spades', 'clubs', 'diamonds', 'hearts']; // ♠ ♣ ♦ ♥, low → high (Tiến Lên tie-break order)
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']; // low → high (Tiến Lên order)

function makeDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit, id: `${rank}_${suit}` });
        }
    }
    return deck;
}

// Fisher-Yates using crypto.randomInt so shuffles aren't Math.random-predictable.
function shuffle(deck) {
    const { randomInt } = require('crypto');
    const arr = deck.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randomInt(0, i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const rankValue = (rank) => RANKS.indexOf(rank);
const suitValue = (suit) => SUITS.indexOf(suit);

// Rank first, suit breaks ties — the core Tiến Lên card ordering.
function compareCards(a, b) {
    const r = rankValue(a.rank) - rankValue(b.rank);
    if (r !== 0) return r;
    return suitValue(a.suit) - suitValue(b.suit);
}

function sortHand(hand) {
    return hand.slice().sort(compareCards);
}

module.exports = { SUITS, RANKS, makeDeck, shuffle, rankValue, suitValue, compareCards, sortHand };
