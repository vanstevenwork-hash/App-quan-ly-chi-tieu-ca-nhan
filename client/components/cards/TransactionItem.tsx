'use client';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatCurrency, formatDate, CATEGORIES } from '@/lib/mockData';
import { cn } from '@/lib/utils';

interface TransactionItemProps {
    transaction: {
        _id: string;
        type: 'income' | 'expense';
        amount: number;
        category: string;
        note: string;
        date: string;
        paymentMethod?: string;
    };
    onClick?: () => void;
}

export default function TransactionItem({ transaction, onClick }: TransactionItemProps) {
    const cat = CATEGORIES.find(c => c.label === transaction.category) || CATEGORIES[CATEGORIES.length - 1];
    const isIncome = transaction.type === 'income';

    return (
        <div
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 cursor-pointer',
                'hover:bg-muted/50 active:scale-[0.98]'
            )}
        >
            {/* Category Icon */}
            <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: `${cat.color}20` }}
            >
                {cat.icon}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{transaction.category}</p>
                <p className="text-muted-foreground text-xs truncate">{transaction.note || formatDate(transaction.date)}</p>
            </div>

            {/* Amount */}
            <div className="text-right flex-shrink-0">
                <p
                    className={cn(
                        'font-bold text-sm text-money',
                        isIncome ? 'text-emerald-500' : 'text-red-500'
                    )}
                >
                    {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
                </p>
                <p className="text-muted-foreground text-xs">{formatDate(transaction.date)}</p>
            </div>

            {/* Direction icon */}
            <div
                className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                    isIncome ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'
                )}
            >
                {isIncome
                    ? <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                    : <ArrowUpRight className="w-3 h-3 text-red-500" />}
            </div>
        </div>
    );
}
