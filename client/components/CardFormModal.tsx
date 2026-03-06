'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, Save, Check } from 'lucide-react';
import type { Card, CardFormData } from '@/hooks/useCards';
import { useBanks } from '@/hooks/useBanks';

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
    cardNumber: '', cardHolder: '', cardNetwork: '', balance: 0, creditLimit: 0,
    color: '#6C63FF', bankColor: '#1B4FD8', isDefault: false,
    interestRate: 0, depositDate: '', maturityDate: '', term: 12,
    paymentDueDay: 0, statementDay: 0, expirationDate: '', note: '',
};

export default function CardFormModal({ open, onClose, onSave, editCard, initialType }: CardFormModalProps) {
    const [form, setForm] = useState<CardFormData>(EMPTY);
    const [saving, setSaving] = useState(false);
    const { banks: fetchedBanks, fetchBanks } = useBanks();
    const [searchBank, setSearchBank] = useState('');

    useEffect(() => {
        fetchBanks();
    }, [fetchBanks]);

    useEffect(() => {
        if (open) {
            setForm(editCard ? {
                bankName: editCard.bankName,
                bankShortName: editCard.bankShortName,
                cardType: editCard.cardType,
                cardNumber: editCard.cardNumber,
                cardHolder: editCard.cardHolder,
                cardNetwork: editCard.cardNetwork || '',
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
                expirationDate: (editCard as any).expirationDate || '',
                note: editCard.note || '',
            } : { ...EMPTY, cardType: initialType || 'debit' });
        }
    }, [open, editCard, initialType]);

    const set = (key: keyof CardFormData, val: unknown) =>
        setForm(prev => ({ ...prev, [key]: val }));

    const selectBank = (bank: any) => {
        set('bankName', bank.name || bank.shortName);
        set('bankShortName', bank.shortName);
        set('bankColor', bank.color || '#3B82F6');
    };

    const handleSave = async () => {
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

    const selectedBankObj = fetchedBanks.find(b => b.shortName === form.bankShortName);

    // Find logo from ewallets/cryptos if not found in banks
    let previewLogo = selectedBankObj?.logo;
    if (!previewLogo) {
        if (form.cardType === 'eWallet') previewLogo = E_WALLETS.find(w => w.short === form.bankShortName)?.logo;
        if (form.cardType === 'crypto') previewLogo = CRYPTOS.find(c => c.short === form.bankShortName)?.logo;
    }

    const renderNetworkLogo = (network?: string) => {
        switch (network) {
            case 'visa': return <span className="font-bold italic text-blue-900 text-lg tracking-tighter">VISA</span>;
            case 'mastercard': return <div className="flex -space-x-2 opacity-90"><div className="w-6 h-6 rounded-full bg-red-500 mix-blend-multiply"></div><div className="w-6 h-6 rounded-full bg-amber-400 mix-blend-multiply"></div></div>;
            case 'jcb': return <span className="font-bold text-green-600 text-sm">JCB</span>;
            case 'amex': return <span className="font-bold text-blue-600 text-xs bg-blue-50 px-1 py-0.5 rounded border border-blue-200">AMEX</span>;
            case 'napas': return <span className="font-bold text-green-500 text-sm">NAPAS</span>;
            default: return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden p-0 border-0">
                <button className="flex h-6 w-full items-center justify-center shrink-0 pt-2 pb-1 bg-white dark:bg-slate-900 z-10" onClick={onClose}>
                    <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                </button>
                <div className="flex items-center px-4 py-3 shrink-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold flex-1 text-center text-[#000000] dark:text-white">
                        {isEdit ? 'Chỉnh sửa' : isSavings ? 'Thêm sổ tiết kiệm' : 'Thêm thẻ / tài khoản'}
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto hide-scrollbar pb-6 bg-white dark:bg-slate-900 px-5 pt-5 space-y-6">

                    {/* PREVIEW CARD */}
                    {!isSavings && (
                        (isCredit || form.cardType === 'debit') ? (
                            <div className="w-full h-44 p-5 rounded-3xl relative flex flex-col justify-between transition-colors shadow-sm overflow-hidden"
                                style={{ background: `linear-gradient(135deg, ${form.bankColor}, ${form.color})` }}>
                                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />

                                <div className="flex justify-between items-start mb-2 relative z-10">
                                    <div className="flex items-center gap-2">
                                        {previewLogo ? (
                                            <div className="w-10 h-10 p-1 bg-white rounded-lg shadow-sm flex items-center justify-center">
                                                <img src={previewLogo} className="w-full h-full object-contain" alt="logo" />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                                {form.bankShortName?.slice(0, 4) || '???'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-6 h-6 rounded-full border border-white/40 flex items-center justify-center bg-white/10">
                                        <Check className="w-3.5 h-3.5 text-white" />
                                    </div>
                                </div>

                                <div className="relative z-10">
                                    <p className="text-sm font-bold text-white/90 leading-tight mb-2 uppercase">
                                        {form.cardHolder || 'TÊN CHỦ THẺ'}
                                    </p>
                                    <div className="flex justify-between items-end">
                                        <div className="flex flex-col">
                                            <p className="text-xl font-bold text-white tracking-widest font-mono drop-shadow-sm">
                                                **** {form.cardNumber || '1234'}
                                            </p>
                                            {(form.expirationDate) && (
                                                <p className="text-xs text-white/80 font-mono mt-1 drop-shadow-sm">
                                                    {form.expirationDate}
                                                </p>
                                            )}
                                        </div>
                                        <div className="bg-white/90 px-2 py-1.5 rounded-md shadow-sm">
                                            {renderNetworkLogo(form.cardNetwork)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-40 rounded-3xl p-5 relative overflow-hidden shadow-sm"
                                style={{ background: `linear-gradient(135deg, ${form.bankColor}, ${form.color})` }}>
                                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        {previewLogo ? (
                                            <div className="w-10 h-10 p-1 bg-white rounded-lg shadow-sm flex items-center justify-center">
                                                <img src={previewLogo} className="w-full h-full object-contain" alt="logo" />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-xs">
                                                {form.bankShortName?.slice(0, 4) || '???'}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-white/80 text-sm font-medium">
                                        {CARD_TYPES.find(t => t.value === form.cardType)?.icon} {CARD_TYPES.find(t => t.value === form.cardType)?.label}
                                    </span>
                                </div>
                                <p className="text-white/70 text-sm mb-1 font-mono tracking-widest">•••• •••• •••• {form.cardNumber || '????'}</p>
                                <p className="text-white font-bold tracking-wide uppercase">{form.cardHolder || 'TÊN CHỦ THẺ'}</p>
                            </div>
                        ))}

                    {/* CARD TYPE SELECTION */}
                    {!isEdit && form.cardType !== 'savings' && (
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-[#000000] dark:text-white">Loại tài khoản</label>
                            <div className="grid grid-cols-3 gap-2">
                                {CARD_TYPES.filter(t => ['debit', 'credit', 'eWallet'].includes(t.value)).map(t => (
                                    <button key={t.value} onClick={() => { set('cardType', t.value); setSearchBank(''); }}
                                        className={cn(
                                            'flex gap-2 p-2 rounded-2xl border transition-all text-left items-center justify-center flex-col',
                                            form.cardType === t.value ? 'border-[#7f19e6] bg-[#7f19e6]/5 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                                        )}>
                                        <span className="text-xl">{t.icon}</span>
                                        <div>
                                            <p className={cn("text-[11px] text-center font-bold", form.cardType === t.value ? "text-[#7f19e6] dark:text-purple-400" : "text-[#000000] dark:text-white")}>{t.label}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* BANK SELECTION */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-[#000000] dark:text-white">Ngân hàng / Nguồn gốc</label>
                            {(!['eWallet', 'crypto'].includes(form.cardType)) && (
                                <div className="relative w-[140px]">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input value={searchBank} onChange={e => setSearchBank(e.target.value)}
                                        placeholder="Tìm kiếm..." className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-[#7f19e6] dark:text-white dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 overflow-x-auto hide-scrollbar snap-x pb-2 -mx-5 px-5">
                            {form.cardType === 'eWallet' ? (
                                E_WALLETS.map(bank => (
                                    <button key={bank.short} onClick={() => selectBank({ name: bank.name, shortName: bank.short, color: bank.color, logo: bank.logo })}
                                        className={cn('snap-start shrink-0 w-24 flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all', form.bankShortName === bank.short ? 'border-[#7f19e6] bg-[#7f19e6]/5 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0')}>
                                        {bank.logo ? <img src={bank.logo} alt={bank.name} className="w-10 h-10 object-contain p-1 bg-white rounded-lg border border-slate-100 shadow-sm" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: bank.color }}>{bank.short.slice(0, 3)}</div>}
                                        <span className="text-xs font-bold text-[#000000] dark:text-white text-center w-full truncate">{bank.name}</span>
                                    </button>
                                ))
                            ) : form.cardType === 'crypto' ? (
                                CRYPTOS.map(bank => (
                                    <button key={bank.short} onClick={() => selectBank({ name: bank.name, shortName: bank.short, color: bank.color, logo: bank.logo })}
                                        className={cn('snap-start shrink-0 w-24 flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all', form.bankShortName === bank.short ? 'border-[#7f19e6] bg-[#7f19e6]/5 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0')}>
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: bank.color }}>{bank.short.slice(0, 3)}</div>
                                        <span className="text-xs font-bold text-[#000000] dark:text-white text-center w-full truncate">{bank.name}</span>
                                    </button>
                                ))
                            ) : (
                                fetchedBanks.filter(b => b.name.toLowerCase().includes(searchBank.toLowerCase()) || b.shortName.toLowerCase().includes(searchBank.toLowerCase())).map(bank => (
                                    <button key={bank.bin || bank.shortName} onClick={() => selectBank(bank)}
                                        className={cn('snap-start shrink-0 w-24 flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all', form.bankShortName === bank.shortName ? 'border-[#7f19e6] bg-[#7f19e6]/5 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0')}>
                                        <img src={bank.logo} alt={bank.shortName} className="w-10 h-10 object-contain p-1 bg-white rounded-lg border border-slate-100 shadow-sm" />
                                        <span className="text-xs font-bold text-[#000000] dark:text-white text-center w-full truncate">{bank.shortName}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                            {/* Card holder */}
                            {!isSavings && (
                                <div>
                                    <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Tên chủ {isSavings ? 'sổ' : 'thẻ'}</p>
                                    <Input value={form.cardHolder} onChange={e => set('cardHolder', e.target.value.toUpperCase())}
                                        placeholder="NGUYEN VAN A" className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 text-base font-semibold uppercase text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                </div>
                            )}

                            {/* Card number */}
                            {!isSavings && (
                                <div>
                                    <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">4 số cuối</p>
                                    <Input value={form.cardNumber} onChange={e => set('cardNumber', e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder="1234" maxLength={4} className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 text-base font-semibold tracking-widest text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                </div>
                            )}

                            {/* Balance */}
                            {!isSavings && (
                                <div>
                                    <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">
                                        {isCredit ? 'Dư nợ hiện tại (VND)' : 'Số dư hiện tại (VND)'}
                                    </p>
                                    <Input type="text"
                                        value={form.balance ? new Intl.NumberFormat('vi-VN').format(form.balance) : ''}
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            set('balance', Number(val));
                                        }}
                                        placeholder="0" className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 text-base font-bold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                </div>
                            )}

                            {/* Savings Details */}
                            {isSavings && (
                                <>
                                    <div>
                                        <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Số tiền gửi (VND)</p>
                                        <Input type="text"
                                            value={form.balance ? new Intl.NumberFormat('vi-VN').format(form.balance) : ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                set('balance', Number(val));
                                            }}
                                            placeholder="0" className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 text-base font-bold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Lãi suất (%/năm)</p>
                                            <Input type="number" step="0.1" value={form.interestRate || ''}
                                                onChange={e => set('interestRate', Number(e.target.value))}
                                                placeholder="7.5" className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 text-base font-semibold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Kỳ hạn</p>
                                            <select value={form.term} onChange={e => {
                                                const t = Number(e.target.value);
                                                set('term', t);
                                                if (form.depositDate && t) {
                                                    const d = new Date(form.depositDate);
                                                    d.setMonth(d.getMonth() + t);
                                                    set('maturityDate', d.toISOString().slice(0, 10));
                                                }
                                            }} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white h-12 px-3 text-base font-semibold focus:outline-none focus:ring-1 focus:ring-[#7f19e6] focus:border-[#7f19e6] dark:focus:border-purple-400 appearance-none">
                                                <option value={1}>1 tháng</option>
                                                <option value={3}>3 tháng</option>
                                                <option value={6}>6 tháng</option>
                                                <option value={12}>12 tháng</option>
                                                <option value={24}>24 tháng</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Ngày gửi</p>
                                            <Input type="date" value={form.depositDate} onChange={e => set('depositDate', e.target.value)}
                                                className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 px-3 text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Ngày đáo hạn</p>
                                            <Input type="date" value={form.maturityDate} onChange={e => set('maturityDate', e.target.value)}
                                                className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 px-3 text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                        </div>
                                    </div>
                                </>
                            )}


                            {/* Network and Expiration Details for Credit & Debit */}
                            {(isCredit || form.cardType === 'debit') && (
                                <div className="flex flex-col gap-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Tổ chức thẻ</p>
                                            <div className="flex gap-2 w-full overflow-x-auto hide-scrollbar pb-2">
                                                {[
                                                    { value: 'visa', label: 'Visa', logo: <span className="font-bold italic text-blue-900 text-lg tracking-tighter">VISA</span> },
                                                    { value: 'mastercard', label: 'Master', logo: <div className="flex -space-x-2 opacity-90"><div className="w-6 h-6 rounded-full bg-red-500 mix-blend-multiply"></div><div className="w-6 h-6 rounded-full bg-amber-400 mix-blend-multiply"></div></div> },
                                                    { value: 'jcb', label: 'JCB', logo: <span className="font-bold text-green-600 text-sm">JCB</span> },
                                                    { value: 'amex', label: 'Amex', logo: <span className="font-bold text-blue-600 text-xs bg-blue-50 px-1 py-0.5 rounded border border-blue-200">AMEX</span> },
                                                    { value: 'napas', label: 'Napas', logo: <span className="font-bold text-green-500 text-sm">NAPAS</span> },
                                                ].map(net => (
                                                    <button key={net.value} type="button" onClick={() => set('cardNetwork', net.value)}
                                                        className={cn('flex-1 h-12 min-w-[70px] rounded-xl border flex items-center justify-center bg-white dark:bg-slate-100 transition-all', form.cardNetwork === net.value ? 'border-[#7f19e6] shadow-sm ring-1 ring-[#7f19e6]' : 'border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-slate-400')}>
                                                        {net.logo}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Ngày hết hạn thẻ</p>
                                            <Input type="text" value={form.expirationDate}
                                                onChange={e => {
                                                    let val = e.target.value.replace(/\D/g, '');
                                                    if (val.length >= 2) val = val.slice(0, 2) + '/' + val.slice(2, 4);
                                                    set('expirationDate', val);
                                                }}
                                                maxLength={5}
                                                placeholder="MM/YY" className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 text-base font-semibold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Credit Specific Details */}
                            {isCredit && (
                                <>
                                    <div>
                                        <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Hạn mức tín dụng (VND)</p>
                                        <Input type="text"
                                            value={form.creditLimit ? new Intl.NumberFormat('vi-VN').format(form.creditLimit) : ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                set('creditLimit', Number(val));
                                            }}
                                            placeholder="50.000.000" className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 text-base font-bold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Ngày sao kê (hàng tháng)</p>
                                            <Input type="number" min={1} max={31} value={form.statementDay || ''}
                                                onChange={e => set('statementDay', Number(e.target.value))}
                                                placeholder="25" className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 text-base font-semibold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Hạn thanh toán</p>
                                            <Input type="number" min={1} max={31} value={form.paymentDueDay || ''}
                                                onChange={e => set('paymentDueDay', Number(e.target.value))}
                                                placeholder="10" className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 text-base font-semibold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Color picker */}
                            {!isSavings && (
                                <div>
                                    <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Màu hiển thị</p>
                                    <div className="flex gap-2.5 flex-wrap">
                                        {CARD_COLORS.map(c => (
                                            <button key={c} onClick={() => set('color', c)}
                                                className={cn('w-8 h-8 rounded-full transition-transform', form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-[#7f19e6] dark:ring-purple-400' : 'hover:scale-110')}
                                                style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Note */}
                            {!isSavings && (
                                <div>
                                    <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Ghi chú</p>
                                    <Input value={form.note} onChange={e => set('note', e.target.value)}
                                        placeholder="Ghi chú tuỳ ý..." className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-12 text-base text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                </div>
                            )}

                            {/* Default toggle */}
                            {!isSavings && (
                                <label className="flex items-center gap-3 cursor-pointer py-2">
                                    <div onClick={() => set('isDefault', !form.isDefault)}
                                        className={cn('w-12 h-7 rounded-full transition-colors relative', form.isDefault ? 'bg-[#7f19e6]' : 'bg-slate-200 dark:bg-slate-700')}>
                                        <div className={cn('w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-sm', form.isDefault ? 'left-6' : 'left-1')} />
                                    </div>
                                    <span className="text-sm font-bold text-[#000000] dark:text-white">Đặt làm thẻ / tài khoản mặc định</span>
                                </label>
                            )}
                        </div>
                    </div>

                </div>

                <div className="shrink-0 w-full p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={handleSave} disabled={saving || !form.bankName}
                        className="w-full bg-gradient-to-r from-[#7f19e6] to-[#9b4de8] text-white rounded-xl py-4 text-lg font-bold shadow-lg shadow-[#7f19e6]/30 hover:shadow-[#7f19e6]/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Save className="w-5 h-5" />
                        <span>{saving ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Hoàn tất')}</span>
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
