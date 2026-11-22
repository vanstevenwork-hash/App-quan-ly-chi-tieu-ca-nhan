#!/usr/bin/env node
// Builds the card-design catalog from the raw image dump in ../image/ (not in git):
//   - keeps only images with a bank-card aspect ratio (~1.586:1, either way up)
//   - works out the bank from the file-name prefix, then the folder name
//   - drops exact duplicates and keeps the sharpest copy of each card product
//   - rotates portrait cards to landscape, resizes to 800px wide, encodes WebP
//   - writes client/public/cards/<bank>/<slug>.webp + client/lib/cardCatalog.json
//
// macOS only (uses the built-in `sips` + Homebrew `cwebp`):
//   brew install webp
//   node scripts/build-card-catalog.mjs [path/to/image-folder]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));     // client/
const SRC = path.resolve(process.argv[2] || path.join(ROOT, '..', 'image'));
const OUT_DIR = path.join(ROOT, 'public', 'cards');
const OUT_JSON = path.join(ROOT, 'lib', 'cardCatalog.json');
const WIDTH = 800;
const QUALITY = 80;
// Small copy for thumbnails/pickers (≤ 120 CSS px wide → 240 px for retina).
const THUMB_WIDTH = 240;
const THUMB_SUFFIX = '.sm.webp';

// Canonical bank id → display name + every bankShortName spelling seen in the
// app (VietQR shortName, VietQR code, older codes). Keep in sync with lib/cardCatalog.ts.
const BANKS = {
    VPBank: { name: 'VPBank', aliases: ['VPB', 'VPBANK'], prefixes: ['vpbank'], folders: ['VPBank', 'Unknown'] },
    Techcombank: { name: 'Techcombank', aliases: ['TCB', 'TECHCOMBANK'], prefixes: ['techcombank', 'tcb'], folders: ['techcombank'] },
    Vietcombank: { name: 'Vietcombank', aliases: ['VCB'], prefixes: ['vietcombank', 'vcb'], folders: ['vietcombank'] },
    VietinBank: { name: 'VietinBank', aliases: ['ICB', 'CTG', 'VTB', 'VIETINBANK'], prefixes: ['vietinbank'], folders: ['vietinbank'] },
    BIDV: { name: 'BIDV', aliases: ['BIDV'], prefixes: ['bidv'], folders: ['bidv'] },
    ACB: { name: 'ACB', aliases: ['ACB'], prefixes: ['acb'], folders: ['acb'] },
    MBBank: { name: 'MB Bank', aliases: ['MB', 'MBB', 'MBBANK'], prefixes: ['mbbank', 'mb'], folders: ['mb'] },
    TPBank: { name: 'TPBank', aliases: ['TPB', 'TPBANK'], prefixes: ['tpbank'], folders: ['tpbank'] },
    Sacombank: { name: 'Sacombank', aliases: ['STB', 'SACOMBANK'], prefixes: ['sacombank'], folders: ['sacombank'] },
    HDBank: { name: 'HDBank', aliases: ['HDB', 'HDBANK'], prefixes: ['hdbank'], folders: ['HDBank'] },
    VIB: { name: 'VIB', aliases: ['VIB'], prefixes: ['vib'], folders: ['VIB'] },
    SHB: { name: 'SHB', aliases: ['SHB'], prefixes: ['shb'], folders: ['shb'] },
    Eximbank: { name: 'Eximbank', aliases: ['EIB', 'EXIMBANK'], prefixes: ['eximbank'], folders: ['eximbank'] },
    MSB: { name: 'MSB', aliases: ['MSB'], prefixes: ['msb'], folders: ['msb'] },
    OCB: { name: 'OCB', aliases: ['OCB'], prefixes: ['ocb'], folders: ['ocb'] },
    SeABank: { name: 'SeABank', aliases: ['SEAB', 'SEABANK'], prefixes: ['seabank'], folders: ['seabank'] },
    LPBank: { name: 'LPBank', aliases: ['LPB', 'LPBANK'], prefixes: ['lpbank'], folders: ['lpbank'] },
    NamABank: { name: 'Nam A Bank', aliases: ['NAB', 'NAMABANK'], prefixes: ['nama-bank', 'namabank', 'nam-a-bank'], folders: ['nama-bank'] },
    BacABank: { name: 'Bac A Bank', aliases: ['BAB', 'BACABANK'], prefixes: ['bac-a-bank', 'bacabank'], folders: ['Bắc-Á-Bank', 'bac-a-bank'] },
    ABBANK: { name: 'ABBANK', aliases: ['ABB', 'ABBANK'], prefixes: ['abbank'], folders: ['abbank'] },
    NCB: { name: 'NCB', aliases: ['NCB'], prefixes: ['ncb'], folders: ['ncb'] },
    Agribank: { name: 'Agribank', aliases: ['VBA', 'AGRIBANK'], prefixes: ['agribank'], folders: ['agribank'] },
    VietCapitalBank: { name: 'BVBank', aliases: ['VCCB', 'BVBANK', 'BVB', 'VIETCAPITALBANK'], prefixes: ['bvbank', 'bvb'], folders: ['bvbank'] },
    VietBank: { name: 'Vietbank', aliases: ['VIETBANK'], prefixes: ['vietbank'], folders: ['vietbank'] },
    KBank: { name: 'KBank', aliases: ['KBANK'], prefixes: ['kbank'], folders: ['kbank'] },
    ShinhanBank: { name: 'Shinhan Bank', aliases: ['SHBVN', 'SHINHANBANK', 'SHINHAN'], prefixes: ['shinhan'], folders: ['shinhan', 'shinhan-bank'] },
    Woori: { name: 'Woori Bank', aliases: ['WVN', 'WOORI'], prefixes: ['woori'], folders: ['woori-bank'] },
    UOB: { name: 'UOB', aliases: ['UOB', 'UNITEDOVERSEAS'], prefixes: ['uob'], folders: ['uob'] },
    HSBC: { name: 'HSBC', aliases: ['HSBC'], prefixes: ['hsbc'], folders: ['HSBC'] },
    StandardChartered: { name: 'Standard Chartered', aliases: ['SCVN', 'STANDARDCHARTERED'], prefixes: ['standard-chartered', 'standardchartered'], folders: ['Standard-Chartered', 'standardchartered'] },
    CAKE: { name: 'Cake', aliases: ['CAKE'], prefixes: ['cake'], folders: ['cake', 'cake-by-vpbank'] },
};
const SKIP_DIRS = new Set(['category', 'test_folder', 'logo']);
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
// Marketing art that happens to be card-shaped.
const SKIP_NAME = /(giải-thưởng|giai-thuong|kích-hoạt|kich-hoat|bảo-mật|bao-mat|ngày-hội|ngay-hoi|các-loại|cac-loai|ca-c-loa|banner|logo|anh_man_hinh|z\d{10,})/i;

const folderToBank = new Map();
for (const [id, b] of Object.entries(BANKS)) for (const f of b.folders) folderToBank.set(f.toLowerCase(), id);
const prefixList = Object.entries(BANKS)
    .flatMap(([id, b]) => b.prefixes.map(p => [p, id]))
    .sort((a, b) => b[0].length - a[0].length); // longest first: "shinhan" before "shb"

const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function bankFor(relPath) {
    const parts = relPath.split(path.sep);
    const base = slugify(path.parse(parts.at(-1)).name);
    for (const [p, id] of prefixList) if (base === p || base.startsWith(p + '-')) return id;
    return folderToBank.get(parts[0].toLowerCase()) || null;
}

const UPPER = new Set(['jcb', 'atm', 'mwg', 'vna', 'sme', 'ii', 'iii', 'pvoil', 'hsbc', 'vib', 'mb', 'uob', 'acb', 'shb', 'ocb', 'msb', 'ncb', 'bidv', 'evn', 'cgv', 'nfc', 'qr', 'pwm', 'brg']);
// Some source file names lost their Vietnamese letters ("kim-loa-i").
const NAME_FIXES = [
    [/\bKim Loa I\b/g, 'Kim Loại'],
    [/\bHa Ng Ba Ch Kim\b/g, 'Hạng Bạch Kim'],
    [/\bKe T No I Vo I Ta I Khoa N\b/g, 'Kết Nối Với Tài Khoản'],
    [/\bVa Eco\b/g, 'Và Eco'],
];
const LEAD = [['the', 'tin', 'dung', 'quoc', 'te'], ['the', 'tin', 'dung'], ['the', 'ghi', 'no', 'quoc', 'te'], ['the', 'ghi', 'no'], ['the', 'da', 'nang', '2', 'trong', '1'], ['the']];
// Clean product name from a file name, keeping Vietnamese diacritics:
// "thẻ-tín-dụng-vpbank-z-jcb" → "Z JCB",
// "xxxxxxxx_Shinhan_Visa_Cashback_Platinum-Credit_UnEmb-(0014)_24Mar20" → "Visa Cashback Platinum Credit".
function productName(file, bankId) {
    let tokens = path.parse(file).name.normalize('NFC')
        .replace(/x{4,}|unemb|\(\d+\)|(?<![a-z0-9])\d{1,2}[a-z]{3}\d{2}(?![a-z0-9])/gi, ' ')
        .split(/[-_\s]+/).filter(Boolean);
    const key = () => tokens.map(t => slugify(t));
    for (const lead of LEAD) if (lead.every((w, i) => key()[i] === w)) { tokens = tokens.slice(lead.length); break; }
    for (const p of BANKS[bankId].prefixes) {
        const pw = p.split('-');
        if (pw.every((w, i) => key()[i] === w)) { tokens = tokens.slice(pw.length); break; }
    }
    // trailing "by <bank>" (e.g. "Trả Góp Muadee By HDBank")
    const k = key();
    if (k.length > 2 && k.at(-2) === 'by' && BANKS[bankId].prefixes.includes(k.at(-1))) tokens = tokens.slice(0, -2);
    const words = tokens.map(t => {
        const sl = slugify(t);
        if (UPPER.has(sl)) return sl.toUpperCase();
        if (sl === 'mastercard') return 'Mastercard';
        return t[0].toLocaleUpperCase('vi') + t.slice(1).toLocaleLowerCase('vi');
    });
    let name = words.join(' ');
    for (const [bad, good] of NAME_FIXES) name = name.replace(bad, good);
    return name.replace(/\s+/g, ' ').trim() || 'Thẻ';
}
function networkOf(slug) {
    if (/visa/.test(slug)) return 'visa';
    if (/mastercard|master-card|world-mastercard/.test(slug)) return 'mastercard';
    if (/jcb/.test(slug)) return 'jcb';
    if (/amex|american-express/.test(slug)) return 'amex';
    if (/napas/.test(slug)) return 'napas';
    return '';
}
const typeOf = slug => (/debit|atm|ghi-no|thanh-toan|napas|2in-1|2-trong-1/.test(slug) && !/credit|tin-dung/.test(slug) ? 'debit' : 'credit');

async function* walk(dir, rel = '') {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const r = path.join(rel, e.name);
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name.toLowerCase())) yield* walk(path.join(dir, e.name), r); }
        else if (IMG_EXT.has(path.extname(e.name).toLowerCase()) && rel) yield r; // root files are strays
    }
}

async function* walkAll(dir, rel = '') {
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) yield* walkAll(path.join(dir, e.name), r);
        else if (e.name.endsWith('.webp') && !e.name.endsWith(THUMB_SUFFIX)) yield r;
    }
}

async function dims(file) {
    const { stdout } = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]);
    return { w: +stdout.match(/pixelWidth: (\d+)/)?.[1] || 0, h: +stdout.match(/pixelHeight: (\d+)/)?.[1] || 0 };
}

async function pool(items, n, fn) {
    const out = []; let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
    return out;
}

async function main() {
    await fs.access(SRC).catch(() => { console.error(`Không thấy thư mục ảnh: ${SRC}`); process.exit(1); });
    await run('cwebp', ['-version']).catch(() => { console.error('Thiếu cwebp — chạy: brew install webp'); process.exit(1); });

    const files = [];
    for await (const f of walk(SRC)) files.push(f);
    const stats = { scanned: files.length, notCard: 0, noBank: 0, skippedName: 0, tooSmall: 0, dupBytes: 0, dupProduct: 0 };

    // 1) Inspect: hash, size, bank, aspect.
    const seenHash = new Set();
    const cand = (await pool(files, 8, async rel => {
        if (SKIP_NAME.test(rel)) { stats.skippedName++; return null; }
        const abs = path.join(SRC, rel);
        const buf = await fs.readFile(abs);
        const hash = createHash('md5').update(buf).digest('hex');
        const bank = bankFor(rel);
        if (!bank) { stats.noBank++; return null; }
        const { w, h } = await dims(abs);
        const long = Math.max(w, h), short = Math.min(w, h);
        const ratio = short ? long / short : 0;
        // Standard Chartered publishes cards centred on a square canvas.
        const squareCrop = bank === 'StandardChartered' && ratio < 1.05;
        if (!squareCrop && (ratio < 1.45 || ratio > 1.75)) { stats.notCard++; return null; }
        if (squareCrop) return { rel, abs, hash, bank, w: Math.round(w * 0.725), h: Math.round(w * 0.725 / 1.586), portrait: false, area: w * w * 0.33, crop: true, srcW: w };
        if (long < 200) { stats.tooSmall++; return null; }
        return { rel, abs, hash, bank, w, h, portrait: h > w, area: w * h };
    })).filter(Boolean).filter(c => {
        if (seenHash.has(c.hash)) { stats.dupBytes++; return false; }
        seenHash.add(c.hash); return true;
    });

    // 2) One file per bank+product: keep the sharpest.
    const byKey = new Map();
    for (const c of cand) {
        c.name = productName(path.basename(c.rel), c.bank);
        c.slug = slugify(c.name) || c.hash.slice(0, 8);
        const key = `${c.bank}/${c.slug}`;
        const prev = byKey.get(key);
        if (!prev) byKey.set(key, c);
        else { stats.dupProduct++; if (c.area > prev.area) byKey.set(key, c); }
    }
    const picked = [...byKey.values()].sort((a, b) => a.bank.localeCompare(b.bank) || a.name.localeCompare(b.name));

    // 3) Encode.
    // Never delete existing files: saved cards may point at an older file name.
    const before = new Set();
    for await (const f of walkAll(OUT_DIR)) before.add(f);
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cards-'));
    let bytes = 0;
    const cards = await pool(picked, 6, async (c, i) => {
        const dir = path.join(OUT_DIR, c.bank);
        await fs.mkdir(dir, { recursive: true });
        const png = path.join(tmp, `${i}.png`);
        const args = ['-s', 'format', 'png'];
        if (c.portrait) args.push('-r', '90');             // portrait → landscape with the chip on the left
        if (c.crop) args.push('-c', String(c.h), String(c.w)); // centred crop (height, width)
        await run('sips', [...args, c.abs, '--out', png]);
        const out = path.join(dir, `${c.slug}.webp`);
        const resize = Math.max(c.w, c.h) > WIDTH ? ['-resize', String(WIDTH), '0'] : [];
        await run('cwebp', ['-quiet', '-q', String(QUALITY), '-m', '6', '-alpha_q', '90', ...resize, png, '-o', out]);
        const st = await fs.stat(out); bytes += st.size;
        const d = await dims(out);
        const slug = slugify(path.parse(c.rel).name);
        return {
            id: `${c.bank}/${c.slug}`,
            bank: c.bank,
            name: `${BANKS[c.bank].name} ${c.name}`,
            network: networkOf(slug),
            type: typeOf(slug),
            src: `/cards/${c.bank}/${c.slug}.webp`,
            w: d.w, h: d.h,
        };
    });
    await fs.rm(tmp, { recursive: true, force: true });

    // Thumbnails for every full image (new and kept-for-compat ones), only when
    // missing or older than the full image.
    let thumbs = 0, thumbBytes = 0;
    const fulls = [];
    for await (const f of walkAll(OUT_DIR)) fulls.push(f);
    await pool(fulls, 6, async f => {
        const full = path.join(OUT_DIR, f);
        const thumb = full.replace(/\.webp$/, THUMB_SUFFIX);
        const [fs1, ts1] = await Promise.all([fs.stat(full), fs.stat(thumb).catch(() => null)]);
        if (!ts1 || ts1.mtimeMs < fs1.mtimeMs) {
            await run('cwebp', ['-quiet', '-q', '78', '-m', '6', '-resize', String(THUMB_WIDTH), '0', full, '-o', thumb]);
            thumbs++;
        }
        thumbBytes += (await fs.stat(thumb)).size;
    });
    console.log(`Ảnh nhỏ: ${fulls.length} (${thumbs} tạo mới) · ${(thumbBytes / 1024).toFixed(0)}KB, TB ${(thumbBytes / fulls.length / 1024).toFixed(1)}KB`);

    const stale = [...before].filter(f => !cards.some(c => c.src === `/cards/${f}`));
    if (stale.length) console.log(`Giữ lại ${stale.length} ảnh cũ không còn trong danh mục (thẻ đã lưu có thể đang dùng): ${stale.slice(0, 5).join(', ')}${stale.length > 5 ? '…' : ''}`);

    const catalog = {
        generatedAt: new Date().toISOString().slice(0, 10),
        banks: Object.fromEntries(Object.entries(BANKS).map(([id, b]) => [id, { name: b.name, aliases: b.aliases }])),
        cards,
    };
    await fs.writeFile(OUT_JSON, JSON.stringify(catalog, null, 1) + '\n');

    const perBank = {};
    cards.forEach(c => { perBank[c.bank] = (perBank[c.bank] || 0) + 1; });
    console.log(`Quét ${stats.scanned} ảnh → giữ ${cards.length} mẫu thẻ (${(bytes / 1048576).toFixed(1)}MB WebP)`);
    console.log(`Bỏ: ${stats.notCard} không đúng tỉ lệ thẻ, ${stats.skippedName} ảnh quảng cáo/logo, ${stats.noBank} không rõ ngân hàng, ${stats.tooSmall} quá nhỏ, ${stats.dupBytes} trùng file, ${stats.dupProduct} trùng mẫu`);
    console.log(Object.entries(perBank).map(([k, v]) => `${k}:${v}`).join('  '));
}

main().catch(e => { console.error(e); process.exit(1); });
