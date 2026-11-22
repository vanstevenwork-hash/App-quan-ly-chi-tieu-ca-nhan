'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import CardThumb from '@/components/cards/CardThumb';
import { useCards, useCardStore, type Card } from '@/hooks/useCards';
import { cardsApi } from '@/lib/api';
import { matchDesign, type MatchResult } from '@/lib/cardMatch';
import { safeCardImage } from '@/lib/cardArt';
import { cn } from '@/lib/utils';

interface Row { card: Card; match: MatchResult }

// "Gắn ảnh thẻ" — match every existing credit/debit card to a bundled design
// from what the user already typed (bank + card name + network + type), let
// them confirm or pick another, then save all choices in one go.
export default function CardDesignsPage() {
    const router = useRouter();
    const { cards, loading } = useCards();
    const [includeWithArt, setIncludeWithArt] = useState(false);
    // cardId → chosen design src ('' = leave as is). Seeded from high-confidence matches.
    const [choice, setChoice] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [openPicker, setOpenPicker] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const rows = useMemo<Row[]>(() => cards
        .filter(c => (c.cardType === 'credit' || c.cardType === 'debit') && (includeWithArt || !safeCardImage(c.cardImage)))
        .map(card => ({ card, match: matchDesign(card) }))
        .sort((a, b) => rank(a) - rank(b)), [cards, includeWithArt]);

    // Selected design for a row: the user's pick, else the high-confidence match.
    const picked = (r: Row) => touched[r.card._id]
        ? choice[r.card._id] || ''
        : r.match.confidence === 'high' ? r.match.best!.design.src : '';
    const setPick = (id: string, src: string) => {
        setChoice(c => ({ ...c, [id]: src }));
        setTouched(t => ({ ...t, [id]: true }));
    };

    const toApply = rows.filter(r => { const p = picked(r); return p && p !== r.card.cardImage; });
    const missing = cards.filter(c => (c.cardType === 'credit' || c.cardType === 'debit') && !safeCardImage(c.cardImage)).length;

    const acceptAllSuggestions = () => {
        const next: Record<string, string> = {}; const t: Record<string, boolean> = {};
        rows.forEach(r => { if (r.match.best) { next[r.card._id] = r.match.best.design.src; t[r.card._id] = true; } });
        setChoice(c => ({ ...c, ...next })); setTouched(x => ({ ...x, ...t }));
    };

    const apply = async () => {
        if (!toApply.length) return;
        setSaving(true);
        let ok = 0;
        // A few at a time — no need to hammer a free-tier server.
        const queue = [...toApply];
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (queue.length) {
                const r = queue.shift()!;
                try { await cardsApi.update(r.card._id, { cardImage: picked(r) }); ok++; } catch { /* counted below */ }
            }
        }));
        await useCardStore.getState().fetch(true);
        setSaving(false);
        setChoice({}); setTouched({});
        if (ok === toApply.length) toast.success(`Đã gắn ảnh cho ${ok} thẻ`);
        else toast.warning(`Đã gắn ${ok}/${toApply.length} thẻ — thử lại các thẻ còn lại`);
    };

    return (
        <div className="min-h-screen pb-40 bg-gray-50 dark:bg-surface-deep">
            <PageHeader title="Gắn ảnh thẻ" subtitle={missing ? `${missing} thẻ chưa có ảnh` : 'Tất cả thẻ đã có ảnh'} onBack={() => router.back()} />

            <div className="px-5 space-y-3">
                <div className="bg-white dark:bg-surface rounded-2xl p-4 border border-gray-100 dark:border-slate-800 space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        App đọc <b>tên thẻ bạn đã đặt</b>, ngân hàng, mạng thẻ (Visa/Mastercard…) để gợi ý mẫu.
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold"> Khớp tên</span> được chọn sẵn;
                        <span className="text-amber-600 dark:text-amber-400 font-semibold"> Gợi ý</span> thì bạn bấm để xác nhận hoặc đổi mẫu.
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={acceptAllSuggestions} disabled={!rows.some(r => r.match.best)}
                            className="flex-1 h-9 rounded-xl text-xs font-bold bg-brand/10 text-brand dark:text-purple-300 disabled:opacity-40">
                            Chọn tất cả gợi ý
                        </button>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <input type="checkbox" checked={includeWithArt} onChange={e => setIncludeWithArt(e.target.checked)} className="w-4 h-4 accent-[#6C63FF]" />
                            Cả thẻ đã có ảnh
                        </label>
                    </div>
                </div>

                {loading && cards.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Đang tải thẻ…</p>}
                {!loading && rows.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-10">Không có thẻ nào cần gắn ảnh 🎉</p>
                )}

                {rows.map(r => {
                    const { card, match } = r;
                    const sel = picked(r);
                    const selDesign = match.candidates.find(c => c.design.src === sel)?.design;
                    const showPicker = openPicker === card._id;
                    return (
                        <div key={card._id} className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                            <div className="p-3 flex items-center gap-3">
                                <CardThumb card={card} size="md" showLast4 />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{card.bankName} <span className="text-slate-400 font-semibold">••{card.cardNumber}</span></p>
                                    <p className="text-[11px] text-slate-400 truncate">
                                        {card.cardType === 'credit' ? 'Tín dụng' : 'Ghi nợ'}{card.cardNetwork ? ` · ${card.cardNetwork.toUpperCase()}` : ''}
                                    </p>
                                    {match.confidence !== 'none' && (
                                        <span className={cn('inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                                            match.confidence === 'high'
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400'
                                                : 'bg-amber-50 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400')}>
                                            {match.confidence === 'high' ? 'Khớp tên' : match.noNameMatch ? 'Chưa có mẫu đúng tên' : 'Gợi ý'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {match.confidence === 'none' ? (
                                <p className="px-3 pb-3 text-[11px] text-slate-400">Chưa có mẫu cho ngân hàng này — mở thẻ để tải ảnh riêng.</p>
                            ) : (
                                <>
                                    <div className="px-3 pb-3 flex items-center gap-3">
                                        <button onClick={() => setPick(card._id, sel ? '' : match.best!.design.src)}
                                            className={cn('relative w-[120px] aspect-[1.586] rounded-[10px] overflow-hidden flex-shrink-0 transition-all',
                                                sel ? 'ring-[3px] ring-brand ring-offset-2 ring-offset-white dark:ring-offset-surface' : 'ring-1 ring-black/10 opacity-60')}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={(selDesign || match.best!.design).src.replace(/\.webp$/, '.sm.webp')} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                            <span className={cn('absolute top-1 right-1 w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center shadow',
                                                sel ? 'bg-brand text-white' : 'bg-white/90 text-slate-400')}>{sel ? '✓' : ''}</span>
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 leading-snug line-clamp-2">
                                                {(selDesign || match.best!.design).name}
                                            </p>
                                            <div className="flex gap-2 mt-2">
                                                <button onClick={() => setOpenPicker(showPicker ? null : card._id)}
                                                    className="text-[11px] font-bold text-brand dark:text-purple-300">{showPicker ? 'Đóng' : 'Đổi mẫu'}</button>
                                                {sel && <button onClick={() => setPick(card._id, '')} className="text-[11px] font-bold text-slate-400">Bỏ chọn</button>}
                                            </div>
                                        </div>
                                    </div>
                                    {showPicker && (
                                        <div className="flex gap-2 overflow-x-auto px-3 pb-3 snap-x [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                                            {match.candidates.map(c => (
                                                <button key={c.design.id} title={c.design.name}
                                                    onClick={() => { setPick(card._id, c.design.src); setOpenPicker(null); }}
                                                    className={cn('snap-start shrink-0 w-[96px] aspect-[1.586] rounded-lg overflow-hidden',
                                                        sel === c.design.src ? 'ring-[3px] ring-brand' : 'ring-1 ring-black/10')}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={c.design.src.replace(/\.webp$/, '.sm.webp')} alt={c.design.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                            <button onClick={() => router.push(`/cards/${card._id}`)}
                                                className="snap-start shrink-0 w-[96px] aspect-[1.586] rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-400">
                                                Tải ảnh riêng
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Sticky apply bar (above the bottom nav) */}
            <div className="fixed inset-x-0 bottom-24 z-30 px-5 max-w-md mx-auto">
                <button onClick={apply} disabled={!toApply.length || saving}
                    className="w-full h-12 rounded-2xl bg-brand text-white text-sm font-bold shadow-lg shadow-brand/30 disabled:opacity-40 disabled:shadow-none">
                    {saving ? 'Đang lưu…' : toApply.length ? `Áp dụng ảnh cho ${toApply.length} thẻ` : 'Chọn mẫu để áp dụng'}
                </button>
            </div>
        </div>
    );
}

// High-confidence first, then guesses, then no-match.
const rank = (r: Row) => (r.match.confidence === 'high' ? 0 : r.match.confidence === 'low' ? 1 : 2);
