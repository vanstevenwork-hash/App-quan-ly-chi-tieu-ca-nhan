const mongoose = require('mongoose');

// One row per browser/PWA install that opted in to push. `endpoint` is the
// push service URL and is globally unique, so re-subscribing the same device
// upserts instead of duplicating. We keep the raw subscription JSON exactly as
// the browser produced it — that's what web-push needs to deliver.
const pushSubscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
