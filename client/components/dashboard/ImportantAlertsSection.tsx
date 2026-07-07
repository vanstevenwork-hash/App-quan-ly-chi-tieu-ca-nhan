'use client';
import { memo } from 'react';
import type { Card } from '@/hooks/useCards';

const fmtFull = (n: number) => n.toLocaleString('vi-VN');

function AlertCard({
    title, sub, amount, badge, accentColor,
}: {
    title: string; sub: string;
    amount: string; badge: string; accentColor: string;
}) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-200 px-4 py-3.5 flex items-center gap-3">
            {/* Status dot */}
            <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: accentColor }}
            />

            {/* Title + sub */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                    {title}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {sub}
                </p>
            </div>

            {/* Amount + badge, right-aligned */}
            <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold tracking-tight" style={{ color: accentColor }}>
                    {amount}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {badge}
                </p>
            </div>
        </div>
    );
}

interface ImportantAlertsSectionProps {
    creditAlerts: Card[];
    savingsCards: Card[];
}

function ImportantAlertsSectionBase({ creditAlerts, savingsCards }: ImportantAlertsSectionProps) {
    if (creditAlerts.length === 0 && savingsCards.length === 0) return null;

    return (
        <section className="anim-fade-up-d2">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Thông báo quan trọng</h2>
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xs font-bold">
                    {creditAlerts.length + savingsCards.length}
                </span>
            </div>
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto hide-scrollbar pb-2">
                {creditAlerts.map(card => (
                    <AlertCard
                        key={card._id}
                        title={`Sao kê ${card.bankName}`}
                        sub="Dư nợ thẻ tín dụng"
                        amount={`${fmtFull(card.balance)}đ`}
                        badge="Cần thanh toán"
                        accentColor="#EF4444"
                    />
                ))}
                {savingsCards.map(card => (
                    <AlertCard
                        key={card._id}
                        title={`Sổ tiết kiệm ${card.bankShortName}`}
                        sub="Kiểm tra kỳ hạn"
                        amount={`${fmtFull(card.balance)}đ`}
                        badge="Xem chi tiết"
                        accentColor="#F59E0B"
                    />
                ))}
            </div>
        </section>
    );
}

export default memo(ImportantAlertsSectionBase);
