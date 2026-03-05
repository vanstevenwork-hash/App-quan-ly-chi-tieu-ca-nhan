'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { X, Search } from 'lucide-react';
import type { Card, CardFormData } from '@/hooks/useCards';
import { banksApi } from '@/lib/api';

const CARD_TYPES = [
    { value: 'credit', label: 'Thẻ tín dụng', icon: '💳', desc: 'Thanh toán sau, có hạn mức' },
    { value: 'debit', label: 'Thẻ ghi nợ', icon: '🏧', desc: 'Thanh toán bằng số dư' },
    { value: 'savings', label: 'Sổ tiết kiệm', icon: '🐷', desc: 'Gửi tiết kiệm có kỳ hạn' },
    { value: 'eWallet', label: 'Ví điện tử', icon: '📱', desc: 'MoMo, ZaloPay...' },
    { value: 'crypto', label: 'Crypto', icon: '₿', desc: 'Bitcoin, ETH, USDT...' },
] as const;

const E_WALLETS = [
    { name: 'MoMo', short: 'MoMo', color: '#A21CAF', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-MoMo-Transparent.png' },
    { name: 'ZaloPay', short: 'ZLP', color: '#0284C7', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-ZaloPay-Square.png' },
    { name: 'Khác', short: '???', color: '#6C63FF', logo: '' },
];

const CRYPTOS = [
    { name: 'Binance', short: 'BNB', color: '#F0B90B', logo: '' },
    { name: 'OKX', short: 'OKX', color: '#1C1C1E', logo: '' },
    { name: 'Bybit', short: 'BBT', color: '#F7A600', logo: '' },
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
    initialType?: CardFormData['cardType'];
}

const EMPTY: CardFormData = {
    bankName: '', bankShortName: '', cardType: 'debit',
    cardNumber: '', cardHolder: '', balance: 0, creditLimit: 0,
    color: '#6C63FF', bankColor: '#1B4FD8', isDefault: false,
    interestRate: 0, depositDate: '', maturityDate: '', term: 12,
    paymentDueDay: 0, statementDay: 0, note: '',
};

export default function CardFormModal({ open, onClose, onSave, editCard, initialType }: CardFormModalProps) {
    const [form, setForm] = useState<CardFormData>(EMPTY);
    const [saving, setSaving] = useState(false);

    const [fetchedBanks, setFetchedBanks] = useState<any[]>([]);
    const [searchBank, setSearchBank] = useState('');

    useEffect(() => {
        banksApi.getAll().then(res => {
            if (res.data?.data) setFetchedBanks(res.data.data);
        }).catch(err => console.error('Failed to load banks', err));
    }, []);

    useEffect(() => {
        if (open) {
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
            } : { ...EMPTY, cardType: initialType || 'debit' });
        }
    }, [open, editCard, initialType]);

    const set = (key: keyof CardFormData, val: unknown) =>
        setForm(prev => ({ ...prev, [key]: val }));

    const selectBank = (bank: any) => {
        set('bankName', bank.name || bank.shortName);
        set('bankShortName', bank.shortName);
        set('bankColor', bank.color || '#3B82F6'); // default blue if vietqr doesn't provide color
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
                {isSavings ? (
                    <div className="relative flex min-h-[80vh] w-full flex-col bg-slate-50 group/design-root overflow-hidden max-w-md mx-auto">
                        <div className="sticky top-0 z-10 flex items-center bg-white/80 backdrop-blur-md p-4 pb-2 justify-between border-b border-slate-100">
                            <button onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
                                <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                            </button>
                            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">Thêm sổ tiết kiệm</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto pb-24">
                            <div className="flex items-center justify-between px-4 mt-6 mb-3">
                                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">Chọn Ngân hàng</h2>
                                <div className="relative w-[140px]">
                                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input value={searchBank} onChange={e => setSearchBank(e.target.value)}
                                        placeholder="Tìm ngân hàng..." className="pl-8 h-8 text-xs bg-white border-slate-200 rounded-xl focus:border-primary focus:ring-primary/20" />
                                </div>
                            </div>
                            <div className="flex overflow-x-auto hide-scrollbar px-4 gap-4 pb-4">
                                {fetchedBanks.filter(b => b.name.toLowerCase().includes(searchBank.toLowerCase()) || b.shortName.toLowerCase().includes(searchBank.toLowerCase())).map(bank => (
                                    <button key={bank.bin || bank.shortName} onClick={() => selectBank(bank)}
                                        className="flex flex-col items-center gap-2 min-w-[72px] shrink-0 group">
                                        <div className={cn('w-16 h-16 rounded-xl border p-1 bg-white shadow-sm flex items-center justify-center transition-colors',
                                            form.bankShortName === bank.shortName ? 'border-2 border-primary scale-105' : 'border-slate-200 group-hover:border-primary/50'
                                        )}>
                                            <div className="w-full h-full bg-center bg-no-repeat bg-contain rounded-lg" style={{ backgroundImage: `url(${bank.logo})` }} />
                                        </div>
                                        <p className={cn("text-xs font-semibold", form.bankShortName === bank.shortName ? 'text-primary' : 'text-slate-500 group-hover:text-slate-700')}>{bank.shortName}</p>
                                    </button>
                                ))}
                            </div>
                            <div className="px-4 py-2 space-y-5">
                                <label className="flex flex-col">
                                    <p className="text-sm font-semibold leading-normal pb-2 text-slate-700">Số tiền gửi (VND)</p>
                                    <div className="relative">
                                        <Input className="flex w-full resize-none overflow-hidden rounded-xl text-lg font-bold focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-slate-200 bg-white focus:border-primary h-14 pl-4 pr-12 placeholder:text-slate-400 transition-shadow"
                                            type="text" value={form.balance ? new Intl.NumberFormat('vi-VN').format(form.balance) : ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                set('balance', Number(val));
                                            }} placeholder="0" />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-primary">VND</span>
                                    </div>
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <label className="flex flex-col">
                                        <p className="text-sm font-semibold leading-normal pb-2 text-slate-700">Kỳ hạn</p>
                                        <select value={form.term} onChange={e => {
                                            const t = Number(e.target.value);
                                            set('term', t);
                                            if (form.depositDate && t) {
                                                const d = new Date(form.depositDate);
                                                d.setMonth(d.getMonth() + t);
                                                set('maturityDate', d.toISOString().slice(0, 10));
                                            }
                                        }} className="w-full rounded-xl text-base focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-slate-200 bg-white focus:border-primary h-14 px-4 font-medium transition-shadow">
                                            <option value={1}>1 tháng</option>
                                            <option value={3}>3 tháng</option>
                                            <option value={6}>6 tháng</option>
                                            <option value={12}>12 tháng</option>
                                            <option value={24}>24 tháng</option>
                                        </select>
                                    </label>
                                    <label className="flex flex-col">
                                        <p className="text-sm font-semibold leading-normal pb-2 text-slate-700">Lãi suất (%/năm)</p>
                                        <div className="relative">
                                            <Input className="flex w-full resize-none overflow-hidden rounded-xl text-base font-medium focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-slate-200 bg-white focus:border-primary h-14 pl-4 pr-10 placeholder:text-slate-400 transition-shadow"
                                                placeholder="0.0" step="0.1" type="number" value={form.interestRate || ''} onChange={e => set('interestRate', Number(e.target.value))} />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                                        </div>
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <label className="flex flex-col">
                                        <p className="text-sm font-semibold leading-normal pb-2 text-slate-700">Ngày gửi</p>
                                        <div className="relative">
                                            <Input className="flex w-full resize-none overflow-hidden rounded-xl text-base font-medium focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-slate-200 bg-white focus:border-primary h-14 px-4 transition-shadow"
                                                type="date" value={form.depositDate} onChange={e => {
                                                    set('depositDate', e.target.value);
                                                    if (e.target.value && form.term) {
                                                        const d = new Date(e.target.value);
                                                        d.setMonth(d.getMonth() + form.term);
                                                        set('maturityDate', d.toISOString().slice(0, 10));
                                                    }
                                                }} />
                                        </div>
                                    </label>
                                    <label className="flex flex-col">
                                        <p className="text-sm font-semibold leading-normal pb-2 text-slate-700">Ngày đáo hạn</p>
                                        <div className="relative">
                                            <Input className="flex w-full resize-none overflow-hidden rounded-xl text-base font-medium border border-transparent bg-slate-100 text-slate-500 h-14 px-4"
                                                disabled type="date" value={form.maturityDate} />
                                        </div>
                                    </label>
                                </div>

                                {form.balance > 0 && form.interestRate > 0 && form.term > 0 && (
                                    <div className="mt-6 p-5 rounded-2xl bg-[#7f19e6]/5 border border-[#7f19e6]/10">
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="material-symbols-outlined text-[#7f19e6] text-[20px]">calculate</span>
                                            <h3 className="text-sm font-bold text-[#7f19e6] uppercase tracking-wider">Tự động tính</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm text-slate-600">Tiền lãi dự tính</p>
                                                <p className="text-base font-bold text-emerald-600">+{new Intl.NumberFormat('vi-VN').format(Math.round(form.balance * (form.interestRate / 100) * (form.term / 12)))} đ</p>
                                            </div>
                                            <div className="h-px w-full bg-[#7f19e6]/10 my-1" />
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm font-medium text-slate-700">Tổng nhận khi đáo hạn</p>
                                                <p className="text-lg font-bold text-[#7f19e6]">{new Intl.NumberFormat('vi-VN').format(Math.round(form.balance + (form.balance * (form.interestRate / 100) * (form.term / 12))))} đ</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between py-4 mt-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#7f19e6]/10 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[#7f19e6] text-[20px]">notifications_active</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">Nhắc nhở trước đáo hạn</p>
                                            <p className="text-xs text-slate-500">Thông báo trước 7 ngày</p>
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <div onClick={() => set('isDefault', !form.isDefault)}
                                            className={cn('w-11 h-6 rounded-full transition-colors relative', form.isDefault ? 'bg-[#7f19e6]' : 'bg-slate-200')}>
                                            <div className={cn('w-5 h-5 bg-white rounded-full absolute top-[2px] transition-all shadow-sm border border-slate-300', form.isDefault ? 'left-[22px] border-white' : 'left-[2px]')} />
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/90 backdrop-blur-md border-t border-slate-100">
                            <button onClick={handleSave} disabled={saving || !form.bankName} className="w-full h-14 rounded-xl bg-gradient-to-r from-[#7f19e6] to-[#9933ff] text-white font-bold text-lg shadow-lg shadow-[#7f19e6]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[20px]">save</span>
                                {saving ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Lưu sổ tiết kiệm')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="gradient-primary px-6 pt-6 pb-5">
                            <DialogHeader>
                                <div className="flex items-center justify-between">
                                    <DialogTitle className="text-white text-lg font-bold">
                                        {isEdit ? 'Chỉnh sửa' : 'Thêm mới'}
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
                            {!isEdit && (
                                <div className="space-y-4">
                                    {/* Card type */}
                                    <p className="text-sm font-semibold text-gray-700 mt-2">Loại tài khoản</p>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        {CARD_TYPES.map(t => (
                                            <button key={t.value} onClick={() => { set('cardType', t.value); setSearchBank(''); }}
                                                className={cn(
                                                    'flex items-center gap-2 p-3 rounded-2xl border-2 transition-all text-left',
                                                    form.cardType === t.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50'
                                                )}>
                                                <span className="text-xl">{t.icon}</span>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-800">{t.label}</p>
                                                    <p className="text-[10px] text-gray-400 truncate">{t.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Bank grid */}
                                    <div className="flex items-center justify-between mt-4 mb-2">
                                        <p className="text-sm font-semibold text-gray-700">Chọn ngân hàng / nguồn</p>
                                        {(!['eWallet', 'crypto'].includes(form.cardType)) && (
                                            <div className="relative w-[140px]">
                                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                <Input value={searchBank} onChange={e => setSearchBank(e.target.value)}
                                                    placeholder="Tiến kiếm..." className="pl-8 h-8 text-xs bg-gray-50 border-gray-100 rounded-xl" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[160px] pr-1 pb-4 custom-scrollbar">
                                        {form.cardType === 'eWallet' ? (
                                            E_WALLETS.map(bank => (
                                                <button key={bank.short} onClick={() => selectBank({ name: bank.name, shortName: bank.short, color: bank.color })}
                                                    className={cn('flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all text-[11px] font-semibold text-center', form.bankShortName === bank.short ? 'border-indigo-500 bg-indigo-50 scale-95' : 'border-gray-100 hover:border-gray-200 bg-gray-50')}>
                                                    {bank.logo ? <img src={bank.logo} alt={bank.name} className="w-8 h-8 object-contain rounded-lg" /> : <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: bank.color }}>{bank.short.slice(0, 3)}</div>}
                                                    <span className="text-gray-600 leading-tight w-full truncate">{bank.name}</span>
                                                </button>
                                            ))
                                        ) : form.cardType === 'crypto' ? (
                                            CRYPTOS.map(bank => (
                                                <button key={bank.short} onClick={() => selectBank({ name: bank.name, shortName: bank.short, color: bank.color })}
                                                    className={cn('flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all text-[11px] font-semibold text-center', form.bankShortName === bank.short ? 'border-indigo-500 bg-indigo-50 scale-95' : 'border-gray-100 hover:border-gray-200 bg-gray-50')}>
                                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: bank.color }}>{bank.short.slice(0, 3)}</div>
                                                    <span className="text-gray-600 leading-tight w-full truncate">{bank.name}</span>
                                                </button>
                                            ))
                                        ) : (
                                            fetchedBanks.filter(b => b.name.toLowerCase().includes(searchBank.toLowerCase()) || b.shortName.toLowerCase().includes(searchBank.toLowerCase())).map(bank => (
                                                <button key={bank.bin || bank.shortName} onClick={() => selectBank(bank)}
                                                    className={cn(
                                                        'flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all text-[11px] font-semibold text-center',
                                                        form.bankShortName === bank.shortName
                                                            ? 'border-indigo-500 bg-indigo-50 scale-95'
                                                            : 'border-gray-100 hover:border-gray-200 bg-white shadow-sm'
                                                    )}>
                                                    <img src={bank.logo} alt={bank.shortName} className="w-10 h-10 object-contain p-1 bg-white rounded-lg border border-gray-50" />
                                                    <span className="text-gray-600 leading-none w-full truncate">{bank.shortName}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
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

                                {/* Balance for Credit/E-wallet */}
                                {!isSavings && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 mb-1">
                                            {isCredit ? 'Dư nợ hiện tại (đ)' : 'Số dư hiện tại (đ)'}
                                        </p>
                                        <Input type="number" value={form.balance} onChange={e => set('balance', Number(e.target.value))}
                                            placeholder="0" className="rounded-xl bg-gray-50 border-gray-200" />
                                    </div>
                                )}

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

                            <div className="flex gap-2 pt-2">
                                <Button onClick={handleSave} disabled={saving || !form.cardHolder || !form.bankName}
                                    className="w-full gradient-primary text-white rounded-2xl py-5 font-bold border-0 shadow-lg shadow-indigo-500/30">
                                    {saving ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Thêm mới')}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
