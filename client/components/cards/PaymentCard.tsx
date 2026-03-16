import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentCardProps = {
    card: any;
    isSelected: boolean;
    onSelect: (id: string) => void;
    logoUrl?: string;
    cBg?: string;
    type: "credit" | "account";
    renderNetworkLogo?: (network: string) => React.ReactNode;
};

export default function PaymentCard({
    card,
    isSelected,
    onSelect,
    logoUrl,
    cBg,
    type,
    renderNetworkLogo,
}: PaymentCardProps) {
    return (
        <div
            onClick={() => onSelect(card._id)}
            className={cn(
                "relative snap-start shrink-0 w-[110px] h-[68px] p-1.5 rounded-xl border cursor-pointer flex flex-col transition-all",
                isSelected
                    ? "border-[#7f19e6] bg-[#7f19e6]/5 dark:bg-purple-900/20"
                    : "border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-600"
            )}
        >
            {/* Selected icon */}
            {isSelected && (
                <div className="absolute top-[-6px] right-[-6px] w-4 h-4 rounded-full border border-[#7f19e6] flex items-center justify-center bg-white dark:bg-slate-900">
                    <Check className="w-2.5 h-2.5 text-[#7f19e6] dark:text-purple-400 stroke-[3]" />
                </div>
            )}

            {/* Top: logo + bank name */}
            <div className="flex items-center gap-2 min-w-0 mb-2">
                {logoUrl ? (
                    <div className="w-6 h-6 p-1 bg-white rounded-lg border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        <img src={logoUrl} className="w-full h-full object-contain" alt="logo" />
                    </div>
                ) : (
                    <div
                        className="px-2 py-0.5 rounded-md text-white text-[10px] font-bold shadow-sm shrink-0"
                        style={{ backgroundColor: cBg }}
                    >
                        {card.bankShortName?.slice(0, 4) || card.cardType?.toUpperCase()}
                    </div>
                )}

                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {card.bankName}
                </p>
            </div>

            {/* Bottom */}
            {type === "credit" ? (
                <div className="mt-auto flex items-end justify-between gap-1">
                    <div className="flex items-center justify-between w-full min-w-0">

                        <p className="text-[11px] font-bold text-red-500 dark:text-red-400">
                            {(card.balance / 1000000).toFixed(1).replace('.0', '')}tr
                        </p>

                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                            ** {card.cardNumber || "...."}
                        </p>

                    </div>

                    {renderNetworkLogo && (
                        <div className="flex items-center shrink-0">
                            {renderNetworkLogo(card.cardNetwork)}
                        </div>
                    )}
                </div>
            ) : (
                <div className="mt-auto">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {card.balance.toLocaleString("vi-VN")}₫
                    </p>
                </div>
            )}
        </div>
    );
}