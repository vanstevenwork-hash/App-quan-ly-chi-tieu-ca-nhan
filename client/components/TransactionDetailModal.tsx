'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CATEGORIES_MAP } from '@/lib/mockData';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { getBankLogo } from '@/lib/bankLogos';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { ActionIcon } from '@/components/icons/ActionIcon';
import ExpenseShareModal from '@/components/ExpenseShareModal';

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
    const [showLightbox, setShowLightbox] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    // Bank logo URLs 404 for some banks — fall back to the wallet glyph instead
    // of a broken <img>. Reset per transaction so a past failure doesn't stick.
    const [logoFailed, setLogoFailed] = useState(false);
    useEffect(() => { setLogoFailed(false); }, [transaction?._id]);
    if (!transaction) return null;

    const cat = CATEGORIES_MAP.get(transaction.category) || CATEGORIES_MAP.get('Khác')!;
    const isIncome = transaction.type === 'income';
    const date = new Date(transaction.date);

    // Payment Source Info
    const card = transaction.cardId;
    const bankLogo = card ? getBankLogo(card.bankShortName, card.bankName) : null;
    const sourceKindLabel = (cardType?: string) => {
        if (cardType === 'credit') return 'Thẻ tín dụng';
        if (cardType === 'debit') return 'Thẻ ghi nợ';
        if (cardType === 'eWallet') return 'Ví điện tử';
        if (cardType === 'savings') return 'Sổ tiết kiệm';
        return 'Tài khoản';
    };

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

                <div className="flex-1 overflow-y-auto px-4 pb-44 space-y-3 hide-scrollbar">
                    {/* Header (Icon, Amount, Category) */}
                    <div className="flex flex-col items-center mt-1">
                        {transaction.receiptImage ? (
                            <button onClick={() => setShowLightbox(true)} className="relative mb-3 mt-2 group">
                                <div className="relative w-28 h-36 rounded-2xl overflow-hidden bg-white border-[3px] border-white dark:border-slate-800 shadow-lg shadow-black/25 rotate-[-3deg] group-active:rotate-0 transition-transform duration-300">
                                    <img src={transaction.receiptImage} alt="Hóa đơn" className="w-full h-full object-cover" />
                                </div>
                                {/* Expand hint, top-left corner */}
                                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-slate-800/90 dark:bg-slate-700 flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm">
                                    <ActionIcon type="arrowUpRight" size={12} tile={false} color="#FFFFFF" />
                                </div>
                                {/* Category badge, bottom-right corner */}
                                <div className="absolute -bottom-2 -right-2">
                                    <CategoryIcon
                                        type={cat.catIconType || 'khac'}
                                        size={36}
                                        tile
                                        className="rounded-2xl ring-[3px] ring-white dark:ring-slate-900"
                                    />
                                </div>
                            </button>
                        ) : (
                            <CategoryIcon
                                type={cat.catIconType || 'khac'}
                                size={40}
                                tile
                                className="mb-1.5"
                            />
                        )}
                        <h2 className={cn(
                            "text-2xl font-black tracking-tight",
                            isIncome ? "text-emerald-500" : "text-slate-900 dark:text-white"
                        )}>
                            {isIncome ? '+' : '-'}{fmtFull(transaction.amount)}đ
                        </h2>
                        {/* Pills — category (colored), income/expense, and receipt presence */}
                        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap px-4">
                            <span className="px-3 py-1.5 rounded-full text-xs font-bold border"
                                style={{ backgroundColor: `${cat.color}15`, borderColor: `${cat.color}40`, color: cat.color }}>
                                {transaction.category}
                            </span>
                            <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {isIncome ? 'Thu nhập' : 'Chi tiêu'}
                            </span>
                            {transaction.receiptImage && (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <CustomIcon type="fileText" size={12} tile={false} color="currentColor" />
                                    Có hóa đơn
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Details Block */}
                    <div className="flex flex-col bg-white dark:bg-[#1A1D2D] border border-slate-200 dark:border-slate-800 rounded-2xl px-4 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
                        {/* Thời gian — date + weekday, time + part of day, merged into one row */}
                        <div className="flex items-center justify-between py-3.5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                    <ActionIcon type="calendar" size={18} tile={false} color="#7f19e6" />
                                </div>
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Thời gian</span>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">
                                    {date.toLocaleDateString('vi-VN', { weekday: 'short' })}, {date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                    {date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {date.getHours() < 12 ? 'Buổi sáng' : 'Buổi chiều'}
                                </p>
                            </div>
                        </div>

                        {/* Nguồn tiền — bank logo when a card is attached, generic icon for cash */}
                        <div className="flex items-center justify-between py-3.5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {bankLogo && !logoFailed ? (
                                        <img src={bankLogo} alt={card?.bankShortName} className="w-full h-full object-contain bg-white p-1.5" onError={() => setLogoFailed(true)} />
                                    ) : (
                                        <UtilityIcon type="wallet" size={18} tile={false} color="#3B82F6" />
                                    )}
                                </div>
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Nguồn tiền</span>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {card ? `${card.bankName}${card.cardNumber ? ' ••' + card.cardNumber : ''}` : 'Tiền mặt'}
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                    {card ? sourceKindLabel(card.cardType) : 'Chi tiêu bằng tiền mặt'}
                                </p>
                            </div>
                        </div>

                        {/* Ghi chú — only when present */}
                        {transaction.note && (
                            <div className="flex items-start justify-between gap-4 py-3.5">
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                        <CustomIcon type="fileText" size={18} tile={false} color="#F59E0B" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Ghi chú</span>
                                </div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 text-right italic break-words max-w-[55%]">"{transaction.note}"</p>
                            </div>
                        )}

                        {/* Mã giao dịch */}
                        <div className="flex items-center justify-between py-3.5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                    <CustomIcon type="alignJustify" size={18} tile={false} color="currentColor" className="text-slate-400" />
                                </div>
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Mã giao dịch</span>
                            </div>
                            <button onClick={() => copyToClipboard(transaction._id)} className="flex items-center gap-2 group">
                                <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 group-hover:text-purple-500 transition-colors">
                                    {transaction._id.slice(-8).toUpperCase()}
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                                    <CustomIcon type="copy" size={13} tile={false} color="currentColor" className="text-slate-400 group-hover:text-purple-500 transition-colors" />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Lightbox — full-size receipt view, tap anywhere to close */}
                {showLightbox && transaction.receiptImage && (
                    <div
                        className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center p-6 rounded-t-[32px] sm:rounded-[32px]"
                        onClick={() => setShowLightbox(false)}
                    >
                        <img src={transaction.receiptImage} alt="Hóa đơn" className="max-w-full max-h-full object-contain rounded-xl" />
                        <button
                            onClick={() => setShowLightbox(false)}
                            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                        >
                            <ActionIcon type="x" size={18} tile={false} color="#FFFFFF" />
                        </button>
                    </div>
                )}

                {/* Bottom Actions — one primary button, delete as a plain text link below (no "..." menu) */}
                <div className="absolute bottom-0 left-0 right-0 p-3 pb-4 bg-white/90 dark:bg-[#0F111A]/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {!isIncome && (
                        <button
                            onClick={() => setShowShareModal(true)}
                            className="w-full flex items-center justify-center h-11 gap-2 rounded-xl border border-[#7f19e6]/30 bg-[#7f19e6]/8 text-[#7f19e6] text-sm font-bold active:scale-[0.98] transition-all"
                        >
                            <ActionIcon type="user" size={16} tile={false} color="currentColor" />
                            Chia sẻ hoá đơn
                        </button>
                    )}
                    <button
                        onClick={() => onEdit?.(transaction)}
                        className="w-full flex items-center justify-center h-12 gap-2 rounded-xl bg-gradient-to-r from-[#7f19e6] to-[#9b4de8] text-white text-sm font-bold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.98] transition-all"
                    >
                        <ActionIcon type="pencil" size={16} tile={false} color="#FFFFFF" />
                        Sửa giao dịch
                    </button>
                    <button
                        onClick={() => onDelete?.(transaction._id)}
                        className="w-full flex items-center justify-center py-1 text-red-500 dark:text-red-400 text-sm font-bold hover:underline active:scale-[0.98] transition-all"
                    >
                        Xóa giao dịch này
                    </button>
                </div>

                <ExpenseShareModal
                    open={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    transaction={transaction}
                />
            </DialogContent>
        </Dialog>
    );
}
