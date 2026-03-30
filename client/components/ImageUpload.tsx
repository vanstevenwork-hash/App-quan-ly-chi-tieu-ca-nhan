'use client';
import { useRef, useState } from 'react';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadApi } from '@/lib/api';
import { toast } from 'sonner';

interface ImageUploadProps {
    currentUrl?: string;
    onUpload: (url: string) => void;
    folder?: string;
    shape?: 'circle' | 'square';
    size?: number; // px
    className?: string;
    placeholder?: string; // emoji or text shown when no image
}

export default function ImageUpload({
    currentUrl,
    onUpload,
    folder = 'chi_tieu',
    shape = 'circle',
    size = 80,
    className,
    placeholder = '📷',
}: ImageUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(currentUrl || null);
    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);

    const handleFile = async (file: File) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File quá lớn (tối đa 5MB)');
            return;
        }

        // Show local preview immediately
        const localUrl = URL.createObjectURL(file);
        setPreview(localUrl);
        setLoading(true);

        try {
            const { url } = await uploadApi.uploadImage(file, folder);
            setPreview(url);
            onUpload(url);
            toast.success('Upload ảnh thành công!');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Upload thất bại');
            setPreview(currentUrl || null);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const clear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setPreview(null);
        onUpload('');
    };

    const radius = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

    return (
        <div className={cn('relative inline-block', className)}>
            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleChange}
            />

            {/* Main clickable area */}
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                style={{ width: size, height: size }}
                className={cn(
                    'relative flex items-center justify-center overflow-hidden transition-all duration-200 group',
                    radius,
                    dragging
                        ? 'ring-2 ring-purple-500 ring-offset-2 scale-105'
                        : 'hover:ring-2 hover:ring-purple-400/50 hover:ring-offset-1',
                    preview ? 'bg-transparent' : 'bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-purple-400'
                )}
            >
                {preview ? (
                    <>
                        <img
                            src={preview}
                            alt="Preview"
                            className={cn('w-full h-full object-cover', radius)}
                        />
                        {/* Hover overlay */}
                        <div className={cn(
                            'absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
                            radius
                        )}>
                            <Camera className="w-5 h-5 text-white" />
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                        <ImagePlus className="w-6 h-6" />
                        {size >= 80 && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide">Chọn ảnh</span>
                        )}
                    </div>
                )}

                {/* Loading overlay */}
                {loading && (
                    <div className={cn(
                        'absolute inset-0 bg-black/50 flex items-center justify-center',
                        radius
                    )}>
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                )}
            </button>

            {/* Clear button */}
            {preview && !loading && (
                <button
                    type="button"
                    onClick={clear}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}
