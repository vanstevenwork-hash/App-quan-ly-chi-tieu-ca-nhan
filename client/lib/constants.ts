// Shared e-wallet / crypto exchange options for card & wealth-source selection.
// Used by dashboard, wealth, and CardFormModal — kept as one source of truth
// instead of being redefined (and recreated every render) in each file.
export const E_WALLETS = [
    { name: 'MoMo', short: 'MoMo', color: '#A21CAF', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-MoMo-Transparent.png' },
    { name: 'ZaloPay', short: 'ZLP', color: '#0284C7', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-ZaloPay-Square.png' },
    { name: 'Khác', short: '???', color: '#6C63FF', logo: '' },
];

export const CRYPTOS = [
    { name: 'Binance', short: 'BNB', color: '#F0B90B', logo: '' },
    { name: 'OKX', short: 'OKX', color: '#1C1C1E', logo: '' },
    { name: 'Bybit', short: 'BBT', color: '#F7A600', logo: '' },
];
