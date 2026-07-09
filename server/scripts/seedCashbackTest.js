// Seed fake data for cashback testing into the test@email.com account.
// Usage: node scripts/seedCashbackTest.js
// Re-runnable: wipes previously seeded cards/transactions/cashback records
// of this user (marked via note/bank names below) before inserting again.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Card = require('../models/Card');
const Transaction = require('../models/Transaction');
const CashbackRecord = require('../models/CashbackRecord');

const SEED_TAG = '[seed-cashback]';

async function main() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chi_tieu_ca_nhan');
    console.log('Connected:', mongoose.connection.name);

    // ── User ────────────────────────────────────────────────────────
    let user = await User.findOne({ email: 'test@email.com' });
    if (!user) {
        user = await User.create({ name: 'Test User', email: 'test@email.com', password: '123456' });
        console.log('Created user test@email.com / 123456');
    } else {
        console.log('Found user test@email.com');
    }

    // ── Clean previous seed run ─────────────────────────────────────
    const oldCards = await Card.find({ userId: user._id, note: SEED_TAG });
    const oldCardIds = oldCards.map(c => c._id);
    if (oldCardIds.length) {
        await Transaction.deleteMany({ userId: user._id, cardId: { $in: oldCardIds } });
        await CashbackRecord.deleteMany({ userId: user._id, cardId: { $in: oldCardIds } });
        await Card.deleteMany({ _id: { $in: oldCardIds } });
        console.log(`Cleaned previous seed (${oldCardIds.length} cards + related data)`);
    }

    // ── Credit cards — each bank with a different cashback logic ───
    const cardsSpec = [
        {
            bankName: 'VPBank', bankShortName: 'VPB', cardNumber: '8888',
            cardNetwork: 'visa', color: '#15803D', bankColor: '#00B74F',
            cashbackRate: 5, cashbackCap: 300_000,   // 5%, trần 300k/tháng
            creditLimit: 50_000_000, paymentDueDay: 25, statementDay: 5,
        },
        {
            bankName: 'Techcombank', bankShortName: 'TCB', cardNumber: '6666',
            cardNetwork: 'visa', color: '#DC2626', bankColor: '#E11D48',
            cashbackRate: 1, cashbackCap: 0,          // 1%, không giới hạn
            creditLimit: 80_000_000, paymentDueDay: 15, statementDay: 28,
        },
        {
            bankName: 'HSBC', bankShortName: 'HSBC', cardNumber: '2222',
            cardNetwork: 'mastercard', color: '#B91C1C', bankColor: '#DB0011',
            cashbackRate: 8, cashbackCap: 200_000,    // 8%, trần 200k/tháng
            creditLimit: 60_000_000, paymentDueDay: 10, statementDay: 20,
        },
    ];

    const cards = [];
    for (const spec of cardsSpec) {
        cards.push(await Card.create({
            ...spec,
            userId: user._id,
            cardType: 'credit',
            cardHolder: 'TEST USER',
            balance: 0, // sẽ cộng dồn từ giao dịch bên dưới
            note: SEED_TAG,
        }));
    }
    console.log(`Created ${cards.length} credit cards`);

    // ── Transactions — spread over the last 3 months ───────────────
    // d(monthOffset, day): a date `monthOffset` months back
    const now = new Date();
    const d = (mOff, day) => new Date(now.getFullYear(), now.getMonth() - mOff, day, 12, 0, 0);
    const [vpb, tcb, hsbc] = cards;

    const txSpec = [
        // Tháng này
        { card: vpb, amount: 2_500_000, category: 'Ăn uống', note: 'Nhà hàng cuối tuần', date: d(0, 3) },
        { card: vpb, amount: 4_000_000, category: 'Mua sắm', note: 'Điện máy xanh', date: d(0, 5) },
        { card: tcb, amount: 6_000_000, category: 'Du lịch', note: 'Vé máy bay', date: d(0, 6) },
        { card: hsbc, amount: 1_800_000, category: 'Ăn uống', note: 'Buffet', date: d(0, 7) },
        // Tháng trước
        { card: vpb, amount: 9_000_000, category: 'Mua sắm', note: 'iPhone trả thẳng', date: d(1, 10) },   // 5% = 450k → chạm trần 300k
        { card: tcb, amount: 3_200_000, category: 'Hóa đơn', note: 'Tiền điện + nước', date: d(1, 12) },
        { card: hsbc, amount: 3_500_000, category: 'Ăn uống', note: 'Tiệc sinh nhật', date: d(1, 18) },     // 8% = 280k → chạm trần 200k
        { card: tcb, amount: 1_500_000, category: 'Xăng xe', note: 'Đổ xăng tháng', date: d(1, 22) },
        // 2 tháng trước
        { card: vpb, amount: 3_000_000, category: 'Siêu thị', note: 'WinMart', date: d(2, 8) },
        { card: hsbc, amount: 900_000, category: 'Giải trí', note: 'CGV + Steam', date: d(2, 15) },
        { card: tcb, amount: 12_000_000, category: 'Mua sắm', note: 'Macbook phụ kiện', date: d(2, 20) },
        { card: vpb, amount: 1_200_000, category: 'Ăn uống', note: 'Cafe làm việc', date: d(2, 25) },
    ];

    for (const t of txSpec) {
        await Transaction.create({
            userId: user._id,
            type: 'expense',
            amount: t.amount,
            category: t.category,
            note: `${t.note}`,
            date: t.date,
            cardId: t.card._id,
            paymentMethod: 'card',
        });
        t.card.balance += t.amount; // expense on credit card = debt goes up
    }
    console.log(`Created ${txSpec.length} card transactions`);

    // ── Cashback records: 2 tháng trước đã nhận, còn lại chờ nhận ──
    // Estimated = rate% × spend, capped per month (same math as client lib/cashback.ts)
    const estFor = (card, mOff) => {
        const spend = txSpec.filter(t => t.card === card && t.date.getMonth() === d(mOff, 1).getMonth())
            .reduce((s, t) => s + t.amount, 0);
        const raw = spend * card.cashbackRate / 100;
        return card.cashbackCap > 0 ? Math.min(raw, card.cashbackCap) : raw;
    };

    let receivedCount = 0;
    for (const card of cards) {
        const est = estFor(card, 2);
        if (est <= 0) continue;
        const when = d(2, 1);
        await CashbackRecord.create({
            userId: user._id, cardId: card._id,
            year: when.getFullYear(), month: when.getMonth(),
            estimatedAmount: est, receivedAmount: est,
            status: 'received', receivedAt: d(1, 5),
        });
        card.balance -= est; // received cashback credits the card (reduces debt)
        receivedCount++;
    }
    console.log(`Created ${receivedCount} "received" cashback records (2 months ago); recent months left pending`);

    for (const card of cards) await card.save();

    console.log('\nDone! Login: test@email.com / 123456');
    for (const card of cards) {
        console.log(`  ${card.bankName} ••${card.cardNumber}: rate ${card.cashbackRate}%${card.cashbackCap ? `, cap ${card.cashbackCap.toLocaleString('vi-VN')}đ` : ''} — dư nợ ${card.balance.toLocaleString('vi-VN')}đ`);
    }
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
