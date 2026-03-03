'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CATEGORIES } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { X, Check, Loader2 } from 'lucide-react';
import { useCards } from '@/hooks/useCards';
import { transactionsApi } from '@/lib/api';
import { toast } from 'sonner';

interface AddTransactionModalProps {
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;          // called after API succeeds — for parent to refresh
    defaultType?: 'expense' | 'income';
}

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000];

export default function AddTransactionModal({
    open, onClose, onSaved, defaultType = 'expense',
}: AddTransactionModalProps) {
    const [type, setType] = useState<'expense' | 'income'>(defaultType);
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [note, setNote] = useState('');
    const [selectedCardId, setSelectedCardId] = useState<string>('cash');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [saving, setSaving] = useState(false);

    const { cards } = useCards();

    const paymentSources = [
        { id: 'cash', label: 'Tiền mặt', icon: '💵', sub: '', balance: null as number | null, cardType: '' },
        ...cards.map(c => ({
            id: c._id,
            label: `${c.bankShortName} ••${c.cardNumber}`,
            icon: c.cardType === 'credit' ? '💳' : c.cardType === 'savings' ? '🐷' : c.cardType === 'eWallet' ? '📱' : '🏧',
            sub: c.cardType === 'credit' ? 'Tín dụng' : c.cardType === 'debit' ? 'Ghi nợ' : c.cardType === 'savings' ? 'Tiết kiệm' : 'Ví điện tử',
            balance: c.balance,
            bankColor: c.bankColor,
            cardType: c.cardType,
        })),
    ];

    useEffect(() => {
        if (open) {
            setType(defaultType);
            setAmount('');
            setCategory('');
            setNote('');
            setDate(new Date().toISOString().slice(0, 10));
            const defaultCard = cards.find(c => c.isDefault);
            setSelectedCardId(defaultCard ? defaultCard._id : 'cash');
        }
    }, [open, defaultType]);

    const handleAmountInput = (v: string) => {
        setAmount(v.replace(/\D/g, ''));
    };

    const addQuick = (v: number) => {
        setAmount(String((parseInt(amount || '0')) + v));
    };

    const INCOME_CATS = ['Lương', 'Freelance', 'Đầu tư', 'Thưởng', 'Tiền lãi', 'Khác'];
    const filteredCategories = CATEGORIES.filter(c =>
        type === 'income'
            ? INCOME_CATS.includes(c.label)
            : !['Lương', 'Freelance', 'Đầu tư', 'Thưởng', 'Tiền lãi'].includes(c.label)
    );

    const displayAmount = amount ? parseInt(amount).toLocaleString('vi-VN') : '';

    // ===== ACTUAL API CALL =====
    const handleSave = async () => {
        if (!amount || !category) return;
        setSaving(true);
        try {
            await transactionsApi.create({
                type,
                amount: parseInt(amount),
                category,
                note,
                date: new Date(date),
                paymentMethod: selectedCardId === 'cash' ? 'cash' : 'card',
                cardId: selectedCardId === 'cash' ? null : selectedCardId,
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

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">

                {/* ===== Gradient Header ===== */}
                <div className="gradient-primary px-5 pt-5 pb-6">
                    <DialogHeader>
                        <div className="flex items-center justify-between mb-4">
                            <DialogTitle className="text-white text-lg font-bold">Thêm giao dịch</DialogTitle>
                            <button onClick={onClose} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </DialogHeader>

                    {/* Type toggle */}
                    <div className="flex gap-2 bg-white/20 rounded-2xl p-1 mb-5">
                        {(['expense', 'income'] as const).map(t => (
                            <button key={t} onClick={() => { setType(t); setCategory(''); }}
                                className={cn('flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
                                    type === t ? 'bg-white text-indigo-600' : 'text-white/80 hover:text-white')}>
                                {t === 'expense' ? '💸 Chi tiêu' : '💰 Thu nhập'}
                            </button>
                        ))}
                    </div>

                    {/* Amount */}
                    <div className="text-center">
                        <p className="text-white/70 text-xs mb-1">Số tiền</p>
                        <div className="flex items-center justify-center gap-2">
                            <input type="tel" value={displayAmount}
                                onChange={e => handleAmountInput(e.target.value.replace(/\./g, '').replace(/,/g, ''))}
                                placeholder="0"
                                className="bg-transparent text-white text-4xl font-bold text-center placeholder-white/40 w-full outline-none"
                                style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }} />
                            <span className="text-white/60 text-xl flex-shrink-0">đ</span>
                        </div>
                        <div className="flex gap-1.5 mt-3 justify-center flex-wrap">
                            {QUICK_AMOUNTS.map(v => (
                                <button key={v} onClick={() => addQuick(v)}
                                    className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-2.5 py-1 rounded-full transition-colors">
                                    +{v >= 1000000 ? `${v / 1000000}tr` : `${v / 1000}k`}
                                </button>
                            ))}
                            {amount && (
                                <button onClick={() => setAmount('')}
                                    className="bg-white/20 hover:bg-white/30 text-white text-xs px-2.5 py-1 rounded-full">
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== White body ===== */}
                <div className="bg-white px-5 py-4 space-y-4 max-h-[55vh] overflow-y-auto">

                    {/* Category */}
                    <div>
                        <p className="text-sm font-bold text-gray-800 mb-2">Danh mục</p>
                        <div className="grid grid-cols-4 gap-2">
                            {filteredCategories.map(cat => (
                                <button key={cat.id} onClick={() => setCategory(cat.label)}
                                    className={cn('flex flex-col items-center gap-1 p-2.5 rounded-2xl border-2 transition-all',
                                        category === cat.label ? 'border-indigo-400 scale-95' : 'border-transparent bg-gray-50 hover:bg-gray-100')}
                                    style={category === cat.label ? { backgroundColor: `${cat.color}20`, borderColor: cat.color } : {}}>
                                    <span className="text-2xl">{cat.icon}</span>
                                    <span className="text-[10px] text-gray-500 text-center leading-tight">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payment card selection */}
                    <div>
                        <p className="text-sm font-bold text-gray-800 mb-2">Thanh toán bằng</p>
                        <div className="flex flex-col gap-1.5">
                            {paymentSources.map(s => {
                                const isCredit = s.cardType === 'credit';
                                return (
                                    <button key={s.id} onClick={() => setSelectedCardId(s.id)}
                                        className={cn('flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 transition-all text-left',
                                            selectedCardId === s.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200')}>
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-gray-100">
                                            {s.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-gray-800 truncate">{s.label}</p>
                                            {s.sub && <p className="text-xs text-gray-400">{s.sub}</p>}
                                        </div>
                                        {s.balance !== null && (
                                            <p className={cn('text-xs font-bold flex-shrink-0', isCredit ? 'text-red-500' : 'text-emerald-600')}>
                                                {isCredit ? '-' : ''}{s.balance.toLocaleString('vi-VN')}đ
                                            </p>
                                        )}
                                        {selectedCardId === s.id && (
                                            <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <p className="text-sm font-bold text-gray-800 mb-1.5">Ngày giao dịch</p>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-800 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>

                    {/* Note */}
                    <div>
                        <p className="text-sm font-bold text-gray-800 mb-1.5">Ghi chú</p>
                        <input value={note} onChange={e => setNote(e.target.value)}
                            placeholder="VD: Ăn trưa, Cà phê sáng..."
                            className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-800 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>

                    {/* Save button */}
                    <button onClick={handleSave} disabled={!amount || !category || saving}
                        className={cn('w-full gradient-primary text-white rounded-2xl py-4 text-base font-bold flex items-center justify-center gap-2 transition-all',
                            (!amount || !category || saving) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:scale-95')}>
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                        {saving ? 'Đang lưu...' : 'Lưu giao dịch'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
