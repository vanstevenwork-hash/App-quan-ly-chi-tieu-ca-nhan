'use client';
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { useBankLogo } from '@/hooks/useBankLogo';
import { type Card } from '@/hooks/useCards';
import { cn, formatNumber } from '@/lib/utils';

// ─── Formatters / helpers (self-contained so the deck drops into any page) ──
const fmt = (n: number) => formatNumber(Math.round(n));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1000)}k`;
};
function daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / 86_400_000);
}

const CARD_GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];
function getCardGradient(card: Card, idx: number): string {
    if (card.color === '#111111' || card.color === '#FFFFFF') return card.color;
    const base = (card.bankColor && card.bankColor !== '#1B4FD8') ? card.bankColor
        : (card.color && card.color !== '#6C63FF') ? card.color
            : null;
    if (base) return base;
    return CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
}
function cardTextStyle(color: string) {
    if (color === '#111111') return { text: '#F59E0B', subtext: '#FCD34D', border: '1px solid #374151' };
    if (color === '#FFFFFF') return { text: '#1E293B', subtext: '#64748B', border: '1px solid #E2E8F0' };
    return { text: '#FFFFFF', subtext: 'rgba(255,255,255,0.82)', border: undefined as string | undefined };
}

// Liquid-glass light play (same recipe as the credit-card deck).
const GLASS_OVERLAY =
    'radial-gradient(120% 85% at 82% -18%, rgba(255,255,255,0.30), transparent 52%),' +
    'linear-gradient(158deg, rgba(255,255,255,0.22) 0%, transparent 34%),' +
    'linear-gradient(110deg, transparent 42%, rgba(255,255,255,0.10) 51%, transparent 63%),' +
    'linear-gradient(to bottom, transparent 58%, rgba(0,0,0,0.10) 100%)';
const GLASS_RING =
    'inset 0 1px 1px rgba(255,255,255,0.55), inset 0 0 0 1px rgba(255,255,255,0.16), inset 0 -12px 22px -20px rgba(0,0,0,0.25)';
const GLASS_SHADOW =
    '0 16px 36px -12px rgba(31,17,71,0.5), 0 4px 12px -4px rgba(0,0,0,0.26)';

// ─── Single savings-book card ───────────────────────────────────────────────
export function SavingsCard({ card, idx, onEdit, onDelete }: {
    card: Card; idx: number; onEdit: () => void; onDelete: () => void;
}) {
    const logoOf = useBankLogo();
    const logoUrl = logoOf(card.bankShortName, card.bankName);
    const [logoError, setLogoError] = useState(false);
    const showLogo = logoUrl && !logoError;
    const matDays = daysUntil(card.maturityDate);
    const estimatedInterest = card.interestRate > 0 && card.term > 0
        ? card.balance * (card.interestRate / 100) * (card.term / 12)
        : 0;
    const ts = cardTextStyle(card.color);
    const isSolid = card.color === '#111111' || card.color === '#FFFFFF';
    const urgent = matDays !== null && matDays <= 7;

    const formatDate = (d: string | null) => d
        ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—';

    return (
        <div className="relative rounded-[22px] p-4 overflow-hidden isolate"
            style={{ background: getCardGradient(card, idx), border: ts.border, boxShadow: GLASS_SHADOW }}>
            {!isSolid && (
                <>
                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: GLASS_OVERLAY }} />
                    <div className="absolute -top-12 -left-8 w-44 h-44 rounded-full bg-white/25 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-16 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                </>
            )}
            <div className="absolute inset-0 rounded-[22px] pointer-events-none" style={{ boxShadow: GLASS_RING }} />

            <div className="relative z-10">
                {/* Header — logo + bank/term + edit/delete */}
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {showLogo ? (
                            <img src={logoUrl} alt={card.bankShortName || card.bankName}
                                className="w-10 h-10 rounded-2xl object-contain bg-white/90 p-1 flex-shrink-0 shadow-md ring-1 ring-white/50"
                                onError={() => setLogoError(true)} />
                        ) : (
                            <div className="w-10 h-10 rounded-2xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center flex-shrink-0">
                                <UtilityIcon type="soTietKiem" size={22} tile={false} color={ts.text} />
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-[15px] font-bold truncate" style={{ color: ts.text }}>{card.bankName}</p>
                            <p className="text-[11px] mt-0.5 truncate" style={{ color: ts.subtext }}>
                                {card.term > 0 ? `Kỳ hạn ${card.term} tháng` : 'Không kỳ hạn'}{card.cardNumber ? ` · ••${card.cardNumber}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={onEdit} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 ring-1 ring-white/25 flex items-center justify-center transition active:scale-95">
                            <UtilityIcon type="pencil" size={15} tile={false} color={ts.text} />
                        </button>
                        <button onClick={onDelete} className="w-8 h-8 rounded-full bg-white/15 hover:bg-red-400/40 ring-1 ring-white/25 flex items-center justify-center transition active:scale-95">
                            <UtilityIcon type="trash" size={15} tile={false} color="#FCA5A5" />
                        </button>
                    </div>
                </div>

                {/* Balance + estimated interest */}
                <div className="flex justify-between items-end mb-3">
                    <div>
                        <p className="text-[11px] mb-1" style={{ color: ts.subtext }}>Số tiền gốc</p>
                        <p className="text-2xl font-bold tracking-tight" style={{ color: ts.text }}>{fmt(card.balance)}₫</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[11px] mb-1" style={{ color: ts.subtext }}>Lãi tạm tính</p>
                        <p className="text-sm font-bold" style={{ color: ts.text }}>{estimatedInterest > 0 ? `+${fmtShort(estimatedInterest)}` : '—'}</p>
                    </div>
                </div>

                {/* Stats on glass — interest rate · deposit · maturity */}
                <div className="grid grid-cols-3 rounded-xl bg-white/15 ring-1 ring-inset ring-white/15 divide-x divide-white/15 overflow-hidden">
                    <div className="text-center py-2 px-1">
                        <p className="text-[10px]" style={{ color: ts.subtext }}>Lãi suất</p>
                        <p className="text-[13px] font-bold mt-0.5" style={{ color: ts.text }}>{card.interestRate ? `${card.interestRate}%` : '—'}</p>
                    </div>
                    <div className="text-center py-2 px-1">
                        <p className="text-[10px]" style={{ color: ts.subtext }}>Ngày gửi</p>
                        <p className="text-[13px] font-bold mt-0.5" style={{ color: ts.text }}>{formatDate(card.depositDate)}</p>
                    </div>
                    <div className="text-center py-2 px-1">
                        <p className="text-[10px]" style={{ color: ts.subtext }}>Đáo hạn</p>
                        <p className="text-[13px] font-bold mt-0.5" style={{ color: urgent ? '#FDE68A' : ts.text }}>{formatDate(card.maturityDate)}</p>
                    </div>
                </div>

                {matDays !== null && (() => {
                    // Color-code the passbook status so "Đang hoạt động" reads green
                    // (healthy), not a meaningless white pill.
                    const st = matDays <= 0
                        ? { label: '⚠️ Đã đáo hạn', bg: 'rgba(239,68,68,0.28)', ring: 'rgba(252,165,165,0.45)', text: '#FEE2E2' }
                        : matDays <= 30
                            ? { label: `⏳ Còn ${matDays} ngày`, bg: 'rgba(245,158,11,0.30)', ring: 'rgba(253,230,138,0.5)', text: '#FEF3C7' }
                            : { label: '✓ Đang hoạt động', bg: 'rgba(16,185,129,0.32)', ring: 'rgba(110,231,183,0.5)', text: '#DCFCE7' };
                    return (
                        <span className="inline-flex mt-2.5 items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: st.bg, boxShadow: `inset 0 0 0 1px ${st.ring}`, color: st.text }}>
                            {st.label}
                        </span>
                    );
                })()}
                {card.note && (
                    <p className="text-[11px] mt-2 italic truncate" style={{ color: ts.subtext }}>{card.note}</p>
                )}
            </div>
        </div>
    );
}

// ─── Savings deck — stacked cards + "all savings" bottom sheet ───────────────
// Imperative handle so a page can open the "all savings" popup from its own
// header "Xem tất cả" arrow.
export type SavingsDeckHandle = { openAll: () => void };

const SavingsDeck = forwardRef<SavingsDeckHandle, {
    cards: Card[]; onEdit: (c: Card) => void; onDelete: (c: Card) => void;
    // Hide the deck's own "Xem tất cả" footer link when the page provides its
    // own trigger (e.g. a header arrow wired via the ref).
    hideFooterSeeAll?: boolean;
}>(function SavingsDeck({ cards, onEdit, onDelete, hideFooterSeeAll = false }, ref) {
    const [frontId, setFrontId] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    useImperativeHandle(ref, () => ({ openAll: () => setSheetOpen(true) }), []);
    const logoOf = useBankLogo();
    const origIdx = (c: Card) => cards.findIndex(x => x._id === c._id);

    const fi = Math.max(0, cards.findIndex(c => c._id === frontId));
    const front = cards[fi];
    const rest = cards.filter((_, i) => i !== fi);
    const backs = rest.slice(0, 2);
    const remaining = cards.length - 1 - backs.length;
    if (!front) return null;

    // List of every passbook, shown inside the bottom sheet.
    const rowList = (
        <div className="overflow-y-auto -mx-1 px-1 space-y-1.5" style={{ scrollbarWidth: 'none' }}>
            {cards.map(card => {
                const url = logoOf(card.bankShortName, card.bankName);
                const active = card._id === front._id;
                return (
                    <button key={card._id} onClick={() => { setFrontId(card._id); setSheetOpen(false); }}
                        className={cn('w-full flex items-center gap-3 p-2.5 rounded-2xl border transition active:scale-[0.99]', active ? 'border-brand bg-brand-light/40 dark:border-brand dark:bg-brand/20' : 'border-transparent bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-slate-800/60')}>
                        <div className="w-10 h-10 rounded-xl bg-white ring-1 ring-gray-100 dark:ring-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {url ? <img src={url} alt="" className="w-full h-full object-contain p-1" /> : <UtilityIcon type="soTietKiem" size={18} tile={false} color="#A855F7" />}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-[15px] font-bold text-slate-800 dark:text-white truncate">{card.bankName}</p>
                            <p className="text-[13px] text-slate-400 dark:text-slate-500">{card.term > 0 ? `Kỳ hạn ${card.term} tháng` : 'Không kỳ hạn'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-white tabular-nums">{fmt(card.balance)}₫</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{card.interestRate ? `${card.interestRate}%/năm` : 'sổ tiết kiệm'}</p>
                        </div>
                        {active
                            ? <CustomIcon type="checkCircle" size={18} tile={false} color="#36255C" />
                            : <CustomIcon type="alignJustify" size={16} tile={false} color="currentColor" className="text-slate-300 dark:text-slate-600" />}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div>
            <div className="relative">
                {backs.map((card, i) => {
                    const d = i + 1;
                    const ts = cardTextStyle(card.color);
                    const isSolid = card.color === '#111111' || card.color === '#FFFFFF';
                    return (
                        <div key={card._id} onClick={() => setFrontId(card._id)}
                            className="absolute inset-0 rounded-[22px] overflow-hidden cursor-pointer"
                            style={{
                                zIndex: 5 - d,
                                transform: `translateX(${d * 16}px) scale(${1 - d * 0.05})`,
                                background: getCardGradient(card, origIdx(card)), border: ts.border, boxShadow: GLASS_SHADOW,
                                transition: 'transform 0.5s cubic-bezier(0.34,1.4,0.64,1)',
                            }}>
                            {!isSolid && <div className="absolute inset-0" style={{ backgroundImage: GLASS_OVERLAY }} />}
                            <div className="absolute inset-0 rounded-[22px]" style={{ boxShadow: GLASS_RING }} />
                            <span className="absolute top-4 right-4 text-sm font-bold tracking-widest" style={{ color: ts.text }}>{card.bankShortName || `••${card.cardNumber}`}</span>
                        </div>
                    );
                })}
                <div className="relative z-10">
                    <SavingsCard card={front} idx={origIdx(front)} onEdit={() => onEdit(front)} onDelete={() => onDelete(front)} />
                </div>
                {remaining > 0 && (
                    <button onClick={() => setSheetOpen(true)}
                        className="absolute bottom-2 right-0 z-30 flex items-center justify-center min-w-[44px] h-9 px-3.5 rounded-full bg-white/30 backdrop-blur-md text-white text-sm font-bold ring-1 ring-white/45 shadow-[0_5px_14px_-5px_rgba(0,0,0,0.22),inset_0_1px_1px_rgba(255,255,255,0.7)] active:scale-95 transition">
                        +{remaining}
                    </button>
                )}
            </div>

            {cards.length > 1 && (
                <div className="flex items-center gap-2 mt-3">
                    <p className="text-[12px] text-slate-400 dark:text-slate-500">Chạm sổ sau để đưa lên trước</p>
                    {!hideFooterSeeAll && (
                        <button onClick={() => setSheetOpen(true)} className="ml-auto text-[13px] font-bold text-brand dark:text-brand-light hover:opacity-80 transition">Xem tất cả</button>
                    )}
                </div>
            )}

            {mounted && sheetOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={() => setSheetOpen(false)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />
                    <div className="relative w-full max-w-md bg-white dark:bg-surface rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl max-h-[78vh] flex flex-col animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-3" />
                        <div className="flex items-center justify-between px-1 mb-3">
                            <h3 className="font-bold text-slate-800 dark:text-white">Tất cả sổ tiết kiệm <span className="text-slate-400 dark:text-slate-500 font-semibold">({cards.length})</span></h3>
                            <button onClick={() => setSheetOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-700 transition">
                                <CustomIcon type="x" size={16} tile={false} color="currentColor" />
                            </button>
                        </div>
                        {rowList}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});

export default SavingsDeck;
