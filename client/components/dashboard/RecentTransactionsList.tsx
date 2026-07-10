'use client';
import { memo, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CATEGORIES_MAP } from '@/lib/mockData';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { resolveCardId } from '@/lib/cashback';
import type { Card } from '@/hooks/useCards';

// "2,8tr" / "20k" — Vietnamese compact amounts
const fmtViShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}tỷ`.replace(',0tỷ', 'tỷ');
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace('.', ',')}tr`.replace(/,?0+tr$/, 'tr');
    if (abs >= 1_000) return `${Math.round(abs / 1_000)}k`;
    return `${Math.round(abs)}`;
};

const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function dayLabel(d: Date): string {
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hôm nay';
    if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
    return WEEKDAYS[d.getDay()];
}

// "Thẻ VIB ••4021" / "Ví MoMo" / "Tiền mặt"
function sourceLabel(t: any, cards: Card[]): string {
    if (t.paymentMethod === 'card') {
        const card = cards.find(c => c._id === resolveCardId(t));
        if (card) {
            return card.cardType === 'eWallet'
                ? `Ví ${card.bankShortName}`
                : `Thẻ ${card.bankShortName} ••${card.cardNumber}`;
        }
        return 'Thẻ';
    }
    return 'Tiền mặt';
}

function TransactionRow({ t, cards, onClick }: { t: any; cards: Card[]; onClick: () => void }) {
    const isIncome = t.type === 'income';
    const cat = CATEGORIES_MAP.get(t.category) || CATEGORIES_MAP.get('Khác')!;
    const time = new Date(t.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return (
        <div
            onClick={onClick}
            className="flex items-center gap-3.5 bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-200 px-4 py-3.5 cursor-pointer"
        >
            <CategoryIcon
                type={cat.catIconType || 'khac'}
                size={44}
                tile
                className="flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">{t.note || t.category}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1 truncate">
                    {t.category} · {time}
                </p>
            </div>
            <div className="flex flex-col items-end flex-shrink-0 ml-2">
                <span className={cn('text-[15px] font-bold tabular-nums', isIncome ? 'text-emerald-500' : 'text-red-400')}>
                    {isIncome ? '+' : '-'}{fmtViShort(t.amount)}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1 truncate max-w-[120px]">
                    {sourceLabel(t, cards)}
                </span>
            </div>
        </div>
    );
}

interface RecentTransactionsListProps {
    transactions: any[];
    cards: Card[];
    onSelectTx: (t: any) => void;
    onAddFirst: () => void;
}

function RecentTransactionsListBase({ transactions, cards, onSelectTx, onAddFirst }: RecentTransactionsListProps) {
    // Latest transactions grouped by calendar day, each day with its net total
    const dayGroups = useMemo(() => {
        const shown = transactions.slice(0, 6);
        const groups: { key: string; label: string; dateStr: string; items: any[]; net: number }[] = [];
        const byKey = new Map<string, typeof groups[number]>();
        shown.forEach(t => {
            const d = new Date(t.date);
            const key = d.toDateString();
            let g = byKey.get(key);
            if (!g) {
                g = {
                    key,
                    label: dayLabel(d),
                    dateStr: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
                    items: [], net: 0,
                };
                byKey.set(key, g);
                groups.push(g);
            }
            g.items.push(t);
            g.net += t.type === 'income' ? t.amount : -t.amount;
        });
        return groups;
    }, [transactions]);

    return (
        <section>
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Giao dịch gần đây</h2>
                <Link href="/analytics"
                    className="text-sm font-semibold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity">
                    Lịch sử ›
                </Link>
            </div>
            {transactions.length === 0 ? (
                <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm py-10 text-center">
                    <p className="text-slate-400 text-sm">Chưa có giao dịch nào</p>
                    <button
                        onClick={onAddFirst}
                        className="mt-3 text-xs font-bold text-purple-600 bg-purple-50 px-4 py-2 rounded-xl hover:bg-purple-100 transition-colors"
                    >
                        + Thêm giao dịch đầu tiên
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {dayGroups.map(g => (
                        <div key={g.key}>
                            {/* Day header: label + date left, net total right */}
                            <div className="flex items-baseline justify-between px-1 mb-2">
                                <p className="text-sm font-bold text-slate-800 dark:text-white">
                                    {g.label} <span className="text-slate-400 dark:text-slate-500 font-medium">· {g.dateStr}</span>
                                </p>
                                <span className={cn(
                                    'text-sm font-bold tabular-nums',
                                    g.net < 0 ? 'text-red-400' : 'text-emerald-500'
                                )}>
                                    {g.net < 0 ? '-' : '+'}{fmtViShort(g.net)}
                                </span>
                            </div>
                            <div className="space-y-2.5">
                                {g.items.map((t) => (
                                    <TransactionRow key={t._id} t={t} cards={cards} onClick={() => onSelectTx(t)} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default memo(RecentTransactionsListBase);
