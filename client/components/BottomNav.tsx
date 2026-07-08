'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Target, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import HomeIcon from './icons/HomeIcon';
import WalletIcon from './icons/WalletIcon';

type NavItem = {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
};
const navItems: NavItem[] = [
    { href: '/dashboard', icon: HomeIcon, label: 'Tổng quan' },
    { href: '/calendar', icon: CalendarDays, label: 'Lịch' },
    { href: '/accounts', icon: WalletIcon, label: 'Tài khoản' },
    { href: '/goals', icon: Target, label: 'Mục tiêu' },
    { href: '/settings', icon: Settings, label: 'Cài đặt' },
];

// Springy overshoot easing — shared by the bubble and the icon lift so they
// move as one unit. Kept as an inline style (not an arbitrary Tailwind
// ease-[...] class) because commas in cubic-bezier make that class ambiguous
// to Tailwind's parser and it warns on every build.
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export default function BottomNav() {
    const pathname = usePathname();
    const activeIndex = navItems.findIndex(item => pathname === item.href || pathname.startsWith(item.href + '/'));

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none will-change-transform"
            style={{
                // Keep the nav on its own GPU layer — without this iOS Safari
                // repaints position:fixed elements during scroll and the bar
                // visibly "drags" behind the page.
                transform: 'translate3d(0,0,0)',
                WebkitTransform: 'translate3d(0,0,0)',
                WebkitBackfaceVisibility: 'hidden',
            }}
        >
            <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-gray-100 dark:border-slate-800 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)] pointer-events-auto rounded-t-[32px]">
                <div className="relative flex items-stretch pt-3 pb-2">
                    {/* Floating bubble — one element that springs between tab slots.
                        The ring matches the page background so the bubble reads as
                        "punched out" of the bar. */}
                    {activeIndex >= 0 && (
                        <div
                            aria-hidden
                            className="absolute -top-5 left-0 h-14 flex justify-center pointer-events-none"
                            style={{
                                width: `${100 / navItems.length}%`,
                                transform: `translateX(${activeIndex * 100}%)`,
                                transition: `transform 0.55s ${SPRING}`,
                            }}
                        >
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#8E7CFF] via-[#7C6BFF] to-[#6C63FF] shadow-[0_8px_20px_rgba(108,99,255,0.45)] ring-4 ring-[#F8F9FF] dark:ring-slate-950" />
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
                                <div
                                    className={cn(
                                        'flex h-7 w-7 items-center justify-center transition-colors duration-300',
                                        active
                                            ? 'text-white'
                                            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                                    )}
                                    style={{
                                        transform: active ? 'translateY(-18px) scale(1.12)' : 'translateY(0) scale(1)',
                                        transition: `transform 0.55s ${SPRING}`,
                                    }}
                                >
                                    <Icon className="w-[22px] h-[22px]" />
                                </div>
                                <span className={cn(
                                    'text-[10px] font-bold leading-none truncate w-full text-center transition-colors duration-300',
                                    active
                                        ? 'text-primary dark:text-purple-400'
                                        : 'text-slate-400/80 dark:text-slate-500/80'
                                )}>
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
