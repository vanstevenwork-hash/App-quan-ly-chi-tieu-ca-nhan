'use client';
import { memo } from 'react';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { getBankLogo } from '@/lib/bankLogos';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';
import { UtilityIcon } from '@/components/icons/UtilityIcon';
import { ActionIcon } from '@/components/icons/ActionIcon';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(Math.abs(n)));

function AccountRow({ card, onEdit, onDelete, bankLogoUrl }: {
    card: Card; onEdit: () => void; onDelete: () => void; bankLogoUrl?: string;
}) {
    const isCrypto = card.cardType === 'crypto';
    const isEWallet = card.cardType === 'eWallet';
    const logoUrl = bankLogoUrl || getBankLogo(card.bankShortName, card.bankName);
    const balanceColor = card.balance < 0 ? 'text-red-500' : 'text-emerald-500 dark:text-emerald-400';

    return (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700/50 shadow-sm transition-all hover:border-indigo-200 dark:hover:border-indigo-900/50 group">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 overflow-hidden', 
                logoUrl ? 'bg-white shadow-sm border border-gray-100' : 
                isCrypto ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
                isEWallet ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' :
                'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
            )}>
                {logoUrl ? (
                    <img src={logoUrl} alt={card.bankName} className="w-full h-full object-contain p-1.5" />
                ) : isCrypto ? (
                    <CustomIcon type="bitcoin" size={20} tile={false} color="#F97316" />
                ) : isEWallet ? (
                    <CustomIcon type="eWallet" size={20} tile={false} color="#8B5CF6" />
                ) : (
                    <UtilityIcon type="theGhiNo" size={20} tile={false} color="#3D7BF0" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{card.bankName}</p>
                    {card.isDefault && <CustomIcon type="star" size={10} tile={false} color="#F59E0B" />}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-tight uppercase">
                    {card.cardHolder} {card.cardNumber ? `• ${card.cardNumber}` : ''}
                </p>
            </div>

            <div className="relative h-10 min-w-[80px] overflow-hidden flex items-center justify-end">
                {/* Balance View */}
                <div className="flex flex-col items-end transition-all duration-300 group-hover:-translate-y-full group-hover:opacity-0">
                    <p className={cn('text-sm font-bold leading-none', balanceColor)}>
                        {fmt(card.balance)}₫
                    </p>
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 flex items-center justify-end gap-1.5 translate-y-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900/40 transition-colors shadow-sm"
                        title="Chỉnh sửa"
                    >
                        <ActionIcon type="pencil" size={14} tile={false} color="#6366F1" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40 transition-colors shadow-sm"
                        title="Xóa"
                    >
                        <ActionIcon type="trash" size={14} tile={false} color="#EF4444" />
                    </button>
                </div>
            </div>
        </div>
    );
}

interface PaymentAccountsListProps {
    accounts: Card[];
    findApiBank: (bankShortName?: string, bankName?: string) => { logo?: string } | undefined;
    onEdit: (card: Card) => void;
    onDelete: (id: string) => void;
    onAddNew: () => void;
}

function PaymentAccountsListBase({ accounts, findApiBank, onEdit, onDelete, onAddNew }: PaymentAccountsListProps) {
    return (
        <div className="px-6 mb-6">
            <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Tài khoản & Ví</h3>
                <button onClick={onAddNew} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all">Thêm mới</button>
            </div>
            <div className="space-y-2.5">
                {accounts.length > 0 ? accounts.map(acc => {
                    const apiBank = findApiBank(acc.bankShortName, acc.bankName);
                    const bankLogoUrl = (apiBank as any)?.logo || undefined;
                    return (
                        <AccountRow key={acc._id} card={acc}
                            bankLogoUrl={bankLogoUrl}
                            onEdit={() => onEdit(acc)}
                            onDelete={() => onDelete(acc._id)} />
                    );
                }) : (
                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4 text-center border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-400">Chưa có tài khoản thanh toán hoặc ví</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default memo(PaymentAccountsListBase);
