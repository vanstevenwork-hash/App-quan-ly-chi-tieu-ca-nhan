'use client';
import { useState } from 'react';
import { Calendar, Plus, Lightbulb, Pencil, Trash2, X } from 'lucide-react';
import { useBudgets, type Budget } from '@/hooks/useBudgets';
import { formatShortCurrency, CATEGORIES } from '@/lib/mockData';
import { cn } from '@/lib/utils';

// ===== Donut chart =====
function DonutChart({ spent, total }: { spent: number; total: number }) {
    const SIZE = 220, STROKE = 22;
    const R = (SIZE - STROKE) / 2;
    const CIRC = 2 * Math.PI * R;
    const pct = total > 0 ? Math.min(spent / total, 1) : 0;
    const dash = pct * CIRC;
    return (
        <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} className="-rotate-90 absolute inset-0">
                <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#E5E7EB" strokeWidth={STROKE} />
                <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="url(#donutGrad)" strokeWidth={STROKE}
                    strokeLinecap="round" strokeDasharray={`${dash} ${CIRC}`}
                    style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }} />
                <defs>
                    <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6C63FF" />
                        <stop offset="100%" stopColor="#C084FC" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-gray-400 text-xs mb-1">Đã chi tiêu</p>
                <p className="text-gray-900 font-bold text-3xl">{formatShortCurrency(spent)}</p>
                <p className="text-gray-400 text-sm mt-1">trên {formatShortCurrency(total)}</p>
            </div>
        </div>
    );
}

function getStatus(spent: number, limit: number) {
    const pct = spent / limit;
    if (spent > limit) return { label: 'Quá hạn mức', color: '#EF4444', barColor: '#EF4444' };
    if (pct >= 0.7) return { label: 'Sắp hết', color: '#F97316', barColor: '#F97316' };
    return { label: 'An toàn', color: '#10B981', barColor: '#6C63FF' };
}

// ===== Budget Form Modal =====
const BUDGET_CATEGORIES = CATEGORIES.slice(0, -1); // exclude 'Khác'

function BudgetFormModal({
    open, onClose, onSave, editBudget
}: {
    open: boolean; onClose: () => void;
    onSave: (data: { category: string; amount: number; period: string; color: string }) => Promise<void>;
    editBudget?: Budget | null;
}) {
    const [category, setCategory] = useState(editBudget?.category || BUDGET_CATEGORIES[0]?.label || 'Ăn uống');
    const [amount, setAmount] = useState(editBudget?.amount || 2000000);
    const [saving, setSaving] = useState(false);

    const catInfo = CATEGORIES.find(c => c.label === category);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({ category, amount, period: 'monthly', color: catInfo?.color || '#6C63FF' });
            onClose();
        } finally { setSaving(false); }
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white w-full max-w-md rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="gradient-primary px-5 py-4 flex items-center justify-between">
                    <h3 className="text-white font-bold text-base">{editBudget ? 'Chỉnh sửa ngân sách' : 'Thêm ngân sách'}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-full bg-white/20"><X className="w-4 h-4 text-white" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Danh mục</p>
                        <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto">
                            {BUDGET_CATEGORIES.map(cat => (
                                <button key={cat.label} onClick={() => setCategory(cat.label)}
                                    className={cn('flex flex-col items-center gap-1 p-2 rounded-2xl border-2 text-xs transition-all',
                                        category === cat.label ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200')}>
                                    <span className="text-xl">{cat.icon}</span>
                                    <span className="text-gray-600 text-center leading-tight">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Hạn mức (đ)</p>
                        <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
                            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-gray-900 font-bold text-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        <div className="flex gap-2 mt-2">
                            {[1000000, 2000000, 5000000].map(v => (
                                <button key={v} onClick={() => setAmount(v)}
                                    className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                    {formatShortCurrency(v)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={saving}
                        className="w-full gradient-primary text-white rounded-2xl py-4 font-bold">
                        {saving ? 'Đang lưu...' : (editBudget ? 'Lưu thay đổi' : 'Thêm ngân sách')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ===== Main Page =====
export default function BudgetPage() {
    const now = new Date();
    const { budgets, totalBudget, totalSpent, loading, createBudget, updateBudget, deleteBudget } = useBudgets();
    const [showForm, setShowForm] = useState(false);
    const [editBudget, setEditBudget] = useState<Budget | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);

    const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const closestBudget = budgets.length > 0 ? [...budgets].sort((a, b) => (b.spent / b.amount) - (a.spent / a.amount))[0] : null;
    const monthName = `Ngân sách tháng ${now.getMonth() + 1}`;

    return (
        <div className="min-h-screen bg-[#F0F2F8]">
            {/* Header */}
            <div className="gradient-primary px-5 pt-14 pb-5 flex items-center justify-between">
                <h1 className="text-white font-bold text-xl">Ngân sách</h1>
                <button onClick={() => { setEditBudget(null); setShowForm(true); }}
                    className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                </button>
            </div>

            <div className="px-4 space-y-4 py-4 pb-28">
                {loading ? (
                    <div className="text-center py-10 text-gray-400">Đang tải...</div>
                ) : (
                    <>
                        {/* Donut chart */}
                        <div className="bg-white rounded-3xl shadow-sm p-5">
                            <h2 className="text-center font-bold text-gray-900 text-lg mb-3">{monthName}</h2>
                            <div className="flex justify-center mb-3">
                                <DonutChart spent={totalSpent} total={totalBudget} />
                            </div>
                            <p className="text-center text-gray-500 text-sm">
                                Bạn đã sử dụng{' '}
                                <span className="text-indigo-600 font-bold">{overallPct}%</span>{' '}
                                tổng ngân sách tháng này.
                            </p>
                        </div>

                        {/* Suggestion */}
                        {closestBudget && (closestBudget.spent / closestBudget.amount) >= 0.6 && (
                            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 flex items-start gap-3">
                                <div className="w-9 h-9 rounded-2xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                                    <Lightbulb className="w-4 h-4 text-indigo-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800 text-sm">Gợi ý chi tiêu</p>
                                    <p className="text-gray-500 text-xs mt-0.5">
                                        Bạn sắp vượt ngân sách <span className="text-indigo-600 font-semibold">{closestBudget.category}</span>, hãy cân nhắc giảm bớt nhé!
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Category list */}
                        {budgets.length === 0 ? (
                            <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
                                <p className="text-gray-400 text-sm">Chưa có ngân sách nào</p>
                                <button onClick={() => { setEditBudget(null); setShowForm(true); }}
                                    className="mt-3 gradient-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold">
                                    + Thêm ngân sách
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl shadow-sm divide-y divide-gray-50 overflow-hidden">
                                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                                    <p className="font-bold text-gray-900">Chi tiết danh mục</p>
                                </div>
                                {budgets.map(budget => {
                                    const pct = budget.amount > 0 ? Math.min(budget.spent / budget.amount, 1) : 0;
                                    const status = getStatus(budget.spent, budget.amount);
                                    const remaining = budget.amount - budget.spent;
                                    const cat = CATEGORIES.find(c => c.label === budget.category);
                                    const icon = cat?.icon || '💰';
                                    return (
                                        <div key={budget._id} className="px-4 py-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                                                        style={{ backgroundColor: `${budget.color || '#6C63FF'}20` }}>
                                                        {icon}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-gray-800">{budget.category}</p>
                                                        <p className="text-gray-400 text-xs">
                                                            {budget.spent > budget.amount
                                                                ? `Vượt ${formatShortCurrency(Math.abs(remaining))}`
                                                                : `Còn lại ${formatShortCurrency(remaining)}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <div className="text-right mr-2">
                                                        <p className="font-semibold text-sm text-gray-800">
                                                            {formatShortCurrency(budget.spent)} / {formatShortCurrency(budget.amount)}
                                                        </p>
                                                        <p className="text-xs font-semibold" style={{ color: status.color }}>{status.label}</p>
                                                    </div>
                                                    <button onClick={() => { setEditBudget(budget); setShowForm(true); }}
                                                        className="p-1.5 rounded-full hover:bg-gray-100"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                                                    <button onClick={() => setDeleteTarget(budget)}
                                                        className="p-1.5 rounded-full hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${Math.min(pct * 100, 100)}%`, backgroundColor: status.barColor }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {budgets.length > 0 && (
                            <button onClick={() => { setEditBudget(null); setShowForm(true); }}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl border-2 border-dashed border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors">
                                <Plus className="w-5 h-5" /> Thêm ngân sách
                            </button>
                        )}
                    </>
                )}
            </div>

            <BudgetFormModal
                open={showForm}
                onClose={() => { setShowForm(false); setEditBudget(null); }}
                onSave={async (data) => {
                    if (editBudget) await updateBudget(editBudget._id, data);
                    else await createBudget(data);
                    setEditBudget(null);
                }}
                editBudget={editBudget}
            />

            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
                    onClick={() => setDeleteTarget(null)}>
                    <div className="bg-white w-full max-w-md rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-gray-900 text-center">Xoá ngân sách?</h3>
                        <p className="text-gray-500 text-sm text-center">Xoá ngân sách danh mục <strong>{deleteTarget.category}</strong>?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTarget(null)}
                                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-700 font-semibold">Huỷ</button>
                            <button onClick={async () => { await deleteBudget(deleteTarget._id); setDeleteTarget(null); }}
                                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold">Xoá</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
