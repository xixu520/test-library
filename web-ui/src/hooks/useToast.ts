import { useState, useCallback, useEffect } from 'react';

/**
 * 全局 Toast Hook。
 * 管理 Toast 的显示状态。
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
    msg: string;
    type: ToastType;
    id: number;
}

export function useToast() {
    const [toast, setToast] = useState<ToastState | null>(null);

    const showToast = useCallback((msg: string, type: ToastType = 'success') => {
        setToast({ msg, type, id: Date.now() });
    }, []);

    const hideToast = useCallback(() => {
        setToast(null);
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                setToast(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    return { toast, showToast, hideToast };
}
