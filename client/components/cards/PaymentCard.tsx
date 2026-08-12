import { ActionIcon } from "@/components/icons/ActionIcon";
import { cn } from "@/lib/utils";

type PaymentCardProps = {
    card: any;
    isSelected: boolean;
    onSelect: (id: string) => void;
    logoUrl?: string;
    cBg?: string;
    type: "credit" | "account";
    renderNetworkLogo?: (network: string) => React.ReactNode;
    /** First name of the card's owner — shown as a small badge for shared (not your own) cards */
    ownerLabel?: string;
};

export default function PaymentCard({
    card,
    isSelected,
    onSelect,
    logoUrl,
    cBg,
    type,
    renderNetworkLogo,
    ownerLabel,
}: PaymentCardProps) {
    return (
        <div
            onClick={() => onSelect(card._id)}
            className={cn(
                "relative snap-start shrink-0 w-[110px] h-[68px] p-1.5 rounded-xl border cursor-pointer flex flex-col transition-all",
                isSelected
                    ? "border-brand bg-brand-light/50 dark:bg-purple-900/20"
                    : "border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-600"
            )}
        >
            {/* Selected icon */}
            {isSelected && (
                <div className="absolute top-[-6px] right-[-6px] w-4 h-4 rounded-full border border-brand flex items-center justify-center bg-white dark:bg-surface">
                    <ActionIcon type="check" size={10} tile={false} color="#36255C" />
                </div>
            )}

            {/* Shared-card owner badge */}
            {ownerLabel && (
                <div className="absolute top-[-6px] left-[-6px] px-1.5 py-[1px] rounded-full bg-indigo-500 text-white text-[8px] font-bold shadow-sm truncate max-w-[70%]">
                    {ownerLabel}
                </div>
            )}

            {/* Top: logo (1.5× bigger for readability on phones) + bank name */}
            <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
                {logoUrl ? (
                    <div className="w-9 h-9 p-0.5 bg-white rounded-lg border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        <img src={logoUrl} className="w-full h-full object-contain" alt="logo" />
                    </div>
                ) : (
                    <div
                        className="w-9 h-9 rounded-lg text-white text-[10px] font-bold shadow-sm shrink-0 flex items-center justify-center text-center leading-none"
                        style={{ backgroundColor: cBg }}
                    >
                        {card.bankShortName?.slice(0, 4) || card.cardType?.toUpperCase()}
                    </div>
                )}

                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {card.bankName}
                </p>
            </div>

            {/* Bottom — balance (left) · last4 (right); network logo pinned to corner */}
            {type === "credit" ? (
                <div className="mt-auto flex items-center justify-between gap-2 pr-5 min-w-0">
                    <p className="text-[11px] font-bold text-red-500 dark:text-red-400 shrink-0">
                        {(card.balance / 1000000).toFixed(1).replace('.0', '')}tr
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider truncate">
                        ** {card.cardNumber || "...."}
                    </p>
                </div>
            ) : (
                <div className="mt-auto">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {card.balance.toLocaleString("vi-VN")}₫
                    </p>
                </div>
            )}

            {/* Card network logo — small, fixed at the bottom-right corner, out of
                the text flow so it never breaks the layout. */}
            {type === "credit" && renderNetworkLogo && (
                <div className="absolute bottom-1 right-1.5 scale-[0.68] origin-bottom-right pointer-events-none">
                    {renderNetworkLogo(card.cardNetwork)}
                </div>
            )}
        </div>
    );
}