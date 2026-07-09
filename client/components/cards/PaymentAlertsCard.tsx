'use client';
import { memo, useState } from 'react';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';
import { UtilityIcon } from '@/components/icons/UtilityIcon';

const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1000)}k`;
};

function DetailRow({ icon, iconBg, title, sub, value, badge, badgeColor }: {
    icon: React.ReactNode; iconBg: string;
    title: string; sub: string; value: string;
    badge?: string; badgeColor?: string;
}) {
    return (
        <div className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-all group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                style={{ backgroundColor: iconBg }}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 leading-tight truncate">{title}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">{sub}</p>
            </div>
            <div className="text-right flex-shrink-0">
                <p className="text-[13px] font-black text-slate-800 dark:text-slate-100">{value}</p>
                {badge && (
                    <span className="inline-block text-[8px] font-bold px-1.5 py-0.5 rounded mt-0.5 uppercase tracking-wide leading-none"
                        style={{ backgroundColor: `${badgeColor}22`, color: badgeColor }}>
                        {badge}
                    </span>
                )}
            </div>
        </div>
    );
}

interface PaymentAlertsCardProps {
    paymentAlerts: { card: Card; dueThisCycle: number; days: number | null }[];
    creditCardsCount: number;
    totalCreditLimit: number;
}

function PaymentAlertsCardBase({ paymentAlerts, creditCardsCount, totalCreditLimit }: PaymentAlertsCardProps) {
    const [alertsExpanded, setAlertsExpanded] = useState(false);

    return (
        <div className="px-6 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[20px] shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                {paymentAlerts.length > 0 ? (alertsExpanded ? paymentAlerts : paymentAlerts.slice(0, 2)).map(({ card, dueThisCycle, days }) => {
                    const isUrgent = (days ?? 99) <= 5;
                    return (
                        <DetailRow
                            key={card._id}
                            icon={<UtilityIcon type="clock" size={20} tile={false} color={isUrgent ? '#EF4444' : '#F59E0B'} />}
                            iconBg={isUrgent ? '#FEE2E2' : '#FEF3C7'}
                            title={`${card.bankShortName} — Hạn thanh toán`}
                            sub={`Cần thanh toán: ${fmtShort(dueThisCycle)}₫`}
                            value={`${card.paymentDueDay}/${new Date().getMonth() + 1 > 12 ? 1 : new Date().getMonth() + 1}`}
                            badge={isUrgent ? 'Gấp' : `${days}N nữa`}
                            badgeColor={isUrgent ? '#EF4444' : '#F59E0B'}
                        />
                    );
                }) : (
                    <DetailRow
                        icon={<UtilityIcon type="checkCircle" size={20} tile={false} color="#10B981" />}
                        iconBg={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#064E3B' : '#D1FAE5'}
                        title="Không có hạn thanh toán gần"
                        sub="Tất cả thẻ đều ổn"
                        value="Tốt 👍"
                    />
                )}

                {paymentAlerts.length > 2 && (
                    <div className="px-2 pb-2">
                        <button
                            onClick={() => setAlertsExpanded(prev => !prev)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                            {alertsExpanded ? (
                                <><ActionIcon type="chevronUp" size={14} tile={false} color="currentColor" /> Thu gọn</>
                            ) : (
                                <><ActionIcon type="chevronDown" size={14} tile={false} color="currentColor" /> Xem thêm {paymentAlerts.length - 2} thông báo</>
                            )}
                        </button>
                    </div>
                )}

                <DetailRow
                    icon={<UtilityIcon type="trendingUp" size={20} tile={false} color="#6366F1" />}
                    iconBg={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#312E81' : '#EEF2FF'}
                    title="Tổng hạn mức tín dụng"
                    sub={`${creditCardsCount} thẻ tín dụng`}
                    value={`${fmtShort(totalCreditLimit)}₫`}
                />
            </div>
        </div>
    );
}

export default memo(PaymentAlertsCardBase);
