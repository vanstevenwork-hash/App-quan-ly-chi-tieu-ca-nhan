'use client';
import { memo } from 'react';
import { PiggyBank } from 'lucide-react';
import Image from 'next/image';
import type { Card } from '@/hooks/useCards';

const fmtFull = (n: number) => n.toLocaleString('vi-VN');

function AlertCard({
    icon, iconBg, title, sub, amount, badge, badgeColor, accentColor,
}: {
    icon: React.ReactNode; iconBg: string; title: string; sub: string;
    amount: string; badge: string; badgeColor: string; accentColor: string;
}) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-200 relative group">
            {/* Accent bar (mảnh hơn + mềm hơn) */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                style={{ backgroundColor: accentColor }}
            />

            <div className="px-3 py-1.5 pl-4 flex items-center gap-3">
                {/* Icon */}
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0"
                    style={{ backgroundColor: iconBg, borderColor: `${accentColor}22` }}
                >
                    {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Title + badge */}
                    <div className="flex justify-between items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {title}
                        </p>

                        <span
                            className="text-[10px] font-medium px-2 py-[2px] rounded-md whitespace-nowrap"
                            style={{
                                backgroundColor: `${badgeColor}12`,
                                color: badgeColor
                            }}
                        >
                            {badge}
                        </span>
                    </div>

                    <p className="text-[11px] text-slate-400 truncate">
                        {sub}
                    </p>

                    <p
                        className="text-xs font-bold tracking-tight"
                        style={{ color: accentColor }}
                    >
                        {amount}
                    </p>
                </div>
            </div>
        </div>
    );
}

interface ImportantAlertsSectionProps {
    creditAlerts: Card[];
    savingsCards: Card[];
    banksByShortName: Map<string, { logo?: string }>;
}

function ImportantAlertsSectionBase({ creditAlerts, savingsCards, banksByShortName }: ImportantAlertsSectionProps) {
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
                {creditAlerts.map(card => {
                    const b = banksByShortName.get(card.bankShortName) as any;
                    return (
                        <AlertCard
                            key={card._id}
                            icon={b?.logo ? <Image src={b.logo} width={36} height={36} className="w-9 h-9 object-contain bg-white p-1 rounded-xl shadow-sm" alt="logo" /> : <span className="font-black text-red-600 text-xs">{card.bankShortName}</span>}
                            iconBg="#FEF2F2"
                            title={`Sao kê ${card.bankName}`}
                            sub="Dư nợ thẻ tín dụng"
                            amount={`${fmtFull(card.balance)}đ`}
                            badge="Cần thanh toán"
                            badgeColor="#EF4444"
                            accentColor="#EF4444"
                        />
                    );
                })}
                {savingsCards.map(card => {
                    const b = banksByShortName.get(card.bankShortName) as any;
                    return (
                        <AlertCard
                            key={card._id}
                            icon={b?.logo ? <Image src={b.logo} width={32} height={32} className="w-8 h-8 object-contain bg-white p-1 rounded-md shadow-sm" alt="logo" /> : <PiggyBank className="w-5 h-5 text-amber-600" />}
                            iconBg="#FFFBEB"
                            title={`Sổ tiết kiệm ${card.bankShortName}`}
                            sub="Kiểm tra kỳ hạn"
                            amount={`${fmtFull(card.balance)}đ`}
                            badge="Xem chi tiết"
                            badgeColor="#F59E0B"
                            accentColor="#F59E0B"
                        />
                    );
                })}
            </div>
        </section>
    );
}

export default memo(ImportantAlertsSectionBase);
