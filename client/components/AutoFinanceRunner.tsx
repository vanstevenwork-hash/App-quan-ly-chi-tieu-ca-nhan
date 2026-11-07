'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cardsApi } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import { useCardStore } from '@/hooks/useCards';
import { useTransactionStore } from '@/hooks/useTransactions';
import { useNotificationStore } from '@/hooks/useNotifications';

interface AutoEvent {
    _id: string;
    title: string;
    message: string;
    type: string;
    createdAt: string;
    cardId: string | null;
    action: {
        _id: string;
        kind: 'savings_settle' | 'credit_autopay';
        status: 'done' | 'reverted';
        amount: number;
        cardLabel: string;
        accountLabel: string;
    } | null;
}

const refreshAll = () => Promise.all([
    useCardStore.getState().fetch(true),
    useTransactionStore.getState().fetch(true),
    useNotificationStore.getState().fetch(true),
]);

// On app open: run the server's automatic jobs (auto tất toán sổ đáo hạn,
// auto trừ tiền thẻ sau sao kê), then show a review popup listing every
// automatic change since the last review — including ones the hourly
// background scan made while the user was away — with an inline "Hoàn tác"
// for each. Events stay pending (popup re-appears next open) until the user
// presses "Đã kiểm tra", so nothing can slip by unreviewed.
export default function AutoFinanceRunner() {
    const ran = useRef(false);
    const router = useRouter();
    const [events, setEvents] = useState<AutoEvent[]>([]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        (async () => {
            try {
                const res = await cardsApi.autoProcess();
                const list: AutoEvent[] = res.data?.data || [];
                if (list.length === 0) return;
                setEvents(list);
                setOpen(true);
                await refreshAll();
            } catch { /* silent — retried next time the app opens */ }
        })();
    }, []);

    const revert = async (e: AutoEvent) => {
        if (!e.action) return;
        const a = e.action;
        const msg = a.kind === 'credit_autopay'
            ? `Hoàn tác: trả lại ${formatNumber(a.amount)}đ vào ${a.accountLabel} và khôi phục dư nợ ${a.cardLabel}?`
            : `Hoàn tác: mở lại ${a.cardLabel} và trừ ${formatNumber(a.amount)}đ khỏi ${a.accountLabel || 'tài khoản nhận'}?`;
        if (!confirm(msg)) return;
        setBusy(e._id);
        try {
            await cardsApi.revertAutoAction(a._id);
            setEvents(list => list.map(x => x._id === e._id && x.action ? { ...x, action: { ...x.action, status: 'reverted' } } : x));
            toast.success('Đã hoàn tác');
            refreshAll();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Hoàn tác thất bại');
        } finally { setBusy(null); }
    };

    const ack = async () => {
        setClosing(true);
        try { await cardsApi.ackAutoEvents(events.map(e => e._id)); } catch { /* will show again next open */ }
        setClosing(false);
        setOpen(false);
    };

    const goTo = (path: string) => { setOpen(false); router.push(path); };

    if (events.length === 0) return null;

    return (
        // Closing by overlay/Esc only hides it for now — it comes back next
        // open until "Đã kiểm tra" is pressed.
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="w-[calc(100%-32px)] max-w-md rounded-3xl p-0 gap-0 overflow-hidden bg-white dark:bg-surface border-0">
                <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <DialogTitle className="text-lg font-bold text-foreground">Thay đổi tự động</DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        App đã tự xử lý {events.length} việc từ lần trước. Kiểm tra lại — nếu ngoài thực tế chưa đúng, bấm Hoàn tác.
                    </DialogDescription>
                </div>

                <div className="max-h-[55vh] overflow-y-auto px-5 py-3 space-y-2.5">
                    {events.map(e => {
                        const a = e.action;
                        const isWarn = !a;
                        const reverted = a?.status === 'reverted';
                        return (
                            <div key={e._id} className={cn(
                                'rounded-2xl p-3.5 border',
                                isWarn ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
                                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800',
                                reverted && 'opacity-60'
                            )}>
                                <p className="text-sm font-bold text-foreground">{e.title}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{e.message}</p>
                                <div className="flex items-center justify-end gap-2 mt-2.5">
                                    {isWarn && e.cardId && (
                                        <button onClick={() => goTo(`/cards/${e.cardId}`)}
                                            className="text-xs font-bold text-brand dark:text-purple-400 px-3 py-1.5 rounded-lg bg-white dark:bg-surface border border-slate-200 dark:border-slate-700">
                                            Thanh toán thủ công
                                        </button>
                                    )}
                                    {a && (reverted ? (
                                        <span className="text-[11px] font-bold text-slate-400 px-2 py-1">Đã hoàn tác</span>
                                    ) : (
                                        <button onClick={() => revert(e)} disabled={busy === e._id}
                                            className="text-xs font-bold text-red-500 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 disabled:opacity-50 active:scale-95 transition-all">
                                            {busy === e._id ? '...' : 'Hoàn tác'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                    <button onClick={() => goTo('/auto-actions')}
                        className="flex-1 h-11 rounded-xl text-sm font-bold text-foreground bg-slate-100 dark:bg-slate-800">
                        Xem lịch sử
                    </button>
                    <button onClick={ack} disabled={closing}
                        className="flex-1 h-11 rounded-xl text-sm font-bold text-white bg-brand disabled:opacity-60">
                        {closing ? '...' : 'Đã kiểm tra'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
