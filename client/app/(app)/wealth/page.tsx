'use client';
import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, TrendingUp, RefreshCw, Wallet, CreditCard, Landmark, PiggyBank, Smartphone, Bitcoin, Briefcase, Calendar, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWealth, type WealthSource } from '@/hooks/useWealth';
import { useCards } from '@/hooks/useCards';

export type WealthSourceUI = Omit<WealthSource, 'icon'> & { icon: React.ReactNode; isExternal?: boolean; };
import WealthSourceModal from '@/components/WealthSourceModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import CardFormModal from '@/components/CardFormModal';
import { useBanks } from '@/hooks/useBanks';
import { useEffect } from 'react';

const fmtFull = (n: number) => Math.round(n).toLocaleString('vi-VN');
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

const CATEGORY_LABELS: Record<string, string> = {
    savings: 'Tiết kiệm', gold: 'Vàng bạc', crypto: 'Crypto',
    cashback: 'Hoàn tiền', affiliate: 'Affiliate', stock: 'Cổ phiếu',
    real_estate: 'Bất động sản', other: 'Khác',
    credit: 'Thẻ tín dụng', bank: 'Tài khoản ngân hàng', eWallet: 'Ví điện tử'
};

function WealthCard({ source, onEdit, onDelete }: {
    source: WealthSourceUI; onEdit: () => void; onDelete: () => void;
}) {
    return (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.03)] rounded-2xl p-4 flex items-center justify-between group hover:border-purple-200 dark:hover:border-purple-500/50 transition-colors cursor-pointer relative" onClick={onEdit}>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${source.color}15`, border: `1px solid ${source.color}30`, color: source.color }}>
                    {typeof source.icon === 'string' && source.icon.length <= 2 ? (
                        <span className="text-2xl">{source.icon}</span>
                    ) : (
                        source.icon
                    )}
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">{source.name}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{CATEGORY_LABELS[source.category] || 'Khác'}</span>
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="font-bold text-slate-800 dark:text-white text-base">{fmtFull(source.balance)}đ</div>
                {source.note && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[100px]">{source.note}</div>}
            </div>
            {!source.isExternal && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute -top-2 -right-2 w-7 h-7 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

export default function WealthPage() {
    const router = useRouter();
    const { sources, total, loading, createSource, updateSource, deleteSource, refetch } = useWealth();
    const { cards, loading: cardsLoading } = useCards();
    const [showModal, setShowModal] = useState(false);
    const [showCardModal, setShowCardModal] = useState(false);
    const [editSource, setEditSource] = useState<WealthSource | null>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [activeTab, setActiveTab] = useState<'accounts' | 'savings' | 'other'>('accounts');

    const { banks: fetchedBanks, fetchBanks } = useBanks();

    useEffect(() => {
        fetchBanks();
    }, [fetchBanks]);

    const E_WALLETS = [
        { name: 'MoMo', short: 'MoMo', color: '#A21CAF', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-MoMo-Transparent.png' },
        { name: 'ZaloPay', short: 'ZLP', color: '#0284C7', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-ZaloPay-Square.png' },
        { name: 'Khác', short: '???', color: '#6C63FF', logo: '' },
    ];

    const CRYPTOS = [
        { name: 'Binance', short: 'BNB', color: '#F0B90B', logo: '' },
        { name: 'OKX', short: 'OKX', color: '#1C1C1E', logo: '' },
        { name: 'Bybit', short: 'BBT', color: '#F7A600', logo: '' },
    ];

    const allSources = useMemo(() => {
        const getFallbackIcon = (type: string) => {
            if (type === 'savings') return <PiggyBank className="w-6 h-6" />;
            if (type === 'eWallet') return <Smartphone className="w-6 h-6" />;
            if (type === 'credit' || type === 'debit') return <CreditCard className="w-6 h-6" />;
            if (type === 'crypto') return <Bitcoin className="w-6 h-6" />;
            return <Landmark className="w-6 h-6" />;
        };

        const cardSources = cards.map(c => {
            const b = fetchedBanks.find(x => x.shortName === c.bankShortName) || E_WALLETS.find(x => x.short === c.bankShortName) || CRYPTOS.find(x => x.short === c.bankShortName) as any;
            return {
                _id: c._id,
                name: `${c.bankShortName} ${c.cardNumber ? '••' + c.cardNumber : ''}`.trim(),
                category: c.cardType === 'savings' ? 'savings' : c.cardType === 'credit' ? 'credit' : c.cardType === 'eWallet' ? 'eWallet' : 'bank',
                balance: c.cardType === 'credit' ? -(c.balance || c.creditLimit || 0) : c.balance,
                icon: b?.logo ? <img src={b.logo} className="w-8 h-8 object-contain bg-white p-1 rounded-md" alt="logo" /> : getFallbackIcon(c.cardType),
                color: c.bankColor || '#3B82F6',
                note: c.cardType === 'credit' ? 'Thẻ tín dụng' : c.cardType === 'savings' ? 'Sổ tiết kiệm' : 'Tài khoản',
                isExternal: true
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
    }, [sources, cards, fetchedBanks]);

    const combinedTotal = useMemo(() => {
        return allSources.reduce((sum, s) => sum + s.balance, 0);
    }, [allSources]);

    // Group by category for the new tabs
    const accountSources = allSources.filter(s => ['bank', 'credit', 'eWallet'].includes(s.category));
    const savingsSources = allSources.filter(s => s.category === 'savings');
    const otherSources = allSources.filter(s => !['bank', 'credit', 'eWallet', 'savings'].includes(s.category));

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

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Xoá "${name}"?`)) return;
        await deleteSource(id);
        toast.success('Đã xoá');
    };

    const handleAddClick = () => {
        if (activeTab === 'other') {
            setEditSource(null);
            setShowModal(true);
        } else {
            setShowCardModal(true);
        }
    };

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header Gradient */}
            <div className="pt-12 pb-6 px-6 rounded-b-[2.5rem] relative z-10 shadow-sm transition-colors duration-200"
                style={{
                    background: 'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)',
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
                {(loading || cardsLoading) ? (
                    <div className="space-y-3 mt-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4 pt-6">
                        {/* Title Bar */}
                        <div className="flex justify-between items-end px-1">
                            <h2 className="font-bold text-lg text-gray-800 dark:text-white">
                                {activeTab === 'accounts' ? 'Danh sách tài khoản' : activeTab === 'savings' ? 'Sổ tiết kiệm' : 'Tài sản khác'}
                            </h2>
                            <button onClick={handleAddClick} className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400 hover:bg-purple-200 transition-colors">
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>

                        {/* List rendering */}
                        <div className="space-y-3">
                            {activeTab === 'accounts' && accountSources.length === 0 && (
                                <p className="text-slate-500 text-sm text-center py-6">Chưa có thẻ hoặc tài khoản nào.</p>
                            )}
                            {activeTab === 'accounts' && accountSources.map(s => (
                                <WealthCard key={s._id} source={s}
                                    onEdit={() => { if (!s.isExternal) { setEditSource(s as unknown as WealthSource); setShowModal(true); } }}
                                    onDelete={() => handleDelete(s._id, s.name)} />
                            ))}

                            {activeTab === 'savings' && savingsSources.length === 0 && (
                                <p className="text-slate-500 text-sm text-center py-6">Chưa có sổ tiết kiệm nào.</p>
                            )}
                            {activeTab === 'savings' && savingsSources.map(s => (
                                <WealthCard key={s._id} source={s}
                                    onEdit={() => { if (!s.isExternal) { setEditSource(s as unknown as WealthSource); setShowModal(true); } }}
                                    onDelete={() => handleDelete(s._id, s.name)} />
                            ))}

                            {activeTab === 'other' && otherSources.length === 0 && (
                                <p className="text-slate-500 text-sm text-center py-6">Chưa có tài sản khác.</p>
                            )}
                            {activeTab === 'other' && otherSources.map(s => (
                                <WealthCard key={s._id} source={s}
                                    onEdit={() => { setEditSource(s as unknown as WealthSource); setShowModal(true); }}
                                    onDelete={() => handleDelete(s._id, s.name)} />
                            ))}
                        </div>
                    </div>
                )}
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
                onClose={() => setShowCardModal(false)}
                onSave={refetch}
                initialType={activeTab === 'savings' ? 'savings' : 'debit'}
            />


        </div>
    );
}
