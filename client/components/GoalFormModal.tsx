'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import type { Goal, GoalFormData } from '@/hooks/useGoals';

const GOAL_CATEGORIES = [
    { id: 'travel', icon: '✈️', label: 'Du lịch' },
    { id: 'house', icon: '🏠', label: 'Mua nhà' },
    { id: 'car', icon: '🚗', label: 'Mua xe' },
    { id: 'device', icon: '💻', label: 'Thiết bị' },
    { id: 'emergency', icon: '💰', label: 'Quỹ KẨN' },
    { id: 'education', icon: '🎓', label: 'Học tập' },
    { id: 'gift', icon: '🎁', label: 'Mua quà' },
    { id: 'vacation', icon: '🏖', label: 'Nghỉ dưỡng' },
    { id: 'investment', icon: '📈', label: 'Đầu tư' },
    { id: 'health', icon: '💪', label: 'Sức khỏe' },
    { id: 'wedding', icon: '💍', label: 'Đám cưới' },
    { id: 'other', icon: '🎯', label: 'Khác' },
];

const GOAL_COLORS = [
    '#6C63FF', '#F59E0B', '#10B981', '#EF4444',
    '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6',
];

interface GoalFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: GoalFormData) => Promise<void>;
    editGoal?: Goal | null;
}

export default function GoalFormModal({ open, onClose, onSave, editGoal }: GoalFormModalProps) {
    const [name, setName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [deadline, setDeadline] = useState('');
    const [category, setCategory] = useState('other');
    const [color, setColor] = useState('#6C63FF');
    const [description, setDescription] = useState('');
    const [autoSaveAmount, setAutoSaveAmount] = useState('');
    const [autoSaveFreq, setAutoSaveFreq] = useState<'daily' | 'weekly' | 'monthly' | ''>('');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; targetAmount?: string }>({});

    const selectedCat = GOAL_CATEGORIES.find(c => c.id === category);

    useEffect(() => {
        if (open) {
            if (editGoal) {
                setName(editGoal.name);
                setTargetAmount(editGoal.targetAmount.toString());
                setDeadline(editGoal.deadline ? editGoal.deadline.slice(0, 10) : '');
                setCategory(editGoal.category || 'other');
                setColor(editGoal.color || '#6C63FF');
                setDescription(editGoal.description || '');
                setAutoSaveAmount(editGoal.autoSaveAmount ? editGoal.autoSaveAmount.toString() : '');
                setAutoSaveFreq((editGoal.autoSaveFrequency || '') as any);
            } else {
                setName(''); setTargetAmount(''); setDeadline('');
                setCategory('other'); setColor('#6C63FF');
                setDescription(''); setAutoSaveAmount(''); setAutoSaveFreq('');
            }
            setErrors({});
        }
    }, [open, editGoal]);

    const handleSave = async () => {
        const errs: { name?: string; targetAmount?: string } = {};
        if (!name.trim()) errs.name = 'Vui lòng nhập tên mục tiêu';
        const amt = parseInt(targetAmount.replace(/\D/g, ''));
        if (!amt || amt <= 0) errs.targetAmount = 'Vui lòng nhập số tiền hợp lệ';
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setSaving(true);
        try {
            const cat = GOAL_CATEGORIES.find(c => c.id === category);
            await onSave({
                name: name.trim(),
                targetAmount: amt,
                deadline: deadline || undefined,
                icon: cat?.icon || '🎯',
                color,
                category,
                description: description.trim(),
                autoSaveAmount: autoSaveAmount ? parseInt(autoSaveAmount.replace(/\D/g, '')) : 0,
                autoSaveFrequency: autoSaveFreq || '',
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="p-0 gap-0 max-w-md w-full rounded-3xl overflow-hidden border-0 shadow-2xl max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                            style={{ backgroundColor: color + '22' }}>
                            {selectedCat?.icon || '🎯'}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                {editGoal ? 'Chỉnh sửa mục tiêu' : 'Tạo mục tiêu mới'}
                            </h2>
                            <p className="text-xs text-slate-400">Đặt mục tiêu & theo dõi tiến độ</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                        <X className="w-4 h-4 text-slate-500" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Tên mục tiêu *</label>
                        <input
                            value={name}
                            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
                            placeholder="VD: Mua laptop mới, Du lịch Nhật..."
                            className={cn('w-full rounded-xl border px-4 py-3 text-sm font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none transition',
                                errors.name ? 'border-red-400 focus:ring-1 focus:ring-red-400' : 'border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-[#6C63FF]')}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>

                    {/* Target amount */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Số tiền mục tiêu *</label>
                        <div className="relative">
                            <input
                                value={targetAmount ? parseInt(targetAmount.replace(/\D/g, '') || '0').toLocaleString('vi-VN') : ''}
                                onChange={e => { setTargetAmount(e.target.value.replace(/\D/g, '')); setErrors(p => ({ ...p, targetAmount: undefined })); }}
                                placeholder="0"
                                className={cn('w-full rounded-xl border px-4 py-3 text-sm font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none transition pr-8',
                                    errors.targetAmount ? 'border-red-400 focus:ring-1 focus:ring-red-400' : 'border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-[#6C63FF]')}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₫</span>
                        </div>
                        {errors.targetAmount && <p className="text-xs text-red-500 mt-1">{errors.targetAmount}</p>}
                    </div>

                    {/* Category */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">Danh mục</label>
                        <div className="grid grid-cols-4 gap-2">
                            {GOAL_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCategory(cat.id)}
                                    className={cn('flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all',
                                        category === cat.id
                                            ? 'border-[#6C63FF] bg-[#6C63FF]/5'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300')}
                                >
                                    <span className="text-xl">{cat.icon}</span>
                                    <span className={cn('text-[9px] font-semibold', category === cat.id ? 'text-[#6C63FF]' : 'text-slate-500 dark:text-slate-400')}>{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">Màu sắc</label>
                        <div className="flex gap-2.5 flex-wrap">
                            {GOAL_COLORS.map(c => (
                                <button key={c} type="button" onClick={() => setColor(c)}
                                    className={cn('w-8 h-8 rounded-full ring-offset-2 transition-all', color === c ? 'ring-2 ring-offset-2' : 'hover:scale-110')}
                                    style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Ngày hoàn thành</label>
                        <input
                            type="date"
                            value={deadline}
                            onChange={e => setDeadline(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[#6C63FF] transition"
                        />
                    </div>

                    {/* Auto-save */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">Tiết kiệm tự động (tuỳ chọn)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    value={autoSaveAmount ? parseInt(autoSaveAmount.replace(/\D/g, '') || '0').toLocaleString('vi-VN') : ''}
                                    onChange={e => setAutoSaveAmount(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Số tiền"
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[#6C63FF] pr-6"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₫</span>
                            </div>
                            <select
                                value={autoSaveFreq}
                                onChange={e => setAutoSaveFreq(e.target.value as any)}
                                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-[#6C63FF] flex-shrink-0"
                            >
                                <option value="">Tần suất</option>
                                <option value="daily">Hàng ngày</option>
                                <option value="weekly">Hàng tuần</option>
                                <option value="monthly">Hàng tháng</option>
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Ghi chú (tuỳ chọn)</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Thêm mô tả về mục tiêu của bạn..."
                            rows={2}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[#6C63FF] resize-none transition"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-60"
                        style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
                    >
                        {saving ? 'Đang lưu...' : editGoal ? '✓ Cập nhật mục tiêu' : '✨ Tạo mục tiêu'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
