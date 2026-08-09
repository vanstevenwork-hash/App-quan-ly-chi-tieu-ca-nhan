// Duotone refresh glyph — faint trailing arc + solid leading arc with arrowhead.
// Uses currentColor, so set the color via a text-* class on `className`.
export const RefreshDuotone = ({ className = '' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20.5 12a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-7.4-4.3"
            stroke="currentColor" strokeOpacity={0.28} strokeWidth={3.2} />
        <path d="M3.5 12A8.5 8.5 0 0 1 12 3.5a8.5 8.5 0 0 1 7.4 4.3"
            stroke="currentColor" strokeWidth={3.2} />
        <path d="M19.6 3.4v4.6h-4.6" stroke="currentColor" strokeWidth={3.2} />
    </svg>
);

export default RefreshDuotone;
