import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    _id: string;
    name: string;
    email: string;
    avatar: string;
    currency: string;
}

interface AuthStore {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
    updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            login: (user, token) => {
                if (typeof window !== 'undefined') localStorage.setItem('token', token);
                set({ user, token, isAuthenticated: true });
            },
            logout: () => {
                if (typeof window !== 'undefined') localStorage.removeItem('token');
                set({ user: null, token: null, isAuthenticated: false });
            },
            updateUser: (data) =>
                set((s) => ({ user: s.user ? { ...s.user, ...data } : null })),
        }),
        { name: 'auth-store' }
    )
);

interface UIStore {
    isDarkMode: boolean;
    isAddModalOpen: boolean;
    isSidebarOpen: boolean;
    toggleDarkMode: () => void;
    openAddModal: () => void;
    closeAddModal: () => void;
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            isDarkMode: false,
            isAddModalOpen: false,
            isSidebarOpen: false,
            toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
            openAddModal: () => set({ isAddModalOpen: true }),
            closeAddModal: () => set({ isAddModalOpen: false }),
        }),
        { name: 'ui-store', partialize: (s) => ({ isDarkMode: s.isDarkMode }) }
    )
);
