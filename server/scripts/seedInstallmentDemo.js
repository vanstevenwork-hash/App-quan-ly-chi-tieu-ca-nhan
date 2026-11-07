// Seed a demo account with credit cards + installment plans.
// Usage: node scripts/seedInstallmentDemo.js   (login: demo.tragop@test.com / 123456)
// Re-runnable: wipes this account's data first.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Card = require('../models/Card');
const Transaction = require('../models/Transaction');

const EMAIL = 'demo.tragop@test.com';
const monthsAgo = (m, day = 10) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - m, day, 12); };

async function main() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chi_tieu_ca_nhan');
    let user = await User.findOne({ email: EMAIL });
    if (!user) user = await User.create({ name: 'Demo Trả Góp', email: EMAIL, password: '123456' });
    await Transaction.deleteMany({ userId: user._id });
    await Card.deleteMany({ userId: user._id });

    const mk = (bankName, bankShortName, last4, color, extra) => Card.create({
        userId: user._id, bankName, bankShortName, cardType: 'credit', cardNumber: last4,
        cardHolder: 'DEMO TRA GOP', cardNetwork: 'visa', color, creditLimit: 50_000_000,
        statementDay: 5, paymentDueDay: 25, cashbackRate: 1, expirationDate: '08/29', ...extra,
    });
    const [vcb, tcb, vib, mbb, acb] = await Promise.all([
        mk('Vietcombank', 'VCB', '1234', '#0B6E4F', { isDefault: true, statementDay: 5, paymentDueDay: 25, cashbackRate: 1 }),
        mk('Techcombank', 'TCB', '5678', '#D6001C', { statementDay: 18, paymentDueDay: 8, cashbackRate: 2 }),
        mk('VIB', 'VIB', '9012', '#1B4FD8', { statementDay: 28, paymentDueDay: 15, cashbackRate: 0.5 }),
        mk('MB Bank', 'MBB', '3456', '#1D3A8A', { statementDay: 10, paymentDueDay: 30 }),
        mk('ACB', 'ACB', '7788', '#1E40AF', { statementDay: 0, paymentDueDay: 0 }),
    ]);

    // [card, category, note, amount, months, startedMonthsAgo]
    const plans = [
        [vcb, 'Mua sắm', 'iPhone 16 Pro', 36_000_000, 12, 3],
        [vcb, 'Mua sắm', 'Máy giặt LG', 9_000_000, 9, 1],
        [vcb, 'Giải trí', 'Tai nghe Sony', 4_500_000, 3, 1],
        [tcb, 'Mua sắm', 'MacBook Air', 28_800_000, 24, 6],
        [tcb, 'Sức khỏe', 'Niềng răng', 18_000_000, 9, 4],
        [vib, 'Mua sắm', 'Tủ lạnh Samsung', 15_300_000, 6, 2],
        [vib, 'Học tập', 'Khóa học tiếng Anh', 12_000_000, 9, 0],
    ];
    const balance = new Map();
    const docs = [];
    for (const [card, category, note, amount, months, ago] of plans) {
        const date = monthsAgo(ago);
        docs.push({
            userId: user._id, createdBy: user._id, type: 'expense', amount, category, note, date,
            cardId: card._id, paymentMethod: 'card', isInstallment: true,
            installmentMonths: months, installmentMonthly: Math.ceil(amount / months), installmentStartDate: date,
        });
        balance.set(String(card._id), (balance.get(String(card._id)) || 0) + amount);
    }
    // vài chi tiêu thường để dữ liệu trông thật
    const normal = [[vcb, 'Ăn uống', 'Nhà hàng', 850_000, 0], [vcb, 'Di chuyển', 'Grab', 220_000, 0], [tcb, 'Hóa đơn', 'Tiền điện', 1_300_000, 1], [vib, 'Ăn uống', 'Cafe', 95_000, 0], [mbb, 'Mua sắm', 'Siêu thị', 2_400_000, 1]];
    for (const [card, category, note, amount, ago] of normal) {
        docs.push({ userId: user._id, createdBy: user._id, type: 'expense', amount, category, note, date: monthsAgo(ago, 2), cardId: card._id, paymentMethod: 'card' });
        balance.set(String(card._id), (balance.get(String(card._id)) || 0) + amount);
    }
    await Transaction.insertMany(docs);
    for (const c of [vcb, tcb, vib, mbb, acb]) await Card.updateOne({ _id: c._id }, { balance: balance.get(String(c._id)) || 0 });
    console.log(`Seeded ${docs.length} transactions, 5 cards for ${EMAIL} / 123456`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
