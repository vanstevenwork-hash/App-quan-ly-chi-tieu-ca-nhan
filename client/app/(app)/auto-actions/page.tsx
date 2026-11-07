'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { cardsApi } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import { useCardStore } from '@/hooks/useCards';
import { useTransactionStore } from '@/hooks/useTransactions';
import { useNotificationStore } from '@/hooks/useNotifications';

interface AutoAction {
    _id: string;
    kind: 'savings_settle' | 'credit_autopay';
    cardId: string;
    amount: number;
    principal: number;
    interest: number;
    cardLabel: string;
    accountLabel: string;
    status: 'done' | 'reverted';
    revertedAt: string | null;
    createdAt: string;
}
interface PendingCard {
    cardId: string;
    bankName: string;
    cardNumber: string;
    due: number;
    cycleLabel: string;
}

const fmtDate = (s: string) => new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// "Giao dịch tự động" — one place to review everything the app did on its own
// (auto tất toán sổ, auto trừ tiền thẻ) and undo it if it didn't really happen.
export default function AutoActionsPage() {
    const router = useRouter();
    const [actions, setActions] = useState<AutoAction[]>([]);
    const [pending, setPending] = useState<PendingCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [reverting, setReverting] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await cardsApi.autoActions();
            setActions(res.data?.data?.actions || []);
            setPending(res.data?.data?.pending || []);
        } catch {
            toast.error('Không tải được giao dịch tự động');
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const stats = useMemo(() => {
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const live = actions.filter(a => a.status === 'done' && new Date(a.createdAt) >= monthStart);
        return {
            paid: live.filter(a => a.kind === 'credit_autopay').reduce((s, a) => s + a.amount, 0),
            settled: live.filter(a => a.kind === 'savings_settle').reduce((s, a) => s + a.amount, 0),
        };
    }, [actions]);

    const handleRevert = async (a: AutoAction) => {
        const msg = a.kind === 'credit_autopay'
            ? `Hoàn tác thanh toán ${formatNumber(a.amount)}đ cho ${a.cardLabel}?\n\nTiền sẽ trả lại ${a.accountLabel}, dư nợ thẻ được khôi phục. Kỳ này sẽ không tự trừ lại — bạn thanh toán thủ công khi đã trả.`
            : `Hoàn tác tất toán ${a.cardLabel}?\n\nSổ được mở lại và trừ ${formatNumber(a.amount)}đ khỏi ${a.accountLabel || 'tài khoản nhận'}. Sổ sẽ không tự tất toán lại cho tới khi bạn tái tục/sửa ngày đáo hạn.`;
        if (!confirm(msg)) return;
        setReverting(a._id);
        try {
            await cardsApi.revertAutoAction(a._id);
            toast.success('Đã hoàn tác');
            await Promise.all([
                load(),
                useCardStore.getState().fetch(true),
                useTransactionStore.getState().fetch(true),
                useNotificationStore.getState().fetch(true),
            ]);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Hoàn tác thất bại');
        } finally { setReverting(null); }
    };

    return (
        <div className="min-h-screen pb-28 bg-gray-50 dark:bg-surface-deep">
            <PageHeader title="Giao dịch tự động" subtitle="Tất toán & trừ tiền thẻ" onBack={() => router.back()} />

            <div className="px-5 space-y-5">
                {/* Month summary */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-surface rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đã tự trừ thẻ tháng này</p>
                        <p className="text-lg font-bold text-foreground mt-1">{formatNumber(stats.paid)}đ</p>
                    </div>
                    <div className="bg-white dark:bg-surface rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đã tất toán tháng này</p>
                        <p className="text-lg font-bold text-foreground mt-1">{formatNumber(stats.settled)}đ</p>
                    </div>
                </div>

                {/* Waiting for money */}
                {pending.length > 0 && (
                    <section className="space-y-2">
                        <h2 className="text-sm font-bold text-foreground">Chưa trừ được tiền</h2>
                        {pending.map(p => (
                            <button key={p.cardId} onClick={() => router.push(`/cards/${p.cardId}`)}
                                className="w-full text-left bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4">
                                <p className="text-sm font-bold text-foreground">{p.bankName} ••{p.cardNumber}</p>
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium">
                                    Sao kê {p.cycleLabel} cần {formatNumber(p.due)}đ — TK cùng ngân hàng chưa đủ tiền. App sẽ tự trừ khi đủ, hoặc bấm để thanh toán thủ công.
                                </p>
                            </button>
                        ))}
                    </section>
                )}

                {/* History */}
                <section className="space-y-2">
                    <h2 className="text-sm font-bold text-foreground">Lịch sử</h2>
                    {loading && <p className="text-sm text-muted-foreground py-6 text-center">Đang tải...</p>}
                    {!loading && actions.length === 0 && (
                        <p className="text-sm text-muted-foreground py-6 text-center">Chưa có giao dịch tự động nào</p>
                    )}
                    {actions.map(a => {
                        const isPay = a.kind === 'credit_autopay';
                        const reverted = a.status === 'reverted';
                        return (
                            <div key={a._id} className={cn('bg-white dark:bg-surface rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex items-start gap-3', reverted && 'opacity-60')}>
                                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0', isPay ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-indigo-50 dark:bg-indigo-900/20')}>
                                    {isPay ? '💳' : '🏦'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground">
                                        {isPay ? `Tự trừ tiền ${a.cardLabel}` : `Tất toán ${a.cardLabel}`}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isPay
                                            ? `${formatNumber(a.amount)}đ từ ${a.accountLabel}`
                                            : `${formatNumber(a.amount)}đ (lãi ${formatNumber(a.interest)}đ) → ${a.accountLabel || 'chưa có TK nhận'}`}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {fmtDate(a.createdAt)}{reverted && a.revertedAt ? ` · đã hoàn tác ${fmtDate(a.revertedAt)}` : ''}
                                    </p>
                                </div>
                                {reverted ? (
                                    <span className="text-[11px] font-bold text-slate-400 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0">Đã hoàn tác</span>
                                ) : (
                                    <button onClick={() => handleRevert(a)} disabled={reverting === a._id}
                                        className="text-xs font-bold text-red-500 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 flex-shrink-0 disabled:opacity-50 active:scale-95 transition-all">
                                        {reverting === a._id ? '...' : 'Hoàn tác'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </section>
            </div>
        </div>
    );
}
