'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CATEGORIES } from '@/lib/mockData';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { cn } from '@/lib/utils';
import { useCards } from '@/hooks/useCards';
import { useBanks } from '@/hooks/useBanks';
import { useTransactions } from '@/hooks/useTransactions';
import { toast } from 'sonner';
import { ArrowRight, RefreshCw, ScanLine } from 'lucide-react';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { getBankLogo } from '@/lib/bankLogos';
import PaymentCard from './cards/PaymentCard';
import BillScanner from './BillScanner';

interface AddTransactionModalProps {
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;
    defaultType?: 'expense' | 'income';
    initialData?: any;
    autoOpenScanner?: boolean;
}

export default function AddTransactionModal({
    open, onClose, onSaved, defaultType = 'expense', initialData, autoOpenScanner = false
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
    // Bill Scanner
    const [showScanner, setShowScanner] = useState(false);
    const [receiptImage, setReceiptImage] = useState('');
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
                setReceiptImage(initialData.receiptImage || '');
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
                setReceiptImage('');
                setShowScanner(autoOpenScanner);
            }
            setErrors({});
        }
    }, [open, defaultType, initialData, autoOpenScanner]);

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
                receiptImage: receiptImage || undefined,
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
  bg-[#F8F9FF] dark:bg-[#0F111A]
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
                {/* Drag Handle (Thanh kéo xuống) */}
                <div className="flex w-full items-center justify-center shrink-0 pt-3 pb-1 bg-[#F8F9FF] dark:bg-[#0F111A] z-10 rounded-t-3xl cursor-grab active:cursor-grabbing" onClick={onClose}>
                    <div className="h-[5px] w-12 rounded-full bg-slate-300 dark:bg-slate-600/80 hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors"></div>
                </div>
                <div className="flex items-center px-4 pb-3 shrink-0 bg-[#F8F9FF] dark:bg-[#0F111A] z-10 border-b border-slate-200/50 dark:border-slate-800/50">
                    <h2 className="text-xl font-bold flex-1 text-center text-[#000000] dark:text-white tracking-tight">
                        {initialData ? 'Sửa giao dịch' : 'Thêm giao dịch'}
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto pt-1 hide-scrollbar pb-24 bg-[#F8F9FF] dark:bg-[#0F111A] px-3 space-y-2.5">
                    {/* Toggle Type */}
                    <div className="flex gap-2 p-1 bg-white dark:bg-[#1A1D2D] border border-slate-200 dark:border-slate-800 rounded-xl">
                        {(['expense', 'income'] as const).map(t => (
                            <button key={t} onClick={() => { setType(t); setCategory(''); }}
                                className={cn('flex-1 py-1.5 px-3 text-sm font-bold rounded-lg transition-all',
                                    type === t ? 'bg-[#7f19e6]/10 dark:bg-[#7f19e6]/20 text-[#7f19e6] dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300')}>
                                {t === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
                            </button>
                        ))}
                    </div>

                    {/* ── Bill Scanner Panel ── */}
                    {showScanner && (
                        <div className="rounded-2xl border-2 border-[#7f19e6]/30 bg-purple-50/50 dark:bg-[#1A1D2D] p-4 animate-in fade-in zoom-in duration-200">
                            <BillScanner
                                onResult={(result) => {
                                    // Fill form with OCR results
                                    if (result.amount > 0) {
                                        setAmount(result.amount.toString());
                                    }
                                    if (result.date) {
                                        setDate(result.date);
                                    }
                                    if (result.note) {
                                        setNote(result.note);
                                    }
                                    if (result.suggestedCategory) {
                                        setCategory(result.suggestedCategory);
                                    }
                                    if (result.imageUrl) {
                                        setReceiptImage(result.imageUrl);
                                    }
                                    setShowScanner(false);
                                    setErrors({});
                                    toast.success('✅ Đã điền thông tin từ bill!');
                                }}
                                onClose={() => setShowScanner(false)}
                            />
                        </div>
                    )}

                    {/* Số tiền block */}
                    <div className="flex flex-col gap-2 bg-white dark:bg-[#1A1D2D] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Số tiền</label>
                        <div className={cn(
                            'flex w-full items-center gap-2 pb-1 border-b-2 transition-colors',
                            errors.amount ? 'border-red-400' : 'border-slate-200 dark:border-slate-700 focus-within:border-[#7f19e6]'
                        )}>
                            <span className="text-lg font-extrabold text-slate-400">₫</span>
                            <input
                                className="w-full flex-1 border-0 bg-transparent py-0.5 text-3xl font-extrabold text-[#000000] dark:text-white focus:ring-0 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                placeholder="0"
                                value={displayAmount}
                                onChange={e => { handleAmountInput(e.target.value); setErrors(p => ({ ...p, amount: '' })); }}
                                type="text"
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                            />
                        </div>
                        {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}

                        {/* Quick Amount Buttons */}
                        <div className="flex gap-2 overflow-x-auto hide-scrollbar pt-1">
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
                                        "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all border",
                                        btn.type === 'clear'
                                            ? "bg-red-50/50 dark:bg-red-900/10 text-red-500 border-red-200 dark:border-red-900/50"
                                            : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    )}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Danh mục block */}
                    <div className="flex flex-col gap-2 bg-white dark:bg-[#1A1D2D] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            Danh mục
                            {errors.category && <span className="text-red-500 font-normal text-xs ml-2">{errors.category}</span>}
                        </h3>
                        <div className="grid grid-cols-5 gap-y-3 gap-x-2">
                            {filteredCategories.map(cat => (
                                <div key={cat.id} onClick={() => { setCategory(cat.label); setErrors(p => ({ ...p, category: '' })); }} className="flex flex-col items-center gap-1 group cursor-pointer">
                                    <div className={cn('rounded-[10px] transition-all',
                                        category === cat.label
                                            ? 'ring-2 ring-[#7f19e6] ring-offset-1 dark:ring-offset-[#0F111A]'
                                            : errors.category
                                                ? 'ring-1 ring-red-300'
                                                : 'group-hover:ring-1 group-hover:ring-slate-300')}>
                                        <CategoryIcon
                                            type={cat.catIconType}
                                            size={42}
                                            tile
                                            color={category === cat.label ? '#7f19e6' : undefined}
                                        />
                                    </div>
                                    <span className={cn('text-[10px] font-bold text-center leading-tight', category === cat.label ? 'text-[#7f19e6] dark:text-purple-400' : 'text-slate-600 dark:text-slate-400')}>
                                        {cat.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Phương thức thanh toán block */}
                    <div className="flex flex-col gap-2 bg-white dark:bg-[#1A1D2D] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Phương thức thanh toán</h3>
                        <div className="flex gap-2 p-1 bg-slate-50 dark:bg-[#0F111A] border border-slate-200 dark:border-slate-800 rounded-xl">
                            <button onClick={() => setPaymentTab('cash')} className={cn('flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition-colors', paymentTab === 'cash' ? 'bg-white dark:bg-[#1A1D2D] text-[#7f19e6] dark:text-purple-400 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>Tiền mặt</button>
                            <button onClick={() => setPaymentTab('account')} className={cn('flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition-colors', paymentTab === 'account' ? 'bg-white dark:bg-[#1A1D2D] text-[#7f19e6] dark:text-purple-400 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>Tài khoản</button>
                            <button onClick={() => setPaymentTab('credit')} className={cn('flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition-colors', paymentTab === 'credit' ? 'bg-white dark:bg-[#1A1D2D] text-[#7f19e6] dark:text-purple-400 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>Thẻ tín dụng</button>
                        </div>

                        <div className="flex gap-3 overflow-x-auto hide-scrollbar snap-x py-1 pt-2">
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
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-surface hover:border-slate-300 dark:hover:border-slate-600'
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
                                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-surface text-slate-600 dark:text-slate-400 hover:border-[#7f19e6]/50'
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

                    {/* Ngày giao dịch block */}
                    <div className="flex flex-col gap-1.5 bg-white dark:bg-[#1A1D2D] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Ngày giao dịch</label>
                        <div className="relative">
                            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <button className="flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F111A] p-2.5 text-left hover:border-slate-300 dark:hover:border-slate-600 transition-colors focus:outline-none focus:ring-1 focus:ring-[#7f19e6]">
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatDateStr(date)}</span>
                                <ActionIcon type="calendar" size={16} tile={false} color="#94A3B8" />
                            </button>
                        </div>
                    </div>

                    {/* Ghi chú block */}
                    <div className="flex flex-col gap-1.5 bg-white dark:bg-[#1A1D2D] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Ghi chú <span className="font-normal text-slate-400">(tùy chọn)</span></label>
                            <span className="text-[10px] font-medium text-slate-400">{note.length}/200</span>
                        </div>
                        <textarea
                            value={note} onChange={e => setNote(e.target.value)} maxLength={200}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F111A] p-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-[#7f19e6] focus:ring-1 focus:ring-[#7f19e6] focus:outline-none resize-none h-16"
                            placeholder="Thêm ghi chú..."></textarea>
                    </div>

                    {/* Đính kèm hóa đơn block - Only show when there is an image */}
                    {receiptImage && (
                        <div className="flex flex-col gap-1.5 bg-white dark:bg-[#1A1D2D] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm pb-4">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Ảnh hóa đơn đính kèm</label>
                            <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F111A] p-3 flex gap-4 items-center">
                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-100 dark:bg-slate-800">
                                    <img src={receiptImage} alt="Receipt" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Hóa đơn đã quét</p>
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                                        <ActionIcon type="check" size={12} tile={false} color="#10B981" /> Tự động điền dữ liệu
                                    </p>
                                </div>
                                <button
                                    onClick={() => setReceiptImage('')}
                                    className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                                >
                                    <ActionIcon type="x" size={16} tile={false} color="#6B7280" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/90 dark:bg-[#0F111A]/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-2 w-full">
                        {/* Nút Đóng */}
                        <div className="flex-1 flex justify-start">
                            <button onClick={onClose}
                                className="flex w-full max-w-[100px] items-center justify-center h-12 gap-1.5 rounded-xl bg-slate-100 dark:bg-[#1A1D2D] hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 font-bold text-sm">
                                <ActionIcon type="x" size={16} tile={false} color="#6B7280" />
                                <span>Đóng</span>
                            </button>
                        </div>

                        {/* Nút Quét */}
                        <div className="flex flex-col items-center flex-shrink-0 w-[140px]">
                            <button onClick={() => setShowScanner(true)}
                                className="w-full relative overflow-hidden flex items-center justify-center h-12 gap-1.5 rounded-xl border border-[#7f19e6]/50 dark:border-[#7f19e6]/70 bg-transparent hover:bg-[#7f19e6]/10 shadow-[0_0_15px_rgba(127,25,230,0.2)] dark:shadow-[0_0_15px_rgba(127,25,230,0.3)] hover:shadow-[0_0_20px_rgba(127,25,230,0.4)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 text-[#000000] dark:text-white font-bold text-sm group">
                                <div className="absolute inset-0 w-1/4 h-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent -skew-x-12 -translate-x-24 group-hover:animate-[shimmer_1s_ease-in-out_infinite]" />
                                <ScanLine className="w-4 h-4 text-[#7f19e6] dark:text-purple-400 group-hover:scale-110 transition-transform duration-300" />
                                <span>Quét Bill</span>
                            </button>
                            <span className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">Quét mã QR / hóa đơn</span>
                        </div>

                        {/* Nút Thêm giao dịch */}
                        <div className="flex-1 flex justify-end">
                            <button onClick={handleSave} disabled={saving}
                                className="w-full max-w-[160px] flex items-center justify-center h-12 gap-1.5 bg-gradient-to-r from-[#7f19e6] to-[#9b4de8] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#7f19e6]/30 hover:shadow-[#7f19e6]/50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                <span>{saving ? 'Đang lưu...' : (initialData ? 'Cập nhật' : 'Thêm')}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
