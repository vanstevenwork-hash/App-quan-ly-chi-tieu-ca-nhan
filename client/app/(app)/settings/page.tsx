'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { useAuthStore, useUIStore } from '@/store/useStore';
import {
    ChevronRight, Moon, Bell,
    Shield, FileText,
    HelpCircle, LogOut, Smartphone, DollarSign, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ImageUpload from '@/components/ImageUpload';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';

const SettingItem = ({
    icon,
    label,
    sublabel,
    right,
    onClick,
    danger,
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
        className={cn(
            'flex items-center gap-3 w-full px-4 py-3.5 hover:bg-muted/50 transition-colors',
            danger && 'hover:bg-red-50 dark:hover:bg-red-950/20'
        )}
    >
        <div className={cn(
            'w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0',
            danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-primary/10'
        )}>
            <span className={cn(danger ? 'text-red-500' : 'text-primary')}>{icon}</span>
        </div>
        <div className="flex-1 text-left">
            <p className={cn('text-sm font-medium', danger ? 'text-red-500' : 'text-foreground')}>{label}</p>
            {sublabel && <p className="text-muted-foreground text-xs">{sublabel}</p>}
        </div>
        {right || <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </button>
);

export default function SettingsPage() {
    const { user, logout, updateUser } = useAuthStore();
    const { isDarkMode, toggleDarkMode } = useUIStore();
    const router = useRouter();
    const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatar || '');

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

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase()
        : 'NN';

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="gradient-primary px-5 pt-12 pb-16">
                <h1 className="text-xl font-bold text-white mb-6">Cài đặt hệ thống</h1>
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
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 gradient-income rounded-full border-2 border-card" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-foreground text-base">{user?.name || 'Nguyễn Văn A'}</p>
                        <p className="text-muted-foreground text-sm">{user?.email || 'user@email.com'}</p>
                        <span className="inline-flex items-center gap-1 mt-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                            ⭐ Thành viên Premium
                        </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
            </div>

            <div className="px-5 space-y-4 pb-8">
                {/* Preferences */}
                <div>
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2 px-1">Tùy chỉnh</p>
                    <div className="bg-card rounded-3xl shadow-card overflow-hidden divide-y divide-border/50">
                        <SettingItem
                            icon={<Moon className="w-4 h-4" />}
                            label="Chế độ tối"
                            sublabel="Bảo vệ mắt ban đêm"
                            right={
                                <Switch
                                    checked={isDarkMode}
                                    onCheckedChange={() => {
                                        toggleDarkMode();
                                        document.documentElement.classList.toggle('dark');
                                    }}
                                />
                            }
                        />
                        <SettingItem
                            icon={<DollarSign className="w-4 h-4" />}
                            label="Đơn vị tiền tệ"
                            sublabel={user?.currency || 'VND'}
                        />
                    </div>
                </div>

                {/* Notifications */}
                <div>
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2 px-1">Thông báo</p>
                    <div className="bg-card rounded-3xl shadow-card overflow-hidden divide-y divide-border/50">
                        <SettingItem
                            icon={<Bell className="w-4 h-4" />}
                            label="Nhắc nhở thanh toán"
                            sublabel="Nhắc hóa đơn trước 3 ngày"
                            right={<Switch defaultChecked />}
                        />
                        <SettingItem
                            icon={<Smartphone className="w-4 h-4" />}
                            label="Cập nhật số dư"
                            sublabel="Đồng bộ tự động"
                            right={<Switch defaultChecked />}
                        />
                    </div>
                </div>

                {/* Data */}
                <div>
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2 px-1">Dữ liệu</p>
                    <div className="bg-card rounded-3xl shadow-card overflow-hidden divide-y divide-border/50">
                        <SettingItem icon={<RefreshCw className="w-4 h-4" />} label="Đồng bộ hóa" sublabel="Cập nhật lần cuối: vừa xong" />
                        <SettingItem icon={<FileText className="w-4 h-4" />} label="Sao lưu dữ liệu" />
                    </div>
                </div>

                {/* App info */}
                <div>
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2 px-1">Về ứng dụng</p>
                    <div className="bg-card rounded-3xl shadow-card overflow-hidden divide-y divide-border/50">
                        <SettingItem icon={<Shield className="w-4 h-4" />} label="Bảo mật & Chính sách" />
                        <SettingItem icon={<HelpCircle className="w-4 h-4" />} label="Điều khoản & Chính sách" />
                    </div>
                </div>

                {/* Logout */}
                <div className="bg-card rounded-3xl shadow-card overflow-hidden">
                    <SettingItem
                        icon={<LogOut className="w-4 h-4" />}
                        label="Đăng xuất"
                        onClick={handleLogout}
                        danger
                        right={<span />}
                    />
                </div>
                <p className="text-center text-muted-foreground text-xs">Phiên bản 1.0.0 • Chi Tiêu Cá Nhân</p>
            </div>
        </div>
    );
}
