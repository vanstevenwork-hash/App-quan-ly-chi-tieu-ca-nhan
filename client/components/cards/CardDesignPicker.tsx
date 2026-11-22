'use client';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadApi } from '@/lib/api';
import { designsFor, type CardDesign } from '@/lib/cardCatalog';
import { safeCardImage, thumbSrc } from '@/lib/cardArt';

interface Props {
    bankShortName: string;
    bankName: string;
    cardType: string;
    value: string;                                     // current cardImage ('' = none)
    onChange: (src: string, design: CardDesign | null) => void;
}

const TILE = 'snap-start shrink-0 w-[112px] aspect-[1.586] rounded-[10px] overflow-hidden relative transition-all';
const MAX_MB = 5;

// "Mẫu thẻ" — horizontal strip of the selected bank's real card designs, plus
// "no artwork" and "upload your own". Picking a design fills the card's name
// and network (handled by the parent through `design`).
export default function CardDesignPicker({ bankShortName, bankName, cardType, value, onChange }: Props) {
    const designs = useMemo(() => designsFor(bankShortName, bankName, cardType), [bankShortName, bankName, cardType]);
    const [filter, setFilter] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const q = filter.trim().toLowerCase();
    const shown = q ? designs.filter(d => d.name.toLowerCase().includes(q)) : designs;
    const custom = value && !value.startsWith('/cards/') ? thumbSrc(value) : null;
    const selected = designs.find(d => d.src === value);

    const upload = async (file?: File) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) { toast.error('Chỉ nhận file ảnh'); return; }
        if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Ảnh tối đa ${MAX_MB}MB`); return; }
        setUploading(true);
        try {
            const { url } = await uploadApi.uploadImage(file, 'chi_tieu/cards');
            onChange(url, null);
            toast.success('Đã tải ảnh thẻ');
        } catch {
            toast.error('Tải ảnh thất bại');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-bold text-[#000000] dark:text-white">
                    Mẫu thẻ {designs.length > 0 && <span className="text-xs font-normal text-slate-400">({designs.length} mẫu)</span>}
                </label>
                {designs.length > 8 && (
                    <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Tìm mẫu..."
                        className="w-[130px] h-8 px-3 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-foreground outline-none focus:border-brand" />
                )}
            </div>

            <div className="flex gap-2.5 overflow-x-auto snap-x pb-2 -mx-4 px-4 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                {/* No artwork */}
                <button type="button" onClick={() => onChange('', null)}
                    className={cn(TILE, 'border-2 border-dashed flex items-center justify-center text-[11px] font-bold',
                        !value ? 'border-brand text-brand bg-brand-light/40 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 text-slate-400')}>
                    Dùng màu
                </button>

                {/* Upload own */}
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className={cn(TILE, 'border-2 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold',
                        custom ? 'border-brand ring-2 ring-brand/30' : 'border-dashed border-slate-200 dark:border-slate-700 text-slate-500')}
                    style={custom ? { background: `url("${custom}") center / cover` } : undefined}>
                    {!custom && <span className="text-lg leading-none">{uploading ? '…' : '＋'}</span>}
                    {custom
                        ? <span className="absolute bottom-1 inset-x-1 text-[10px] text-white bg-black/45 rounded px-1 py-0.5 truncate">Ảnh của bạn · đổi</span>
                        : <span>{uploading ? 'Đang tải…' : 'Ảnh của bạn'}</span>}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={e => upload(e.target.files?.[0])} />

                {shown.map(d => (
                    <button key={d.id} type="button" onClick={() => onChange(d.src, d)} title={d.name}
                        className={cn(TILE, 'bg-slate-100 dark:bg-slate-800',
                            value === d.src ? 'ring-[3px] ring-brand ring-offset-2 ring-offset-white dark:ring-offset-surface' : 'ring-1 ring-black/5')}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.src.replace(/\.webp$/, '.sm.webp')} alt={d.name} loading="lazy" decoding="async" className="w-full h-full object-cover"
                            onError={e => { const img = e.currentTarget; if (!img.dataset.full) { img.dataset.full = '1'; img.src = d.src; } }} />
                        {value === d.src && (
                            <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand text-white text-[11px] font-black flex items-center justify-center shadow">✓</span>
                        )}
                    </button>
                ))}
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">
                {selected
                    ? <>Đã chọn <span className="font-semibold text-slate-600 dark:text-slate-300">{selected.name}</span>.</>
                    : designs.length === 0
                        ? 'Chưa có mẫu cho ngân hàng này — bạn có thể tải ảnh thẻ của mình.'
                        : 'Chọn đúng mẫu thẻ bạn đang dùng để dễ nhận ra.'}
                {' '}Ảnh tự tải lên nên che số thẻ, tên, ngày hết hạn và không chụp mặt sau (CVV).
            </p>
        </div>
    );
}
