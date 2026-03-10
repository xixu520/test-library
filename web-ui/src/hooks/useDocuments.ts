import { useState, useCallback } from 'react';
import { documentAPI } from '../services/api';
import { Document } from '../types';

interface UseDocumentsProps {
    activeStandard: string;
    activeEngineering: string;
    pageSize?: number;
}

export function useDocuments({ activeStandard, activeEngineering, pageSize = 20 }: UseDocumentsProps) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [loading, setLoading] = useState(false);

    const loadDocuments = useCallback(async () => {
        setLoading(true);
        try {
            let res;
            if (searchKeyword) {
                res = await documentAPI.search({ q: searchKeyword, page, page_size: pageSize });
                setDocuments(res.data.documents || []);
            } else {
                res = await documentAPI.list({
                    standard_type: activeStandard,
                    engineering_type: activeEngineering,
                    page,
                    page_size: pageSize,
                });
                setDocuments(res.data.documents || []);
            }
            setTotal(res.data.total || 0);
        } catch (error) {
            console.error('Failed to load documents:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [activeStandard, activeEngineering, page, searchKeyword, pageSize]);

    return {
        documents,
        total,
        page,
        setPage,
        searchKeyword,
        setSearchKeyword,
        loading,
        loadDocuments,
    };
}
