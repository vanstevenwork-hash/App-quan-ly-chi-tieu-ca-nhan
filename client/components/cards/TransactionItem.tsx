'use client';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { formatCurrency, formatDate, CATEGORIES_MAP } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import CategoryIcon from '@/components/icons/CategoryIcon';

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
    const cat = CATEGORIES_MAP.get(transaction.category) || CATEGORIES_MAP.get('Khác')!;
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
            <CategoryIcon
                type={cat.catIconType || 'khac'}
                size={44}
                tile
                className="flex-shrink-0"
            />

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
                    ? <CustomIcon type="arrowDownLeft" size={12} tile={false} color="#10B981" />
                    : <CustomIcon type="arrowUpRight" size={12} tile={false} color="#EF4444" />}
            </div>
        </div>
    );
}
