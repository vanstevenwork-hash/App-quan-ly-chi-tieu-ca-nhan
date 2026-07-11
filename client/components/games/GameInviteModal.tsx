'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useGameMatches, type GameType } from '@/hooks/useGameMatches';

interface GameInviteModalProps {
    open: boolean;
    onClose: () => void;
    onInvited?: () => void;
}

const GAMES: { type: GameType; label: string }[] = [
    { type: 'tien_len', label: 'Tiến lên miền Nam' },
    { type: 'phom', label: 'Phỏm' },
];

export default function GameInviteModal({ open, onClose, onInvited }: GameInviteModalProps) {
    const [mounted, setMounted] = useState(false);
    const [email, setEmail] = useState('');
    const [gameType, setGameType] = useState<GameType>('tien_len');
    const [sending, setSending] = useState(false);
    const { invite } = useGameMatches();

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => { if (open) setEmail(''); }, [open]);

    const handleInvite = async () => {
        if (!email.trim()) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            toast.error('Email không hợp lệ');
            return;
        }
        setSending(true);
        try {
            await invite(email.trim().toLowerCase(), gameType);
            toast.success('Đã gửi lời mời!');
            onInvited?.();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Không thể gửi lời mời');
        }
        setSending(false);
    };

    if (!mounted || !open) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] z-50 animate-in slide-in-from-bottom duration-300">
                <div className="bg-white dark:bg-surface rounded-t-3xl shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                                <span className="text-lg">🃏</span>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-800 dark:text-white">Mời chơi bài</h2>
                                <p className="text-xs text-slate-400">Chơi trực tiếp với vợ/chồng</p>
                            </div>
                        </div>
                        <button onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                            <CustomIcon type="x" size={14} tile={false} color="currentColor" />
                        </button>
                    </div>

                    <div className="px-5 pb-6 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">
                                Chọn game
                            </label>
                            <div className="flex gap-2">
                                {GAMES.map(g => (
                                    <button
                                        key={g.type}
                                        onClick={() => setGameType(g.type)}
                                        className={cn(
                                            'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all',
                                            gameType === g.type
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-gray-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-gray-200 dark:border-slate-700'
                                        )}
                                    >
                                        {g.label}
                                    </button>
                                ))}
                            </div>
                        </div>

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
                                Người được mời phải đã có tài khoản trong app
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
