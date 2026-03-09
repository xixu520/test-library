/**
 * API 请求服务层。
 * 封装 Axios 实例，统一处理 JWT 令牌和错误拦截。
 */

import axios from 'axios';

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
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// ─── Auth ────────────────────────────────────────
export const authAPI = {
    login: (data) => api.post('/auth/login', data),
    register: (data) => api.post('/auth/register', data),
};

// ─── Categories ──────────────────────────────────
export const categoryAPI = {
    getAll: () => api.get('/categories'),
};

// ─── Documents ───────────────────────────────────
export const documentAPI = {
    list: (params) => api.get('/documents', { params }),
    getById: (id) => api.get(`/documents/${id}`),
    upload: (formData) =>
        api.post('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
    delete: (id) => api.delete(`/documents/${id}`),
    search: (params) => api.get('/documents/search', { params }),
    previewUrl: (id) => `${API_BASE}/documents/${id}/preview`,
    verify: (id) => api.post(`/documents/${id}/verify`),
    retryOcr: (id) => api.post(`/documents/${id}/ocr`),
    remoteOcr: (id) => api.post(`/documents/${id}/remote-ocr`),
};

// ─── Settings ────────────────────────────────────
export const settingsAPI = {
    getOcr: () => api.get('/settings/ocr'),
    updateOcr: (data) => api.post('/settings/ocr', data),
    getLogs: () => api.get('/settings/logs'),
    testOcr: () => api.post('/settings/test-ocr'),
};

// ─── Recycle Bin ─────────────────────────────────
export const recycleBinAPI = {
    list: () => api.get('/recycle-bin'),
    restore: (id) => api.post(`/recycle-bin/${id}/restore`),
    hardDelete: (id) => api.delete(`/recycle-bin/${id}/hard`),
    empty: () => api.delete('/recycle-bin/empty'),
};

export default api;
