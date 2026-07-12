'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { expenseSharesApi } from '@/lib/api';
import { useCards } from '@/hooks/useCards';
import { toast } from 'sonner';

interface TransactionLite {
    _id: string;
    amount: number;
    note: string;
    category: string;
}

interface ShareParticipant {
    _id: string;
    name: string;
    amount: number;
    status: 'pending' | 'paid';
    paidAt: string | null;
}

interface ExpenseShare {
    _id: string;
    totalAmount: number;
    receiveCardId: {
        _id: string;
        bankName: string;
        bankShortName: string;
        receiveAccountNumber: string;
        receiveQrImage: string;
        cardHolder: string;
    };
    participants: ShareParticipant[];
}

interface ExpenseShareModalProps {
    open: boolean;
    onClose: () => void;
    transaction: TransactionLite | null;
    onSettled?: () => void; // called after a participant is marked paid (balance/transactions changed)
}

const fmt = (n: number) => n.toLocaleString('vi-VN');

export default function ExpenseShareModal({ open, onClose, transaction, onSettled }: ExpenseShareModalProps) {
    const { cards } = useCards();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [share, setShare] = useState<ExpenseShare | null>(null);
    const [editing, setEditing] = useState(false); // true = show the form (create or edit)
    const [rows, setRows] = useState<{ name: string; amount: number }[]>([{ name: '', amount: 0 }]);
    const [receiveCardId, setReceiveCardId] = useState('');
    const receiptRef = useRef<HTMLDivElement>(null);
    const [saveImgLoading, setSaveImgLoading] = useState(false);

    const receivableCards = cards.filter(c => c.receiveQrImage && c.cardType !== 'savings');

    useEffect(() => {
        if (!open || !transaction) return;
        setLoading(true);
        expenseSharesApi.getByTransaction(transaction._id)
            .then(res => {
                const data = res.data?.data as ExpenseShare | null;
                setShare(data);
                if (data) {
                    setEditing(false);
                    setRows(data.participants.map(p => ({ name: p.name, amount: p.amount })));
                    setReceiveCardId(data.receiveCardId._id);
                } else {
                    setEditing(true);
                    setRows([{ name: '', amount: 0 }]);
                    setReceiveCardId(receivableCards[0]?._id || '');
                }
            })
            .catch(() => toast.error('Không thể tải thông tin chia bill'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, transaction?._id]);

    if (!transaction) return null;

    const addRow = () => setRows(prev => [...prev, { name: '', amount: 0 }]);
    const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));
    const updateRow = (i: number, patch: Partial<{ name: string; amount: number }>) =>
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

    const splitEqually = () => {
        if (rows.length === 0) return;
        const each = Math.floor(transaction.amount / (rows.length + 1));
        setRows(prev => prev.map(r => ({ ...r, amount: each })));
    };

    const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const myShare = transaction.amount - sum;
    const canSubmit = rows.length > 0 && rows.every(r => r.name.trim() && r.amount > 0) && sum <= transaction.amount && !!receiveCardId;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSaving(true);
        try {
            const cleaned = rows.map(r => ({ name: r.name.trim(), amount: Number(r.amount) }));
            const res = share
                ? await expenseSharesApi.update(share._id, { participants: cleaned, receiveCardId })
                : await expenseSharesApi.create({ transactionId: transaction._id, receiveCardId, participants: cleaned });
            setShare(res.data.data);
            setEditing(false);
            toast.success('Đã lưu chia bill');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Không thể lưu');
        } finally {
            setSaving(false);
        }
    };

    const handleMarkPaid = async (participantId: string) => {
        if (!share) return;
        try {
            const res = await expenseSharesApi.markParticipantPaid(share._id, participantId);
            setShare(res.data.data);
            toast.success('Đã xác nhận nhận tiền');
            onSettled?.();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Không thể xác nhận');
        }
    };

    const handleDelete = async () => {
        if (!share) return;
        if (!confirm('Xoá bản chia bill này?')) return;
        try {
            await expenseSharesApi.delete(share._id);
            setShare(null);
            setEditing(true);
            setRows([{ name: '', amount: 0 }]);
            toast.success('Đã xoá');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Không thể xoá');
        }
    };

    const handleSaveImage = async () => {
        if (!receiptRef.current) return;
        setSaveImgLoading(true);
        try {
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(receiptRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = `chia-bill-${transaction._id.slice(-6)}.png`;
            link.href = dataUrl;
            link.click();
        } catch {
            toast.error('Không thể lưu ảnh, thử lại nhé');
        } finally {
            setSaveImgLoading(false);
        }
    };

    const allPaid = !!share && share.participants.every(p => p.status === 'paid');
    const hasPaidAny = !!share && share.participants.some(p => p.status === 'paid');

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="
fixed inset-x-0 bottom-0 top-[12vh] z-50
gap-0 w-full max-w-md mx-auto
!translate-x-0 !translate-y-0
bg-white dark:bg-surface
rounded-t-3xl sm:rounded-3xl
shadow-xl flex flex-col
overflow-hidden p-0 border-0
data-[state=open]:animate-in
data-[state=closed]:animate-out
data-[state=open]:slide-in-from-bottom
data-[state=closed]:slide-out-to-bottom
duration-200
">
                <button className="flex h-5 w-full items-center justify-center shrink-0 pt-2 pb-1 bg-white dark:bg-surface z-10" onClick={onClose}>
                    <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
                </button>
                <div className="flex items-center px-4 pb-2 shrink-0 bg-white dark:bg-surface z-10 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold flex-1 text-center text-[#000000] dark:text-white">Chia sẻ hoá đơn</h2>
                </div>

                <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pt-3 pb-6 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <ActionIcon type="loader" size={24} tile={false} spin color="#7f19e6" />
                        </div>
                    ) : editing ? (
                        <>
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-[#000000] dark:text-white">
                                    Tổng: <span className="text-[#7f19e6]">{fmt(transaction.amount)}đ</span>
                                </p>
                                <button onClick={splitEqually} className="text-xs font-bold text-[#7f19e6] bg-[#7f19e6]/10 px-3 py-1.5 rounded-full">
                                    Chia đều
                                </button>
                            </div>

                            <div className="space-y-2">
                                {rows.map((row, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input value={row.name} onChange={e => updateRow(i, { name: e.target.value })}
                                            placeholder={`Người ${i + 1}`}
                                            className="flex-[1.2] rounded-xl bg-white dark:bg-surface border-slate-200 dark:border-slate-700 h-11 text-sm font-semibold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                        <Input type="text"
                                            value={row.amount ? new Intl.NumberFormat('vi-VN').format(row.amount) : ''}
                                            onChange={e => updateRow(i, { amount: Number(e.target.value.replace(/\D/g, '')) })}
                                            placeholder="Số tiền"
                                            className="flex-1 rounded-xl bg-white dark:bg-surface border-slate-200 dark:border-slate-700 h-11 text-sm font-bold text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
                                        <button onClick={() => removeRow(i)} disabled={rows.length === 1}
                                            className="w-8 h-8 flex-shrink-0 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center disabled:opacity-30">
                                            <ActionIcon type="x" size={14} tile={false} color="currentColor" />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={addRow} className="text-xs font-bold text-[#7f19e6] flex items-center gap-1 py-1">
                                    <ActionIcon type="plus" size={14} tile={false} color="currentColor" /> Thêm người
                                </button>
                            </div>

                            <div className="text-xs text-slate-400 flex justify-between px-1">
                                <span>Phần của bạn</span>
                                <span className={cn('font-bold', myShare < 0 ? 'text-red-500' : 'text-slate-600 dark:text-slate-300')}>{fmt(myShare)}đ</span>
                            </div>

                            <div>
                                <p className="text-sm font-bold text-[#000000] dark:text-white mb-2">Nhận vào tài khoản</p>
                                {receivableCards.length === 0 ? (
                                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2.5">
                                        Chưa có tài khoản nào lưu QR — vào Thẻ → Sửa thẻ → mục "Thông tin nhận tiền" để thêm.
                                    </p>
                                ) : (
                                    <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                                        {receivableCards.map(c => (
                                            <button key={c._id} onClick={() => setReceiveCardId(c._id)}
                                                className={cn('shrink-0 px-3 py-2 rounded-xl border text-xs font-bold', receiveCardId === c._id ? 'border-[#7f19e6] bg-[#7f19e6]/10 text-[#7f19e6]' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300')}>
                                                {c.bankName} •• {c.cardNumber}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : share ? (
                        <>
                            {/* Receipt view — captured to PNG by handleSaveImage */}
                            <div ref={receiptRef} className="bg-white rounded-2xl border border-slate-200 p-4">
                                <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Chia bill</p>
                                <p className="text-center text-sm font-bold text-slate-800 mb-3">{transaction.note || transaction.category}</p>
                                <div className="divide-y divide-slate-100">
                                    {share.participants.map(p => (
                                        <div key={p._id} className="flex items-center justify-between py-2">
                                            <span className="text-sm font-semibold text-slate-700">{p.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-900">{fmt(p.amount)}đ</span>
                                                {p.status === 'paid' && (
                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Đã nhận</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-slate-200">
                                    <span className="text-xs font-bold text-slate-400">Tổng giao dịch</span>
                                    <span className="text-sm font-black text-slate-900">{fmt(transaction.amount)}đ</span>
                                </div>

                                <div className="mt-4 flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                                    {share.receiveCardId.receiveQrImage && (
                                        <img src={share.receiveCardId.receiveQrImage} alt="QR" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 truncate">{share.receiveCardId.bankName}</p>
                                        <p className="text-sm font-black text-slate-900 tracking-wide">{share.receiveCardId.receiveAccountNumber}</p>
                                        <p className="text-xs text-slate-500 truncate">{share.receiveCardId.cardHolder}</p>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleSaveImage} disabled={saveImgLoading}
                                className="w-full h-11 rounded-xl border border-[#7f19e6]/30 bg-[#7f19e6]/10 text-[#7f19e6] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                <ActionIcon type={saveImgLoading ? 'loader' : 'download'} size={16} tile={false} spin={saveImgLoading} color="currentColor" />
                                Lưu ảnh để gửi nhóm
                            </button>

                            {/* Mark-paid list — only the payer can confirm, matches app convention */}
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Xác nhận đã nhận tiền</p>
                                {share.participants.map(p => (
                                    <div key={p._id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                                            <p className="text-xs text-slate-400">{fmt(p.amount)}đ</p>
                                        </div>
                                        {p.status === 'paid' ? (
                                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                                <ActionIcon type="check" size={14} tile={false} color="currentColor" /> Đã nhận
                                            </span>
                                        ) : (
                                            <button onClick={() => handleMarkPaid(p._id)}
                                                className="text-xs font-bold text-white bg-[#7f19e6] px-3 py-1.5 rounded-full active:scale-95">
                                                Đánh dấu đã nhận
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 pt-1">
                                <button onClick={() => setEditing(true)} disabled={allPaid}
                                    className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40">
                                    Sửa
                                </button>
                                <button onClick={handleDelete} disabled={hasPaidAny}
                                    className="flex-1 h-10 rounded-xl border border-red-200 dark:border-red-900/40 text-sm font-bold text-red-500 disabled:opacity-40">
                                    Xoá bản chia
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>

                {editing && (
                    <div className="shrink-0 w-full p-4 bg-white dark:bg-surface border-t border-slate-100 dark:border-slate-800">
                        <button onClick={handleSubmit} disabled={!canSubmit || saving}
                            className="w-full h-12 bg-gradient-to-r from-[#7f19e6] to-[#9b4de8] text-white rounded-xl text-base font-bold shadow-lg shadow-[#7f19e6]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {saving ? 'Đang lưu...' : 'OK'}
                        </button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
