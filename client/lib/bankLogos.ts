/**
 * Vietnamese bank logo URLs from public CDN.
 * Keys are bank short names (uppercase) as stored in bankShortName field.
 */
const CDN = 'https://api.vietqr.io/img';

export const BANK_LOGOS: Record<string, string> = {
    'VCB': `${CDN}/vcb.png`,
    'BIDV': `${CDN}/bidv.png`,
    'VTB': `${CDN}/vietinbank.png`,
    'CTG': `${CDN}/vietinbank.png`,
    'VIETINBANK': `${CDN}/vietinbank.png`,
    'ACB': `${CDN}/acb.png`,
    'TCB': `${CDN}/techcombank.png`,
    'TECHCOMBANK': `${CDN}/techcombank.png`,
    'MBB': `${CDN}/mb.png`,
    'MB': `${CDN}/mb.png`,
    'VPB': `${CDN}/vpbank.png`,
    'VPBANK': `${CDN}/vpbank.png`,
    'VIB': `${CDN}/vib.png`,
    'STB': `${CDN}/sacombank.png`,
    'SACOMBANK': `${CDN}/sacombank.png`,
    'MSB': `${CDN}/msb.png`,
    'SHB': `${CDN}/shb.png`,
    'HDB': `${CDN}/hdbank.png`,
    'HDBANK': `${CDN}/hdbank.png`,
    'TPB': `${CDN}/tpbank.png`,
    'TPBANK': `${CDN}/tpbank.png`,
    'OCB': `${CDN}/ocb.png`,
    'NAB': `${CDN}/namabank.png`,
    'NAMABANK': `${CDN}/namabank.png`,
    'EIB': `${CDN}/eximbank.png`,
    'EXIMBANK': `${CDN}/eximbank.png`,
    'SCB': `${CDN}/scb.png`,
    'PVB': `${CDN}/pvcombank.png`,
    'VAB': `${CDN}/vietabank.png`,
    'SEAB': `${CDN}/seabank.png`,
    'BAB': `${CDN}/bacabank.png`,
    'BACABANK': `${CDN}/bacabank.png`,
    'LPB': `${CDN}/lpbank.png`,
    'CAKE': `${CDN}/cake.png`,
    'UOB': `${CDN}/uob.png`,
    'HSBC': `${CDN}/hsbc.png`,
    'ANZ': `${CDN}/anz.png`,
    'CITI': `${CDN}/citibank.png`,
    'MOMO': 'https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png',
    'ZALOPAY': 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-ZaloPay-Square.png',
    'VNPAY': 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-VNPay-QR.png',
};

/**
 * Get logo URL from bankShortName OR bankName (fallback lookup).
 * Returns undefined if bank is not recognized.
 */
export function getBankLogo(bankShortName?: string, bankName?: string): string | undefined {
    // 1. Direct match by shortName (e.g. "VIB", "TCB")
    if (bankShortName) {
        const key = bankShortName.toUpperCase().trim();
        if (BANK_LOGOS[key]) return BANK_LOGOS[key];
    }

    if (bankName) {
        const upper = bankName.toUpperCase().trim();
        // 2. Exact match by full bankName
        if (BANK_LOGOS[upper]) return BANK_LOGOS[upper];
        // 3. bankName STARTS WITH a known key — handles "VIB SUPER CARD" → "VIB"
        for (const [k, v] of Object.entries(BANK_LOGOS)) {
            if (upper.startsWith(k + ' ') || upper === k) return v;
        }
        // 4. bankName CONTAINS a known key as a whole word
        for (const [k, v] of Object.entries(BANK_LOGOS)) {
            const re = new RegExp(`\\b${k}\\b`);
            if (re.test(upper)) return v;
        }
    }
    return undefined;
}
