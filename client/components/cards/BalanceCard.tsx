'use client';
import { Eye, EyeOff, TrendingUp, TrendingDown, Wallet, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency, formatShortCurrency } from '@/lib/mockData';

interface BalanceCardProps {
    totalBalance: number;
    income: number;
    expense: number;
    savings?: number;
    debt?: number;
    name?: string;
}

export default function BalanceCard({
    totalBalance, income, expense,
    savings = 250000000, debt = -15200000,
    name = 'Minh Anh'
}: BalanceCardProps) {
    const [hidden, setHidden] = useState(false);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-card mx-4 overflow-hidden border border-gray-100 dark:border-slate-700">
            {/* Top section */}
            <div className="px-5 pt-5 pb-4">
                <p className="text-center text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
                    Tổng tài sản
                </p>
                <div className="flex items-center justify-center gap-3">
                    <p className="text-3xl font-bold text-foreground text-money tracking-tight">
                        {hidden ? '••••••••' : totalBalance.toLocaleString('vi-VN')}
                        <span className="text-lg font-semibold text-muted-foreground ml-2">VND</span>
                    </p>
                    <button
                        onClick={() => setHidden(!hidden)}
                        className="p-1.5 rounded-full bg-muted/60 hover:bg-muted transition-colors"
                    >
                        {hidden ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                    </button>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500 text-xs font-semibold">+12.5% tháng này</span>
                </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-100 dark:bg-slate-700 mx-5" />

            {/* Bottom stats */}
            <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-slate-700">
                <div className="px-5 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Wallet className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Tiết kiệm</p>
                        <p className="font-bold text-foreground text-sm text-money">
                            {hidden ? '•••' : formatShortCurrency(savings)}
                        </p>
                    </div>
                </div>
                <div className="px-5 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Dư nợ thẻ</p>
                        <p className="font-bold text-red-500 text-sm text-money">
                            {hidden ? '•••' : `${(debt / 1000000).toFixed(1)}tr`}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
