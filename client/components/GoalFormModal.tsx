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
                setName('');
                setTargetAmount('');
                setDeadline('');
                setCategory('other');
                setColor('#6C63FF');
                setDescription('');
                setAutoSaveAmount('');
                setAutoSaveFreq('');
            }
            setErrors({});
        }
    }, [open, editGoal]);

    const handleSave = async () => {
        const errs: { name?: string; targetAmount?: string } = {};

        if (!name.trim()) errs.name = 'Vui lòng nhập tên mục tiêu';

        const amt = parseInt(targetAmount.replace(/\D/g, ''));
        if (!amt || amt <= 0) errs.targetAmount = 'Vui lòng nhập số tiền hợp lệ';

        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

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
            <DialogContent
                className="
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
"
            >

                {/* Drag handle */}
                <button
                    className="flex h-5 w-full items-center justify-center shrink-0 pt-2 pb-1 bg-white dark:bg-slate-900"
                    onClick={onClose}
                >
                    <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                </button>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-center w-full text-center">

                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editGoal ? 'Chỉnh sửa mục tiêu' : 'Tạo mục tiêu'}
                            </h2>
                            <p className="text-xs text-slate-400">
                                Đặt mục tiêu & theo dõi tiến độ
                            </p>
                        </div>
                    </div>

                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto hide-scrollbar pb-24 px-4 pt-3 space-y-5">

                    {/* Name */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Tên mục tiêu *
                        </label>

                        <input
                            value={name}
                            onChange={e => {
                                setName(e.target.value);
                                setErrors(p => ({ ...p, name: undefined }));
                            }}
                            placeholder="VD: Mua laptop mới, Du lịch Nhật..."
                            className={cn(
                                'w-full rounded-xl border px-4 py-3 text-sm font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none transition',
                                errors.name
                                    ? 'border-red-400 focus:ring-1 focus:ring-red-400'
                                    : 'border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-[#6C63FF]'
                            )}
                        />

                        {errors.name && (
                            <p className="text-xs text-red-500 mt-1">
                                {errors.name}
                            </p>
                        )}
                    </div>

                    {/* Target */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Số tiền mục tiêu *
                        </label>

                        <div className="relative">
                            <input
                                value={
                                    targetAmount
                                        ? parseInt(targetAmount.replace(/\D/g, '') || '0').toLocaleString('vi-VN')
                                        : ''
                                }
                                onChange={e => {
                                    setTargetAmount(e.target.value.replace(/\D/g, ''));
                                    setErrors(p => ({ ...p, targetAmount: undefined }));
                                }}
                                placeholder="0"
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 pr-8 text-sm bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-[#6C63FF]"
                            />

                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">
                                ₫
                            </span>
                        </div>

                        {errors.targetAmount && (
                            <p className="text-xs text-red-500 mt-1">
                                {errors.targetAmount}
                            </p>
                        )}
                    </div>

                    {/* Category */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">
                            Danh mục
                        </label>

                        <div className="grid grid-cols-5 gap-2">
                            {GOAL_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCategory(cat.id)}
                                    className={cn(
                                        'flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all',
                                        category === cat.id
                                            ? 'border-[#6C63FF] bg-[#6C63FF]/5'
                                            : 'border-slate-200 dark:border-slate-700'
                                    )}
                                >
                                    <span className="text-xl">{cat.icon}</span>

                                    <span
                                        className={cn(
                                            'text-[9px] font-semibold',
                                            category === cat.id
                                                ? 'text-[#6C63FF]'
                                                : 'text-slate-500 dark:text-slate-400'
                                        )}
                                    >
                                        {cat.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">
                            Màu sắc
                        </label>

                        <div className="flex gap-2.5 flex-wrap">
                            {GOAL_COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={cn(
                                        'w-8 h-8 rounded-full transition-transform',
                                        color === c ? 'scale-125 ring-2 ring-offset-2' : 'hover:scale-110'
                                    )}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>


                    {/* Deadline */} <div> <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Ngày hoàn thành</label> <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().slice(0, 10)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[#6C63FF] transition" /> </div> {/* Auto-save */} <div> <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">Tiết kiệm tự động (tuỳ chọn)</label> <div className="flex gap-2"> <div className="relative flex-1"> <input value={autoSaveAmount ? parseInt(autoSaveAmount.replace(/\D/g, '') || '0').toLocaleString('vi-VN') : ''} onChange={e => setAutoSaveAmount(e.target.value.replace(/\D/g, ''))} placeholder="Số tiền" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[#6C63FF] pr-6" /> <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₫</span> </div> <select value={autoSaveFreq} onChange={e => setAutoSaveFreq(e.target.value as any)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-[#6C63FF] flex-shrink-0" > <option value="">Tần suất</option> <option value="daily">Hàng ngày</option> <option value="weekly">Hàng tuần</option> <option value="monthly">Hàng tháng</option> </select> </div> </div>
                    {/* Note */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Ghi chú
                        </label>

                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-[#6C63FF] resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-60"
                        style={{
                            background: `linear-gradient(135deg, ${color}, ${color}cc)`
                        }}
                    >
                        {saving
                            ? 'Đang lưu...'
                            : editGoal
                                ? '✓ Cập nhật mục tiêu'
                                : '✨ Tạo mục tiêu'}
                    </button>
                </div>

            </DialogContent>
        </Dialog>
    );
}