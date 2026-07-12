'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { gameMatchesApi } from '@/lib/api';

// Lands here after opening a shared link (and logging in, if needed). Joins the
// room by code, then drops straight into the match — "vào login là vào game luôn".
export default function JoinGamePage() {
    const params = useParams();
    const router = useRouter();
    const code = params.code as string;
    const [error, setError] = useState<string | null>(null);
    const ranRef = useRef(false);

    useEffect(() => {
        if (!code || ranRef.current) return;
        ranRef.current = true;
        gameMatchesApi.joinByCode(code)
            .then(res => {
                const matchId = res.data?.data?._id;
                if (matchId) router.replace(`/games/${matchId}`);
                else setError('Không vào được phòng, thử lại sau');
            })
            .catch(err => setError(err?.response?.data?.message || 'Không vào được phòng'));
    }, [code, router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
            {error ? (
                <>
                    <div className="text-4xl">😕</div>
                    <p className="text-sm text-slate-400">{error}</p>
                    <button onClick={() => router.push('/games')} className="text-sm font-bold text-indigo-600">Về trang chơi bài</button>
                </>
            ) : (
                <>
                    <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-sm text-slate-400">Đang vào phòng…</p>
                </>
            )}
        </div>
    );
}
