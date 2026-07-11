'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCardShareStore } from '@/hooks/useCardShares';
import { CustomIcon } from '@/components/icons/CustomIcon';

function AcceptInviteContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const { accept } = useCardShareStore();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const [cardName, setCardName] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Link không hợp lệ — thiếu token mời.');
            return;
        }

        const doAccept = async () => {
            try {
                const result = await accept(token);
                setStatus('success');
                setCardName(result.card?.bankName || 'Thẻ');
                setMessage(`Bạn đã được thêm vào thẻ ${result.card?.bankName || ''} thành công!`);
            } catch (err: any) {
                setStatus('error');
                setMessage(err.response?.data?.message || 'Không thể chấp nhận lời mời. Có thể link đã hết hạn hoặc không hợp lệ.');
            }
        };

        doAccept();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-surface-deep p-6">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-surface rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 p-8 text-center">
                    {status === 'loading' && (
                        <>
                            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                                Đang xác nhận...
                            </h1>
                            <p className="text-sm text-slate-400">
                                Vui lòng chờ trong giây lát
                            </p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                                <span className="text-3xl">🎉</span>
                            </div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                                Chấp nhận thành công!
                            </h1>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
                                {message}
                            </p>
                            <button
                                onClick={() => router.push('/cards')}
                                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all"
                            >
                                Xem thẻ chung
                            </button>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                                <CustomIcon type="alertCircle" size={32} tile={false} color="#EF4444" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                                Không thể chấp nhận
                            </h1>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
                                {message}
                            </p>
                            <button
                                onClick={() => router.push('/cards')}
                                className="w-full py-3.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold active:scale-[0.98] transition-all"
                            >
                                Về trang thẻ
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-surface-deep">
                <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        }>
            <AcceptInviteContent />
        </Suspense>
    );
}
