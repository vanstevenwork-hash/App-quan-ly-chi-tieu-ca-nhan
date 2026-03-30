'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CATEGORIES } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { useCards } from '@/hooks/useCards';
import { useBanks } from '@/hooks/useBanks';
import { useTransactions } from '@/hooks/useTransactions';
import { toast } from 'sonner';
import { Banknote, ArrowRight, Calendar, Check, RefreshCw } from 'lucide-react';
import { getBankLogo } from '@/lib/bankLogos';
import PaymentCard from './cards/PaymentCard';

interface AddTransactionModalProps {
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;
    defaultType?: 'expense' | 'income';
    initialData?: any;
}

export default function AddTransactionModal({
    open, onClose, onSaved, defaultType = 'expense', initialData
}: AddTransactionModalProps) {
    const [type, setType] = useState<'expense' | 'income'>(defaultType);
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [note, setNote] = useState('');
    const [paymentTab, setPaymentTab] = useState<'cash' | 'account' | 'credit'>('cash');
    const [selectedCardId, setSelectedCardId] = useState<string>('cash');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [saving, setSaving] = useState(false);
    const { createTransaction, updateTransaction } = useTransactions();
    const [errors, setErrors] = useState<{ amount?: string; category?: string }>({});
    // Installment (Trả góp)
    const [isInstallment, setIsInstallment] = useState(false);
    const [installmentMonths, setInstallmentMonths] = useState(12);
    const { banks: fetchedBanks, fetchBanks } = useBanks();

    const { cards } = useCards();

    useEffect(() => {
        fetchBanks();
    }, [fetchBanks]);

    const debitCards = cards.filter(c => c.cardType === 'debit' || c.cardType === 'eWallet');
    const creditCards = cards.filter(c => c.cardType === 'credit');
    const cashCards = cards.filter(c =>
        c.bankName.toLowerCase().includes('tiền mặt') ||
        c.bankName.toLowerCase().includes('ví') ||
        c.cardType === 'eWallet'
    );

    useEffect(() => {
        if (open) {
            if (initialData) {
                setType(initialData.type);
                setAmount(initialData.amount?.toString());
                setCategory(initialData.category);
                setNote(initialData.note || '');
                setDate(new Date(initialData.date).toISOString().slice(0, 10));

                if (initialData.paymentMethod === 'cash') {
                    setPaymentTab('cash');
                } else {
                    const cardIdStr = initialData.cardId?._id || initialData.cardId;
                    // Try to find if it's debit or credit
                    const isCredit = creditCards.find(c => c._id === cardIdStr);
                    setPaymentTab(isCredit ? 'credit' : 'account');
                    setSelectedCardId(cardIdStr);
                }

                setIsInstallment(initialData.isInstallment || false);
                setInstallmentMonths(initialData.installmentMonths || 12);
            } else {
                setType(defaultType);
                setAmount('');
                setCategory('');
                setNote('');
                setDate(new Date().toISOString().slice(0, 10));
                setPaymentTab('cash');
                setSelectedCardId('cash');
                setIsInstallment(false);
                setInstallmentMonths(12);
            }
            setErrors({});
        }
    }, [open, defaultType, initialData]);

    // Update selected card automatically when tab changes or card lists update
    useEffect(() => {
        if (paymentTab === 'cash') {
            // Try to find a card representing Cash/Wallet
            const cashCard = cards.find(c =>
                c.bankName.toLowerCase().includes('tiền mặt') ||
                c.bankName.toLowerCase().includes('ví') ||
                c.cardType === 'eWallet'
            );
            if (cashCard && (selectedCardId === 'cash' || !cards.find(c => c._id === selectedCardId))) {
                setSelectedCardId(cashCard._id);
            }
        } else if (paymentTab === 'account') {
            if (debitCards.length > 0 && (selectedCardId === 'cash' || !debitCards.find(c => c._id === selectedCardId))) {
                setSelectedCardId(debitCards[0]._id);
            }
        } else if (paymentTab === 'credit') {
            if (creditCards.length > 0 && (selectedCardId === 'cash' || !creditCards.find(c => c._id === selectedCardId))) {
                setSelectedCardId(creditCards[0]._id);
            }
        }
    }, [paymentTab, debitCards, creditCards, cards]);

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
    const amountNum = parseInt(amount) || 0;
    const monthlyPayment = isInstallment && installmentMonths > 0 ? Math.ceil(amountNum / installmentMonths) : 0;

    const handleSave = async () => {
        const errs: { amount?: string; category?: string } = {};
        if (!amount || parseInt(amount) <= 0) errs.amount = 'Vui lòng nhập số tiền hợp lệ';
        if (!category) errs.category = 'Vui lòng chọn danh mục';
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        setSaving(true);
        try {
            const payload = {
                type,
                amount: parseInt(amount),
                category,
                note,
                date: new Date(date),
                paymentMethod: selectedCardId === 'cash' ? 'cash' : 'card',
                cardId: selectedCardId === 'cash' ? null : selectedCardId,
                isInstallment: paymentTab === 'credit' && isInstallment,
                installmentMonths: paymentTab === 'credit' && isInstallment ? installmentMonths : 0,
                installmentMonthly: paymentTab === 'credit' && isInstallment ? monthlyPayment : 0,
                installmentStartDate: paymentTab === 'credit' && isInstallment ? new Date(date) : undefined,
            };

            console.log('Saving transaction payload:', payload);

            if (initialData?._id) {
                await updateTransaction(initialData._id, payload);
                toast.success('Đã cập nhật giao dịch!');
            } else {
                await createTransaction(payload);
                if (isInstallment && paymentTab === 'credit') {
                    toast.success(`💳 Đã thêm trả góp! Mỗi tháng: ${monthlyPayment.toLocaleString('vi-VN')}₫`);
                } else {
                    toast.success(type === 'income' ? '💰 Đã thêm thu nhập!' : '💸 Đã thêm chi tiêu!');
                }
            }
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
            <DialogContent className="
  fixed inset-x-0 bottom-0 top-[20vh] z-50
  w-full max-w-md mx-auto gap-2
  !translate-x-0 !translate-y-0
  bg-white dark:bg-slate-900
  rounded-t-3xl sm:rounded-3xl
  shadow-xl flex flex-col
  overflow-hidden
  p-0 border-0
  data-[state=open]:animate-in
  data-[state=closed]:animate-out
  data-[state=open]:slide-in-from-bottom
  data-[state=closed]:slide-out-to-bottom
  duration-200
">
                <button className="flex h-5 w-full items-center justify-center shrink-0 pt-2 pb-1 bg-white dark:bg-slate-900 z-10" onClick={onClose}>
                    <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                </button>
                <div className="flex items-center px-4 pb-2 shrink-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold flex-1 text-center text-[#000000] dark:text-white">
                        {initialData ? 'Sửa giao dịch' : 'Thêm giao dịch'}
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto pt-1 hide-scrollbar pb-20 bg-white dark:bg-slate-900 px-4 space-y-3">
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
                            'flex w-full items-stretch rounded-xl bg-white dark:bg-slate-900 overflow-hidden focus-within:ring-1 transition-colors',
                            errors.amount
                                ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-400'
                                : 'border-slate-200 dark:border-slate-700 focus-within:border-[#7f19e6] focus-within:ring-[#7f19e6]'
                        )}>
                            {/* <div className="flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                <Banknote className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                            </div> */}
                            <input
                                className="w-full flex-1 border-0 bg-transparent py-3 px-3 text-2xl font-bold text-[#000000] dark:text-white focus:ring-0 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                placeholder="0"
                                value={displayAmount}
                                onChange={e => { handleAmountInput(e.target.value); setErrors(p => ({ ...p, amount: '' })); }}
                                type="text"
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                            />
                            {/* <div className="flex items-center justify-center px-4 text-[#000000] dark:text-white font-bold">
                                VND
                            </div> */}
                        </div>
                        {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}

                        {/* Quick Amount Buttons */}
                        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
                            {[
                                { label: 'C', value: '', type: 'clear' },
                                { label: '000', value: '000', type: 'append' },
                                { label: '+50k', value: 50000, type: 'add' },
                                { label: '+100k', value: 100000, type: 'add' },
                                { label: '+200k', value: 200000, type: 'add' },
                                { label: '+500k', value: 500000, type: 'add' },
                                { label: '+1M', value: 1000000, type: 'add' },
                            ].map((btn, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                        if (btn.type === 'clear') {
                                            setAmount('');
                                        } else if (btn.type === 'append') {
                                            if (amount) setAmount(curr => curr + btn.value);
                                        } else {
                                            const curr = parseInt(amount) || 0;
                                            setAmount((curr + (btn.value as number)).toString());
                                        }
                                        setErrors(p => ({ ...p, amount: '' }));
                                    }}
                                    className={cn(
                                        "flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold active:scale-95 transition-all border",
                                        btn.type === 'clear'
                                            ? "bg-red-50 dark:bg-red-900/20 text-red-500 border-red-100 dark:border-red-900/30"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    )}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-bold text-[#000000] dark:text-white">
                            Danh mục
                            {errors.category && <span className="text-red-500 font-normal text-xs ml-2">{errors.category}</span>}
                        </h3>
                        <div className="grid grid-cols-5 gap-2">
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

                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-bold text-[#000000] dark:text-white">Phương thức thanh toán</h3>
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <button onClick={() => setPaymentTab('cash')} className={cn('flex-1 py-2 px-3 text-sm font-bold rounded-md transition-colors', paymentTab === 'cash' ? 'bg-white dark:bg-slate-700 text-[#7f19e6] dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')}>Tiền mặt</button>
                            <button onClick={() => setPaymentTab('account')} className={cn('flex-1 py-2 px-3 text-sm font-bold rounded-md transition-colors', paymentTab === 'account' ? 'bg-white dark:bg-slate-700 text-[#7f19e6] dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')}>Tài khoản</button>
                            <button onClick={() => setPaymentTab('credit')} className={cn('flex-1 py-2 px-3 text-sm font-bold rounded-md transition-colors', paymentTab === 'credit' ? 'bg-white dark:bg-slate-700 text-[#7f19e6] dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')}>Thẻ tín dụng</button>
                        </div>

                        <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x py-1 pt-1.5 mt-1 -mx-4 px-4">
                            {(paymentTab === 'cash' ? cashCards : paymentTab === 'account' ? debitCards : creditCards).map(card => {
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
                                const logoUrl = selectedBankObj?.logo || getBankLogo(card.bankShortName, card.bankName);

                                if (paymentTab === 'credit') {
                                    return (
                                        <PaymentCard
                                            key={card._id}
                                            card={card}
                                            isSelected={selectedCardId === card._id}
                                            onSelect={setSelectedCardId}
                                            logoUrl={logoUrl}
                                            cBg={cBg}
                                            type="credit"
                                            renderNetworkLogo={renderNetworkLogo}
                                        />
                                    );
                                }

                                // Render for Debit / E-Wallet / Cash
                                return (

                                    <PaymentCard
                                        key={card._id}
                                        card={card}
                                        isSelected={selectedCardId === card._id}
                                        onSelect={setSelectedCardId}
                                        logoUrl={logoUrl}
                                        cBg={cBg}
                                        type={paymentTab === 'cash' ? 'account' : 'account'}
                                    />
                                )
                            })}
                            {/* {(paymentTab === 'cash' ? cashCards : paymentTab === 'account' ? debitCards : creditCards).length === 0 && (
                                <div className="text-sm text-slate-500 italic px-2 py-3">Không có thẻ nào</div>
                            )} */}
                        </div>
                    </div>

                    {/* ── Installment (Trả góp) — only for credit tab ── */}
                    {paymentTab === 'credit' && type === 'expense' && (
                        <div className="flex flex-col gap-2">
                            {/* Toggle row */}
                            <button
                                type="button"
                                onClick={() => setIsInstallment(v => !v)}
                                className={cn(
                                    'flex items-center justify-between w-full rounded-xl p-3 border-2 transition-all',
                                    isInstallment
                                        ? 'border-[#7f19e6] bg-[#7f19e6]/5 dark:bg-purple-900/20'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                                        isInstallment ? 'bg-[#7f19e6] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                    )}>
                                        <RefreshCw className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                        <p className={cn('text-sm font-bold', isInstallment ? 'text-[#7f19e6]' : 'text-slate-700 dark:text-slate-300')}>
                                            Trả góp 0% lãi suất
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">Chia nhỏ dư nợ hàng tháng</p>
                                    </div>
                                </div>
                                <div className={cn(
                                    'w-12 h-6 rounded-full transition-colors flex items-center px-1 flex-shrink-0',
                                    isInstallment ? 'bg-[#7f19e6]' : 'bg-slate-200 dark:bg-slate-700'
                                )}>
                                    <div className={cn(
                                        'w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                                        isInstallment ? 'translate-x-6' : 'translate-x-0'
                                    )} />
                                </div>
                            </button>

                            {/* Installment options */}
                            {isInstallment && (
                                <div className="space-y-3 px-1">
                                    <div>
                                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">Số kỳ thanh toán</p>
                                        <div className="grid grid-cols-6 gap-1.5">
                                            {[3, 6, 12, 18, 24, 36].map(m => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => setInstallmentMonths(m)}
                                                    className={cn(
                                                        'py-2 rounded-xl text-sm font-bold border-2 transition-all',
                                                        installmentMonths === m
                                                            ? 'border-[#7f19e6] bg-[#7f19e6] text-white shadow-md shadow-[#7f19e6]/30'
                                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-[#7f19e6]/50'
                                                    )}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 text-right">{installmentMonths} tháng</p>
                                    </div>

                                    {amountNum > 0 ? (
                                        <div className="rounded-2xl overflow-hidden border border-[#7f19e6]/20 bg-gradient-to-br from-[#7f19e6]/5 to-purple-50 dark:from-purple-900/20 dark:to-slate-900">
                                            <div className="flex items-stretch">
                                                <div className="flex-1 p-3 text-center border-r border-[#7f19e6]/10">
                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-0.5">Tổng dư nợ</p>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                        {amountNum.toLocaleString('vi-VN')}₫
                                                    </p>
                                                </div>
                                                <div className="flex-1 p-3 text-center border-r border-[#7f19e6]/10">
                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-0.5">Số kỳ</p>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                        {installmentMonths} tháng
                                                    </p>
                                                </div>
                                                <div className="flex-1 p-3 text-center bg-[#7f19e6]/10 dark:bg-purple-900/30">
                                                    <p className="text-[10px] text-[#7f19e6] dark:text-purple-400 font-bold mb-0.5">Mỗi tháng</p>
                                                    <p className="text-sm font-bold text-[#7f19e6] dark:text-purple-300">
                                                        {monthlyPayment.toLocaleString('vi-VN')}₫
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-center text-slate-400 italic">Nhập số tiền để xem số tiền mỗi tháng</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

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
                        className="w-full bg-gradient-to-r from-[#7f19e6] to-[#9b4de8] text-white rounded-xl py-3 text-lg font-bold shadow-lg shadow-[#7f19e6]/30 hover:shadow-[#7f19e6]/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <span>{saving ? 'Đang lưu...' : (initialData ? 'Cập nhật' : 'Thêm ngay')}</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
