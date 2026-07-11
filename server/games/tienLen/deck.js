const { makeDeck, shuffle, sortHand } = require('../shared/card');

// Deals the FULL 52-card deck round-robin — never a fixed 13/player. A fixed
// slice(index*13, index*13+13) only uses playerCount*13 cards, so a 2-player
// match would deal just 26 of 52 and silently discard the rest; if 3♠ (the
// card the opening move is required to contain) fell in the discarded half,
// neither player could ever legally open the match. Round-robin guarantees
// every card is dealt to someone, for any player count (2-4).
function dealHandsByPlayerCount(playerCount) {
    const deck = shuffle(makeDeck());
    const hands = Array.from({ length: playerCount }, () => []);
    deck.forEach((card, i) => hands[i % playerCount].push(card));
    return hands.map(sortHand);
}

module.exports = { dealHandsByPlayerCount };
