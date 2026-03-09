'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WealthSource, WealthFormData } from '@/hooks/useWealth';

const EMOJI_LIST = [
    '💰', '🏦', '🥇', '🪙', '💎', '₿', '📈', '🏠', '🚗', '💳',
    '🎯', '🔗', '💸', '🎁', '🌟', '🏆', '💼', '📦', '🌏', '⭐',
    '🪙', '💵', '💴', '💶', '💷', '🏧', '💹', '📊', '🔑', '🎰',
];

const PRESETS = [
    { name: 'Sổ tiết kiệm', icon: '🏦', color: '#3B82F6', category: 'savings' },
    { name: 'Vàng', icon: '🥇', color: '#F59E0B', category: 'gold' },
    { name: 'Bitcoin', icon: '₿', color: '#F97316', category: 'crypto' },
    { name: 'Crypto', icon: '🪙', color: '#8B5CF6', category: 'crypto' },
    { name: 'Cổ phiếu', icon: '📈', color: '#10B981', category: 'stock' },
    { name: 'Hoàn tiền', icon: '💸', color: '#EC4899', category: 'cashback' },
    { name: 'Affiliate', icon: '🔗', color: '#06B6D4', category: 'affiliate' },
    { name: 'Bất động sản', icon: '🏠', color: '#64748B', category: 'real_estate' },
];

const COLOR_SWATCHES = [
    '#6C63FF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#EC4899', '#8B5CF6', '#06B6D4', '#F97316', '#64748B',
];

interface WealthSourceModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: WealthFormData) => Promise<void>;
    editSource?: WealthSource | null;
}

const emptyForm = (): WealthFormData => ({ name: '', icon: '💰', color: '#6C63FF', balance: 0, category: 'other', note: '' });

export default function WealthSourceModal({ open, onClose, onSave, editSource }: WealthSourceModalProps) {
    const [mounted, setMounted] = useState(false);
    const [form, setForm] = useState<WealthFormData>(emptyForm());
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState<'preset' | 'form'>('preset');
    const [rawBalance, setRawBalance] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (open) {
            if (editSource) {
                setForm({ name: editSource.name, icon: editSource.icon, color: editSource.color, balance: editSource.balance, category: editSource.category, note: editSource.note });
                setRawBalance(String(editSource.balance));
                setStep('form');
            } else {
                setForm(emptyForm());
                setRawBalance('');
                setStep('preset');
            }
            setErrors({});
        }
    }, [open, editSource]);

    const applyPreset = (p: typeof PRESETS[0]) => {
        setForm(f => ({ ...f, name: p.name, icon: p.icon, color: p.color, category: p.category }));
        setStep('form');
    };

    const handleSave = async () => {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = 'Vui lòng nhập tên nguồn tài sản';
        const bal = parseInt(rawBalance.replace(/\D/g, '') || '0');
        if (rawBalance && bal < 0) errs.balance = 'Số dư không hợp lệ';
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        setSaving(true);
        try {
            await onSave({ ...form, balance: bal });
            onClose();
        } finally { setSaving(false); }
    };

    if (!mounted || !open) return null;

    const displayBalance = rawBalance ? parseInt(rawBalance.replace(/\D/g, '') || '0').toLocaleString('vi-VN') : '';

    const modal = (
        <>
            {/* Backdrop */}
            <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[1100] backdrop-blur-sm" />
            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-[1101] bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
                <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">
                            {editSource ? 'Sửa nguồn tài sản' : 'Thêm nguồn tài sản'}
                        </h2>
                        <p className="text-xs text-gray-400">Tùy chỉnh icon và tên theo ý muốn</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-8">
                    {/* Step 1: Chọn preset (only for create) */}
                    {step === 'preset' && !editSource && (
                        <div className="space-y-4">
                            <p className="text-sm font-semibold text-gray-600">Chọn loại hoặc tự tạo mới:</p>
                            <div className="grid grid-cols-4 gap-2">
                                {PRESETS.map(p => (
                                    <button key={p.name} onClick={() => applyPreset(p)}
                                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-purple-300 hover:bg-purple-50 transition-all active:scale-95">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                                            style={{ backgroundColor: `${p.color}20` }}>
                                            {p.icon}
                                        </div>
                                        <span className="text-[10px] text-gray-500 font-medium text-center leading-tight">{p.name}</span>
                                    </button>
                                ))}
                                {/* Custom */}
                                <button onClick={() => setStep('form')}
                                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl bg-gray-100">✏️</div>
                                    <span className="text-[10px] text-gray-500 font-medium">Tự tạo</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Form */}
                    {step === 'form' && (
                        <div className="space-y-5">
                            {/* Icon + Color preview */}
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm"
                                    style={{ backgroundColor: `${form.color}22`, border: `2px solid ${form.color}44` }}>
                                    {form.icon}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 mb-1 font-medium">Màu card</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {COLOR_SWATCHES.map(c => (
                                            <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                                                className={cn('w-7 h-7 rounded-full border-2 transition-transform hover:scale-110', form.color === c ? 'border-gray-800 scale-110' : 'border-transparent')}
                                                style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Emoji picker */}
                            <div>
                                <p className="text-sm font-bold text-gray-700 mb-2">Chọn icon</p>
                                <div className="grid grid-cols-8 gap-1.5">
                                    {EMOJI_LIST.map(e => (
                                        <button key={e} onClick={() => setForm(f => ({ ...f, icon: e }))}
                                            className={cn('w-full aspect-square rounded-xl text-xl flex items-center justify-center transition-all hover:scale-110',
                                                form.icon === e ? 'bg-purple-100 scale-110 ring-2 ring-purple-400' : 'bg-gray-50 hover:bg-gray-100')}>
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <p className="text-sm font-bold text-gray-700 mb-1.5">
                                    Tên nguồn tài sản <span className="text-red-500">*</span>
                                </p>
                                <input value={form.name}
                                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(p => ({ ...p, name: '' })); }}
                                    placeholder="VD: Vàng SJC, Bitcoin cá nhân..."
                                    className={cn(
                                        'w-full border-2 rounded-2xl px-4 py-3 text-gray-800 text-sm outline-none transition-colors',
                                        errors.name ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-purple-400'
                                    )} />
                                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                            </div>

                            {/* Balance */}
                            <div>
                                <p className="text-sm font-bold text-gray-700 mb-1.5">Số dư / Giá trị hiện tại</p>
                                <div className={cn(
                                    'flex items-center gap-2 border-2 rounded-2xl px-4 py-3 transition-colors',
                                    errors.balance ? 'border-red-400 focus-within:border-red-400' : 'border-gray-200 focus-within:border-purple-400'
                                )}>
                                    <input type="tel"
                                        value={displayBalance}
                                        onChange={e => { setRawBalance(e.target.value.replace(/\./g, '').replace(/,/g, '')); setErrors(p => ({ ...p, balance: '' })); }}
                                        placeholder="0"
                                        className="flex-1 text-2xl font-bold text-gray-900 bg-transparent outline-none" />
                                    <span className="text-gray-400 font-semibold">đ</span>
                                </div>
                                {errors.balance && <p className="text-xs text-red-500 mt-1">{errors.balance}</p>}
                            </div>

                            {/* Note */}
                            <div>
                                <p className="text-sm font-bold text-gray-700 mb-1.5">Ghi chú (tuỳ chọn)</p>
                                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                    placeholder="VD: Mua tháng 3/2025, kỳ hạn 6 tháng..."
                                    className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-gray-800 text-sm outline-none transition-colors" />
                            </div>

                            {/* Buttons */}
                            {!editSource && (
                                <button onClick={() => setStep('preset')} className="w-full py-2 text-sm text-gray-500 hover:text-purple-600 transition-colors">
                                    ← Quay lại chọn loại
                                </button>
                            )}
                            <button onClick={handleSave} disabled={!form.name || saving}
                                className={cn('w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all',
                                    !form.name || saving
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:opacity-90 active:scale-95 shadow-lg shadow-purple-200')}>
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                {saving ? 'Đang lưu...' : (editSource ? 'Cập nhật' : 'Thêm tài sản')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    return createPortal(modal, document.body);
}
