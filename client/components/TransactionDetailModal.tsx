'use client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CATEGORIES_MAP } from '@/lib/mockData';
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
    receiptImage?: string;
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

    const cat = CATEGORIES_MAP.get(transaction.category) || CATEGORIES_MAP.get('Khác')!;
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
                fixed inset-x-0 bottom-0 top-auto z-50
                w-full max-w-md mx-auto gap-0
                !translate-x-0 !translate-y-0
                bg-[#F8F9FF] dark:bg-[#0F111A]
                rounded-t-[32px] sm:rounded-[32px] sm:top-[10vh]
                shadow-2xl flex flex-col
                overflow-hidden border-0 p-0
                max-h-[85dvh] sm:max-h-[80vh]
                data-[state=open]:animate-in
                data-[state=closed]:animate-out
                data-[state=open]:slide-in-from-bottom
                data-[state=closed]:slide-out-to-bottom
                duration-200
            ">
                {/* Drag Handle */}
                <div className="flex w-full items-center justify-center shrink-0 pt-3 pb-1 bg-[#F8F9FF] dark:bg-[#0F111A] z-10 rounded-t-3xl cursor-grab active:cursor-grabbing" onClick={onClose}>
                    <div className="h-[5px] w-12 rounded-full bg-slate-300 dark:bg-slate-600/80 hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors"></div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-3 hide-scrollbar">
                    {/* Header (Icon, Amount, Category) */}
                    <div className="flex flex-col items-center mt-1">
                        <div className="bg-gradient-to-b from-[#7f19e6]/20 to-[#7f19e6]/5 dark:from-[#7f19e6]/30 dark:to-[#7f19e6]/10 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shadow-purple-500/10 mb-1.5 border border-purple-500/20">
                            <cat.Icon className="w-[18px] h-[18px] text-purple-600 dark:text-purple-400" />
                        </div>
                        <h2 className={cn(
                            "text-2xl font-black tracking-tight",
                            isIncome ? "text-emerald-500" : "text-slate-900 dark:text-white"
                        )}>
                            {isIncome ? '+' : '-'}{fmtFull(transaction.amount)}đ
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[#7f19e6] dark:text-purple-400 font-bold text-sm">{transaction.category}</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                {isIncome ? 'Thu nhập' : 'Chi tiêu'}
                            </span>
                        </div>
                    </div>

                    {/* Details Block */}
                    <div className="flex flex-col bg-white dark:bg-[#1A1D2D] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-800 dark:text-white mb-2.5">Chi tiết</h3>
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <div className="w-5 h-5 rounded-md bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                                        <Calendar className="w-3 h-3 text-[#7f19e6]" />
                                    </div>
                                    <span className="text-[11px] font-medium">Ngày</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 capitalize">
                                    {date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {date.toLocaleDateString('vi-VN', { weekday: 'short' })}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                        <Clock className="w-3 h-3 text-blue-500" />
                                    </div>
                                    <span className="text-[11px] font-medium">Giờ</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    {date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {date.getHours() < 12 ? 'Buổi sáng' : 'Buổi chiều'}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <div className="w-5 h-5 rounded-md bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                                        <CheckCircle2 className="w-3 h-3 text-purple-500" />
                                    </div>
                                    <span className="text-[11px] font-medium">Danh mục</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{transaction.category}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                                        <CreditCard className="w-3 h-3 text-emerald-500" />
                                    </div>
                                    <span className="text-[11px] font-medium">Phương thức</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    {card?.bankName || (transaction.paymentMethod === 'cash' ? 'Tiền mặt' : 'Khác')}
                                </span>
                            </div>

                            {transaction.note && (
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                                        <div className="w-5 h-5 rounded-md bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                                            <FileText className="w-3 h-3 text-amber-500" />
                                        </div>
                                        <span className="text-[11px] font-medium">Ghi chú</span>
                                    </div>
                                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 text-right italic break-words">"{transaction.note}"</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-0.5">
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                        <FileText className="w-3 h-3 text-blue-500" />
                                    </div>
                                    <span className="text-[11px] font-medium">ID giao dịch</span>
                                </div>
                                <button onClick={() => copyToClipboard(transaction._id)} className="flex items-center gap-1.5 group">
                                    <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 group-hover:text-purple-500 transition-colors">
                                        {transaction._id.slice(-8).toUpperCase()}
                                    </span>
                                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-purple-500 transition-colors" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Receipt Image */}
                    {transaction.receiptImage && (
                        <div className="flex flex-col bg-white dark:bg-[#1A1D2D] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xs font-bold text-slate-800 dark:text-white">Ảnh hóa đơn</h3>
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold cursor-pointer hover:underline">Xem ảnh lớn</span>
                            </div>
                            <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-[#0F111A]">
                                <img src={transaction.receiptImage} alt="Receipt" className="w-full h-auto object-cover max-h-[180px]" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Actions */}
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/90 dark:bg-[#0F111A]/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onEdit?.(transaction)}
                            className="flex-1 flex items-center justify-center h-12 gap-2 rounded-xl bg-slate-100 dark:bg-[#1A1D2D] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold border border-slate-200/50 dark:border-slate-700/50 active:scale-95 transition-all"
                        >
                            <Edit2 className="w-4 h-4" />
                            Sửa
                        </button>
                        <button
                            onClick={() => onDelete?.(transaction._id)}
                            className="flex-1 flex items-center justify-center h-12 gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold border border-red-100 dark:border-red-500/20 active:scale-95 transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                            Xóa
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
