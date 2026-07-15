'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { cardsApi } from '@/lib/api';
import type { Card } from '@/hooks/useCards';
import { toast } from 'sonner';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const TERMS = [1, 3, 6, 12, 24];

interface SavingsRenewModalProps {
    open: boolean;
    card: Card | null;
    onClose: () => void;
    onRenewed: () => void;
}

export default function SavingsRenewModal({ open, card, onClose, onRenewed }: SavingsRenewModalProps) {
    // Interest earned over the finished term (matches the server's calc).
    const interest = card ? Math.round(card.balance * ((card.interestRate || 0) / 100) * ((card.term || 0) / 12)) : 0;

    const [newAmount, setNewAmount] = useState(0);
    const [newRate, setNewRate] = useState(0);
    const [newTerm, setNewTerm] = useState(12);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && card) {
            setNewAmount(card.balance + interest); // default: roll principal + interest
            setNewRate(card.interestRate || 0);
            setNewTerm(card.term || 12);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, card?._id]);

    if (!card) return null;

    const rollBoth = card.balance + interest;
    const canSubmit = newAmount > 0 && newTerm > 0;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSaving(true);
        try {
            const res = await cardsApi.renewSavings(card._id, { newAmount, newRate, newTerm });
            toast.success(`Đã tái tục · lãi +${fmt(res.data?.interestEarned ?? interest)}đ`);
            onRenewed();
            onClose();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Không thể tái tục');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="
fixed inset-x-0 bottom-0 top-auto z-50
w-full max-w-md mx-auto gap-0
!translate-x-0 !translate-y-0
bg-white dark:bg-surface
rounded-t-3xl sm:rounded-3xl sm:top-[15vh] sm:bottom-auto
shadow-xl flex flex-col overflow-hidden p-0 border-0
data-[state=open]:animate-in data-[state=closed]:animate-out
data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom
duration-200
">
                <button className="flex h-5 w-full items-center justify-center shrink-0 pt-2 pb-1 bg-white dark:bg-surface z-10" onClick={onClose}>
                    <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
                </button>
                <div className="flex items-center px-4 pb-2 shrink-0 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold flex-1 text-center text-[#000000] dark:text-white">Tái tục sổ tiết kiệm</h2>
                </div>

                <div className="px-4 pt-4 pb-6 space-y-4">
                    {/* Maturity summary */}
                    <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-500/20 p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Sổ</span>
                            <span className="font-bold text-slate-800 dark:text-white">{card.bankName}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Gốc cũ</span>
                            <span className="font-bold text-slate-800 dark:text-white">{fmt(card.balance)}đ</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Lãi nhận ({card.interestRate || 0}% · {card.term || 0} tháng)</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400">+{fmt(interest)}đ</span>
                        </div>
                        <p className="text-[11px] text-slate-400 pt-1">Lãi sẽ được ghi thành 1 giao dịch thu nhập "Tiền lãi".</p>
                    </div>

                    {/* Amount presets */}
                    <div>
                        <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Số tiền gửi lại</p>
                        <div className="flex gap-2 mb-2">
                            <button onClick={() => setNewAmount(rollBoth)}
                                className={cn('flex-1 rounded-xl border px-2 py-2 text-xs font-bold transition', newAmount === rollBoth ? 'border-[#7f19e6] bg-[#7f19e6]/10 text-[#7f19e6]' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300')}>
                                Gốc + lãi<br /><span className="text-[10px] font-semibold opacity-70">{fmt(rollBoth)}đ</span>
                            </button>
                            <button onClick={() => setNewAmount(card.balance)}
                                className={cn('flex-1 rounded-xl border px-2 py-2 text-xs font-bold transition', newAmount === card.balance ? 'border-[#7f19e6] bg-[#7f19e6]/10 text-[#7f19e6]' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300')}>
                                Chỉ gốc<br /><span className="text-[10px] font-semibold opacity-70">{fmt(card.balance)}đ</span>
                            </button>
                        </div>
                        <Input type="text" value={newAmount ? new Intl.NumberFormat('vi-VN').format(newAmount) : ''}
                            onChange={e => setNewAmount(Number(e.target.value.replace(/\D/g, '')))}
                            placeholder="0"
                            className="rounded-xl bg-white dark:bg-surface border-slate-200 dark:border-slate-700 h-12 text-base font-bold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Lãi suất mới (%/năm)</p>
                            <Input type="number" step="0.1" value={newRate || ''}
                                onChange={e => setNewRate(Number(e.target.value))}
                                placeholder="7.5"
                                className="rounded-xl bg-white dark:bg-surface border-slate-200 dark:border-slate-700 h-12 text-base font-semibold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Kỳ hạn mới</p>
                            <select value={newTerm} onChange={e => setNewTerm(Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface text-black dark:text-white h-12 px-3 text-base font-semibold focus:outline-none focus:ring-1 focus:ring-[#7f19e6] focus:border-[#7f19e6] appearance-none">
                                {TERMS.map(t => <option key={t} value={t}>{t} tháng</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 w-full p-4 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={handleSubmit} disabled={!canSubmit || saving}
                        className="w-full h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-base font-bold shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        <ActionIcon type="refreshCw" size={18} tile={false} color="#fff" />
                        {saving ? 'Đang tái tục...' : 'Tái tục sổ'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
