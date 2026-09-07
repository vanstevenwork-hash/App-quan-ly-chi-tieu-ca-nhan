'use client';
import { useEffect } from 'react';

// Registers the service worker on app load so offline caching works for every
// visitor (push subscription is set up separately, on demand, in lib/push.ts).
export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
        // Register after load so it never competes with first paint.
        const register = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ });
        if (document.readyState === 'complete') register();
        else window.addEventListener('load', register, { once: true });
    }, []);
    return null;
}
