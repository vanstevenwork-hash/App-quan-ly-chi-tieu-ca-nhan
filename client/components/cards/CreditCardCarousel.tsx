'use client';
import { memo, useState } from 'react';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { ActionIcon } from '@/components/icons/CustomIcon';
import Image from 'next/image';
import Link from 'next/link';
import { getBankLogo } from '@/lib/bankLogos';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    return `${Math.round(n / 1_000)}k`;
};

const CARD_GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
];

function getGradient(card: Card, idx: number): string {
    if (card.color === '#111111' || card.color === '#FFFFFF') return card.color;
    if (card.bankColor && card.color && card.bankColor !== '#1B4FD8')
        return `linear-gradient(135deg, ${card.bankColor} 0%, ${card.color} 100%)`;
    return CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
}

function cardTextStyle(color: string) {
    if (color === '#111111') return { text: '#F59E0B', subtext: '#FCD34D', border: '1px solid #374151' };
    if (color === '#FFFFFF') return { text: '#1E293B', subtext: '#64748B', border: '1px solid #E2E8F0' };
    return { text: '#FFFFFF', subtext: 'rgba(255,255,255,0.85)', border: undefined };
}

function daysUntilPayment(paymentDueDay: number): number | null {
    if (!paymentDueDay) return null;
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), paymentDueDay);
    if (due <= now) due.setMonth(due.getMonth() + 1);
    return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

function CreditCardSlide({ card, idx, onEdit, onDelete, onPay, bankLogoUrl }: {
    card: Card; idx: number; bankLogoUrl?: string;
    onEdit: () => void; onDelete: () => void; onPay: () => void;
}) {
    const usedPct = card.creditLimit > 0 ? Math.min((card.balance / card.creditLimit) * 100, 100) : 0;
    const dueDays = daysUntilPayment(card.paymentDueDay);
    const isUrgent = dueDays !== null && dueDays <= 5;
    const ts = cardTextStyle(card.color);
    const [logoError, setLogoError] = useState(false);
    // Use bank API logo first, then static CDN fallback
    const logoUrl = bankLogoUrl || getBankLogo(card.bankShortName, card.bankName);
    const showLogo = logoUrl && !logoError;

    return (
        <div className="snap-center shrink-0 w-[85%] relative rounded-xl p-3 pb-2.5 pt-2.5 shadow-xl overflow-hidden
                        transform transition-transform hover:scale-[1.02] flex flex-col h-[192px]"
            style={{ background: getGradient(card, idx), border: ts.border }}>
            {/* Default badge — absolute top-right */}
            {card.isDefault && (
                <span className="absolute top-0 right-0 z-10 bg-yellow-400/90 text-yellow-900 text-[10px] font-bold px-1 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <CustomIcon type="star" size={10} tile={false} color="#F59E0B" />
                </span>
            )}
            {card.color !== '#111111' && card.color !== '#FFFFFF' && (
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
            )}

            <div className="flex justify-between items-start mb-2.5">
                <div className="flex items-center gap-2">
                    {/* Bank logo */}
                    {showLogo ? (
                        <Image
                            src={logoUrl!}
                            width={36}
                            height={36}
                            alt={card.bankShortName || card.bankName}
                            className="w-9 h-9 rounded-xl object-contain bg-white/90 p-0.5 flex-shrink-0 shadow-sm"
                            onError={() => setLogoError(true)}
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold" style={{ color: ts.text }}>
                                {(card.bankShortName || card.bankName || '?').substring(0, 3).toUpperCase()}
                            </span>
                        </div>
                    )}
                    <div>
                        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: ts.subtext }}>{card.bankName}</p>
                        <p className="text-base font-bold mt-0.5 tracking-widest" style={{ color: ts.text }}>•••• {card.cardNumber}</p>
                    </div>
                </div>
                <div className="flex gap-1">
                    <button onClick={onEdit}
                        className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition">
                        <ActionIcon type="pencil" size={16} tile={false} color={ts.text} />
                    </button>
                    <button onClick={onDelete}
                        className="w-8 h-8 rounded-full bg-red-400/20 hover:bg-red-400/40 flex items-center justify-center transition">
                        <ActionIcon type="trash" size={16} tile={false} color="#EF4444" />
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-end mb-2.5">
                <div>
                    <p className="text-xs mb-1" style={{ color: ts.subtext }}>Dư nợ hiện tại</p>
                    <p className="text-xl font-bold tracking-tight" style={{ color: ts.text }}>{fmt(card.balance)}₫</p>
                </div>
                {dueDays !== null ? (
                    <div className="text-right">
                        <p className="text-xs mb-1" style={{ color: ts.subtext }}>Hạn thanh toán</p>
                        <div className="flex items-center gap-1 justify-end">
                            {isUrgent && <CustomIcon type="alertCircle" size={16} tile={false} color="#EF4444" />}
                            <p className={cn('text-sm font-bold', isUrgent ? 'text-red-400' : '')} style={isUrgent ? undefined : { color: ts.subtext }}>
                                {dueDays <= 0 ? 'Đã quá hạn!' : `${dueDays} ngày nữa`}
                            </p>
                        </div>
                    </div>
                ) : (
                    card.statementDay > 0 && (
                        <div className="text-right">
                            <p className="text-xs mb-1" style={{ color: ts.subtext }}>Sao kê ngày</p>
                            <p className="text-sm font-bold" style={{ color: ts.text }}>{card.statementDay}/{new Date().getMonth() + 1}</p>
                        </div>
                    )
                )}
            </div>

            {card.creditLimit > 0 && (
                <>
                    <div className="flex justify-between text-[10px] mb-1.5" style={{ color: ts.subtext }}>
                        <span>Đã dùng {usedPct.toFixed(0)}%</span>
                        <span>Hạn mức:<span className="text-base ml-0.5 font-bold">{fmtShort(card.creditLimit)}</span></span>
                    </div>
                    <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all"
                            style={{
                                width: `${usedPct}%`,
                                backgroundColor: usedPct > 80 ? '#FCA5A5' : ts.subtext,
                            }} />
                    </div>
                </>
            )}

            {/* Pay button on card */}
            {card.balance > 0 && (
                <button onClick={onPay}
                    className="w-full mt-auto py-2 rounded-xl bg-black/10 hover:bg-black/20 text-xs font-bold transition flex items-center justify-center gap-1.5"
                    style={{ color: ts.text }}>
                    <CustomIcon type="creditCard" size={14} tile={false} color="currentColor" /> Thanh toán ngay
                </button>
            )}
        </div>
    );
}

interface CreditCardCarouselProps {
    loading: boolean;
    creditCards: Card[];
    findApiBank: (bankShortName?: string, bankName?: string) => { logo?: string } | undefined;
    onEdit: (card: Card) => void;
    onDelete: (id: string) => void;
    onPay: () => void;
    onAddNew: () => void;
}

function CreditCardCarouselBase({ loading, creditCards, findApiBank, onEdit, onDelete, onPay, onAddNew }: CreditCardCarouselProps) {
    return (
        <div className="pl-6 mb-2 overflow-hidden">
            <div className="flex items-center justify-between pr-6 mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Thẻ của tôi</h2>
                    {creditCards.length > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                            {creditCards.length} thẻ
                        </span>
                    )}
                </div>
                <Link href="/accounts" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all tracking-tight">
                    Xem tất cả
                </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x pr-6"
                style={{ scrollbarWidth: 'none' }}>
                {loading && (
                    <div className="snap-center shrink-0 w-[85%] min-h-[200px] rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
                )}
                {!loading && creditCards.map((card, idx) => {
                    const apiBank = findApiBank(card.bankShortName, card.bankName);
                    const bankLogoUrl = (apiBank as any)?.logo || undefined;
                    return (
                        <CreditCardSlide key={card._id} card={card} idx={idx}
                            bankLogoUrl={bankLogoUrl}
                            onEdit={() => onEdit(card)}
                            onDelete={() => onDelete(card._id)}
                            onPay={onPay} />
                    );
                })}
                {/* Add new card slide */}
                <button
                    onClick={onAddNew}
                    className="snap-center shrink-0 w-[55%] min-h-[185px] rounded-[20px] border-2 border-dashed border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-slate-500 hover:border-emerald-300 hover:text-emerald-500 dark:hover:border-emerald-500 transition">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                        <ActionIcon type="plus" size={24} tile={false} color="#94A3B8" />
                    </div>
                    <span className="font-semibold text-sm">Thêm thẻ mới</span>
                </button>
            </div>
        </div>
    );
}

export default memo(CreditCardCarouselBase);
