'use client';
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { X, Plus, Minus, Clock } from 'lucide-react';
import type { Goal } from '@/hooks/useGoals';

interface GoalContributeModalProps {
    open: boolean;
    onClose: () => void;
    goal: Goal | null;
    onDeposit: (id: string, amount: number, note?: string) => Promise<void>;
    onWithdraw: (id: string, amount: number, note?: string) => Promise<void>;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const fmtShort = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}tr` : `${Math.round(n / 1_000)}k`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function GoalContributeModal({ open, onClose, goal, onDeposit, onWithdraw }: GoalContributeModalProps) {
    const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const amountNum = parseInt(amount.replace(/\D/g, '') || '0');

    const handleSubmit = async () => {
        if (!amountNum || amountNum <= 0) { setError('Vui lòng nhập số tiền hợp lệ'); return; }
        if (!goal) return;
        setSaving(true);
        try {
            if (mode === 'deposit') {
                await onDeposit(goal._id, amountNum, note.trim() || undefined);
            } else {
                if (amountNum > goal.currentAmount) { setError('Số tiền rút lớn hơn số tiền hiện có'); setSaving(false); return; }
                await onWithdraw(goal._id, amountNum, note.trim() || undefined);
            }
            setAmount(''); setNote(''); setError('');
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!goal) return null;

    const pct = goal.progress ?? 0;
    const contributions = [...(goal.contributions || [])].reverse().slice(0, 20);

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="p-0 gap-0 max-w-md w-full rounded-3xl overflow-hidden border-0 shadow-2xl max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{goal.icon}</span>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{goal.name}</h2>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-2">
                        <div className="flex justify-between text-xs font-semibold mb-1">
                            <span className="text-slate-500">{fmt(goal.currentAmount)}₫</span>
                            <span style={{ color: goal.color }}>{pct}%</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, backgroundColor: goal.color }} />
                        </div>
                        <p className="text-xs text-slate-400 mt-1 text-right">Mục tiêu: {fmt(goal.targetAmount)}₫</p>
                    </div>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Mode toggle */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                        <button onClick={() => { setMode('deposit'); setError(''); }}
                            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all',
                                mode === 'deposit' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600')}>
                            <Plus className="w-4 h-4" /> Nạp tiền
                        </button>
                        <button onClick={() => { setMode('withdraw'); setError(''); }}
                            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all',
                                mode === 'withdraw' ? 'bg-white dark:bg-slate-700 shadow text-red-500 dark:text-red-400' : 'text-slate-400 hover:text-slate-600')}>
                            <Minus className="w-4 h-4" /> Rút tiền
                        </button>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Số tiền</label>
                        <div className="relative">
                            <input
                                value={amount ? amountNum.toLocaleString('vi-VN') : ''}
                                onChange={e => { setAmount(e.target.value.replace(/\D/g, '')); setError(''); }}
                                placeholder="0"
                                inputMode="numeric"
                                className={cn('w-full rounded-xl border px-4 py-3.5 text-lg font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none transition pr-8',
                                    error ? 'border-red-400' : 'border-slate-200 dark:border-slate-700 focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]')}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₫</span>
                        </div>
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

                        {/* Quick amount chips */}
                        <div className="flex gap-2 mt-2 flex-wrap">
                            {[100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000].map(v => (
                                <button key={v} type="button"
                                    onClick={() => setAmount(v.toString())}
                                    className="px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#6C63FF] hover:text-[#6C63FF] transition">
                                    {fmtShort(v)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Note */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Ghi chú (tuỳ chọn)</label>
                        <input
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder={mode === 'deposit' ? 'VD: Tiết kiệm tháng 3...' : 'VD: Chi tiêu khẩn cấp...'}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[#6C63FF] transition"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className={cn('w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-60',
                            mode === 'deposit'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                : 'bg-gradient-to-r from-red-500 to-orange-500')}
                    >
                        {saving ? 'Đang xử lý...' : mode === 'deposit' ? `➕ Nạp ${amountNum > 0 ? amountNum.toLocaleString('vi-VN') + '₫' : 'tiền'}` : `➖ Rút ${amountNum > 0 ? amountNum.toLocaleString('vi-VN') + '₫' : 'tiền'}`}
                    </button>

                    {/* Contribution history */}
                    {contributions.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Lịch sử đóng góp
                            </h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {contributions.map(c => (
                                    <div key={c._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                                                c.type === 'deposit' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40')}>
                                                {c.type === 'deposit' ? <Plus className="w-3.5 h-3.5 text-emerald-600" /> : <Minus className="w-3.5 h-3.5 text-red-500" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{c.note || (c.type === 'deposit' ? 'Nạp tiền' : 'Rút tiền')}</p>
                                                <p className="text-[10px] text-slate-300 dark:text-slate-600">{fmtDate(c.date)}</p>
                                            </div>
                                        </div>
                                        <span className={cn('text-sm font-bold flex-shrink-0',
                                            c.type === 'deposit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                                            {c.type === 'deposit' ? '+' : '-'}{fmtShort(c.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
