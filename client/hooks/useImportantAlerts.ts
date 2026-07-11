'use client';
import { useMemo } from 'react';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useCardShares, type SharedCardItem } from '@/hooks/useCardShares';
import { getDueThisCycle } from '@/lib/cardDue';

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

    const creditAlerts = useMemo<CreditAlert[]>(
        () => cards
            .filter(c => c.cardType === 'credit' && c.balance > 0)
            .map(card => ({ card, dueThisCycle: getDueThisCycle(card.balance, transactions, card._id) }))
            .filter(x => x.dueThisCycle > 0),
        [cards, transactions]
    );

    const savingsAlerts = useMemo(
        () => cards.filter(c => c.cardType === 'savings'),
        [cards]
    );

    const shareInvites: SharedCardItem[] = incomingInvites;

    return {
        creditAlerts,
        savingsAlerts,
        shareInvites,
        respondToShare: respond,
        count: creditAlerts.length + savingsAlerts.length + shareInvites.length,
    };
}
