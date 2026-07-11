'use client';
import { memo, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { WealthSourceUI } from '@/hooks/useWealth';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { UtilityIcon } from '@/components/icons/UtilityIcon';

const fmtFull = (n: number) => Math.round(n).toLocaleString('vi-VN');

// Compact signed totals for section headers: "-260,9tr" · "+4,42tr"
const fmtShortSigned = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '+';
    let v: string;
    if (abs >= 1_000_000_000) v = `${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} tỷ`;
    else if (abs >= 1_000_000) v = `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace('.', ',')}tr`;
    else if (abs >= 1_000) v = `${Math.round(abs / 1_000)}k`;
    else v = `${Math.round(abs)}`;
    return `${sign}${v}`;
};

const CATEGORY_LABELS: Record<string, string> = {
    savings: 'Sổ tiết kiệm', gold: 'Vàng bạc', crypto: 'Crypto',
    cashback: 'Hoàn tiền', affiliate: 'Affiliate', stock: 'Cổ phiếu',
    real_estate: 'Bất động sản', other: 'Khác',
    credit: 'Thẻ tín dụng', bank: 'Tài khoản thanh toán', eWallet: 'Ví điện tử'
};

// ─── Building blocks ─────────────────────────────────────────────

/** The money column: flush right, tabular digits so every row lines up when scanning vertically. */
function AmountCell({ value }: { value: number }) {
    return (
        <span className={cn(
            'text-[15px] font-bold tracking-tight tabular-nums whitespace-nowrap',
            value < 0 ? 'text-red-500 dark:text-red-400'
                : value > 0 ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
        )}>
            {fmtFull(value)}
        </span>
    );
}

/** Bank logo / fallback icon tile — keeps each source's own color. */
function LogoTile({ icon, color }: { icon: React.ReactNode; color: string }) {
    return (
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30`, color }}>
            {typeof icon === 'string' && icon.length <= 2 ? <span className="text-xl">{icon}</span> : icon}
        </div>
    );
}

/** "4 thẻ ▾" pill next to the title — the disclosure lives here, away from the money column. */
function GroupChip({ count, unit, expanded }: { count: number; unit: string; expanded: boolean }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-300 flex-shrink-0">
            {count} {unit}
            <ActionIcon type="chevronDown" size={10} tile={false} color="currentColor"
                className={cn('transition-transform duration-200', expanded && 'rotate-180')} />
        </span>
    );
}

function SectionHeader({ label, total }: { label: string; total: number }) {
    return (
        <div className="flex items-center justify-between px-1 mb-2.5">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">{label}</h3>
            <span className={cn(
                'text-xs font-bold tracking-tight tabular-nums',
                total < 0 ? 'text-red-500 dark:text-red-400'
                    : total > 0 ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 dark:text-slate-500'
            )}>
                {fmtShortSigned(total)}
            </span>
        </div>
    );
}

// ─── Rows ────────────────────────────────────────────────────────

function WealthCard({ source, onEdit, onDelete, className }: {
    source: WealthSourceUI; onEdit: () => void; onDelete: () => void; className?: string;
}) {
    const label = CATEGORY_LABELS[source.category] || 'Khác';
    // External cards derive their note from the category — only user-written notes add info
    const subtitle = !source.isExternal && source.note && source.note !== label
        ? `${label} · ${source.note}`
        : label;

    return (
        <div className={cn(
            'group relative flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-800 shadow-sm hover:border-purple-200 dark:hover:border-purple-500/40 transition-all',
            className
        )}>
            <LogoTile icon={source.icon} color={source.color} />
            <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 dark:text-white text-[15px] truncate">{source.name}</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>
            </div>

            {/* Amount at rest, edit/delete slide in on hover — the resting column stays flush right */}
            <div className="relative flex items-center justify-end min-w-[96px] h-10 overflow-hidden flex-shrink-0">
                <div className="transition-all duration-300 group-hover:-translate-y-full group-hover:opacity-0">
                    <AmountCell value={source.balance} />
                </div>
                <div className="absolute inset-0 flex items-center justify-end gap-2 translate-y-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors shadow-sm"
                    >
                        <ActionIcon type="pencil" size={16} tile={false} color="#8B5CF6" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-sm"
                    >
                        <ActionIcon type="trash" size={16} tile={false} color="#EF4444" />
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

    const cardType = items[0].cardType;
    const unit = cardType === 'credit' ? 'thẻ' : cardType === 'savings' ? 'sổ' : 'mục';
    const subtitle = cardType === 'credit' ? 'Nhóm thẻ tín dụng'
        : cardType === 'savings' ? 'Nhóm sổ tiết kiệm' : 'Nhóm tài khoản';

    return (
        <div className="space-y-2">
            {/* Whole row is the toggle; the ▾ lives inside the chip next to the title */}
            <button
                onClick={() => setIsExpanded(v => !v)}
                className={cn(
                    'w-full text-left flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-surface border shadow-sm transition-all',
                    isExpanded
                        ? 'border-purple-200 dark:border-purple-500/40 ring-1 ring-purple-100 dark:ring-purple-900/30'
                        : 'border-gray-100 dark:border-slate-800 hover:border-purple-100 dark:hover:border-purple-800'
                )}
            >
                <LogoTile icon={icon} color={color} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <h4 className="font-bold text-slate-800 dark:text-white text-[15px] truncate">{title}</h4>
                        <GroupChip count={items.length} unit={unit} expanded={isExpanded} />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
                </div>
                <AmountCell value={totalBalance} />
            </button>

            {isExpanded && (
                <div className="pl-5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {items.map(s => (
                        <WealthCard
                            key={s._id}
                            source={s}
                            onEdit={() => onEdit(s)}
                            onDelete={() => onDelete(s)}
                            className="border-dashed"
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/** Zero-balance accounts collapse into one quiet row so the active list stays scannable. */
function InactiveGroup({ groups, onEdit, onDelete }: {
    groups: GroupedItem[];
    onEdit: (s: WealthSourceUI) => void; onDelete: (s: WealthSourceUI) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const count = groups.reduce((s, g) => s + g.items.length, 0);
    const names = Array.from(new Set(groups.map(g => g.items[0].bankShortName || g.title)));
    const preview = names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '');

    return (
        <div className="space-y-2">
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full text-left flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/70 dark:bg-surface/60 border border-gray-100 dark:border-slate-800/70 shadow-sm opacity-75 hover:opacity-100 transition-all"
            >
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <UtilityIcon type="moreHorizontal" size={18} tile={false} color="#94A3B8" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <h4 className="font-bold text-slate-500 dark:text-slate-300 text-[15px]">Không hoạt động</h4>
                        <GroupChip count={count} unit="mục" expanded={expanded} />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">Số dư 0đ · {preview}</p>
                </div>
            </button>

            {expanded && (
                <div className="pl-5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {groups.map(g => (
                        <GroupedWealthCard
                            key={g.key}
                            title={g.title}
                            color={g.color}
                            icon={g.icon}
                            items={g.items}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Tab content ─────────────────────────────────────────────────

type GroupedItem = {
    key: string; isGroup: boolean; title: string; items: WealthSourceUI[];
    color: string; icon: React.ReactNode; standaloneItem?: WealthSourceUI;
};

interface WealthTabContentProps {
    loading: boolean;
    activeTab: 'accounts' | 'savings' | 'other';
    savingsSources: WealthSourceUI[];
    otherSources: WealthSourceUI[];
    groupedCreditCards: GroupedItem[];
    groupedBankAccounts: GroupedItem[];
    groupedSavings: GroupedItem[];
    onAddClick: () => void;
    onEditSource: (s: WealthSourceUI) => void;
    onDeleteSource: (s: WealthSourceUI) => void;
}

const groupTotal = (g: GroupedItem) => g.items.reduce((s, i) => s + i.balance, 0);

function WealthTabContentBase({
    loading, activeTab, savingsSources, otherSources,
    groupedCreditCards, groupedBankAccounts, groupedSavings, onAddClick, onEditSource, onDeleteSource,
}: WealthTabContentProps) {
    // Split accounts: active ones sorted biggest-first, zero-balance bundled into one row
    const { activeBanks, inactiveBanks, bankTotal } = useMemo(() => {
        const active = groupedBankAccounts.filter(g => groupTotal(g) !== 0)
            .sort((a, b) => groupTotal(b) - groupTotal(a));
        const inactive = groupedBankAccounts.filter(g => groupTotal(g) === 0);
        return {
            activeBanks: active,
            inactiveBanks: inactive,
            bankTotal: groupedBankAccounts.reduce((s, g) => s + groupTotal(g), 0),
        };
    }, [groupedBankAccounts]);

    const creditTotal = useMemo(
        () => groupedCreditCards.reduce((s, g) => s + groupTotal(g), 0),
        [groupedCreditCards]
    );
    const savingsTotal = useMemo(
        () => groupedSavings.reduce((s, g) => s + groupTotal(g), 0),
        [groupedSavings]
    );
    const otherTotal = useMemo(
        () => otherSources.reduce((s, o) => s + o.balance, 0),
        [otherSources]
    );

    if (loading) {
        return (
            <div className="space-y-3 mt-8">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 rounded-2xl bg-gray-200 dark:bg-surface animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-5 pt-6">
            {/* Title Bar */}
            <div className="flex justify-between items-end px-1">
                <h2 className="font-bold text-lg text-gray-800 dark:text-white">
                    {activeTab === 'accounts' ? 'Danh sách tài khoản' : activeTab === 'savings' ? 'Sổ tiết kiệm' : 'Tài sản khác'}
                </h2>
                <button onClick={onAddClick} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-900/20 px-2.5 py-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all uppercase tracking-tight">Thêm mới</button>
            </div>

            {/* ════════ TAB: ACCOUNTS ════════ */}
            {activeTab === 'accounts' && groupedCreditCards.length === 0 && groupedBankAccounts.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-6">Chưa có thẻ hoặc tài khoản nào.</p>
            )}

            {activeTab === 'accounts' && groupedCreditCards.length > 0 && (
                <section>
                    <SectionHeader label="Thẻ tín dụng" total={creditTotal} />
                    <div className="space-y-2.5">
                        {groupedCreditCards.map(g => (
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
                    </div>
                </section>
            )}

            {activeTab === 'accounts' && groupedBankAccounts.length > 0 && (
                <section>
                    <SectionHeader label="Tài khoản" total={bankTotal} />
                    <div className="space-y-2.5">
                        {activeBanks.map(g => (
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
                        {inactiveBanks.length > 0 && (
                            <InactiveGroup groups={inactiveBanks} onEdit={onEditSource} onDelete={onDeleteSource} />
                        )}
                    </div>
                </section>
            )}

            {/* ════════ TAB: SAVINGS ════════ */}
            {activeTab === 'savings' && savingsSources.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-6">Chưa có sổ tiết kiệm nào.</p>
            )}
            {activeTab === 'savings' && groupedSavings.length > 0 && (
                <section>
                    <SectionHeader label="Sổ tiết kiệm" total={savingsTotal} />
                    <div className="space-y-2.5">
                        {groupedSavings.map(g => (
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
                    </div>
                </section>
            )}

            {/* ════════ TAB: OTHER ════════ */}
            {activeTab === 'other' && otherSources.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-6">Chưa có tài sản khác.</p>
            )}
            {activeTab === 'other' && otherSources.length > 0 && (
                <section>
                    <SectionHeader label="Tài sản khác" total={otherTotal} />
                    <div className="space-y-2.5">
                        {otherSources.map(s => (
                            <WealthCard key={s._id} source={s}
                                onEdit={() => onEditSource(s)}
                                onDelete={() => onDeleteSource(s)} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

export default memo(WealthTabContentBase);
