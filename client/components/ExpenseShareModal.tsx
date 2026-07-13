'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { expenseSharesApi } from '@/lib/api';
import { useCards } from '@/hooks/useCards';
import { toast } from 'sonner';
import { CATEGORIES_MAP } from '@/lib/mockData';
import CategoryIcon from '@/components/icons/CategoryIcon';

interface TransactionLite {
    _id: string;
    amount: number;
    note: string;
    category: string;
    date: string;
}

const AVATAR_COLORS = ['#F59E0B', '#6366F1', '#10B981', '#EC4899', '#06B6D4', '#8B5CF6'];
const initialsOf = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
// Group digits by 4 from the left for readability: "41322102001" -> "4132 2102 001"
const formatAccountNumber = (num: string) => num.replace(/(\d{4})(?=\d)/g, '$1 ');

interface ShareParticipant {
    _id: string;
    name: string;
    amount: number;
    note?: string;
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
    const [rows, setRows] = useState<{ name: string; amount: number; note: string }[]>([{ name: '', amount: 0, note: '' }]);
    const [receiveCardId, setReceiveCardId] = useState('');
    const receiptRef = useRef<HTMLDivElement>(null);
    const [saveImgLoading, setSaveImgLoading] = useState(false);
    // The QR lives on Cloudinary (cross-origin). Loading it straight into an
    // <img> means html-to-image can't inline it (canvas taint) and it gets
    // dropped from the exported PNG. So we ask our own API to fetch the bytes
    // and hand them back as a base64 data: URL — same-origin from the browser's
    // view, so it renders AND exports cleanly. Falls back to the raw URL for
    // on-screen display if the proxy call fails.
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    const receivableCards = cards.filter(c => c.receiveQrImage && c.cardType !== 'savings');

    useEffect(() => {
        if (!share?._id || !share.receiveCardId.receiveQrImage) { setQrDataUrl(null); return; }
        let cancelled = false;
        setQrDataUrl(null);
        expenseSharesApi.getQrDataUrl(share._id)
            .then(res => { if (!cancelled) setQrDataUrl(res.data?.dataUrl || null); })
            .catch(() => { if (!cancelled) setQrDataUrl(null); }); // fall back to the plain URL below
        return () => { cancelled = true; };
    }, [share?._id, share?.receiveCardId.receiveQrImage]);

    useEffect(() => {
        if (!open || !transaction) return;
        setLoading(true);
        expenseSharesApi.getByTransaction(transaction._id)
            .then(res => {
                const data = res.data?.data as ExpenseShare | null;
                setShare(data);
                if (data) {
                    setEditing(false);
                    setRows(data.participants.map(p => ({ name: p.name, amount: p.amount, note: p.note || '' })));
                    setReceiveCardId(data.receiveCardId._id);
                } else {
                    setEditing(true);
                    setRows([{ name: '', amount: 0, note: '' }]);
                    setReceiveCardId(receivableCards[0]?._id || '');
                }
            })
            .catch(() => toast.error('Không thể tải thông tin chia bill'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, transaction?._id]);

    if (!transaction) return null;

    const addRow = () => setRows(prev => [...prev, { name: '', amount: 0, note: '' }]);
    const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));
    const updateRow = (i: number, patch: Partial<{ name: string; amount: number; note: string }>) =>
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
            const cleaned = rows.map(r => ({ name: r.name.trim(), amount: Number(r.amount), note: r.note.trim() }));
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

    // Undo — reverses the balance bump and deletes the reimbursement
    // transaction created by handleMarkPaid, so an accidental tap doesn't
    // leave stray income entries behind.
    const handleUnmarkPaid = async (participantId: string) => {
        if (!share) return;
        if (!confirm('Bỏ xác nhận đã nhận tiền? Giao dịch hoàn tiền tương ứng sẽ bị xoá.')) return;
        try {
            const res = await expenseSharesApi.unmarkParticipantPaid(share._id, participantId);
            setShare(res.data.data);
            toast.success('Đã bỏ xác nhận');
            onSettled?.();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Không thể bỏ xác nhận');
        }
    };

    const handleDelete = async () => {
        if (!share) return;
        if (!confirm('Xoá bản chia bill này?')) return;
        try {
            await expenseSharesApi.delete(share._id);
            setShare(null);
            setEditing(true);
            setRows([{ name: '', amount: 0, note: '' }]);
            toast.success('Đã xoá');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Không thể xoá');
        }
    };

    const handleSaveImage = async () => {
        if (!receiptRef.current) return;
        setSaveImgLoading(true);
        try {
            // Make sure the QR is available as a same-origin data: URL before
            // capturing — a raw cross-origin <img> taints the canvas and gets
            // dropped from the PNG. If the effect hasn't resolved it yet (or
            // fell back to the raw URL), fetch it on demand now and wait for
            // the <img> to actually swap to it before capturing.
            let qr = qrDataUrl;
            if (share?.receiveCardId.receiveQrImage && !qr) {
                try {
                    const res = await expenseSharesApi.getQrDataUrl(share._id);
                    qr = res.data?.dataUrl || null;
                    if (qr) {
                        setQrDataUrl(qr);
                        // let React paint the new src, then wait for the image to decode
                        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                    }
                } catch { /* fall through — export without QR rather than blocking */ }
            }

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

    const cat = CATEGORIES_MAP.get(transaction.category) || CATEGORIES_MAP.get('Khác')!;
    const shareOwed = share ? share.participants.reduce((s, p) => s + p.amount, 0) : 0;
    const shareCollected = share ? share.participants.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0) : 0;
    const shareMyPortion = share ? transaction.amount - shareOwed : 0;
    const collectPct = shareOwed > 0 ? Math.min((shareCollected / shareOwed) * 100, 100) : 0;
    const txDate = new Date(transaction.date);
    const weekdayDate = txDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedDate = weekdayDate.charAt(0).toUpperCase() + weekdayDate.slice(1);
    const formattedTime = txDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const timeOf = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="
fixed inset-x-0 bottom-0 top-[5vh] z-50
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
                                    <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 space-y-1.5">
                                        <div className="flex items-center gap-2">
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
                                        <Input value={row.note} onChange={e => updateRow(i, { note: e.target.value })}
                                            placeholder="Ghi chú: ăn gì, uống gì... (không bắt buộc)"
                                            className="rounded-xl bg-white dark:bg-surface border-slate-200 dark:border-slate-700 h-9 text-xs text-black dark:text-white focus:border-[#7f19e6] dark:focus:border-purple-400 focus:ring-1 focus:ring-[#7f19e6]" />
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
                            {/* Ticket: white receipt half (captured to PNG) + dark stub half (app-only controls) */}
                            <div>
                                <div ref={receiptRef} className="bg-white rounded-t-3xl border border-b-0 border-slate-200 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cat.color}18` }}>
                                            <CategoryIcon type={cat.catIconType || 'khac'} size={22} tile={false} />
                                        </div>
                                        <span className="text-[11px] font-black text-[#7f19e6] bg-[#7f19e6]/10 px-3 py-1 rounded-full uppercase tracking-wide">Chia bill</span>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900">{transaction.category}</h3>
                                    <p className="text-xs text-slate-400 mb-3">{formattedDate} · {formattedTime} · {share.participants.length + 1} người</p>

                                    <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-3 mb-1">
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-400">Tổng hoá đơn</p>
                                            <p className="text-lg font-black text-slate-900">{fmt(transaction.amount)}đ</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] font-semibold text-slate-400">Phần của bạn</p>
                                            <p className="text-base font-black text-slate-700">{fmt(shareMyPortion)}đ</p>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-slate-100">
                                        {share.participants.map((p, i) => (
                                            <div key={p._id} className="flex items-center gap-3 py-2.5">
                                                <div
                                                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                                                    style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                                                >
                                                    {initialsOf(p.name)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
                                                    {p.note && <p className="text-[11px] text-slate-400 truncate">✎ {p.note}</p>}
                                                    {/* Only surface a status line once paid — leaving pending ones
                                                        silent avoids reading like a debt-collection nag. */}
                                                    {p.status === 'paid' && (
                                                        <p className="text-[11px] font-bold text-emerald-500">Đã chuyển · {timeOf(p.paidAt)}</p>
                                                    )}
                                                </div>
                                                <span className="text-sm font-black text-slate-900 flex-shrink-0">{fmt(p.amount)}đ</span>
                                                {p.status === 'paid' ? (
                                                    <span className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center flex-shrink-0">
                                                        <ActionIcon type="check" size={11} tile={false} color="#fff" />
                                                    </span>
                                                ) : (
                                                    <span className="w-5 h-5 rounded-full border-2 border-dashed border-slate-200 flex-shrink-0" />
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {share.receiveCardId.receiveQrImage && (
                                        <div className="mt-4 flex items-center gap-3">
                                            <img
                                                src={qrDataUrl || share.receiveCardId.receiveQrImage}
                                                alt="QR"
                                                className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-slate-100"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {share.receiveCardId.bankName}
                                                </p>
                                                <p className="text-base font-black text-slate-900 tracking-wide">{formatAccountNumber(share.receiveCardId.receiveAccountNumber)}</p>
                                                <p className="text-xs text-slate-500 truncate">{share.receiveCardId.cardHolder}</p>
                                                <p className="text-[11px] font-bold text-[#7f19e6] mt-0.5">◈ Quét mã để chuyển khoản</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Perforated tear line between the receipt and the app controls below */}
                                <div className="relative bg-white border-x border-slate-200">
                                    <div className="absolute -left-2.5 top-0 -translate-y-1/2 w-5 h-5 rounded-full bg-white dark:bg-surface" />
                                    <div className="absolute -right-2.5 top-0 -translate-y-1/2 w-5 h-5 rounded-full bg-white dark:bg-surface" />
                                    <div className="border-t-2 border-dashed border-slate-200 mx-5" />
                                </div>

                                <div className="bg-[#15122a] rounded-b-3xl p-4 space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between text-xs font-bold text-white/70 mb-1.5">
                                            <span>Tiến độ thu tiền</span>
                                            <span><span className="text-emerald-400">{fmt(shareCollected)}đ</span> / {fmt(shareOwed)}đ</span>
                                        </div>
                                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${collectPct}%` }} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[11px] font-bold text-white/40 uppercase tracking-wide">Xác nhận đã nhận tiền</p>
                                        {share.participants.map((p, i) => (
                                            <div key={p._id} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                                                        style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                                                    >
                                                        {initialsOf(p.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-white truncate">{p.name}</p>
                                                        <p className="text-xs text-white/40">{fmt(p.amount)}đ{p.status === 'paid' ? ` · lúc ${timeOf(p.paidAt)}` : ''}</p>
                                                    </div>
                                                </div>
                                                {p.status === 'paid' ? (
                                                    <button onClick={() => handleUnmarkPaid(p._id)} title="Bấm để bỏ xác nhận"
                                                        className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1.5 rounded-full flex items-center gap-1 flex-shrink-0 active:scale-95">
                                                        <ActionIcon type="check" size={12} tile={false} color="currentColor" /> Đã nhận
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleMarkPaid(p._id)}
                                                        className="text-xs font-bold text-white bg-[#7f19e6] px-3 py-1.5 rounded-full active:scale-95 flex-shrink-0">
                                                        Đánh dấu đã nhận
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <button onClick={handleSaveImage} disabled={saveImgLoading}
                                        className="w-full h-11 rounded-xl bg-gradient-to-r from-[#7f19e6] to-[#9b4de8] text-white text-sm font-bold shadow-lg shadow-[#7f19e6]/30 flex items-center justify-center gap-2 disabled:opacity-50">
                                        <ActionIcon type={saveImgLoading ? 'loader' : 'download'} size={16} tile={false} spin={saveImgLoading} color="#fff" />
                                        Lưu ảnh để gửi nhóm
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <button onClick={() => setEditing(true)} disabled={allPaid}
                                    className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40">
                                    Sửa hoá đơn
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
