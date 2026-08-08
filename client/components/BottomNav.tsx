'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/useStore';
import { CustomIcon } from './icons/CustomIcon';
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

// Pages that actually render <AddTransactionModal> bound to the UI store. The
// FAB opens the modal via the store; on any other page we hop to /dashboard
// first (client nav keeps the store flag, so the modal opens on arrival).
const MODAL_ROUTES = ['/dashboard', '/calendar', '/cards', '/search', '/analytics'];

// Item footprint inside the pill: w-12 (48px) + gap-1 (4px) = 52px stride.
// The active halo slides by activeIndex × STRIDE. Springy overshoot easing.
const ITEM_STRIDE = 52;
const SLIDE_EASE = 'cubic-bezier(0.34, 1.4, 0.64, 1)';

export default function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const openAddModal = useUIStore(s => s.openAddModal);
    const activeIndex = navItems.findIndex(item => pathname === item.href || pathname.startsWith(item.href + '/'));

    const handleAdd = () => {
        openAddModal();
        if (!MODAL_ROUTES.some(p => pathname === p || pathname.startsWith(p + '/'))) router.push('/dashboard');
    };

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none will-change-transform pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2"
            style={{
                // Keep the nav on its own GPU layer — without this iOS Safari
                // repaints position:fixed elements during scroll and the bar
                // visibly "drags". NOTE: the liquid-glass look here is faked with
                // translucency + specular highlights, NOT backdrop-filter — a
                // real backdrop-blur on a fixed element forces iOS to re-filter
                // every scrolled frame and reintroduces that lag.
                transform: 'translate3d(0,0,0)',
                WebkitTransform: 'translate3d(0,0,0)',
                WebkitBackfaceVisibility: 'hidden',
            }}
        >
            <div className="pointer-events-auto flex items-center gap-3 px-3">
                {/* ── Glass pill: the 4 destinations ── */}
                <div className="relative flex items-center gap-1 p-1.5 rounded-full overflow-hidden bg-white/65 dark:bg-[#20264a]/65 ring-1 ring-white/60 dark:ring-white/10 shadow-[0_14px_34px_-10px_rgba(31,17,71,0.32),0_2px_8px_-2px_rgba(0,0,0,0.12)]">
                    {/* top gloss sheen + hairline rim highlight (the "glass") */}
                    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/60 dark:from-white/12 to-transparent" />
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-full"
                        style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.85), inset 0 -10px 18px -12px rgba(0,0,0,0.18)' }}
                    />
                    {/* Sliding glass halo — glides slowly between tabs */}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute top-1.5 left-1.5 w-12 h-12 rounded-full bg-white/90 dark:bg-white/15 ring-1 ring-black/[0.05] dark:ring-white/10"
                        style={{
                            transform: `translateX(${Math.max(activeIndex, 0) * ITEM_STRIDE}px)`,
                            opacity: activeIndex >= 0 ? 1 : 0,
                            transition: `transform 0.5s ${SLIDE_EASE}, opacity 0.3s ease`,
                            boxShadow: '0 2px 8px rgba(31,17,71,0.18), inset 0 1px 1px rgba(255,255,255,0.9)',
                        }}
                    />
                    {navItems.map(({ href, icon: Icon, label }, index) => {
                        const active = index === activeIndex;
                        return (
                            <Link
                                key={href}
                                href={href}
                                aria-label={label}
                                aria-current={active ? 'page' : undefined}
                                className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full active:scale-90 transition-transform duration-200"
                            >
                                <span
                                    className={cn(
                                        'relative transition-colors duration-500',
                                        active ? 'text-brand dark:text-brand-light' : 'text-slate-400 dark:text-slate-500'
                                    )}
                                >
                                    <Icon className="w-[25px] h-[25px]" blob={false} mono color="currentColor" />
                                </span>
                            </Link>
                        );
                    })}
                </div>

                {/* ── Floating FAB: flat brand-purple, add transaction ── */}
                <button
                    onClick={handleAdd}
                    aria-label="Thêm giao dịch"
                    className="flex items-center justify-center w-[52px] h-[52px] rounded-full bg-brand hover:bg-brand-dark text-white shadow-[0_10px_24px_-6px_rgba(54,37,92,0.6)] transition-all duration-200 active:scale-90 hover:scale-105"
                >
                    <CustomIcon type="plus" size={25} tile={false} color="#FFFFFF" />
                </button>
            </div>
        </nav>
    );
}
