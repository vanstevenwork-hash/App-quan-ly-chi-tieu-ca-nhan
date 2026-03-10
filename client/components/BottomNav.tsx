'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CreditCard, PiggyBank, Target, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import HomeIcon from './icons/HomeIcon';
type NavItem = {
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
};
const navItems: NavItem[] = [
    { href: '/dashboard', icon: Home, label: 'Tổng quan' },
    { href: '/cards', icon: CreditCard, label: 'Thẻ' },
    { href: '/savings', icon: PiggyBank, label: 'Tiết kiệm' },
    { href: '/goals', icon: Target, label: 'Mục tiêu' },
    { href: '/analytics', icon: BarChart3, label: 'Báo cáo' },
    { href: '/settings', icon: Settings, label: 'Cài đặt' },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
            <div className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shadow-bottom-nav">
                <div className="flex items-center justify-around px-1 pb-4 pt-2">
                    {navItems.map(({ href, icon: Icon, label }) => {
                        const active = pathname === href || pathname.startsWith(href + '/');
                        return (
                            <Link
                                key={href}
                                href={href}
                                className="flex flex-col items-center gap-0.5 px-1 py-1 relative min-w-0"
                            >
                                <div className={cn(
                                    'p-1.5 rounded-xl transition-all',
                                    active ? 'bg-primary/10 dark:bg-purple-900/30' : ''
                                )}>
                                    <Icon
                                        className={cn('w-[18px] h-[18px] transition-colors', active ? 'text-primary dark:text-purple-400' : 'text-muted-foreground dark:text-slate-400')}
                                        strokeWidth={active ? 2.5 : 1.8}
                                    />

                                </div>
                                <span className={cn(
                                    'text-[9px] font-medium transition-colors leading-none truncate w-full text-center',
                                    active ? 'text-primary dark:text-purple-400' : 'text-muted-foreground dark:text-slate-400'
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
