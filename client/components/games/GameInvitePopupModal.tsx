'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { GameMatch } from '@/hooks/useGameMatches';

const GAME_LABELS: Record<string, string> = { tien_len: 'Tiến lên miền Nam', phom: 'Phỏm' };

interface GameInvitePopupModalProps {
    invites: GameMatch[];
    onRespond: (id: string, accept: boolean) => Promise<{ data?: GameMatch }>;
}

// A full-screen confirm popup for incoming game invites — shown on Dashboard
// so accepting/declining doesn't require finding the card in a list first.
export default function GameInvitePopupModal({ invites, onRespond }: GameInvitePopupModalProps) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

    useEffect(() => { setMounted(true); }, []);

    const invite = invites.find(i => !dismissedIds.has(i._id));
    if (!mounted || !invite) return null;

    const host = typeof invite.hostId === 'object' ? invite.hostId : null;

    const handle = async (accept: boolean) => {
        setBusy(accept ? 'accept' : 'decline');
        try {
            const res = await onRespond(invite._id, accept);
            if (accept) {
                toast.success('Đã chấp nhận, vào chơi thôi!');
                router.push(`/games/${res?.data?._id || invite._id}`);
            } else {
                toast.success('Đã từ chối lời mời');
            }
        } catch {
            toast.error('Không thể xử lý lời mời, thử lại sau');
        } finally {
            setBusy(null);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/55 backdrop-blur-sm px-6">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-surface p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/15 text-3xl">
                    🃏
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                    {host?.name || 'Ai đó'} mời bạn chơi bài
                </h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">
                    {GAME_LABELS[invite.gameType] || invite.gameType}
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => handle(false)}
                        disabled={busy !== null}
                        className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {busy === 'decline' ? 'Đang xử lý…' : 'Từ chối'}
                    </button>
                    <button
                        onClick={() => handle(true)}
                        disabled={busy !== null}
                        className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25"
                    >
                        {busy === 'accept' ? 'Đang xử lý…' : 'Tham gia'}
                    </button>
                </div>
                <button
                    onClick={() => setDismissedIds(prev => new Set(prev).add(invite._id))}
                    disabled={busy !== null}
                    className="mt-3 text-xs font-semibold text-slate-400 dark:text-slate-500 disabled:opacity-50"
                >
                    Để sau
                </button>
            </div>
        </div>,
        document.body
    );
}
