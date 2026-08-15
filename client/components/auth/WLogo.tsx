// Folded-ribbon "W" brand mark (fintech logo). Scales with width; height auto.
export default function WLogo({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label="Logo">
            <defs>
                <linearGradient id="wl-main" x1="42" y1="32" x2="190" y2="110" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#D6B6FF" />
                    <stop offset=".35" stopColor="#A56AFF" />
                    <stop offset=".72" stopColor="#8248E8" />
                    <stop offset="1" stopColor="#6B36D5" />
                </linearGradient>
                <linearGradient id="wl-light" x1="70" y1="20" x2="150" y2="105" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F1E5FF" />
                    <stop offset=".48" stopColor="#B98BFF" />
                    <stop offset="1" stopColor="#8750E8" />
                </linearGradient>
                <linearGradient id="wl-dark" x1="38" y1="35" x2="92" y2="112" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8B55D8" />
                    <stop offset="1" stopColor="#45247E" />
                </linearGradient>
                <filter id="wl-glow" x="-30%" y="-40%" width="160%" height="180%">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* soft glow */}
            <path d="M36 34L68 89L99 34L130 89L176 21" stroke="#9B63FF" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" opacity=".20" filter="url(#wl-glow)" />

            {/* LEFT folded ribbon */}
            <path d="M32 31 C27 24 17 27 20 37 L54 97 C58 104 68 107 75 100 L98 67 L86 43 L67 72 L48 37 C44 30 37 27 32 31Z" fill="url(#wl-main)" />
            {/* left inner dark facet */}
            <path d="M32 31 C27 28 23 31 26 38 L48 78 L60 61 L45 35 C41 29 35 28 32 31Z" fill="url(#wl-dark)" opacity=".92" />

            {/* CENTER fold */}
            <path d="M86 43 L98 67 L117 38 L128 60 L143 38 L130 89 L119 101 C113 107 102 104 98 97 L75 57Z" fill="url(#wl-light)" />
            {/* central dark fold */}
            <path d="M86 43L98 67L108 52L96 32Z" fill="#7C46C8" />
            <path d="M98 67L108 52L119 70L130 89L119 101Z" fill="#6C39B9" />

            {/* RIGHT rising ribbon */}
            <path d="M119 70 L142 101 C146 106 156 107 161 101 L207 32 C212 24 207 17 198 18 L180 19 C175 19 171 22 168 27 L137 75 L128 60Z" fill="url(#wl-main)" />
            {/* right top highlight */}
            <path d="M181 21 L201 20 C205 20 207 23 204 28 L174 73 C170 79 165 81 159 80 L151 79 L181 21Z" fill="url(#wl-light)" opacity=".78" />
            {/* right lower facet */}
            <path d="M137 75L151 79L161 101C156 107 146 106 142 101L119 70L128 60Z" fill="#7540CF" />

            {/* subtle edge highlight */}
            <path d="M31 30C36 27 43 30 47 37L67 72 M99 67L117 38 M137 75L168 27C171 22 175 19 180 19" stroke="white" strokeOpacity=".42" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
}
