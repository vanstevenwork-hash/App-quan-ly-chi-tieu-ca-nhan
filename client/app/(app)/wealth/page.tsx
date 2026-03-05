'use client';
import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, TrendingUp, Wallet, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWealth, type WealthSource } from '@/hooks/useWealth';
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
};

function WealthCard({ source, onEdit, onDelete }: {
    source: WealthSource; onEdit: () => void; onDelete: () => void;
}) {
    return (
        <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg transition-transform hover:scale-[1.01]"
            style={{ background: `linear-gradient(135deg, ${source.color}dd, ${source.color}99)` }}>
            {/* Glow */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-black/10 pointer-events-none" />

            <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">
                            {source.icon}
                        </div>
                        <div>
                            <p className="font-bold text-base text-white">{source.name}</p>
                            <p className="text-[11px] text-white/70 font-medium">{CATEGORY_LABELS[source.category] || 'Khác'}</p>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={onEdit}
                            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                            <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={onDelete}
                            className="w-7 h-7 rounded-full bg-red-400/30 hover:bg-red-400/50 flex items-center justify-center transition">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <div>
                    <p className="text-[11px] text-white/70 mb-0.5">Giá trị hiện tại</p>
                    <p className="text-2xl font-bold tracking-tight">{fmtFull(source.balance)}₫</p>
                </div>

                {source.note && (
                    <p className="mt-2 text-[11px] text-white/60 truncate">{source.note}</p>
                )}
            </div>
        </div>
    );
}

export default function WealthPage() {
    const router = useRouter();
    const { sources, total, loading, createSource, updateSource, deleteSource, refetch } = useWealth();
    const [showModal, setShowModal] = useState(false);
    const [editSource, setEditSource] = useState<WealthSource | null>(null);

    // Group by category
    const byCategory = useMemo(() => {
        const map: Record<string, WealthSource[]> = {};
        sources.forEach(s => {
            if (!map[s.category]) map[s.category] = [];
            map[s.category].push(s);
        });
        return map;
    }, [sources]);

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
                <div className="mx-5 mb-6 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' }}>
                    <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-black/10 pointer-events-none" />
                    <div className="relative z-10">
                        <p className="text-xs text-white/70 font-semibold uppercase tracking-widest mb-2">Tổng tài sản ròng</p>
                        <p className="text-4xl font-bold tracking-tight mb-3">{fmtFull(total)}₫</p>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1.5">
                                <Wallet className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold">{sources.length} nguồn</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1.5">
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold">{Object.keys(byCategory).length} loại</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Empty state */}
                {!loading && sources.length === 0 && (
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
                {loading && (
                    <div className="px-5 space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-28 rounded-3xl bg-gray-100 animate-pulse" />
                        ))}
                    </div>
                )}

                {/* Sources grid */}
                {!loading && sources.length > 0 && (
                    <div className="px-5 space-y-6">
                        {Object.entries(byCategory).map(([cat, items]) => (
                            <div key={cat}>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
                                        {CATEGORY_LABELS[cat] || cat}
                                    </h2>
                                    <span className="text-xs text-slate-400 font-semibold">
                                        {fmtShort(items.reduce((s, w) => s + w.balance, 0))}₫
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {items.map(s => (
                                        <WealthCard key={s._id} source={s}
                                            onEdit={() => { setEditSource(s); setShowModal(true); }}
                                            onDelete={() => handleDelete(s._id, s.name)} />
                                    ))}
                                </div>
                            </div>
                        ))}
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
