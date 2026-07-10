'use client';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTransactions } from '@/hooks/useTransactions';
import { CATEGORIES_MAP } from '@/lib/mockData';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import AddTransactionModal from '@/components/AddTransactionModal';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const fmtFull = (n: number) => n.toLocaleString('vi-VN');
const RECENT_KEY = 'recentTransactionSearches';
const MAX_RECENT = 8;

// App pages/features you can jump to directly from search — matched by label.
const FEATURES = [
    { label: 'Thẻ & Tài khoản', href: '/cards', icon: '💳' },
    { label: 'Hoàn tiền', href: '/cashback', icon: '🪙' },
    { label: 'Tiết kiệm', href: '/savings', icon: '🐷' },
];

export default function SearchPage() {
    const router = useRouter();
    const { transactions, deleteTransaction, refetch } = useTransactions();
    const [query, setQuery] = useState('');
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [selectedTx, setSelectedTx] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<any>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(RECENT_KEY);
            if (stored) setRecentSearches(JSON.parse(stored));
        } catch { /* ignore malformed storage */ }
    }, []);

    const saveRecentSearch = (term: string) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        setRecentSearches(prev => {
            const next = [trimmed, ...prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
            return next;
        });
    };

    const removeRecentSearch = (term: string) => {
        setRecentSearches(prev => {
            const next = prev.filter(s => s !== term);
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
            return next;
        });
    };

    const featureResults = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return FEATURES.filter(f => f.label.toLowerCase().includes(q));
    }, [query]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const qDigits = q.replace(/\D/g, '');
        return transactions
            .filter(t => {
                const noteMatch = t.note?.toLowerCase().includes(q);
                const categoryMatch = t.category?.toLowerCase().includes(q);
                const amountMatch = qDigits.length > 0 && String(t.amount).includes(qDigits);
                return noteMatch || categoryMatch || amountMatch;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 50);
    }, [transactions, query]);

    const handleGoFeature = (href: string, label: string) => {
        saveRecentSearch(label);
        router.push(href);
    };
    const handleSelect = (t: any) => {
        saveRecentSearch(query);
        setSelectedTx(t);
        setIsDetailOpen(true);
    };
    const handleEdit = (t: any) => { setIsDetailOpen(false); setEditingTx(t); setIsEditOpen(true); };
    const handleDelete = async (id: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) {
            try {
                await deleteTransaction(id);
                toast.success('Đã xóa giao dịch');
                setIsDetailOpen(false);
            } catch {
                toast.error('Xóa giao dịch thất bại');
            }
        }
    };

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep transition-colors duration-200">
            <PageHeader title="Tìm kiếm" backHref="/dashboard" />

            <div className="px-5 pt-2">
                <div className="relative">
                    <CustomIcon type="search" size={16} tile={false} color="currentColor" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Tìm tính năng, giao dịch..."
                        className="w-full h-12 pl-11 pr-10 rounded-full bg-white dark:bg-surface shadow-sm border border-gray-100 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-300"
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <CustomIcon type="x" size={16} tile={false} color="currentColor" className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {!query.trim() ? (
                <div className="px-5 pt-5 space-y-6">
                    {/* Recent searches */}
                    {recentSearches.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5 px-1">Tìm kiếm gần đây</p>
                            <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm overflow-hidden divide-y divide-gray-50 dark:divide-slate-700/50">
                                {recentSearches.map(term => (
                                    <div key={term} className="flex items-center gap-3 px-4 py-3">
                                        <UtilityIcon type="clock" size={16} tile={false} color="#94A3B8" className="flex-shrink-0" />
                                        <button onClick={() => setQuery(term)} className="flex-1 min-w-0 text-left text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                            {term}
                                        </button>
                                        <button onClick={() => removeRecentSearch(term)} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 flex-shrink-0">
                                            <CustomIcon type="x" size={14} tile={false} color="currentColor" className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggested features */}
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5 px-1">Tính năng</p>
                        <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm overflow-hidden divide-y divide-gray-50 dark:divide-slate-700/50">
                            {FEATURES.map(f => (
                                <button
                                    key={f.href}
                                    onClick={() => handleGoFeature(f.href, f.label)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors text-left"
                                >
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 bg-slate-50 dark:bg-slate-700/50">
                                        {f.icon}
                                    </div>
                                    <span className="flex-1 min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{f.label}</span>
                                    <CustomIcon type="chevronRight" size={16} tile={false} color="currentColor" className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="px-5 pt-4 space-y-5">
                    {/* Matching features — tap navigates straight there */}
                    {featureResults.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5 px-1">Tính năng</p>
                            <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm overflow-hidden divide-y divide-gray-50 dark:divide-slate-700/50">
                                {featureResults.map(f => (
                                    <button
                                        key={f.href}
                                        onClick={() => handleGoFeature(f.href, f.label)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors text-left"
                                    >
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 bg-slate-50 dark:bg-slate-700/50">
                                            {f.icon}
                                        </div>
                                        <span className="flex-1 min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{f.label}</span>
                                        <CustomIcon type="chevronRight" size={16} tile={false} color="currentColor" className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Matching transactions */}
                    <div>
                        {(featureResults.length > 0 || results.length > 0) && (
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5 px-1">Giao dịch</p>
                        )}
                        {results.length === 0 ? (
                            featureResults.length === 0 && (
                                <p className="text-center text-sm text-slate-400 py-10">Không tìm thấy kết quả nào</p>
                            )
                        ) : (
                            <div className="space-y-2.5">
                                {results.map(t => {
                                    const isIncome = t.type === 'income';
                                    const cat = CATEGORIES_MAP.get(t.category);
                                    return (
                                        <button
                                            key={t._id}
                                            onClick={() => handleSelect(t)}
                                            className="w-full flex items-center gap-3 bg-white dark:bg-surface rounded-xl border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all px-4 py-3.5 text-left"
                                        >
                                            <CategoryIcon
                                                type={cat?.catIconType || 'khac'}
                                                size={40}
                                                tile
                                                className="flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{t.note || t.category}</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                    {t.category} · {new Date(t.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <span className={cn('text-sm font-bold flex-shrink-0', isIncome ? 'text-emerald-500' : 'text-red-500')}>
                                                {isIncome ? '+' : '-'}{fmtFull(t.amount)}đ
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <TransactionDetailModal
                transaction={selectedTx}
                open={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <AddTransactionModal
                open={isEditOpen}
                onClose={() => { setIsEditOpen(false); setEditingTx(null); }}
                onSaved={refetch}
                defaultType={editingTx?.type || 'expense'}
                initialData={editingTx}
            />
        </div>
    );
}
