'use client';
import { memo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';
import type { SharedCardItem } from '@/hooks/useCardShares';
import type { GameMatch } from '@/hooks/useGameMatches';
import InviteCard from '@/components/InviteCard';
import { toast } from 'sonner';

// "2,8tr" / "20k" — compact amount (no "đ"), matching the transaction feed.
const fmtViShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}tỷ`.replace(',0tỷ', 'tỷ');
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace('.', ',')}tr`.replace(/,?0+tr$/, 'tr');
    if (abs >= 1_000) return `${Math.round(abs / 1_000)}k`;
    return `${Math.round(abs)}`;
};

function AlertCard({
    title, sub, amount, badge, variant, urgent = false, onClick,
}: {
    title: string; sub: string; amount: string; badge: string;
    variant: 'credit' | 'savings'; urgent?: boolean; onClick: () => void;
}) {
    const isCredit = variant === 'credit';
    return (
        <button onClick={onClick} className={cn(
            'w-full text-left rounded-xl shadow-sm hover:shadow-md active:scale-[0.99] transition-all duration-200 px-3 py-2.5 flex items-center gap-2.5 border backdrop-blur-md',
            urgent
                ? 'bg-red-50/75 dark:bg-red-500/10 border-red-200/70 dark:border-red-500/30 ring-1 ring-red-200/60 dark:ring-red-500/20'
                : 'bg-white/65 dark:bg-surface/55 border-white/60 dark:border-slate-700/40'
        )}>
            {/* Icon tile, colored by alert type */}
            <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                isCredit ? 'bg-red-50 dark:bg-red-500/15' : 'bg-amber-50 dark:bg-amber-500/15'
            )}>
                {isCredit
                    ? <CustomIcon type="receipt" size={17} tile={false} color="#EF4444" />
                    : <CustomIcon type="calendar" size={17} tile={false} color="#F59E0B" />}
            </div>

            {/* Title + sub */}
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-800 dark:text-white truncate">
                    {title}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {sub}
                </p>
            </div>

            {/* Amount + badge pill, right-aligned */}
            <div className="text-right flex-shrink-0">
                <p className={cn(
                    'text-[13px] font-bold tracking-tight',
                    isCredit ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'
                )}>
                    {amount}
                </p>
                <span className={cn(
                    'inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap',
                    urgent
                        ? 'bg-red-500 border-red-500 text-white shadow-sm shadow-red-500/30 animate-pulse'
                        : isCredit
                            ? 'bg-red-50 border-red-200 text-red-500 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400'
                            : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400'
                )}>
                    {badge}
                </span>
            </div>
        </button>
    );
}

/** Card-share invite — the only alert type with real actions (Accept/Decline) instead of just navigating. */
function ShareInviteCard({ item, onRespond }: {
    item: SharedCardItem;
    onRespond: (id: string, accept: boolean) => Promise<unknown>;
}) {
    return (
        <InviteCard
            icon={<span className="text-lg leading-none">🤝</span>}
            title={`${item.owner?.name || 'Ai đó'} mời chia sẻ thẻ`}
            sub={`${item.card.bankName} •••• ${item.card.cardNumber}`}
            onAccept={async () => { await onRespond(item.share._id, true); toast.success(`Đã tham gia thẻ ${item.card.bankName}`); }}
            onDecline={async () => { await onRespond(item.share._id, false); toast.success('Đã từ chối lời mời'); }}
        />
    );
}

const GAME_LABELS: Record<string, string> = { tien_len: 'Tiến lên miền Nam', phom: 'Phỏm' };
type InviteResponse = { data?: { _id?: string } };

/** Game invite — same accept/decline interaction as ShareInviteCard, for the new card-game feature. */
function GameInviteCard({ item, onRespond }: {
    item: GameMatch;
    onRespond: (id: string, accept: boolean) => Promise<InviteResponse>;
}) {
    const router = useRouter();
    const host = typeof item.hostId === 'object' ? item.hostId : null;
    return (
        <InviteCard
            icon={<span className="text-lg leading-none">🃏</span>}
            iconBg="bg-purple-50 dark:bg-purple-500/15"
            title={`${host?.name || 'Ai đó'} mời chơi bài`}
            sub={GAME_LABELS[item.gameType] || item.gameType}
            onAccept={async () => {
                const res = await onRespond(item._id, true);
                toast.success('Đã chấp nhận, vào chơi thôi!');
                router.push(`/games/${res?.data?._id || item._id}`);
            }}
            onDecline={async () => { await onRespond(item._id, false); toast.success('Đã từ chối lời mời'); }}
        />
    );
}

interface ImportantAlertsSectionProps {
    creditAlerts: { card: Card; dueThisCycle: number }[];
    savingsCards: Card[];
    shareInvites?: SharedCardItem[];
    onRespondShare?: (id: string, accept: boolean) => Promise<unknown>;
    gameInvites?: GameMatch[];
    onRespondGame?: (id: string, accept: boolean) => Promise<InviteResponse>;
    /** Full alert count (un-sliced) so the badge matches the notifications screen */
    totalCount?: number;
    /** Opens the notification panel on the "Quan trọng" tab */
    onOpen: () => void;
}

const VISIBLE_ALERTS = 2; // show the top 2; fold the rest into a "Xem thêm" row

function ImportantAlertsSectionBase({ creditAlerts, savingsCards, shareInvites = [], onRespondShare, gameInvites = [], onRespondGame, totalCount, onOpen }: ImportantAlertsSectionProps) {
    if (creditAlerts.length === 0 && savingsCards.length === 0 && shareInvites.length === 0 && gameInvites.length === 0) return null;

    // Flatten every alert into one ordered list (invites first — they're actionable),
    // then only render the first few so the section doesn't take over the screen.
    const alerts: ReactNode[] = [
        ...(onRespondShare ? shareInvites.map(item => (
            <ShareInviteCard key={`share-${item.share._id}`} item={item} onRespond={onRespondShare} />
        )) : []),
        ...(onRespondGame ? gameInvites.map(item => (
            <GameInviteCard key={`game-${item._id}`} item={item} onRespond={onRespondGame} />
        )) : []),
        ...creditAlerts.map(({ card, dueThisCycle }) => {
            // Days until the upcoming payment due date → urgency-aware badge:
            // due within 3 days (or today) reads as red + pulsing; otherwise the
            // plain due date. Easy to spot which cards actually need action now.
            let dueDays: number | null = null;
            let dueDate: Date | null = null;
            if (card.paymentDueDay) {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                dueDate = new Date(now.getFullYear(), now.getMonth(), card.paymentDueDay);
                if (dueDate < today) dueDate.setMonth(dueDate.getMonth() + 1);
                dueDays = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);
            }
            const urgent = dueDays !== null && dueDays <= 3;
            const dueBadge = dueDays === null ? 'Cần thanh toán'
                : dueDays === 0 ? '⚠️ Đến hạn hôm nay'
                    : dueDays <= 3 ? `⚠️ Còn ${dueDays} ngày`
                        : `Đến hạn ${dueDate!.getDate()}/${dueDate!.getMonth() + 1}`;
            return (
                <AlertCard
                    key={`credit-${card._id}`}
                    title={`Sao kê ${card.bankName}`}
                    sub={dueDays === null || dueDays > 3 ? 'Cần thanh toán kỳ này' : dueDays === 0 ? 'Đến hạn hôm nay' : `Còn ${dueDays} ngày để thanh toán`}
                    amount={fmtViShort(dueThisCycle)}
                    badge={dueBadge}
                    variant="credit"
                    urgent={urgent}
                    onClick={onOpen}
                />
            );
        }),
        ...savingsCards.map(card => (
            <AlertCard
                key={`savings-${card._id}`}
                title={`Sổ tiết kiệm ${card.bankShortName}`}
                sub="Kiểm tra kỳ hạn"
                amount={fmtViShort(card.balance)}
                badge="Xem chi tiết"
                variant="savings"
                onClick={onOpen}
            />
        )),
    ];

    return (
        <section className="anim-fade-up-d2">
            <div className="flex justify-between items-center mb-2.5">
                <h2 className="text-[15px] font-bold text-slate-800 dark:text-white">Thông báo quan trọng</h2>
                <button onClick={onOpen} className="flex items-center gap-1 group">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary dark:bg-purple-500/25 dark:text-purple-300 flex items-center justify-center text-[11px] font-bold">
                        {totalCount ?? (creditAlerts.length + savingsCards.length + shareInvites.length + gameInvites.length)}
                    </span>
                    <ActionIcon type="chevronRight" size={16} tile={false} color="#94A3B8" className="group-hover:text-purple-500 transition-colors" />
                </button>
            </div>
            <div className="space-y-2">
                {alerts.slice(0, VISIBLE_ALERTS)}
            </div>
        </section>
    );
}

export default memo(ImportantAlertsSectionBase);
