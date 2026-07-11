'use client';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useGameMatches, type GameType } from '@/hooks/useGameMatches';
import { authApi } from '@/lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INVITEES = 3;
type EmailCheck = { loading: boolean; exists?: boolean; name?: string };

interface GameInviteModalProps {
    open: boolean;
    onClose: () => void;
    onInvited?: () => void;
}

const GAMES: { type: GameType; label: string; tagline: string; ranks: string[]; suits: string[] }[] = [
    { type: 'tien_len', label: 'Tiến lên miền Nam', tagline: 'Đánh bài đỉnh cao', ranks: ['A', 'Q', 'A'], suits: ['♠', '♥', '♦'] },
    { type: 'phom', label: 'Phỏm', tagline: 'Tính toán & chiến thuật', ranks: ['J', 'Q', 'K'], suits: ['♣', '♥', '♠'] },
];
const TURN_SECONDS_OPTIONS = [15, 30, 45, 60];

function MiniCard({ rank, suit, className }: { rank: string; suit: string; className?: string }) {
    const red = suit === '♥' || suit === '♦';
    return (
        <div className={cn(
            'flex h-12 w-9 flex-col items-center justify-center rounded-[5px] border border-[#f7f0dd]/70',
            'bg-gradient-to-br from-[#f7f1de] to-[#d8c8a2] shadow-[0_5px_12px_rgba(0,0,0,0.45)]',
            className
        )}>
            <span className={cn('text-[13px] font-black leading-none', red ? 'text-red-600' : 'text-[#241a33]')}>{rank}</span>
            <span className={cn('text-sm leading-none', red ? 'text-red-600' : 'text-[#241a33]')}>{suit}</span>
        </div>
    );
}

function PokerChip({ size = 40, className }: { size?: number; className?: string }) {
    return (
        <div
            className={cn('relative rounded-full bg-gradient-to-br from-[#7c4dff] to-[#3b1d7a] shadow-[0_6px_14px_rgba(0,0,0,0.5)]', className)}
            style={{ width: size, height: size }}
        >
            <div className="absolute inset-[3px] rounded-full border-2 border-dashed border-amber-200/80" />
            <div className="absolute inset-[9px] flex items-center justify-center rounded-full bg-gradient-to-br from-[#f2cf6b] to-[#c8952b]">
                <span className="text-[13px] leading-none text-[#3b1d7a]" style={{ fontSize: size * 0.32 }}>♠</span>
            </div>
        </div>
    );
}

function SectionHeader({ icon, index, title, right }: { icon: string; index: number; title: string; right?: ReactNode }) {
    return (
        <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/25 text-[13px] shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]">{icon}</span>
            <span className="text-[13px] font-black uppercase tracking-wide text-amber-300">{index}. {title}</span>
            {right && <span className="ml-auto">{right}</span>}
        </div>
    );
}

export default function GameInviteModal({ open, onClose, onInvited }: GameInviteModalProps) {
    const [mounted, setMounted] = useState(false);
    const [gameType, setGameType] = useState<GameType>('tien_len');
    const [turnSeconds, setTurnSeconds] = useState(30);
    const [emails, setEmails] = useState<string[]>([]);
    const [draft, setDraft] = useState('');
    const [checks, setChecks] = useState<Record<string, EmailCheck>>({});
    const [sending, setSending] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const { invite } = useGameMatches();

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => {
        if (open) { setEmails([]); setDraft(''); setChecks({}); }
    }, [open]);

    const addEmail = (raw: string) => {
        const addr = raw.trim().toLowerCase();
        if (!addr) return true;
        if (!EMAIL_RE.test(addr)) { toast.error(`Email không hợp lệ: ${addr}`); return false; }
        if (emails.includes(addr)) return true;
        if (emails.length >= MAX_INVITEES) { toast.error(`Một ván chỉ mời tối đa ${MAX_INVITEES} người nữa`); return false; }
        setEmails(prev => [...prev, addr]);
        setChecks(prev => ({ ...prev, [addr]: { loading: true } }));
        authApi.checkEmail(addr)
            .then(res => setChecks(prev => ({ ...prev, [addr]: { loading: false, exists: res.data?.exists, name: res.data?.name } })))
            .catch(() => setChecks(prev => ({ ...prev, [addr]: { loading: false } })));
        return true;
    };

    const removeEmail = (addr: string) => setEmails(prev => prev.filter(e => e !== addr));

    const commitDraft = () => {
        if (!draft.trim()) return true;
        const ok = addEmail(draft);
        if (ok) setDraft('');
        return ok;
    };

    const handleDraftChange = (value: string) => {
        // Comma/space/newline (incl. pasted lists) commits the pending email as a chip
        if (/[\s,;]/.test(value)) {
            const parts = value.split(/[\s,;]+/);
            const rest = parts.pop() || '';
            parts.filter(Boolean).forEach(addEmail);
            setDraft(rest);
        } else {
            setDraft(value);
        }
    };

    const handleInvite = async () => {
        if (!commitDraft()) return;
        // committing the draft updates state async — recompute the final list locally
        const finalEmails = draft.trim() && EMAIL_RE.test(draft.trim().toLowerCase()) && !emails.includes(draft.trim().toLowerCase())
            ? [...emails, draft.trim().toLowerCase()]
            : emails;
        if (finalEmails.length === 0) { toast.error('Nhập ít nhất 1 email để mời'); return; }
        if (finalEmails.some(addr => checks[addr]?.exists === false)) {
            toast.error('Có email chưa đăng ký tài khoản trong app');
            return;
        }
        setSending(true);
        try {
            await invite(finalEmails, gameType, turnSeconds);
            toast.success('Đã tạo phòng và gửi lời mời!');
            onInvited?.();
            onClose();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || 'Không thể gửi lời mời');
        }
        setSending(false);
    };

    if (!mounted || !open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0c0819] shadow-[0_-20px_60px_rgba(0,0,0,0.55)] animate-in slide-in-from-bottom duration-300 sm:rounded-3xl">
                {/* Ambient glows */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_22%_0%,rgba(124,58,237,0.3),transparent_55%),radial-gradient(circle_at_82%_10%,rgba(240,194,75,0.12),transparent_45%)]" />

                {/* Header */}
                <div className="relative flex flex-shrink-0 items-center justify-center px-4 pb-2 pt-4">
                    <div className="flex items-center gap-2">
                        <span className="text-amber-300/80">✦</span>
                        <h1 className="text-base font-black uppercase tracking-[0.08em] text-amber-300 drop-shadow-[0_2px_10px_rgba(240,194,75,0.35)]">Tạo phòng chơi</h1>
                        <span className="text-amber-300/80">✦</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/60"
                        aria-label="Đóng"
                    >
                        <ActionIcon type="x" size={14} tile={false} color="currentColor" />
                    </button>
                </div>

                <div className="relative overflow-y-auto px-4 pb-6">
                    {/* Hero */}
                    <div className="mb-4 flex items-center gap-3">
                        <div className="relative h-[92px] w-[118px] flex-shrink-0">
                            <div className="absolute bottom-2 left-1/2 h-3.5 w-20 -translate-x-1/2 rounded-full bg-amber-400/25 blur-md" />
                            <MiniCard rank="K" suit="♠" className="absolute left-1 top-4 h-14 w-10 -rotate-[16deg]" />
                            <MiniCard rank="K" suit="♣" className="absolute left-8 top-1 h-14 w-10 -rotate-[4deg]" />
                            <MiniCard rank="A" suit="♠" className="absolute left-[60px] top-2 h-14 w-10 rotate-[12deg]" />
                            <PokerChip size={38} className="absolute bottom-0 left-7" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-black leading-snug text-white">Mời bạn bè chơi cùng ngay!</h2>
                            <p className="mt-1 text-xs leading-relaxed text-white/50">Tạo bàn chơi và gửi lời mời đến bạn bè để cùng thư giãn.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* 1. Chọn game */}
                        <div>
                            <SectionHeader icon="🎴" index={1} title="Chọn game" />
                            <div className="grid grid-cols-2 gap-2.5">
                                {GAMES.map(g => {
                                    const selected = gameType === g.type;
                                    return (
                                        <button
                                            key={g.type}
                                            onClick={() => setGameType(g.type)}
                                            className={cn(
                                                'relative overflow-hidden rounded-2xl border p-2.5 pb-3 text-center transition-all active:scale-[0.98]',
                                                selected
                                                    ? 'border-amber-300/70 bg-gradient-to-b from-violet-700/45 to-violet-950/55 shadow-[0_0_26px_rgba(240,194,75,0.14),inset_0_0_0_1px_rgba(240,194,75,0.12)]'
                                                    : 'border-white/10 bg-white/[0.04]'
                                            )}
                                        >
                                            {selected && (
                                                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-amber-950 shadow-[0_2px_8px_rgba(240,194,75,0.6)]">✓</span>
                                            )}
                                            <div className="relative mx-auto mb-2 h-[54px] w-[80px]">
                                                <MiniCard rank={g.ranks[0]} suit={g.suits[0]} className="absolute left-0 top-2 h-11 w-8 -rotate-[14deg]" />
                                                <MiniCard rank={g.ranks[1]} suit={g.suits[1]} className="absolute left-6 top-0 h-11 w-8 -rotate-[2deg]" />
                                                <MiniCard rank={g.ranks[2]} suit={g.suits[2]} className="absolute left-12 top-1 h-11 w-8 rotate-[12deg]" />
                                                <PokerChip size={24} className="absolute -bottom-1 left-1/2 -translate-x-1/2" />
                                            </div>
                                            <p className="text-[13px] font-black leading-tight text-white">{g.label}</p>
                                            <p className="mt-0.5 text-[11px] text-white/45">{g.tagline}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. Thời gian mỗi lượt */}
                        <div>
                            <SectionHeader icon="⏱" index={2} title="Thời gian mỗi lượt" />
                            <div className="grid grid-cols-4 gap-2">
                                {TURN_SECONDS_OPTIONS.map(seconds => (
                                    <button
                                        key={seconds}
                                        onClick={() => setTurnSeconds(seconds)}
                                        className={cn(
                                            'rounded-xl border py-2.5 text-sm font-black transition-all active:scale-95',
                                            turnSeconds === seconds
                                                ? 'border-amber-300/70 bg-gradient-to-b from-violet-500 to-violet-800 text-white shadow-[0_6px_18px_rgba(124,58,237,0.4)]'
                                                : 'border-white/10 bg-white/[0.05] text-white/60'
                                        )}
                                    >
                                        {seconds}s
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Mời qua email */}
                        <div>
                            <SectionHeader
                                icon="✉️"
                                index={3}
                                title={`Mời qua email (tối đa ${MAX_INVITEES} người)`}
                                right={<span className="text-xs font-black text-amber-300/90">{emails.length}/{MAX_INVITEES}</span>}
                            />
                            <div className="flex gap-2">
                                <div
                                    onClick={() => inputRef.current?.focus()}
                                    className="min-h-[72px] flex-1 cursor-text content-start rounded-2xl border border-white/10 bg-white/[0.05] p-2.5"
                                >
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {emails.map(addr => {
                                            const check = checks[addr];
                                            return (
                                                <span
                                                    key={addr}
                                                    className={cn(
                                                        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold',
                                                        check?.loading
                                                            ? 'border-white/15 bg-white/10 text-white/70'
                                                            : check?.exists
                                                                ? 'border-violet-300/35 bg-violet-500/25 text-violet-100'
                                                                : 'border-red-300/35 bg-red-500/18 text-red-200'
                                                    )}
                                                >
                                                    {check?.loading ? (
                                                        <span className="h-2.5 w-2.5 flex-shrink-0 animate-spin rounded-full border border-white/30 border-t-white" />
                                                    ) : check?.exists ? (
                                                        <span className="flex-shrink-0 text-emerald-300">✓</span>
                                                    ) : (
                                                        <span className="flex-shrink-0 text-red-300">✕</span>
                                                    )}
                                                    <span className="truncate">{check?.exists && check.name ? check.name : addr}</span>
                                                    <button onClick={() => removeEmail(addr)} className="flex-shrink-0 text-white/50 active:text-white" aria-label={`Xóa ${addr}`}>×</button>
                                                </span>
                                            );
                                        })}
                                        <input
                                            ref={inputRef}
                                            type="email"
                                            value={draft}
                                            onChange={e => handleDraftChange(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') { e.preventDefault(); commitDraft(); }
                                                if (e.key === 'Backspace' && !draft && emails.length > 0) removeEmail(emails[emails.length - 1]);
                                            }}
                                            onBlur={() => commitDraft()}
                                            placeholder={emails.length === 0 ? 'Nhập email, nhấn Enter để thêm' : ''}
                                            className="min-w-[140px] flex-1 bg-transparent py-1 text-sm font-semibold text-white outline-none placeholder:text-white/30"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => { commitDraft(); inputRef.current?.focus(); }}
                                    className="h-[46px] w-[46px] flex-shrink-0 rounded-2xl bg-gradient-to-b from-violet-500 to-violet-800 text-lg text-white shadow-[0_8px_20px_rgba(124,58,237,0.4)] active:scale-95"
                                    aria-label="Thêm email"
                                >
                                    👤+
                                </button>
                            </div>
                            <p className="mt-1.5 text-[11px] text-white/35">Nhập nhiều email bằng dấu phẩy, khoảng trắng hoặc xuống dòng.</p>
                        </div>

                        {/* CTA */}
                        <div>
                            <button
                                onClick={handleInvite}
                                disabled={sending || (emails.length === 0 && !draft.trim())}
                                className={cn(
                                    'flex w-full items-center justify-center gap-2.5 rounded-full py-3.5 text-[15px] font-black uppercase tracking-wide transition-all active:scale-[0.98]',
                                    sending || (emails.length === 0 && !draft.trim())
                                        ? 'bg-white/10 text-white/30'
                                        : 'bg-gradient-to-b from-[#F5CE62] to-[#DDA72C] text-[#3a2a05] shadow-[0_14px_34px_rgba(240,194,75,0.35)]'
                                )}
                            >
                                {sending ? (
                                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#3a2a05]/30 border-t-[#3a2a05]" />
                                ) : (
                                    <span className="text-base">🔗</span>
                                )}
                                Tạo phòng & mời
                            </button>
                            <p className="mt-2 text-center text-xs text-white/35">🛡️ Phòng chơi của bạn được bảo mật 100%</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
