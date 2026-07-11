const { makeDeck, shuffle, sortHand } = require('../shared/card');

function dealHandsByPlayerCount(playerCount) {
    const deck = shuffle(makeDeck());
    return Array.from({ length: playerCount }, (_, index) => sortHand(deck.slice(index * 13, index * 13 + 13)));
}

module.exports = { dealHandsByPlayerCount };
