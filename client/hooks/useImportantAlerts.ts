'use client';
import { useMemo } from 'react';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useCardShares, type SharedCardItem } from '@/hooks/useCardShares';
import { useGameMatches, type GameMatch } from '@/hooks/useGameMatches';
import { getDueThisCycle } from '@/lib/cardDue';

export interface CreditAlert {
    card: Card;
    dueThisCycle: number;
}

// Single source of truth for "Thông báo quan trọng": the same derived alerts
// (credit statement due this cycle, savings books to review, and pending
// card-share invites) are shown on Home, in the notification panel and on
// the notifications page, so the three places can never drift apart.
//
// These are LIVE reminders — they persist while still relevant (a card still
// owes this cycle, a savings book exists) and clear themselves once resolved
// (paid off, matured). "Mark all read" intentionally does NOT dismiss them.
export function useImportantAlerts() {
    const { cards } = useCards();
    const { transactions } = useTransactions();
    const { incomingInvites, respond } = useCardShares();
    const { incomingInvites: gameInvites, respond: respondToGame } = useGameMatches();

    const creditAlerts = useMemo<CreditAlert[]>(
        () => cards
            .filter(c => c.cardType === 'credit' && c.balance > 0)
            .map(card => ({ card, dueThisCycle: getDueThisCycle(card.balance, transactions, card._id) }))
            .filter(x => x.dueThisCycle > 0),
        [cards, transactions]
    );

    // Only remind about savings books that are maturing soon (or already matured)
    // — not every book forever, so the badge reflects real to-dos.
    const savingsAlerts = useMemo(
        () => cards.filter(c => {
            if (c.cardType !== 'savings' || !c.maturityDate) return false;
            const days = Math.ceil((new Date(c.maturityDate).getTime() - Date.now()) / 86_400_000);
            return days <= 30;
        }),
        [cards]
    );

    const shareInvites: SharedCardItem[] = incomingInvites;
    const gameInviteAlerts: GameMatch[] = gameInvites;

    return {
        creditAlerts,
        savingsAlerts,
        shareInvites,
        respondToShare: respond,
        gameInvites: gameInviteAlerts,
        respondToGame,
        count: creditAlerts.length + savingsAlerts.length + shareInvites.length + gameInviteAlerts.length,
    };
}
