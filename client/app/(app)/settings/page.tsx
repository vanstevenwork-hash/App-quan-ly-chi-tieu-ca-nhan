'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore, useUIStore } from '@/store/useStore';
import { useCashbackRecordStore } from '@/hooks/useCashbackRecords';
import { useTransactionStore } from '@/hooks/useTransactions';
import { useNotificationStore } from '@/hooks/useNotifications';
import {
    ChevronRight, Moon, Bell, LogOut, DollarSign, RefreshCw,
    Pencil, CreditCard, BadgePercent, Landmark, Wallet, BarChart3,
    Check, Loader2, PiggyBank,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ImageUpload from '@/components/ImageUpload';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';

const CURRENCIES = [
    { code: 'VND', label: 'Việt Nam Đồng', symbol: '₫' },
    { code: 'USD', label: 'US Dollar', symbol: '$' },
];

// Real pages that are NOT on the bottom nav — settings doubles as their hub
const SHORTCUTS = [
    { href: '/notifications', label: 'Thông báo', icon: Bell, bg: 'bg-amber-50 dark:bg-amber-900/20', color: 'text-amber-500' },
    { href: '/cards', label: 'Quản lý thẻ', icon: CreditCard, bg: 'bg-indigo-50 dark:bg-indigo-900/20', color: 'text-indigo-500' },
    { href: '/cashback', label: 'Hoàn tiền', icon: BadgePercent, bg: 'bg-emerald-50 dark:bg-emerald-900/20', color: 'text-emerald-500' },
    { href: '/wealth', label: 'Tài sản', icon: Landmark, bg: 'bg-purple-50 dark:bg-purple-900/20', color: 'text-purple-500' },
    { href: '/budget', label: 'Ngân sách', icon: Wallet, bg: 'bg-blue-50 dark:bg-blue-900/20', color: 'text-blue-500' },
    { href: '/savings', label: 'Tiết kiệm', icon: PiggyBank, bg: 'bg-pink-50 dark:bg-pink-900/20', color: 'text-pink-500' },
];

const SettingItem = ({
    icon, label, sublabel, right, onClick, danger,
}: {
    icon: React.ReactNode;
    label: string;
    sublabel?: string;
    right?: React.ReactNode;
    onClick?: () => void;
    danger?: boolean;
}) => (
    <button
        onClick={onClick}
        disabled={!onClick && !right}
        className={cn(
            'flex items-center gap-3 w-full px-4 py-3.5 hover:bg-muted/50 transition-colors text-left',
            danger && 'hover:bg-red-50 dark:hover:bg-red-950/20'
        )}
    >
        <div className={cn(
            'w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0',
            danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-primary/10'
        )}>
            <span className={cn(danger ? 'text-red-500' : 'text-primary')}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-semibold truncate', danger ? 'text-red-500' : 'text-foreground')}>{label}</p>
            {sublabel && <p className="text-muted-foreground text-xs truncate mt-0.5">{sublabel}</p>}
        </div>
        {right || <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
    </button>
);

export default function SettingsPage() {
    const { user, logout, updateUser } = useAuthStore();
    const { isDarkMode, toggleDarkMode } = useUIStore();
    const router = useRouter();
    const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatar || '');

    // Edit name dialog
    const [showNameDialog, setShowNameDialog] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [savingName, setSavingName] = useState(false);

    // Currency dialog
    const [showCurrencyDialog, setShowCurrencyDialog] = useState(false);
    const [savingCurrency, setSavingCurrency] = useState(false);

    // Data refresh
    const [refreshing, setRefreshing] = useState(false);

    // Logout confirm
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const handleLogout = () => {
        logout();
        router.push('/auth/login');
    };

    const handleAvatarUpload = async (url: string) => {
        setAvatarUrl(url);
        try {
            await authApi.updateProfile({ avatar: url });
            updateUser({ avatar: url });
            toast.success('Đã cập nhật ảnh đại diện!');
        } catch {
            toast.error('Lưu ảnh thất bại');
        }
    };

    const handleSaveName = async () => {
        const name = nameInput.trim();
        if (!name) { toast.error('Tên không được để trống'); return; }
        setSavingName(true);
        try {
            await authApi.updateProfile({ name });
            updateUser({ name });
            toast.success('Đã đổi tên hiển thị');
            setShowNameDialog(false);
        } catch {
            toast.error('Đổi tên thất bại');
        } finally {
            setSavingName(false);
        }
    };

    const handleSelectCurrency = async (code: string) => {
        if (code === (user?.currency || 'VND')) { setShowCurrencyDialog(false); return; }
        setSavingCurrency(true);
        try {
            await authApi.updateProfile({ currency: code });
            updateUser({ currency: code });
            toast.success(`Đã đổi đơn vị tiền tệ sang ${code}`);
            setShowCurrencyDialog(false);
        } catch {
            toast.error('Đổi đơn vị thất bại');
        } finally {
            setSavingCurrency(false);
        }
    };

    const handleRefreshData = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            // Forced transaction fetch cascades to cards + wealth stores
            await Promise.all([
                useTransactionStore.getState().fetch(true),
                useNotificationStore.getState().fetch(true),
                useCashbackRecordStore.getState().fetch(true),
            ]);
            toast.success('Đã làm mới toàn bộ dữ liệu');
        } catch {
            toast.error('Làm mới thất bại, thử lại sau');
        } finally {
            setRefreshing(false);
        }
    };

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase()
        : 'NN';
    const currentCurrency = CURRENCIES.find(c => c.code === (user?.currency || 'VND')) || CURRENCIES[0];

    return (
        <div className="min-h-screen bg-background pb-8">
            {/* Header */}
            <div className="gradient-primary px-5 pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 3rem)' }}>
                <h1 className="text-xl font-bold text-white">Cài đặt</h1>
                <p className="text-white/70 text-sm mt-0.5">Tài khoản & tuỳ chỉnh ứng dụng</p>
            </div>

            {/* Profile card */}
            <div className="px-5 -mt-10 mb-5">
                <div className="bg-card rounded-3xl shadow-card p-5 flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                        {avatarUrl ? (
                            <ImageUpload
                                currentUrl={avatarUrl}
                                onUpload={handleAvatarUpload}
                                folder="chi_tieu/avatars"
                                shape="circle"
                                size={64}
                            />
                        ) : (
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-xl font-bold">
                                    {initials}
                                </div>
                                <ImageUpload
                                    onUpload={handleAvatarUpload}
                                    folder="chi_tieu/avatars"
                                    shape="circle"
                                    size={64}
                                    className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-base truncate">{user?.name || 'Người dùng'}</p>
                        <p className="text-muted-foreground text-sm truncate">{user?.email || ''}</p>
                    </div>
                    <button
                        onClick={() => { setNameInput(user?.name || ''); setShowNameDialog(true); }}
                        className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 active:scale-95 transition-all flex-shrink-0">
                        <Pencil className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="px-5 space-y-5">
                {/* Shortcuts grid */}
                <div>
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2 px-1">Quản lý nhanh</p>
                    <div className="grid grid-cols-3 gap-2.5">
                        {SHORTCUTS.map(({ href, label, icon: Icon, bg, color }) => (
                            <button
                                key={href}
                                onClick={() => router.push(href)}
                                className="bg-card rounded-2xl shadow-card p-3.5 flex flex-col items-center gap-2 hover:shadow-md active:scale-95 transition-all"
                            >
                                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
                                    <Icon className={cn('w-5 h-5', color)} />
                                </div>
                                <span className="text-xs font-semibold text-foreground">{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Preferences */}
                <div>
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2 px-1">Tùy chỉnh</p>
                    <div className="bg-card rounded-3xl shadow-card overflow-hidden divide-y divide-border/50">
                        <SettingItem
                            icon={<Moon className="w-4 h-4" />}
                            label="Chế độ tối"
                            sublabel={isDarkMode ? 'Đang bật' : 'Đang tắt'}
                            right={
                                <Switch
                                    checked={isDarkMode}
                                    onCheckedChange={() => toggleDarkMode()}
                                />
                            }
                        />
                        <SettingItem
                            icon={<DollarSign className="w-4 h-4" />}
                            label="Đơn vị tiền tệ"
                            sublabel={`${currentCurrency.code} · ${currentCurrency.label}`}
                            onClick={() => setShowCurrencyDialog(true)}
                        />
                    </div>
                </div>

                {/* Data */}
                <div>
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2 px-1">Dữ liệu</p>
                    <div className="bg-card rounded-3xl shadow-card overflow-hidden">
                        <SettingItem
                            icon={<RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />}
                            label="Làm mới dữ liệu"
                            sublabel="Tải lại giao dịch, thẻ, tài sản, thông báo"
                            onClick={handleRefreshData}
                            right={refreshing ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : undefined}
                        />
                    </div>
                </div>

                {/* Logout */}
                <div className="bg-card rounded-3xl shadow-card overflow-hidden">
                    <SettingItem
                        icon={<LogOut className="w-4 h-4" />}
                        label="Đăng xuất"
                        sublabel={user?.email || undefined}
                        onClick={() => setShowLogoutConfirm(true)}
                        danger
                        right={<span />}
                    />
                </div>
                <p className="text-center text-muted-foreground text-xs">Phiên bản 1.0.0 • Chi Tiêu Cá Nhân</p>
            </div>

            {/* Edit name dialog */}
            <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Đổi tên hiển thị</DialogTitle>
                    </DialogHeader>
                    <Input
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        placeholder="Nhập tên mới"
                        className="rounded-xl h-12"
                        maxLength={50}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowNameDialog(false)} className="rounded-xl">
                            Hủy
                        </Button>
                        <Button onClick={handleSaveName} disabled={savingName} className="rounded-xl">
                            {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Lưu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Currency dialog */}
            <Dialog open={showCurrencyDialog} onOpenChange={setShowCurrencyDialog}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Đơn vị tiền tệ</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        {CURRENCIES.map(c => {
                            const active = c.code === (user?.currency || 'VND');
                            return (
                                <button
                                    key={c.code}
                                    onClick={() => handleSelectCurrency(c.code)}
                                    disabled={savingCurrency}
                                    className={cn(
                                        'w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left',
                                        active
                                            ? 'border-primary bg-primary/5'
                                            : 'border-border hover:border-primary/40'
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        {c.symbol}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-foreground">{c.code}</p>
                                        <p className="text-xs text-muted-foreground">{c.label}</p>
                                    </div>
                                    {active && <Check className="w-5 h-5 text-primary" />}
                                </button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Logout confirm dialog */}
            <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Đăng xuất?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng ứng dụng.
                    </p>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowLogoutConfirm(false)} className="rounded-xl">
                            Hủy
                        </Button>
                        <Button onClick={handleLogout} className="rounded-xl bg-red-500 hover:bg-red-600 text-white">
                            <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
