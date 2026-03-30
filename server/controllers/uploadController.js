const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper: convert buffer to Readable stream
const bufferToStream = (buffer) => {
    const readable = new Readable({
        read() { this.push(buffer); this.push(null); },
    });
    return readable;
};

// @desc  Upload an image to Cloudinary
// @route POST /api/upload
// @access Private
exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không có file nào được gửi lên' });
        }

        const folder = req.query.folder || 'chi_tieu';

        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'image',
                    transformation: [
                        { width: 800, height: 800, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }
                    ],
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            bufferToStream(req.file.buffer).pipe(uploadStream);
        });

        res.json({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
        });
    } catch (err) {
        console.error('❌ Cloudinary upload error:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Upload thất bại' });
    }
};

// @desc  Delete an image from Cloudinary
// @route DELETE /api/upload/:publicId
// @access Private
exports.deleteImage = async (req, res) => {
    try {
        const { publicId } = req.params;
        // publicId comes URL-encoded, decode it
        const decoded = decodeURIComponent(publicId);
        await cloudinary.uploader.destroy(decoded);
        res.json({ success: true, message: 'Đã xóa ảnh' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
