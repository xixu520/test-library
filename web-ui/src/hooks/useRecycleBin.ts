import { useState, useCallback } from 'react';
import { recycleBinAPI } from '../services/api';
import { RecycleBinItem } from '../types';

export function useRecycleBin() {
    const [recycleBinDocs, setRecycleBinDocs] = useState<RecycleBinItem[]>([]);
    const [loading, setLoading] = useState(false);

    const loadRecycleBin = useCallback(async () => {
        setLoading(true);
        try {
            const res = await recycleBinAPI.list();
            setRecycleBinDocs((res.data as any).documents || []);
        } catch (error) {
            console.error('Failed to load recycle bin:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    const restoreDocument = async (id: number | string) => {
        await recycleBinAPI.restore(id);
        await loadRecycleBin();
    };

    const hardDeleteDocument = async (id: number | string) => {
        await recycleBinAPI.hardDelete(id);
        await loadRecycleBin();
    };

    const emptyRecycleBin = async () => {
        const res = await recycleBinAPI.empty();
        await loadRecycleBin();
        return res;
    };

    return {
        recycleBinDocs,
        loading,
        loadRecycleBin,
        restoreDocument,
        hardDeleteDocument,
        emptyRecycleBin,
    };
}
