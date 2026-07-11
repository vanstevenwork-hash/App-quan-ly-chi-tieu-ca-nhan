'use client';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCardShareStore, type CardShare } from '@/hooks/useCardShares';

interface CardShareModalProps {
    open: boolean;
    onClose: () => void;
    cardId: string;
    cardName: string; // e.g. "VPBank •••• 1234"
}

export default function CardShareModal({ open, onClose, cardId, cardName }: CardShareModalProps) {
    const [mounted, setMounted] = useState(false);
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [shares, setShares] = useState<CardShare[]>([]);
    const [loadingShares, setLoadingShares] = useState(false);

    const { invite, getCardShares, revoke } = useCardShareStore();

    useEffect(() => { setMounted(true); }, []);

    const fetchShares = useCallback(async () => {
        if (!cardId) return;
        setLoadingShares(true);
        try {
            const data = await getCardShares(cardId);
            setShares(data);
        } catch { /* ignore */ }
        setLoadingShares(false);
    }, [cardId, getCardShares]);

    useEffect(() => {
        if (open && cardId) {
            fetchShares();
            setEmail('');
        }
    }, [open, cardId, fetchShares]);

    const handleInvite = async () => {
        if (!email.trim()) return;
        // Basic email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            toast.error('Email không hợp lệ');
            return;
        }
        setSending(true);
        try {
            await invite(cardId, email.trim().toLowerCase());
            toast.success('Đã gửi lời mời!');
            setEmail('');
            await fetchShares();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Không thể gửi lời mời');
        }
        setSending(false);
    };

    const handleRevoke = async (shareId: string) => {
        try {
            await revoke(shareId);
            toast.success('Đã thu hồi quyền chia sẻ');
            setShares(prev => prev.filter(s => s._id !== shareId));
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Không thể thu hồi');
        }
    };

    if (!mounted || !open) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />

            {/* Modal */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] z-50 animate-in slide-in-from-bottom duration-300">
                <div className="bg-white dark:bg-surface rounded-t-3xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                <span className="text-lg">🤝</span>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-800 dark:text-white">Chia sẻ thẻ</h2>
                                <p className="text-xs text-slate-400">{cardName}</p>
                            </div>
                        </div>
                        <button onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                            <CustomIcon type="x" size={14} tile={false} color="currentColor" />
                        </button>
                    </div>

                    <div className="px-5 pb-6 space-y-4">
                        {/* Invite form */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">
                                Mời qua email
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleInvite()}
                                    placeholder="email@example.com"
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                                />
                                <button
                                    onClick={handleInvite}
                                    disabled={sending || !email.trim()}
                                    className={cn(
                                        'px-5 py-3 rounded-xl text-sm font-bold transition-all active:scale-95',
                                        sending || !email.trim()
                                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
                                    )}
                                >
                                    {sending ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <CustomIcon type="send" size={16} tile={false} color="currentColor" />
                                    )}
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                                Người được mời có thể thêm/sửa/xóa giao dịch trên thẻ này
                            </p>
                        </div>

                        {/* Shares list */}
                        <div>
                            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                                Người được chia sẻ
                            </h3>

                            {loadingShares ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                </div>
                            ) : shares.length === 0 ? (
                                <div className="text-center py-6">
                                    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
                                        <span className="text-2xl">📭</span>
                                    </div>
                                    <p className="text-sm text-slate-400 dark:text-slate-500">
                                        Chưa chia sẻ với ai
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {shares.map(share => {
                                        const user = share.sharedWithUserId as any;
                                        const isPending = share.status === 'pending';
                                        return (
                                            <div key={share._id}
                                                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/50">
                                                {/* Avatar */}
                                                <div className={cn(
                                                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                                                    isPending
                                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                                                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                                                )}>
                                                    {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                                        {user?.name || share.sharedWithEmail}
                                                    </p>
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-xs text-slate-400 truncate">
                                                            {share.sharedWithEmail}
                                                        </p>
                                                        <span className={cn(
                                                            'text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                                                            isPending
                                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                        )}>
                                                            {isPending ? 'Chờ xác nhận' : 'Đã kết nối'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Revoke */}
                                                <button
                                                    onClick={() => handleRevoke(share._id)}
                                                    className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95 transition-all flex-shrink-0"
                                                    title="Thu hồi"
                                                >
                                                    <CustomIcon type="x" size={12} tile={false} color="currentColor" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
