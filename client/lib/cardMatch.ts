// Suggest a bundled design for an existing card from what the user already
// typed: bank, card label ("VIB Super card"), network and type.
import { designsFor, bankIdOf, type CardDesign } from './cardCatalog';
import catalog from './cardCatalog.json';

export interface MatchInput {
    bankShortName?: string;
    bankName?: string;          // the user's label for the card
    cardNetwork?: string;
    cardType?: string;
}

export interface DesignMatch {
    design: CardDesign;
    score: number;
    nameHits: number;           // label words found in the design name
}

export interface MatchResult {
    best: DesignMatch | null;
    // 'high': label words matched one design clearly → safe to pre-select
    // 'low' : only bank/network/type agree → a guess the user should confirm
    confidence: 'high' | 'low' | 'none';
    // the label names a product, but no design carries that name
    noNameMatch: boolean;
    candidates: DesignMatch[];  // ranked, for the "pick another" strip
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Words that say nothing about which product it is.
const GENERIC = new Set([
    'the', 'card', 'tin', 'dung', 'ghi', 'no', 'quoc', 'te', 'ngan', 'hang', 'bank', 'tmcp', 'viet', 'nam',
    'cong', 'thuong', 'credit', 'debit', 'cua', 'toi', 'chinh', 'phu', 'moi', 'cu', 'my',
]);
const NETWORK_WORDS: Record<string, string> = { visa: 'visa', mastercard: 'mastercard', master: 'mastercard', mc: 'mastercard', jcb: 'jcb', amex: 'amex', napas: 'napas' };

const BANK_WORDS = (() => {
    const out = new Set<string>();
    for (const [id, b] of Object.entries(catalog.banks as Record<string, { name: string; aliases: string[] }>)) {
        [id, b.name, ...b.aliases].forEach(x => norm(x).split(/[^a-z0-9]+/).filter(Boolean).forEach(w => out.add(w)));
        out.add(norm(id).replace(/[^a-z0-9]/g, ''));
    }
    return out;
})();

export function productWords(label: string): string[] {
    return norm(label).split(/[^a-z0-9]+/)
        .filter(w => w && !GENERIC.has(w) && !BANK_WORDS.has(w) && !NETWORK_WORDS[w]);
}
const networkInLabel = (label: string) => {
    for (const w of norm(label).split(/[^a-z0-9]+/)) if (NETWORK_WORDS[w]) return NETWORK_WORDS[w];
    return '';
};

// Damerau–Levenshtein (optimal string alignment) distance, capped for speed.
function editDistance(a: string, b: string): number {
    if (Math.abs(a.length - b.length) > 2) return 3;
    const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
    }
    return d[a.length][b.length];
}

// One label word vs the design's words:
//  exact · prefix ("max" → "maxcard") · typo ("plantium" → "platinum")
//  · glued in the design ("stepup" ⊂ "step"+"up")
function wordHits(w: string, dList: string[], joined: string): boolean {
    if (dList.includes(w)) return true;
    if (w.length >= 3 && dList.some(d => d.startsWith(w))) return true;
    if (w.length >= 5 && dList.some(d => editDistance(w, d) <= (w.length >= 7 ? 2 : 1))) return true;
    return w.length >= 5 && joined.includes(w);
}

// How many of the user's label words the design name covers. Two adjacent
// label words written apart ("travel one") also match a glued design word.
export function countHits(words: string[], dList: string[]): number {
    const joined = dList.join('');
    let hits = 0;
    for (let i = 0; i < words.length; i++) {
        if (i + 1 < words.length && dList.includes(words[i] + words[i + 1])) { hits += 2; i++; continue; }
        if (wordHits(words[i], dList, joined)) hits++;
    }
    return hits;
}

export function matchDesign(card: MatchInput): MatchResult {
    if (!bankIdOf(card.bankShortName, card.bankName)) return { best: null, confidence: 'none', noNameMatch: false, candidates: [] };
    const designs = designsFor(card.bankShortName, card.bankName, card.cardType);
    if (!designs.length) return { best: null, confidence: 'none', noNameMatch: false, candidates: [] };

    const label = card.bankName || '';
    const words = productWords(label);
    const network = card.cardNetwork || networkInLabel(label);
    const type = card.cardType === 'debit' ? 'debit' : card.cardType === 'credit' ? 'credit' : '';

    const scored = designs.map(design => {
        const dList = productWords(design.name);
        const nameHits = countHits(words, dList);
        let score = nameHits * 10;
        if (network && design.network) score += design.network === network ? 4 : -6;
        if (type) score += design.type === type ? 2 : -4;
        // with no product words, prefer the plainest design of the bank
        if (!words.length) score -= dList.length * 0.1;
        return { design, score, nameHits };
    }).sort((a, b) => b.score - a.score || a.design.name.length - b.design.name.length);

    const best = scored[0];
    const runnerUp = scored[1];
    const confidence: MatchResult['confidence'] =
        best.nameHits > 0 && best.nameHits === words.length && (!runnerUp || best.score > runnerUp.score) ? 'high' : 'low';
    return { best, confidence, noNameMatch: words.length > 0 && best.nameHits === 0, candidates: scored.slice(0, 12) };
}
