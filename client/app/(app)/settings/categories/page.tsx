'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { CustomIcon, APP_LOGO_LIST } from '@/components/icons/CustomIcon';
import { ActionIcon } from '@/components/icons/ActionIcon';
import CategoryIcon, { CategoryPicker } from '@/components/icons/CategoryIcon';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CATEGORIES } from '@/lib/mockData';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import type { CustomCategory } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PALETTE = ['#F59E0B', '#8B5CF6', '#3B82F6', '#EC4899', '#10B981', '#F97316', '#EF4444', '#DC2626', '#22C55E', '#06B6D4', '#6C63FF', '#14B8A6', '#A855F7', '#6B7280'];
const INCOME_LABELS = ['Lương', 'Freelance', 'Đầu tư', 'Thưởng', 'Tiền lãi'];

export default function CategoriesPage() {
    const router = useRouter();
    const { categories, add, update, remove } = useCustomCategories();
    const [tab, setTab] = useState<'expense' | 'income'>('expense');

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<CustomCategory | null>(null);
    const [label, setLabel] = useState('');
    const [iconType, setIconType] = useState('khac');
    const [color, setColor] = useState(PALETTE[0]);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    const builtin = CATEGORIES.filter(c => tab === 'income' ? INCOME_LABELS.includes(c.label) || c.label === 'Khác' : !INCOME_LABELS.includes(c.label));
    const custom = categories.filter(c => c.type === tab);

    const openAdd = () => {
        setEditing(null); setLabel(''); setIconType(tab === 'income' ? 'luong' : 'khac'); setColor(PALETTE[0]); setShowForm(true);
    };
    const openEdit = (c: CustomCategory) => {
        setEditing(c); setLabel(c.label); setIconType(c.catIconType || 'khac'); setColor(c.color || PALETTE[0]); setShowForm(true);
    };

    const handleSave = async () => {
        const name = label.trim();
        if (!name) { toast.error('Nhập tên danh mục'); return; }
        setSaving(true);
        try {
            if (editing) await update(editing._id, { label: name, catIconType: iconType, color });
            else await add({ label: name, catIconType: iconType, color, type: tab });
            toast.success(editing ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục');
            setShowForm(false);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lưu thất bại');
        } finally { setSaving(false); }
    };

    const handleDelete = async (c: CustomCategory) => {
        if (!confirm(`Xóa danh mục "${c.label}"? Giao dịch cũ vẫn giữ tên này.`)) return;
        setDeleting(c._id);
        try { await remove(c._id); toast.success('Đã xóa danh mục'); }
        catch { toast.error('Xóa thất bại'); }
        finally { setDeleting(null); }
    };

    return (
        <div className="min-h-screen pb-28 bg-gray-50 dark:bg-surface-deep">
            <PageHeader title="Danh mục" subtitle="Cài đặt" onBack={() => router.back()} />

            <div className="px-5 space-y-5">
                {/* Chi / Thu tabs */}
                <div className="bg-slate-100 dark:bg-surface p-1 rounded-xl flex gap-1 border border-transparent dark:border-slate-800/60">
                    {(['expense', 'income'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={cn('flex-1 py-2.5 rounded-lg text-sm font-bold transition-all',
                                tab === t ? 'bg-brand text-white shadow-sm' : 'text-slate-500 dark:text-slate-400')}>
                            {t === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
                        </button>
                    ))}
                </div>

                {/* Custom categories */}
                <div>
                    <div className="flex items-center justify-between mb-2.5 px-1">
                        <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.15em]">Danh mục của tôi</p>
                        <button onClick={openAdd} className="inline-flex items-center gap-1 text-[13px] font-bold text-brand dark:text-brand-light">
                            <ActionIcon type="plus" size={14} tile={false} color="currentColor" /> Thêm
                        </button>
                    </div>
                    <div className="bg-card rounded-2xl overflow-hidden divide-y divide-border/50 border border-transparent dark:border-slate-800/60 shadow-sm">
                        {custom.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">Chưa có danh mục riêng. Bấm <b>Thêm</b> để tạo (vd Shopee, Lazada, TikTok…).</p>
                        )}
                        {custom.map(c => (
                            <div key={c._id} className="flex items-center gap-3 px-3 py-2.5">
                                <CategoryIcon type={c.catIconType || 'khac'} size={40} tile className="flex-shrink-0" />
                                <span className="flex-1 min-w-0 text-[15px] font-bold text-foreground truncate">{c.label}</span>
                                <button onClick={() => openEdit(c)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-muted transition">
                                    <ActionIcon type="pencil" size={16} tile={false} color="currentColor" />
                                </button>
                                <button onClick={() => handleDelete(c)} disabled={deleting === c._id}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-40">
                                    {deleting === c._id ? <ActionIcon type="loader" size={16} tile={false} spin /> : <ActionIcon type="trash" size={16} tile={false} color="currentColor" />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Built-in (read-only) */}
                <div>
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.15em] mb-2.5 px-1">Mặc định</p>
                    <div className="bg-card rounded-2xl grid grid-cols-4 gap-2 p-3 border border-transparent dark:border-slate-800/60 shadow-sm">
                        {builtin.map(c => (
                            <div key={c.id} className="flex flex-col items-center gap-1.5 py-1">
                                <CategoryIcon type={c.catIconType} size={38} tile />
                                <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight truncate w-full">{c.label}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 px-1">Danh mục mặc định không sửa/xóa được — chỉ thêm danh mục riêng của bạn.</p>
                </div>
            </div>

            {/* Add / Edit form — bottom sheet (fixed header + scrollable body + footer) */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent disableDefaultAnimation className="
fixed inset-x-0 bottom-0 top-[14vh] z-[60] w-full max-w-md mx-auto
!translate-x-0 !translate-y-0 bg-white dark:bg-surface
rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col overflow-hidden p-0 border-0 gap-0
data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300
data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200
">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 pt-4 pb-3 shrink-0 border-b border-slate-100 dark:border-slate-800">
                        <DialogTitle className="text-lg font-bold flex-1 text-slate-800 dark:text-white truncate">
                            {editing ? 'Sửa danh mục' : `Thêm danh mục ${tab === 'income' ? 'thu' : 'chi'}`}
                        </DialogTitle>
                        <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                            <CustomIcon type="x" size={16} tile={false} color="currentColor" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4 hide-scrollbar">
                        {/* Preview + name */}
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}22` }}>
                                <CustomIcon type={iconType} size={26} color={color} />
                            </div>
                            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Tên danh mục (vd Shopee)" maxLength={40} className="rounded-xl h-12 flex-1 min-w-0" autoFocus />
                        </div>

                        {/* Color */}
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Màu</p>
                            <div className="flex flex-wrap gap-2">
                                {PALETTE.map(cl => (
                                    <button key={cl} type="button" onClick={() => setColor(cl)}
                                        className={cn('w-8 h-8 rounded-full transition-transform', color === cl ? 'scale-110' : '')}
                                        style={{ backgroundColor: cl, ...(color === cl ? { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${cl}` } : {}) }} />
                                ))}
                            </div>
                        </div>

                        {/* App logos */}
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Logo app</p>
                            <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
                                {APP_LOGO_LIST.map(a => {
                                    const val = `app:${a.key}`;
                                    const active = iconType === val;
                                    return (
                                        <button key={a.key} type="button" onClick={() => setIconType(val)}
                                            className="flex flex-col items-center gap-1 flex-shrink-0 w-[60px]">
                                            <span className={cn('rounded-xl transition', active && 'ring-2 ring-brand ring-offset-1 ring-offset-background')}>
                                                <CustomIcon type={val} size={46} />
                                            </span>
                                            <span className="text-[10px] text-muted-foreground truncate w-full text-center">{a.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Vector icon */}
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Hoặc chọn biểu tượng</p>
                            <CategoryPicker value={iconType} onChange={setIconType} group={tab === 'income' ? 'thu' : 'chi'} />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 flex gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                        <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-xl flex-1">Hủy</Button>
                        <Button onClick={handleSave} disabled={saving} className="rounded-xl flex-1">
                            {saving && <ActionIcon type="loader" size={16} tile={false} spin className="mr-2" />}
                            {editing ? 'Lưu' : 'Thêm'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
