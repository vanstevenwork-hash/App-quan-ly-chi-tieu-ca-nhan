const mongoose = require('mongoose');
const User = require('../models/User');
const Card = require('../models/Card');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

async function setup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chi_tieu_ca_nhan');
        
        // Helper to upsert user
        const upsertUser = async (name, email, password) => {
            let user = await User.findOne({ email });
            if (user) {
                user.name = name;
                user.password = password; // pre-save hook will hash it
                await user.save();
                console.log(`Updated user: ${email}`);
            } else {
                user = await User.create({ name, email, password });
                console.log(`Created user: ${email}`);
            }
            return user;
        };

        const vo = await upsertUser('Vợ (Chủ thẻ)', 'vo@test.com', '123456');
        const chong = await upsertUser('Chồng (Được mời)', 'chong@test.com', '123456');

        // Create a card for the wife if she doesn't have one
        const cardCount = await Card.countDocuments({ userId: vo._id, isActive: true });
        if (cardCount === 0) {
            await Card.create({
                userId: vo._id,
                bankName: 'Vietcombank',
                bankShortName: 'VCB',
                cardType: 'credit',
                cardNumber: '9999',
                cardHolder: 'VO THI CHU THE',
                balance: 5000000,
                creditLimit: 20000000,
                color: '#6C63FF',
                isActive: true,
                isDefault: true
            });
            console.log('Created a Vietcombank credit card for Vợ');
        }

        console.log('Setup completed successfully! You can now log in with vo@test.com / 123456 and chong@test.com / 123456');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

setup();
