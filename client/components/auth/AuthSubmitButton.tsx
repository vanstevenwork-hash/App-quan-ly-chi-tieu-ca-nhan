'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { CustomIcon } from '@/components/icons/CustomIcon';

const PARTICLES = 12;

// Gradient submit button with the "fragment → burst → converge → spinner" FX.
// While `loading`, a burst of gradient particles explodes from the centre and
// reassembles into a spinning ring (CSS-only, defined in globals.css).
export default function AuthSubmitButton({
    loading,
    idleLabel,
    loadingLabel,
    leftIcon,
    className,
}: {
    loading: boolean;
    idleLabel: string;
    loadingLabel: string;
    leftIcon?: React.ReactNode;
    className?: string;
}) {
    return (
        <button
            type="submit"
            disabled={loading}
            className={cn(
                'relative w-full h-14 rounded-[18px] text-white text-[17px] font-bold overflow-hidden transition-all active:scale-[0.98] disabled:opacity-100',
                className
            )}
            style={{
                background: 'linear-gradient(135deg, #6757ff 0%, #8b5cf6 50%, #c084fc 100%)',
                boxShadow: '0 14px 34px -8px rgba(124,92,246,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
            }}
        >
            {/* Idle content — cross-fades out on submit */}
            <span className={cn('absolute inset-0 flex items-center justify-center transition-opacity duration-200', loading ? 'opacity-0' : 'opacity-100')}>
                {leftIcon && (
                    <span className="absolute left-2.5 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">{leftIcon}</span>
                )}
                <span>{idleLabel}</span>
                <CustomIcon type="arrowRight" size={18} tile={false} color="currentColor" className="absolute right-5" />
            </span>

            {/* Loading FX — mounted only while loading so the burst replays each submit */}
            {loading && (
                <span className="absolute inset-0 flex items-center justify-center gap-3">
                    <span className="auth-fx">
                        <span className="auth-fx-core" />
                        {Array.from({ length: PARTICLES }).map((_, i) => (
                            <span key={i} className="auth-fx-p" style={{ ['--a' as string]: `${(360 / PARTICLES) * i}deg` } as React.CSSProperties} />
                        ))}
                    </span>
                    <span className="text-[15px] font-bold text-white/90">{loadingLabel}</span>
                </span>
            )}
        </button>
    );
}
