'use client';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCards, type Card } from '@/hooks/useCards';
import { useTransactions } from '@/hooks/useTransactions';
import { useBanks } from '@/hooks/useBanks';
import PageHeader from '@/components/PageHeader';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { getBankLogo } from '@/lib/bankLogos';
import { getDueThisCycle } from '@/lib/cardDue';
import { getCardCycle, type CardCycle } from '@/lib/statement';
import { cn, formatNumber } from '@/lib/utils';

const fmt = (n: number) => formatNumber(Math.round(n));
const pad = (n: number) => String(n).padStart(2, '0');
const dm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

const fmtShort = (n: number) => {
    const a = Math.abs(n);
    if (a >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
    if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (a >= 1_000) return `${Math.round(n / 1_000)}k`;
    return `${Math.round(n)}`;
};

interface Row { card: Card; cycle: CardCycle | null; due: number; }

const urgency = (days: number) =>
    days <= 3 ? 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400'
        : days <= 7 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

const WEEKS = [
    { label: 'Tuần này', from: 0, to: 6 },
    { label: 'Tuần sau', from: 7, to: 13 },
    { label: '2 tuần nữa', from: 14, to: 20 },
    { label: '3 tuần nữa', from: 21, to: 27 },
    { label: 'Sau đó', from: 28, to: 999 },
];

export default function StatementsPage() {
    const router = useRouter();
    const { cards } = useCards();
    const { transactions } = useTransactions();
    const { banks, fetchBanks } = useBanks();
    const [query, setQuery] = useState('');

    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    const logoFor = (card: Card): string | undefined => {
        const short = (card.bankShortName || '').toUpperCase();
        return banks.find((b: any) => b.shortName?.toUpperCase() === short)?.logo || getBankLogo(card.bankShortName, card.bankName);
    };

    const rows = useMemo<Row[]>(() => {
        const now = new Date();
        return cards
            .filter(c => c.cardType === 'credit')
            .map(card => {
                const ok = card.statementDay > 0 && card.paymentDueDay > 0;
                const cycle = ok ? getCardCycle(card.statementDay, card.paymentDueDay, now) : null;
                const due = cycle?.dueIsForClosedStatement
                    ? getDueThisCycle(card.balance, transactions as any[], card._id, card.statementDay)
                    : 0;
                return { card, cycle, due };
            });
    }, [cards, transactions]);

    const configured = useMemo(
        () => rows.filter((r): r is Row & { cycle: CardCycle } => !!r.cycle).sort((a, b) => a.cycle.daysToDue - b.cycle.daysToDue),
        [rows],
    );
    const missing = useMemo(() => rows.filter(r => !r.cycle), [rows]);

    const upcoming = configured.filter(r => r.due > 0);
    const totalDue = upcoming.reduce((s, r) => s + r.due, 0);
    const nearest = upcoming[0];

    const bestToSwipe = useMemo(
        () => [...configured]
            .sort((a, b) => b.cycle.freeDaysIfSwipedToday - a.cycle.freeDaysIfSwipedToday || (b.card.cashbackRate || 0) - (a.card.cashbackRate || 0))
            .slice(0, 3),
        [configured],
    );

    const weekly = useMemo(() => WEEKS.map(w => {
        const items = upcoming.filter(r => r.cycle.daysToDue >= w.from && r.cycle.daysToDue <= w.to);
        const start = new Date(); start.setDate(start.getDate() + w.from);
        const end = new Date(); end.setDate(end.getDate() + Math.min(w.to, w.from + 6));
        return { ...w, items, total: items.reduce((s, r) => s + r.due, 0), range: `${dm(start)} – ${dm(end)}` };
    }).filter(w => w.items.length > 0), [upcoming]);
    const maxWeek = Math.max(1, ...weekly.map(w => w.total));

    const q = query.trim().toLowerCase();
    const matches = (r: Row) => !q || `${r.card.bankShortName} ${r.card.bankName} ${r.card.cardNumber}`.toLowerCase().includes(q);
    const listed = configured.filter(matches);
    const listedMissing = missing.filter(matches);

    const Logo = ({ card }: { card: Card }) => {
        const logo = logoFor(card);
        return (
            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={logo} alt={card.bankShortName} className="w-7 h-7 object-contain" />
                    : <span className="text-[10px] font-bold text-slate-500">{card.bankShortName}</span>}
            </div>
        );
    };

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep transition-colors duration-200">
            <PageHeader title="Lịch sao kê" subtitle="Chốt sao kê & hạn thanh toán các thẻ" backHref="/cards" />

            <div className="px-5 pt-3 space-y-4">
                {/* ── Hero ─────────────────────────────────────── */}
                <div className="rounded-2xl p-4 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #7C5CF0 0%, #5B3FD0 55%, #2E2A7A 100%)' }}>
                    <p className="text-xs opacity-90">Cần thanh toán kỳ này</p>
                    <p className="text-2xl leading-tight font-bold mt-1 tracking-tight text-money">{fmt(totalDue)}₫</p>
                    <div className="flex items-center gap-2 mt-2.5 text-xs opacity-95">
                        <CustomIcon type="calendar" size={16} tile={false} color="currentColor" className="w-4 h-4" />
                        <span>
                            {nearest
                                ? `${upcoming.length} thẻ · gần nhất ${dm(nearest.cycle.dueDate)} (${nearest.cycle.daysToDue === 0 ? 'hôm nay' : `còn ${nearest.cycle.daysToDue} ngày`})`
                                : 'Không có khoản nào đến hạn'}
                        </span>
                    </div>
                </div>

                {/* ── Nên quẹt thẻ nào hôm nay ─────────────────── */}
                {bestToSwipe.length > 0 && (
                    <section>
                        <div className="flex items-baseline justify-between mb-2.5">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Nên quẹt thẻ nào hôm nay</h3>
                            <span className="text-[11px] text-slate-400">miễn lãi lâu nhất</span>
                        </div>
                        <div className="bg-white dark:bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-700">
                            {bestToSwipe.map((r, i) => (
                                <button key={r.card._id} onClick={() => router.push(`/cards/${r.card._id}`)}
                                    className="w-full flex items-center gap-3 p-3 text-left active:opacity-70">
                                    <Logo card={r.card} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">
                                            {r.card.bankShortName} •••• {(r.card.cardNumber || '').slice(-4)}
                                            {r.card.cashbackRate > 0 && <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{r.card.cashbackRate}% hoàn</span>}
                                        </p>
                                        <p className="text-[11px] text-slate-400 truncate">
                                            Chốt {dm(r.cycle.nextClose)} · hạn trả {dm(r.cycle.freeUntil)}
                                        </p>
                                    </div>
                                    <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0',
                                        i === 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>
                                        {r.cycle.freeDaysIfSwipedToday} ngày
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Tổng phải trả theo tuần ──────────────────── */}
                {weekly.length > 0 && (
                    <section>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2.5">Phải trả theo tuần</h3>
                        <div className="bg-white dark:bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-3 space-y-3">
                            {weekly.map(w => (
                                <div key={w.label}>
                                    <div className="flex items-baseline justify-between text-[13px]">
                                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                                            {w.label} <span className="font-normal text-[11px] text-slate-400">· {w.range} · {w.items.length} thẻ</span>
                                        </span>
                                        <span className="font-bold text-slate-900 dark:text-white text-money">{fmt(w.total)}₫</span>
                                    </div>
                                    <div className="h-1.5 mt-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400" style={{ width: `${(w.total / maxWeek) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Tất cả thẻ ───────────────────────────────── */}
                <section>
                    <div className="flex items-baseline justify-between mb-2.5">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Tất cả thẻ ({rows.length})</h3>
                        <span className="text-[11px] text-slate-400">gần hạn nhất trước</span>
                    </div>
                    {rows.length > 6 && (
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Tìm theo ngân hàng, 4 số cuối..."
                            className="w-full mb-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-800 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-300"
                        />
                    )}
                    <div className="bg-white dark:bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-700">
                        {listed.map(r => (
                            <button key={r.card._id} onClick={() => router.push(`/cards/${r.card._id}`)}
                                className="w-full flex items-center gap-3 p-3 text-left active:opacity-70">
                                <Logo card={r.card} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{r.card.bankShortName} •••• {(r.card.cardNumber || '').slice(-4)}</p>
                                    <p className="text-[11px] text-slate-400 truncate">Chốt ngày {r.card.statementDay} · Hạn ngày {r.card.paymentDueDay}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className={cn('text-[13px] font-bold text-money', r.due > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600')}>
                                        {r.due > 0 ? `${fmtShort(r.due)}₫` : '—'}
                                    </p>
                                    <span className={cn('inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full', urgency(r.cycle.daysToDue))}>
                                        {r.cycle.daysToDue === 0 ? 'Hôm nay' : `${r.cycle.daysToDue} ngày`}
                                    </span>
                                </div>
                            </button>
                        ))}
                        {listedMissing.map(r => (
                            <button key={r.card._id} onClick={() => router.push(`/cards/${r.card._id}`)}
                                className="w-full flex items-center gap-3 p-3 text-left active:opacity-70">
                                <Logo card={r.card} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{r.card.bankShortName} •••• {(r.card.cardNumber || '').slice(-4)}</p>
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 truncate">
                                        Thiếu {!r.card.statementDay && !r.card.paymentDueDay ? 'ngày chốt & ngày thanh toán' : !r.card.statementDay ? 'ngày chốt sao kê' : 'ngày thanh toán'}
                                    </p>
                                </div>
                                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex-shrink-0">Bổ sung ›</span>
                            </button>
                        ))}
                        {listed.length === 0 && listedMissing.length === 0 && (
                            <p className="p-6 text-center text-xs text-slate-400">{rows.length === 0 ? 'Chưa có thẻ tín dụng nào' : 'Không tìm thấy thẻ phù hợp'}</p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
