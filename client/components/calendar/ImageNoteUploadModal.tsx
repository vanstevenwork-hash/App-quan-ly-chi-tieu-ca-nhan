'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CATEGORIES } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { uploadApi } from '@/lib/api';
import { toast } from 'sonner';

export interface ImageNoteUploadModalHandle {
    open: (dateStr: string) => void;
}

interface ImageNoteUploadModalProps {
    addImage: (date: string, url: string, amount: number, label: string) => Promise<void>;
}

function ImageNoteUploadModalBase(
    { addImage }: ImageNoteUploadModalProps,
    ref: React.Ref<ImageNoteUploadModalHandle>
) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingDate, setUploadingDate] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);
    const [uploadAmount, setUploadAmount] = useState('');
    const [uploadNote, setUploadNote] = useState('');
    const [uploadCategory, setUploadCategory] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    useImperativeHandle(ref, () => ({
        open: (dateStr: string) => {
            setUploadingDate(dateStr);
            fileInputRef.current?.click();
        },
    }));

    // Revoke the outstanding upload-preview blob URL on unmount
    useEffect(() => () => {
        if (uploadPreview) URL.revokeObjectURL(uploadPreview);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingDate) return;

        if (uploadPreview) URL.revokeObjectURL(uploadPreview);
        setUploadFile(file);
        setUploadPreview(URL.createObjectURL(file));
        setUploadAmount('');
        setUploadNote('');
        setUploadCategory('');
        setModalOpen(true);
        e.target.value = ''; // Reset input so same file can be selected again
    };

    const submitUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile || !uploadingDate) return;

        const amount = parseInt(uploadAmount.replace(/\D/g, '') || '0', 10);

        try {
            setIsUploading(true);
            const { url } = await uploadApi.uploadImage(uploadFile, 'chi_tieu/calendar');
            await addImage(uploadingDate, url, amount, uploadCategory || uploadNote);
            toast.success('Đã thêm ảnh thành công!');
            setModalOpen(false);
            setUploadingDate(null);
        } catch (err) {
            toast.error('Upload thất bại, vui lòng thử lại');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            {/* Hidden file input for image upload */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            <Dialog open={modalOpen} onOpenChange={(open) => {
                if (!isUploading) setModalOpen(open);
            }}>
                <DialogContent className="sm:max-w-md rounded-[20px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-0">
                    <form onSubmit={submitUpload} className="flex flex-col max-h-[85vh]">
                        {/* Header Image Preview */}
                        <div className="relative w-full h-48 bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                            {uploadPreview ? (
                                <img src={uploadPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-8 h-8 text-slate-300" />
                                </div>
                            )}
                            {/* Gradient Overlay */}
                            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

                            <h2 className="absolute bottom-4 left-5 text-xl font-bold text-white shadow-sm">
                                Thêm Ghi Chú Ngày
                            </h2>
                        </div>

                        {/* Form Body */}
                        <div className="p-5 space-y-4 overflow-y-auto">
                            {/* Category Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Danh mục <span className="text-red-400">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.filter(c => !['Lương', 'Freelance', 'Đầu tư', 'Thưởng', 'Tiền lãi'].includes(c.label)).slice(0, 12).map(cat => (
                                        <button
                                            key={cat.label}
                                            type="button"
                                            onClick={() => setUploadCategory(cat.label)}
                                            className={cn(
                                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                                                uploadCategory === cat.label
                                                    ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-400 text-purple-700 dark:text-purple-300 scale-105 shadow-sm'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-purple-300'
                                            )}
                                        >
                                            <cat.Icon className="w-3.5 h-3.5" />
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Số tiền <span className="text-slate-400 font-normal">(không bắt buộc)</span>
                                </label>
                                <div className="relative">
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0"
                                        value={uploadAmount ? parseInt(uploadAmount.replace(/\D/g, '') || '0').toLocaleString('vi-VN') : ''}
                                        onChange={(e) => setUploadAmount(e.target.value)}
                                        className="h-12 rounded-xl pl-4 pr-12 text-lg font-bold bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus-visible:ring-emerald-500"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">đ</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Ghi chú ngắn <span className="text-slate-400 font-normal">(không bắt buộc)</span>
                                </label>
                                <Input
                                    placeholder="Ví dụ: Tiền ăn trưa, Mua sắm..."
                                    value={uploadNote}
                                    onChange={(e) => setUploadNote(e.target.value)}
                                    className="h-12 rounded-xl px-4 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus-visible:ring-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 pt-0 mt-2 flex gap-3 shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setModalOpen(false)}
                                disabled={isUploading}
                                className="flex-1 h-12 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Hủy
                            </Button>
                            <Button
                                type="submit"
                                disabled={isUploading}
                                className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                            >
                                {isUploading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Lưu Ghi Chú'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default forwardRef(ImageNoteUploadModalBase);
