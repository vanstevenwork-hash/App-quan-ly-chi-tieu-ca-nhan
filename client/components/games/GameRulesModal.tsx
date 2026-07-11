'use client';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { ActionIcon } from '@/components/icons/ActionIcon';
import type { GameType } from '@/hooks/useGameMatches';

interface GameRulesModalProps {
    open: boolean;
    onClose: () => void;
    gameType: GameType;
}

const TIEN_LEN_RULES: { title: string; lines: string[] }[] = [
    {
        title: 'Bắt đầu',
        lines: [
            'Người giữ 3♠ đi trước, nước đầu tiên bắt buộc phải có lá 3♠.',
            'Thứ tự lớn dần: 3 < 4 < … < K < A < 2 (heo). Chất: ♠ < ♣ < ♦ < ♥.',
        ],
    },
    {
        title: 'Bộ bài hợp lệ',
        lines: [
            'Bài lẻ, đôi, sám (3 lá cùng số).',
            'Sảnh: 3 lá trở lên liên tiếp (không chứa 2).',
            '3 đôi thông / 4 đôi thông: 3–4 đôi liên tiếp.',
            'Tứ quý: 4 lá cùng số.',
        ],
    },
    {
        title: 'Chặt heo',
        lines: [
            'Tứ quý & 3 đôi thông chặt được heo lẻ; tứ quý chặt được cả đôi heo.',
            '4 đôi thông chặt được heo, đôi heo, tứ quý và 3 đôi thông.',
        ],
    },
    {
        title: 'Kết thúc & tính điểm',
        lines: [
            'Ai hết bài trước là Nhất — ván dừng ngay, người còn lại xếp hạng theo số lá còn trên tay.',
            'Tính thối: mỗi lá còn lại = 1đ, mỗi heo = 2đ. Bị cóng (chưa đánh được lá nào) nhân đôi.',
            'Bị chặt heo: +2đ/heo (tứ quý, 3 đôi thông), +3đ/heo (4 đôi thông).',
            'Hết giờ lượt sẽ tự động bỏ lượt.',
        ],
    },
];

const PHOM_RULES: { title: string; lines: string[] }[] = [
    {
        title: 'Bắt đầu',
        lines: [
            'Người đi đầu nhận 10 lá và đánh 1 lá rác ngay; những người còn lại nhận 9 lá.',
        ],
    },
    {
        title: 'Mỗi lượt',
        lines: [
            'Ăn lá rác đối thủ vừa đánh (chỉ khi lá đó tạo được phỏm với bài trên tay) hoặc bốc 1 lá từ nọc.',
            'Sau đó đánh ra đúng 1 lá rác.',
        ],
    },
    {
        title: 'Phỏm là gì',
        lines: [
            '3 lá trở lên cùng số (VD: 7♠ 7♣ 7♦).',
            'Hoặc 3 lá trở lên liên tiếp cùng chất (VD: 4♥ 5♥ 6♥).',
            'Các lá đã vào phỏm được nhấc lên và viền vàng trong tay bài.',
        ],
    },
    {
        title: 'Kết thúc & tính điểm',
        lines: [
            'Mỗi người đánh đúng 4 lượt, sau đó tính điểm bài rác (bài không nằm trong phỏm).',
            'Điểm rác: A = 1đ, J/Q/K = 10đ, còn lại theo số trên lá.',
            'Ù (0 điểm rác) thắng ngay lập tức. Hết 4 lượt: ai ít điểm rác nhất thắng.',
        ],
    },
];

export default function GameRulesModal({ open, onClose, gameType }: GameRulesModalProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted || !open) return null;

    const sections = gameType === 'phom' ? PHOM_RULES : TIEN_LEN_RULES;
    const title = gameType === 'phom' ? 'Luật chơi Phỏm' : 'Luật chơi Tiến lên miền Nam';

    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md max-h-[80vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/12 bg-[#032f34] shadow-[0_25px_60px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">📖</span>
                        <h2 className="text-base font-black text-white">{title}</h2>
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70" aria-label="Đóng">
                        <ActionIcon type="x" size={14} tile={false} color="currentColor" />
                    </button>
                </div>
                <div className="overflow-y-auto px-5 pb-8 space-y-4">
                    {sections.map(section => (
                        <div key={section.title} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                            <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-emerald-300/80">{section.title}</p>
                            <ul className="space-y-1.5">
                                {section.lines.map((line, i) => (
                                    <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-white/80">
                                        <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-emerald-300/60" />
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
