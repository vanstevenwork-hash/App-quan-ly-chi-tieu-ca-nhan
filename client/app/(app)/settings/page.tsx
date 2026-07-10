'use client';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore, useUIStore } from '@/store/useStore';
import { useCashbackRecordStore } from '@/hooks/useCashbackRecords';
import { useTransactionStore } from '@/hooks/useTransactions';
import { useNotificationStore } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import ImageUpload from '@/components/ImageUpload';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { UtilityIcon } from '@/components/icons/UtilityIcon';

const CURRENCIES = [
    { code: 'VND', label: 'Việt Nam Đồng', symbol: '₫' },
    { code: 'USD', label: 'US Dollar', symbol: '$' },
];

const LANGUAGES = [
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
];

// Layered "elevated glass" shadow recipe — soft ambient spread + tight contact
// shadow, tinted purple in light mode (flat single-layer shadow-card reads flat;
// stacking 2-3 shadows of different blur/spread is what actually reads as "3D").
const CARD_SHADOW = 'shadow-[0_2px_2px_rgba(17,12,46,0.04),0_12px_24px_-8px_rgba(109,40,217,0.22),0_28px_48px_-16px_rgba(17,12,46,0.16)] dark:shadow-[0_2px_2px_rgba(0,0,0,0.3),0_12px_24px_-8px_rgba(0,0,0,0.5),0_28px_48px_-16px_rgba(0,0,0,0.4)]';
const TILE_SHADOW = 'shadow-[0_1px_2px_rgba(17,12,46,0.04),0_8px_16px_-6px_rgba(109,40,217,0.14)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_16px_-6px_rgba(0,0,0,0.4)]';

// Real pages that are NOT on the bottom nav — settings doubles as their hub
const SHORTCUTS = [
    { href: '/notifications', label: 'Thông báo', isUtil: true, type: 'bell', bg: 'bg-amber-50 dark:bg-amber-900/20', color: '#F59E0B' },
    { href: '/cards', label: 'Quản lý thẻ', isAction: true, type: 'creditCard', bg: 'bg-indigo-50 dark:bg-indigo-900/20', color: '#6366F1' },
    { href: '/cashback', label: 'Hoàn tiền', isUtil: true, type: 'hoanTien', bg: 'bg-emerald-50 dark:bg-emerald-900/20', color: '#10B981' },
    { href: '/wealth', label: 'Tài sản', isUtil: true, type: 'landmark', bg: 'bg-purple-50 dark:bg-purple-900/20', color: '#8B5CF6' },
    { href: '/savings', label: 'Tiết kiệm', isUtil: true, type: 'soTietKiem', bg: 'bg-amber-50 dark:bg-amber-900/20', color: '#F0A319' },
];

const SettingItem = ({
    icon, label, sublabel, value, right, onClick,
}: {
    icon: React.ReactNode;
    label: string;
    sublabel?: string;
    value?: string;
    right?: React.ReactNode;
    onClick?: () => void;
}) => (
    <button
        onClick={onClick}
        disabled={!onClick && !right}
        className="flex items-center gap-3.5 w-full px-4 py-4 hover:bg-muted/50 transition-colors text-left"
    >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-indigo-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-foreground truncate">{label}</p>
            {sublabel && <p className="text-muted-foreground text-xs truncate mt-0.5">{sublabel}</p>}
        </div>
        {value && <span className="text-sm text-muted-foreground font-medium flex-shrink-0">{value}</span>}
        {right ?? (onClick
            ? <ActionIcon type="chevronRight" size={16} tile={false} color="currentColor" className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
            : null)}
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

    // Currency / language dialogs
    const [showCurrencyDialog, setShowCurrencyDialog] = useState(false);
    const [savingCurrency, setSavingCurrency] = useState(false);
    const [showLanguageDialog, setShowLanguageDialog] = useState(false);
    const [savingLanguage, setSavingLanguage] = useState(false);

    // Security preferences — stored locally on this device
    const [faceId, setFaceId] = useState(false);
    const [hideBalanceOnOpen, setHideBalanceOnOpen] = useState(false);
    const [hasPin, setHasPin] = useState(false);
    const [showPinDialog, setShowPinDialog] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');

    // Data refresh
    const [refreshing, setRefreshing] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);

    // Logout confirm
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        setFaceId(localStorage.getItem('security.faceId') === '1');
        setHideBalanceOnOpen(localStorage.getItem('security.hideBalanceOnOpen') === '1');
        setHasPin(!!localStorage.getItem('security.pin'));
        setLastSync(localStorage.getItem('data.lastSyncAt'));
    }, []);

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

    const handleSelectLanguage = async (code: string) => {
        if (code === (user?.language || 'vi')) { setShowLanguageDialog(false); return; }
        setSavingLanguage(true);
        try {
            await authApi.updateProfile({ language: code });
            updateUser({ language: code });
            toast.success(code === 'vi' ? 'Đã chuyển sang Tiếng Việt' : 'Switched to English');
            setShowLanguageDialog(false);
        } catch {
            toast.error('Đổi ngôn ngữ thất bại');
        } finally {
            setSavingLanguage(false);
        }
    };

    const toggleFaceId = (v: boolean) => {
        setFaceId(v);
        localStorage.setItem('security.faceId', v ? '1' : '0');
        toast.success(v ? 'Đã bật mở khóa bằng Face ID' : 'Đã tắt mở khóa bằng Face ID');
    };

    const toggleHideBalance = (v: boolean) => {
        setHideBalanceOnOpen(v);
        localStorage.setItem('security.hideBalanceOnOpen', v ? '1' : '0');
        toast.success(v ? 'Số dư sẽ được ẩn khi mở app' : 'Số dư sẽ hiển thị khi mở app');
    };

    const handleSavePin = () => {
        if (!/^\d{4,6}$/.test(pinInput)) { toast.error('Mã PIN phải gồm 4–6 chữ số'); return; }
        if (pinInput !== pinConfirm) { toast.error('Mã PIN nhập lại không khớp'); return; }
        localStorage.setItem('security.pin', pinInput);
        setHasPin(true);
        setShowPinDialog(false);
        setPinInput('');
        setPinConfirm('');
        toast.success('Đã cập nhật mã PIN');
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
            const now = new Date().toISOString();
            localStorage.setItem('data.lastSyncAt', now);
            setLastSync(now);
            toast.success('Đã làm mới toàn bộ dữ liệu');
        } catch {
            toast.error('Làm mới thất bại, thử lại sau');
        } finally {
            setRefreshing(false);
        }
    };

    const handleExportData = () => {
        const txs = useTransactionStore.getState().transactions;
        if (txs.length === 0) { toast.error('Chưa có giao dịch nào để xuất'); return; }
        const header = 'Ngày,Loại,Danh mục,Số tiền,Phương thức,Ghi chú';
        const rows = txs.map(t => [
            new Date(t.date).toLocaleDateString('vi-VN'),
            t.type === 'income' ? 'Thu nhập' : 'Chi tiêu',
            `"${(t.category || '').replace(/"/g, '""')}"`,
            t.amount,
            t.paymentMethod,
            `"${(t.note || '').replace(/"/g, '""')}"`,
        ].join(','));
        // BOM so Excel opens Vietnamese text correctly
        const csv = '﻿' + [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `giao-dich-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Đã xuất ${txs.length} giao dịch ra file CSV`);
    };

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase()
        : 'NN';
    const currentCurrency = CURRENCIES.find(c => c.code === (user?.currency || 'VND')) || CURRENCIES[0];
    const currentLanguage = LANGUAGES.find(l => l.code === (user?.language || 'vi')) || LANGUAGES[0];
    const lastSyncLabel = lastSync
        ? `Đồng bộ lần cuối ${new Date(lastSync).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
        : 'Tải lại giao dịch, thẻ, tài sản';

    return (
        <div className="min-h-screen bg-background pb-8">
            {/* Header — flat title, page style matches the rest of the app */}
            <div className="px-5 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
                <h1 className="text-2xl font-bold text-foreground">Cài đặt</h1>
            </div>

            {/* Profile card with PRO badge */}
            <div className="px-5 mb-6">
                <div className={cn(
                    'relative bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-[#161B2E] rounded-[20px] p-5 flex items-center gap-4 border border-white dark:border-slate-700/60',
                    CARD_SHADOW
                )}>
                    <span className="absolute -top-3 right-5 px-3.5 py-1 rounded-full bg-amber-400 text-amber-950 text-[11px] font-extrabold tracking-wider shadow-md shadow-amber-500/30">
                        PRO
                    </span>
                    <div className="relative flex-shrink-0">
                        {avatarUrl ? (
                            <div className="relative rounded-full shadow-[0_10px_18px_-6px_rgba(109,40,217,0.45)] ring-[3px] ring-white dark:ring-slate-800">
                                <ImageUpload
                                    currentUrl={avatarUrl}
                                    onUpload={handleAvatarUpload}
                                    folder="chi_tieu/avatars"
                                    shape="circle"
                                    size={64}
                                />
                            </div>
                        ) : (
                            <div className="relative">
                                <div
                                    className="relative w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold overflow-hidden"
                                    style={{
                                        background: 'radial-gradient(circle at 32% 28%, #B8A6FF 0%, #8B7CF6 35%, #6C63FF 65%, #5B21B6 100%)',
                                        boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.55), inset 0 -6px 10px rgba(35,15,80,0.35), 0 10px 18px -6px rgba(109,40,217,0.55)',
                                    }}
                                >
                                    {/* glossy highlight */}
                                    <div aria-hidden className="absolute top-2 left-3 w-5 h-3 rounded-full bg-white/40 blur-[3px]" />
                                    <span className="relative">{initials}</span>
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
                        <p className="font-bold text-foreground text-lg truncate">{user?.name || 'Người dùng'}</p>
                        <p className="text-muted-foreground text-sm truncate">{user?.email || ''}</p>
                    </div>
                    <button
                        onClick={() => { setNameInput(user?.name || ''); setShowNameDialog(true); }}
                        className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700/70 border border-slate-200/70 dark:border-slate-600/50 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all flex-shrink-0">
                        <ActionIcon type="pencil" size={16} tile={false} color="currentColor" />
                    </button>
                </div>
            </div>

            <div className="px-5 space-y-6">
                {/* Shortcuts — one row of 5, like the mockup */}
                <div>
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.15em] mb-2.5 px-1">Quản lý nhanh</p>
                    <div className="grid grid-cols-5 gap-2">
                        {SHORTCUTS.map((item) => (
                            <button
                                key={item.href}
                                onClick={() => router.push(item.href)}
                                className={cn(
                                    'bg-card rounded-2xl px-1 py-3 flex flex-col items-center gap-2 active:scale-95 transition-all border border-transparent dark:border-slate-800/60',
                                    TILE_SHADOW
                                )}
                            >
                                <div className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]',
                                    item.bg
                                )}>
                                    {item.isUtil ? (
                                        <UtilityIcon type={item.type} size={20} tile={false} color={item.color} />
                                    ) : (
                                        <ActionIcon type={item.type} size={20} tile={false} color={item.color} />
                                    )}
                                </div>
                                <span className="text-[10px] font-semibold text-foreground leading-tight text-center w-full truncate">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Preferences */}
                <div>
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.15em] mb-2.5 px-1">Tùy chỉnh</p>
                    <div className={cn('bg-card rounded-[20px] overflow-hidden divide-y divide-border/50 border border-transparent dark:border-slate-800/60', CARD_SHADOW)}>
                        <SettingItem
                            icon={<ActionIcon type="moon" size={18} tile={false} color="currentColor" />}
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
                            icon={<CustomIcon type="dollarSign" size={18} tile={false} color="currentColor" className="w-[18px] h-[18px]" />}
                            label="Đơn vị tiền tệ"
                            value={`${currentCurrency.code} · ${currentCurrency.symbol}`}
                            onClick={() => setShowCurrencyDialog(true)}
                        />
                        <SettingItem
                            icon={<CustomIcon type="globe" size={18} tile={false} color="currentColor" className="w-[18px] h-[18px]" />}
                            label="Ngôn ngữ"
                            value={currentLanguage.label}
                            onClick={() => setShowLanguageDialog(true)}
                        />
                    </div>
                </div>

                {/* Security */}
                <div>
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.15em] mb-2.5 px-1">Bảo mật</p>
                    <div className={cn('bg-card rounded-[20px] overflow-hidden divide-y divide-border/50 border border-transparent dark:border-slate-800/60', CARD_SHADOW)}>
                        <SettingItem
                            icon={<CustomIcon type="scanFace" size={18} tile={false} color="currentColor" className="w-[18px] h-[18px]" />}
                            label="Mở khóa bằng Face ID"
                            sublabel="Yêu cầu khi mở app"
                            right={<Switch checked={faceId} onCheckedChange={toggleFaceId} />}
                        />
                        <SettingItem
                            icon={<ActionIcon type="lock" size={18} tile={false} color="currentColor" />}
                            label="Đổi mã PIN"
                            sublabel={hasPin ? 'Đã thiết lập' : 'Chưa thiết lập'}
                            onClick={() => setShowPinDialog(true)}
                        />
                        <SettingItem
                            icon={<UtilityIcon type="shield" size={18} tile={false} color="currentColor" />}
                            label="Ẩn số dư khi mở app"
                            sublabel="Chạm vào mắt để hiện"
                            right={<Switch checked={hideBalanceOnOpen} onCheckedChange={toggleHideBalance} />}
                        />
                    </div>
                </div>

                {/* Data */}
                <div>
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.15em] mb-2.5 px-1">Dữ liệu</p>
                    <div className={cn('bg-card rounded-[20px] overflow-hidden divide-y divide-border/50 border border-transparent dark:border-slate-800/60', CARD_SHADOW)}>
                        <SettingItem
                            icon={<CustomIcon type="refreshCw" size={18} tile={false} color="currentColor" className={cn('w-[18px] h-[18px]', refreshing && 'animate-spin')} />}
                            label="Làm mới dữ liệu"
                            sublabel={lastSyncLabel}
                            onClick={handleRefreshData}
                            right={refreshing ? <ActionIcon type="loader" size={16} tile={false} spin /> : undefined}
                        />
                        <SettingItem
                            icon={<CustomIcon type="download" size={18} tile={false} color="currentColor" className="w-[18px] h-[18px]" />}
                            label="Xuất dữ liệu"
                            sublabel="Tải file CSV giao dịch"
                            onClick={handleExportData}
                        />
                    </div>
                </div>

                {/* Logout — outlined red card, centered */}
                <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="w-full rounded-[20px] border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 py-4 flex items-center justify-center gap-2.5 text-red-500 font-bold text-[15px] hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-[0.99] transition-all"
                >
                    <ActionIcon type="logOut" size={18} tile={false} color="#EF4444" />
                    Đăng xuất
                </button>

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
                            {savingName && <ActionIcon type="loader" size={16} tile={false} spin className="mr-2" />}
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
                                    {active && <ActionIcon type="check" size={20} tile={false} color="#6C63FF" />}
                                </button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Language dialog */}
            <Dialog open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Ngôn ngữ</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        {LANGUAGES.map(l => {
                            const active = l.code === (user?.language || 'vi');
                            return (
                                <button
                                    key={l.code}
                                    onClick={() => handleSelectLanguage(l.code)}
                                    disabled={savingLanguage}
                                    className={cn(
                                        'w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left',
                                        active
                                            ? 'border-primary bg-primary/5'
                                            : 'border-border hover:border-primary/40'
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
                                        {l.flag}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-foreground">{l.label}</p>
                                    </div>
                                    {active && <ActionIcon type="check" size={20} tile={false} color="#6C63FF" />}
                                </button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* PIN dialog */}
            <Dialog open={showPinDialog} onOpenChange={(open) => { setShowPinDialog(open); if (!open) { setPinInput(''); setPinConfirm(''); } }}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{hasPin ? 'Đổi mã PIN' : 'Thiết lập mã PIN'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Mã PIN mới (4–6 chữ số)"
                            className="rounded-xl h-12 text-center tracking-[0.5em] font-bold"
                            type="password"
                            inputMode="numeric"
                            autoFocus
                        />
                        <Input
                            value={pinConfirm}
                            onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Nhập lại mã PIN"
                            className="rounded-xl h-12 text-center tracking-[0.5em] font-bold"
                            type="password"
                            inputMode="numeric"
                        />
                        <p className="text-xs text-muted-foreground">Mã PIN được lưu trên thiết bị này để khóa ứng dụng.</p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowPinDialog(false)} className="rounded-xl">
                            Hủy
                        </Button>
                        <Button onClick={handleSavePin} className="rounded-xl">
                            Lưu mã PIN
                        </Button>
                    </DialogFooter>
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
                        <Button onClick={handleLogout} className="rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center">
                            <ActionIcon type="logOut" size={16} tile={false} color="#FFFFFF" className="mr-2" /> Đăng xuất
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
