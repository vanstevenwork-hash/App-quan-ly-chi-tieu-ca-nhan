'use client';
import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { safeCardImage, thumbSrc } from '@/lib/cardArt';
import { useBankLogo } from '@/hooks/useBankLogo';

export interface CardThumbData {
    bankShortName?: string;
    bankName?: string;
    cardNumber?: string;
    cardImage?: string;
    color?: string;
    bankColor?: string;
}

// Card-shaped (1.586:1) so every screen shows a card the same way.
const SIZES = {
    xs: { w: 30, h: 19, r: 4, logo: 13, text: 7 },
    sm: { w: 44, h: 28, r: 6, logo: 18, text: 8 },
    md: { w: 54, h: 34, r: 7, logo: 22, text: 9 },
    lg: { w: 68, h: 43, r: 9, logo: 28, text: 10 },
} as const;
export type CardThumbSize = keyof typeof SIZES;

const solid = (c?: string) => (c && c !== '#1B4FD8' && c !== '#6C63FF' && c !== '#FFFFFF' ? c : null);

// The single "small card" used across the app (statements, wealth, cashback,
// installments, notifications, pickers…):
//  - card has artwork → the artwork
//  - otherwise → white card with the bank logo (or bank initials on its colour)
function CardThumbInner({ card, size = 'md', showLast4 = false, className, logoUrl }: {
    card: CardThumbData;
    size?: CardThumbSize;
    showLast4?: boolean;          // last-4 overlay (only readable from md up)
    className?: string;
    logoUrl?: string;             // caller-resolved logo (optional)
}) {
    const s = SIZES[size];
    const logoOf = useBankLogo();
    const [logoFailed, setLogoFailed] = useState(false);
    const [thumbFailed, setThumbFailed] = useState(false);
    const art = safeCardImage(card.cardImage);
    // Small copy first; fall back to the full image if it's missing.
    const artSrc = art ? (thumbFailed ? art : thumbSrc(art) || art) : null;
    const logo = logoFailed ? undefined : (logoUrl || logoOf(card.bankShortName, card.bankName));
    const last4 = showLast4 && card.cardNumber ? card.cardNumber.slice(-4) : '';
    const label = card.bankShortName || card.bankName || 'Thẻ';

    const box = cn('relative flex-shrink-0 overflow-hidden ring-1 ring-black/[0.07] dark:ring-white/10 shadow-[0_1px_2px_rgba(15,23,42,0.12)]', className);
    const style = { width: s.w, height: s.h, borderRadius: s.r };

    if (art) {
        return (
            <div className={box} style={style} role="img" aria-label={`${label}${last4 ? ` •••• ${last4}` : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={artSrc!} alt="" loading="lazy" decoding="async" onError={() => setThumbFailed(true)}
                    className="absolute inset-0 w-full h-full object-cover" />
                {last4 && size !== 'xs' && size !== 'sm' && (
                    <span className="absolute bottom-[2px] right-[3px] font-bold tracking-wider text-white leading-none"
                        style={{ fontSize: s.text, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{last4}</span>
                )}
            </div>
        );
    }

    if (logo) {
        return (
            <div className={cn(box, 'bg-white flex items-center justify-center')} style={style} role="img" aria-label={label}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="" loading="lazy" decoding="async" onError={() => setLogoFailed(true)}
                    className="object-contain" style={{ width: s.logo * 1.6, height: s.logo }} />
                {last4 && size !== 'xs' && size !== 'sm' && (
                    <span className="absolute bottom-[2px] right-[3px] font-bold text-slate-400 leading-none" style={{ fontSize: s.text }}>{last4}</span>
                )}
            </div>
        );
    }

    const bg = solid(card.bankColor) || solid(card.color) || '#6757ff';
    return (
        <div className={cn(box, 'flex items-center justify-center')} role="img" aria-label={label}
            style={{ ...style, background: `linear-gradient(135deg, ${bg}, ${bg}cc)` }}>
            <span className="font-black text-white tracking-tight leading-none" style={{ fontSize: s.text + 2 }}>
                {label.slice(0, 3).toUpperCase()}
            </span>
        </div>
    );
}

const CardThumb = memo(CardThumbInner);
export default CardThumb;
