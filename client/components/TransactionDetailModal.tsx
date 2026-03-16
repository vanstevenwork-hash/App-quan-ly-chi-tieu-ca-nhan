'use client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CATEGORIES } from '@/lib/mockData';
import { getBankLogo } from '@/lib/bankLogos';
import {
    Copy,
    Edit2,
    Trash2,
    X,
    Calendar,
    CreditCard,
    FileText,
    CheckCircle2,
    Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Transaction {
    _id: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    note: string;
    date: string;
    paymentMethod: string;
    cardId?: any;
    isInstallment?: boolean;
    installmentMonths?: number;
    installmentMonthly?: number;
    installmentStartDate?: string;
}

interface TransactionDetailModalProps {
    transaction: Transaction | null;
    open: boolean;
    onClose: () => void;
    onEdit?: (tx: Transaction) => void;
    onDelete?: (id: string) => void;
}

export default function TransactionDetailModal({ transaction, open, onClose, onEdit, onDelete }: TransactionDetailModalProps) {
    if (!transaction) return null;

    const cat = CATEGORIES.find(c => c.label === transaction.category) || CATEGORIES[CATEGORIES.length - 1];
    const isIncome = transaction.type === 'income';
    const date = new Date(transaction.date);

    // Payment Source Info
    const card = transaction.cardId;
    const bankLogo = card ? getBankLogo(card.bankShortName) : null;

    const fmtFull = (n: number) => n.toLocaleString('vi-VN');

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Đã sao chép mã giao dịch');
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="
                fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                w-[90%] max-w-[360px] p-0 border-0
                bg-white dark:bg-[#1C1427]
                rounded-[32px] shadow-2xl flex flex-col
                overflow-hidden anim-scale-in
            ">
                <div className="relative p-6 flex flex-col items-center">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Icon & Amount Section */}
                    <div className="flex flex-col items-center gap-3 mt-2">
                        <div className="bg-[#8c30e8]/10 dark:bg-[#8c30e8]/20 flex items-center justify-center rounded-2xl h-16 w-16 mb-2">
                            <span className="text-3xl">{cat.icon}</span>
                        </div>
                        <div className="text-center">
                            <h2 className={cn(
                                "text-2xl font-black tracking-tight",
                                isIncome ? "text-emerald-500" : "text-slate-900 dark:text-white"
                            )}>
                                {isIncome ? '+' : '-'}{fmtFull(transaction.amount)}đ
                            </h2>
                            <p className="text-[#8c30e8] font-bold text-sm tracking-wide mt-0.5">{transaction.category}</p>
                        </div>
                    </div>

                    {/* Quick Info Grid */}
                    <div className="w-full mt-6 space-y-3">
                        {/* Time Row */}
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100/50 dark:border-white/5">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-blue-500 shadow-sm">
                                <Clock className="w-4 h-4" />
                            </div>
                            <p className="text-slate-700 dark:text-slate-200 text-xs font-bold font-mono">
                                {date.toLocaleDateString('vi-VN')} · {date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>

                        {/* Payment Method Row */}
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100/50 dark:border-white/5">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-emerald-500 shadow-sm">
                                <CreditCard className="w-4 h-4" />
                            </div>
                            <div className="flex items-center gap-2 overflow-hidden">
                                {bankLogo && (
                                    <div className="h-4 w-6 bg-white rounded border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                        <img src={bankLogo} className="w-full h-full object-contain" alt="bank" />
                                    </div>
                                )}
                                <p className="text-slate-700 dark:text-slate-200 text-xs font-bold truncate">
                                    {card?.bankName || (transaction.paymentMethod === 'cash' ? 'Tiền mặt' : 'Khác')}
                                </p>
                            </div>
                        </div>

                        {/* Note Section (Only if exists) */}
                        {transaction.note && (
                            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100/50 dark:border-white/5">
                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed italic">
                                    "{transaction.note}"
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Transaction ID Mini */}
                    <div className="mt-4 flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity cursor-pointer group" onClick={() => copyToClipboard(transaction._id)}>
                        <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">ID: {transaction._id.slice(-8).toUpperCase()}</p>
                        <Copy className="w-3 h-3 text-slate-400 group-hover:text-[#8c30e8]" />
                    </div>
                </div>

                {/* Compact Actions */}
                <div className="p-4 grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-black/20 border-t border-slate-50 dark:border-white/5">
                    <button
                        onClick={() => onEdit?.(transaction)}
                        className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-100 dark:border-white/5 active:scale-95 transition-all"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                        Sửa
                    </button>
                    <button
                        onClick={() => onDelete?.(transaction._id)}
                        className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-bold active:scale-95 transition-all"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
