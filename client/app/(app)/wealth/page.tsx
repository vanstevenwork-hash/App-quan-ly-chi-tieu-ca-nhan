'use client';
import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useWealth, type WealthSource, type WealthSourceUI } from '@/hooks/useWealth';
import { useCards, type Card } from '@/hooks/useCards';
import WealthSourceModal from '@/components/WealthSourceModal';
import WealthTabContent from '@/components/wealth/WealthTabContent';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import CardFormModal from '@/components/CardFormModal';
import { useBanks } from '@/hooks/useBanks';
import { useEffect } from 'react';
import { E_WALLETS, CRYPTOS } from '@/lib/constants';
import { getBankLogo } from '@/lib/bankLogos';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { ActionIcon } from '@/components/icons/ActionIcon';

const fmtFull = (n: number) => Math.round(n).toLocaleString('vi-VN');

export default function WealthPage() {
    const { sources, total, loading, createSource, updateSource, deleteSource, refetch } = useWealth();
    const { cards, loading: cardsLoading, createCard, updateCard, deleteCard } = useCards();
    const [showModal, setShowModal] = useState(false);
    const [showCardModal, setShowCardModal] = useState(false);
    const [editSource, setEditSource] = useState<WealthSource | null>(null);
    const [editCard, setEditCard] = useState<Card | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<'accounts' | 'savings' | 'other'>('accounts');

    const { banks: fetchedBanks, fetchBanks } = useBanks();

    useEffect(() => {
        fetchBanks();
    }, [fetchBanks]);

    // O(1) bank/e-wallet/crypto lookup by short name — keys uppercased so
    // "CAKE" on the card still hits "Cake" from the API
    const banksByShortName = useMemo(() => {
        const map = new Map<string, { logo?: string }>();
        [...fetchedBanks, ...E_WALLETS, ...CRYPTOS].forEach((b: any) => {
            const key = (b.shortName ?? b.short)?.toUpperCase();
            if (key && !map.has(key)) map.set(key, b);
        });
        return map;
    }, [fetchedBanks]);

    const allSources = useMemo(() => {
        const getFallbackIcon = (type: string) => {
            if (type === 'savings') return <UtilityIcon type="soTietKiem" size={24} tile={false} color="#F0A319" />;
            if (type === 'eWallet') return <UtilityIcon type="eWallet" size={24} tile={false} color="#8B5CF6" />;
            if (type === 'debit') return <UtilityIcon type="theGhiNo" size={24} tile={false} color="#3D7BF0" />;
            if (type === 'credit') return <ActionIcon type="creditCard" size={24} tile={false} color="#6C63FF" />;
            if (type === 'crypto') return <UtilityIcon type="bitcoin" size={24} tile={false} color="#F7931A" />;
            return <UtilityIcon type="landmark" size={24} tile={false} color="#3B82F6" />;
        };

        const cardSources = cards.map(c => {
            const b = banksByShortName.get((c.bankShortName || '').toUpperCase()) as any;
            // API logo first, then the static CDN map — same chain as accounts/cashback
            const logoUrl = b?.logo || getBankLogo(c.bankShortName, c.bankName);
            return {
                _id: c._id,
                name: `${c.bankShortName} ${c.cardNumber ? '••' + c.cardNumber : ''}`.trim(),
                category: c.cardType === 'savings' ? 'savings' : c.cardType === 'credit' ? 'credit' : c.cardType === 'eWallet' ? 'eWallet' : 'bank',
                balance: c.cardType === 'credit' ? -(c.balance || 0) : c.balance,
                icon: logoUrl ? <Image src={logoUrl} width={32} height={32} className="w-8 h-8 object-contain bg-white p-1 rounded-md" alt="logo" /> : getFallbackIcon(c.cardType),
                color: c.bankColor || '#3B82F6',
                note: c.cardType === 'credit' ? 'Thẻ tín dụng' : c.cardType === 'savings' ? 'Sổ tiết kiệm' : 'Tài khoản',
                isExternal: true,
                bankShortName: c.bankShortName,
                cardType: c.cardType
            } as WealthSourceUI;
        });

        // Map sources from useWealth (they might have emoji icons, keep them if so, or use default)
        const mappedSources = sources.map(s => {
            let iconNode: React.ReactNode = s.icon;
            if (s.category === 'crypto') iconNode = <UtilityIcon type="bitcoin" size={24} tile={false} color="#F7931A" />;
            else if (s.category === 'stock') iconNode = <UtilityIcon type="trendingUp" size={24} tile={false} color="#10B981" />;
            else if (s.category === 'real_estate') iconNode = <UtilityIcon type="landmark" size={24} tile={false} color="#3B82F6" />;
            else if (!s.icon || (typeof s.icon === 'string' && s.icon.length > 2)) iconNode = <UtilityIcon type="briefcase" size={24} tile={false} color="#06B6D4" />;

            return { ...s, icon: iconNode } as WealthSourceUI;
        });

        return [...mappedSources, ...cardSources];
    }, [sources, cards, banksByShortName]);

    const combinedTotal = useMemo(() => {
        return allSources.reduce((sum, s) => sum + s.balance, 0);
    }, [allSources]);

    // Group by category for the new tabs
    const creditCardSources = useMemo(
        () => allSources.filter(s => s.category === 'credit'),
        [allSources]
    );
    const bankEwalletSources = useMemo(
        () => allSources.filter(s => ['bank', 'eWallet'].includes(s.category)),
        [allSources]
    );
    const savingsSources = useMemo(
        () => allSources.filter(s => s.category === 'savings'),
        [allSources]
    );
    const otherSources = useMemo(
        () => allSources.filter(s => !['bank', 'credit', 'eWallet', 'savings'].includes(s.category)),
        [allSources]
    );

    // Grouping helper
    const getGroupedItems = (sourceList: WealthSourceUI[], sortAsc = false) => {
        const groups: Record<string, WealthSourceUI[]> = {};
        const standalone: WealthSourceUI[] = [];

        sourceList.forEach(s => {
            if (s.bankShortName && s.cardType) {
                const key = `${s.bankShortName}_${s.cardType}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(s);
            } else {
                standalone.push(s);
            }
        });

        const result: { key: string; isGroup: boolean; title: string; items: WealthSourceUI[]; color: string; icon: React.ReactNode; standaloneItem?: WealthSourceUI; }[] = [];

        Object.entries(groups).forEach(([key, items]) => {
            if (items.length > 1) {
                result.push({
                    key,
                    isGroup: true,
                    title: items[0].bankShortName || 'Unknown Bank',
                    items,
                    color: items[0].color,
                    icon: items[0].icon
                });
            } else {
                result.push({
                    key,
                    isGroup: false,
                    title: items[0].name,
                    items: [items[0]],
                    color: items[0].color,
                    icon: items[0].icon,
                    standaloneItem: items[0]
                });
            }
        });

        standalone.forEach(s => {
            result.push({
                key: s._id,
                isGroup: false,
                title: s.name,
                items: [s],
                color: s.color,
                icon: s.icon,
                standaloneItem: s
            });
        });

        if (sortAsc) {
            result.sort((a, b) => {
                const balA = a.items.reduce((sum, i) => sum + i.balance, 0);
                const balB = b.items.reduce((sum, i) => sum + i.balance, 0);
                return balA - balB;
            });
        }

        return result;
    };

    const groupedCreditCards = useMemo(() => getGroupedItems(creditCardSources, true), [creditCardSources]);
    const groupedBankAccounts = useMemo(() => getGroupedItems(bankEwalletSources, true), [bankEwalletSources]);
    const groupedSavings = useMemo(() => getGroupedItems(savingsSources), [savingsSources]);

    // Group by category (for statistics)
    const byCategory = useMemo(() => {
        const map: Record<string, WealthSourceUI[]> = {};
        allSources.forEach(s => {
            if (!map[s.category]) map[s.category] = [];
            map[s.category].push(s);
        });
        return map;
    }, [allSources]);

    const handleSave = async (data: Parameters<typeof createSource>[0]) => {
        if (editSource) {
            await updateSource(editSource._id, data);
            toast.success('Đã cập nhật tài sản');
        } else {
            await createSource(data);
            toast.success('Đã thêm nguồn tài sản mới!');
        }
        setEditSource(null);
    };

    const handleSaveCard = async (data: Parameters<typeof createCard>[0]) => {
        if (editCard) {
            await updateCard(editCard._id, data);
            toast.success('Đã cập nhật thẻ/tài khoản');
        } else {
            await createCard(data);
            toast.success('Đã thêm thẻ/tài khoản mới!');
        }
        setShowCardModal(false);
        setEditCard(null);
    };

    const handleDelete = useCallback(async (source: WealthSourceUI) => {
        if (!confirm(`Xoá "${source.name}"?`)) return;
        if (source.isExternal) {
            await deleteCard(source._id);
            toast.success('Đã xoá thẻ/tài khoản');
        } else {
            await deleteSource(source._id);
            toast.success('Đã xoá tài sản');
        }
    }, [deleteCard, deleteSource]);

    const handleEditSource = useCallback((s: WealthSourceUI) => {
        if (s.isExternal) {
            const card = cards.find(c => c._id === s._id);
            if (card) { setEditCard(card); setShowCardModal(true); }
        } else {
            setEditSource(s as unknown as WealthSource);
            setShowModal(true);
        }
    }, [cards]);

    const handleAddClick = useCallback(() => {
        if (activeTab === 'other') {
            setEditSource(null);
            setShowModal(true);
        } else {
            setShowCardModal(true);
        }
    }, [activeTab]);

    return (
        <div className="min-h-screen pb-32 bg-[#F8F9FF] dark:bg-surface-deep transition-colors duration-200">
            {/* Soft top gradient blob — decorative only, matches the other pages' flat-page + floating-card style */}
            <div className="fixed top-0 left-0 w-full h-72 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(196,181,253,0.35), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-72 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(139,92,246,0.12), transparent)' }} />

            <div className="relative z-10">
                <PageHeader
                    title="Tài sản ròng"
                    subtitle="Quản lý"
                    rightActions={
                        <button onClick={refetch}
                            className="w-10 h-10 rounded-full bg-white dark:bg-surface border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 active:scale-95 transition-all flex-shrink-0">
                            <ActionIcon type="refreshCw" size={16} tile={false} color="currentColor" />
                        </button>
                    }
                />

                <div className="px-5 pt-2 space-y-5">
                    {/* ── Hero: floating net-worth card ─────────────────── */}
                    <div className="rounded-[20px] p-5 shadow-[0_4px_20px_-2px_rgba(139,92,246,0.12)] dark:shadow-xl bg-gradient-to-br from-white to-[#F5F0FF] dark:from-[#211B3D] dark:to-[#1A1730] border border-[#E9D5FF] dark:border-slate-700/50">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                            <p className="text-slate-500 dark:text-slate-300 text-sm font-medium">Tổng tài sản ròng</p>
                            <button onClick={() => setIsVisible(!isVisible)} className="text-slate-400 hover:text-purple-500 dark:hover:text-white transition-colors">
                                {isVisible ? <ActionIcon type="eye" size={16} tile={false} color="#94A3B8" /> : <ActionIcon type="eyeOff" size={16} tile={false} color="#94A3B8" />}
                            </button>
                        </div>
                        <p className="text-slate-800 dark:text-white text-[30px] font-bold tracking-tight leading-none text-money">
                            {isVisible ? `${fmtFull(combinedTotal)}đ` : '*******'}
                        </p>
                        <div className="inline-flex items-center gap-1.5 mt-4 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                            <UtilityIcon type="trendingUp" size={14} tile={false} color="#10B981" />
                            <span>{Object.keys(byCategory).length} danh mục quản lý</span>
                        </div>
                    </div>

                    {/* ── Segmented tabs ─────────────────────────────────── */}
                    <div className="bg-slate-100 dark:bg-surface p-1 rounded-xl flex gap-1 border border-transparent dark:border-slate-800/60">
                        <button onClick={() => setActiveTab('accounts')}
                            className={cn("flex-1 py-2.5 rounded-lg text-xs font-bold transition-all",
                                activeTab === 'accounts' ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}>
                            Tài khoản
                        </button>
                        <button onClick={() => setActiveTab('savings')}
                            className={cn("flex-1 py-2.5 rounded-lg text-xs font-bold transition-all",
                                activeTab === 'savings' ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}>
                            Tiết kiệm
                        </button>
                        <button onClick={() => setActiveTab('other')}
                            className={cn("flex-1 py-2.5 rounded-lg text-xs font-bold transition-all",
                                activeTab === 'other' ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}>
                            Khác
                        </button>
                    </div>

                    {/* Content Area */}
                    <WealthTabContent
                        loading={loading || cardsLoading}
                        activeTab={activeTab}
                        savingsSources={savingsSources}
                        otherSources={otherSources}
                        groupedCreditCards={groupedCreditCards}
                        groupedBankAccounts={groupedBankAccounts}
                        groupedSavings={groupedSavings}
                        onAddClick={handleAddClick}
                        onEditSource={handleEditSource}
                        onDeleteSource={handleDelete}
                    />
                </div>
            </div>

            {/* Modal */}
            <WealthSourceModal
                open={showModal}
                onClose={() => { setShowModal(false); setEditSource(null); }}
                onSave={handleSave}
                editSource={editSource}
            />

            <CardFormModal
                open={showCardModal}
                onClose={() => { setShowCardModal(false); setEditCard(null); }}
                onSave={handleSaveCard}
                editCard={editCard}
                initialType={activeTab === 'savings' ? 'savings' : 'debit'}
            />


        </div>
    );
}
