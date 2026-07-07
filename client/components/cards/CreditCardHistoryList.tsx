'use client';
import { memo, useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';
import { resolveCardId, getCashbackAmount } from '@/lib/cashback';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

interface CreditCardHistoryListProps {
    transactions: any[];
    cards: Card[];
}

function CreditCardHistoryListBase({ transactions, cards }: CreditCardHistoryListProps) {
    const [historyExpanded, setHistoryExpanded] = useState(false);

    const rateByCardId = useMemo(() => {
        const map = new Map<string, number>();
        cards.forEach(c => map.set(c._id, c.cashbackRate));
        return map;
    }, [cards]);

    if (transactions.length === 0) return null;

    return (
        <>
            <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-500" />
                    Lịch sử giao dịch
                </h3>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                    {transactions.length} giao dịch
                </span>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/50">
                {(historyExpanded ? transactions : transactions.slice(0, 5)).map(t => {
                    const isExpense = t.type === 'expense';
                    const isInstallment = (t as any).isInstallment;
                    const cb = isExpense ? getCashbackAmount(rateByCardId.get(resolveCardId(t)), t.amount) : 0;
                    const txDate = new Date(t.date);
                    const isToday = txDate.toDateString() === new Date().toDateString();
                    const isYesterday = txDate.toDateString() === new Date(Date.now() - 86400000).toDateString();
                    const dateLabel = isToday ? 'Hôm nay' : isYesterday ? 'Hôm qua' :
                        txDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                    return (
                        <div key={t._id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                            {/* Icon */}
                            <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                isExpense
                                    ? 'bg-red-50 dark:bg-red-900/30'
                                    : 'bg-emerald-50 dark:bg-emerald-900/30'
                            )}>
                                {isExpense
                                    ? <ArrowUpRight className="w-4 h-4 text-red-500" />
                                    : <ArrowDownLeft className="w-4 h-4 text-emerald-600" />}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{t.category}</p>
                                    {isInstallment && (
                                        <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                                            TG {(t as any).installmentMonths}th
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {t.note && <p className="text-xs text-slate-400 truncate max-w-[120px]">{t.note}</p>}
                                    <span className="text-[10px] text-slate-300 dark:text-slate-600 flex-shrink-0">{dateLabel}</span>
                                </div>
                            </div>

                            {/* Amount + cashback */}
                            <div className="text-right flex-shrink-0">
                                <p className={cn('text-sm font-bold',
                                    isExpense ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                                    {isExpense ? '-' : '+'}{fmt(t.amount)}₫
                                </p>
                                {isExpense && cb > 0 && (
                                    <p className="text-[10px] text-amber-500 font-semibold">+{Math.round(cb).toLocaleString('vi-VN')}₫ CB</p>
                                )}
                                {isInstallment && (
                                    <p className="text-[10px] text-indigo-400 font-semibold">{fmtShort((t as any).installmentMonthly || 0)}/th</p>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Show more / less */}
                {transactions.length > 5 && (
                    <div className="p-2 border-t border-gray-50 dark:border-slate-700/50">
                        <button
                            onClick={() => setHistoryExpanded(prev => !prev)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                            {historyExpanded ? (
                                <><ChevronUp className="w-3.5 h-3.5" /> Thu gọn</>
                            ) : (
                                <><ChevronDown className="w-3.5 h-3.5" /> Xem thêm {transactions.length - 5} giao dịch</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

export default memo(CreditCardHistoryListBase);
