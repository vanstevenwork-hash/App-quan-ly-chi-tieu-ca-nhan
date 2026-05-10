const Tesseract = require('tesseract.js');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// ─── Cloudinary helper ───
const getCloudinary = () => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    return cloudinary;
};

const bufferToStream = (buffer) => {
    return new Readable({
        read() { this.push(buffer); this.push(null); },
    });
};

// ─── Category keyword mapping ───
const CATEGORY_KEYWORDS = {
    'Ăn uống': [
        'nhà hàng', 'quán ăn', 'café', 'cafe', 'cà phê', 'coffee', 'trà sữa',
        'boba', 'phở', 'bún', 'cơm', 'bánh', 'kem', 'pizza', 'burger',
        'kfc', 'lotteria', 'jollibee', 'mcdonald', 'highland', 'starbucks',
        'the coffee house', 'phúc long', 'tocotoco', 'gong cha', 'cheese',
        'sushi', 'lẩu', 'nướng', 'buffet', 'food', 'eat', 'restaurant',
        'grab food', 'grabfood', 'shopee food', 'shopeefood', 'baemin',
        'now.vn', 'gofood', 'đồ ăn', 'ăn sáng', 'ăn trưa', 'ăn tối',
        'mini stop', 'ministop', 'circle k', 'familymart', 'gs25',
    ],
    'Di chuyển': [
        'grab', 'gojek', 'be', 'xăng', 'petrol', 'gas', 'taxi', 'xe ôm',
        'bus', 'xe buýt', 'metro', 'tàu', 'vé máy bay', 'vietjet', 'bamboo',
        'vietnam airlines', 'pacific airlines', 'parking', 'đỗ xe', 'gửi xe',
        'toll', 'phí cầu đường', 'uber', 'vinasun', 'mai linh',
    ],
    'Mua sắm': [
        'shopee', 'lazada', 'tiki', 'sendo', 'amazon', 'thế giới di động',
        'điện máy xanh', 'nguyễn kim', 'fpt shop', 'cellphones', 'coop',
        'coopmart', 'winmart', 'big c', 'lotte mart', 'aeon', 'mega market',
        'siêu thị', 'chợ', 'market', 'mall', 'mua sắm', 'shopping',
        'thời trang', 'fashion', 'giày', 'dép', 'quần áo', 'uniqlo', 'zara',
        'h&m', 'muji',
    ],
    'Giải trí': [
        'cgv', 'lotte cinema', 'galaxy', 'beta cinema', 'phim', 'movie',
        'karaoke', 'game', 'netflix', 'spotify', 'youtube', 'apple music',
        'steam', 'playstation', 'xbox', 'nintendo', 'billiard', 'bowling',
    ],
    'Sức khỏe': [
        'bệnh viện', 'phòng khám', 'nhà thuốc', 'pharmacy', 'thuốc', 'bác sĩ',
        'doctor', 'hospital', 'clinic', 'long châu', 'pharmacity', 'an khang',
        'medicare', 'gym', 'yoga', 'fitness', 'khám', 'xét nghiệm',
    ],
    'Học tập': [
        'sách', 'book', 'khóa học', 'course', 'udemy', 'coursera', 'trung tâm',
        'tiếng anh', 'ielts', 'toeic', 'fahasa', 'nhà sách',
    ],
    'Hóa đơn': [
        'điện', 'nước', 'internet', 'wifi', 'fpt', 'vnpt', 'viettel',
        'mobifone', 'vinaphone', 'tiền nhà', 'thuê nhà', 'rent', 'phí',
        'bảo hiểm', 'insurance',
    ],
};

/**
 * Parse amount from OCR text — supports Vietnamese currency formats
 * Strategy: find ALL candidate amounts, score them, pick the best.
 * Key insight: on Vietnamese receipts, the LAST "Thanh toán" / "Tổng" line
 * at the BOTTOM of the bill is the final total.
 */
function parseAmount(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const totalLines = lines.length;

    // Priority keywords — ordered by specificity (most specific first)
    const strongTotalKeywords = [
        'tổng cộng', 'tổng tiền', 'tổng thanh toán', 'thanh toán',
        'grand total', 'tong cong', 'tong tien', 'thanh toan',
        'tổng phải trả', 'phải thanh toán'
    ];
    const weakTotalKeywords = [
        'total', 'amount', 'thành tiền', 'tổng', 'tiền hàng',
        'số tiền', 'payment', 'payable', 'phải trả',
        'tiền mặt', 'chuyển khoản',
    ];

    // Check if the entire receipt is likely a bank transfer screenshot
    const isBankTransfer = /chuyển khoản thành công|giao dịch thành công|chuyen khoan thanh cong|giao dich thanh cong/i.test(text);
    
    if (isBankTransfer) {
        // If it's a bank transfer, 'số tiền' or 'số tiền giao dịch' are strong indicators
        strongTotalKeywords.push('số tiền', 'số tiền chuyển', 'số tiền giao dịch');
    }

    /** Extract all numbers from a line */
    function extractNumbers(line) {
        const results = [];
        // Pattern 1: numbers with dots/commas as thousand separators  (e.g. 326.000  125,000)
        const re1 = /(\d{1,3}(?:[.,]\d{3})+)/g;
        let m;
        while ((m = re1.exec(line)) !== null) {
            results.push(parseInt(m[1].replace(/[.,]/g, ''), 10));
        }
        // Pattern 2: plain large numbers (4+ digits) not already captured
        const cleaned = line.replace(/\d{1,3}(?:[.,]\d{3})+/g, '###');
        const re2 = /(\d{4,})/g;
        while ((m = re2.exec(cleaned)) !== null) {
            results.push(parseInt(m[1], 10));
        }
        return results.filter(n => n >= 500 && n <= 999999999);
    }

    let candidates = []; // { amount, confidence, lineIdx }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();
        
        // Check keywords on current line
        let isStrongTotal = strongTotalKeywords.some(kw => lower.includes(kw));
        let isWeakTotal = weakTotalKeywords.some(kw => lower.includes(kw));

        // Check previous line for keywords (for bank transfers where label is above value)
        if (i > 0) {
            const prevLower = lines[i - 1].toLowerCase();
            if (strongTotalKeywords.some(kw => prevLower.includes(kw))) isStrongTotal = true;
            else if (weakTotalKeywords.some(kw => prevLower.includes(kw))) isWeakTotal = true;
        }

        const nums = extractNumbers(line);
        if (nums.length === 0) continue;

        const hasCurrency = /[đd₫]|vn[dđ]/i.test(line);
        // Position weight: lines at bottom of receipt are more likely to be the total (except for bank transfers where it can be anywhere)
        const positionWeight = isBankTransfer ? 10 : Math.round((i / totalLines) * 30); // 0-30 points

        for (const num of nums) {
            let confidence = 0;

            if (isStrongTotal) confidence += 60;
            else if (isWeakTotal) confidence += 35;

            confidence += positionWeight;  // bottom lines score higher
            if (hasCurrency) confidence += 10;
            if (num >= 10000) confidence += 5;  // reasonable total amount

            candidates.push({ amount: num, confidence, lineIdx: i });
        }
    }

    if (candidates.length === 0) {
        return { amount: 0, confidence: 0 };
    }

    // Sort: highest confidence first, then largest amount, then latest line
    candidates.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        if (b.lineIdx !== a.lineIdx) return b.lineIdx - a.lineIdx; // prefer bottom
        return b.amount - a.amount; // prefer larger
    });

    const best = candidates[0];
    return { amount: best.amount, confidence: Math.min(best.confidence, 100) };
}

/**
 * Parse date from OCR text
 */
function parseDate(text) {
    // DD/MM/YYYY or DD-MM-YYYY
    const match = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (match) {
        let [, day, month, year] = match;
        if (year.length === 2) year = '20' + year;
        const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030) {
            return d.toISOString().slice(0, 10);
        }
    }
    // YYYY-MM-DD
    const match2 = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (match2) {
        const d = new Date(`${match2[1]}-${match2[2].padStart(2, '0')}-${match2[3].padStart(2, '0')}`);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return null;
}

/**
 * Suggest category from OCR text
 */
function suggestCategory(text) {
    const lower = text.toLowerCase();
    let bestCat = '';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        let score = 0;
        for (const kw of keywords) {
            if (lower.includes(kw)) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestCat = category;
        }
    }

    return bestCat || '';
}

/**
 * Extract merchant name (usually first few lines of receipt)
 */
function extractMerchant(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    // First non-empty line is often the store/merchant name
    for (const line of lines.slice(0, 5)) {
        // Skip lines that are mainly numbers or dates
        if (/^\d+[\s\/\-\.:]+\d+/.test(line)) continue;
        if (/^(hóa đơn|hd|bill|receipt|invoice|no\.|mã)/i.test(line)) continue;
        if (line.length >= 3 && line.length <= 80) {
            return line;
        }
    }
    return '';
}

// ─── Main OCR endpoint ───
// @desc  Scan receipt image, extract transaction data
// @route POST /api/ocr/scan-receipt
// @access Private
exports.scanReceipt = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không có file ảnh nào được gửi lên' });
        }

        console.log('🔍 OCR: Starting receipt scan...');

        // 1. Upload image to Cloudinary
        const cld = getCloudinary();
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cld.uploader.upload_stream(
                {
                    folder: 'receipts',
                    resource_type: 'image',
                    transformation: [
                        { width: 1200, height: 1600, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }
                    ],
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            bufferToStream(req.file.buffer).pipe(uploadStream);
        });

        const imageUrl = uploadResult.secure_url;
        console.log('☁️ OCR: Image uploaded to Cloudinary:', imageUrl);

        // 2. Run Tesseract OCR on the image URL
        console.log('🔤 OCR: Running Tesseract...');
        const { data } = await Tesseract.recognize(imageUrl, 'vie+eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    console.log(`🔤 OCR progress: ${Math.round(m.progress * 100)}%`);
                }
            },
        });

        const rawText = data.text;
        const ocrConfidence = Math.round(data.confidence);
        console.log('✅ OCR: Recognition complete. Confidence:', ocrConfidence);
        console.log('📝 OCR Raw Text:\n', rawText.substring(0, 500));

        // 3. Parse structured data from OCR text
        const { amount, confidence: amountConfidence } = parseAmount(rawText);
        const date = parseDate(rawText);
        const suggestedCategory = suggestCategory(rawText);
        const merchant = extractMerchant(rawText);

        const result = {
            amount,
            date: date || new Date().toISOString().slice(0, 10),
            note: merchant,
            suggestedCategory,
            imageUrl,
            rawText,
            confidence: Math.round((ocrConfidence + amountConfidence) / 2),
        };

        console.log('📊 OCR Result:', {
            amount: result.amount,
            date: result.date,
            note: result.note,
            suggestedCategory: result.suggestedCategory,
            confidence: result.confidence,
        });

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('❌ OCR error:', err.message);
        res.status(500).json({ success: false, message: err.message || 'OCR thất bại' });
    }
};
