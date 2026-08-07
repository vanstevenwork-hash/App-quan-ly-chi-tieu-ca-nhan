'use client';
import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { ActionIcon } from '@/components/icons/CustomIcon';
import Image from 'next/image';
import { getBankLogo } from '@/lib/bankLogos';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

const CARD_GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
];

function getGradient(card: Card, idx: number): string {
    if (card.color === '#111111' || card.color === '#FFFFFF') return card.color;
    // A single vibrant brand colour reads far cleaner than blending two
    // unrelated hues (bankColor→color muddied to olive/brown). The glass
    // overlay adds the light play, so a flat base stays crisp and saturated.
    const base = (card.bankColor && card.bankColor !== '#1B4FD8') ? card.bankColor
        : (card.color && card.color !== '#6C63FF') ? card.color
            : null;
    if (base) return base;
    return CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
}

function cardTextStyle(color: string) {
    if (color === '#111111') return { text: '#F59E0B', subtext: '#FCD34D', border: '1px solid #374151' };
    if (color === '#FFFFFF') return { text: '#1E293B', subtext: '#64748B', border: '1px solid #E2E8F0' };
    return { text: '#FFFFFF', subtext: 'rgba(255,255,255,0.85)', border: undefined };
}

// ── Liquid-glass light play — kept clean so the base colour stays vibrant ──
const GLASS_OVERLAY =
    'radial-gradient(120% 85% at 82% -18%, rgba(255,255,255,0.30), transparent 52%),' +
    'linear-gradient(158deg, rgba(255,255,255,0.22) 0%, transparent 34%),' +
    'linear-gradient(110deg, transparent 42%, rgba(255,255,255,0.10) 51%, transparent 63%),' +
    'linear-gradient(to bottom, transparent 58%, rgba(0,0,0,0.10) 100%)';
const GLASS_RING =
    'inset 0 1px 1px rgba(255,255,255,0.55), inset 0 0 0 1px rgba(255,255,255,0.16), inset 0 -12px 22px -20px rgba(0,0,0,0.25)';
const GLASS_SHADOW =
    '0 16px 36px -12px rgba(31,17,71,0.52), 0 4px 12px -4px rgba(0,0,0,0.28)';

const DECK_EASE = 'cubic-bezier(0.34, 1.4, 0.64, 1)';

function daysUntilPayment(paymentDueDay: number): number | null {
    if (!paymentDueDay) return null;
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), paymentDueDay);
    if (due <= now) due.setMonth(due.getMonth() + 1);
    return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

// ── The full, detailed card face (fills its parent box) ──
function CardFace({ card, idx, onEdit, onDelete, onPay, bankLogoUrl }: {
    card: Card; idx: number; bankLogoUrl?: string;
    onEdit: () => void; onDelete: () => void; onPay: () => void;
}) {
    const isPooled = card.sharedLimit && (card.sharedGroupSize ?? 1) > 1;
    const effLimit = isPooled ? (card.effectiveCreditLimit ?? card.creditLimit) : card.creditLimit;
    const effBalance = isPooled ? (card.groupBalance ?? card.balance) : card.balance;
    const usedPct = effLimit > 0 ? Math.min((effBalance / effLimit) * 100, 100) : 0;
    const dueDays = daysUntilPayment(card.paymentDueDay);
    const isUrgent = dueDays !== null && dueDays <= 5;
    const ts = cardTextStyle(card.color);
    const [logoError, setLogoError] = useState(false);
    const logoUrl = bankLogoUrl || getBankLogo(card.bankShortName, card.bankName);
    const showLogo = logoUrl && !logoError;
    const isSolid = card.color === '#111111' || card.color === '#FFFFFF';
    const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

    return (
        <div className="relative w-full h-full rounded-[22px] p-4 overflow-hidden isolate flex flex-col"
            style={{ background: getGradient(card, idx), border: ts.border, boxShadow: GLASS_SHADOW }}>

            {!isSolid && (
                <>
                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: GLASS_OVERLAY }} />
                    <div className="absolute -top-12 -left-8 w-44 h-44 rounded-full bg-white/25 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-16 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                </>
            )}
            <div className="absolute inset-0 rounded-[22px] pointer-events-none" style={{ boxShadow: GLASS_RING }} />

            {card.isDefault && (
                <span className="absolute top-2.5 right-2.5 z-20 bg-amber-300/90 text-amber-900 w-5 h-5 rounded-full flex items-center justify-center shadow ring-1 ring-white/40">
                    <CustomIcon type="star" size={11} tile={false} color="#B45309" />
                </span>
            )}

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2.5">
                        {showLogo ? (
                            <Image src={logoUrl!} width={40} height={40} alt={card.bankShortName || card.bankName}
                                className="w-10 h-10 rounded-2xl object-contain bg-white/90 p-1 flex-shrink-0 shadow-md ring-1 ring-white/50"
                                onError={() => setLogoError(true)} />
                        ) : (
                            <div className="w-10 h-10 rounded-2xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold" style={{ color: ts.text }}>
                                    {(card.bankShortName || card.bankName || '?').substring(0, 3).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <div>
                            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: ts.subtext }}>{card.bankName}</p>
                            <p className="text-base font-bold mt-0.5 tracking-[0.18em]" style={{ color: ts.text }}>•••• {card.cardNumber}</p>
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        <button onClick={stop(onEdit)}
                            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 ring-1 ring-white/25 flex items-center justify-center transition active:scale-95">
                            <ActionIcon type="pencil" size={15} tile={false} color={ts.text} />
                        </button>
                        <button onClick={stop(onDelete)}
                            className="w-8 h-8 rounded-full bg-white/15 hover:bg-red-400/40 ring-1 ring-white/25 flex items-center justify-center transition active:scale-95">
                            <ActionIcon type="trash" size={15} tile={false} color="#FCA5A5" />
                        </button>
                    </div>
                </div>

                <div className="flex justify-between items-end mb-3">
                    <div>
                        <p className="text-[11px] mb-1" style={{ color: ts.subtext }}>Dư nợ hiện tại</p>
                        <p className="text-2xl font-bold tracking-tight" style={{ color: ts.text }}>{fmt(card.balance)}₫</p>
                    </div>
                    {dueDays !== null ? (
                        <div className="text-right">
                            <p className="text-[11px] mb-1" style={{ color: ts.subtext }}>Hạn thanh toán</p>
                            <div className="flex items-center gap-1 justify-end">
                                {isUrgent && <CustomIcon type="alertCircle" size={15} tile={false} color="#FCA5A5" />}
                                <p className={cn('text-sm font-bold', isUrgent ? 'text-red-200' : '')} style={isUrgent ? undefined : { color: ts.text }}>
                                    {dueDays <= 0 ? 'Đã quá hạn!' : `${dueDays} ngày nữa`}
                                </p>
                            </div>
                        </div>
                    ) : (
                        card.statementDay > 0 && (
                            <div className="text-right">
                                <p className="text-[11px] mb-1" style={{ color: ts.subtext }}>Sao kê ngày</p>
                                <p className="text-sm font-bold" style={{ color: ts.text }}>{card.statementDay}/{new Date().getMonth() + 1}</p>
                            </div>
                        )
                    )}
                </div>

                {effLimit > 0 && (
                    <>
                        <div className="flex justify-between text-[10px] mb-1.5" style={{ color: ts.subtext }}>
                            <span>Đã dùng {usedPct.toFixed(0)}%{isPooled ? ' 🔗' : ''}</span>
                            <span>Hạn mức:<span className="text-sm ml-0.5 font-bold" style={{ color: ts.text }}>{fmtShort(effLimit)}</span></span>
                        </div>
                        <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden mb-2 ring-1 ring-inset ring-white/10">
                            <div className="h-full rounded-full transition-all"
                                style={{
                                    width: `${usedPct}%`,
                                    background: usedPct > 80
                                        ? 'linear-gradient(90deg, #FDA4AF, #FB7185)'
                                        : 'linear-gradient(90deg, rgba(255,255,255,0.95), rgba(255,255,255,0.7))',
                                }} />
                        </div>
                    </>
                )}

                {card.balance > 0 && (
                    <button onClick={stop(onPay)}
                        className="mt-auto self-end px-3.5 py-1.5 rounded-full bg-white/20 hover:bg-white/30 ring-1 ring-white/30 text-[11px] font-bold transition active:scale-95 flex items-center gap-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
                        style={{ color: ts.text }}>
                        <CustomIcon type="creditCard" size={13} tile={false} color="currentColor" /> Thanh toán
                    </button>
                )}
            </div>
        </div>
    );
}

// ── A peeking card in the deck: just the glass surface + its last-4 digits ──
function CardBack({ card, idx }: { card: Card; idx: number }) {
    const ts = cardTextStyle(card.color);
    const isSolid = card.color === '#111111' || card.color === '#FFFFFF';
    return (
        <div className="relative w-full h-full rounded-[22px] overflow-hidden"
            style={{ background: getGradient(card, idx), border: ts.border, boxShadow: GLASS_SHADOW }}>
            {!isSolid && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: GLASS_OVERLAY }} />}
            <div className="absolute inset-0 rounded-[22px] pointer-events-none" style={{ boxShadow: GLASS_RING }} />
            <span className="absolute top-4 right-4 text-sm font-bold tracking-[0.18em]" style={{ color: ts.text }}>{card.cardNumber}</span>
        </div>
    );
}

const NETWORK_LABELS: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', jcb: 'JCB', amex: 'Amex', napas: 'NAPAS' };
const networkLabel = (n?: string) => (n ? NETWORK_LABELS[n] || '' : '');
const MINI_SHEEN = 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 46%), linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.12) 100%)';

// A tiny card-shaped colour chip — reads as an actual mini card, not a logo.
function MiniCard({ card, idx }: { card: Card; idx: number }) {
    const net = networkLabel(card.cardNetwork);
    const isSolid = card.color === '#111111' || card.color === '#FFFFFF';
    return (
        <div className="w-[52px] h-[34px] rounded-[9px] overflow-hidden relative flex-shrink-0 shadow-sm ring-1 ring-black/[0.04]"
            style={{ background: getGradient(card, idx) }}>
            {!isSolid && <div className="absolute inset-0" style={{ backgroundImage: MINI_SHEEN }} />}
            {net
                ? <span className="absolute bottom-1 left-1.5 text-[7px] font-black tracking-wider" style={{ color: cardTextStyle(card.color).text }}>{net}</span>
                : <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black" style={{ color: cardTextStyle(card.color).text }}>{(card.bankShortName || '?').substring(0, 3).toUpperCase()}</span>}
        </div>
    );
}

// ── A compact card row inside the "all cards" bottom sheet ──
function CardRow({ card, idx, active, onClick }: {
    card: Card; idx: number; active: boolean; onClick: () => void;
}) {
    const net = networkLabel(card.cardNetwork);
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center gap-3 p-2.5 rounded-2xl border transition active:scale-[0.99]',
                active
                    ? 'border-indigo-300 bg-indigo-50/70 dark:border-indigo-600 dark:bg-indigo-900/25'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800/60'
            )}
        >
            <MiniCard card={card} idx={idx} />
            <div className="flex-1 min-w-0 text-left">
                <p className="text-[15px] font-bold text-slate-800 dark:text-white truncate">{net ? `${card.bankName} ${net}` : card.bankName}</p>
                <p className="text-[13px] text-slate-400 dark:text-slate-500 tracking-wider">•••• {card.cardNumber}</p>
            </div>
            <div className="text-right flex-shrink-0">
                <p className={cn('text-sm font-bold', card.balance > 0 ? 'text-rose-500' : 'text-slate-400')}>{fmt(card.balance)}₫</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 -mt-0.5">dư nợ</p>
            </div>
            {active
                ? <CustomIcon type="checkCircle" size={20} tile={false} color="#6366F1" className="flex-shrink-0" />
                : <ActionIcon type="alignJustify" size={18} tile={false} color="currentColor" className="text-slate-300 dark:text-slate-600 flex-shrink-0" />}
        </button>
    );
}

interface CreditCardCarouselProps {
    loading: boolean;
    creditCards: Card[];
    findApiBank: (bankShortName?: string, bankName?: string) => { logo?: string } | undefined;
    onEdit: (card: Card) => void;
    onDelete: (id: string) => void;
    onPay: () => void;
    onAddNew: () => void;
}

function CreditCardCarouselBase({ loading, creditCards, findApiBank, onEdit, onDelete, onPay, onAddNew }: CreditCardCarouselProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [frontId, setFrontId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const logoOf = (card: Card) => (findApiBank(card.bankShortName, card.bankName) as any)?.logo || undefined;
    const origIdx = (card: Card) => creditCards.findIndex(c => c._id === card._id);

    // Front card first, then the rest keep order. Only the front + 2 peek.
    const fi = Math.max(0, creditCards.findIndex(c => c._id === frontId));
    const front = creditCards[fi];
    const stack = front ? [front, ...creditCards.filter((_, i) => i !== fi)] : [];
    const MAX_PEEK = 2;                        // cards shown behind the front
    const remaining = creditCards.length - (MAX_PEEK + 1);

    const selectCard = (id: string) => { setFrontId(id); setSheetOpen(false); };

    return (
        <div className="mb-2">
            <div className="flex items-center justify-between px-6 mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Thẻ của tôi</h2>
                    {creditCards.length > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                            {creditCards.length} thẻ
                        </span>
                    )}
                </div>
                {creditCards.length > 1 && (
                    <button
                        onClick={() => setSheetOpen(true)}
                        className="flex items-center gap-1 text-[13px] font-semibold text-indigo-600 dark:text-indigo-300 hover:opacity-80 transition"
                    >
                        Xem tất cả
                        <ActionIcon type="chevronRight" size={15} tile={false} color="currentColor" />
                    </button>
                )}
            </div>

            {loading && (
                <div className="px-6">
                    <div className="w-full h-[200px] rounded-[22px] bg-gray-100 dark:bg-slate-800 animate-pulse" />
                </div>
            )}

            {!loading && creditCards.length === 0 && (
                <div className="px-6">
                    <AddCard onAddNew={onAddNew} />
                </div>
            )}

            {/* ── Deck ── */}
            {!loading && creditCards.length > 0 && (
                <div className="px-6">
                    <div className="relative h-[200px]">
                        {stack.map((card, depth) => {
                            const d = Math.min(depth, MAX_PEEK);
                            const isFront = depth === 0;
                            const hidden = depth > MAX_PEEK;
                            return (
                                <div
                                    key={card._id}
                                    onClick={() => (!isFront && !hidden ? setFrontId(card._id) : undefined)}
                                    className={cn('absolute top-0 left-0 h-full w-[calc(100%-34px)]', !isFront && !hidden && 'cursor-pointer')}
                                    style={{
                                        zIndex: stack.length - depth,
                                        transform: `translateX(${d * 16}px) scale(${1 - d * 0.05})`,
                                        opacity: hidden ? 0 : 1,
                                        pointerEvents: hidden ? 'none' : 'auto',
                                        transition: `transform 0.5s ${DECK_EASE}, opacity 0.35s ease`,
                                    }}
                                >
                                    {isFront
                                        ? <CardFace card={card} idx={origIdx(card)} bankLogoUrl={logoOf(card)}
                                            onEdit={() => onEdit(card)} onDelete={() => onDelete(card._id)} onPay={onPay} />
                                        : <CardBack card={card} idx={origIdx(card)} />}
                                </div>
                            );
                        })}

                        {/* "+N" badge — opens the full list */}
                        {remaining > 0 && (
                            <button
                                onClick={() => setSheetOpen(true)}
                                className="absolute bottom-2 right-0 z-30 flex items-center justify-center min-w-[42px] h-9 px-3 rounded-full bg-slate-900/85 text-white text-sm font-bold shadow-lg ring-1 ring-white/20 backdrop-blur-sm active:scale-95 transition"
                            >
                                +{remaining}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                        {creditCards.length > 1 && (
                            <p className="text-[12px] text-slate-400 dark:text-slate-500">Chạm thẻ sau để đưa lên trước</p>
                        )}
                        <button onClick={onAddNew}
                            className="ml-auto flex items-center gap-1 text-[13px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition active:scale-95">
                            <ActionIcon type="plus" size={14} tile={false} color="currentColor" /> Thêm thẻ
                        </button>
                    </div>
                </div>
            )}

            {/* ── Bottom sheet: all cards (portal to body so the fixed nav can't cover it) ── */}
            {mounted && sheetOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={() => setSheetOpen(false)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />
                    <div
                        className="relative w-full max-w-md bg-white dark:bg-surface rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl max-h-[78vh] flex flex-col animate-in slide-in-from-bottom duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-3" />
                        <div className="flex items-center justify-between px-1 mb-3">
                            <h3 className="font-bold text-slate-800 dark:text-white">
                                Tất cả thẻ <span className="text-slate-400 dark:text-slate-500 font-semibold">({creditCards.length})</span>
                            </h3>
                            <button onClick={() => setSheetOpen(false)}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-700 transition">
                                <CustomIcon type="x" size={16} tile={false} color="currentColor" />
                            </button>
                        </div>
                        <div className="overflow-y-auto -mx-1 px-1 space-y-1.5" style={{ scrollbarWidth: 'none' }}>
                            {creditCards.map(card => (
                                <CardRow key={card._id} card={card} idx={origIdx(card)}
                                    active={card._id === front?._id} onClick={() => selectCard(card._id)} />
                            ))}
                            <button onClick={() => { setSheetOpen(false); onAddNew(); }}
                                className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-300 text-sm font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition active:scale-[0.98]">
                                <ActionIcon type="plus" size={16} tile={false} color="currentColor" /> Thêm thẻ mới
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function AddCard({ onAddNew }: { onAddNew: () => void }) {
    return (
        <button
            onClick={onAddNew}
            className="w-full h-[120px] rounded-[22px] border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_8px_24px_-12px_rgba(31,17,71,0.3)] flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-slate-400 hover:text-emerald-500 hover:border-emerald-300/70 dark:hover:border-emerald-500/40 transition-all active:scale-[0.98]"
        >
            <div className="w-11 h-11 rounded-full bg-white/70 dark:bg-white/10 ring-1 ring-white/50 dark:ring-white/10 flex items-center justify-center shadow-sm">
                <ActionIcon type="plus" size={22} tile={false} color="currentColor" />
            </div>
            <span className="font-semibold text-sm">Thêm thẻ mới</span>
        </button>
    );
}

export default memo(CreditCardCarouselBase);
