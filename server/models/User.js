const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: { type: String, default: '' },
    currency: { type: String, default: 'VND' },
    language: { type: String, default: 'vi' },
    // Telegram quick-entry: chat id of the linked bot conversation, plus the
    // short-lived code the app mints so /start <code> can bind this account.
    telegramChatId: { type: String, default: null, index: true, sparse: true },
    telegramLinkCode: { type: String, default: null },
    telegramLinkCodeExpires: { type: Date, default: null },
    // Default payment source for quick entries with no bank named:
    // 'ask' (show picker), 'cash', or a Card _id string.
    telegramDefaultSource: { type: String, default: 'ask' },
    // Spending-limit alerts (0 = off) and recurring auto-entries (salary, subs).
    telegramDailyLimit: { type: Number, default: 0 },
    telegramMonthlyLimit: { type: Number, default: 0 },
    telegramRecurring: [{
        type: { type: String, enum: ['income', 'expense'], default: 'income' },
        amount: { type: Number, default: 0 },
        category: { type: String, default: 'Khác' },
        note: { type: String, default: '' },
        day: { type: Number, default: 1 },          // day of month (1–28)
        source: { type: String, default: 'cash' },  // 'cash' or a Card _id
        lastRunYm: { type: String, default: '' },   // 'YYYY-MM' run guard
    }],
    // Per-category monthly budgets: { 'Ăn uống': 3000000 }.
    telegramCategoryBudgets: { type: Object, default: {} },
    // Proactive nudges: master on/off + de-dupe guards so we don't re-send.
    telegramNudges: { type: Boolean, default: true },
    telegramReminders: { type: Object, default: {} }, // { dailySummary, cardDue:{}, cashback:{} }
}, { timestamps: true });

// Mongoose v8+: async pre-save hooks do NOT receive `next` — just use async/await and return
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (entered) {
    return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
