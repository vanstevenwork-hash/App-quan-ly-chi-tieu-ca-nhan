import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 globally
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('token');
            window.location.href = '/auth/login';
        }
        return Promise.reject(err);
    }
);

// Auth
export const authApi = {
    register: (data: { name: string; email: string; password: string }) =>
        api.post('/auth/register', data),
    login: (data: { email: string; password: string }) =>
        api.post('/auth/login', data),
    getProfile: () => api.get('/auth/profile'),
    updateProfile: (data: object) => api.put('/auth/profile', data),
};

// Transactions
export const transactionsApi = {
    getAll: (params?: object) => api.get('/transactions', { params }),
    getSummary: (params?: object) => api.get('/transactions/summary', { params }),
    getCategoryBreakdown: (params?: object) => api.get('/transactions/category-breakdown', { params }),
    create: (data: object) => api.post('/transactions', data),
    update: (id: string, data: object) => api.put(`/transactions/${id}`, data),
    delete: (id: string) => api.delete(`/transactions/${id}`),
};

// Accounts
export const accountsApi = {
    getAll: () => api.get('/accounts'),
    create: (data: object) => api.post('/accounts', data),
    update: (id: string, data: object) => api.put(`/accounts/${id}`, data),
    delete: (id: string) => api.delete(`/accounts/${id}`),
};

// Budgets
export const budgetsApi = {
    getAll: (params?: object) => api.get('/budgets', { params }),
    create: (data: object) => api.post('/budgets', data),
    update: (id: string, data: object) => api.put(`/budgets/${id}`, data),
    delete: (id: string) => api.delete(`/budgets/${id}`),
};

// Goals
export const goalsApi = {
    getAll: () => api.get('/goals'),
    create: (data: object) => api.post('/goals', data),
    update: (id: string, data: object) => api.put(`/goals/${id}`, data),
    delete: (id: string) => api.delete(`/goals/${id}`),
    deposit: (id: string, amount: number) => api.post(`/goals/${id}/deposit`, { amount }),
};

// Cards
export const cardsApi = {
    getAll: () => api.get('/cards'),
    create: (data: object) => api.post('/cards', data),
    update: (id: string, data: object) => api.put(`/cards/${id}`, data),
    delete: (id: string) => api.delete(`/cards/${id}`),
    setDefault: (id: string) => api.patch(`/cards/${id}/set-default`),
    pay: (id: string, amount: number) => api.patch(`/cards/${id}/pay`, { amount }),
    updateBalance: (id: string, amount: number, action: 'add' | 'set') => api.patch(`/cards/${id}/balance`, { amount, action }),
};

// Wealth Sources
export const wealthApi = {
    getAll: () => api.get('/wealth'),
    create: (data: object) => api.post('/wealth', data),
    update: (id: string, data: object) => api.put(`/wealth/${id}`, data),
    delete: (id: string) => api.delete(`/wealth/${id}`),
};

// Notifications
export const notificationsApi = {
    getAll: (params?: object) => api.get('/notifications', { params }),
    markRead: (id: string) => api.patch(`/notifications/${id}/read`),
    markAllRead: () => api.patch('/notifications/read-all'),
    deleteOne: (id: string) => api.delete(`/notifications/${id}`),
    clearAll: () => api.delete('/notifications/clear-all'),
};

export default api;
