'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CATEGORIES } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { useCards } from '@/hooks/useCards';
import { useBanks } from '@/hooks/useBanks';
import { transactionsApi } from '@/lib/api';
import { toast } from 'sonner';
import { Banknote, ArrowRight, Calendar, Check } from 'lucide-react';

interface AddTransactionModalProps {
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;
    defaultType?: 'expense' | 'income';
}

export default function AddTransactionModal({
    open, onClose, onSaved, defaultType = 'expense',
}: AddTransactionModalProps) {
    const [type, setType] = useState<'expense' | 'income'>(defaultType);
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [note, setNote] = useState('');
    const [paymentTab, setPaymentTab] = useState<'cash' | 'account' | 'credit'>('cash');
    const [selectedCardId, setSelectedCardId] = useState<string>('cash');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<{ amount?: string; category?: string }>({});
    const { banks: fetchedBanks, fetchBanks } = useBanks();

    const { cards } = useCards();

    useEffect(() => {
        fetchBanks();
    }, [fetchBanks]);

    const debitCards = cards.filter(c => c.cardType === 'debit' || c.cardType === 'eWallet');
    const creditCards = cards.filter(c => c.cardType === 'credit');

    useEffect(() => {
        if (open) {
            setType(defaultType);
            setAmount('');
            setCategory('');
            setNote('');
            setDate(new Date().toISOString().slice(0, 10));
            setPaymentTab('cash');
            setSelectedCardId('cash');
            setErrors({});
        }
    }, [open, defaultType]);

    // Update selected card automatically when tab changes
    useEffect(() => {
        if (paymentTab === 'cash') setSelectedCardId('cash');
        else if (paymentTab === 'account') {
            setSelectedCardId(debitCards.length > 0 ? debitCards[0]._id : '');
        } else if (paymentTab === 'credit') {
            setSelectedCardId(creditCards.length > 0 ? creditCards[0]._id : '');
        }
    }, [paymentTab]);

    const handleAmountInput = (v: string) => {
        setAmount(v.replace(/\D/g, ''));
    };

    const INCOME_CATS = ['Lương', 'Freelance', 'Đầu tư', 'Thưởng', 'Tiền lãi', 'Khác'];
    const filteredCategories = CATEGORIES.filter(c =>
        type === 'income'
            ? INCOME_CATS.includes(c.label)
            : !['Lương', 'Freelance', 'Đầu tư', 'Thưởng', 'Tiền lãi'].includes(c.label)
    );

    const displayAmount = amount ? parseInt(amount).toLocaleString('vi-VN') : '';

    const handleSave = async () => {
        const errs: { amount?: string; category?: string } = {};
        if (!amount || parseInt(amount) <= 0) errs.amount = 'Vui lòng nhập số tiền hợp lệ';
        if (!category) errs.category = 'Vui lòng chọn danh mục';
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        setSaving(true);
        try {
            await transactionsApi.create({
                type,
                amount: parseInt(amount),
                category,
                note,
                date: new Date(date),
                paymentMethod: paymentTab === 'cash' ? 'cash' : 'card',
                cardId: paymentTab === 'cash' ? null : selectedCardId,
            });
            toast.success(type === 'income' ? '💰 Đã thêm thu nhập!' : '💸 Đã thêm chi tiêu!');
            onSaved?.();
            onClose();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Thêm giao dịch thất bại';
            toast.error(`Lỗi: ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    const formatDateStr = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const isToday = new Date().toDateString() === d.toDateString();
        return `${isToday ? 'Hôm nay, ' : ''}${d.getDate()} Thg ${d.getMonth() + 1}`;
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden p-0 border-0">
                <button className="flex h-6 w-full items-center justify-center shrink-0 pt-2 pb-1 bg-white dark:bg-slate-900 z-10" onClick={onClose}>
                    <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                </button>
                <div className="flex items-center px-4 py-3 shrink-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold flex-1 text-center text-[#000000] dark:text-white">Thêm giao dịch</h2>
                </div>

                <div className="flex-1 overflow-y-auto hide-scrollbar pb-24 bg-white dark:bg-slate-900 px-4 pt-4 space-y-6">
                    {/* Toggle Type */}
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        {(['expense', 'income'] as const).map(t => (
                            <button key={t} onClick={() => { setType(t); setCategory(''); }}
                                className={cn('flex-1 py-1.5 px-3 text-sm font-bold rounded-md transition-colors',
                                    type === t ? 'bg-white dark:bg-slate-700 text-[#7f19e6] dark:text-purple-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300')}>
                                {t === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-[#000000] dark:text-white">Số tiền</label>
                        <div className={cn(
                            'flex w-full items-stretch rounded-xl border bg-white dark:bg-slate-900 overflow-hidden focus-within:ring-1 transition-colors',
                            errors.amount
                                ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-400'
                                : 'border-slate-200 dark:border-slate-700 focus-within:border-[#7f19e6] focus-within:ring-[#7f19e6]'
                        )}>
                            <div className="flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                <Banknote className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                            </div>
                            <input
                                className="w-full flex-1 border-0 bg-transparent py-4 px-3 text-2xl font-bold text-[#000000] dark:text-white focus:ring-0 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                placeholder="0"
                                value={displayAmount}
                                onChange={e => { handleAmountInput(e.target.value); setErrors(p => ({ ...p, amount: '' })); }}
                                type="text"
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                            />
                            <div className="flex items-center justify-center px-4 text-[#000000] dark:text-white font-bold">
                                VND
                            </div>
                        </div>
                        {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                    </div>

                    <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-[#000000] dark:text-white">
                            Danh mục
                            {errors.category && <span className="text-red-500 font-normal text-xs ml-2">{errors.category}</span>}
                        </h3>
                        <div className="grid grid-cols-4 gap-2">
                            {filteredCategories.map(cat => (
                                <div key={cat.id} onClick={() => { setCategory(cat.label); setErrors(p => ({ ...p, category: '' })); }} className="flex flex-col items-center gap-2 group cursor-pointer">
                                    <div className={cn('w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all',
                                        category === cat.label
                                            ? 'bg-[#7f19e6]/10 text-[#7f19e6] dark:text-purple-400 border-[#7f19e6]'
                                            : errors.category
                                                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 group-hover:border-red-300'
                                                : 'bg-slate-50 dark:bg-slate-800 border-transparent group-hover:bg-slate-100 dark:group-hover:bg-slate-700')}
                                        style={category === cat.label ? {} : { color: cat.color }}>
                                        <span className="text-2xl">{cat.icon}</span>
                                    </div>
                                    <span className={cn('text-[11px] font-bold text-center', category === cat.label ? 'text-[#7f19e6] dark:text-purple-400' : 'text-slate-800 dark:text-slate-300')}>
                                        {cat.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-[#000000] dark:text-white">Phương thức thanh toán</h3>
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <button onClick={() => setPaymentTab('cash')} className={cn('flex-1 py-2 px-3 text-sm font-bold rounded-md transition-colors', paymentTab === 'cash' ? 'bg-white dark:bg-slate-700 text-[#7f19e6] dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')}>Tiền mặt</button>
                            <button onClick={() => setPaymentTab('account')} className={cn('flex-1 py-2 px-3 text-sm font-bold rounded-md transition-colors', paymentTab === 'account' ? 'bg-white dark:bg-slate-700 text-[#7f19e6] dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')}>Tài khoản</button>
                            <button onClick={() => setPaymentTab('credit')} className={cn('flex-1 py-2 px-3 text-sm font-bold rounded-md transition-colors', paymentTab === 'credit' ? 'bg-white dark:bg-slate-700 text-[#7f19e6] dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')}>Thẻ tín dụng</button>
                        </div>

                        {(paymentTab === 'account' || paymentTab === 'credit') && (
                            <div className="flex gap-3 overflow-x-auto hide-scrollbar snap-x py-1 mt-2 -mx-4 px-4">
                                {(paymentTab === 'account' ? debitCards : creditCards).map(card => {
                                    const isSelected = selectedCardId === card._id;
                                    const cBg = card.bankColor || '#3B82F6';

                                    const renderNetworkLogo = (network?: string) => {
                                        switch (network) {
                                            case 'visa': return <span className="font-bold italic text-blue-900 text-sm tracking-tighter">VISA</span>;
                                            case 'mastercard': return <div className="flex -space-x-1.5 opacity-90"><div className="w-4 h-4 rounded-full bg-red-500 mix-blend-multiply"></div><div className="w-4 h-4 rounded-full bg-amber-400 mix-blend-multiply"></div></div>;
                                            case 'jcb': return <span className="font-bold text-green-600 text-xs">JCB</span>;
                                            case 'amex': return <span className="font-bold text-blue-600 text-[10px] bg-blue-50 px-1 py-0.5 rounded border border-blue-200">AMEX</span>;
                                            case 'napas': return <span className="font-bold text-green-500 text-xs">NAPAS</span>;
                                            default: return null;
                                        }
                                    };

                                    const selectedBankObj = fetchedBanks.find(b => b.shortName === card.bankShortName);

                                    if (paymentTab === 'credit') {
                                        return (
                                            <div key={card._id} onClick={() => setSelectedCardId(card._id)}
                                                className={cn("snap-start shrink-0 w-44 p-3 rounded-2xl border-2 relative cursor-pointer flex flex-col justify-between transition-colors min-h-[100px]",
                                                    isSelected ? 'border-[#7f19e6] bg-[#7f19e6]/5 dark:bg-purple-900/20' : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-600')}>

                                                {/* Top Row: Bank Badge & Checkmark */}
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {selectedBankObj?.logo ? (
                                                            <div className="w-8 h-8 p-1 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center">
                                                                <img src={selectedBankObj.logo} className="w-full h-full object-contain" alt="logo" />
                                                            </div>
                                                        ) : (
                                                            <div className="px-2.5 py-1 rounded-md text-white text-[11px] font-bold shadow-sm" style={{ backgroundColor: cBg }}>
                                                                {card.bankShortName?.slice(0, 6) || card.cardType.toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isSelected && (
                                                        <div className="w-4 h-4 rounded-full border border-[#7f19e6] flex items-center justify-center bg-white dark:bg-slate-900">
                                                            <Check className="w-2.5 h-2.5 text-[#7f19e6] dark:text-purple-400 stroke-[3]" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Middle: Card Name */}
                                                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight mb-3">
                                                    {card.bankName}
                                                </p>

                                                {/* Bottom Row: Card Mask & Network */}
                                                <div className="flex justify-between items-end mt-auto">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-widest">
                                                        **** {card.cardNumber || '....'}
                                                    </p>
                                                    <div>
                                                        {renderNetworkLogo(card.cardNetwork)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Render for Debit / E-Wallet
                                    return (
                                        <div key={card._id} onClick={() => setSelectedCardId(card._id)}
                                            className={cn("snap-start shrink-0 w-36 p-3 rounded-xl border-2 relative overflow-hidden cursor-pointer flex flex-col gap-3 transition-colors",
                                                isSelected ? 'border-[#7f19e6] bg-[#7f19e6]/5 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600')}>
                                            {isSelected && (
                                                <div className="absolute top-0 right-0 p-1">
                                                    <div className="w-5 h-5 rounded-full bg-[#7f19e6] flex items-center justify-center">
                                                        <Check className="w-3 h-3 text-white stroke-[3]" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: cBg }}>
                                                {card.bankShortName?.slice(0, 4) || card.cardType}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[#000000] dark:text-white truncate">{card.bankName}</p>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.cardType === 'eWallet' ? 'Ví điện tử' : card.cardType === 'savings' ? 'Sổ tiết kiệm' : 'Ngân hàng'}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                                {(paymentTab === 'account' ? debitCards : creditCards).length === 0 && (
                                    <div className="text-sm text-slate-500 italic px-2 py-4">Không có thẻ nào</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-[#000000] dark:text-white">Ngày giao dịch</label>
                        <div className="relative">
                            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <button className="flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-left hover:border-slate-300 dark:hover:border-slate-600 transition-colors focus:outline-none focus:ring-1 focus:ring-[#7f19e6]">
                                <span className="text-base font-bold text-[#000000] dark:text-white">{formatDateStr(date)}</span>
                                <Calendar className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 pb-6">
                        <label className="text-sm font-bold text-[#000000] dark:text-white">Ghi chú</label>
                        <textarea
                            value={note} onChange={e => setNote(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-base text-[#000000] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#7f19e6] focus:ring-1 focus:ring-[#7f19e6] focus:outline-none resize-none h-24"
                            placeholder="Ví dụ: Ăn trưa với đối tác..."></textarea>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
                    <button onClick={handleSave} disabled={saving}
                        className="w-full bg-gradient-to-r from-[#7f19e6] to-[#9b4de8] text-white rounded-xl py-4 text-lg font-bold shadow-lg shadow-[#7f19e6]/30 hover:shadow-[#7f19e6]/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <span>{saving ? 'Đang lưu...' : 'Thêm ngay'}</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
