'use client';
import { ActionIcon } from '@/components/icons/ActionIcon';

interface DayActionSheetProps {
    day: number | null;
    dateLabel: string;
    dateStr: string;
    onClose: () => void;
    onAddTransaction: (day: number, e: React.MouseEvent) => void;
    onAddImage: (dateStr: string) => void;
}

export default function DayActionSheet({ day, dateLabel, dateStr, onClose, onAddTransaction, onAddImage }: DayActionSheetProps) {
    if (day === null) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center animate-in slide-in-from-bottom duration-300">
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
                    {/* Handle */}
                    <button className="flex h-5 w-full items-center justify-center shrink-0 pt-2 pb-1 bg-white dark:bg-slate-900 z-10" onClick={onClose}>
                        <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                    </button>

                    {/* Header */}
                    <div className="flex items-center px-4 pb-2 shrink-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                        <h2 className="text-xl font-bold flex-1 text-center text-[#000000] dark:text-white">
                            Ngày {dateLabel}
                        </h2>
                    </div>

                    <div className="p-6 pb-28 grid grid-cols-2 gap-4">
                        <button
                            onClick={(e) => onAddTransaction(day, e)}
                            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all active:scale-95 border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-700"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                <ActionIcon type="plus" size={24} tile={false} color="#FFFFFF" />
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Giao dịch</span>
                        </button>
                        <button
                            onClick={() => onAddImage(dateStr)}
                            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all active:scale-95 border-2 border-transparent hover:border-emerald-200 dark:hover:border-emerald-700"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <ActionIcon type="image" size={24} tile={false} color="#FFFFFF" />
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Ảnh / Ghi chú</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
