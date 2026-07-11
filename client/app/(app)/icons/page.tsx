'use client';
import { useMemo, useState } from 'react';
import {
    CustomIcon,
    CATEGORY_ICON_LIST,
    ACTIONS,
    UTILITIES,
    EXTRAS,
} from '@/components/icons/CustomIcon';
import PageHeader from '@/components/PageHeader';

type Group = { title: string; items: { type: string; label: string; color: string }[] };

const GROUPS: Group[] = [
    { title: 'Danh mục Thu/Chi/Tài sản', items: CATEGORY_ICON_LIST },
    { title: 'Action (thao tác, UI)', items: ACTIONS },
    { title: 'Utility (tính năng)', items: UTILITIES },
    { title: 'Extra (khác)', items: EXTRAS },
];

function IconCard({ type, label, color }: { type: string; label: string; color: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(type);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };
    return (
        <button
            onClick={copy}
            className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-surface p-3 hover:border-purple-300 dark:hover:border-purple-500/50 hover:shadow-md transition-all active:scale-95"
        >
            <div className="flex items-center gap-2">
                <CustomIcon type={type} size={40} tile />
                <CustomIcon type={type} size={26} tile={false} color={color} />
            </div>
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 text-center leading-tight truncate w-full">{label}</p>
            <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate w-full text-center">
                {copied ? 'Đã copy!' : type}
            </p>
        </button>
    );
}

export default function IconsReviewPage() {
    const [query, setQuery] = useState('');

    const filteredGroups = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return GROUPS;
        return GROUPS.map(g => ({
            ...g,
            items: g.items.filter(i => i.type.toLowerCase().includes(q) || i.label.toLowerCase().includes(q)),
        })).filter(g => g.items.length > 0);
    }, [query]);

    const total = GROUPS.reduce((s, g) => s + g.items.length, 0);
    const totalFiltered = filteredGroups.reduce((s, g) => s + g.items.length, 0);

    return (
        <div className="min-h-screen pb-16 bg-[#F8F9FF] dark:bg-surface-deep transition-colors duration-200">
            <PageHeader title="Bộ icon" subtitle={`${total} icon đã vẽ`} />

            <div className="px-5 pt-2 space-y-6">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Tìm theo tên hoặc type…"
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-surface px-4 py-2.5 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
                {query && (
                    <p className="text-xs text-slate-400 -mt-4">{totalFiltered} kết quả</p>
                )}

                {filteredGroups.map(group => (
                    <section key={group.title}>
                        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 px-1">
                            {group.title} <span className="text-slate-300 dark:text-slate-600">({group.items.length})</span>
                        </h2>
                        <div className="grid grid-cols-3 gap-2.5">
                            {group.items.map(item => (
                                <IconCard key={item.type} type={item.type} label={item.label} color={item.color} />
                            ))}
                        </div>
                    </section>
                ))}

                {filteredGroups.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-12">Không tìm thấy icon nào khớp "{query}"</p>
                )}
            </div>
        </div>
    );
}
