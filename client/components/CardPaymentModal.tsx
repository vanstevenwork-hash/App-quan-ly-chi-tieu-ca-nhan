'use client';
import { useState, useEffect } from 'react';
import { X, CreditCard, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cardsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Card } from '@/hooks/useCards';

interface CardPaymentModalProps {
    open: boolean;
    onClose: () => void;
    onPaid?: () => void;
    creditCards: Card[];
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

export default function CardPaymentModal({ open, onClose, onPaid, creditCards }: CardPaymentModalProps) {
    const [mounted, setMounted] = useState(false);
    const [selectedId, setSelectedId] = useState('');
    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (open) {
            // auto-select the card with highest balance
            const first = creditCards.sort((a, b) => b.balance - a.balance)[0];
            setSelectedId(first?._id || '');
            setAmount('');
        }
    }, [open, creditCards]);

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
            await cardsApi.pay(selectedId, num);
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
            <div className="fixed bottom-0 left-0 right-0 z-[1101] bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 pt-1">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Thanh toán thẻ</h2>
                            <p className="text-xs text-gray-400">Tín dụng</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                <div className="px-5 pb-8 space-y-5">
                    {/* Card selector */}
                    {creditCards.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
                            <AlertCircle className="w-10 h-10" />
                            <p className="text-sm">Bạn chưa có thẻ tín dụng nào</p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <p className="text-sm font-bold text-gray-700 mb-2">Chọn thẻ</p>
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
                                        return (
                                            <button key={card._id} onClick={() => { setSelectedId(card._id); setAmount(''); }}
                                                className={cn('flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left',
                                                    selectedId === card._id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-gray-50')}>
                                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl flex-shrink-0">💳</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-gray-900">{card.bankName} ••{card.cardNumber}</p>
                                                    <p className="text-xs text-red-500 font-medium">Dư nợ: {fmt(card.balance)}đ</p>
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
                                    <div className="bg-gray-50 rounded-2xl p-4 flex justify-between text-sm">
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 mb-0.5">Dư nợ</p>
                                            <p className="font-bold text-red-500">{fmtShort(balance)}đ</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 mb-0.5">Tối thiểu (5%)</p>
                                            <p className="font-bold text-orange-500">{fmtShort(minPay)}đ</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 mb-0.5">Sau thanh toán</p>
                                            <p className={cn('font-bold', remaining <= 0 ? 'text-emerald-500' : 'text-gray-700')}>
                                                {remaining <= 0 ? '0đ ✅' : `${fmtShort(remaining)}đ`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Amount input */}
                                    <div>
                                        <p className="text-sm font-bold text-gray-700 mb-2">Số tiền thanh toán</p>
                                        <div className="flex items-center gap-2 border-2 border-gray-200 focus-within:border-indigo-400 rounded-2xl px-4 py-3 transition-colors bg-white">
                                            <input
                                                type="tel"
                                                value={displayAmount}
                                                onChange={e => handleInput(e.target.value.replace(/\./g, '').replace(/,/g, ''))}
                                                placeholder="0"
                                                className="flex-1 text-2xl font-bold text-gray-900 outline-none bg-transparent"
                                            />
                                            <span className="text-gray-400 font-semibold">đ</span>
                                        </div>

                                        {/* Quick presets */}
                                        <div className="flex gap-2 mt-2">
                                            {QUICK_PRESETS(balance, minPay).map(p => (
                                                <button key={p.label} onClick={() => setAmount(String(Math.round(p.value)))}
                                                    className={cn('flex-1 py-2 px-1 rounded-xl text-center text-[11px] font-semibold transition-all border-2',
                                                        amount === String(Math.round(p.value))
                                                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                                            : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-300')}>
                                                    {p.label.split('\n').map((line, i) => (
                                                        <span key={i} className={cn('block', i === 0 ? 'text-gray-400' : 'text-gray-800 font-bold')}>{line}</span>
                                                    ))}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pay button */}
                                    <button
                                        onClick={handlePay}
                                        disabled={!amount || saving}
                                        className={cn('w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all',
                                            !amount || saving
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 active:scale-95 shadow-lg shadow-indigo-200')}>
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                        {saving ? 'Đang xử lý...' : 'Thanh toán ngay'}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );

    return createPortal(modal, document.body);
}
