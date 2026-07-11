'use client';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { gameMatchesApi } from '@/lib/api';
import { useGameMatchStore } from '@/hooks/useGameMatchStore';
import type { GameChatMessage } from '@/hooks/useGameMatchStore';
import Hand from '@/components/games/Hand';
import OpponentHand from '@/components/games/OpponentHand';
import LastPlayDisplay from '@/components/games/LastPlayDisplay';
import TurnIndicator from '@/components/games/TurnIndicator';
import GameActions from '@/components/games/GameActions';
import EndScreen from '@/components/games/EndScreen';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { useAuthStore } from '@/store/useStore';
import { validateSelection } from '@/lib/tienLenRules';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type MatchPlayerSummary = {
    _id: string;
    name: string;
};

const QUICK_MESSAGES = ['Hay lắm', 'Đợi chút', 'Tới đi', 'Mạnh tay quá'];
const EMOJI_OPTIONS = ['😀', '😂', '😍', '😎', '😮', '😢', '😡', '👍', '👏', '🔥', '🎉', '❤️'];
const THROW_REACTIONS = [
    { emoji: '🧱', label: 'Ném gạch', accent: '#fb7185' },
    { emoji: '⚡', label: 'Giật điện', accent: '#facc15' },
    { emoji: '💥', label: 'Bùm', accent: '#fb923c' },
    { emoji: '🌹', label: 'Thả hoa', accent: '#f472b6' },
    { emoji: '💸', label: 'Rải tiền', accent: '#34d399' },
    { emoji: '🏆', label: 'Gáy nhẹ', accent: '#fbbf24' },
] as const;
const THROW_REACTION_EMOJIS: string[] = THROW_REACTIONS.map(item => item.emoji);
function RoundIconButton({
    label,
    onClick,
    disabled,
    children,
}: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'group flex flex-col items-center gap-1.5 text-white transition-all active:scale-95',
                disabled && 'opacity-45'
            )}
            aria-label={label}
        >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_8px_22px_rgba(0,0,0,0.24)] backdrop-blur">
                {children}
            </span>
            <span className="text-xs font-bold drop-shadow">{label}</span>
        </button>
    );
}

function TurnCountdown({
    secondsLeft,
    totalSeconds,
    active,
}: {
    secondsLeft: number;
    totalSeconds: number;
    active: boolean;
}) {
    if (!active) return null;
    const progress = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));

    return (
        <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/18 px-4 py-2 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-black">
                <span
                    className="absolute inset-0 rounded-full"
                    style={{ background: `conic-gradient(#34d399 ${progress}%, rgba(255,255,255,0.14) 0)` }}
                />
                <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-[#04383d]">{secondsLeft}</span>
            </span>
            <span className="text-xs font-black uppercase tracking-wide text-white/75">Tự bỏ lượt</span>
        </div>
    );
}

function TableChatReactions({
    messages,
    now,
    currentUserId,
}: {
    messages: GameChatMessage[];
    now: number;
    currentUserId?: string;
}) {
    const visible = messages
        .filter(message => !THROW_REACTION_EMOJIS.includes(message.text) && now - new Date(message.at).getTime() < 4500)
        .slice(-3);

    if (visible.length === 0) return null;

    return (
        <div className="pointer-events-none absolute inset-x-20 top-8 z-10 flex flex-col gap-2">
            {visible.map(message => {
                const isMine = message.byUserId === currentUserId;
                const isEmoji = message.kind === 'emoji';

                return (
                    <div
                        key={message.id}
                        className={cn(
                            'flex animate-[reactionPop_4.5s_ease_forwards]',
                            isMine ? 'justify-end' : 'justify-start'
                        )}
                    >
                        <div
                            className={cn(
                                'max-w-[190px] rounded-[22px] border shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur',
                                isEmoji
                                    ? 'border-white/15 bg-white/10 px-4 py-3 text-5xl leading-none'
                                    : 'border-white/12 bg-[#062f34]/88 px-4 py-2.5 text-sm font-black text-white',
                                isMine && !isEmoji && 'bg-emerald-400/95 text-emerald-950'
                            )}
                        >
                            {!isMine && !isEmoji && <p className="mb-0.5 text-[10px] font-black uppercase text-white/45">{message.byName}</p>}
                            <p className={cn('break-words', isEmoji && 'drop-shadow-[0_6px_12px_rgba(0,0,0,0.35)]')}>{message.text}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TableThrowEffects({
    messages,
    now,
    currentUserId,
}: {
    messages: GameChatMessage[];
    now: number;
    currentUserId?: string;
}) {
    // Each stacked reaction is staggered by index*90ms and the longest animation
    // (throw/impactBurst/impactLabel) runs 2.65s — so the last of up to 4 stacked
    // items needs 3*90ms + 2650ms = 2920ms to actually finish. The old 2800ms
    // cutoff removed it from the DOM before that, cutting the animation off
    // mid-flight instead of letting it fade out. Give it real headroom instead.
    const visible = messages
        .filter(message => THROW_REACTION_EMOJIS.includes(message.text) && now - new Date(message.at).getTime() < 3200)
        .slice(-4);

    if (visible.length === 0) return null;

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {visible.map((message, index) => {
                const isMine = message.byUserId === currentUserId;
                const meta = THROW_REACTIONS.find(item => item.emoji === message.text) || THROW_REACTIONS[0];
                return (
                    <div key={message.id}>
                        <div
                            className={cn(
                                'absolute top-[47%] h-2 w-28 rounded-full opacity-0 blur-[1px]',
                                isMine
                                    ? 'left-[22%] animate-[trailToOpponent_2.35s_ease-out_forwards]'
                                    : 'right-[22%] animate-[trailToMe_2.35s_ease-out_forwards]'
                            )}
                            style={{ animationDelay: `${index * 90}ms`, background: `linear-gradient(90deg, transparent, ${meta.accent}, transparent)` }}
                        />
                        <div
                            className={cn(
                                'absolute top-[44%] text-5xl drop-shadow-[0_12px_18px_rgba(0,0,0,0.38)]',
                                isMine
                                    ? 'left-[18%] animate-[throwToOpponent_2.65s_cubic-bezier(.22,.8,.25,1)_forwards]'
                                    : 'right-[18%] animate-[throwToMe_2.65s_cubic-bezier(.22,.8,.25,1)_forwards]'
                            )}
                            style={{ animationDelay: `${index * 90}ms` }}
                        >
                            <span className="inline-block animate-[projectileSpin_.55s_linear_infinite]">{message.text}</span>
                        </div>
                        <div
                            className={cn(
                                'absolute top-[44%] h-20 w-20 rounded-full border-2 opacity-0',
                                isMine
                                    ? 'right-[15%] animate-[impactBurst_2.65s_ease-out_forwards]'
                                    : 'left-[15%] animate-[impactBurst_2.65s_ease-out_forwards]'
                            )}
                            style={{ animationDelay: `${index * 90}ms`, borderColor: meta.accent, boxShadow: `0 0 28px ${meta.accent}` }}
                        />
                        <div
                            className={cn(
                                'absolute top-[37%] rounded-full border border-white/12 bg-black/26 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white opacity-0 shadow-lg backdrop-blur',
                                isMine
                                    ? 'right-[14%] animate-[impactLabel_2.65s_ease-out_forwards]'
                                    : 'left-[14%] animate-[impactLabel_2.65s_ease-out_forwards]'
                            )}
                            style={{ animationDelay: `${index * 90}ms` }}
                        >
                            {meta.label}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function GameMatchPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.matchId as string;

    const [loadError, setLoadError] = useState<string | null>(null);
    const [opponentName, setOpponentName] = useState('đối thủ');
    const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [chatOpen, setChatOpen] = useState(false);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [chatText, setChatText] = useState('');
    const [now, setNow] = useState(() => Date.now());
    const [shakeUntil, setShakeUntil] = useState(0);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const { user } = useAuthStore();

    const { connect, disconnect, matchState, matchEnded, connectionStatus, chatMessages, errorMessage, clearError, playCombo, pass, drawStock, eatDiscard, sendChat } = useGameMatchStore();

    useEffect(() => {
        if (!matchId) return;
        gameMatchesApi.getById(matchId)
            .then(res => {
                const match = res.data?.data;
                if (match?.status === 'pending_invite') {
                    setLoadError('Ván đấu chưa bắt đầu — chờ đối thủ chấp nhận lời mời');
                    return;
                }
                // 'abandoned'/'declined' matches never get a socket match:state
                // (the server only emits it for active/finished) — without this
                // check the page spins on the loading state forever.
                if (match?.status === 'abandoned') {
                    setLoadError('Ván đấu đã kết thúc — một người chơi đã rời khỏi ván');
                    return;
                }
                if (match?.status === 'declined') {
                    setLoadError('Lời mời chơi đã bị từ chối');
                    return;
                }
                const players = ((match?.players || []) as unknown[]).filter(
                    (p): p is MatchPlayerSummary => typeof p === 'object' && p !== null && '_id' in p && 'name' in p
                );
                setPlayerNames(Object.fromEntries(players.map(player => [player._id, player.name])));
                const opp = players.find(p => p._id !== match?.state?.youAre);
                if (opp) setOpponentName(opp.name);
                connect(matchId);
            })
            .catch(err => setLoadError(err.response?.data?.message || 'Không thể tải ván đấu'));

        return () => disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchId]);

    useEffect(() => {
        if (errorMessage) {
            // If we haven't received a match:state yet, this error is the reason
            // why — surface it instead of leaving the page spinning forever.
            if (!matchState) setLoadError(errorMessage);
            toast.error(errorMessage);
            clearError();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [errorMessage, clearError]);

    useEffect(() => { setSelectedIds([]); }, [matchState?.turnUserId, matchState?.lastPlayBy]);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 250);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const latest = chatMessages[chatMessages.length - 1];
        if (latest && latest.byUserId !== user?._id && THROW_REACTION_EMOJIS.includes(latest.text)) {
            setShakeUntil(Date.now() + 520);
        }
    }, [chatMessages, user?._id]);

    const isPhom = matchState?.gameType === 'phom';
    const gameTitle = isPhom ? 'Phỏm' : 'Tiến lên miền Nam';
    const isYourTurn = matchState?.turnUserId === matchState?.youAre;
    const canPass = isYourTurn && !!matchState?.lastPlay;
    const selectedCards = matchState?.yourHand.filter(card => selectedIds.includes(card.id)) || [];
    const selectionValidation = validateSelection(selectedCards, matchState?.lastPlay || null, !!matchState?.isFirstMove);
    const canPlay = isPhom
        ? isYourTurn && matchState?.phase === 'discard' && selectedIds.length === 1
        : isYourTurn && selectionValidation.playable;
    const canDraw = isPhom && isYourTurn && matchState?.phase === 'draw_or_eat' && (matchState.stockCount || 0) > 0;
    const canEat = isPhom && isYourTurn && matchState?.phase === 'draw_or_eat' && !!matchState.canEatLastDiscard;
    const turnDeadline = matchState?.turnExpiresAt ? new Date(matchState.turnExpiresAt).getTime() : 0;
    const secondsLeft = turnDeadline ? Math.max(0, Math.ceil((turnDeadline - now) / 1000)) : 0;
    const totalTurnSeconds = matchState?.turnSeconds || 30;
    const showTurnCountdown = !!matchState?.lastPlay && !!turnDeadline && !matchState.winnerId;

    const handleToggle = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handlePlay = () => {
        if (selectedIds.length === 0) return;
        playCombo(selectedIds);
        setSelectedIds([]);
    };

    const handleLeaveMatch = async () => {
        setSettingsOpen(false);
        try {
            await gameMatchesApi.leave(matchId);
        } catch {
            // Already abandoned/finished server-side or a transient error — either
            // way the user explicitly asked to leave, so still take them out.
        }
        disconnect();
        router.push('/games');
    };

    const handleSendChat = (text = chatText, kind: 'text' | 'emoji' = 'text', openChatAfterSend = chatOpen) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        sendChat(trimmed, kind);
        setChatText('');
        if (openChatAfterSend) setChatOpen(true);
        if (kind === 'emoji') setEmojiOpen(false);
    };

    if (loadError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm text-slate-400">{loadError}</p>
                <button onClick={() => router.push('/games')} className="text-sm font-bold text-indigo-600">Quay lại</button>
            </div>
        );
    }

    if (!matchState || connectionStatus === 'connecting') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className={cn(
            'relative min-h-screen overflow-hidden bg-[#033d40] text-white',
            now < shakeUntil && 'animate-[tableHit_.52s_ease-in-out]'
        )}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(20,184,166,0.28),transparent_38%),radial-gradient(circle_at_20%_8%,rgba(45,212,191,0.16),transparent_26%),linear-gradient(180deg,#053f42_0%,#034247_45%,#012d35_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(0,0,0,0.14)_65%,rgba(0,0,0,0.34)_100%)]" />

            <div className="relative z-10 flex min-h-screen flex-col">
            <style>{`
                @keyframes reactionPop {
                    0% { opacity: 0; transform: translateY(14px) scale(0.92); }
                    12% { opacity: 1; transform: translateY(0) scale(1); }
                    76% { opacity: 1; transform: translateY(-8px) scale(1); }
                    100% { opacity: 0; transform: translateY(-22px) scale(0.96); }
                }
                @keyframes throwToOpponent {
                    0% { opacity: 0; transform: translate(0, 44px) scale(.75) rotate(-18deg); }
                    12% { opacity: 1; }
                    46% { transform: translate(32vw, -72px) scale(1.18) rotate(24deg); }
                    82% { opacity: 1; transform: translate(58vw, 22px) scale(1) rotate(52deg); }
                    100% { opacity: 0; transform: translate(62vw, 8px) scale(.55) rotate(72deg); }
                }
                @keyframes throwToMe {
                    0% { opacity: 0; transform: translate(0, 44px) scale(.75) rotate(18deg); }
                    12% { opacity: 1; }
                    46% { transform: translate(-32vw, -72px) scale(1.18) rotate(-24deg); }
                    82% { opacity: 1; transform: translate(-58vw, 22px) scale(1) rotate(-52deg); }
                    100% { opacity: 0; transform: translate(-62vw, 8px) scale(.55) rotate(-72deg); }
                }
                @keyframes projectileSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes trailToOpponent {
                    0%, 12% { opacity: 0; transform: translate(0, 38px) scaleX(.2) rotate(-10deg); }
                    42% { opacity: .9; transform: translate(28vw, -54px) scaleX(1.2) rotate(-10deg); }
                    84%, 100% { opacity: 0; transform: translate(56vw, 4px) scaleX(.35) rotate(-10deg); }
                }
                @keyframes trailToMe {
                    0%, 12% { opacity: 0; transform: translate(0, 38px) scaleX(.2) rotate(10deg); }
                    42% { opacity: .9; transform: translate(-28vw, -54px) scaleX(1.2) rotate(10deg); }
                    84%, 100% { opacity: 0; transform: translate(-56vw, 4px) scaleX(.35) rotate(10deg); }
                }
                @keyframes impactBurst {
                    0%, 66% { opacity: 0; transform: scale(.35); }
                    76% { opacity: .95; transform: scale(.75); }
                    100% { opacity: 0; transform: scale(1.8); }
                }
                @keyframes impactLabel {
                    0%, 68% { opacity: 0; transform: translateY(8px) scale(.92); }
                    78% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-10px) scale(.98); }
                }
                @keyframes tableHit {
                    0%, 100% { transform: translate(0, 0); }
                    18% { transform: translate(-4px, 2px); }
                    36% { transform: translate(4px, -2px); }
                    54% { transform: translate(-3px, -1px); }
                    72% { transform: translate(2px, 1px); }
                }
            `}</style>
            <div className="relative flex items-center justify-between px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
                <button onClick={() => router.push('/games')} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur">
                    <ActionIcon type="arrowLeft" size={24} tile={false} color="#fff" />
                </button>
                <span className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+1.7rem)] w-44 -translate-x-1/2 text-center text-lg font-black uppercase tracking-wide text-white drop-shadow">
                    {gameTitle}
                </span>
                <div className="flex items-center gap-3">
                    <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur" aria-label="Trợ giúp">
                        <span className="text-2xl font-black leading-none">?</span>
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setSettingsOpen(prev => !prev)}
                            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur"
                            aria-label="Cài đặt"
                        >
                            <ActionIcon type="settings" size={25} tile={false} color="#fff" />
                        </button>
                        {settingsOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setSettingsOpen(false)} />
                                <div className="absolute right-0 top-14 z-40 w-48 overflow-hidden rounded-2xl border border-white/12 bg-[#032f34] shadow-[0_18px_45px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                                    <button
                                        onClick={handleLeaveMatch}
                                        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left text-sm font-bold text-red-300 active:bg-white/8"
                                    >
                                        <ActionIcon type="logOut" size={18} tile={false} color="currentColor" />
                                        Thoát ván đấu
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Opponents */}
            <div className="mt-6 flex items-start gap-3 overflow-x-auto px-5 hide-scrollbar">
                {(matchState.opponents?.length ? matchState.opponents : matchState.opponentId ? [{ userId: matchState.opponentId, handCount: matchState.opponentHandCount }] : []).map((opponent, index) => {
                    const name = playerNames[opponent.userId] || (index === 0 ? opponentName : `Đối thủ ${index + 1}`);
                    return (
                        <div key={opponent.userId} className="min-w-[210px] rounded-2xl border border-white/10 bg-white/6 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                            <div className="mb-2 flex items-center gap-3">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border-2 border-teal-200/75 bg-slate-900 shadow-[0_0_24px_rgba(45,212,191,0.24)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-700 to-black" />
                    <span className="relative flex h-full w-full items-center justify-center text-xl font-black text-white/75">
                                        {name.charAt(0).toUpperCase()}
                    </span>
                    <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-[#033d40] bg-emerald-400" />
                </div>
                <div className="min-w-0 flex-shrink-0">
                                    <p className="max-w-[120px] truncate text-sm font-black text-white">{name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-base font-black text-amber-300">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] text-amber-900 shadow">₫</span>
                                        {opponent.handCount} lá
                    </p>
                </div>
                            </div>
                            <OpponentHand count={opponent.handCount} />
                </div>
                    );
                })}
            </div>

            {/* Center table */}
            <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-3 pt-4">
                <TableChatReactions messages={chatMessages} now={now} currentUserId={user?._id} />
                <TableThrowEffects messages={chatMessages} now={now} currentUserId={user?._id} />
                <div className="absolute left-7 bottom-8 flex flex-col gap-7">
                    <RoundIconButton label="Chat" onClick={() => { setChatOpen(true); setEmojiOpen(false); }}>
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true"><path d="M4 5.8C4 4.25 5.25 3 6.8 3h10.4C18.75 3 20 4.25 20 5.8v6.4c0 1.55-1.25 2.8-2.8 2.8H11l-4.15 3.46A.9.9 0 0 1 5.4 17.77V15A2.8 2.8 0 0 1 4 12.2V5.8Z" /><circle cx="8" cy="9" r="1" fill="#033d40" /><circle cx="12" cy="9" r="1" fill="#033d40" /><circle cx="16" cy="9" r="1" fill="#033d40" /></svg>
                    </RoundIconButton>
                    <RoundIconButton label="Emoji" onClick={() => { setEmojiOpen(prev => !prev); setChatOpen(false); }}>
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.3 14.2c1.5 1.7 5.9 1.7 7.4 0" /><path d="M8.8 9h.01" /><path d="M15.2 9h.01" /></svg>
                    </RoundIconButton>
                </div>
                {chatOpen && (
                    <div className="absolute left-5 right-5 bottom-6 z-20 rounded-[24px] border border-white/12 bg-[#032f34]/95 p-4 shadow-[0_22px_55px_rgba(0,0,0,0.38),inset_0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-black text-white">Chat trong ván</p>
                            <button type="button" onClick={() => setChatOpen(false)} className="rounded-full bg-white/10 p-1.5 text-white/80" aria-label="Đóng chat">
                                <ActionIcon type="x" size={16} tile={false} color="currentColor" />
                            </button>
                        </div>
                        <div className="mb-3 flex max-h-40 flex-col gap-2 overflow-y-auto pr-1 hide-scrollbar">
                            {chatMessages.length === 0 ? (
                                <p className="rounded-2xl border border-white/8 bg-white/6 px-3 py-4 text-center text-xs font-semibold text-white/45">Chưa có tin nhắn nào</p>
                            ) : chatMessages.map(message => {
                                const isMine = message.byUserId === user?._id;
                                return (
                                    <div key={message.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                                        <div className={cn(
                                            'max-w-[78%] rounded-2xl px-3 py-2 text-sm font-bold shadow',
                                            message.kind === 'emoji' && 'text-3xl leading-none',
                                            isMine ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-white'
                                        )}>
                                            {!isMine && message.kind === 'text' && <p className="mb-0.5 text-[10px] font-black uppercase text-white/45">{message.byName}</p>}
                                            {message.text}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mb-3 flex gap-2 overflow-x-auto hide-scrollbar">
                            {QUICK_MESSAGES.map(message => (
                                <button key={message} type="button" onClick={() => handleSendChat(message)} className="whitespace-nowrap rounded-full bg-white/8 px-3 py-2 text-xs font-black text-white/80">
                                    {message}
                                </button>
                            ))}
                        </div>
                        <form
                            className="flex items-center gap-2"
                            onSubmit={event => {
                                event.preventDefault();
                                handleSendChat(chatText, 'text', true);
                            }}
                        >
                            <input
                                value={chatText}
                                onChange={event => setChatText(event.target.value)}
                                maxLength={160}
                                placeholder="Nhập tin nhắn..."
                                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white placeholder:text-white/35 outline-none focus:border-emerald-300/70"
                            />
                            <button type="button" onClick={() => setEmojiOpen(prev => !prev)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl">
                                ☺
                            </button>
                            <button type="submit" disabled={!chatText.trim()} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-emerald-950 disabled:bg-white/10 disabled:text-white/35">
                                <ActionIcon type="arrowRight" size={20} tile={false} color="currentColor" />
                            </button>
                        </form>
                    </div>
                )}
                {emojiOpen && (
                    <div className="absolute left-5 bottom-6 z-30 w-72 rounded-[24px] border border-white/12 bg-[#032f34]/95 p-3 shadow-[0_22px_55px_rgba(0,0,0,0.38),inset_0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur">
                        <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-white/45">Tung chiêu</p>
                        <div className="mb-3 grid grid-cols-6 gap-2">
                            {THROW_REACTIONS.map(item => (
                                <button
                                    key={item.emoji}
                                    type="button"
                                    onClick={() => handleSendChat(item.emoji, 'emoji', false)}
                                    className="group flex h-12 flex-col items-center justify-center rounded-2xl bg-emerald-300/14 text-xl ring-1 ring-emerald-200/10 active:scale-95"
                                    title={item.label}
                                >
                                    <span>{item.emoji}</span>
                                    <span className="mt-0.5 max-w-full truncate px-1 text-[8px] font-black uppercase text-white/45 group-active:text-white/70">{item.label}</span>
                                </button>
                            ))}
                        </div>
                        <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-white/45">Emoji</p>
                        <div className="grid grid-cols-6 gap-2">
                            {EMOJI_OPTIONS.map(emoji => (
                                <button key={emoji} type="button" onClick={() => handleSendChat(emoji, 'emoji', false)} className="flex h-10 items-center justify-center rounded-2xl bg-white/8 text-2xl active:scale-95">
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="absolute right-7 bottom-8 flex flex-col gap-7">
                    <RoundIconButton label="Bỏ lượt" onClick={pass} disabled={!isYourTurn || !canPass}>
                        <ActionIcon type="refreshCw" size={26} tile={false} color="#fff" />
                    </RoundIconButton>
                    <RoundIconButton label="Gợi ý" disabled>
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.6 14.8A6 6 0 1 1 15.4 14.8c-.8.6-1.4 1.5-1.4 2.2h-4c0-.7-.6-1.6-1.4-2.2Z" /><path d="M4 12H2" /><path d="M22 12h-2" /><path d="m19.1 4.9-1.4 1.4" /><path d="m4.9 4.9 1.4 1.4" /></svg>
                    </RoundIconButton>
                </div>
                <LastPlayDisplay lastPlay={matchState.lastPlay} isYourLead={isYourTurn && !matchState.lastPlay} />
                <TurnIndicator isYourTurn={isYourTurn} opponentName={opponentName} />
                <TurnCountdown secondsLeft={secondsLeft} totalSeconds={totalTurnSeconds} active={showTurnCountdown} />
                {isPhom && (
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/16 px-4 py-2 text-xs font-black text-white/75">
                        <span>Nọc: {matchState.stockCount ?? 0}</span>
                        <span className="h-1 w-1 rounded-full bg-white/35" />
                        <span>Điểm rác: {matchState.deadwoodScore ?? 0}</span>
                        {matchState.lastDiscard && (
                            <>
                                <span className="h-1 w-1 rounded-full bg-white/35" />
                                <span>Bài rác: {matchState.lastDiscard.rank}</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Your hand */}
            <div className="mx-5 mb-5 rounded-[28px] border border-white/10 bg-[#053c3f]/82 pt-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur">
                <div className="flex items-center justify-between gap-3 px-5 mb-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex-shrink-0 text-base font-black text-white">Bài của bạn <span className="text-emerald-300">({matchState.yourHand.length})</span></span>
                        {selectedIds.length > 0 && (
                            <span className={cn(
                                'min-w-0 truncate rounded-full border px-2.5 py-1 text-[10px] font-black',
                                isPhom
                                    ? (canPlay ? 'border-emerald-300/35 bg-emerald-400/14 text-emerald-100' : 'border-amber-300/35 bg-amber-400/12 text-amber-100')
                                    : selectionValidation.playable
                                        ? 'border-emerald-300/35 bg-emerald-400/14 text-emerald-100'
                                        : selectionValidation.valid
                                            ? 'border-amber-300/35 bg-amber-400/12 text-amber-100'
                                            : 'border-red-300/35 bg-red-400/12 text-red-100'
                            )}>
                                {isPhom
                                    ? (selectedIds.length === 1 ? 'Lá rác · ' + (canPlay ? 'Có thể đánh' : 'Chờ lượt') : 'Chỉ đánh 1 lá/lượt')
                                    : `${selectionValidation.label} · ${selectionValidation.message}`}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                        {selectedIds.length > 0 && (
                            <button onClick={() => setSelectedIds([])} className="text-xs font-bold text-emerald-200">Bỏ chọn</button>
                        )}
                        <button className="text-emerald-300" aria-label="Thu gọn bài">
                            <ActionIcon type="chevronUp" size={24} tile={false} color="currentColor" />
                        </button>
                    </div>
                </div>
                <Hand cards={matchState.yourHand} selectedIds={selectedIds} onToggle={handleToggle} />
                <GameActions
                    canPlay={canPlay}
                    isYourTurn={isYourTurn}
                    onPlay={handlePlay}
                    gameType={matchState.gameType}
                    canEat={canEat}
                    canDraw={canDraw}
                    onEat={eatDiscard}
                    onDraw={drawStock}
                />
            </div>

            {matchEnded && <EndScreen youWon={matchEnded.winnerId === matchState.youAre} abandoned={matchEnded.reason === 'abandoned'} />}
            </div>
        </div>
    );
}
