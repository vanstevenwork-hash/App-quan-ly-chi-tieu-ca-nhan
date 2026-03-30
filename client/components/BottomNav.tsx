'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, PieChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import HomeIcon from './icons/HomeIcon';
import WalletIcon from './icons/WalletIcon';
type NavItem = {
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
};
const navItems: NavItem[] = [
    { href: '/dashboard', icon: HomeIcon, label: 'Tổng quan' },
    { href: '/calendar', icon: CalendarDays, label: 'Lịch' },
    { href: '/accounts', icon: WalletIcon, label: 'Tài khoản' },
    { href: '/budget', icon: PieChart, label: 'Ngân sách' },
    { href: '/settings', icon: Settings, label: 'Cài đặt' },
];

export default function BottomNav() {
    const pathname = usePathname();
    const activeIndex = navItems.findIndex(item => pathname === item.href || pathname.startsWith(item.href + '/'));

    return (
        <nav className="fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)] pointer-events-auto transition-all duration-300 will-change-transform rounded-t-[32px]" style={{ transform: 'translateZ(0)' }}>
                <div className="flex items-center justify-around px-2 pb-2 pt-3 relative">
                    {/* Sliding Indicator Background */}
                    <div
                        className="absolute top-2 h-14  rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none"
                        style={{
                            width: `calc((100% - 16px) / ${navItems.length})`,
                            left: '8px',
                            transform: `translateX(${activeIndex * 100}%)`,
                        }}
                    />
                    {navItems.map(({ href, icon: Icon, label }, index) => {
                        const active = index === activeIndex;
                        return (
                            <Link
                                key={href}
                                href={href}
                                className="flex flex-col items-center gap-1 group relative flex-1 min-w-0 z-10"
                            >
                                <div className={cn(
                                    'p-2 rounded-2xl transition-all duration-500 flex items-center justify-center',
                                    active
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30 -translate-y-1.5 scale-105'
                                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                )}>
                                    <Icon
                                        className={cn('w-5 h-5 transition-transform duration-500', active ? 'scale-105' : 'group-hover:scale-105')}
                                    />
                                </div>
                                <span className={cn(
                                    'text-[10px] font-bold transition-all duration-500 leading-none truncate w-full text-center mt-[-4px]',
                                    active
                                        ? 'text-primary dark:text-purple-400 opacity-100 translate-y-0'
                                        : 'text-slate-400 dark:text-slate-500 opacity-60'
                                )}>
                                    {label}
                                </span>

                                {active && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full mt-[-16px] animate-pulse shadow-[0_0_8px_rgba(127,25,230,0.5)]" />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
