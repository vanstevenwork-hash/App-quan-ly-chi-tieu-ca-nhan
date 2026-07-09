'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, RotateCcw, ScanLine, Receipt, FileText, Sparkles } from 'lucide-react';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { cn } from '@/lib/utils';
import { ocrApi } from '@/lib/api';
import { toast } from 'sonner';

interface ScanResult {
    amount: number;
    date: string;
    note: string;
    suggestedCategory: string;
    imageUrl: string;
    rawText: string;
    confidence: number;
}

interface BillScannerProps {
    onResult: (result: ScanResult) => void;
    onClose: () => void;
}

export default function BillScanner({ onResult, onClose }: BillScannerProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const localBlobUrlRef = useRef<string | null>(null);

    // Revoke any outstanding local preview blob URL on unmount
    useEffect(() => () => {
        if (localBlobUrlRef.current) URL.revokeObjectURL(localBlobUrlRef.current);
    }, []);

    const handleFile = useCallback(async (file: File) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File quá lớn (tối đa 10MB)');
            return;
        }

        // Reset state
        setError(null);
        setResult(null);
        setScanProgress(0);

        // Show preview
        if (localBlobUrlRef.current) URL.revokeObjectURL(localBlobUrlRef.current);
        const localUrl = URL.createObjectURL(file);
        localBlobUrlRef.current = localUrl;
        setPreview(localUrl);
        setScanning(true);

        // Fake progress animation
        const progressInterval = setInterval(() => {
            setScanProgress(p => {
                if (p >= 90) {
                    clearInterval(progressInterval);
                    return 90;
                }
                return p + Math.random() * 15;
            });
        }, 500);

        try {
            const data = await ocrApi.scanReceipt(file);
            clearInterval(progressInterval);
            setScanProgress(100);

            // Short delay to show 100% before revealing result
            await new Promise(r => setTimeout(r, 400));
            setResult(data);
            setPreview(data.imageUrl || localUrl);
            if (data.imageUrl && localBlobUrlRef.current) {
                URL.revokeObjectURL(localBlobUrlRef.current);
                localBlobUrlRef.current = null;
            }

            if (data.amount > 0) {
                toast.success('🎉 Nhận diện thành công!');
            } else {
                toast.warning('⚠️ Không nhận diện được số tiền. Vui lòng nhập thủ công.');
            }
        } catch (err: any) {
            clearInterval(progressInterval);
            const msg = err?.response?.data?.message || err?.message || 'Scan thất bại';
            setError(msg);
            toast.error(`Scan thất bại: ${msg}`);
        } finally {
            setScanning(false);
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const reset = () => {
        if (localBlobUrlRef.current) {
            URL.revokeObjectURL(localBlobUrlRef.current);
            localBlobUrlRef.current = null;
        }
        setPreview(null);
        setResult(null);
        setError(null);
        setScanProgress(0);
    };

    const handleApply = () => {
        if (result) {
            onResult(result);
        }
    };

    const getConfidenceColor = (c: number) => {
        if (c >= 70) return 'text-emerald-500';
        if (c >= 40) return 'text-amber-500';
        return 'text-red-500';
    };

    const getConfidenceLabel = (c: number) => {
        if (c >= 70) return 'Cao';
        if (c >= 40) return 'Trung bình';
        return 'Thấp';
    };

    // ── No image yet: show upload zone ──
    if (!preview) {
        return (
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7f19e6] to-[#b44dff] flex items-center justify-center shadow-lg shadow-purple-500/25">
                            <ScanLine className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Scan Bill</h3>
                            <p className="text-[11px] text-slate-400">Chụp hoặc tải ảnh hóa đơn</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <ActionIcon type="x" size={16} tile={false} color="#6B7280" />
                    </button>
                </div>

                {/* Drop Zone */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                        'relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300',
                        dragOver
                            ? 'border-[#7f19e6] bg-[#7f19e6]/5 scale-[1.02]'
                            : 'border-slate-200 dark:border-slate-700 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                    )}
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-slate-800 flex items-center justify-center">
                            <Receipt className="w-8 h-8 text-[#7f19e6]" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Kéo thả ảnh bill vào đây
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                hoặc chọn phương thức bên dưới
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#7f19e6] to-[#9b4de8] text-white font-bold text-sm shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.97] transition-all"
                    >
                        <ActionIcon type="camera" size={20} tile={false} color="#FFFFFF" />
                        <span>Chụp ảnh</span>
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm border-2 border-slate-200 dark:border-slate-700 hover:border-[#7f19e6] hover:text-[#7f19e6] active:scale-[0.97] transition-all"
                    >
                        <ActionIcon type="upload" size={20} tile={false} color="currentColor" />
                        <span>Tải ảnh lên</span>
                    </button>
                </div>

                {/* Hidden inputs */}
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                />
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                />

                {/* Tip */}
                <div className="flex items-start gap-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 p-3">
                    <Sparkles className="w-4 h-4 text-[#7f19e6] mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed">
                        <span className="font-bold">Mẹo:</span> Chụp rõ nét phần <span className="font-bold">tổng tiền</span> trên bill để tăng độ chính xác. Hỗ trợ bill siêu thị, nhà hàng, cửa hàng...
                    </p>
                </div>
            </div>
        );
    }

    // ── Scanning / Result view ──
    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7f19e6] to-[#b44dff] flex items-center justify-center shadow-lg shadow-purple-500/25">
                        {scanning ? (
                            <ActionIcon type="loader" size={20} tile={false} spin color="#FFFFFF" />
                        ) : result ? (
                            <ActionIcon type="check" size={20} tile={false} color="#FFFFFF" />
                        ) : (
                            <ScanLine className="w-5 h-5 text-white" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                            {scanning ? 'Đang nhận diện...' : result ? 'Kết quả scan' : 'Scan Bill'}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                            {scanning ? `${Math.round(scanProgress)}%` : result ? `Độ tin cậy: ${result.confidence}%` : ''}
                        </p>
                    </div>
                </div>
                <button onClick={() => { reset(); onClose(); }}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <ActionIcon type="x" size={16} tile={false} color="#6B7280" />
                </button>
            </div>

            {/* Image Preview */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-[3/4] max-h-[280px]">
                <img
                    src={preview}
                    alt="Bill preview"
                    className={cn(
                        'w-full h-full object-contain transition-all duration-500',
                        scanning && 'brightness-90'
                    )}
                />

                {/* Scanning Overlay */}
                {scanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {/* Scan line animation */}
                        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#7f19e6] to-transparent animate-scan-line" />

                        {/* Corner markers */}
                        <div className="absolute top-4 left-4 w-8 h-8 border-t-3 border-l-3 border-[#7f19e6] rounded-tl-lg" />
                        <div className="absolute top-4 right-4 w-8 h-8 border-t-3 border-r-3 border-[#7f19e6] rounded-tr-lg" />
                        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-3 border-l-3 border-[#7f19e6] rounded-bl-lg" />
                        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-3 border-r-3 border-[#7f19e6] rounded-br-lg" />

                        {/* Progress bar at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
                            <div
                                className="h-full bg-gradient-to-r from-[#7f19e6] to-[#b44dff] transition-all duration-500 ease-out"
                                style={{ width: `${scanProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Error overlay */}
                {error && (
                    <div className="absolute inset-0 bg-red-500/10 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-4">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                        <p className="text-sm text-red-600 dark:text-red-400 text-center font-medium">{error}</p>
                    </div>
                )}
            </div>

            {/* Result data */}
            {result && (
                <div className="space-y-2">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Amount */}
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">💰</span>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Số tiền</span>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                    {result.amount > 0 ? `${result.amount.toLocaleString('vi-VN')}₫` : 'Không nhận diện được'}
                                </p>
                            </div>
                        </div>

                        {/* Other fields */}
                        {result.note && (
                            <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">📝</span>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ghi chú</span>
                                </div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 max-w-[60%] truncate text-right">{result.note}</p>
                            </div>
                        )}

                        {result.suggestedCategory && (
                            <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🏷️</span>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Danh mục</span>
                                </div>
                                <span className="text-sm font-semibold text-[#7f19e6] dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 rounded-lg">{result.suggestedCategory}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">📅</span>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ngày</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{result.date}</p>
                        </div>

                        {/* Confidence */}
                        <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🎯</span>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Độ tin cậy</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all duration-700',
                                            result.confidence >= 70 ? 'bg-emerald-500' : result.confidence >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                        )}
                                        style={{ width: `${result.confidence}%` }}
                                    />
                                </div>
                                <span className={cn('text-sm font-bold', getConfidenceColor(result.confidence))}>
                                    {getConfidenceLabel(result.confidence)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
                <button
                    onClick={reset}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.97] transition-all"
                >
                    <RotateCcw className="w-4 h-4" />
                    <span>Chụp lại</span>
                </button>
                {result && (
                    <button
                        onClick={handleApply}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#7f19e6] to-[#9b4de8] text-white font-bold text-sm shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.97] transition-all"
                    >
                        <ActionIcon type="check" size={16} tile={false} color="#FFFFFF" />
                        <span>Điền vào form</span>
                    </button>
                )}
            </div>

            {/* Hidden inputs for retake */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    );
}
