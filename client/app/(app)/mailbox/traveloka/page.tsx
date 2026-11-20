'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { RefreshDuotone } from '@/components/icons/RefreshDuotone';
import { mailboxApi } from '@/lib/api';
import ReadStatusFilter, { type ReadStatus } from '@/components/ReadStatusFilter';
import { cn, formatNumber } from '@/lib/utils';

interface Voucher { code: string; currency: string; amount: number }
interface VoucherEmail {
    uid: number; subject: string; date: string; seen: boolean;
    sender: string; expiresAt: string | null; vouchers: Voucher[];
}

// Codes the user already copied on this device — just a visual "đã copy"
// hint, so a lost/blocked localStorage only means the hint is gone.
const COPIED_KEY = 'traveloka-copied-codes';
function loadCopied(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(COPIED_KEY) || '[]')); } catch { return new Set(); }
}
function saveCopied(s: Set<string>) {
    try { localStorage.setItem(COPIED_KEY, JSON.stringify(Array.from(s).slice(-2000))); } catch { /* ignore */ }
}

async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    }
}

const fmtMoney = (v: Voucher) => (v.amount ? `${formatNumber(v.amount)}${v.currency === 'VND' ? 'đ' : ` ${v.currency}`}` : '—');
const fmtDay = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const daysLeft = (s: string) => Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000);

// "Voucher Traveloka" — every Traveloka gift-voucher mail, unread only by
// default, with each code + its value one tap away from the clipboard.
export default function TravelokaVouchersPage() {
    const router = useRouter();
    const [emails, setEmails] = useState<VoucherEmail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [status, setStatus] = useState<ReadStatus>('unread');
    const [amountFilter, setAmountFilter] = useState<number | null>(null);
    const [copied, setCopied] = useState<Set<string>>(new Set());

    useEffect(() => { setCopied(loadCopied()); }, []);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const r = await mailboxApi.traveloka(status);
            setEmails(r.data.data.emails);
        } catch (e: any) {
            if (e?.response?.status === 403) { toast.error('Bạn không có quyền'); router.replace('/settings'); return; }
            setError(e?.response?.data?.message || 'Không tải được thư Traveloka');
        } finally { setLoading(false); }
    }, [status, router]);
    useEffect(() => { load(); }, [load]);

    const markCopied = (codes: string[]) => setCopied(prev => {
        const n = new Set(prev); codes.forEach(c => n.add(c)); saveCopied(n); return n;
    });

    const copyOne = async (v: Voucher) => {
        if (await copyText(v.code)) { markCopied([v.code]); toast.success(`Đã copy mã ${fmtMoney(v)}`, { duration: 1500 }); }
        else toast.error('Không copy được');
    };
    const copyMany = async (list: Voucher[], label: string) => {
        if (!list.length) return;
        if (await copyText(list.map(v => v.code).join('\n'))) { markCopied(list.map(v => v.code)); toast.success(`Đã copy ${list.length} mã ${label}`); }
        else toast.error('Không copy được');
    };

    // Mark read/unread; drops the mail from view when it no longer matches the filter.
    const setSeen = async (uids: number[], seen: boolean) => {
        try {
            await mailboxApi.flags('all', uids, { seen });
            const leaves = (status === 'unread' && seen) || (status === 'read' && !seen);
            if (leaves) setEmails(list => list.filter(e => !uids.includes(e.uid)));
            else setEmails(list => list.map(e => (uids.includes(e.uid) ? { ...e, seen } : e)));
            toast.success(seen
                ? (uids.length > 1 ? `Đã đánh dấu đọc ${uids.length} thư` : 'Đã đánh dấu đã đọc')
                : 'Đã đánh dấu chưa đọc');
        } catch (e: any) { toast.error(e?.response?.data?.message || 'Thao tác thất bại'); }
    };
    const markRead = (uids: number[]) => setSeen(uids, true);

    // Denomination chips + totals
    const denominations = useMemo(() => {
        const map = new Map<number, number>();
        emails.forEach(e => e.vouchers.forEach(v => map.set(v.amount, (map.get(v.amount) || 0) + 1)));
        return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
    }, [emails]);

    const visible = useMemo(() => emails
        .map(e => ({ ...e, vouchers: amountFilter == null ? e.vouchers : e.vouchers.filter(v => v.amount === amountFilter) }))
        .filter(e => e.vouchers.length > 0), [emails, amountFilter]);

    const allVisibleVouchers = visible.flatMap(e => e.vouchers);
    const totalValue = allVisibleVouchers.reduce((s, v) => s + v.amount, 0);
    const notCopied = allVisibleVouchers.filter(v => !copied.has(v.code));
    // Every code from UNREAD mails currently shown (respects the denomination
    // filter), whether or not it was copied before.
    const unreadVouchers = visible.filter(e => !e.seen).flatMap(e => e.vouchers);

    return (
        <div className="min-h-screen pb-28 bg-gray-50 dark:bg-surface-deep">
            <PageHeader title="Voucher Traveloka" subtitle={status === 'unread' ? 'Thư chưa đọc' : status === 'read' ? 'Thư đã đọc' : 'Tất cả thư'} onBack={() => router.back()}
                rightActions={
                    <button onClick={load} aria-label="Làm mới"
                        className="w-10 h-10 rounded-full bg-card border border-slate-200 dark:border-slate-700 flex items-center justify-center text-foreground">
                        <RefreshDuotone className={cn('w-4 h-4', loading && 'animate-spin')} />
                    </button>
                } />

            <div className="px-5 space-y-3">
                {/* Summary */}
                <div className="bg-card rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground font-medium">
                                {allVisibleVouchers.length} mã · {visible.length} thư{amountFilter != null ? ` · mệnh giá ${formatNumber(amountFilter)}đ` : ''}
                            </p>
                            <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">{formatNumber(totalValue)}đ</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        {status !== 'read' && (
                            <button onClick={() => copyMany(unreadVouchers, 'từ thư chưa đọc')} disabled={!unreadVouchers.length}
                                className="flex-1 h-10 px-3 rounded-xl bg-brand text-white text-xs font-bold disabled:opacity-40">
                                Copy tất cả {unreadVouchers.length} mã chưa đọc
                            </button>
                        )}
                        <button onClick={() => copyMany(notCopied, 'chưa copy')} disabled={!notCopied.length}
                            className={cn('flex-1 h-10 px-3 rounded-xl text-xs font-bold disabled:opacity-40',
                                status === 'read' ? 'bg-brand text-white' : 'bg-brand/10 text-brand dark:text-purple-300')}>
                            Copy {notCopied.length} mã chưa copy
                        </button>
                    </div>
                    <ReadStatusFilter value={status} onChange={v => { setStatus(v); setAmountFilter(null); }} className="mt-3" />
                </div>

                {/* Denomination filter */}
                {denominations.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
                        <Chip active={amountFilter == null} onClick={() => setAmountFilter(null)}>Tất cả</Chip>
                        {denominations.map(([amt, n]) => (
                            <Chip key={amt} active={amountFilter === amt} onClick={() => setAmountFilter(amt)}>
                                {amt ? `${formatNumber(amt)}đ` : 'Không rõ'} <span className="opacity-70">×{n}</span>
                            </Chip>
                        ))}
                    </div>
                )}

                {loading && <p className="text-sm text-muted-foreground text-center py-10">Đang đọc thư Traveloka…</p>}
                {!loading && error && (
                    <div className="text-center py-10 space-y-3">
                        <p className="text-sm text-red-500">{error}</p>
                        <button onClick={load} className="text-xs font-bold text-brand">Thử lại</button>
                    </div>
                )}
                {!loading && !error && visible.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-10">
                        {status === 'unread' ? 'Không còn thư voucher Traveloka nào chưa đọc 🎉'
                            : status === 'read' ? 'Chưa có thư voucher Traveloka nào đã đọc' : 'Không có thư voucher Traveloka'}
                    </p>
                )}

                {!loading && !error && visible.map(e => {
                    const left = e.expiresAt ? daysLeft(e.expiresAt) : null;
                    return (
                        <div key={e.uid} className={cn('bg-card rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden', e.seen && 'opacity-70')}>
                            <div className="px-4 pt-3 pb-2 flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground">
                                        {!e.seen && <span className="inline-block w-2 h-2 rounded-full bg-brand mr-1.5 align-middle" />}
                                        {e.sender ? `Từ ${e.sender}` : 'Traveloka'} · {fmtDay(e.date)}
                                    </p>
                                    {e.expiresAt && (
                                        <p className={cn('text-[11px] mt-0.5 font-medium', left != null && left <= 30 ? 'text-red-500' : 'text-muted-foreground')}>
                                            HSD {fmtDay(e.expiresAt)}{left != null && left <= 30 ? ` · còn ${Math.max(0, left)} ngày` : ''}
                                        </p>
                                    )}
                                </div>
                                {e.vouchers.length > 1 && (
                                    <button onClick={() => copyMany(e.vouchers, 'trong thư')}
                                        className="text-[11px] font-bold text-brand px-2.5 py-1.5 rounded-lg bg-brand/10 flex-shrink-0">
                                        Copy {e.vouchers.length} mã
                                    </button>
                                )}
                                <button onClick={() => setSeen([e.uid], !e.seen)}
                                    className="text-[11px] font-bold text-muted-foreground px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                                    {e.seen ? 'Chưa đọc' : 'Đã đọc'}
                                </button>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {e.vouchers.map(v => {
                                    const done = copied.has(v.code);
                                    return (
                                        <button key={v.code} onClick={() => copyOne(v)}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800/50">
                                            <span className="text-sm font-bold text-foreground tabular-nums w-24 flex-shrink-0">{fmtMoney(v)}</span>
                                            <span className={cn('flex-1 min-w-0 font-mono text-[13px] tracking-wide truncate', done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                                                {v.code}
                                            </span>
                                            <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0',
                                                done ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-brand text-white')}>
                                                {done ? 'Đã copy' : 'Copy'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {!loading && status !== 'read' && visible.some(e => !e.seen) && (
                    <button onClick={() => { const ids = visible.filter(e => !e.seen).map(e => e.uid); if (confirm(`Đánh dấu đã đọc ${ids.length} thư chưa đọc đang hiển thị?`)) markRead(ids); }}
                        className="w-full h-11 rounded-xl text-sm font-bold bg-card border border-slate-200 dark:border-slate-700 text-foreground">
                        Đánh dấu đã đọc tất cả ({visible.filter(e => !e.seen).length} thư)
                    </button>
                )}
            </div>
        </div>
    );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className={cn('flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-bold transition-all',
                active ? 'bg-brand text-white' : 'bg-card text-foreground border border-slate-200 dark:border-slate-700')}>
            {children}
        </button>
    );
}
