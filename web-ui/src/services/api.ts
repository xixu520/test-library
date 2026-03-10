/**
 * API 请求服务层。
 * 封装 Axios 实例，统一处理 JWT 令牌和错误拦截。
 */

import axios from 'axios';
import { AuthResponse, Category, Document, OcrSettings, PaginatedResponse, RecycleBinItem, RegisterStatus } from '../types';

const API_BASE = '/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 60000,
});

// 请求拦截器：自动附加 JWT
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 响应拦截器：处理 401 自动跳转登录
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // 只有当不在登录页时才跳转，防止无限重定向循环
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(err);
    }
);

// ─── Auth ────────────────────────────────────────
export const authAPI = {
    login: (data: any) => api.post<AuthResponse>('/auth/login', data),
    register: (data: any) => api.post<AuthResponse>('/auth/register', data),
    updatePassword: (data: any) => api.put('/auth/password', data),  // 改为 PUT

    // 查询注册开关状态（公开接口，无需鉴权）
    getRegisterStatus: () => api.get<RegisterStatus>('/auth/register/status'),
    // 切换注册开关（需 register:toggle 权限）
    setRegisterStatus: (enabled: boolean) =>
        api.put<RegisterStatus>('/auth/register/status', { enabled }),
};

// ─── Categories ──────────────────────────────────
export const categoryAPI = {
    getAll: () => api.get<Category[]>('/categories'),
};

// ─── Documents ───────────────────────────────────
export const documentAPI = {
    list: (params: any) => api.get<PaginatedResponse<Document>>('/documents', { params }),
    getById: (id: string | number) => api.get<Document>(`/documents/${id}`),
    update: (id: string | number, data: any) => api.put<Document>(`/documents/${id}`, data),
    upload: (formData: FormData) =>
        api.post<Document>('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
    delete: (id: string | number) => api.delete(`/documents/${id}`),
    search: (params: any) => api.get<PaginatedResponse<Document>>('/documents/search', { params }),
    previewUrl: (id: string | number) => `${API_BASE}/documents/${id}/preview`,
    verify: (id: string | number) => api.post(`/documents/${id}/verify`),
    retryOcr: (id: string | number) => api.post(`/documents/${id}/ocr`),
    remoteOcr: (id: string | number) => api.post(`/documents/${id}/remote-ocr`),
};

// ─── Settings ────────────────────────────────────
export const settingsAPI = {
    getOcr: () => api.get<OcrSettings>('/settings/ocr'),
    updateOcr: (data: OcrSettings) => api.post('/settings/ocr', data),
    getLogs: () => api.get<string[]>('/settings/logs'),
    testOcr: () => api.post('/settings/test-ocr'),
    getBaiduOcrSettings: () => api.get<OcrSettings>('/settings/baidu-ocr'),
    saveBaiduOcrSettings: (data: OcrSettings) => api.post('/settings/baidu-ocr', data)
};

// ─── Recycle Bin ─────────────────────────────────
export const recycleBinAPI = {
    list: () => api.get<RecycleBinItem[]>('/recycle-bin'),
    restore: (id: string | number) => api.post(`/recycle-bin/${id}/restore`),
    hardDelete: (id: string | number) => api.delete(`/recycle-bin/${id}/hard`),
    empty: () => api.delete('/recycle-bin/empty'),
};

export default api;
