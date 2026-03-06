'use client';
import { useState, useEffect } from 'react';
import { X, CreditCard, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cardsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Card } from '@/hooks/useCards';
import { useBanks } from '@/hooks/useBanks';

const E_WALLETS = [
    { name: 'MoMo', short: 'MoMo', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-MoMo-Square.png', color: '#A50064' },
    { name: 'ZaloPay', short: 'ZaloPay', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-ZaloPay-Square.png', color: '#0068FF' },
    { name: 'VNPay', short: 'VNPay', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-VNPAY-QR.png', color: '#005BAA' },
    { name: 'Viettel Money', short: 'ViettelMoney', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-Viettel-Money-Square.png', color: '#EE0033' },
    { name: 'ShopeePay', short: 'ShopeePay', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-ShopeePay-Square.png', color: '#EE4D2D' }
];

interface CardPaymentModalProps {
    open: boolean;
    onClose: () => void;
    onPaid?: () => void;
    creditCards: Card[];
    accounts?: Card[];
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
    return `${n}`;
};

const QUICK_PRESETS = (balance: number, minPay: number) => [
    { label: `Tối thiểu\n${fmtShort(minPay)}đ`, value: minPay },
    { label: `50%\n${fmtShort(balance * 0.5)}đ`, value: Math.ceil(balance * 0.5) },
    { label: `Toàn bộ\n${fmtShort(balance)}đ`, value: balance },
];

export default function CardPaymentModal({ open, onClose, onPaid, creditCards, accounts }: CardPaymentModalProps) {
    const [mounted, setMounted] = useState(false);
    const [selectedId, setSelectedId] = useState('');
    const [sourceId, setSourceId] = useState('');
    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const { banks } = useBanks();

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (open) {
            // auto-select the card with highest balance
            const first = creditCards.sort((a, b) => b.balance - a.balance)[0];
            setSelectedId(first?._id || '');
            setAmount('');
        }
    }, [open, creditCards]);

    useEffect(() => {
        if (!selectedId || !accounts?.length) return;
        const creditCard = creditCards.find(c => c._id === selectedId);
        if (creditCard) {
            // Priority: Same bank -> Any other account (highest balance first)
            const sameBank = accounts.find(a => a.bankShortName === creditCard.bankShortName);
            if (sameBank) {
                setSourceId(sameBank._id);
            } else {
                setSourceId(accounts.sort((a, b) => b.balance - a.balance)[0]?._id || '');
            }
        }
    }, [selectedId, accounts, creditCards]);

    const selectedCard = creditCards.find(c => c._id === selectedId);
    const balance = selectedCard?.balance || 0;
    const minPay = Math.ceil(balance * 0.05);
    const remaining = balance - (parseInt(amount.replace(/\D/g, '') || '0'));

    const handleInput = (v: string) => setAmount(v.replace(/\D/g, ''));
    const displayAmount = amount ? parseInt(amount).toLocaleString('vi-VN') : '';

    const handlePay = async () => {
        if (!selectedCard || !amount) return;
        const num = parseInt(amount.replace(/\D/g, ''));
        if (!num || num <= 0) { toast.error('Nhập số tiền hợp lệ'); return; }
        setSaving(true);
        try {
            await cardsApi.pay(selectedId, num, sourceId || undefined);
            toast.success(`✅ Đã thanh toán ${fmt(Math.min(num, balance))}đ cho thẻ ${selectedCard.bankName}`);
            onPaid?.();
            onClose();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Thanh toán thất bại';
            toast.error(`Lỗi: ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    if (!mounted || !open) return null;

    const modal = (
        <>
            {/* Backdrop */}
            <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[1100] backdrop-blur-sm" />

            {/* Sheet from bottom */}
            <div className="fixed bottom-0 left-0 right-0 z-[1101] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0 bg-white dark:bg-slate-900 z-10">
                    <div className="w-10 h-1 bg-gray-200 dark:bg-slate-700 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 pt-1 shrink-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Thanh toán thẻ</h2>
                            <p className="text-xs text-gray-400 dark:text-slate-400">Tín dụng</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 transition">
                        <X className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pt-5 pb-6 space-y-5">
                    {/* Card selector */}
                    {creditCards.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-gray-400 dark:text-slate-500">
                            <AlertCircle className="w-10 h-10" />
                            <p className="text-sm">Bạn chưa có thẻ tín dụng nào</p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <p className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Chọn thẻ</p>
                                <div className="flex flex-col gap-2">
                                    {creditCards.map(card => {
                                        const dueDays = (() => {
                                            if (!card.paymentDueDay) return null;
                                            const now = new Date();
                                            const due = new Date(now.getFullYear(), now.getMonth(), card.paymentDueDay);
                                            if (due <= now) due.setMonth(due.getMonth() + 1);
                                            return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
                                        })();
                                        const isUrgent = dueDays !== null && dueDays <= 5;
                                        const isDisabled = card.balance === 0;
                                        return (
                                            <button key={card._id} onClick={() => { setSelectedId(card._id); setAmount(''); }}
                                                disabled={isDisabled}
                                                className={cn('flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left',
                                                    isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700' :
                                                        selectedId === card._id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-600')}>
                                                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center flex-shrink-0">
                                                    {banks.find(x => x.shortName === card.bankShortName)?.logo ? (
                                                        <img src={banks.find(x => x.shortName === card.bankShortName)?.logo} className="w-6 h-6 object-contain grayscale-0 group-disabled:grayscale" alt="" />
                                                    ) : (
                                                        <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{card.bankName} ••{card.cardNumber}</p>
                                                    <p className={cn("text-xs font-medium", isDisabled ? "text-gray-400 dark:text-slate-500" : "text-red-500 dark:text-red-400")}>
                                                        Dư nợ: {fmt(card.balance)}đ
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    {dueDays !== null && (
                                                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg',
                                                            isUrgent ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600')}>
                                                            {isUrgent ? '⚠️ Gấp' : `${dueDays}N nữa`}
                                                        </span>
                                                    )}
                                                    {selectedId === card._id && (
                                                        <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center mt-1 ml-auto">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedCard && (
                                <>
                                    {/* Balance info */}
                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 flex justify-between text-sm">
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 dark:text-slate-400 mb-0.5">Dư nợ</p>
                                            <p className="font-bold text-red-500 dark:text-red-400">{fmtShort(balance)}đ</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 dark:text-slate-400 mb-0.5">Tối thiểu (5%)</p>
                                            <p className="font-bold text-orange-500 dark:text-orange-400">{fmtShort(minPay)}đ</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 dark:text-slate-400 mb-0.5">Sau thanh toán</p>
                                            <p className={cn('font-bold', remaining <= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-700 dark:text-slate-300')}>
                                                {remaining <= 0 ? '0đ ✅' : `${fmtShort(remaining)}đ`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Source Account Selector */}
                                    {accounts && accounts.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Từ nguồn tiền</p>
                                            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                                                {/* Arrange same bank first */}
                                                {[...accounts].sort((a, b) => {
                                                    const isASame = a.bankShortName === selectedCard.bankShortName;
                                                    const isBSame = b.bankShortName === selectedCard.bankShortName;
                                                    if (isASame && !isBSame) return -1;
                                                    if (!isASame && isBSame) return 1;
                                                    return b.balance - a.balance; // Then by balance
                                                }).map(acc => {
                                                    const isSelected = sourceId === acc._id;
                                                    const getIcon = () => {
                                                        const bInfo = banks.find(x => x.shortName === acc.bankShortName);
                                                        if (bInfo?.logo) return <img src={bInfo.logo} className="w-5 h-5 rounded-sm object-contain" alt="" />;
                                                        if (acc.cardType === 'eWallet') {
                                                            const ew = E_WALLETS.find(x => x.short === acc.bankShortName);
                                                            if (ew?.logo) return <img src={ew.logo} className="w-5 h-5 rounded-sm object-cover" alt="" />;
                                                            return '📱';
                                                        }
                                                        return '🏦';
                                                    };
                                                    return (
                                                        <button
                                                            key={acc._id}
                                                            onClick={() => setSourceId(acc._id)}
                                                            className={cn('flex flex-col gap-1 p-2.5 rounded-xl border-2 min-w-[120px] transition-all text-left flex-shrink-0',
                                                                isSelected ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-600')}
                                                        >
                                                            <div className="flex items-center gap-1.5 w-full">
                                                                <span className="text-[10px] w-5 h-5 flex items-center justify-center bg-white rounded shadow-sm">{getIcon()}</span>
                                                                <p className="font-semibold text-xs text-gray-900 dark:text-white truncate flex-1">{acc.bankShortName}</p>
                                                            </div>
                                                            <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">Số dư: {fmtShort(acc.balance)}</p>
                                                            {selectedCard.bankShortName === acc.bankShortName && (
                                                                <span className="text-[9px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 rounded inline-block mt-0.5 w-max">
                                                                    Cùng ngân hàng
                                                                </span>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Amount input */}
                                    <div>
                                        <p className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Số tiền thanh toán</p>
                                        <div className="flex items-center gap-2 border-2 border-gray-200 dark:border-slate-700 focus-within:border-indigo-400 dark:focus-within:border-indigo-400 rounded-2xl px-4 py-3 transition-colors bg-white dark:bg-slate-900">
                                            <input
                                                type="tel"
                                                value={displayAmount}
                                                onChange={e => handleInput(e.target.value.replace(/\./g, '').replace(/,/g, ''))}
                                                placeholder="0"
                                                className="flex-1 text-2xl font-bold text-gray-900 dark:text-white outline-none bg-transparent"
                                            />
                                            <span className="text-gray-400 dark:text-slate-500 font-semibold">đ</span>
                                        </div>

                                        {/* Quick presets */}
                                        <div className="flex gap-2 mt-2">
                                            {QUICK_PRESETS(balance, minPay).map(p => (
                                                <button key={p.label} onClick={() => setAmount(String(Math.round(p.value)))}
                                                    className={cn('flex-1 py-2 px-1 rounded-xl text-center text-[11px] font-semibold transition-all border-2',
                                                        amount === String(Math.round(p.value))
                                                            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                                                            : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600')}>
                                                    {p.label.split('\n').map((line, i) => (
                                                        <span key={i} className={cn('block', i === 0 ? 'text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200 font-bold')}>{line}</span>
                                                    ))}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pay button moved to sticky footer */}
                                </>
                            )}
                        </>
                    )}
                </div>
                {/* Footer fixed */}
                {selectedCard && (
                    <div className="shrink-0 w-full p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                        {/* Pay button */}
                        <button
                            onClick={handlePay}
                            disabled={!amount || saving}
                            className={cn('w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all',
                                !amount || saving
                                    ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 active:scale-95 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30')}>
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                            {saving ? 'Đang xử lý...' : 'Thanh toán ngay'}
                        </button>
                    </div>
                )}
            </div>
        </>
    );

    return createPortal(modal, document.body);
}
