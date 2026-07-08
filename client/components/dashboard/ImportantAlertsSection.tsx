'use client';
import { memo } from 'react';
import Link from 'next/link';
import { ReceiptText, CalendarClock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';

const fmtFull = (n: number) => n.toLocaleString('vi-VN');

function AlertCard({
    title, sub, amount, badge, variant,
}: {
    title: string; sub: string; amount: string; badge: string;
    variant: 'credit' | 'savings';
}) {
    const isCredit = variant === 'credit';
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-200 px-4 py-3.5 flex items-center gap-3">
            {/* Icon tile, colored by alert type */}
            <div className={cn(
                'w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0',
                isCredit ? 'bg-red-50 dark:bg-red-500/15' : 'bg-amber-50 dark:bg-amber-500/15'
            )}>
                {isCredit
                    ? <ReceiptText className="w-5 h-5 text-red-500 dark:text-red-400" />
                    : <CalendarClock className="w-5 h-5 text-amber-500 dark:text-amber-400" />}
            </div>

            {/* Title + sub */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                    {title}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {sub}
                </p>
            </div>

            {/* Amount + badge pill, right-aligned */}
            <div className="text-right flex-shrink-0">
                <p className={cn(
                    'text-sm font-bold tracking-tight',
                    isCredit ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'
                )}>
                    {amount}
                </p>
                <span className={cn(
                    'inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border',
                    isCredit
                        ? 'bg-red-50 border-red-200 text-red-500 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400'
                        : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400'
                )}>
                    {badge}
                </span>
            </div>
        </div>
    );
}

interface ImportantAlertsSectionProps {
    creditAlerts: { card: Card; dueThisCycle: number }[];
    savingsCards: Card[];
}

function ImportantAlertsSectionBase({ creditAlerts, savingsCards }: ImportantAlertsSectionProps) {
    if (creditAlerts.length === 0 && savingsCards.length === 0) return null;

    return (
        <section className="anim-fade-up-d2">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Thông báo quan trọng</h2>
                <Link href="/notifications" className="flex items-center gap-1 group">
                    <span className="w-6 h-6 rounded-full bg-primary/15 text-primary dark:bg-purple-500/25 dark:text-purple-300 flex items-center justify-center text-xs font-bold">
                        {creditAlerts.length + savingsCards.length}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 transition-colors" />
                </Link>
            </div>
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto hide-scrollbar pb-2">
                {creditAlerts.map(({ card, dueThisCycle }) => (
                    <AlertCard
                        key={card._id}
                        title={`Sao kê ${card.bankName}`}
                        sub="Cần thanh toán kỳ này"
                        amount={`${fmtFull(dueThisCycle)}đ`}
                        badge="Cần thanh toán"
                        variant="credit"
                    />
                ))}
                {savingsCards.map(card => (
                    <AlertCard
                        key={card._id}
                        title={`Sổ tiết kiệm ${card.bankShortName}`}
                        sub="Kiểm tra kỳ hạn"
                        amount={`${fmtFull(card.balance)}đ`}
                        badge="Xem chi tiết"
                        variant="savings"
                    />
                ))}
            </div>
        </section>
    );
}

export default memo(ImportantAlertsSectionBase);
