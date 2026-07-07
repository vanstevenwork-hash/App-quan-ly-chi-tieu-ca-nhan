const { GoogleGenerativeAI } = require('@google/generative-ai');
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

// Category labels must match client/lib/mockData.ts CATEGORIES exactly
const CATEGORY_LABELS = ['Ăn uống', 'Mua sắm', 'Di chuyển', 'Giải trí', 'Sức khỏe', 'Học tập', 'Hóa đơn'];

const RECEIPT_PROMPT = `Bạn là hệ thống trích xuất dữ liệu từ ảnh hóa đơn/biên lai/màn hình chuyển khoản tiếng Việt.
Đọc kỹ ảnh và trả về DUY NHẤT một JSON hợp lệ (không markdown, không giải thích) với cấu trúc:
{
  "amount": <số tiền tổng phải thanh toán, số nguyên VNĐ, 0 nếu không đọc được>,
  "date": "<ngày trên hóa đơn dạng YYYY-MM-DD, hoặc null nếu không thấy>",
  "merchant": "<tên cửa hàng/quán/người nhận, chuỗi rỗng nếu không rõ>",
  "category": "<đúng một trong các giá trị: ${CATEGORY_LABELS.join(', ')}; chuỗi rỗng nếu không chắc>",
  "confidence": <số nguyên 0-100, độ tin cậy của trường "amount">
}
Nếu ảnh là màn hình chuyển khoản ngân hàng, "amount" là số tiền giao dịch, "merchant" là tên người/đơn vị nhận.
QUAN TRỌNG: Nếu ảnh không phải hóa đơn/biên lai/giao dịch (mờ, trống, không liên quan, hoặc không đọc được số tiền rõ ràng), bắt buộc trả "amount": 0, "confidence": 0 và các trường còn lại rỗng/null — TUYỆT ĐỐI KHÔNG được bịa hay đoán số liệu.`;

function parseGeminiJson(rawText) {
    try {
        return JSON.parse(rawText);
    } catch {
        // Model occasionally wraps JSON in ```json fences despite instructions
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch { /* fall through */ }
        }
        return {};
    }
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
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ success: false, message: 'Thiếu GEMINI_API_KEY trong server/.env — lấy free API key tại https://aistudio.google.com/apikey' });
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

        // 2. Ask Gemini to read the receipt image directly and return structured data
        console.log('🤖 OCR: Calling Gemini vision model...');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'gemini-flash-lite-latest',
            generationConfig: { responseMimeType: 'application/json' },
        });

        const geminiResult = await model.generateContent([
            RECEIPT_PROMPT,
            { inlineData: { data: req.file.buffer.toString('base64'), mimeType: req.file.mimetype } },
        ]);

        const rawText = geminiResult.response.text();
        console.log('📝 Gemini raw response:\n', rawText.substring(0, 500));
        const parsed = parseGeminiJson(rawText);

        const amount = Number.isFinite(Number(parsed.amount)) ? Math.max(0, Math.round(Number(parsed.amount))) : 0;
        const date = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
            ? parsed.date
            : new Date().toISOString().slice(0, 10);
        const note = typeof parsed.merchant === 'string' ? parsed.merchant : '';
        const suggestedCategory = CATEGORY_LABELS.includes(parsed.category) ? parsed.category : '';
        const confidence = Math.min(100, Math.max(0, Math.round(Number(parsed.confidence) || 0)));

        const result = { amount, date, note, suggestedCategory, imageUrl, rawText, confidence };

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
