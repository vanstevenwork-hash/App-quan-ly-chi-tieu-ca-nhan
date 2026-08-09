'use client';
import { create } from 'zustand';

// Client-side "read/dismiss" state for the LIVE important alerts (credit due,
// savings review). These aren't DB notifications, so "mark all read" can't touch
// them — we remember dismissed signatures here instead. A signature encodes the
// alert's current state (e.g. due amount, maturity date) so the alert re-appears
// automatically when that state changes (new charges, a renewed passbook…).
const KEY = 'importantAlerts.dismissed';

const load = (): Record<string, true> => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};
const save = (d: Record<string, true>) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } };

interface DismissedAlertsState {
    dismissed: Record<string, true>;
    dismiss: (sigs: string[]) => void;
    restore: (sigs: string[]) => void;
}

export const useDismissedAlertsStore = create<DismissedAlertsState>((set, get) => ({
    dismissed: load(),
    dismiss: (sigs) => set(() => {
        const d = { ...get().dismissed };
        for (const s of sigs) if (s) d[s] = true;
        save(d);
        return { dismissed: d };
    }),
    restore: (sigs) => set(() => {
        const d = { ...get().dismissed };
        for (const s of sigs) delete d[s];
        save(d);
        return { dismissed: d };
    }),
}));
