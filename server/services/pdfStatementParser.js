// Parse a credit-card statement PDF ENTIRELY on the server — decrypt with the
// user's password(s), read the text with pdf.js, pull the figures with regex.
// Nothing is sent to any external service (no LLM). Only works on text PDFs;
// scanned-image statements have no extractable text and are reported as such.
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function extractText(buffer, password) {
    const doc = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        password: password || undefined,
        isEvalSupported: false,
        disableFontFace: true,
        useSystemFonts: true,
    }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join(' ') + '\n';
    }
    await doc.destroy();
    return text;
}

const toInt = (s) => Math.abs(parseInt(String(s).replace(/[.,\s]/g, ''), 10)) || 0;

function amountAfter(text, labelSrc) {
    const re = new RegExp(labelSrc + '[^0-9\\-]{0,40}(-?\\d{1,3}(?:[.,]\\d{3})+|\\d{4,})', 'i');
    const m = text.match(re);
    return m ? toInt(m[1]) : 0;
}
function dateAfter(text, labelSrc) {
    const re = new RegExp(labelSrc + '[^0-9]{0,30}(\\d{1,2})[\\/\\-.](\\d{1,2})[\\/\\-.](\\d{2,4})', 'i');
    const m = text.match(re);
    if (!m) return '';
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    const dt = new Date(+y, +mo - 1, +d);
    return isNaN(dt) ? '' : `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}`;
}

function extractStatement(rawText) {
    const t = rawText.replace(/\s+/g, ' ');
    const totalDue = amountAfter(t, '(tổng số tiền (thanh toán|phải thanh toán)|tổng dư nợ|dư nợ cuối kỳ|số tiền thanh toán|total (amount )?due|closing balance|new balance)');
    const minDue = amountAfter(t, '(thanh toán tối thiểu|số tiền tối thiểu|minimum (amount )?(due|payment))');
    const dueDate = dateAfter(t, '(hạn thanh toán|ngày đến hạn|ngày thanh toán|payment due date|due date)');
    const statementDate = dateAfter(t, '(ngày sao kê|ngày lập( bảng)? sao kê|statement date)');
    const last4m = t.match(/(?:[xX*•\d]{2,}[ .\-]*){2,}(\d{4})\b/) || t.match(/x{4,}[ .\-]?(\d{4})\b/i);
    const last4 = last4m ? last4m[1] : '';
    return { totalDue, minDue, dueDate, statementDate, last4, ok: totalDue > 0 || !!dueDate };
}

// Try each password until the PDF opens; then extract text + figures.
async function parseStatementPdfLocal(buffer) {
    const passwords = (process.env.STATEMENT_PDF_PASSWORDS || '')
        .split(',').map(s => s.trim()).filter(Boolean);
    const tries = ['', ...passwords]; // '' handles non-encrypted files too

    let text = null;
    let needPassword = false;
    for (const pw of tries) {
        try { text = await extractText(buffer, pw); break; }
        catch (e) {
            // pdf.js throws a PasswordException (name) when encrypted / wrong pw
            if ((e && e.name) === 'PasswordException') { needPassword = true; continue; }
            // any other parse error → give up on this file
            return { ok: false, reason: 'parse_error', message: e.message };
        }
    }
    if (text == null) return { ok: false, reason: needPassword ? 'wrong_password' : 'decrypt_failed' };

    const clean = text.replace(/\s/g, '');
    if (clean.length < 60) return { ok: false, reason: 'scanned_no_text' }; // image-only PDF

    return extractStatement(text);
}

module.exports = { parseStatementPdfLocal, extractStatement };
