'use client';
import { memo, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { WealthSourceUI } from '@/hooks/useWealth';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { UtilityIcon } from '@/components/icons/UtilityIcon';

const fmtFull = (n: number) => Math.round(n).toLocaleString('vi-VN');

// Unsigned short amount for limit captions: "150tr" · "54tr" · "113tr"
const fmtLimit = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}tỷ`;
    if (abs >= 1_000_000) return `${Math.round(abs / 1_000_000)}tr`;
    if (abs >= 1_000) return `${Math.round(abs / 1_000)}k`;
    return `${Math.round(abs)}`;
};

// Debt-vs-limit utilisation → bar/text colour (higher reads hotter).
const usageColor = (pct: number) => (pct >= 80 ? '#EF4444' : pct >= 50 ? '#F59E0B' : '#6366F1');

// Pooled ("hạn mức chung", max limit across the group) vs plain multi-card
// ("tổng", sum of limits). Credit balances are stored negative, so debt = |sum|.
function creditGroupStats(items: WealthSourceUI[]) {
    const isShared = items.some(i => i.sharedLimit);
    const limit = isShared
        ? Math.max(...items.map(i => i.effectiveCreditLimit ?? i.creditLimit ?? 0))
        : items.reduce((s, i) => s + (i.creditLimit || 0), 0);
    const debt = items.reduce((s, i) => s + Math.abs(i.balance), 0);
    return { isShared, limit, debt };
}

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

/** Bank logo at a chosen size — clean logo on white, falling back to a solid
 *  colour chip with the bank code. No border ring (matches the cashback page). */
function BankTile({ logoUrl, text, color, size }: { logoUrl?: string; text: string; color: string; size: number }) {
    const [err, setErr] = useState(false);
    const radius = size >= 40 ? 'rounded-2xl' : 'rounded-xl';
    if (logoUrl && !err) {
        return (
            <img src={logoUrl} alt="" onError={() => setErr(true)} style={{ width: size, height: size }}
                className={cn(radius, 'object-contain bg-white p-1 shrink-0')} />
        );
    }
    return (
        <div style={{ width: size, height: size, backgroundColor: color }}
            className={cn(radius, 'flex items-center justify-center shrink-0 font-black text-white')}>
            <span style={{ fontSize: Math.round(size * 0.28) }}>{(text || '?').slice(0, 3).toUpperCase()}</span>
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
        : (source.note || label);

    const isCard = !!source.bankShortName;
    const isCredit = source.cardType === 'credit';
    const limit = source.creditLimit || 0;
    const pct = limit > 0 ? Math.min((Math.abs(source.balance) / limit) * 100, 100) : 0;
    const barColor = usageColor(pct);

    return (
        <div className={cn(
            'group relative flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-800 shadow-sm hover:border-purple-200 dark:hover:border-purple-500/40 transition-all',
            className
        )}>
            {isCard
                ? <BankTile logoUrl={source.logoUrl} text={source.bankShortName!} color={source.color} size={42} />
                : <LogoTile icon={source.icon} color={source.color} />}
            <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 dark:text-white text-[15px] truncate">
                    {isCard ? (
                        <>{source.bankShortName}{source.cardNumber && <span className="text-slate-400 dark:text-slate-500 font-semibold"> •••• {source.cardNumber}</span>}</>
                    ) : source.name}
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>
            </div>

            {/* Amount (+ credit bar) at rest; edit/delete cross-fade in on hover */}
            <div className="relative flex flex-col items-end justify-center min-w-[112px] flex-shrink-0 self-stretch">
                <div className="w-full text-right transition-opacity duration-300 group-hover:opacity-0">
                    <AmountCell value={source.balance} />
                    {isCredit && limit > 0 && (
                        <div className="mt-1.5 w-32 ml-auto">
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                            </div>
                            <p className="text-[11px] font-bold mt-1 whitespace-nowrap" style={{ color: barColor }}>
                                {pct.toFixed(0)}% <span className="text-slate-400 font-medium">· hạn mức {fmtLimit(limit)}</span>
                            </p>
                        </div>
                    )}
                </div>
                <div className="absolute inset-0 flex items-center justify-end gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors shadow-sm">
                        <ActionIcon type="pencil" size={16} tile={false} color="#8B5CF6" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-sm">
                        <ActionIcon type="trash" size={16} tile={false} color="#EF4444" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// A member row inside a group's recessed panel. Drops the bank name (the parent
// already shows it) → "•••• 3652 · Max"; smaller tile/text than the parent.
function ChildRow({ source, bankShort, credit, isFirst, onEdit, onDelete }: {
    source: WealthSourceUI; bankShort: string; credit: { isShared: boolean; limit: number } | null;
    isFirst: boolean; onEdit: () => void; onDelete: () => void;
}) {
    const suffix = source.cardLabel && source.cardLabel !== bankShort ? ` · ${source.cardLabel}` : '';
    const isCredit = source.cardType === 'credit';
    const limit = credit?.isShared ? credit.limit : (source.creditLimit || 0);
    const pct = limit > 0 ? Math.min((Math.abs(source.balance) / limit) * 100, 100) : 0;
    const barColor = usageColor(pct);

    return (
        <div className={cn('group/c relative flex items-center gap-3 pl-4 pr-3 py-2.5', !isFirst && 'border-t border-slate-200/70 dark:border-white/5')}>
            <BankTile logoUrl={source.logoUrl} text={source.bankShortName || bankShort} color={source.color} size={30} />
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">
                    •••• {source.cardNumber}<span className="text-slate-400 dark:text-slate-400 font-semibold">{suffix}</span>
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{source.note}</p>
            </div>
            <div className="relative flex flex-col items-end justify-center min-w-[100px] flex-shrink-0 self-stretch">
                <div className="w-full text-right transition-opacity duration-300 group-hover/c:opacity-0">
                    <span className={cn('text-[13px] font-black tracking-tight tabular-nums',
                        source.balance < 0 ? 'text-red-500 dark:text-red-400' : source.balance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>
                        {fmtFull(source.balance)}
                    </span>
                    {isCredit && limit > 0 && (
                        <div className="mt-1 w-24 ml-auto">
                            <div className="h-1 rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                            </div>
                            <p className="text-[10px] font-bold mt-0.5 whitespace-nowrap" style={{ color: barColor }}>
                                {pct.toFixed(0)}% <span className="text-slate-400 font-medium">· hạn mức</span>
                            </p>
                        </div>
                    )}
                </div>
                <div className="absolute inset-0 flex items-center justify-end gap-1.5 opacity-0 transition-opacity duration-300 group-hover/c:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                        <ActionIcon type="pencil" size={14} tile={false} color="#8B5CF6" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                        <ActionIcon type="trash" size={14} tile={false} color="#EF4444" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function GroupedWealthCard({ title, color, items, onEdit, onDelete }: {
    title: string; icon?: React.ReactNode; color: string; items: WealthSourceUI[];
    onEdit: (s: WealthSourceUI) => void; onDelete: (s: WealthSourceUI) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (items.length === 1) {
        return <WealthCard source={items[0]} onEdit={() => onEdit(items[0])} onDelete={() => onDelete(items[0])} />;
    }

    const totalBalance = items.reduce((sum, item) => sum + item.balance, 0);
    const cardType = items[0].cardType;
    const unit = cardType === 'credit' ? 'thẻ' : cardType === 'savings' ? 'sổ' : 'mục';
    const subtitle = cardType === 'credit' ? 'Nhóm thẻ tín dụng'
        : cardType === 'savings' ? 'Nhóm sổ tiết kiệm' : 'Nhóm tài khoản';
    const logoUrl = items[0].logoUrl;
    const isCredit = cardType === 'credit';
    const credit = isCredit ? creditGroupStats(items) : null;
    const pct = credit && credit.limit > 0 ? Math.min((credit.debt / credit.limit) * 100, 100) : 0;
    const barColor = usageColor(pct);

    return (
        <div className={cn(
            'rounded-2xl bg-white dark:bg-surface border shadow-sm overflow-hidden transition-all',
            isExpanded ? 'border-purple-200 dark:border-purple-500/40' : 'border-gray-100 dark:border-slate-800'
        )}>
            {/* Whole row is the toggle; the ▾ lives inside the chip next to the title */}
            <button onClick={() => setIsExpanded(v => !v)} className="w-full text-left flex items-center gap-3.5 p-3.5">
                <BankTile logoUrl={logoUrl} text={title} color={color} size={42} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <h4 className="font-bold text-slate-800 dark:text-white text-[15px] truncate">{title}</h4>
                        <GroupChip count={items.length} unit={unit} expanded={isExpanded} />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
                </div>
                <div className="text-right flex-shrink-0">
                    <AmountCell value={totalBalance} />
                    {credit && credit.limit > 0 && (
                        <div className="mt-1.5 w-32 ml-auto">
                            {credit.isShared ? (
                                <div className="flex gap-0.5 h-1.5">
                                    {items.map(i => {
                                        const w = credit.limit > 0 ? (Math.abs(i.balance) / credit.limit) * 100 : 0;
                                        return <div key={i._id} className="h-full rounded-full flex-shrink-0" style={{ width: `${w}%`, backgroundColor: barColor, minWidth: Math.abs(i.balance) > 0 ? 3 : 0 }} />;
                                    })}
                                    <div className="h-full rounded-full bg-slate-100 dark:bg-white/10 flex-1" />
                                </div>
                            ) : (
                                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                                </div>
                            )}
                            <p className="text-[11px] font-bold mt-1 whitespace-nowrap" style={{ color: barColor }}>
                                {pct.toFixed(0)}% <span className="text-slate-400 font-medium">· hạn mức {fmtLimit(credit.limit)}</span>
                            </p>
                        </div>
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="px-2.5 pb-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Recessed panel — members tucked into the parent, purple rail down the left */}
                    <div className="relative rounded-xl bg-slate-50 dark:bg-black/25 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)]">
                        <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-purple-500 via-purple-500/40 to-transparent" />
                        {items.map((s, i) => (
                            <ChildRow key={s._id} source={s} bankShort={title} credit={credit} isFirst={i === 0}
                                onEdit={() => onEdit(s)} onDelete={() => onDelete(s)} />
                        ))}
                    </div>
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
        <div className="space-y-5 pt-2">
            {/* Title Bar */}
            <div className="flex justify-between items-end px-1">
                <h2 className="font-bold text-lg text-gray-800 dark:text-white">
                    {activeTab === 'accounts' ? 'Danh sách tài khoản' : activeTab === 'savings' ? 'Sổ tiết kiệm' : 'Tài sản khác'}
                </h2>
                <button onClick={onAddClick} aria-label="Thêm mới"
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all">
                    <ActionIcon type="plus" size={14} tile={false} color="currentColor" />
                </button>
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
