'use client';
import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCards, type Card } from '@/hooks/useCards';
import { useBanks } from '@/hooks/useBanks';
import PageHeader from '@/components/PageHeader';
import { getBankLogo } from '@/lib/bankLogos';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { cn } from '@/lib/utils';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

// Physical-card expiry is stored as "MM/YY" (CardFormModal) — older/mock data
// may use "YYYY-MM". Parse either into the last moment of the expiry month
// (cards stay valid through the end of that month).
function parseExpiry(s?: string): Date | null {
    if (!s) return null;
    let mm: number, yyyy: number;
    const a = s.match(/^(\d{2})\/(\d{2})$/);      // MM/YY
    const b = s.match(/^(\d{4})-(\d{1,2})$/);     // YYYY-MM
    if (a) { mm = +a[1]; yyyy = 2000 + +a[2]; }
    else if (b) { yyyy = +b[1]; mm = +b[2]; }
    else return null;
    if (mm < 1 || mm > 12) return null;
    return new Date(yyyy, mm, 0, 23, 59, 59, 999); // day 0 of next month = last day of mm
}

type Row = {
    card: Card;
    expiry: Date;
    label: string;      // "07/2027"
    days: number;       // days until expiry (negative = expired)
    months: number;     // whole months until expiry
    status: 'expired' | 'soon' | 'ok';
    // Annual fee, charged yearly in the card's expiry MONTH (no separate fee
    // date is stored, so the card's month stands in for the fee anniversary).
    annualFee: number;
    feeMonth: number;   // 0-11
    feeDate: Date | null;
    feeDays: number;    // days until next fee charge
    feeDueSoon: boolean; // within the warning window (~2 months)
};

const FEE_WARN_DAYS = 60; // warn ~2 months before the annual fee month

const STATUS = {
    expired: { color: '#EF4444', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-500 dark:text-red-400', label: 'Đã hết hạn' },
    soon: { color: '#F59E0B', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-500 dark:text-amber-400', label: 'Sắp hết hạn' },
    ok: { color: '#10B981', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', label: 'Còn hạn' },
} as const;

function remainingLabel(r: Row): string {
    if (r.status === 'expired') {
        const m = Math.abs(r.months);
        return m >= 1 ? `Quá hạn ${m} tháng` : 'Vừa quá hạn';
    }
    if (r.months <= 0) return `Còn ${Math.max(0, r.days)} ngày`;
    return `Còn ${r.months} tháng`;
}

export default function CardExpiryPage() {
    const router = useRouter();
    const { cards, loading } = useCards();
    const { banks: fetchedBanks, fetchBanks } = useBanks();

    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    // Same logo resolution chain as Cards/Cashback: bank API logo first, then
    // the static CDN map — getBankLogo alone misses many banks.
    const banksByShortName = useMemo(() => {
        const m = new Map<string, any>();
        fetchedBanks.forEach((b: any) => { if (b.shortName) m.set(b.shortName.toUpperCase(), b); });
        return m;
    }, [fetchedBanks]);
    const cardLogo = (card: Card): string | undefined =>
        banksByShortName.get((card.bankShortName || '').toUpperCase())?.logo
        || getBankLogo(card.bankShortName, card.bankName);

    const rows = useMemo<Row[]>(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return cards
            .map(card => {
                const expiry = parseExpiry((card as any).expirationDate);
                if (!expiry) return null;
                const days = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
                const months = (expiry.getFullYear() - now.getFullYear()) * 12 + (expiry.getMonth() - now.getMonth());
                const status: Row['status'] = days < 0 ? 'expired' : days <= 90 ? 'soon' : 'ok';
                const label = `${String(expiry.getMonth() + 1).padStart(2, '0')}/${expiry.getFullYear()}`;

                // Next annual-fee charge: the card's expiry month, this year if
                // not passed yet, otherwise next year. Only meaningful while the
                // card is still valid and actually has a fee.
                const annualFee = card.annualFee || 0;
                const feeMonth = expiry.getMonth();
                let feeDate: Date | null = null;
                let feeDays = Infinity;
                if (annualFee > 0 && status !== 'expired') {
                    const feeYear = now.getMonth() > feeMonth ? now.getFullYear() + 1 : now.getFullYear();
                    feeDate = new Date(feeYear, feeMonth, 1);
                    feeDays = Math.ceil((feeDate.getTime() - todayStart.getTime()) / 86_400_000);
                }
                const feeDueSoon = annualFee > 0 && feeDate !== null && feeDays <= FEE_WARN_DAYS;

                return { card, expiry, label, days, months, status, annualFee, feeMonth, feeDate, feeDays, feeDueSoon };
            })
            .filter((r): r is Row => r !== null)
            // Soonest actionable date first (nearest of fee-charge vs expiry).
            .sort((a, b) => {
                const au = Math.min(a.days, a.feeDueSoon ? a.feeDays : Infinity);
                const bu = Math.min(b.days, b.feeDueSoon ? b.feeDays : Infinity);
                return au - bu;
            });
    }, [cards]);

    const stats = useMemo(() => ({
        total: rows.length,
        fee: rows.filter(r => r.feeDueSoon).length,
        soon: rows.filter(r => r.status === 'soon' || r.status === 'expired').length,
    }), [rows]);

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-surface-deep transition-colors duration-200">
            <PageHeader title="Hạn thẻ" subtitle="Quản lý" backHref="/cards" />

            <div className="px-5 pt-2 space-y-5">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { k: 'total', label: 'Tổng thẻ', value: stats.total, color: '#6366F1' },
                        { k: 'fee', label: 'Sắp đóng phí', value: stats.fee, color: '#F59E0B' },
                        { k: 'soon', label: 'Sắp/đã hết hạn', value: stats.soon, color: '#EF4444' },
                    ].map(s => (
                        <div key={s.k} className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-3.5 text-center">
                            <p className="text-2xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-[88px] rounded-2xl bg-gray-200 dark:bg-surface animate-pulse" />)}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 p-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-3">
                            <ActionIcon type="calendar" size={26} tile={false} color="#6366F1" />
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Chưa có thẻ nào có ngày hết hạn</p>
                        <p className="text-xs text-slate-400 mt-1">Thêm ngày hết hạn (MM/YY) khi tạo/sửa thẻ để theo dõi ở đây.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rows.map(r => {
                            const st = STATUS[r.status];
                            const logo = cardLogo(r.card);
                            return (
                                <button key={r.card._id} onClick={() => router.push(`/cards/${r.card._id}`)}
                                    className="w-full flex items-center gap-3 p-3.5 bg-white dark:bg-surface rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm active:scale-[0.99] transition text-left">
                                    {logo ? (
                                        <Image src={logo} width={44} height={44} alt={r.card.bankShortName}
                                            className="w-11 h-11 rounded-xl object-contain bg-white p-1 flex-shrink-0" />
                                    ) : (
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-black"
                                            style={{ backgroundColor: r.card.bankColor || '#6C63FF' }}>
                                            {(r.card.bankShortName || r.card.bankName || '?').slice(0, 3).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[15px] font-bold text-slate-800 dark:text-white truncate">
                                            {r.card.bankName} <span className="text-slate-400 dark:text-slate-500 font-semibold">•••• {r.card.cardNumber}</span>
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                            Hết hạn <span className="font-bold" style={{ color: st.color }}>{r.label}</span> · {remainingLabel(r)}
                                        </p>
                                        {r.annualFee > 0 && (
                                            <p className={cn('text-xs mt-0.5', r.feeDueSoon ? 'text-amber-500 dark:text-amber-400 font-bold' : 'text-slate-400 dark:text-slate-500')}>
                                                {r.feeDueSoon
                                                    ? `⚠ Sắp đóng phí TN ${fmt(r.annualFee)}đ · còn ${Math.max(0, r.feeDays)} ngày`
                                                    : `Phí TN ${fmt(r.annualFee)}đ · đóng T${r.feeMonth + 1} hằng năm`}
                                            </p>
                                        )}
                                    </div>
                                    <span className={cn(
                                        'text-[10px] font-black px-2.5 py-1 rounded-full flex-shrink-0',
                                        r.feeDueSoon ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400' : cn(st.bg, st.text)
                                    )}>
                                        {r.feeDueSoon ? 'Sắp đóng phí' : st.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
