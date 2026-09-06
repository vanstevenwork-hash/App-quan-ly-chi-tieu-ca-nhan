import { pushApi } from './api';

// Web Push helpers for the morning reminder. On iOS these only work when the
// site is installed to the Home Screen (PWA) on iOS 16.4+ — an ordinary Safari
// tab cannot subscribe, which `isPushSupported()` reflects.

export function isPushSupported(): boolean {
    return typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

// VAPID public key (base64url) → Uint8Array for applicationServerKey.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration('/sw.js');
    if (existing) return existing;
    return navigator.serviceWorker.register('/sw.js');
}

// True if this device currently has an active push subscription.
export async function isPushEnabled(): Promise<boolean> {
    if (!isPushSupported()) return false;
    try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!reg) return false;
        const sub = await reg.pushManager.getSubscription();
        return !!sub;
    } catch { return false; }
}

// Register SW, ask permission, subscribe, and persist the subscription server-side.
// Returns the subscription on success; throws with a Vietnamese message otherwise.
export async function enablePush(): Promise<PushSubscription> {
    if (!isPushSupported()) {
        throw new Error('Thiết bị/trình duyệt chưa hỗ trợ thông báo. Trên iPhone hãy mở app từ Màn hình chính.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Bạn chưa cấp quyền thông báo.');
    }

    const { data } = await pushApi.getPublicKey();
    const publicKey: string | null = data?.data?.publicKey;
    if (!publicKey) throw new Error('Máy chủ chưa cấu hình push (thiếu VAPID key).');

    const reg = await getRegistration();
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
    }

    await pushApi.subscribe(sub.toJSON());
    return sub;
}

// Unsubscribe this device and remove it server-side.
export async function disablePush(): Promise<void> {
    if (!isPushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    try { await pushApi.unsubscribe(endpoint); } catch { /* best effort */ }
}
