'use client';
import { cn } from '@/lib/utils';
import { formatShortCurrency } from '@/lib/mockData';

interface ProgressCardProps {
    category: string;
    icon: string;
    spent: number;
    limit: number;
    color: string;
}

export default function ProgressCard({ category, icon, spent, limit, color }: ProgressCardProps) {
    const pct = Math.min(Math.round((spent / limit) * 100), 100);
    const over = spent > limit;

    return (
        <div className="bg-card rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                        style={{ backgroundColor: `${color}20` }}
                    >
                        {icon}
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-foreground">{category}</p>
                        <p className="text-muted-foreground text-xs">
                            {formatShortCurrency(spent)}đ / {formatShortCurrency(limit)}đ
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span
                        className={cn(
                            'text-sm font-bold',
                            over ? 'text-red-500' : 'text-foreground'
                        )}
                    >
                        {pct}%
                    </span>
                    {over && <p className="text-red-500 text-xs">Vượt ngân sách!</p>}
                </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-700',
                        over ? 'bg-red-500' : ''
                    )}
                    style={{
                        width: `${pct}%`,
                        background: over ? undefined : `linear-gradient(90deg, ${color}, ${color}AA)`,
                    }}
                />
            </div>
        </div>
    );
}
