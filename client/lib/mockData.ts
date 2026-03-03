// Mock data for UI preview when not connected to backend
export const mockUser = {
    _id: '1',
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@email.com',
    avatar: '',
    currency: 'VND',
};

export const mockTransactions = [
    { _id: '1', type: 'expense', amount: 120000, category: 'Ăn uống', note: 'Bữa trưa văn phòng', date: '2026-03-01', paymentMethod: 'cash' },
    { _id: '2', type: 'expense', amount: 450000, category: 'Mua sắm', note: 'Siêu thị WinMart', date: '2026-02-28', paymentMethod: 'card' },
    { _id: '3', type: 'income', amount: 15000000, category: 'Lương', note: 'Lương tháng 3', date: '2026-02-28', paymentMethod: 'transfer' },
    { _id: '4', type: 'expense', amount: 49000, category: 'Di chuyển', note: 'Grab Transport', date: '2026-02-27', paymentMethod: 'cash' },
    { _id: '5', type: 'expense', amount: 120000, category: 'Nhà thuốc', note: 'Nhà thuốc Pharmacy', date: '2026-02-27', paymentMethod: 'cash' },
    { _id: '6', type: 'expense', amount: 350000, category: 'Giải trí', note: 'Spotify Premium', date: '2026-02-26', paymentMethod: 'card' },
    { _id: '7', type: 'income', amount: 2500000, category: 'Freelance', note: 'Dự án thiết kế', date: '2026-02-25', paymentMethod: 'transfer' },
    { _id: '8', type: 'expense', amount: 85000, category: 'Ăn uống', note: 'Cà phê buổi sáng', date: '2026-02-25', paymentMethod: 'cash' },
];

export const mockAccounts = [
    { _id: '1', name: 'Vietcombank', type: 'bank', balance: 15631220, color: '#6C63FF', icon: 'building-2', accountNumber: '****1234' },
    { _id: '2', name: 'Techcombank', type: 'bank', balance: 4220000, color: '#3B82F6', icon: 'credit-card', accountNumber: '****5678' },
    { _id: '3', name: 'VIB Online Saving', type: 'saving', balance: 50000000, color: '#10B981', icon: 'piggy-bank', accountNumber: '' },
    { _id: '4', name: 'Ví tiền mặt', type: 'wallet', balance: 2340000, color: '#F59E0B', icon: 'wallet', accountNumber: '' },
];

export const mockBudgets = [
    { _id: '1', category: 'Ăn uống', limit: 3000000, spent: 1840000, color: '#F59E0B', icon: 'utensils', month: 3, year: 2026 },
    { _id: '2', category: 'Mua sắm', limit: 2000000, spent: 1500000, color: '#8B5CF6', icon: 'shopping-bag', month: 3, year: 2026 },
    { _id: '3', category: 'Di chuyển', limit: 1000000, spent: 2500000, color: '#EF4444', icon: 'car', month: 3, year: 2026 },
    { _id: '4', category: 'Giải trí', limit: 1500000, spent: 350000, color: '#EC4899', icon: 'music', month: 3, year: 2026 },
    { _id: '5', category: 'Sức khỏe', limit: 500000, spent: 120000, color: '#10B981', icon: 'heart', month: 3, year: 2026 },
];

export const mockGoals = [
    { _id: '1', name: 'Mua xe ô tô', targetAmount: 850000000, currentAmount: 450000000, deadline: '2027-12-31', color: '#6C63FF', icon: 'car' },
    { _id: '2', name: 'Quỹ khẩn cấp', targetAmount: 20000000, currentAmount: 8000000, deadline: '2026-06-30', color: '#10B981', icon: 'shield' },
    { _id: '3', name: 'Du lịch Nhật Bản', targetAmount: 30000000, currentAmount: 12000000, deadline: '2026-12-31', color: '#F59E0B', icon: 'plane' },
];

export const mockChartData = [
    { name: 'T1', income: 17500000, expense: 8200000 },
    { name: 'T2', income: 15000000, expense: 12400000 },
    { name: 'T3', income: 17500000, expense: 9800000 },
    { name: 'T4', income: 16000000, expense: 11200000 },
    { name: 'T5', income: 18500000, expense: 10600000 },
    { name: 'T6', income: 15500000, expense: 9400000 },
    { name: 'T7', income: 17000000, expense: 8800000 },
];

export const mockCategoryBreakdown = [
    { _id: 'Ăn uống', total: 1840000, count: 12, color: '#F59E0B' },
    { _id: 'Mua sắm', total: 1500000, count: 5, color: '#8B5CF6' },
    { _id: 'Di chuyển', total: 980000, count: 20, color: '#3B82F6' },
    { _id: 'Giải trí', total: 750000, count: 4, color: '#EC4899' },
    { _id: 'Sức khỏe', total: 320000, count: 3, color: '#10B981' },
    { _id: 'Khác', total: 460000, count: 8, color: '#6B7280' },
];

export const CATEGORIES = [
    { id: 'food', label: 'Ăn uống', icon: '🍜', color: '#F59E0B' },
    { id: 'shopping', label: 'Mua sắm', icon: '🛍️', color: '#8B5CF6' },
    { id: 'transport', label: 'Di chuyển', icon: '🚗', color: '#3B82F6' },
    { id: 'entertainment', label: 'Giải trí', icon: '🎮', color: '#EC4899' },
    { id: 'health', label: 'Sức khỏe', icon: '💊', color: '#10B981' },
    { id: 'education', label: 'Học tập', icon: '📚', color: '#F97316' },
    { id: 'bills', label: 'Hóa đơn', icon: '💡', color: '#EF4444' },
    { id: 'credit-pay', label: 'Trả thẻ tín dụng', icon: '💳', color: '#DC2626' },
    { id: 'crypto', label: 'Crypto', icon: '₿', color: '#F7931A' },
    { id: 'salary', label: 'Lương', icon: '💰', color: '#22C55E' },
    { id: 'freelance', label: 'Freelance', icon: '💻', color: '#06B6D4' },
    { id: 'investment', label: 'Đầu tư', icon: '📈', color: '#6C63FF' },
    { id: 'bonus', label: 'Thưởng', icon: '🎁', color: '#A855F7' },
    { id: 'interest', label: 'Tiền lãi', icon: '🏦', color: '#14B8A6' },
    { id: 'other', label: 'Khác', icon: '📦', color: '#6B7280' },
];

export const formatCurrency = (amount: number, currency = 'VND') => {
    if (currency === 'VND') {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

export const formatShortCurrency = (amount: number) => {
    if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(1)}tỷ`;
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}tr`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
    return amount.toLocaleString('vi-VN');
};

export const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
