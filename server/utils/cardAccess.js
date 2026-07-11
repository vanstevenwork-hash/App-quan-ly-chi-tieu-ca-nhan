const Card = require('../models/Card');
const CardShare = require('../models/CardShare');

// Whether `userId` may read/write `cardId` — either as the direct owner, or
// as someone the owner has an accepted CardShare with. Shared by the
// transaction and card-share controllers so the rule lives in one place.
async function hasCardAccess(userId, cardId) {
    const ownCard = await Card.findOne({ _id: cardId, userId, isActive: true });
    if (ownCard) return { allowed: true, card: ownCard, isOwner: true };

    const share = await CardShare.findOne({ cardId, sharedWithUserId: userId, status: 'accepted' });
    if (share) {
        const card = await Card.findOne({ _id: cardId, isActive: true });
        if (card) return { allowed: true, card, isOwner: false };
    }
    return { allowed: false, card: null, isOwner: false };
}

module.exports = { hasCardAccess };
