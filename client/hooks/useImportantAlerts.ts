'use client';
import { useMemo, useCallback } from 'react';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useCardShares, type SharedCardItem } from '@/hooks/useCardShares';
import { useGameMatches, type GameMatch } from '@/hooks/useGameMatches';
import { getDueThisCycle } from '@/lib/cardDue';
import { useDismissedAlertsStore } from '@/hooks/useDismissedAlerts';

// Signatures embed the alert's current state so a dismissed alert re-appears
// when that state changes (new due amount, a renewed passbook…).
const creditSig = (cardId: string, due: number) => `credit:${cardId}:${due}`;
const savingsSig = (c: Card) => `savings:${c._id}:${c.maturityDate || ''}`;

export interface CreditAlert {
    card: Card;
    dueThisCycle: number;
}

// Single source of truth for "Thông báo quan trọng": the same derived alerts
// (credit statement due this cycle, savings books to review, and pending
// card-share invites) are shown on Home, in the notification panel and on
// the notifications page, so the three places can never drift apart.
export function useImportantAlerts() {
    const { cards } = useCards();
    const { transactions } = useTransactions();
    const { incomingInvites, respond } = useCardShares();
    const { incomingInvites: gameInvites, respond: respondToGame } = useGameMatches();
    const dismissed = useDismissedAlertsStore(s => s.dismissed);
    const dismiss = useDismissedAlertsStore(s => s.dismiss);

    // Live alerts, minus the ones the user has dismissed (until their state changes).
    const creditAlerts = useMemo<CreditAlert[]>(
        () => cards
            .filter(c => c.cardType === 'credit' && c.balance > 0)
            .map(card => ({ card, dueThisCycle: getDueThisCycle(card.balance, transactions, card._id) }))
            .filter(x => x.dueThisCycle > 0 && !dismissed[creditSig(x.card._id, x.dueThisCycle)]),
        [cards, transactions, dismissed]
    );

    const savingsAlerts = useMemo(
        () => cards.filter(c => c.cardType === 'savings' && !dismissed[savingsSig(c)]),
        [cards, dismissed]
    );

    const shareInvites: SharedCardItem[] = incomingInvites;
    const gameInviteAlerts: GameMatch[] = gameInvites;

    // Dismiss all currently-shown informational alerts (credit due + savings).
    // Invites stay — they need an explicit Accept/Decline, not "mark as read".
    const dismissAll = useCallback(() => {
        dismiss([
            ...creditAlerts.map(a => creditSig(a.card._id, a.dueThisCycle)),
            ...savingsAlerts.map(savingsSig),
        ]);
    }, [creditAlerts, savingsAlerts, dismiss]);

    return {
        creditAlerts,
        savingsAlerts,
        shareInvites,
        respondToShare: respond,
        gameInvites: gameInviteAlerts,
        respondToGame,
        dismissAll,
        count: creditAlerts.length + savingsAlerts.length + shareInvites.length + gameInviteAlerts.length,
    };
}
