'use client';
import { memo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const fmt = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return `${n}`;
};

function TransactionRow({ t, onClick }: { t: any; onClick: () => void }) {
    const isIncome = t.type === 'income';
    return (
        <div
            onClick={onClick}
            className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-200 px-4 py-3.5 cursor-pointer"
        >
            <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">{t.note || t.category}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate">
                    {t.category} · {new Date(t.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </p>
            </div>
            <span className={cn('text-sm font-bold flex-shrink-0 ml-3', isIncome ? 'text-emerald-500' : 'text-red-500')}>
                {isIncome ? '+' : '-'}{fmt(t.amount)}
            </span>
        </div>
    );
}

interface RecentTransactionsListProps {
    transactions: any[];
    onSelectTx: (t: any) => void;
    onAddFirst: () => void;
}

function RecentTransactionsListBase({ transactions, onSelectTx, onAddFirst }: RecentTransactionsListProps) {
    return (
        <section>
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Giao dịch gần đây</h2>
                <Link href="/analytics"
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all uppercase tracking-tight">
                    Lịch sử
                </Link>
            </div>
            {transactions.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm py-10 text-center">
                    <p className="text-slate-400 text-sm">Chưa có giao dịch nào</p>
                    <button
                        onClick={onAddFirst}
                        className="mt-3 text-xs font-bold text-purple-600 bg-purple-50 px-4 py-2 rounded-xl hover:bg-purple-100 transition-colors"
                    >
                        + Thêm giao dịch đầu tiên
                    </button>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {transactions.slice(0, 5).map((t) => (
                        <TransactionRow key={t._id} t={t} onClick={() => onSelectTx(t)} />
                    ))}
                </div>
            )}
        </section>
    );
}

export default memo(RecentTransactionsListBase);
