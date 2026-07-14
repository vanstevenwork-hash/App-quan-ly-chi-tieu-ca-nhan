'use client';
import { useEffect, useMemo, useState } from 'react';
import { cardSharesApi } from '@/lib/api';
import { useCardShares } from '@/hooks/useCardShares';

export type SharedCashbackItem = {
    cardId: string;
    bankName: string;
    cashbackEarned: number;
    capped: boolean;
    ownerName?: string;
};

// This month's real (combined owner + invitee spend) cashback for every card
// shared with me, fetched from the same endpoint the Cards page badge uses so
// the numbers always match what the card owner sees. Shared by the cashback
// page and the dashboard so both agree on the "thẻ chung" total.
export function useSharedCashback() {
    const { sharedCards } = useCardShares();
    const [sharedCashback, setSharedCashback] = useState<SharedCashbackItem[]>([]);

    useEffect(() => {
        if (sharedCards.length === 0) { setSharedCashback([]); return; }
        let alive = true;
        Promise.all(sharedCards.map(sc =>
            cardSharesApi.getCashback(sc.card._id).then(res => res.data?.data).catch(() => null)
        )).then(results => {
            if (!alive) return;
            setSharedCashback(
                results.filter(Boolean).map((d: any) => ({
                    cardId: d.cardId,
                    bankName: d.bankName,
                    cashbackEarned: d.cashbackEarned,
                    capped: d.capped,
                    ownerName: sharedCards.find(x => x.card._id === d.cardId)?.owner?.name,
                }))
            );
        });
        return () => { alive = false; };
    }, [sharedCards]);

    const sharedCashbackTotal = useMemo(
        () => sharedCashback.reduce((s, c) => s + c.cashbackEarned, 0),
        [sharedCashback]
    );

    return { sharedCashback, sharedCashbackTotal };
}
