'use client';
import { useEffect, useMemo } from 'react';
import { useBanks } from '@/hooks/useBanks';
import { getBankLogo } from '@/lib/bankLogos';

// Resolves a bank logo the robust way: the VietQR bank API (covers virtually
// every bank incl. HSBC/Shinhan/Standard Chartered) first, then the static
// CDN map as a fallback. `getBankLogo` alone misses many banks, so pages that
// used it directly showed blank logos. Returns a `(shortName, name) => url?`.
// One lookup map per loaded bank list, shared by every caller (lists render
// dozens of CardThumbs — they must not each rebuild it).
const mapCache = new WeakMap<any[], Map<string, any>>();
function mapFor(banks: any[]) {
    let m = mapCache.get(banks);
    if (!m) {
        m = new Map();
        banks.forEach((b: any) => { if (b.shortName) m!.set(b.shortName.toUpperCase(), b); });
        mapCache.set(banks, m);
    }
    return m;
}

export function useBankLogo() {
    const banks = useBanks(s => s.banks);
    const fetchBanks = useBanks(s => s.fetchBanks);
    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    return useMemo(() => {
        const byShort = mapFor(banks);
        return (bankShortName?: string, bankName?: string): string | undefined =>
            byShort.get((bankShortName || '').toUpperCase())?.logo || getBankLogo(bankShortName, bankName);
    }, [banks]);
}
