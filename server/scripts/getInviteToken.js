const mongoose = require('mongoose');
const CardShare = require('../models/CardShare');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

async function getLatest() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chi_tieu_ca_nhan');
        const latest = await CardShare.findOne({ sharedWithEmail: 'chong@test.com' }).sort({ createdAt: -1 });
        if (latest) {
            console.log('LATEST_TOKEN:', latest.inviteToken);
        } else {
            console.log('NO_TOKEN_FOUND');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

getLatest();
