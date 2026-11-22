import { describe, it, expect } from 'vitest';
import { matchDesign, productWords } from './cardMatch';

describe('productWords', () => {
    it('drops bank, network and generic words', () => {
        expect(productWords('Thẻ tín dụng VIB Super card')).toEqual(['super']);
        expect(productWords('Techcombank Visa')).toEqual([]);
        expect(productWords('Ngân hàng TMCP Công thương Việt Nam')).toEqual([]);
    });
});

describe('matchDesign', () => {
    it('label words pick the product with high confidence', () => {
        const r = matchDesign({ bankShortName: 'VIB', bankName: 'VIB Super card', cardType: 'credit' });
        expect(r.confidence).toBe('high');
        expect(r.best!.design.name.toLowerCase()).toContain('super');
    });
    it('works with bank codes (VPB) as well as names', () => {
        const r = matchDesign({ bankShortName: 'VPB', bankName: 'VPBank Commcredit', cardType: 'credit' });
        expect(r.best!.design.id).toBe('VPBank/commcredit');
        expect(r.confidence).toBe('high');
    });
    it('only bank + network known → a low-confidence guess on the right network', () => {
        const r = matchDesign({ bankShortName: 'TCB', bankName: 'Techcombank', cardNetwork: 'visa', cardType: 'credit' });
        expect(r.confidence).toBe('low');
        expect(r.best!.design.bank).toBe('Techcombank');
        expect(r.best!.design.network).toBe('visa');
    });
    it('network written in the label counts', () => {
        const r = matchDesign({ bankShortName: 'MB', bankName: 'MB JCB', cardType: 'credit' });
        expect(r.best!.design.network).toBe('jcb');
    });
    it('unknown bank → no match', () => {
        expect(matchDesign({ bankShortName: 'MoMo', bankName: 'MoMo', cardType: 'eWallet' }).confidence).toBe('none');
    });
    it('returns ranked alternatives for manual pick', () => {
        const r = matchDesign({ bankShortName: 'VCB', bankName: 'Vietcombank', cardType: 'credit' });
        expect(r.candidates.length).toBeGreaterThan(3);
        expect(r.candidates.every(c => c.design.bank === 'Vietcombank')).toBe(true);
    });
});

// The owner's real card names (pasted from the live app) — guards the matcher.
describe('real card names', () => {
    const cases: [string, string, string, string][] = [
        ['SHB', 'SHB World Mastercard', 'mastercard', 'SHB/mastercard-world'],
        ['MBBank', 'MBBank mastercard plantium Mastercard', 'mastercard', 'MBBank/mastercard-platinum'],   // typo
        ['Techcombank', 'Techcombank Everyday', '', 'Techcombank/visa-platinum-everyday'],
        ['MBBank', 'MBBank jcb ultimate', '', 'MBBank/jcb-ultimate-kim-loai'],
        ['VIB', 'VIB Max Visa', 'visa', 'VIB/maxcard-visa-platinum'],                                      // prefix
        ['VPBank', 'VPBank Stepup', '', 'VPBank/step-up-mastercard'],                                      // glued
        ['BIDV', 'BIDV JCB Ulti', '', 'BIDV/jcb-ultimate'],
        ['HSBC', 'HSBC Travel One', '', 'HSBC/travelone'],                                                 // split
        ['VietCapitalBank', 'Bvb jcb sense', '', 'VietCapitalBank/jcb-platinum-sense'],                    // BVB alias
        ['VIB', 'Vib super card Amex', 'amex', 'VIB/super-card-american-express-platinum'],
        ['VIB', 'VIB 2in1 Mastercard', 'mastercard', 'VIB/mastercard-online-plus-2in1'],
    ];
    it.each(cases)('%s · %s', (bankShortName, bankName, cardNetwork, id) => {
        const r = matchDesign({ bankShortName, bankName, cardNetwork, cardType: 'credit' });
        expect(r.confidence).toBe('high');
        expect(r.best!.design.id).toBe(id);
    });
    it('a product with no design is flagged, not silently guessed', () => {
        const r = matchDesign({ bankShortName: 'ShinhanBank', bankName: 'ShinhanBank mylife', cardType: 'credit' });
        expect(r.confidence).toBe('low');
        expect(r.noNameMatch).toBe(true);
    });
    it('bank without designs → none', () => {
        expect(matchDesign({ bankShortName: 'Citibank', bankName: 'Citibank', cardType: 'credit' }).confidence).toBe('none');
    });
});
