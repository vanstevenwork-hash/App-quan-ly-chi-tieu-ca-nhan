'use client';
import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, TrendingUp, RefreshCw, CreditCard, Landmark, PiggyBank, Smartphone, Bitcoin, Briefcase, Calendar, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useWealth, type WealthSource, type WealthSourceUI } from '@/hooks/useWealth';
import { useCards, type Card } from '@/hooks/useCards';
import WealthSourceModal from '@/components/WealthSourceModal';
import WealthTabContent from '@/components/wealth/WealthTabContent';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import CardFormModal from '@/components/CardFormModal';
import { useBanks } from '@/hooks/useBanks';
import { useEffect } from 'react';
import { E_WALLETS, CRYPTOS } from '@/lib/constants';

const fmtFull = (n: number) => Math.round(n).toLocaleString('vi-VN');

export default function WealthPage() {
    const router = useRouter();
    const { sources, total, loading, createSource, updateSource, deleteSource, refetch } = useWealth();
    const { cards, loading: cardsLoading, deleteCard } = useCards();
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

    // O(1) bank/e-wallet/crypto lookup by short name, instead of 3 chained .find() per card
    const banksByShortName = useMemo(() => {
        const map = new Map<string, { logo?: string }>();
        [...fetchedBanks, ...E_WALLETS, ...CRYPTOS].forEach((b: any) => {
            const key = b.shortName ?? b.short;
            if (key && !map.has(key)) map.set(key, b);
        });
        return map;
    }, [fetchedBanks]);

    const allSources = useMemo(() => {
        const getFallbackIcon = (type: string) => {
            if (type === 'savings') return <PiggyBank className="w-6 h-6" />;
            if (type === 'eWallet') return <Smartphone className="w-6 h-6" />;
            if (type === 'credit' || type === 'debit') return <CreditCard className="w-6 h-6" />;
            if (type === 'crypto') return <Bitcoin className="w-6 h-6" />;
            return <Landmark className="w-6 h-6" />;
        };

        const cardSources = cards.map(c => {
            const b = banksByShortName.get(c.bankShortName) as any;
            return {
                _id: c._id,
                name: `${c.bankShortName} ${c.cardNumber ? '••' + c.cardNumber : ''}`.trim(),
                category: c.cardType === 'savings' ? 'savings' : c.cardType === 'credit' ? 'credit' : c.cardType === 'eWallet' ? 'eWallet' : 'bank',
                balance: c.cardType === 'credit' ? -(c.balance || 0) : c.balance,
                icon: b?.logo ? <Image src={b.logo} width={32} height={32} className="w-8 h-8 object-contain bg-white p-1 rounded-md" alt="logo" /> : getFallbackIcon(c.cardType),
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
            if (s.category === 'crypto') iconNode = <Bitcoin className="w-6 h-6" />;
            else if (s.category === 'stock') iconNode = <TrendingUp className="w-6 h-6" />;
            else if (s.category === 'real_estate') iconNode = <Landmark className="w-6 h-6" />;
            else if (!s.icon || (typeof s.icon === 'string' && s.icon.length > 2)) iconNode = <Briefcase className="w-6 h-6" />;

            return { ...s, icon: iconNode } as WealthSourceUI;
        });

        return [...mappedSources, ...cardSources];
    }, [sources, cards, banksByShortName]);

    const combinedTotal = useMemo(() => {
        return allSources.reduce((sum, s) => sum + s.balance, 0);
    }, [allSources]);

    // Group by category for the new tabs
    const accountSources = useMemo(
        () => allSources.filter(s => ['bank', 'credit', 'eWallet'].includes(s.category)),
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
    const getGroupedItems = (sourceList: WealthSourceUI[]) => {
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

        return result;
    };

    const groupedAccounts = useMemo(() => getGroupedItems(accountSources), [accountSources]);
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
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header Gradient */}
            <div className="pb-6 px-6 rounded-b-[2.5rem] relative z-10 shadow-sm transition-colors duration-200"
                style={{
                    background: 'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)',
                    paddingTop: 'calc(env(safe-area-inset-top) + 1rem)',
                }}
            // We use a CSS class to override the background in dark mode. 
            // We'll add this rule to globals.css or handle via a style wrapper
            >
                {/* Embedded style for dark mode override */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .dark .wealth-header {
                        background: linear-gradient(135deg, #4c1d95 0%, #1e3a8a 100%) !important;
                    }
                `}} />
                <div className="wealth-header absolute inset-0 rounded-b-[2.5rem] -z-10"
                    style={{ background: 'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)' }} />

                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => router.push('/dashboard')}
                        className="p-2 rounded-full bg-white/20 dark:bg-black/20 backdrop-blur-md text-gray-800 dark:text-white hover:bg-white/30 transition">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5 bg-white/20 dark:bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                        <Calendar className="w-4 h-4" />
                        Hôm nay, {new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' })}
                    </div>
                    <button onClick={refetch}
                        className="p-2 rounded-full bg-white/20 dark:bg-black/20 backdrop-blur-md text-gray-800 dark:text-white relative hover:bg-white/30 transition">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                <div className="text-center mb-6">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Tổng tài sản ròng</p>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                            {isVisible ? fmtFull(combinedTotal) : '*********'}
                        </h1>
                        <span className="text-lg text-gray-600 dark:text-gray-300 font-medium align-top">đ</span>
                        <button onClick={() => setIsVisible(!isVisible)} className="text-gray-600 dark:text-gray-300 ml-1 hover:text-gray-800 dark:hover:text-white transition-colors">
                            {isVisible ? <Eye className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
                        </button>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-green-700 dark:text-green-400 text-sm font-medium bg-white/40 dark:bg-black/20 backdrop-blur-sm inline-flex px-3 py-1 rounded-lg mx-auto">
                        <TrendingUp className="w-4 h-4" />
                        <span>+{Object.keys(byCategory).length} danh mục quản lý</span>
                    </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 p-1.5 rounded-2xl flex relative backdrop-blur-md gap-1">
                    <button onClick={() => setActiveTab('accounts')}
                        className={cn("flex-1 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all",
                            activeTab === 'accounts' ? "bg-white dark:bg-gray-700 text-[#8B5CF6] dark:text-purple-400" : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200")}>
                        Tài khoản
                    </button>
                    <button onClick={() => setActiveTab('savings')}
                        className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'savings' ? "bg-white dark:bg-gray-700 text-[#8B5CF6] dark:text-purple-400 shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200")}>
                        Tiết kiệm
                    </button>
                    <button onClick={() => setActiveTab('other')}
                        className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'other' ? "bg-white dark:bg-gray-700 text-[#8B5CF6] dark:text-purple-400 shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200")}>
                        Khác
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-4 relative z-20 space-y-5">
                {/* Content Area */}
                <WealthTabContent
                    loading={loading || cardsLoading}
                    activeTab={activeTab}
                    accountSources={accountSources}
                    savingsSources={savingsSources}
                    otherSources={otherSources}
                    groupedAccounts={groupedAccounts}
                    groupedSavings={groupedSavings}
                    onAddClick={handleAddClick}
                    onEditSource={handleEditSource}
                    onDeleteSource={handleDelete}
                />
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
                onSave={async () => { await refetch(); setShowCardModal(false); }}
                editCard={editCard}
                initialType={activeTab === 'savings' ? 'savings' : 'debit'}
            />


        </div>
    );
}
