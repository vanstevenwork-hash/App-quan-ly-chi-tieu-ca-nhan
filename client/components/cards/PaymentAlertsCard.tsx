'use client';
import { memo, useState } from 'react';
import { Clock, CheckCircle2, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';

const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

function DetailRow({ icon, iconBg, title, sub, value, badge, badgeColor }: {
    icon: React.ReactNode; iconBg: string;
    title: string; sub: string; value: string;
    badge?: string; badgeColor?: string;
}) {
    return (
        <div className="flex items-center px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-xl transition group cursor-pointer">
            <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4 flex-shrink-0"
                style={{ backgroundColor: iconBg }}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{title}</h4>
                    {badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                            style={{ backgroundColor: `${badgeColor}18`, color: badgeColor }}>
                            {badge}
                        </span>
                    )}
                </div>
                <div className="flex justify-between items-end mt-0.5">
                    <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{value}</p>
                </div>
            </div>
        </div>
    );
}

interface PaymentAlertsCardProps {
    paymentAlerts: { card: Card; days: number | null }[];
    creditCardsCount: number;
    totalCreditLimit: number;
}

function PaymentAlertsCardBase({ paymentAlerts, creditCardsCount, totalCreditLimit }: PaymentAlertsCardProps) {
    const [alertsExpanded, setAlertsExpanded] = useState(false);

    return (
        <div className="px-6 mb-5">
            <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Hạn thanh toán</h3>
                {paymentAlerts.length > 0 && (
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                        {paymentAlerts.length} thẻ
                    </span>
                )}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-slate-800 divide-y divide-gray-50 dark:divide-slate-700/50">
                {paymentAlerts.length > 0 ? (alertsExpanded ? paymentAlerts : paymentAlerts.slice(0, 2)).map(({ card, days }) => {
                    const isUrgent = (days ?? 99) <= 5;
                    const minPay = card.balance * 0.05;
                    return (
                        <DetailRow
                            key={card._id}
                            icon={<Clock className={cn('w-5 h-5', isUrgent ? 'text-red-500' : 'text-orange-500')} />}
                            iconBg={isUrgent ? '#FEE2E2' : '#FEF3C7'}
                            title={`${card.bankShortName} — Hạn thanh toán`}
                            sub={`Tối thiểu: ${fmtShort(minPay)}₫`}
                            value={`${card.paymentDueDay}/${new Date().getMonth() + 1 > 12 ? 1 : new Date().getMonth() + 1}`}
                            badge={isUrgent ? 'Gấp' : `${days}N nữa`}
                            badgeColor={isUrgent ? '#EF4444' : '#F59E0B'}
                        />
                    );
                }) : (
                    <DetailRow
                        icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        iconBg={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#064E3B' : '#D1FAE5'}
                        title="Không có hạn thanh toán gần"
                        sub="Tất cả thẻ đều ổn"
                        value="Tốt 👍"
                    />
                )}

                {/* Show more / less button for alerts */}
                {paymentAlerts.length > 2 && (
                    <div className="p-2 border-t border-gray-50 dark:border-slate-700/50">
                        <button
                            onClick={() => setAlertsExpanded(prev => !prev)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                            {alertsExpanded ? (
                                <><ChevronUp className="w-3.5 h-3.5" /> Thu gọn</>
                            ) : (
                                <><ChevronDown className="w-3.5 h-3.5" /> Xem thêm {paymentAlerts.length - 2} thông báo</>
                            )}
                        </button>
                    </div>
                )}

                <DetailRow
                    icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
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
