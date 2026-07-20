'use client';
import { useEffect, useMemo } from 'react';
import { useBanks } from '@/hooks/useBanks';
import { getBankLogo } from '@/lib/bankLogos';

// Resolves a bank logo the robust way: the VietQR bank API (covers virtually
// every bank incl. HSBC/Shinhan/Standard Chartered) first, then the static
// CDN map as a fallback. `getBankLogo` alone misses many banks, so pages that
// used it directly showed blank logos. Returns a `(shortName, name) => url?`.
export function useBankLogo() {
    const banks = useBanks(s => s.banks);
    const fetchBanks = useBanks(s => s.fetchBanks);
    useEffect(() => { fetchBanks(); }, [fetchBanks]);

    const byShort = useMemo(() => {
        const m = new Map<string, any>();
        banks.forEach((b: any) => { if (b.shortName) m.set(b.shortName.toUpperCase(), b); });
        return m;
    }, [banks]);

    return useMemo(
        () => (bankShortName?: string, bankName?: string): string | undefined =>
            byShort.get((bankShortName || '').toUpperCase())?.logo || getBankLogo(bankShortName, bankName),
        [byShort]
    );
}
