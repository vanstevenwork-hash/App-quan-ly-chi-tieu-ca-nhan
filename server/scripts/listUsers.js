const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

async function list() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chi_tieu_ca_nhan');
        const users = await User.find({}, 'name email');
        console.log('USERS_LIST:', JSON.stringify(users));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

list();
