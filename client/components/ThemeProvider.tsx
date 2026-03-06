'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/useStore';

export default function ThemeProvider() {
    const { isDarkMode } = useUIStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode, mounted]);

    return null;
}
