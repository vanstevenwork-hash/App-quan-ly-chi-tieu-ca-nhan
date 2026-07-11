const { makeDeck, shuffle, sortHand } = require('../shared/card');

// 2-player "tiến lên tay đôi" variant: full 52-card deck, split evenly (26 each).
function dealTwoHands() {
    const deck = shuffle(makeDeck());
    const hand0 = sortHand(deck.slice(0, 26));
    const hand1 = sortHand(deck.slice(26, 52));
    return [hand0, hand1];
}

module.exports = { dealTwoHands };
