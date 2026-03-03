'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import type { Card, CardFormData } from '@/hooks/useCards';

const CARD_TYPES = [
    { value: 'credit', label: 'Thẻ tín dụng', icon: '💳', desc: 'Thanh toán sau, có hạn mức' },
    { value: 'debit', label: 'Thẻ ghi nợ', icon: '🏧', desc: 'Thanh toán bằng số dư' },
    { value: 'savings', label: 'Sổ tiết kiệm', icon: '🐷', desc: 'Gửi tiết kiệm có kỳ hạn' },
    { value: 'eWallet', label: 'Ví điện tử', icon: '📱', desc: 'MoMo, ZaloPay...' },
    { value: 'crypto', label: 'Crypto', icon: '₿', desc: 'Bitcoin, ETH, USDT...' },
] as const;

const PRESET_BANKS = [
    { name: 'Vietcombank', short: 'VCB', color: '#006B3C' },
    { name: 'Techcombank', short: 'TCB', color: '#E03E2D' },
    { name: 'VIB', short: 'VIB', color: '#1B4FD8' },
    { name: 'VPBank', short: 'VPB', color: '#F97316' },
    { name: 'MB Bank', short: 'MBB', color: '#1D4ED8' },
    { name: 'BIDV', short: 'BIDV', color: '#006B8F' },
    { name: 'Agribank', short: 'AGB', color: '#DC2626' },
    { name: 'TPBank', short: 'TPB', color: '#FF0000' },
    { name: 'MoMo', short: 'MoMo', color: '#A21CAF' },
    { name: 'ZaloPay', short: 'ZLP', color: '#0284C7' },
    { name: 'Binance', short: 'BNB', color: '#F0B90B' },
    { name: 'OKX', short: 'OKX', color: '#1C1C1E' },
    { name: 'Bybit', short: 'BBT', color: '#F7A600' },
    { name: 'Khác', short: '???', color: '#6C63FF' },
];

const CARD_COLORS = [
    '#6C63FF', '#EF4444', '#10B981', '#3B82F6', '#F59E0B',
    '#8B5CF6', '#EC4899', '#14B8A6', '#84CC16', '#1E1B4B',
];

interface CardFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: CardFormData) => Promise<void>;
    editCard?: Card | null;
}

const EMPTY: CardFormData = {
    bankName: '', bankShortName: '', cardType: 'debit',
    cardNumber: '', cardHolder: '', balance: 0, creditLimit: 0,
    color: '#6C63FF', bankColor: '#1B4FD8', isDefault: false,
    interestRate: 0, depositDate: '', maturityDate: '', term: 12,
    paymentDueDay: 0, statementDay: 0, note: '',
};

export default function CardFormModal({ open, onClose, onSave, editCard }: CardFormModalProps) {
    const [form, setForm] = useState<CardFormData>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);

    useEffect(() => {
        if (open) {
            setStep(1);
            setForm(editCard ? {
                bankName: editCard.bankName,
                bankShortName: editCard.bankShortName,
                cardType: editCard.cardType,
                cardNumber: editCard.cardNumber,
                cardHolder: editCard.cardHolder,
                balance: editCard.balance,
                creditLimit: editCard.creditLimit,
                color: editCard.color,
                bankColor: editCard.bankColor,
                isDefault: editCard.isDefault,
                interestRate: editCard.interestRate || 0,
                depositDate: editCard.depositDate ? editCard.depositDate.slice(0, 10) : '',
                maturityDate: editCard.maturityDate ? editCard.maturityDate.slice(0, 10) : '',
                term: editCard.term || 12,
                paymentDueDay: editCard.paymentDueDay || 0,
                statementDay: editCard.statementDay || 0,
                note: editCard.note || '',
            } : EMPTY);
        }
    }, [open, editCard]);

    const set = (key: keyof CardFormData, val: unknown) =>
        setForm(prev => ({ ...prev, [key]: val }));

    const selectBank = (bank: typeof PRESET_BANKS[0]) => {
        set('bankName', bank.name);
        set('bankShortName', bank.short);
        set('bankColor', bank.color);
    };

    const handleSave = async () => {
        // Auto-fill missing required fields so backend doesn't reject
        const finalForm: CardFormData = {
            ...form,
            cardNumber: form.cardNumber.trim() || String(Math.floor(1000 + Math.random() * 9000)),
            cardHolder: form.cardHolder.trim() || 'CHU SO HUU',
        };
        if (!finalForm.bankName) return;
        setSaving(true);
        try {
            await onSave(finalForm);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const isEdit = !!editCard;
    const isSavings = form.cardType === 'savings';
    const isCredit = form.cardType === 'credit';

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
                {/* Header */}
                <div className="gradient-primary px-6 pt-6 pb-5">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-white text-lg font-bold">
                                {isEdit ? 'Chỉnh sửa' : (step === 1 ? 'Chọn loại' : 'Thông tin')}
                            </DialogTitle>
                            <button onClick={onClose} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </DialogHeader>

                    {/* Card preview */}
                    <div className="mt-4 rounded-2xl p-4 relative overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${form.bankColor}, ${form.color})` }}>
                        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-xs">
                                {form.bankShortName || '???'}
                            </div>
                            <span className="text-white/70 text-xs">
                                {CARD_TYPES.find(t => t.value === form.cardType)?.icon} {CARD_TYPES.find(t => t.value === form.cardType)?.label}
                            </span>
                        </div>
                        <p className="text-white/60 text-xs mb-0.5">•••• •••• •••• {form.cardNumber || '????'}</p>
                        <p className="text-white font-bold">{form.cardHolder || 'Tên chủ thẻ'}</p>
                    </div>
                </div>

                {/* Body */}
                <div className="bg-white px-6 py-5 space-y-4 max-h-[62vh] overflow-y-auto">
                    {step === 1 && !isEdit ? (
                        <>
                            {/* Bank grid */}
                            <p className="text-sm font-semibold text-gray-700">Chọn ngân hàng / nguồn</p>
                            <div className="grid grid-cols-3 gap-2">
                                {PRESET_BANKS.map(bank => (
                                    <button key={bank.short} onClick={() => selectBank(bank)}
                                        className={cn(
                                            'flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all text-xs font-semibold',
                                            form.bankShortName === bank.short
                                                ? 'border-indigo-500 bg-indigo-50 scale-95'
                                                : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                                        )}>
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-bold"
                                            style={{ backgroundColor: bank.color }}>
                                            {bank.short.slice(0, 3)}
                                        </div>
                                        <span className="text-gray-600 truncate w-full text-center">{bank.name}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Card type */}
                            <p className="text-sm font-semibold text-gray-700">Loại tài khoản</p>
                            <div className="grid grid-cols-2 gap-2">
                                {CARD_TYPES.map(t => (
                                    <button key={t.value} onClick={() => set('cardType', t.value)}
                                        className={cn(
                                            'flex items-center gap-2 p-3 rounded-2xl border-2 transition-all text-left',
                                            form.cardType === t.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50'
                                        )}>
                                        <span className="text-xl">{t.icon}</span>
                                        <div>
                                            <p className="text-xs font-bold text-gray-800">{t.label}</p>
                                            <p className="text-[10px] text-gray-400">{t.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <Button onClick={() => setStep(2)} disabled={!form.bankName}
                                className="w-full gradient-primary text-white rounded-2xl py-5 font-bold border-0">
                                Tiếp theo →
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="space-y-3">
                                {/* Card holder */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-1">Tên chủ thẻ / chủ sổ</p>
                                    <Input value={form.cardHolder} onChange={e => set('cardHolder', e.target.value)}
                                        placeholder="NGUYEN VAN A" className="rounded-xl bg-gray-50 border-gray-200 uppercase" />
                                </div>

                                {/* Card number */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-1">4 số cuối</p>
                                    <Input value={form.cardNumber} onChange={e => set('cardNumber', e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder="1234" maxLength={4} className="rounded-xl bg-gray-50 border-gray-200 tracking-widest" />
                                </div>

                                {/* Balance */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-1">
                                        {isCredit ? 'Dư nợ hiện tại (đ)' : isSavings ? 'Số tiền gốc (đ)' : 'Số dư hiện tại (đ)'}
                                    </p>
                                    <Input type="number" value={form.balance} onChange={e => set('balance', Number(e.target.value))}
                                        placeholder="0" className="rounded-xl bg-gray-50 border-gray-200" />
                                </div>

                                {/* Credit limit */}
                                {isCredit && (
                                    <>
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 mb-1">Hạn mức tín dụng (đ)</p>
                                            <Input type="number" value={form.creditLimit} onChange={e => set('creditLimit', Number(e.target.value))}
                                                placeholder="50000000" className="rounded-xl bg-gray-50 border-gray-200" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">Ngày sao kê</p>
                                                <Input type="number" min={1} max={31} value={form.statementDay || ''}
                                                    onChange={e => set('statementDay', Number(e.target.value))}
                                                    placeholder="25" className="rounded-xl bg-gray-50 border-gray-200" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">Hạn thanh toán</p>
                                                <Input type="number" min={1} max={31} value={form.paymentDueDay || ''}
                                                    onChange={e => set('paymentDueDay', Number(e.target.value))}
                                                    placeholder="15" className="rounded-xl bg-gray-50 border-gray-200" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Savings fields */}
                                {isSavings && (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">Lãi suất (%/năm)</p>
                                                <Input type="number" step="0.1" value={form.interestRate || ''}
                                                    onChange={e => set('interestRate', Number(e.target.value))}
                                                    placeholder="7.2" className="rounded-xl bg-gray-50 border-gray-200" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">Kỳ hạn (tháng)</p>
                                                <Input type="number" value={form.term || ''}
                                                    onChange={e => set('term', Number(e.target.value))}
                                                    placeholder="12" className="rounded-xl bg-gray-50 border-gray-200" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">Ngày gửi</p>
                                                <Input type="date" value={form.depositDate}
                                                    onChange={e => set('depositDate', e.target.value)}
                                                    className="rounded-xl bg-gray-50 border-gray-200 text-sm" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">Ngày đáo hạn</p>
                                                <Input type="date" value={form.maturityDate}
                                                    onChange={e => set('maturityDate', e.target.value)}
                                                    className="rounded-xl bg-gray-50 border-gray-200 text-sm" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Color picker */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-1">Màu thẻ</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {CARD_COLORS.map(c => (
                                            <button key={c} onClick={() => set('color', c)}
                                                className={cn('w-7 h-7 rounded-full transition-transform', form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-indigo-500' : 'hover:scale-110')}
                                                style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                </div>

                                {/* Note */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-1">Ghi chú</p>
                                    <Input value={form.note} onChange={e => set('note', e.target.value)}
                                        placeholder="Ghi chú tuỳ ý..." className="rounded-xl bg-gray-50 border-gray-200" />
                                </div>

                                {/* Default toggle */}
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div onClick={() => set('isDefault', !form.isDefault)}
                                        className={cn('w-10 h-6 rounded-full transition-colors relative', form.isDefault ? 'bg-indigo-500' : 'bg-gray-200')}>
                                        <div className={cn('w-4 h-4 bg-white rounded-full absolute top-1 transition-all', form.isDefault ? 'left-5' : 'left-1')} />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">Đặt làm mặc định</span>
                                </label>
                            </div>

                            <div className="flex gap-2">
                                {!isEdit && (
                                    <Button onClick={() => setStep(1)} variant="outline" className="flex-1 rounded-2xl py-5 border-gray-200">
                                        ← Quay lại
                                    </Button>
                                )}
                                <Button onClick={handleSave} disabled={saving || !form.cardHolder}
                                    className="flex-1 gradient-primary text-white rounded-2xl py-5 font-bold border-0">
                                    {saving ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Thêm')}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
