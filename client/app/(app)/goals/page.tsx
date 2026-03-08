'use client';
import { Target, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GoalsPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen pb-32 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            <div className="fixed top-0 left-0 w-full h-80 pointer-events-none z-0 dark:hidden"
                style={{ background: 'linear-gradient(to bottom, rgba(251,191,36,0.18), transparent)' }} />
            <div className="fixed top-0 left-0 w-full h-80 pointer-events-none z-0 hidden dark:block"
                style={{ background: 'linear-gradient(to bottom, rgba(217,119,6,0.1), transparent)' }} />

            <div className="relative z-10">
                {/* Header */}
                <header className="pt-4 px-5 pb-4 flex items-center gap-4">
                    <button onClick={() => router.push('/dashboard')}
                        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
                    </button>
                    <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Theo dõi</p>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">Mục tiêu 🎯</h1>
                    </div>
                </header>

                <div className="px-5 mt-6">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-3xl mb-5 flex items-center justify-center"
                            style={{ background: typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'linear-gradient(135deg, #B45309, #78350F)' : 'linear-gradient(135deg, #FCD34D, #F59E0B)' }}>
                            <Target className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Tính năng sắp ra mắt</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                            Đặt mục tiêu tiết kiệm, theo dõi tiến độ và đạt được tài chính mơ ước của bạn.
                        </p>
                        <div className="w-full space-y-3">
                            {[
                                { icon: '🏠', title: 'Mua nhà / xe', desc: 'Đặt mục tiêu số tiền lớn' },
                                { icon: '✈️', title: 'Quỹ du lịch', desc: 'Tiết kiệm cho chuyến đi' },
                                { icon: '🎓', title: 'Học phí', desc: 'Chuẩn bị quỹ giáo dục' },
                                { icon: '🌿', title: 'Quỹ khẩn cấp', desc: 'Dự phòng 3-6 tháng lương' },
                            ].map(goal => (
                                <div key={goal.title}
                                    className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700 opacity-60 dark:opacity-80">
                                    <span className="text-xl">{goal.icon}</span>
                                    <div className="flex-1 text-left">
                                        <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">{goal.title}</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">{goal.desc}</p>
                                    </div>
                                    <Lock className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
