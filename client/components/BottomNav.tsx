'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavHomeIcon, NavCalendarIcon, NavAssetIcon, NavGoalIcon, NavSettingsIcon } from './icons/CredBackIcons';

type NavItem = {
    href: string;
    icon: React.ComponentType<{ className?: string; blob?: boolean; mono?: boolean; color?: string }>;
    label: string;
};
const navItems: NavItem[] = [
    { href: '/dashboard', icon: NavHomeIcon, label: 'Tổng quan' },
    { href: '/calendar', icon: NavCalendarIcon, label: 'Lịch' },
    { href: '/accounts', icon: NavAssetIcon, label: 'Tài sản' },
    { href: '/goals', icon: NavGoalIcon, label: 'Mục tiêu' },
    { href: '/settings', icon: NavSettingsIcon, label: 'Cài đặt' },
];

// Springy overshoot easing — the halo ring springs between tab slots.
// Kept as an inline style rather than an arbitrary Tailwind easing class:
// commas inside cubic-bezier make such classes ambiguous to Tailwind's
// parser and it warns on every build (it even scans comments).
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const RING_GRADIENT = 'conic-gradient(from 200deg, #60A5FA, #6C63FF, #A855F7, #60A5FA)';

export default function BottomNav() {
    const pathname = usePathname();
    const activeIndex = navItems.findIndex(item => pathname === item.href || pathname.startsWith(item.href + '/'));
    const ActiveIcon = navItems[activeIndex]?.icon;

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none will-change-transform"
            style={{
                // Keep the nav on its own GPU layer — without this iOS Safari
                // repaints position:fixed elements during scroll and the bar
                // visibly "drags" behind the page. NOTE: no backdrop-blur here
                // on purpose; backdrop-filter on a fixed element forces iOS to
                // re-filter every scrolled frame and reintroduces the lag.
                transform: 'translate3d(0,0,0)',
                WebkitTransform: 'translate3d(0,0,0)',
                WebkitBackfaceVisibility: 'hidden',
            }}
        >
            <div
                className="relative w-full max-w-md bg-white dark:bg-[#191E36] border-t border-gray-100 dark:border-white/5 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.55)] pb-[env(safe-area-inset-bottom)] pointer-events-auto rounded-t-[28px]"
                style={{ transform: 'translateZ(0)', WebkitBackfaceVisibility: 'hidden' }}
            >
                {/* Fade just above the bar so scrolling content dissolves into the
                    page instead of butting right up against (and peeking through
                    the bar's rounded corners). Matches the page canvas colour. */}
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full h-8 bg-gradient-to-t from-[#F8F9FF] dark:from-surface-deep to-transparent" />
                <div className="relative flex items-stretch pt-3 pb-1.5">
                    {/* Floating halo ring — springs between tab slots, glowing on top of the bar */}
                    {activeIndex >= 0 && ActiveIcon && (
                        <div
                            aria-hidden
                            className="absolute -top-5 left-0 flex justify-center pointer-events-none"
                            style={{
                                width: `${100 / navItems.length}%`,
                                transform: `translateX(${activeIndex * 100}%)`,
                                transition: `transform 0.55s ${SPRING}`,
                            }}
                        >
                            <div className="relative w-12 h-12">
                                {/* soft glow halo behind the ring */}
                                <div
                                    className="absolute inset-0 rounded-full opacity-50 dark:opacity-70 blur-md scale-110"
                                    style={{ background: RING_GRADIENT }}
                                />
                                {/* gradient ring with a bar-matching disc punched into the middle */}
                                <div className="absolute inset-0 rounded-full p-[2.5px]" style={{ background: RING_GRADIENT }}>
                                    <div className="w-full h-full rounded-full bg-white dark:bg-[#191E36] flex items-center justify-center">
                                        <ActiveIcon className="w-[22px] h-[22px]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {navItems.map(({ href, icon: Icon, label }, index) => {
                        const active = index === activeIndex;
                        return (
                            <Link
                                key={href}
                                href={href}
                                className="relative z-10 flex-1 min-w-0 flex flex-col items-center gap-1 select-none group transition-transform duration-200 active:scale-90"
                            >
                                {active ? (
                                    // Icon is rendered inside the floating ring above — this is just a spacer
                                    // so the label sits at the same baseline as the inactive tabs.
                                    <div className="h-7 w-7" aria-hidden />
                                ) : (
                                    <div className="flex h-7 w-7 items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-300">
                                        <Icon className="w-[22px] h-[22px]" blob={false} mono color="currentColor" />
                                    </div>
                                )}
                                <span
                                    className={cn(
                                        'text-[10px] font-bold leading-none truncate w-full text-center transition-colors duration-300',
                                        active
                                            ? 'text-primary dark:text-[#8FA0FF] opacity-100'
                                            : 'text-slate-400/80 dark:text-slate-500/80 opacity-90'
                                    )}
                                >
                                    {label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
