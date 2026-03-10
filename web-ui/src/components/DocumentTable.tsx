import { useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAuthorize } from '../hooks/useAuthorize';
import { Document } from '../types';

interface DocumentTableProps {
    documents: Document[];
    statusMap: Record<string, { label: string; cls: string }>;
    onRetryOcr: (id: string | number) => void;
    onRemoteOcr: (id: string | number) => void;
    onRetryVerify: (id: string | number) => void;
    onPreview: (doc: Document) => void;
    onEdit: (doc: Document) => void;
    onDelete: (id: string | number) => void;
}

export default function DocumentTable({
    documents,
    statusMap,
    onRetryOcr,
    onRemoteOcr,
    onRetryVerify,
    onPreview,
    onEdit,
    onDelete
}: DocumentTableProps) {
    const { can } = useAuthorize();
    const isAdminView = can('system:config');
    const parentRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 虚拟化配置
    const rowVirtualizer = useVirtualizer({
        count: documents.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => isMobile ? 180 : 64,
        overscan: 5,
    });

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '—';
        return dateStr.substring(0, 10);
    };

    const getStatusBadge = (currentStatus?: string) => {
        if (!currentStatus) return null;
        const meta = (statusMap as any)[currentStatus];
        const cls = meta?.cls || 'pending';
        const label = meta?.label || currentStatus;

        const colors = {
            success: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
            warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
            error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
            pending: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
        }[cls as keyof typeof colors] || 'bg-gray-50 text-gray-700 border-gray-200';

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${colors}`}>
                {label}
            </span>
        );
    };

    const virtualRows = rowVirtualizer.getVirtualItems();

    // 定义桌面端列宽
    const gridTemplate = "140px minmax(250px, 1.5fr) 100px 100px 100px 100px 100px 100px 100px 180px";

    return (
        <div
            ref={parentRef}
            className="w-full h-[600px] overflow-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 custom-scrollbar bg-white dark:bg-gray-900 transition-colors"
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: isMobile ? '100%' : '1400px', // 确保持续触发水平滚动
                    position: 'relative',
                }}
            >
                {isMobile ? (
                    /* ─── 移动端卡片布局 ─── */
                    <div className="flex flex-col gap-4 p-4">
                        {virtualRows.map((virtualRow) => {
                            const doc = documents[virtualRow.index];
                            if (!doc) return null;
                            const fileName = (doc as any).file_name || doc.filename;
                            return (
                                <div
                                    key={doc.id}
                                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex flex-col gap-3"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: 'calc(100% - 32px)',
                                        margin: '0 16px',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{doc.document_number || '无标准号'}</span>
                                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1 line-clamp-2">{doc.standard_name || fileName}</h4>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {getStatusBadge(doc.ocr_status)}
                                            {getStatusBadge((doc as any).verification_status)}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                        <div>类型: <span className="text-gray-700 dark:text-gray-300">{doc.category || doc.standard_type || '-'}</span></div>
                                        <div>工程: <span className="text-gray-700 dark:text-gray-300">{doc.engineering_type || '-'}</span></div>
                                        <div>发布: <span className="text-gray-700 dark:text-gray-300">{formatDate(doc.publish_date || (doc as any).upload_date)}</span></div>
                                        <div>实施: <span className="text-gray-700 dark:text-gray-300">{formatDate(doc.effective_date)}</span></div>
                                    </div>
                                    <div className="flex gap-2 mt-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                        <button className="flex-1 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700" onClick={() => onPreview(doc)}>查看</button>
                                        {isAdminView && (
                                            <>
                                                <button className="flex-1 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => onEdit(doc)}>编辑</button>
                                                <button className="px-3 py-1.5 text-red-600 dark:text-red-400 text-xs font-medium" onClick={() => onDelete(doc.id!)}>删除</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* ─── 桌面端基于 Grid 的虚拟滚动列表 ─── */
                    <div className="flex flex-col w-full text-left bg-white dark:bg-gray-900 transition-colors">
                        {/* ─── 表头 ─── */}
                        <div
                            className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 transition-colors grid items-center px-4"
                            style={{ gridTemplateColumns: gridTemplate, height: '48px' }}
                        >
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">标准号</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">标准名称</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">标准类型</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">工程类型</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">发布日期</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">实施日期</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">废止日期</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">OCR</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">核验</div>
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky right-0 bg-gray-50 dark:bg-gray-800 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.05)] pl-4">操作</div>
                        </div>

                        {/* ─── 虚拟行内容 ─── */}
                        <div className="relative w-full h-full">
                            {virtualRows.map((virtualRow) => {
                                const doc = documents[virtualRow.index];
                                if (!doc) return null;
                                const fileName = (doc as any).file_name || doc.filename;
                                return (
                                    <div
                                        key={doc.id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-800 grid items-center px-4"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                            gridTemplateColumns: gridTemplate
                                        }}
                                    >
                                        <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate pr-2">
                                            {doc.document_number || '-'}
                                        </div>
                                        <div className="text-sm text-gray-700 dark:text-gray-300 truncate pr-4" title={doc.standard_name || fileName}>
                                            {doc.standard_name || fileName}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">{doc.category || doc.standard_type}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">{doc.engineering_type || '-'}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-500">{formatDate((doc as any).upload_date || doc.publish_date)}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-500">{formatDate(doc.effective_date)}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-500">{formatDate(doc.abolish_date)}</div>

                                        <div className="flex flex-col gap-1 items-start">
                                            {getStatusBadge(doc.ocr_status)}
                                            {can('ocr:trigger') && (
                                                <div className="flex gap-1">
                                                    {(doc.ocr_status === 'failed' || doc.ocr_status === 'skipped') && (
                                                        <button
                                                            className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 rounded text-[9px] text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:border-indigo-600 hover:text-indigo-600 transition-colors"
                                                            onClick={() => onRetryOcr(doc.id!)}
                                                        >
                                                            🔁
                                                        </button>
                                                    )}
                                                    {(doc.ocr_status === 'completed' || doc.ocr_status === 'failed' || doc.ocr_status === 'skipped') && (
                                                        <button
                                                            className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 rounded text-[9px] text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:border-indigo-600 hover:text-indigo-600 transition-colors"
                                                            onClick={() => onRemoteOcr(doc.id!)}
                                                        >
                                                            🌐
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-1 items-start">
                                            {getStatusBadge((doc as any).verification_status)}
                                            {can('document:write') && ((doc as any).verification_status === 'failed' || (doc as any).verification_status === 'skipped') && (
                                                <button
                                                    className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 rounded text-[9px] text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:border-indigo-600 hover:text-indigo-600 transition-colors"
                                                    onClick={() => onRetryVerify(doc.id!)}
                                                >
                                                    🔁
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-1.5 sticky right-0 bg-white dark:bg-gray-900 transition-colors shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.05)] pl-4 h-full items-center">
                                            <button
                                                className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:border-indigo-600 hover:text-indigo-600 transition-colors font-medium"
                                                onClick={() => onPreview(doc)}
                                            >
                                                查看
                                            </button>
                                            {isAdminView && (
                                                <>
                                                    <button
                                                        className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:border-indigo-600 hover:text-indigo-600 transition-colors font-medium"
                                                        onClick={() => onEdit(doc)}
                                                    >
                                                        编辑
                                                    </button>
                                                    <button
                                                        className="px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-xs hover:bg-red-600 hover:text-white transition-all font-medium border border-red-100 dark:border-red-900/50"
                                                        onClick={() => onDelete(doc.id!)}
                                                    >
                                                        删除
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
