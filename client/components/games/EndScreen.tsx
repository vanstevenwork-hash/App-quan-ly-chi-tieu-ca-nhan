'use client';
import { useRouter } from 'next/navigation';

interface EndScreenProps {
    youWon: boolean;
    abandoned?: boolean;
}

export default function EndScreen({ youWon, abandoned }: EndScreenProps) {
    const router = useRouter();
    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-6">
            <div className="w-full max-w-sm bg-white dark:bg-surface rounded-3xl p-6 text-center shadow-2xl">
                <div className="text-5xl mb-3">{abandoned ? '🚪' : youWon ? '🏆' : '😅'}</div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
                    {abandoned ? 'Đối thủ đã rời ván đấu' : youWon ? 'Bạn đã thắng!' : 'Bạn đã thua'}
                </h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">
                    {abandoned ? 'Ván đấu đã kết thúc' : youWon ? 'Chúc mừng, ván bài kết thúc 🎉' : 'Chơi lại để gỡ nhé!'}
                </p>
                <button
                    onClick={() => router.push('/games')}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-95"
                >
                    Về trang chơi bài
                </button>
            </div>
        </div>
    );
}
