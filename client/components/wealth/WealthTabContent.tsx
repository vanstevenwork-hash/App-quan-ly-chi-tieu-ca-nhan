'use client';
import { memo, useState } from 'react';
import { Pencil, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WealthSourceUI } from '@/hooks/useWealth';

const fmtFull = (n: number) => Math.round(n).toLocaleString('vi-VN');

const CATEGORY_LABELS: Record<string, string> = {
    savings: 'Tiết kiệm', gold: 'Vàng bạc', crypto: 'Crypto',
    cashback: 'Hoàn tiền', affiliate: 'Affiliate', stock: 'Cổ phiếu',
    real_estate: 'Bất động sản', other: 'Khác',
    credit: 'Thẻ tín dụng', bank: 'Tài khoản ngân hàng', eWallet: 'Ví điện tử'
};

function WealthCard({ source, onEdit, onDelete, className }: {
    source: WealthSourceUI; onEdit: () => void; onDelete: () => void; className?: string;
}) {
    return (
        <div className={cn("bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.03)] rounded-xl p-2.5 flex items-center justify-between group hover:border-purple-200 dark:hover:border-purple-500/50 transition-all cursor-pointer relative", className)}>
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${source.color}15`, border: `1px solid ${source.color}30`, color: source.color }}>
                    {typeof source.icon === 'string' && source.icon.length <= 2 ? (
                        <span className="text-xl">{source.icon}</span>
                    ) : (
                        source.icon
                    )}
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-white text-xs truncate">{source.name}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{CATEGORY_LABELS[source.category] || 'Khác'}</span>
                    </div>
                </div>
            </div>

            <div className="relative h-10 min-w-[100px] overflow-hidden flex items-center justify-end">
                {/* Balance View */}
                <div className="flex flex-col items-end transition-all duration-300 group-hover:-translate-y-full group-hover:opacity-0">
                    <div className={`font-bold text-sm ${source.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtFull(source.balance)}đ</div>
                    {source.note && <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[100px] leading-tight text-right">{source.note}</div>}
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 flex items-center justify-end gap-2 translate-y-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-purple-100 hover:text-purple-600 dark:hover:bg-purple-900/40 transition-colors shadow-sm"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40 transition-colors shadow-sm"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function GroupedWealthCard({ title, icon, color, items, onEdit, onDelete }: {
    title: string; icon: React.ReactNode; color: string; items: WealthSourceUI[];
    onEdit: (s: WealthSourceUI) => void; onDelete: (s: WealthSourceUI) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const totalBalance = items.reduce((sum, item) => sum + item.balance, 0);

    if (items.length === 1) {
        return <WealthCard source={items[0]} onEdit={() => onEdit(items[0])} onDelete={() => onDelete(items[0])} />;
    }

    return (
        <div className="space-y-2">
            <div
                className={cn(
                    "bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm rounded-xl p-2.5 flex items-center justify-between group transition-all cursor-pointer relative",
                    isExpanded ? "border-purple-200 dark:border-purple-500/50 ring-1 ring-purple-100 dark:ring-purple-900/30" : "hover:border-purple-100 dark:hover:border-purple-800"
                )}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30`, color: color }}>
                        {icon}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-xs">{title}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{items.length} tài khoản</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <div className={`font-bold text-sm ${totalBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {fmtFull(totalBalance)}đ
                        </div>
                    </div>
                    <div className={cn("transition-transform duration-300 mr-1 p-1 rounded-full bg-slate-50 dark:bg-slate-700/50", isExpanded ? "rotate-180" : "")}>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="pl-6 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {items.map(s => (
                        <WealthCard
                            key={s._id}
                            source={s}
                            onEdit={() => onEdit(s)}
                            onDelete={() => onDelete(s)}
                            className="scale-[0.98] origin-left border-dashed"
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

type GroupedItem = {
    key: string; isGroup: boolean; title: string; items: WealthSourceUI[];
    color: string; icon: React.ReactNode; standaloneItem?: WealthSourceUI;
};

interface WealthTabContentProps {
    loading: boolean;
    activeTab: 'accounts' | 'savings' | 'other';
    accountSources: WealthSourceUI[];
    savingsSources: WealthSourceUI[];
    otherSources: WealthSourceUI[];
    groupedAccounts: GroupedItem[];
    groupedSavings: GroupedItem[];
    onAddClick: () => void;
    onEditSource: (s: WealthSourceUI) => void;
    onDeleteSource: (s: WealthSourceUI) => void;
}

function WealthTabContentBase({
    loading, activeTab, accountSources, savingsSources, otherSources,
    groupedAccounts, groupedSavings, onAddClick, onEditSource, onDeleteSource,
}: WealthTabContentProps) {
    if (loading) {
        return (
            <div className="space-y-3 mt-8">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4 pt-6">
            {/* Title Bar */}
            <div className="flex justify-between items-end px-1">
                <h2 className="font-bold text-lg text-gray-800 dark:text-white">
                    {activeTab === 'accounts' ? 'Danh sách tài khoản' : activeTab === 'savings' ? 'Sổ tiết kiệm' : 'Tài sản khác'}
                </h2>
                <button onClick={onAddClick} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-900/20 px-2.5 py-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all uppercase tracking-tight">Thêm mới</button>
            </div>

            {/* List rendering */}
            <div className="space-y-3">
                {activeTab === 'accounts' && accountSources.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-6">Chưa có thẻ hoặc tài khoản nào.</p>
                )}
                {activeTab === 'accounts' && groupedAccounts.map((g) => (
                    <GroupedWealthCard
                        key={g.key}
                        title={g.title}
                        color={g.color}
                        icon={g.icon}
                        items={g.items}
                        onEdit={onEditSource}
                        onDelete={onDeleteSource}
                    />
                ))}

                {activeTab === 'savings' && savingsSources.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-6">Chưa có sổ tiết kiệm nào.</p>
                )}
                {activeTab === 'savings' && groupedSavings.map((g) => (
                    <GroupedWealthCard
                        key={g.key}
                        title={g.title}
                        color={g.color}
                        icon={g.icon}
                        items={g.items}
                        onEdit={onEditSource}
                        onDelete={onDeleteSource}
                    />
                ))}

                {activeTab === 'other' && otherSources.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-6">Chưa có tài sản khác.</p>
                )}
                {activeTab === 'other' && otherSources.map(s => (
                    <WealthCard key={s._id} source={s}
                        onEdit={() => onEditSource(s)}
                        onDelete={() => onDeleteSource(s)} />
                ))}
            </div>
        </div>
    );
}

export default memo(WealthTabContentBase);
