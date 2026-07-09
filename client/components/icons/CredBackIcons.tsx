'use client';
import React, { useId, type SVGProps } from 'react';

/**
 * CredBack Premium Icon Set (v2) — purple edition
 * ------------------------------------------------
 * Ngôn ngữ thiết kế riêng, không theo style lucide-react:
 *  - Glyph solid đổ gradient dọc (tím nhạt → tím đậm, khớp --primary của app)
 *  - Chi tiết khoét âm bản bằng <mask> → trong suốt thật, đặt lên nền nào cũng đúng
 *  - Blob tím nhạt lệch góc phía sau tạo chiều sâu
 *
 * Props:
 *  - size  : px (mặc định 24)
 *  - blob  : hiện blob phía sau (mặc định true — tắt cho trạng thái inactive)
 *  - mono  : true → bỏ gradient, dùng màu đơn `color` (cho trạng thái xám inactive)
 *  - color : màu đơn khi mono (mặc định "#94A3B8")
 */

const GRAD_FROM = '#A78BFA'; // violet-400 — matches the aurora hero cards
const GRAD_TO = '#6C63FF';   // app primary
const BLOB = '#EDE9FE';      // violet-100 — soft blob behind active glyphs
const RING_DARK = '#5B21B6'; // violet-800 — calendar top studs

interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number;
    blob?: boolean;
    mono?: boolean;
    color?: string;
}

const useIconIds = () => {
    const uid = useId().replace(/:/g, '');
    return { gradId: `g-${uid}`, maskId: `m-${uid}` };
};

function Svg({ size = 24, children, ...rest }: { size?: number; children: React.ReactNode } & SVGProps<SVGSVGElement>) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0 }}
            {...rest}
        >
            {children}
        </svg>
    );
}

function Grad({ id }: { id: string }) {
    return (
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={GRAD_FROM} />
            <stop offset="1" stopColor={GRAD_TO} />
        </linearGradient>
    );
}

const fillOf = (mono: boolean, color: string, gradId: string) => (mono ? color : `url(#${gradId})`);

/* ---------------- Home ---------------- */
export function NavHomeIcon({ blob = true, mono = false, color = '#94A3B8', ...props }: IconProps) {
    const { gradId, maskId } = useIconIds();
    const fill = fillOf(mono, color, gradId);
    return (
        <Svg {...props}>
            <defs>
                {!mono && <Grad id={gradId} />}
                <mask id={maskId}>
                    <rect width="24" height="24" fill="white" />
                    <rect x="9.9" y="13.9" width="4.2" height="6.1" rx="2.1" fill="black" />
                </mask>
            </defs>
            {blob && <circle cx="6.2" cy="7" r="4.6" fill={BLOB} />}
            <path
                d="M12 3.8 L20.2 10.6 V17.4 A2.6 2.6 0 0 1 17.6 20 H6.4 A2.6 2.6 0 0 1 3.8 17.4 V10.6 Z"
                fill={fill}
                stroke={fill}
                strokeWidth="1.6"
                strokeLinejoin="round"
                mask={`url(#${maskId})`}
            />
        </Svg>
    );
}

/* ---------------- Calendar ---------------- */
export function NavCalendarIcon({ blob = true, mono = false, color = '#94A3B8', ...props }: IconProps) {
    const { gradId, maskId } = useIconIds();
    const fill = fillOf(mono, color, gradId);
    return (
        <Svg {...props}>
            <defs>
                {!mono && <Grad id={gradId} />}
                <mask id={maskId}>
                    <rect width="24" height="24" fill="white" />
                    <rect x="3" y="9.4" width="18" height="1.5" fill="black" />
                    {[[8, 14.4], [12, 14.4], [16, 14.4], [8, 17.9], [12, 17.9]].map(([cx, cy]) => (
                        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="black" />
                    ))}
                </mask>
            </defs>
            {blob && <circle cx="19" cy="17.5" r="4.6" fill={BLOB} />}
            <rect x="7.3" y="2.4" width="1.9" height="5" rx="0.95" fill={mono ? color : RING_DARK} />
            <rect x="14.8" y="2.4" width="1.9" height="5" rx="0.95" fill={mono ? color : RING_DARK} />
            <rect x="3" y="4.8" width="18" height="16" rx="4" fill={fill} mask={`url(#${maskId})`} />
        </Svg>
    );
}

/* ---------------- Card ---------------- */
export function NavCardIcon({ blob = true, mono = false, color = '#94A3B8', ...props }: IconProps) {
    const { gradId, maskId } = useIconIds();
    const fill = fillOf(mono, color, gradId);
    return (
        <Svg {...props}>
            <defs>
                {!mono && <Grad id={gradId} />}
                <mask id={maskId}>
                    <rect width="24" height="24" fill="white" />
                    <rect x="2.6" y="8.9" width="18.8" height="2.5" fill="black" />
                    <rect x="5.4" y="13.9" width="3.8" height="2" rx="1" fill="black" />
                    <rect x="10.6" y="14.4" width="5.2" height="1" rx="0.5" fill="black" opacity="0.75" />
                </mask>
            </defs>
            {blob && <circle cx="5.4" cy="5.8" r="4.4" fill={BLOB} />}
            <rect x="2.6" y="5.8" width="18.8" height="13.2" rx="3.4" fill={fill} mask={`url(#${maskId})`} />
        </Svg>
    );
}

/* ---------------- Mục tiêu (Goal / Target) ---------------- */
export function NavGoalIcon({ blob = true, mono = false, color = '#94A3B8', ...props }: IconProps) {
    const { gradId, maskId } = useIconIds();
    const fill = fillOf(mono, color, gradId);
    return (
        <Svg {...props}>
            <defs>
                {!mono && <Grad id={gradId} />}
                <mask id={maskId}>
                    <rect width="24" height="24" fill="white" />
                    <circle cx="11.6" cy="13" r="5.2" fill="black" />
                </mask>
            </defs>
            {blob && <circle cx="18" cy="6" r="4.4" fill={BLOB} />}
            <circle cx="11.6" cy="13" r="8.4" fill={fill} mask={`url(#${maskId})`} />
            <circle cx="11.6" cy="13" r="2.7" fill={fill} />
        </Svg>
    );
}

/* ---------------- Settings (đai ốc lục giác) ---------------- */
export function NavSettingsIcon({ blob = true, mono = false, color = '#94A3B8', ...props }: IconProps) {
    const { gradId, maskId } = useIconIds();
    const fill = fillOf(mono, color, gradId);
    return (
        <Svg {...props}>
            <defs>
                {!mono && <Grad id={gradId} />}
                <mask id={maskId}>
                    <rect width="24" height="24" fill="white" />
                    <circle cx="12" cy="12" r="3.2" fill="black" />
                </mask>
            </defs>
            {blob && <circle cx="5.8" cy="18.2" r="4.4" fill={BLOB} />}
            <path
                d="M20.2 12 L16.1 4.9 H7.9 L3.8 12 L7.9 19.1 H16.1 Z"
                fill={fill}
                stroke={fill}
                strokeWidth="2.4"
                strokeLinejoin="round"
                mask={`url(#${maskId})`}
            />
        </Svg>
    );
}
