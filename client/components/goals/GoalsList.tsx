'use client';
import { memo, useState } from 'react';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import type { Goal } from '@/hooks/useGoals';

// "120tr" / "1,5 tỷ" / "2,25 tỷ" — Vietnamese compact amounts
const fmtViShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} tỷ`.replace(/,?0+ tỷ$/, ' tỷ');
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1).replace('.', ',')}tr`.replace(',0tr', 'tr');
    if (abs >= 1_000) return `${Math.round(abs / 1_000)}k`;
    return `${Math.round(abs)}`;
};

const MONTH_MS = 30 * 86_400_000;

function daysLeft(deadline: string): number {
    return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

// ─── Confetti burst ───────────────────────────────────────────────
function Confetti({ active }: { active: boolean }) {
    if (!active) return null;
    const dots = Array.from({ length: 20 });
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px] z-10">
            {dots.map((_, i) => (
                <div key={i}
                    className="absolute w-2 h-2 rounded-full animate-bounce"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        backgroundColor: ['#F59E0B', '#10B981', '#6C63FF', '#EF4444', '#3B82F6'][i % 5],
                        animationDelay: `${(i * 0.1).toFixed(1)}s`,
                        animationDuration: `${0.5 + Math.random() * 0.5}s`,
                    }} />
            ))}
        </div>
    );
}

// ─── Progress ring around the goal icon ──────────────────────────
function ProgressRing({ pct, color, icon }: { pct: number; color: string; icon: string }) {
    const r = 42;
    const C = 2 * Math.PI * r;
    return (
        <div className="relative w-[66px] h-[66px] flex-shrink-0">
            <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
                <circle cx="48" cy="48" r={r} strokeWidth="7" fill="none" className="stroke-slate-100 dark:stroke-slate-800" />
                <circle cx="48" cy="48" r={r} strokeWidth="7" fill="none" stroke={color} strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(100, pct) / 100)}
                    className="transition-all duration-700 ease-out" />
            </svg>
            <div className="absolute inset-[8px] rounded-full flex items-center justify-center text-[21px]"
                style={{ backgroundColor: `${color}1A` }}>
                {icon}
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-[2px] rounded-full text-[10px] font-bold text-white shadow-md"
                style={{ backgroundColor: color }}>
                {pct}%
            </span>
        </div>
    );
}

// ─── Pace insight: needed per month vs actual recent pace ────────
function buildInsight(goal: Goal, remaining: number, monthsRemain: number | null): React.ReactNode | null {
    if (goal.status === 'completed' || remaining <= 0) return null;
    const B = ({ children }: { children: React.ReactNode }) =>
        <b className="text-slate-900 dark:text-white">{children}</b>;

    // Recent pace: net deposits over the last 3 months; fallback to lifetime average
    const now = Date.now();
    const recentNet = (goal.contributions || [])
        .filter(c => now - new Date(c.date).getTime() <= 3 * MONTH_MS)
        .reduce((s, c) => s + (c.type === 'deposit' ? c.amount : -c.amount), 0);
    let pace = recentNet / 3;
    let paceLabel = '3 tháng gần đây';
    if (pace <= 0) {
        const monthsSince = Math.max(1, (now - new Date(goal.createdAt).getTime()) / MONTH_MS);
        pace = goal.currentAmount / monthsSince;
        paceLabel = 'từ khi tạo';
    }

    if (monthsRemain !== null && monthsRemain > 0) {
        const needed = remaining / monthsRemain;
        if (pace <= 0) {
            return <>Để về đích đúng hạn, bạn cần để dành <B>{fmtViShort(needed)}/tháng</B>. Hãy bắt đầu góp ngay hôm nay!</>;
        }
        const delay = Math.round(remaining / pace - monthsRemain);
        if (delay > 0) {
            return <>Để về đích đúng hạn, bạn cần để dành <B>{fmtViShort(needed)}/tháng</B>. Với đà {paceLabel} (<B>{fmtViShort(pace)}/tháng</B>), bạn sẽ trễ khoảng <B>{delay} tháng</B>.</>;
        }
        if (delay < 0) {
            return <>Với đà {paceLabel} (<B>{fmtViShort(pace)}/tháng</B>), bạn sẽ về đích sớm khoảng <B>{Math.abs(delay)} tháng</B>. Tuyệt vời, giữ vững phong độ!</>;
        }
        return <>Bạn đang <B>đúng tiến độ</B> — giữ nhịp <B>{fmtViShort(needed)}/tháng</B> là về đích đúng hạn.</>;
    }
    if (monthsRemain !== null && monthsRemain <= 0) {
        return <>Mục tiêu đã <B>quá hạn</B> — còn thiếu <B>{fmtViShort(remaining)}</B>. Cân nhắc dời hạn chót hoặc tăng tốc góp.</>;
    }
    if (pace > 0) {
        return <>Với đà {paceLabel} (<B>{fmtViShort(pace)}/tháng</B>), bạn cần khoảng <B>{Math.ceil(remaining / pace)} tháng</B> nữa để hoàn thành.</>;
    }
    return null;
}

// ─── Goal Card ───────────────────────────────────────────────────
function GoalCard({ goal, onContribute, onEdit, onDelete }: {
    goal: Goal;
    onContribute: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const pct = Math.min(100, goal.progress ?? 0);
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    const isCompleted = goal.status === 'completed';
    const days = goal.deadline ? daysLeft(goal.deadline) : null;
    const monthsRemain = days !== null ? Math.max(0, Math.round(days / 30)) : null;
    const deadlineDate = goal.deadline ? new Date(goal.deadline) : null;
    const insight = buildInsight(goal, remaining, monthsRemain);

    return (
        <div className="relative bg-white dark:bg-surface rounded-[20px] border border-gray-100 dark:border-slate-800 shadow-sm p-4">
            <Confetti active={pct >= 100} />

            {/* ⋯ menu */}
            <div className="absolute top-3 right-3 z-20">
                <button onClick={() => setMenuOpen(v => !v)}
                    className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                    <UtilityIcon type="moreHorizontal" size={15} tile={false} color="currentColor" />
                </button>
                {menuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-0 top-9 z-20 w-40 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-xl overflow-hidden">
                            {!isCompleted && (
                                <button onClick={() => { setMenuOpen(false); onEdit(); }}
                                    className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5">
                                    <CustomIcon type="pencil" size={16} tile={false} color="#8B5CF6" /> Chỉnh sửa
                                </button>
                            )}
                            <button onClick={() => { setMenuOpen(false); onDelete(); }}
                                className="w-full px-4 py-2.5 text-left text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5">
                                <CustomIcon type="trash" size={16} tile={false} color="#EF4444" /> Xóa mục tiêu
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Ring + title + deadline */}
            <div className="flex items-center gap-3 mb-3">
                <ProgressRing pct={pct} color={goal.color} icon={goal.icon} />
                <div className="min-w-0 flex-1 pr-8">
                    <h3 className="text-[16px] font-bold text-slate-900 dark:text-white truncate">{goal.name}</h3>
                    {deadlineDate ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
                            📅 Hạn chót{' '}
                            <span className="font-bold text-amber-500 dark:text-amber-400">
                                T{deadlineDate.getMonth() + 1}/{deadlineDate.getFullYear()}
                            </span>
                            {monthsRemain !== null && monthsRemain > 0 && !isCompleted && <> · còn {monthsRemain} tháng</>}
                        </p>
                    ) : goal.description ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">{goal.description}</p>
                    ) : null}
                    {/* Amount — sits beside the ring to save a full row */}
                    <p className="text-[20px] font-bold text-slate-900 dark:text-white leading-none tabular-nums mt-1.5">
                        {fmtViShort(goal.currentAmount)}
                        <span className="text-[13px] text-slate-400 dark:text-slate-500 font-semibold"> / {fmtViShort(goal.targetAmount)}</span>
                    </p>
                </div>
            </div>

            {/* Progress bar + scale marks */}
            <div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, backgroundColor: goal.color }} />
                </div>
                <div className="flex justify-between mt-1 text-[9px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                    {[0, 0.25, 0.5, 0.75, 1].map(f => (
                        <span key={f}>{f === 0 ? '0' : fmtViShort(goal.targetAmount * f)}</span>
                    ))}
                </div>
            </div>

            {/* Pace insight */}
            {insight && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl p-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <UtilityIcon type="sparkles" size={13} tile={false} color="#8B5CF6" />
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{insight}</p>
                </div>
            )}

            {/* Actions */}
            {!isCompleted ? (
                <div className="mt-3 flex gap-2.5">
                    <button onClick={onContribute}
                        className="flex-1 py-2.5 rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#8B7CF6] to-[#6C63FF] shadow-md shadow-[#6C63FF]/25 active:scale-[0.98] transition-all">
                        <CustomIcon type="plus" size={14} tile={false} color="#FFFFFF" />
                        Góp tiền vào mục tiêu
                    </button>
                    <button onClick={onEdit}
                        className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition-all">
                        {goal.autoSaveAmount ? `Tự động: ${fmtViShort(goal.autoSaveAmount)}` : 'Góp tự động'}
                    </button>
                </div>
            ) : (
                <div className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[13px] font-bold">
                    <CustomIcon type="checkCircle2" size={16} tile={false} color="#10B981" />
                    Đã hoàn thành! 🎉
                </div>
            )}
        </div>
    );
}

// ─── Goal templates: quick-start a new goal ──────────────────────
const TEMPLATES = [
    { icon: '✈️', label: 'Du lịch', sub: 'từ 20tr' },
    { icon: '🛡️', label: 'Quỹ khẩn cấp', sub: '3–6 tháng chi tiêu' },
    { icon: '🚗', label: 'Mua xe', sub: 'từ 400tr' },
];

function TemplatesSection({ onAdd }: { onAdd: () => void }) {
    return (
        <section className="pt-2">
            <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Bắt đầu mục tiêu mới</h2>
                <button onClick={onAdd} className="text-sm font-semibold text-purple-600 dark:text-[#8FA0FF] hover:opacity-80 transition-opacity">
                    Mẫu có sẵn
                </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {TEMPLATES.map(t => (
                    <button key={t.label} onClick={onAdd}
                        className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm px-2 py-4 flex flex-col items-center gap-2.5 active:scale-95 hover:border-[#6C63FF]/40 transition-all">
                        <span className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-2xl">{t.icon}</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{t.label}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight text-center">{t.sub}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}

// ─── Empty State ──────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
            <div className="w-24 h-24 rounded-[20px] mb-6 flex items-center justify-center text-5xl"
                style={{ background: 'linear-gradient(135deg, #6C63FF22, #6C63FF44)' }}>
                🎯
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Chưa có mục tiêu nào</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                Đặt mục tiêu tài chính và theo dõi tiến độ để đạt được ước mơ của bạn!
            </p>
            <div className="grid grid-cols-2 gap-3 w-full mb-8">
                {[
                    { icon: '🏠', label: 'Mua nhà' }, { icon: '✈️', label: 'Du lịch' },
                    { icon: '🚗', label: 'Mua xe' }, { icon: '💰', label: 'Quỹ khẩn cấp' },
                ].map(g => (
                    <button key={g.label} onClick={onAdd}
                        className="flex items-center gap-2 p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#6C63FF] hover:bg-[#6C63FF]/5 transition text-left">
                        <span className="text-xl">{g.icon}</span>
                        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{g.label}</span>
                    </button>
                ))}
            </div>
            <button onClick={onAdd}
                className="px-8 py-4 rounded-2xl text-white font-bold text-base shadow-lg transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #6C63FF, #8B5CF6)' }}>
                ✨ Tạo mục tiêu đầu tiên
            </button>
        </div>
    );
}

interface GoalsListProps {
    loading: boolean;
    hasGoals: boolean;
    filtered: Goal[];
    onAdd: () => void;
    onContribute: (goal: Goal) => void;
    onEdit: (goal: Goal) => void;
    onDelete: (id: string) => void;
}

function GoalsListBase({ loading, hasGoals, filtered, onAdd, onContribute, onEdit, onDelete }: GoalsListProps) {
    return (
        <div className="px-5 space-y-4">
            {loading && (
                <div className="space-y-4">
                    {[1, 2].map(i => (
                        <div key={i} className="h-48 rounded-[20px] bg-gray-100 dark:bg-surface animate-pulse" />
                    ))}
                </div>
            )}

            {!loading && !hasGoals && (
                <EmptyState onAdd={onAdd} />
            )}

            {!loading && filtered.length === 0 && hasGoals && (
                <div className="text-center py-12">
                    <p className="text-slate-400 dark:text-slate-500 text-sm">Không có mục tiêu nào trong tab này</p>
                </div>
            )}

            {!loading && filtered.map(goal => (
                <GoalCard
                    key={goal._id}
                    goal={goal}
                    onContribute={() => onContribute(goal)}
                    onEdit={() => onEdit(goal)}
                    onDelete={() => onDelete(goal._id)}
                />
            ))}

            {!loading && hasGoals && <TemplatesSection onAdd={onAdd} />}
        </div>
    );
}

export default memo(GoalsListBase);
