import { useState, useEffect, useRef, useCallback } from 'react';
import { documentAPI, categoryAPI } from '../services/api';
import { useAuthStore } from '../store/AuthContext';
import { useAuthorize } from '../hooks/useAuthorize';
import { useDocuments } from '../hooks/useDocuments';
import { useRecycleBin } from '../hooks/useRecycleBin';
import DocumentTable from '../components/DocumentTable';
import UploadModal from '../components/UploadModal';
import EditModal from '../components/EditModal';
import PDFViewer from '../components/PDFViewer';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { Document as StandardDocument } from '../types';

const STATUS_MAP = {
    completed: { label: '已完成', cls: 'success' },
    processing: { label: '处理中', cls: 'warning' },
    failed: { label: '失败', cls: 'error' },
    pending: { label: '待处理', cls: 'pending' },
    matched: { label: '已核验', cls: 'success' },
    updated: { label: '已更新', cls: 'warning' },
    skipped: { label: '跳过', cls: 'pending' },
};

/**
 * 主仪表盘页面。
 * 包含左侧标准分类、顶部工程分类、文档列表、上传和安全预览功能。
 */
export default function Dashboard({ onNavigateSettings }: { onNavigateSettings: (tab: string) => void }) {
    const { user, logout, darkMode, toggleDarkMode } = useAuthStore();
    const { can } = useAuthorize();
    const [activeStandard, setActiveStandard] = useState('');
    const [activeEngineering, setActiveEngineering] = useState('');
    const [standardTypes, setStandardTypes] = useState<string[]>([]);
    const [engineeringTypes, setEngineeringTypes] = useState<string[]>([]);

    const {
        documents,
        total,
        page,
        setPage,
        searchKeyword,
        setSearchKeyword,
        loading,
        loadDocuments
    } = useDocuments({ activeStandard, activeEngineering, pageSize: 20 });

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editDoc, setEditDoc] = useState<StandardDocument | null>(null);
    const [previewDoc, setPreviewDoc] = useState<StandardDocument | null>(null);
    const [showRecycleBin, setShowRecycleBin] = useState(false);

    const {
        recycleBinDocs,
        loadRecycleBin,
        restoreDocument,
        hardDeleteDocument,
        emptyRecycleBin
    } = useRecycleBin();

    const { toast, showToast } = useToast();
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const pageSize = 20;

    // Click outside handler for dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !(dropdownRef.current as any).contains(event.target as Node)) {
                setShowUserDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    // 加载分类数据
    useEffect(() => {
        categoryAPI.getAll().then((res) => {
            const data = (res.data as any);
            setStandardTypes(data.standard_types || []);
            setEngineeringTypes(data.engineering_types || []);
        }).catch(() => { });
    }, []);

    useEffect(() => {
        if (!showRecycleBin) loadDocuments();
    }, [loadDocuments, showRecycleBin]);


    const handleDelete = useCallback(async (id: number | string) => {
        if (!window.confirm('确认删除此文档？删除后将移至回收站（保留30天）。')) return;
        try {
            await documentAPI.delete(id);
            showToast('已移入回收站');
            loadDocuments();
        } catch {
            showToast('删除失败', 'error');
        }
    }, [loadDocuments, showToast]);

    const handleRestore = useCallback(async (id: number | string) => {
        try {
            await restoreDocument(id);
            showToast('文档已恢复');
        } catch {
            showToast('恢复失败', 'error');
        }
    }, [restoreDocument, showToast]);

    const handleRetryOcr = useCallback(async (id: number | string) => {
        try {
            await documentAPI.retryOcr(id);
            showToast('OCR 已重新触发');
            setTimeout(() => loadDocuments(), 3000);
        } catch {
            showToast('重试失败', 'error');
        }
    }, [loadDocuments, showToast]);

    const handleRemoteOcr = useCallback(async (id: number | string) => {
        try {
            await documentAPI.remoteOcr(id);
            showToast('远程 OCR 已触发');
            setTimeout(() => loadDocuments(), 3000);
        } catch {
            showToast('远程 OCR 触发失败', 'error');
        }
    }, [loadDocuments, showToast]);

    const handleRetryVerify = useCallback(async (id: number | string) => {
        try {
            await documentAPI.verify(id);
            showToast('核验已重新触发');
            setTimeout(() => loadDocuments(), 3000);
        } catch {
            showToast('重试失败', 'error');
        }
    }, [loadDocuments, showToast]);

    const handleHardDelete = useCallback(async (id: number | string) => {
        if (!window.confirm('此操作不可恢复！确认彻底删除此文档？')) return;
        try {
            await hardDeleteDocument(id);
            showToast('文档已彻底删除');
        } catch {
            showToast('彻底删除失败', 'error');
        }
    }, [hardDeleteDocument, showToast]);

    const handleEmptyTrash = useCallback(async () => {
        if (!window.confirm('确认清空回收站？所有文档将被彻底删除且不可恢复！')) return;
        try {
            const res = await emptyRecycleBin();
            showToast((res as any).data?.message || '回收站已清空');
        } catch {
            showToast('清空回收站失败', 'error');
        }
    }, [emptyRecycleBin, showToast]);

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '—';
        return dateStr.substring(0, 10);
    };

    // ─── 渲染 ────────────────────────────────────────
    return (
        <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark' : ''} transition-colors bg-gray-50 dark:bg-gray-950`}>
            {/* ─── 左侧边栏 ─── */}
            <aside className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col flex-shrink-0 overflow-y-auto transition-colors">
                <div className="p-4 text-lg font-bold text-indigo-600 dark:text-indigo-400 border-b border-gray-100 dark:border-gray-800">📂 文档管理</div>

                <div className="py-3">
                    <div className="px-4 pb-2 text-[11px] font-semibold uppercase text-gray-400 dark:text-gray-500 tracking-wider">标准分类</div>
                    <div
                        className={`flex items-center px-4 py-2 cursor-pointer text-sm transition-colors ${activeStandard === '' && !showRecycleBin ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:text-indigo-600 dark:hover:text-indigo-300'}`}
                        onClick={() => { setActiveStandard(''); setShowRecycleBin(false); setPage(1); }}
                    >
                        <span className="mr-2 text-base">📋</span> 全部标准
                    </div>
                    {standardTypes.map((st) => (
                        <div
                            key={st}
                            className={`flex items-center px-4 py-2 cursor-pointer text-sm transition-colors ${activeStandard === st && !showRecycleBin ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:text-indigo-600 dark:hover:text-indigo-300'}`}
                            onClick={() => { setActiveStandard(st); setShowRecycleBin(false); setPage(1); }}
                        >
                            <span className="mr-2 text-base">📁</span> {st}
                        </div>
                    ))}
                </div>

                <div className="h-px bg-gray-200 dark:bg-gray-800 mx-4 my-1" />

                {can('recycle:read') && (
                    <div className="py-3">
                        <div className="px-4 pb-2 text-[11px] font-semibold uppercase text-gray-400 dark:text-gray-500 tracking-wider">管理</div>
                        <div
                            className={`flex items-center px-4 py-2 cursor-pointer text-sm transition-colors ${showRecycleBin ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:text-indigo-600 dark:hover:text-indigo-300'}`}
                            onClick={() => { setShowRecycleBin(true); loadRecycleBin(); }}
                        >
                            <span className="mr-2 text-base">🗑️</span> 回收站
                        </div>
                    </div>
                )}
                <div className="mt-auto p-4 text-[11px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 text-center">v0.1.0</div>
            </aside>

            {/* ─── 主内容区 ─── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* ─── 顶部栏 ─── */}
                <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-5 flex-shrink-0 transition-colors">
                    <div className="flex gap-1 overflow-x-auto flex-1 custom-scrollbar">
                        <div
                            className={`px-3.5 py-1.5 cursor-pointer text-sm rounded transition-colors whitespace-nowrap ${activeEngineering === '' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-gray-800'}`}
                            onClick={() => { setActiveEngineering(''); setPage(1); }}
                        >
                            全部
                        </div>
                        {engineeringTypes.map((et) => (
                            <div
                                key={et}
                                className={`px-3.5 py-1.5 cursor-pointer text-sm rounded transition-colors whitespace-nowrap ${activeEngineering === et ? 'bg-indigo-600 text-white font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-gray-800'}`}
                                onClick={() => { setActiveEngineering(et); setPage(1); }}
                            >
                                {et}
                            </div>
                        ))}
                    </div>

                    <div className="relative flex items-center gap-3 ml-4 flex-shrink-0" ref={dropdownRef}>
                        <button
                            className="p-2 text-gray-500 hover:text-indigo-600 transition-colors border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
                            onClick={toggleDarkMode}
                            title={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
                        >
                            {darkMode ? '🌙' : '☀️'}
                        </button>

                        <button
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:border-indigo-600 hover:text-indigo-600 transition-colors bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                            onClick={() => setShowUserDropdown(!showUserDropdown)}
                        >
                            <span className="text-base text-gray-400">👤</span> {user?.username}
                        </button>

                        {showUserDropdown && (
                            <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 min-w-48 z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-3.5 flex flex-col bg-gray-50 border-b border-gray-100">
                                    <strong className="text-sm font-bold text-gray-800">{user?.username}</strong>
                                    <span className="text-[11px] text-gray-400 mt-0.5">{user?.role === 'admin' ? '系统管理员' : '普通用户'}</span>
                                </div>
                                <div className="h-px bg-gray-100 my-1"></div>
                                <button className="flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { setShowUserDropdown(false); onNavigateSettings('profile'); }}>
                                    <span className="text-base">⚙️</span> 个人设置
                                </button>
                                {can('system:config') && (
                                    <button className="flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { setShowUserDropdown(false); onNavigateSettings('system'); }}>
                                        <span>🛡️</span> 系统高级设置
                                    </button>
                                )}
                                <div className="h-px bg-gray-100 my-1"></div>
                                <button className="flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors" onClick={logout}>
                                    <span className="text-base">🚪</span> 退出登录
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                {/* ─── 内容区 ─── */}
                <div className="flex-1 p-5 overflow-y-auto bg-gray-50/50 dark:bg-gray-950 transition-colors">
                    {showRecycleBin ? (
                        /* ─── 回收站视图 ─── */
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">回收站</h3>
                                {can('recycle:write') && recycleBinDocs.length > 0 && (
                                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 transition-colors" onClick={handleEmptyTrash}>
                                        🧹 清空回收站
                                    </button>
                                )}
                            </div>
                            {recycleBinDocs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600">
                                    <div className="text-5xl mb-3">🗑️</div>
                                    <p className="text-sm">回收站为空</p>
                                </div>
                            ) : (
                                <div className="w-full overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
                                    <table className="w-full border-collapse bg-white dark:bg-gray-900 transition-colors">
                                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">标准号</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">标准名称</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">文件名</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">删除时间</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {recycleBinDocs.map((doc: any) => (
                                                <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{doc.document_number || '-'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{doc.standard_name || doc.file_name}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{doc.file_name}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(doc.deleted_at)}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <div className="flex gap-2">
                                                            <button className="px-2.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors" onClick={() => handleRestore(doc.id)}>
                                                                恢复
                                                            </button>
                                                            <button className="px-2.5 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors" onClick={() => handleHardDelete(doc.id)}>
                                                                彻底删除
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) /* ─── 回收站视图 ─── */
                            }
                        </>
                    ) : (
                        /* ─── 文档列表视图 ─── */
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        placeholder="搜索文档内容..."
                                        className="px-3 py-1.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 rounded text-sm w-60 outline-none focus:border-indigo-600 transition-colors"
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && loadDocuments()}
                                    />
                                    <button className="px-4 py-1.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium whitespace-nowrap transition-colors" onClick={loadDocuments}>搜索</button>
                                </div>
                                {can('document:write') && (
                                    <button className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors" onClick={() => setShowUploadModal(true)}>
                                        ＋ 上传文档
                                    </button>
                                )}
                            </div>

                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600 font-medium"><p className="text-sm">加载中...</p></div>
                            ) : documents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600">
                                    <div className="text-5xl mb-3">📂</div>
                                    <p className="text-sm font-medium">暂无文档</p>
                                </div>
                            ) : (
                                <>
                                    <DocumentTable
                                        documents={documents}
                                        statusMap={STATUS_MAP}
                                        onRetryOcr={handleRetryOcr}
                                        onRemoteOcr={handleRemoteOcr}
                                        onRetryVerify={handleRetryVerify}
                                        onPreview={(doc) => setPreviewDoc(doc as any)}
                                        onEdit={(doc) => { setEditDoc(doc as any); setShowEditModal(true); }}
                                        onDelete={handleDelete}
                                    />

                                    <div className="flex items-center justify-center gap-2 py-4">
                                        <button disabled={page <= 1} className="px-3 py-1 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => setPage(page - 1)}>上一页</button>
                                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页</span>
                                        <button disabled={page >= Math.ceil(total / pageSize)} className="px-3 py-1 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => setPage(page + 1)}>下一页</button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ─── 上传弹窗 ─── */}
            {showUploadModal && (
                <UploadModal
                    standardTypes={standardTypes}
                    engineeringTypes={engineeringTypes}
                    onClose={() => setShowUploadModal(false)}
                    onSuccess={() => { setShowUploadModal(false); showToast('上传成功'); loadDocuments(); }}
                    onError={(msg: string) => showToast(msg, 'error')}
                />
            )}

            {/* ─── 编辑弹窗 ─── */}
            {showEditModal && editDoc && (
                <EditModal
                    doc={editDoc}
                    standardTypes={standardTypes}
                    engineeringTypes={engineeringTypes}
                    onClose={() => { setShowEditModal(false); setEditDoc(null); }}
                    onSuccess={() => { setShowEditModal(false); setEditDoc(null); showToast('更新成功'); loadDocuments(); }}
                    onError={(msg: string) => showToast(msg, 'error')}
                />
            )}

            {/* ─── 安全 PDF 预览器 ─── */}
            {previewDoc && (
                <PDFViewer
                    url={documentAPI.previewUrl((previewDoc as any).id)}
                    title={(previewDoc as any).document_number || (previewDoc as any).file_name}
                    onClose={() => setPreviewDoc(null)}
                />
            )}

            {/* ─── Toast ─── */}
            {toast && <Toast msg={toast.msg} type={toast.type} />}
        </div>
    );
}
