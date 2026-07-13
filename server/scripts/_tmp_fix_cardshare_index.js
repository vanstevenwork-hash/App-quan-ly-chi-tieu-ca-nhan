const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const collection = mongoose.connection.collection('cardshares');

    const indexes = await collection.indexes();
    console.log('Current indexes on cardshares:', indexes.map(i => ({ name: i.name, key: i.key, unique: i.unique })));

    const stale = indexes.find(i => i.name === 'inviteToken_1');
    if (stale) {
        await collection.dropIndex('inviteToken_1');
        console.log('Dropped stale index: inviteToken_1');
    } else {
        console.log('No inviteToken_1 index found (already clean)');
    }

    const after = await collection.indexes();
    console.log('Indexes after cleanup:', after.map(i => ({ name: i.name, key: i.key, unique: i.unique })));

    process.exit(0);
})().catch(err => {
    console.error('FAILED:', err.message);
    process.exit(1);
});
