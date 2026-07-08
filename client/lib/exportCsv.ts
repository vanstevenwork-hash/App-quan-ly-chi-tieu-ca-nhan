interface ExportableTransaction {
    type: 'income' | 'expense';
    amount: number;
    category: string;
    note?: string;
    date: string;
    paymentMethod?: string;
    cardId?: { bankShortName?: string } | null;
}

const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Tiền mặt',
    card: 'Thẻ',
    transfer: 'Chuyển khoản',
};

const csvEscape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
};

const paymentLabel = (t: ExportableTransaction) => {
    if (t.paymentMethod === 'card' && t.cardId?.bankShortName) return `Thẻ - ${t.cardId.bankShortName}`;
    return PAYMENT_LABELS[t.paymentMethod || ''] || '';
};

export function exportTransactionsToCsv(transactions: ExportableTransaction[], filename: string) {
    const header = ['Ngày', 'Loại', 'Danh mục', 'Ghi chú', 'Số tiền (đ)', 'Phương thức'];
    const rows = transactions.map(t => [
        new Date(t.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        t.type === 'income' ? 'Thu nhập' : 'Chi tiêu',
        t.category,
        t.note || '',
        String(t.amount),
        paymentLabel(t),
    ]);
    const csvBody = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
    // Leading BOM so Excel detects UTF-8 and renders Vietnamese diacritics correctly.
    const BOM = String.fromCharCode(0xFEFF);
    const blob = new Blob([BOM + csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
