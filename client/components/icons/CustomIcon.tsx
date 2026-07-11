'use client';
import React from 'react';

const W = '#FFFFFF';

// ==========================================
// 1. DEFINITIONS & CONFIGURATIONS
// ==========================================

export const CATEGORY_ICON_LIST = [
    { type: 'anUong',        label: 'Ăn uống',           color: '#F59E0B', group: 'chi' },
    { type: 'muaSam',        label: 'Mua sắm',           color: '#8B5CF6', group: 'chi' },
    { type: 'diChuyen',      label: 'Di chuyển',         color: '#3B82F6', group: 'chi' },
    { type: 'giaiTri',       label: 'Giải trí',          color: '#EC4899', group: 'chi' },
    { type: 'sucKhoe',       label: 'Sức khỏe',          color: '#10B981', group: 'chi' },
    { type: 'hocTap',        label: 'Học tập',           color: '#F97316', group: 'chi' },
    { type: 'hoaDon',        label: 'Hóa đơn',           color: '#EF4444', group: 'chi' },
    { type: 'traTheTinDung', label: 'Trả thẻ tín dụng', color: '#DC2626', group: 'chi' },
    { type: 'crypto',        label: 'Crypto',            color: '#F7931A', group: 'chi' },
    { type: 'luong',         label: 'Lương',             color: '#22C55E', group: 'thu' },
    { type: 'freelance',     label: 'Freelance',         color: '#06B6D4', group: 'thu' },
    { type: 'dauTu',         label: 'Đầu tư',            color: '#6C63FF', group: 'thu' },
    { type: 'thuong',        label: 'Thưởng',            color: '#A855F7', group: 'thu' },
    { type: 'tienLai',       label: 'Tiền lãi',          color: '#14B8A6', group: 'thu' },
    { type: 'khac',          label: 'Khác',              color: '#6B7280', group: 'thu' },
    { type: 'soTietKiem',    label: 'Sổ tiết kiệm',     color: '#F0A319', group: 'taiSan' },
    { type: 'vang',          label: 'Vàng',              color: '#F59E0B', group: 'taiSan' },
    { type: 'bitcoin',       label: 'Bitcoin',           color: '#F97316', group: 'taiSan' },
    { type: 'cryptoKhac',    label: 'Crypto (khác)',     color: '#8B5CF6', group: 'taiSan' },
    { type: 'coPhieu',       label: 'Cổ phiếu',         color: '#10B981', group: 'taiSan' },
    { type: 'hoanTien',      label: 'Hoàn tiền',         color: '#EC4899', group: 'taiSan' },
    { type: 'affiliate',     label: 'Affiliate',         color: '#06B6D4', group: 'taiSan' },
    { type: 'batDongSan',    label: 'Bất động sản',     color: '#64748B', group: 'taiSan' },
];

export const CATEGORY_ICON_MAP = Object.fromEntries(
    CATEGORY_ICON_LIST.map((c) => [c.type, c])
);

export const CATEGORY_LABEL_TO_TYPE: Record<string, string> = {
    'Ăn uống': 'anUong',
    'Mua sắm': 'muaSam',
    'Di chuyển': 'diChuyen',
    'Giải trí': 'giaiTri',
    'Sức khỏe': 'sucKhoe',
    'Học tập': 'hocTap',
    'Hóa đơn': 'hoaDon',
    'Trả thẻ tín dụng': 'traTheTinDung',
    'Crypto': 'crypto',
    'Lương': 'luong',
    'Freelance': 'freelance',
    'Đầu tư': 'dauTu',
    'Thưởng': 'thuong',
    'Tiền lãi': 'tienLai',
    'Khác': 'khac',
    'Sổ tiết kiệm': 'soTietKiem',
    'Vàng': 'vang',
    'Bitcoin': 'bitcoin',
    'Crypto (khác)': 'cryptoKhac',
    'Cổ phiếu': 'coPhieu',
    'Hoàn tiền': 'hoanTien',
    'Affiliate': 'affiliate',
    'Bất động sản': 'batDongSan',
};

export const ACTIONS = [
    { type: 'plus', label: 'Thêm mới', color: '#10B981', group: 'action', tint: 0.14 },
    { type: 'check', label: 'Xác nhận', color: '#10B981', group: 'action', tint: 0.14 },
    { type: 'checkCheck', label: 'Hoàn tất', color: '#10B981', group: 'action', tint: 0.14 },
    { type: 'save', label: 'Lưu', color: '#6C63FF', group: 'action', tint: 0.14 },
    { type: 'pencil', label: 'Chỉnh sửa', color: '#3B82F6', group: 'action', tint: 0.14 },
    { type: 'minus', label: 'Bớt đi', color: '#F59E0B', group: 'action', tint: 0.14 },
    { type: 'x', label: 'Đóng', color: '#6B7280', group: 'action', tint: 0.14 },
    { type: 'trash', label: 'Xóa', color: '#EF4444', group: 'action', tint: 0.14 },
    { type: 'arrowLeft', label: 'Quay lại', color: '#6C63FF', group: 'action', tint: 0.14 },
    { type: 'chevronRight', label: 'Xem tiếp', color: '#94A3B8', group: 'action', tint: 0.1, noTile: true },
    { type: 'chevronLeft', label: 'Lùi lại', color: '#94A3B8', group: 'action', tint: 0.1, noTile: true },
    { type: 'chevronDown', label: 'Mở rộng', color: '#475569', group: 'action', noTile: true },
    { type: 'chevronUp', label: 'Thu gọn', color: '#475569', group: 'action', noTile: true },
    { type: 'lock', label: 'Khóa', color: '#6C63FF', group: 'action', tint: 0.14 },
    { type: 'eye', label: 'Hiện số dư', color: '#10B981', group: 'action', tint: 0.14 },
    { type: 'eyeOff', label: 'Ẩn số dư', color: '#EF4444', group: 'action', tint: 0.1 },
    { type: 'info', label: 'Thông tin', color: '#06B6D4', group: 'action', tint: 0.14 },
    { type: 'settings', label: 'Cài đặt', color: '#64748B', group: 'action', tint: 0.14 },
    { type: 'history', label: 'Lịch sử', color: '#8B5CF6', group: 'action', tint: 0.14 },
    { type: 'camera', label: 'Camera', color: '#EC4899', group: 'action', tint: 0.14 },
    { type: 'image', label: 'Thư viện', color: '#3B82F6', group: 'action', tint: 0.14 },
    { type: 'imagePlus', label: 'Thêm ảnh', color: '#8B5CF6', group: 'action', tint: 0.14 },
    { type: 'upload', label: 'Tải lên', color: '#06B6D4', group: 'action', tint: 0.14 },
    { type: 'mail', label: 'Email', color: '#F59E0B', group: 'action', tint: 0.14 },
    { type: 'user', label: 'Cá nhân', color: '#6C63FF', group: 'action', tint: 0.14 },
    { type: 'logOut', label: 'Đăng xuất', color: '#EF4444', group: 'action', tint: 0.1 },
    { type: 'moon', label: 'Chế độ tối', color: '#8B5CF6', group: 'action', tint: 0.14 },
    { type: 'loader', label: 'Đang tải', color: '#6C63FF', group: 'action', noTile: true },
    { type: 'calendar', label: 'Lịch', color: '#EC4899', group: 'action', tint: 0.14 },
    { type: 'creditCard', label: 'Thẻ tín dụng', color: '#6C63FF', group: 'action', tint: 0.14 },
];

export const ACTION_MAP = Object.fromEntries(ACTIONS.map((a) => [a.type, a]));

export const UTILITIES = [
    { type: 'piggyBank',    label: 'Tiết kiệm',   color: '#3B82F6' },
    { type: 'wallet',       label: 'Thẻ & ví',    color: '#6C63FF' },
    { type: 'target',       label: 'Mục tiêu',    color: '#6C63FF' },
    { type: 'trophy',       label: 'Hoàn thành',  color: '#F59E0B' },
    { type: 'trendingUp',   label: 'Thu nhập',    color: '#10B981' },
    { type: 'trendingDown', label: 'Chi tiêu',    color: '#EF4444' },
    { type: 'coins',        label: 'Cashback',    color: '#F59E0B' },
    { type: 'bell',         label: 'Thông báo',   color: '#6C63FF' },
    { type: 'checkCircle',  label: 'Đã nhận',     color: '#10B981' },
    { type: 'clock',        label: 'Đang chờ',    color: '#F59E0B' },
    { type: 'playingCards', label: 'Chơi bài',    color: '#8B5CF6' },
];

export const UTILITY_MAP = Object.fromEntries(UTILITIES.map((u) => [u.type, u]));

export const EXTRAS = [
  { type: "search", label: "Search", color: "#64748B", tint: null, noTile: true },
  { type: "copy", label: "Copy", color: "#6C63FF", tint: 0.14 },
  { type: "star", label: "Star", color: "#F59E0B", tint: 0.14 },
  { type: "alertCircle", label: "AlertCircle", color: "#EF4444", tint: 0.1 },
  { type: "alertTriangle", label: "AlertTriangle", color: "#F59E0B", tint: 0.1 },
  { type: "smartphone", label: "Smartphone", color: "#10B981", tint: 0.14 },
  { type: "eWallet", label: "Ví điện tử", color: "#8B5CF6", tint: 0.14 },
  { type: "theGhiNo", label: "Thẻ ghi nợ", color: "#3D7BF0", tint: 0.14 },
  { type: "percent", label: "Lãi suất", color: "#F59E0B", tint: 0.14 },
  { type: "globe", label: "Ngôn ngữ", color: "#3B82F6", tint: 0.14 },
  { type: "scanFace", label: "Face ID", color: "#8B5CF6", tint: 0.14 },
  { type: "download", label: "Tải xuống", color: "#06B6D4", tint: 0.14 },
  { type: "dollarSign", label: "Tiền tệ", color: "#22C55E", tint: 0.14 },
  { type: "bitcoin", label: "Bitcoin", color: "#F97316", tint: 0.14 },
  { type: "landmark", label: "Landmark", color: "#3B82F6", tint: 0.14 },
  { type: "briefcase", label: "Briefcase", color: "#06B6D4", tint: 0.14 },
  { type: "arrowRight", label: "ArrowRight", color: "#6C63FF", tint: null, noTile: true },
  { type: "arrowUpRight", label: "ArrowUpRight", color: "#EF4444", tint: null, noTile: true },
  { type: "arrowDownLeft", label: "ArrowDownLeft", color: "#10B981", tint: null, noTile: true },
  { type: "filter", label: "Filter", color: "#64748B", tint: 0.14 },
  { type: "alignJustify", label: "AlignJustify", color: "#94A3B8", tint: null, noTile: true },
  { type: "refreshCw", label: "RefreshCw", color: "#6C63FF", tint: 0.14 },
  { type: "scanLine", label: "ScanLine", color: "#8B5CF6", tint: 0.14 },
  { type: "receipt", label: "Receipt", color: "#F59E0B", tint: 0.14 },
  { type: "fileText", label: "FileText", color: "#64748B", tint: 0.14 },
  { type: "sparkles", label: "Sparkles", color: "#8B5CF6", tint: null, noTile: true },
  { type: "package", label: "Package", color: "#06B6D4", tint: 0.14 },
  { type: "shield", label: "Shield", color: "#10B981", tint: 0.14 },
  { type: "flame", label: "Flame", color: "#EF4444", tint: 0.14 },
  { type: "checkCircle2", label: "CheckCircle2", color: "#10B981", tint: 0.14 },
  { type: "badgeCheck", label: "BadgeCheck", color: "#6C63FF", tint: 0.14 },
  { type: "moreHorizontal", label: "MoreHorizontal", color: "#64748B", tint: null, noTile: true },
];

export const EXTRA_MAP = Object.fromEntries(EXTRAS.map((e) => [e.type, e]));

// Merge config lookup table
export const ICON_CONFIGS: Record<string, { label: string; color: string; tint?: number; noTile?: boolean; group: 'category' | 'action' | 'utility' }> = {};

CATEGORY_ICON_LIST.forEach(c => {
    ICON_CONFIGS[c.type] = { label: c.label, color: c.color, group: 'category' };
});
ACTIONS.forEach(a => {
    ICON_CONFIGS[a.type] = { label: a.label, color: a.color, tint: a.tint, noTile: a.noTile, group: 'action' };
});
UTILITIES.forEach(u => {
    ICON_CONFIGS[u.type] = { label: u.label, color: u.color, tint: 0.14, group: 'utility' };
});
EXTRAS.forEach(e => {
    ICON_CONFIGS[e.type] = { label: e.label, color: e.color, tint: e.tint ?? undefined, noTile: e.noTile, group: 'utility' };
});

// Helper for stroke configuration
const stroke = (C: string, w = 2.4) => ({
    stroke: C,
    strokeWidth: w,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
});

const s = (C: string, w = 2.4) => ({
  stroke: C,
  strokeWidth: w,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
});

const STAR_PATH =
  "M12 2.5 L14.6 8.4 L21 9.1 L16.2 13.4 L17.6 19.7 L12 16.3 L6.4 19.7 L7.8 13.4 L3 9.1 L9.4 8.4 Z";

// ==========================================
// 2. PATH GLYPHS DICTIONARY
// ==========================================

const GLYPHS: Record<string, (C: string) => React.ReactNode> = {
    // ---- Category Glyphs ----
    anUong: (C) => (<>
        <path d="M4.5 11 A7.5 7.5 0 0 0 19.5 11 L4.5 11 Z" fill={C} />
        <rect x="9" y="19" width="6" height="1.8" rx="0.9" fill={C} />
        <path d="M7.5 4 L9.5 10.5 M12 3 L12.5 10.5" stroke={C} strokeWidth="1.7" strokeLinecap="round" fill="none" />
        <path d="M9 7 Q9.5 5.5 9 4.5 M12 7 Q12.5 5.5 12 4.5" stroke={C} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.55" />
    </>),
    muaSam: (C) => (<>
        <rect x="5" y="9" width="14" height="11" rx="2.5" fill={C} />
        <path d="M9 9 V7 a3 3 0 0 1 6 0 V9" stroke={C} strokeWidth="2" fill="none" strokeLinecap="round" />
        <rect x="9.5" y="9" width="5" height="2" rx="1" fill={W} opacity="0.8" />
    </>),
    diChuyen: (C) => (<>
        <rect x="3" y="11" width="18" height="6" rx="1.8" fill={C} />
        <path d="M6 11 L8 7.5 Q9 6.5 10.5 6.5 H13.5 Q15 6.5 16 7.5 L18 11 Z" fill={C} />
        <path d="M9 10.5 L10 8 H14 L15 10.5 Z" fill={W} opacity="0.85" />
        <circle cx="7.5" cy="17" r="2" fill={W} />
        <circle cx="16.5" cy="17" r="2" fill={W} />
    </>),
    giaiTri: (C) => (<>
        <rect x="3.5" y="7.8" width="17" height="9.6" rx="4.8" fill={C} />
        <rect x="7" y="11.4" width="4" height="1.6" rx="0.8" fill={W} />
        <rect x="8.4" y="10" width="1.6" height="4.2" rx="0.8" fill={W} />
        <circle cx="15" cy="11.2" r="1" fill={W} />
        <circle cx="17.2" cy="13" r="1" fill={W} />
        <circle cx="15" cy="14.8" r="1" fill={W} />
        <circle cx="12.8" cy="13" r="1" fill={W} />
    </>),
    sucKhoe: (C) => (<>
        <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" fill={C} />
        <rect x="10.9" y="8" width="2.2" height="8" rx="1.1" fill={W} />
        <rect x="8" y="10.9" width="8" height="2.2" rx="1.1" fill={W} />
    </>),
    hocTap: (C) => (<>
        <rect x="5" y="4" width="14" height="16" rx="2.2" fill={C} />
        <rect x="8" y="4" width="1.4" height="16" fill={W} opacity="0.7" />
        <rect x="11" y="8" width="5" height="1.4" rx="0.7" fill={W} />
        <rect x="11" y="11" width="4" height="1.4" rx="0.7" fill={W} />
        <rect x="11" y="14" width="5" height="1.4" rx="0.7" fill={W} />
    </>),
    hoaDon: (C) => (<>
        <rect x="5" y="3.5" width="14" height="17" rx="2" fill={C} />
        <rect x="8" y="7.5" width="8" height="1.4" rx="0.7" fill={W} />
        <rect x="8" y="10.5" width="6" height="1.4" rx="0.7" fill={W} />
        <rect x="8" y="13.5" width="8" height="1.4" rx="0.7" fill={W} />
        <path d="M5 19.5 L6.5 17.5 L8 19.5 L9.5 17.5 L11 19.5 L12.5 17.5 L14 19.5 L15.5 17.5 L17 19.5 L18.5 17.5 L19 19.5" stroke={W} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
    </>),
    traTheTinDung: (C) => (<>
        <rect x="2.8" y="5.5" width="18.4" height="13" rx="3" fill={C} />
        <rect x="2.8" y="8.8" width="18.4" height="2.6" fill={W} opacity="0.5" />
        <rect x="5.6" y="13.8" width="4" height="1.8" rx="0.9" fill={W} />
        <rect x="14" y="13.2" width="4.2" height="2.8" rx="0.8" fill={W} opacity="0.6" />
    </>),
    crypto: (C) => (<>
        <circle cx="12" cy="12" r="9" fill={C} />
        <text x="12" y="16.5" textAnchor="middle" fill={W} fontSize="11.5" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">₿</text>
    </>),
    luong: (C) => (<>
        <rect x="2.8" y="6.5" width="18.4" height="11" rx="2.2" fill={C} />
        <ellipse cx="12" cy="12" rx="3" ry="2.8" stroke={W} strokeWidth="1.5" fill="none" />
        <circle cx="6" cy="12" r="1" fill={W} />
        <circle cx="18" cy="12" r="1" fill={W} />
    </>),
    freelance: (C) => (<>
        <rect x="5" y="5.5" width="14" height="9.5" rx="1.8" fill={C} />
        <rect x="7" y="7.5" width="10" height="5.5" rx="0.8" fill={W} opacity="0.85" />
        <rect x="3" y="16" width="18" height="2.2" rx="1.1" fill={C} />
        <rect x="9.5" y="16.4" width="5" height="1.4" rx="0.7" fill={W} opacity="0.6" />
    </>),
    dauTu: (C) => (<>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill={C} />
        <path d="M7 15.5 L10.5 12 L12.8 14 L17 9.5" stroke={W} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M14.4 9.3 H17 V11.9" stroke={W} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>),
    thuong: (C) => (<>
        <rect x="3.8" y="7" width="16.4" height="3.8" rx="1.4" fill={C} />
        <rect x="5" y="11.4" width="14" height="8.6" rx="1.8" fill={C} />
        <rect x="11" y="7" width="2" height="13" fill={W} opacity="0.8" />
        <rect x="3.8" y="10.5" width="16.4" height="1" fill={W} opacity="0.6" />
        <path d="M8.2 6.6 a1.9 1.9 0 1 1 3.8 0 M12 6.6 a1.9 1.9 0 1 1 3.8 0" stroke={C} strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </>),
    tienLai: (C) => (<>
        <path d="M12 3.5 L20.5 9 H3.5 Z" fill={C} />
        <rect x="5" y="10.2" width="2.6" height="7" fill={C} />
        <rect x="10.7" y="10.2" width="2.6" height="7" fill={C} />
        <rect x="16.4" y="10.2" width="2.6" height="7" fill={C} />
        <rect x="3.6" y="18.4" width="16.8" height="2" rx="1" fill={C} />
    </>),
    khac: (C) => (<>
        <rect x="4" y="7" width="16" height="13" rx="2.2" fill={C} />
        <path d="M4 10 H20" stroke={W} strokeWidth="1.3" opacity="0.6" />
        <path d="M4 13 H20" stroke={W} strokeWidth="1.3" opacity="0.6" />
        <rect x="11.2" y="7" width="1.6" height="3" fill={W} opacity="0.7" />
        <rect x="11.2" y="10" width="1.6" height="3" fill={W} opacity="0.7" />
    </>),
    // Sổ tiết kiệm: bìa sổ + gáy + nhãn, đồng xu ₫ chồng góc dưới phải
    soTietKiem: (C) => (<>
        <rect x="7.2" y="5.8" width="12" height="13.8" rx="1.3" fill={C} opacity="0.5" />
        <rect x="6" y="5" width="12" height="14.6" rx="1.3" fill={C} />
        <rect x="8.4" y="5" width="1.5" height="14.6" fill={W} opacity="0.55" />
        <rect x="10.7" y="7.1" width="6.2" height="0.9" rx="0.45" fill={W} />
        <rect x="10.7" y="8.9" width="4.4" height="0.75" rx="0.38" fill={W} opacity="0.75" />
        <circle cx="17.2" cy="16.5" r="4" fill={W} />
        <circle cx="17.2" cy="16.5" r="3.25" fill={C} />
        <text x="17.2" y="17.9" textAnchor="middle" fill={W} fontSize="4.2" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">₫</text>
    </>),
    vang: (C) => (<>
        <rect x="8" y="8" width="12" height="6.5" rx="1.8" fill={C} opacity="0.55" />
        <rect x="4" y="12" width="12" height="6.5" rx="1.8" fill={C} />
        <rect x="5.5" y="13.2" width="9" height="1.2" rx="0.6" fill={W} opacity="0.5" />
    </>),
    bitcoin: (C) => (<>
        <circle cx="12" cy="12" r="9" fill={C} />
        <text x="12" y="16.5" textAnchor="middle" fill={W} fontSize="11.5" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">₿</text>
    </>),
    cryptoKhac: (C) => (<>
        <circle cx="12" cy="12" r="8.8" fill={C} />
        <circle cx="12" cy="12" r="5.2" stroke={W} strokeWidth="1.6" fill="none" />
        <circle cx="12" cy="12" r="1.8" fill={W} />
    </>),
    coPhieu: (C) => (<>
        <rect x="4.5" y="12.5" width="3.6" height="8" rx="1.4" fill={C} />
        <rect x="10.2" y="8" width="3.6" height="12.5" rx="1.4" fill={C} />
        <rect x="15.9" y="4" width="3.6" height="16.5" rx="1.4" fill={C} />
    </>),
    // Huy hiệu 8 cánh (như tem giảm giá) với dấu % khoét trắng
    hoanTien: (C) => (<>
        <path d="M18.93 9.13
                 A2.95 2.95 0 0 0 14.87 5.07
                 A2.95 2.95 0 0 0 9.13 5.07
                 A2.95 2.95 0 0 0 5.07 9.13
                 A2.95 2.95 0 0 0 5.07 14.87
                 A2.95 2.95 0 0 0 9.13 18.93
                 A2.95 2.95 0 0 0 14.87 18.93
                 A2.95 2.95 0 0 0 18.93 14.87
                 A2.95 2.95 0 0 0 18.93 9.13 Z" fill={C} />
        <path d="M15.4 8.6 8.6 15.4" stroke={W} strokeWidth="1.7" strokeLinecap="round" fill="none" />
        <circle cx="9.25" cy="9.25" r="1.25" fill={W} />
        <circle cx="14.75" cy="14.75" r="1.25" fill={W} />
    </>),
    // Two fanned playing cards with a spade glyph on the front card
    playingCards: (C) => (<>
        <rect x="4.2" y="3.4" width="11" height="15.5" rx="2.3" fill={C} opacity="0.55" transform="rotate(-11 9.7 11.15)" />
        <rect x="8.3" y="4.6" width="11" height="15.5" rx="2.3" fill={C} />
        <text x="13.8" y="15.2" fontSize="10" fontWeight="700" fill={W} textAnchor="middle" fontFamily="sans-serif">♠</text>
    </>),
    affiliate: (C) => (<>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill={C} />
        <rect x="5" y="10.2" width="6.4" height="3.6" rx="1.8" stroke={W} strokeWidth="1.5" fill="none" />
        <rect x="12.6" y="10.2" width="6.4" height="3.6" rx="1.8" stroke={W} strokeWidth="1.5" fill="none" />
        <rect x="10.5" y="11" width="3" height="2" fill={C} />
        <rect x="11.2" y="10.9" width="1.6" height="2.2" fill={W} />
    </>),
    batDongSan: (C) => (<>
        <path d="M12 3.8 L20.2 10.6 V17.4 A2.6 2.6 0 0 1 17.6 20 H6.4 A2.6 2.6 0 0 1 3.8 17.4 V10.6 Z" fill={C} />
        <rect x="10" y="14" width="4" height="6" rx="2" fill={W} opacity="0.9" />
        <rect x="6" y="11.5" width="3.5" height="3" rx="0.8" fill={W} opacity="0.7" />
        <rect x="14.5" y="11.5" width="3.5" height="3" rx="0.8" fill={W} opacity="0.7" />
    </>),

    // ---- Action/System Glyphs ----
    plus: (C) => <path d="M12 5 V19 M5 12 H19" {...stroke(C)} />,
    check: (C) => <path d="M4.5 12.5 l4.5 4.5 L19.5 6.5" {...stroke(C)} />,
    checkCheck: (C) => (
        <>
            <path d="M3 12.8 l4 4 L15.5 8.3" {...stroke(C, 2.2)} />
            <path d="M12.4 15.4 l1.4 1.4 L21.2 8.3" {...stroke(C, 2.2)} />
        </>
    ),
    save: (C) => (
        <>
            <path d="M4 6.2 A2.2 2.2 0 0 1 6.2 4 h9.3 L20 8.5 v9.3 a2.2 2.2 0 0 1 -2.2 2.2 H6.2 A2.2 2.2 0 0 1 4 17.8 Z" fill={C} />
            <rect x="7.8" y="13" width="8.4" height="7" rx="1" fill={W} />
            <rect x="9" y="4" width="6.4" height="4.4" rx="0.8" fill={W} />
            <rect x="12.7" y="4.9" width="1.7" height="2.6" rx="0.6" fill={C} />
        </>
    ),
    pencil: (C) => (
        <g transform="rotate(45 12 12)">
            <rect x="10.6" y="3.6" width="2.8" height="12.8" rx="1.4" fill={C} />
            <path d="M10.6 16.4 h2.8 L12 20 Z" fill={C} />
            <rect x="10.6" y="5.8" width="2.8" height="1.4" fill={W} />
        </g>
    ),
    minus: (C) => <path d="M5 12 H19" {...stroke(C)} />,
    x: (C) => <path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" {...stroke(C)} />,
    trash: (C) => (
        <>
            <rect x="4" y="5.4" width="16" height="2" rx="1" fill={C} />
            <path d="M9.5 5.2 V4.6 a1.2 1.2 0 0 1 1.2 -1.2 h2.6 a1.2 1.2 0 0 1 1.2 1.2 v0.6" {...stroke(C, 1.6)} />
            <path d="M5.7 8.6 h12.6 l-0.9 9.5 a2.2 2.2 0 0 1 -2.2 2 H8.8 a2.2 2.2 0 0 1 -2.2 -2 Z" fill={C} />
            <rect x="9.7" y="11" width="1.5" height="5.6" rx="0.75" fill={W} />
            <rect x="12.8" y="11" width="1.5" height="5.6" rx="0.75" fill={W} />
        </>
    ),
    arrowLeft: (C) => <path d="M19 12 H5 M5 12 l5.5 -5.5 M5 12 l5.5 5.5" {...stroke(C)} />,
    chevronRight: (C) => <path d="M9.5 5.5 L16 12 L9.5 18.5" {...stroke(C)} />,
    chevronLeft: (C) => <path d="M14.5 5.5 L8 12 L14.5 18.5" {...stroke(C)} />,
    chevronDown: (C) => <path d="M5.5 9.5 L12 16 L18.5 9.5" {...stroke(C)} />,
    chevronUp: (C) => <path d="M5.5 14.5 L12 8 L18.5 14.5" {...stroke(C)} />,
    lock: (C) => (
        <>
            <path d="M8.2 10.2 V7.8 a3.8 3.8 0 0 1 7.6 0 V10.2" {...stroke(C, 2)} />
            <rect x="4.8" y="10" width="14.4" height="10" rx="2.6" fill={C} />
            <circle cx="12" cy="14" r="1.5" fill={W} />
            <rect x="11.25" y="14.8" width="1.5" height="2.8" rx="0.75" fill={W} />
        </>
    ),
    eye: (C) => (
        <>
            <path d="M2.8 12 C6 6.4 18 6.4 21.2 12 C18 17.6 6 17.6 2.8 12 Z" fill={C} />
            <circle cx="12" cy="12" r="3.2" fill={W} />
            <circle cx="12" cy="12" r="1.5" fill={C} />
        </>
    ),
    eyeOff: (C) => (
        <>
            <path d="M2.8 12 C6 6.4 18 6.4 21.2 12 C18 17.6 6 17.6 2.8 12 Z" fill={C} />
            <circle cx="12" cy="12" r="3.2" fill={W} />
            <circle cx="12" cy="12" r="1.5" fill={C} />
            <path d="M5 19.5 L19 4.5" stroke={W} strokeWidth="2.2" strokeLinecap="round" />
        </>
    ),
    info: (C) => (
        <>
            <circle cx="12" cy="12" r="8.8" fill={C} />
            <circle cx="12" cy="8.2" r="1.3" fill={W} />
            <rect x="10.9" y="10.6" width="2.2" height="6.2" rx="1.1" fill={W} />
        </>
    ),
    settings: (C) => (
        <>
            <path d="M20.2 12 L16.1 4.9 H7.9 L3.8 12 L7.9 19.1 H16.1 Z" fill={C} stroke={C} strokeWidth="2.4" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3.1" fill={W} />
        </>
    ),
    history: (C) => (
        <>
            <circle cx="13.2" cy="12" r="8" fill={C} />
            <path d="M13.2 7.8 V12 l3 1.8" {...stroke(W, 1.8)} />
            <path d="M2 8.6 h2.6 M1.4 12 h3.2 M2 15.4 h2.6" {...stroke(C, 1.7)} />
        </>
    ),
    camera: (C) => (
        <>
            <path d="M8.3 7.2 L9.6 4.8 a1.3 1.3 0 0 1 1.1 -0.6 h2.6 a1.3 1.3 0 0 1 1.1 0.6 L15.7 7.2 Z" fill={C} />
            <rect x="3" y="7" width="18" height="13" rx="3" fill={C} />
            <circle cx="12" cy="13.2" r="4" fill={W} />
            <circle cx="12" cy="13.2" r="2.2" fill={C} />
            <circle cx="18.3" cy="9.5" r="0.9" fill={W} />
        </>
    ),
    image: (C) => (
        <>
            <rect x="3.2" y="4.5" width="17.6" height="15" rx="2.6" fill={C} />
            <circle cx="8.6" cy="9.2" r="1.7" fill={W} />
            <path d="M4.2 18.4 L8.9 13.5 l3.2 3.2 3.7 -4.3 4.4 4.9 v0.6 a1.4 1.4 0 0 1 -1.4 1.3 H5.6 A1.4 1.4 0 0 1 4.2 18.4 Z" fill={W} />
        </>
    ),
    imagePlus: (C) => (
        <>
            <rect x="3" y="5.8" width="15.6" height="13.6" rx="2.6" fill={C} />
            <circle cx="7.8" cy="10" r="1.5" fill={W} />
            <path d="M3.9 18.3 L8 14 l2.8 2.8 3.3 -3.8 3.5 3.9 v0.5 a1.3 1.3 0 0 1 -1.3 1.2 H5.2 A1.3 1.3 0 0 1 3.9 18.3 Z" fill={W} />
            <circle cx="19" cy="6.4" r="3.9" fill={C} />
            <path d="M19 4.6 v3.6 M17.2 6.4 h3.6" {...stroke(W, 1.5)} />
        </>
    ),
    upload: (C) => (
        <>
            <path d="M4 15.8 v2 a2.2 2.2 0 0 0 2.2 2.2 h11.6 a2.2 2.2 0 0 0 2.2 -2.2 v-2" {...stroke(C, 2.2)} />
            <path d="M12 14.6 V4.4 M12 4.4 l-4 4 M12 4.4 l4 4" {...stroke(C, 2.2)} />
        </>
    ),
    mail: (C) => (
        <>
            <rect x="3" y="5.5" width="18" height="13.5" rx="2.6" fill={C} />
            <path d="M4.6 7.6 L12 13.4 L19.4 7.6" {...stroke(W, 1.8)} />
        </>
    ),
    user: (C) => (
        <>
            <circle cx="12" cy="8.4" r="4" fill={C} />
            <path d="M4.6 20 a7.4 7.4 0 0 1 14.8 0 Z" fill={C} />
        </>
    ),
    logOut: (C) => (
        <>
            <path d="M13.5 4 H7 a2.2 2.2 0 0 0 -2.2 2.2 v11.6 A2.2 2.2 0 0 0 7 20 h6.5" {...stroke(C, 2.2)} />
            <path d="M10.5 12 H20.5 M20.5 12 l-3.4 -3.4 M20.5 12 l-3.4 3.4" {...stroke(C, 2.2)} />
        </>
    ),
    moon: (C) => (
        <>
            <path d="M20 13.5 A8.5 8.5 0 1 1 10.5 4 a6.8 6.8 0 0 0 9.5 9.5 Z" fill={C} />
            <circle cx="17.6" cy="6" r="1.1" fill={C} />
        </>
    ),
    loader: (C) => <path d="M12 3.2 A8.8 8.8 0 1 1 3.2 12" {...stroke(C)} />,
    calendar: (C) => (
        <>
            <rect x="7.3" y="2.4" width="1.9" height="5" rx="0.95" fill={C} />
            <rect x="14.8" y="2.4" width="1.9" height="5" rx="0.95" fill={C} />
            <rect x="3" y="4.8" width="18" height="16" rx="4" fill={C} />
            <rect x="3" y="9.4" width="18" height="1.5" fill={W} />
            <circle cx="8" cy="14.4" r="1.3" fill={W} />
            <circle cx="12" cy="14.4" r="1.3" fill={W} />
            <circle cx="16" cy="14.4" r="1.3" fill={W} />
            <circle cx="8" cy="17.9" r="1.3" fill={W} />
            <circle cx="12" cy="17.9" r="1.3" fill={W} />
        </>
    ),
    creditCard: (C) => (
        <>
            <rect x="2.6" y="5.8" width="18.8" height="13.2" rx="3.4" fill={C} />
            <rect x="2.6" y="8.9" width="18.8" height="2.5" fill={W} />
            <rect x="5.4" y="13.9" width="3.8" height="2" rx="1" fill={W} />
            <rect x="10.6" y="14.4" width="5.2" height="1" rx="0.5" fill={W} opacity="0.75" />
        </>
    ),

    // ---- Utility Glyphs ----
    piggyBank: (C) => (<>
        <path d="M8 7.8 L10.8 5.2 L12 8.2 Z" fill={C} />
        <ellipse cx="11.5" cy="13" rx="8.3" ry="6.2" fill={C} />
        <rect x="18.4" y="11" width="3.2" height="4" rx="1.5" fill={C} />
        <rect x="6.5" y="18" width="2.2" height="2.6" rx="1" fill={C} />
        <rect x="14.5" y="18" width="2.2" height="2.6" rx="1" fill={C} />
        <rect x="9.4" y="8.4" width="4.8" height="1.4" rx="0.7" fill={W} />
        <circle cx="15.8" cy="11" r="1" fill={W} />
    </>),
    wallet: (C) => (<>
        <rect x="2.8" y="6" width="18.4" height="13" rx="2.6" fill={C} />
        <rect x="14.6" y="10.2" width="6.6" height="4.6" rx="1.8" fill={W} />
        <circle cx="17.4" cy="12.5" r="1.1" fill={C} />
    </>),
    target: (C) => (<>
        <circle cx="12" cy="12" r="8.8" fill={C} />
        <circle cx="12" cy="12" r="5.3" fill={W} />
        <circle cx="12" cy="12" r="2.6" fill={C} />
    </>),
    trophy: (C) => (<>
        <path d="M7 4 h10 v4.6 a5 5 0 0 1 -10 0 Z" fill={C} />
        <path d="M7 5.5 C4.4 5.5 4.4 9.2 7.2 9.5 M17 5.5 C19.6 5.5 19.6 9.2 16.8 9.5" stroke={C} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <rect x="10.9" y="13.2" width="2.2" height="3.2" fill={C} />
        <rect x="8" y="16.4" width="8" height="2.2" rx="1" fill={C} />
        <circle cx="12" cy="8" r="1.4" fill={W} />
    </>),
    trendingUp: (C) => (<>
        <path d="M3.5 16.5 L9.5 10.5 L13 13.8 L20.5 6.5" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M15.8 6.3 H20.6 V11.1" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>),
    trendingDown: (C) => (<>
        <path d="M3.5 7.5 L9.5 13.5 L13 10.2 L20.5 17.5" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M15.8 17.7 H20.6 V12.9" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>),
    coins: (C) => (<>
        <circle cx="9" cy="9.6" r="6" fill={C} opacity="0.5" />
        <circle cx="14" cy="14" r="6.6" fill={C} />
        <circle cx="14" cy="14" r="3.8" stroke={W} strokeWidth="1.5" fill="none" />
    </>),
    bell: (C) => (<>
        <path d="M12 3.4 a5.7 5.7 0 0 1 5.7 5.7 v3.3 l1.6 2.7 a1 1 0 0 1 -0.86 1.5 H5.56 a1 1 0 0 1 -0.86 -1.5 l1.6 -2.7 V9.1 A5.7 5.7 0 0 1 12 3.4 Z" fill={C} />
        <path d="M9.8 18.6 a2.2 2.2 0 0 0 4.4 0 Z" fill={C} />
    </>),
    checkCircle: (C) => (<>
        <circle cx="12" cy="12" r="8.8" fill={C} />
        <path d="M8.2 12 l2.4 2.4 L16.2 9" stroke={W} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>),
    clock: (C) => (<>
        <circle cx="12" cy="12" r="8.8" fill={C} />
        <path d="M12 7.4 V12 l3 1.8" stroke={W} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>),
    search: (C: string) => (
        <>
            <circle cx="10" cy="10" r="6.3" stroke={C} strokeWidth="2.4" fill="none" />
            <path d="M14.9 14.9 L20 20" stroke={C} strokeWidth="2.4" strokeLinecap="round" />
        </>
    ),
    copy: (C: string) => (
        <>
            <rect x="7" y="3" width="13" height="13" rx="2.4" fill={C} />
            <rect x="3.3" y="7.3" width="13" height="13" rx="2.4" fill={C} stroke={W} strokeWidth="1.6" />
        </>
    ),
    star: (C: string) => <path d={STAR_PATH} fill={C} />,
    alertCircle: (C: string) => (
        <>
            <circle cx="12" cy="12" r="8.8" fill={C} />
            <rect x="10.9" y="6.5" width="2.2" height="7" rx="1.1" fill={W} />
            <circle cx="12" cy="17" r="1.3" fill={W} />
        </>
    ),
    alertTriangle: (C: string) => (
        <>
            <path
                d="M12 3.3 L21.3 19.4 a1.7 1.7 0 0 1 -1.47 2.6 H4.17 a1.7 1.7 0 0 1 -1.47 -2.6 Z"
                fill={C}
            />
            <rect x="10.9" y="9.4" width="2.2" height="6" rx="1.1" fill={W} />
            <circle cx="12" cy="17.6" r="1.3" fill={W} />
        </>
    ),
    // Lãi suất: đồng xu 2 lớp lệch nhau, ký hiệu % khoét âm bản
    percent: (C: string) => (
        <>
            <circle cx="9.6" cy="9.4" r="7" fill={C} opacity="0.45" />
            <circle cx="12.8" cy="12.6" r="8" fill={C} />
            <path d="M9.6 16 L16 9.4" stroke={W} strokeWidth="1.7" strokeLinecap="round" fill="none" />
            <circle cx="10" cy="10" r="1.7" fill={W} />
            <circle cx="10" cy="10" r="0.7" fill={C} />
            <circle cx="15.5" cy="15.4" r="1.7" fill={W} />
            <circle cx="15.5" cy="15.4" r="0.7" fill={C} />
        </>
    ),
    // Ngôn ngữ: quả địa cầu + bong bóng chat "A" chồng góc, viền khoét tách lớp
    globe: (C: string) => (
        <>
            <circle cx="10.8" cy="12.5" r="8.3" fill={C} />
            <ellipse cx="10.8" cy="12.5" rx="3.7" ry="8.3" stroke={W} strokeWidth="1.25" fill="none" />
            <path d="M2.7 12.5 H18.9" stroke={W} strokeWidth="1.25" />
            <path d="M4 8.4 H17.6 M4 16.6 H17.6" stroke={W} strokeWidth="1" opacity="0.6" fill="none" />
            <path d="M13.7 3.3 h5.9 a2.2 2.2 0 0 1 2.2 2.2 v3.4 a2.2 2.2 0 0 1 -2.2 2.2 h-1.1 l-2.1 2.2 v-2.2 h-2.7 a2.2 2.2 0 0 1 -2.2 -2.2 V5.5 a2.2 2.2 0 0 1 2.2 -2.2 Z" fill={W} />
            <path d="M14.1 4.3 h5.1 a1.7 1.7 0 0 1 1.7 1.7 v3 a1.7 1.7 0 0 1 -1.7 1.7 h-1 l-1.3 1.4 v-1.4 h-1.8 a1.7 1.7 0 0 1 -1.7 -1.7 V6 a1.7 1.7 0 0 1 1.7 -1.7 Z" fill={C} />
            <text x="16.65" y="9.4" textAnchor="middle" fill={W} fontSize="4.6" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">A</text>
        </>
    ),
    // Face ID: khung quét 4 góc + mặt cười trên tấm nền đặc
    scanFace: (C: string) => (
        <>
            <path d="M3.6 8.2 V6.2 A2.6 2.6 0 0 1 6.2 3.6 H8.2 M15.8 3.6 h2 A2.6 2.6 0 0 1 20.4 6.2 V8.2 M20.4 15.8 v2 a2.6 2.6 0 0 1 -2.6 2.6 H15.8 M8.2 20.4 H6.2 A2.6 2.6 0 0 1 3.6 17.8 V15.8" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <rect x="7" y="7" width="10" height="10" rx="3.2" fill={C} />
            <circle cx="10.2" cy="10.7" r="1" fill={W} />
            <circle cx="13.8" cy="10.7" r="1" fill={W} />
            <path d="M9.9 13.7 c1.2 1.15 3 1.15 4.2 0" stroke={W} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </>
    ),
    // Xuất dữ liệu: tờ tài liệu gấp góc + huy hiệu mũi tên tải xuống chồng góc
    download: (C: string) => (
        <>
            <path d="M6.2 3.4 H13.6 L17.6 7.4 V17 a2.2 2.2 0 0 1 -2.2 2.2 H6.2 A2.2 2.2 0 0 1 4 17 V5.6 a2.2 2.2 0 0 1 2.2 -2.2 Z" fill={C} />
            <path d="M13.6 3.4 V7.4 H17.6 Z" fill={W} opacity="0.85" />
            <rect x="6.8" y="9.2" width="6" height="1.1" rx="0.55" fill={W} opacity="0.8" />
            <rect x="6.8" y="11.6" width="4.4" height="1.1" rx="0.55" fill={W} opacity="0.6" />
            <circle cx="16.3" cy="16.2" r="4.6" fill={W} />
            <circle cx="16.3" cy="16.2" r="3.8" fill={C} />
            <path d="M16.3 14 v3.3 M14.8 15.8 l1.5 1.5 1.5 -1.5" stroke={W} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
    ),
    // Tiền tệ: hai đồng xu ₫/$ chồng nhau kiểu quy đổi
    dollarSign: (C: string) => (
        <>
            <circle cx="8.8" cy="8.8" r="6.2" fill={C} opacity="0.5" />
            <text x="8.8" y="10.9" textAnchor="middle" fill={W} fontSize="6" fontWeight="800" opacity="0.8" fontFamily="system-ui,-apple-system,sans-serif">₫</text>
            <circle cx="14.2" cy="13.8" r="7.2" fill={W} />
            <circle cx="14.2" cy="13.8" r="6.5" fill={C} />
            <text x="14.2" y="16.6" textAnchor="middle" fill={W} fontSize="8" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">$</text>
        </>
    ),
    // Thẻ ghi nợ: 2 lớp thẻ + dải từ, chip, số thẻ và sóng contactless
    theGhiNo: (C: string) => (
        <>
            <rect x="5.3" y="5.8" width="15.7" height="10.3" rx="1.45" fill={C} opacity="0.5" />
            <rect x="4.1" y="7" width="15.7" height="10.3" rx="1.45" fill={C} />
            <rect x="4.1" y="9.1" width="15.7" height="2.15" fill={W} />
            <rect x="5.7" y="12.6" width="2.9" height="2.15" rx="0.48" fill={W} />
            <rect x="6.1" y="13" width="2.05" height="1.25" rx="0.28" fill={C} opacity="0.55" />
            <circle cx="10.3" cy="15.35" r="0.42" fill={W} />
            <circle cx="11.5" cy="15.35" r="0.42" fill={W} />
            <circle cx="12.8" cy="15.35" r="0.42" fill={W} />
            <rect x="14" y="14.9" width="4.2" height="0.9" rx="0.45" fill={W} />
            <g stroke={W} strokeWidth="0.6" strokeLinecap="round" fill="none">
                <path d="M16.7 13.2 a1.26 1.26 0 0 1 0 -1.8" />
                <path d="M17.9 13.8 a2.16 2.16 0 0 1 0 -3" />
            </g>
        </>
    ),
    // Ví điện tử: thân ví + thẻ thò ra, ngăn bấm bên phải và tia sét thanh toán nhanh
    eWallet: (C: string) => (
        <>
            <rect x="6.4" y="4.6" width="11.3" height="4.1" rx="1" fill={C} opacity="0.55" />
            <rect x="4.4" y="6.4" width="15.3" height="12.4" rx="1.75" fill={C} />
            <path d="M19.7 10.6 H15.75 C14.5 10.6 13.5 11.6 13.5 12.85 C13.5 14.1 14.5 15.1 15.75 15.1 H19.7 Z" fill={W} />
            <circle cx="15.9" cy="12.85" r="1" fill={C} />
            <path d="M8.5 9.6 L6.75 13.4 H8.5 L7.6 16.75 L11 12.25 H9.1 L10.15 9.6 Z" fill={W} />
        </>
    ),
    smartphone: (C: string) => (
        <>
            <rect x="7" y="2" width="10" height="20" rx="2.6" fill={C} />
            <rect x="10" y="18.6" width="4" height="1.4" rx="0.7" fill={W} />
            <rect x="10.5" y="4" width="3" height="1" rx="0.5" fill={W} />
        </>
    ),

    landmark: (C: string) => (
        <>
            <path d="M3.3 9.2 L12 3.4 L20.7 9.2 Z" fill={C} />
            <rect x="3.3" y="9.2" width="17.4" height="1.8" fill={C} />
            <rect x="4" y="11.4" width="16" height="6" fill={C} />
            <rect x="6.4" y="11.4" width="1.4" height="6" fill={W} />
            <rect x="10.3" y="11.4" width="1.4" height="6" fill={W} />
            <rect x="14.2" y="11.4" width="1.4" height="6" fill={W} />
            <rect x="3" y="17.8" width="18" height="2" rx="0.6" fill={C} />
        </>
    ),
    briefcase: (C: string) => (
        <>
            <path
                d="M9 6.4 V5 a1.4 1.4 0 0 1 1.4 -1.4 h3.2 A1.4 1.4 0 0 1 15 5 v1.4"
                stroke={C}
                strokeWidth="1.8"
                fill="none"
            />
            <rect x="3" y="6.4" width="18" height="12.2" rx="2.6" fill={C} />
            <rect x="3" y="9.6" width="18" height="1.6" fill={W} opacity="0.9" />
            <rect x="10.6" y="11" width="2.8" height="2.4" rx="0.6" fill={W} />
        </>
    ),
    arrowRight: (C: string) => <path d="M4 12 H20 M14 6 L20 12 L14 18" {...s(C)} />,
    arrowUpRight: (C: string) => <path d="M6 18 L18 6 M10 6 H18 V14" {...s(C)} />,
    arrowDownLeft: (C: string) => <path d="M18 6 L6 18 M6 10 V18 H14" {...s(C)} />,
    filter: (C: string) => (
        <path
            d="M4 5 H20 L14.5 12.2 V18.5 L9.5 20.3 V12.2 Z"
            stroke={C}
            strokeWidth="2.2"
            strokeLinejoin="round"
            fill="none"
        />
    ),
    alignJustify: (C: string) => (
        <path d="M4 5.6 H20 M4 10.2 H20 M4 14.8 H20 M4 19.4 H20" {...s(C, 2.2)} />
    ),
    refreshCw: (C: string) => (
        <>
            <path
                d="M5.2 12 A6.8 6.8 0 0 1 17.3 7.2"
                stroke={C}
                strokeWidth="2.2"
                fill="none"
                markerEnd="url(#cb-arrow)"
            />
            <path
                d="M18.8 12 A6.8 6.8 0 0 1 6.7 16.8"
                stroke={C}
                strokeWidth="2.2"
                fill="none"
                markerEnd="url(#cb-arrow)"
            />
        </>
    ),
    scanLine: (C: string) => (
        <>
            <path d="M4 8 V4 H8 M16 4 H20 V8 M4 16 V20 H8 M20 16 V20 H16" {...s(C, 2)} />
            <path d="M4 12 H20" stroke={C} strokeWidth="2" strokeLinecap="round" />
        </>
    ),
    receipt: (C: string) => (
        <>
            <path
                d="M5 3 H19 V18.5 L17 20 L15 18.5 L13 20 L11 18.5 L9 20 L7 18.5 L5 20 Z"
                fill={C}
            />
            <rect x="7.5" y="6.5" width="9" height="1.4" fill={W} />
            <rect x="7.5" y="10" width="9" height="1.4" fill={W} />
            <rect x="7.5" y="13.5" width="6" height="1.4" fill={W} />
        </>
    ),
    fileText: (C: string) => (
        <>
            <path d="M6 3 H14.5 L18 6.5 V21 H6 Z" fill={C} />
            <path d="M14.5 3 V6.5 H18 Z" fill={W} />
            <rect x="8.5" y="10" width="7" height="1.3" fill={W} />
            <rect x="8.5" y="13" width="7" height="1.3" fill={W} />
            <rect x="8.5" y="16" width="5" height="1.3" fill={W} />
        </>
    ),
    sparkles: (C: string) => (
        <>
            <path d={STAR_PATH} fill={C} />
            <g transform="translate(15.5,2) scale(0.32)">
                <path d={STAR_PATH} fill={C} />
            </g>
            <g transform="translate(1,15) scale(0.28)">
                <path d={STAR_PATH} fill={C} />
            </g>
        </>
    ),
    package: (C: string) => (
        <>
            <rect x="4" y="6" width="16" height="13" rx="2" fill={C} />
            <path d="M4 6 L12 10 L20 6" stroke={W} strokeWidth="1.6" fill="none" />
            <path d="M12 10 V19" stroke={W} strokeWidth="1.6" />
        </>
    ),
    shield: (C: string) => (
        <>
            <path
                d="M12 3 L19.5 6 V11.5 C19.5 16 16.2 19.3 12 21 C7.8 19.3 4.5 16 4.5 11.5 V6 Z"
                fill={C}
            />
            <path
                d="M8.3 12.2 l2.6 2.6 L16.2 9.3"
                stroke={W}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </>
    ),
    flame: (C: string) => (
        <path
            d="M12 2.5 C9 7 6.5 9.5 6.5 13.5 A5.5 5.5 0 0 0 17.5 13.5 C17.5 11 16 9.5 15 10.5 C15.4 7.5 13.8 4.5 12 2.5 Z"
            fill={C}
        />
    ),
    checkCircle2: (C: string) => (
        <>
            <circle cx="12" cy="12" r="8.8" fill={C} />
            <path
                d="M8 12.2 l2.7 2.7 L16.2 9.3"
                stroke={W}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </>
    ),
    badgeCheck: (C: string) => (
        <>
            <path
                d="M12 2.3 L14.6 4 L17.6 3.5 L18.6 6.4 L21.2 8.2 L20.1 11 L21.2 13.8 L18.6 15.6 L17.6 18.5 L14.6 18 L12 19.7 L9.4 18 L6.4 18.5 L5.4 15.6 L2.8 13.8 L3.9 11 L2.8 8.2 L5.4 6.4 L6.4 3.5 L9.4 4 Z"
                fill={C}
            />
            <path
                d="M8.3 12 l2.6 2.6 L16 9.3"
                stroke={W}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </>
    ),
    moreHorizontal: (C: string) => (
        <>
            <circle cx="6.5" cy="12" r="1.9" fill={C} />
            <circle cx="12" cy="12" r="1.9" fill={C} />
            <circle cx="17.5" cy="12" r="1.9" fill={C} />
        </>
    ),
};

// ==========================================
// 3. COMPONENT IMPLEMENTATION
// ==========================================

export interface CustomIconProps extends React.SVGProps<SVGSVGElement> {
    type: string;
    size?: number;
    tile?: boolean;
    color?: string;
    spin?: boolean;
}

export const CustomIcon = ({ type, size = 40, tile, color, spin = false, ...props }: CustomIconProps) => {
    const cfg = ICON_CONFIGS[type];
    if (!cfg) return null;

    const C = color || cfg.color;
    const glyphFn = GLYPHS[type];
    if (!glyphFn) return null;

    const glyph = glyphFn(C);
    
    // Determine whether to show tile background
    const showTile = tile !== undefined ? tile : (cfg.group === 'category' ? true : !cfg.noTile);

    const spinStyle = spin
        ? { animation: 'cb-spin 0.9s linear infinite', transformOrigin: 'center' }
        : undefined;

    const defsArrow = (
        <defs>
            <marker
                id="cb-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
            >
                <path
                    d="M2 1L8 5L2 9"
                    fill="none"
                    stroke="context-stroke"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </marker>
        </defs>
    );

    return (
        <>
            {spin && (
                <style>{'@keyframes cb-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}'}</style>
            )}
            {showTile ? (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 36 36"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    aria-label={cfg.label}
                    style={{ flexShrink: 0, ...spinStyle }}
                    {...props}
                >
                    {type === "refreshCw" && defsArrow}
                    <rect width="36" height="36" rx="10" fill={C} fillOpacity={cfg.tint ?? 0.14} />
                    <g transform="translate(6,6)">{glyph}</g>
                </svg>
            ) : (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    aria-label={cfg.label}
                    style={{ flexShrink: 0, ...spinStyle }}
                    {...props}
                >
                    {type === "refreshCw" && defsArrow}
                    {glyph}
                </svg>
            )}
        </>
    );
};

// ==========================================
// 4. BACKWARD COMPATIBILITY ALIASES
// ==========================================

export const CategoryIcon = ({ type, ...props }: any) => <CustomIcon type={type} {...props} />;
export const ActionIcon = ({ type, ...props }: any) => <CustomIcon type={type} {...props} />;
export const UtilityIcon = ({ type, ...props }: any) => <CustomIcon type={type} {...props} />;

// ==========================================
// 5. HELPER COMPONENTS
// ==========================================

interface CategoryPickerProps {
    value?: string;
    onChange?: (type: string) => void;
    group?: 'chi' | 'thu' | 'taiSan';
}

export const CategoryPicker = ({ value, onChange, group }: CategoryPickerProps) => {
    const list = group ? CATEGORY_ICON_LIST.filter((c) => c.group === group) : CATEGORY_ICON_LIST;
    return (
        <div className="grid grid-cols-4 gap-3">
            {list.map((c) => {
                const isActive = value === c.type;
                return (
                    <button key={c.type} type="button" onClick={() => onChange?.(c.type)}
                        className="flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all"
                        style={{ backgroundColor: isActive ? `${c.color}22` : 'transparent', outline: isActive ? `1.5px solid ${c.color}` : 'none' }}>
                        <CustomIcon type={c.type} size={44} />
                        <span className="text-[11px] text-gray-600 dark:text-slate-300 text-center leading-tight">{c.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default CustomIcon;
