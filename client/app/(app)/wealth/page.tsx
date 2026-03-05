'use client';
import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, TrendingUp, Wallet, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWealth, type WealthSource } from '@/hooks/useWealth';
import { useCards } from '@/hooks/useCards';
import WealthSourceModal from '@/components/WealthSourceModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
    source: WealthSource; onEdit: () => void; onDelete: () => void;
}) {
    return (
        <div className="bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] rounded-2xl p-4 flex items-center justify-between group hover:border-purple-200 transition-colors cursor-pointer relative" onClick={onEdit}>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${source.color}15`, border: `1px solid ${source.color}30`, color: source.color }}>
                    {source.icon}
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 text-sm">{source.name}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-slate-500 font-medium">{CATEGORY_LABELS[source.category] || 'Khác'}</span>
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="font-bold text-slate-800 text-base">{fmtFull(source.balance)}đ</div>
                {source.note && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[100px]">{source.note}</div>}
            </div>
            {!(source as any).isExternal && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute -top-2 -right-2 w-7 h-7 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm">
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
    const [editSource, setEditSource] = useState<WealthSource | null>(null);
    const [isVisible, setIsVisible] = useState(true);

    const allSources = useMemo(() => {
        const cardSources = cards.map(c => ({
            _id: c._id,
            name: `${c.bankShortName} ${c.cardNumber ? '••' + c.cardNumber : ''}`.trim(),
            category: c.cardType === 'savings' ? 'savings' : c.cardType === 'credit' ? 'credit' : c.cardType === 'eWallet' ? 'eWallet' : 'bank',
            balance: c.cardType === 'credit' ? -(c.balance || c.creditLimit || 0) : c.balance,
            icon: c.cardType === 'savings' ? '🏦' : c.cardType === 'eWallet' ? '📱' : '💳',
            color: c.bankColor || '#3B82F6',
            note: c.cardType === 'credit' ? 'Thẻ tín dụng' : c.cardType === 'savings' ? 'Sổ tiết kiệm' : 'Tài khoản',
            isExternal: true
        } as unknown as WealthSource));
        return [...sources, ...cardSources];
    }, [sources, cards]);

    const combinedTotal = useMemo(() => {
        return allSources.reduce((sum, s) => sum + s.balance, 0);
    }, [allSources]);

    // Group by category
    const byCategory = useMemo(() => {
        const map: Record<string, WealthSource[]> = {};
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

    return (
        <div className="min-h-screen pb-32" style={{ backgroundColor: '#F8F9FF' }}>
            {/* Background */}
            <div className="fixed top-0 left-0 w-full h-80 pointer-events-none z-0"
                style={{ background: 'linear-gradient(to bottom, rgba(167,139,250,0.18), transparent)' }} />

            <div className="relative z-10">
                {/* Header */}
                <header className="pt-14 px-5 pb-4 flex items-center gap-4">
                    <button onClick={() => router.push('/dashboard')}
                        className="w-10 h-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-slate-600 hover:bg-gray-50 active:scale-95 transition-all flex-shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <p className="text-xs text-slate-400 font-medium">Tài chính</p>
                        <h1 className="text-xl font-bold text-slate-900">Tổng quan tài sản 💼</h1>
                    </div>
                    <button onClick={refetch}
                        className="w-10 h-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-slate-600 hover:bg-gray-50 active:scale-95 transition-all">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </header>

                {/* Hero total */}
                <div className="mx-6 mb-6 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)', border: '1px solid #E9D5FF' }}>
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-200/40 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />

                    <div className="text-center relative z-10">
                        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Tổng tài sản</p>
                        <div className="flex items-center justify-center gap-3">
                            <h2 className="text-4xl font-bold text-slate-800 tracking-tight leading-none">
                                {isVisible ? fmtFull(combinedTotal) : '*********'}
                            </h2>
                            <span className="text-xl align-top text-slate-500 font-medium">đ</span>
                            <button onClick={() => setIsVisible(!isVisible)} className="text-slate-400 w-8 h-8 hover:text-purple-600 transition-colors focus:outline-none p-1 flex items-center justify-center rounded-full hover:bg-purple-50">
                                <span className="material-symbols-outlined text-[22px]" style={{ fontFamily: 'Material Symbols Outlined' }}>
                                    {isVisible ? 'visibility' : 'visibility_off'}
                                </span>
                            </button>
                        </div>
                        <div className="mt-4 inline-flex items-center px-4 py-1.5 bg-white rounded-full border border-purple-100 shadow-sm">
                            <TrendingUp className="w-3.5 h-3.5 text-green-500 mr-1" />
                            <span className="text-xs font-bold text-slate-600">+{Object.keys(byCategory).length} danh mục <span className="text-slate-400 font-normal">đang quản lý</span></span>
                        </div>
                    </div>
                </div>

                {/* Empty state */}
                {!(loading || cardsLoading) && allSources.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-purple-50 flex items-center justify-center text-4xl">💼</div>
                        <div>
                            <p className="text-slate-700 font-bold text-base">Chưa có nguồn tài sản nào</p>
                            <p className="text-slate-400 text-sm mt-1">Thêm vàng, crypto, tiết kiệm... để theo dõi tổng tài sản</p>
                        </div>
                        <button onClick={() => { setEditSource(null); setShowModal(true); }}
                            className="px-6 py-3 rounded-2xl text-white font-bold text-sm"
                            style={{ background: 'linear-gradient(135deg, #A78BFA, #6C63FF)' }}>
                            + Thêm nguồn đầu tiên
                        </button>
                    </div>
                )}

                {/* Loading skeleton */}
                {(loading || cardsLoading) && (
                    <div className="px-5 space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-28 rounded-3xl bg-gray-100 animate-pulse" />
                        ))}
                    </div>
                )}

                {/* Sources list */}
                {!(loading || cardsLoading) && allSources.length > 0 && (
                    <div className="px-6 space-y-6">
                        <section>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Chi tiết tài sản</h3>
                            <div className="space-y-3">
                                {allSources.map(s => (
                                    <WealthCard key={s._id} source={s}
                                        onEdit={() => { if (!(s as any).isExternal) { setEditSource(s); setShowModal(true); } }}
                                        onDelete={() => handleDelete(s._id, s.name)} />
                                ))}
                            </div>
                        </section>

                        <section className="pb-8">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Cơ cấu tài sản</h3>
                            <div className="bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] rounded-3xl p-6 relative">
                                <div className="flex justify-center items-center py-4">
                                    <div className="relative w-48 h-48">
                                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                            {(() => {
                                                let currentOffset = 0;
                                                return allSources.map((s, idx) => {
                                                    // For pie chart, map negative balances to 0 or absolute so it renders somewhat, or just exclude debt 
                                                    const value = Math.max(0, s.balance);
                                                    const chartTotal = allSources.reduce((sum, item) => sum + Math.max(0, item.balance), 0);
                                                    const percentage = chartTotal > 0 ? (value / chartTotal) * 100 : 0;
                                                    const dashArray = `${percentage} 251.2`;
                                                    const length = (percentage / 100) * 251.2;
                                                    const strokeDashoffset = -currentOffset;
                                                    currentOffset += length;

                                                    return (
                                                        <circle key={s._id} cx="50" cy="50" fill="transparent" r="40"
                                                            stroke={s.color} strokeDasharray={dashArray}
                                                            strokeDashoffset={strokeDashoffset} strokeWidth="16" />
                                                    );
                                                });
                                            })()}
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-xs text-slate-500 font-medium">Tổng cộng</span>
                                            <span className="text-lg font-bold text-slate-800">100%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-y-3 gap-x-4 mt-6">
                                    {allSources.map(s => {
                                        const value = Math.max(0, s.balance);
                                        const chartTotal = allSources.reduce((sum, item) => sum + Math.max(0, item.balance), 0);
                                        const pct = chartTotal > 0 ? (value / chartTotal) * 100 : 0;
                                        return (
                                            <div key={s._id} className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                                                <span className="text-xs text-slate-600 truncate" title={s.name}>{s.name} ({pct.toFixed(0)}%)</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    </div>
                )}
            </div>

            {/* FAB */}
            <button
                onClick={() => { setEditSource(null); setShowModal(true); }}
                className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.4)] flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #A78BFA 0%, #6C63FF 100%)' }}>
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
            </button>

            {/* Modal */}
            <WealthSourceModal
                open={showModal}
                onClose={() => { setShowModal(false); setEditSource(null); }}
                onSave={handleSave}
                editSource={editSource}
            />
        </div>
    );
}
