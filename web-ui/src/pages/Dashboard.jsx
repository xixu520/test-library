import { useState, useEffect, useCallback } from 'react';
import { documentAPI, categoryAPI, recycleBinAPI, settingsAPI } from '../services/api';
import PDFViewer from '../components/PDFViewer';

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
export default function Dashboard({ user, onLogout }) {
    const [standardTypes, setStandardTypes] = useState([]);
    const [engineeringTypes, setEngineeringTypes] = useState([]);
    const [activeStandard, setActiveStandard] = useState('');
    const [activeEngineering, setActiveEngineering] = useState('');
    const [documents, setDocuments] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [editDoc, setEditDoc] = useState(null);
    const [previewDoc, setPreviewDoc] = useState(null);
    const [showRecycleBin, setShowRecycleBin] = useState(false);
    const [recycleBinDocs, setRecycleBinDocs] = useState([]);
    const [toast, setToast] = useState(null);

    const isAdmin = user?.role === 'admin';
    const pageSize = 20;

    // 加载分类数据
    useEffect(() => {
        categoryAPI.getAll().then((res) => {
            setStandardTypes(res.data.standard_types || []);
            setEngineeringTypes(res.data.engineering_types || []);
        }).catch(() => { });
    }, []);

    // 加载文档列表
    const loadDocuments = useCallback(async () => {
        setLoading(true);
        try {
            let res;
            if (searchKeyword) {
                res = await documentAPI.search({ q: searchKeyword, page, page_size: pageSize });
            } else {
                res = await documentAPI.list({
                    standard_type: activeStandard,
                    engineering_type: activeEngineering,
                    page,
                    page_size: pageSize,
                });
            }
            setDocuments(res.data.documents || []);
            setTotal(res.data.total || 0);
        } catch {
            showToast('文档加载失败', 'error');
        } finally {
            setLoading(false);
        }
    }, [activeStandard, activeEngineering, page, searchKeyword]);

    useEffect(() => {
        if (!showRecycleBin) loadDocuments();
    }, [loadDocuments, showRecycleBin]);

    // 加载回收站
    const loadRecycleBin = async () => {
        try {
            const res = await recycleBinAPI.list();
            setRecycleBinDocs(res.data.documents || []);
        } catch {
            showToast('回收站加载失败', 'error');
        }
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('确认删除此文档？删除后将移至回收站（保留30天）。')) return;
        try {
            await documentAPI.delete(id);
            showToast('已移入回收站');
            loadDocuments();
        } catch {
            showToast('删除失败', 'error');
        }
    };

    const handleRestore = async (id) => {
        try {
            await recycleBinAPI.restore(id);
            showToast('文档已恢复');
            loadRecycleBin();
        } catch {
            showToast('恢复失败', 'error');
        }
    };

    const handleRetryOcr = async (id) => {
        try {
            await documentAPI.retryOcr(id);
            showToast('OCR 已重新触发');
            setTimeout(() => loadDocuments(), 3000);
        } catch {
            showToast('重试失败', 'error');
        }
    };

    const handleRemoteOcr = async (id) => {
        try {
            await documentAPI.remoteOcr(id);
            showToast('远程 OCR 已触发');
            setTimeout(() => loadDocuments(), 3000);
        } catch {
            showToast('远程 OCR 触发失败', 'error');
        }
    };

    const handleRetryVerify = async (id) => {
        try {
            await documentAPI.verify(id);
            showToast('核验已重新触发');
            setTimeout(() => loadDocuments(), 3000);
        } catch {
            showToast('重试失败', 'error');
        }
    };

    const handleHardDelete = async (id) => {
        if (!window.confirm('此操作不可恢复！确认彻底删除此文档？')) return;
        try {
            await recycleBinAPI.hardDelete(id);
            showToast('文档已彻底删除');
            loadRecycleBin();
        } catch {
            showToast('彻底删除失败', 'error');
        }
    };

    const handleEmptyTrash = async () => {
        if (!window.confirm('确认清空回收站？所有文档将被彻底删除且不可恢复！')) return;
        try {
            const res = await recycleBinAPI.empty();
            showToast(res.data.message || '回收站已清空');
            loadRecycleBin();
        } catch {
            showToast('清空回收站失败', 'error');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return dateStr.substring(0, 10);
    };

    // ─── 渲染 ────────────────────────────────────────
    return (
        <div className="app-layout">
            {/* ─── 左侧边栏 ─── */}
            <aside className="sidebar">
                <div className="sidebar-header">📂 文档管理</div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">标准分类</div>
                    <div
                        className={`sidebar-item ${activeStandard === '' && !showRecycleBin ? 'active' : ''}`}
                        onClick={() => { setActiveStandard(''); setShowRecycleBin(false); setPage(1); }}
                    >
                        <span className="icon">📋</span> 全部标准
                    </div>
                    {standardTypes.map((st) => (
                        <div
                            key={st}
                            className={`sidebar-item ${activeStandard === st && !showRecycleBin ? 'active' : ''}`}
                            onClick={() => { setActiveStandard(st); setShowRecycleBin(false); setPage(1); }}
                        >
                            <span className="icon">📁</span> {st}
                        </div>
                    ))}
                </div>

                <div className="sidebar-divider" />

                {isAdmin && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">管理</div>
                        <div
                            className={`sidebar-item ${showRecycleBin ? 'active' : ''}`}
                            onClick={() => { setShowRecycleBin(true); loadRecycleBin(); }}
                        >
                            <span className="icon">🗑️</span> 回收站
                        </div>
                    </div>
                )}
            </aside>

            {/* ─── 主内容区 ─── */}
            <div className="main-content">
                {/* ─── 顶部栏 ─── */}
                <header className="top-bar">
                    <div className="tab-bar">
                        <div
                            className={`tab-item ${activeEngineering === '' ? 'active' : ''}`}
                            onClick={() => { setActiveEngineering(''); setPage(1); }}
                        >
                            全部
                        </div>
                        {engineeringTypes.map((et) => (
                            <div
                                key={et}
                                className={`tab-item ${activeEngineering === et ? 'active' : ''}`}
                                onClick={() => { setActiveEngineering(et); setPage(1); }}
                            >
                                {et}
                            </div>
                        ))}
                    </div>

                    <div className="user-menu">
                        {isAdmin && (
                            <button className="btn btn-outline btn-sm" style={{ marginRight: 8, borderColor: 'transparent' }} onClick={() => setShowSettingsModal(true)}>
                                ⚙️ 系统设置
                            </button>
                        )}
                        <button className="user-btn" onClick={onLogout}>
                            👤 {user?.username} · 退出
                        </button>
                    </div>
                </header>

                {/* ─── 内容区 ─── */}
                <div className="content-area">
                    {showRecycleBin ? (
                        /* ─── 回收站视图 ─── */
                        <>
                            <div className="toolbar">
                                <h2 style={{ fontSize: 16, fontWeight: 600 }}>🗑️ 回收站（30天后自动清理）</h2>
                                {recycleBinDocs.length > 0 && (
                                    <button className="btn btn-danger btn-sm" onClick={handleEmptyTrash}>
                                        🧹 清空回收站
                                    </button>
                                )}
                            </div>
                            {recycleBinDocs.length === 0 ? (
                                <div className="empty-state">
                                    <div className="icon">🗑️</div>
                                    <p>回收站为空</p>
                                </div>
                            ) : (
                                <table className="doc-table">
                                    <thead>
                                        <tr>
                                            <th>标准号</th>
                                            <th>文件名</th>
                                            <th>删除时间</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recycleBinDocs.map((doc) => (
                                            <tr key={doc.id}>
                                                <td>{doc.document_number || doc.file_name}</td>
                                                <td>{doc.file_name}</td>
                                                <td>{formatDate(doc.deleted_at)}</td>
                                                <td>
                                                    <button className="btn btn-sm btn-primary" onClick={() => handleRestore(doc.id)}>
                                                        恢复
                                                    </button>
                                                    <button className="btn btn-sm btn-danger" style={{ marginLeft: 4 }} onClick={() => handleHardDelete(doc.id)}>
                                                        彻底删除
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    ) : (
                        /* ─── 文档列表视图 ─── */
                        <>
                            <div className="toolbar">
                                <div className="search-box">
                                    <input
                                        placeholder="搜索文档内容..."
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && loadDocuments()}
                                    />
                                    <button className="btn btn-outline btn-sm" onClick={loadDocuments}>搜索</button>
                                </div>
                                <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                                    ＋ 上传文档
                                </button>
                            </div>

                            {loading ? (
                                <div className="empty-state"><p>加载中...</p></div>
                            ) : documents.length === 0 ? (
                                <div className="empty-state">
                                    <div className="icon">📂</div>
                                    <p>暂无文档</p>
                                </div>
                            ) : (
                                <>
                                    <table className="doc-table">
                                        <thead>
                                            <tr>
                                                <th>标准号/文件名</th>
                                                <th>标准类型</th>
                                                <th>工程类型</th>
                                                <th>发布日期</th>
                                                <th>实施日期</th>
                                                <th>废止日期</th>
                                                <th>OCR</th>
                                                <th>核验</th>
                                                <th>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {documents.map((doc) => (
                                                <tr key={doc.id}>
                                                    <td style={{ fontWeight: 500 }}>
                                                        {doc.document_number || doc.file_name}
                                                    </td>
                                                    <td>{doc.standard_type}</td>
                                                    <td>{doc.engineering_type}</td>
                                                    <td>{formatDate(doc.publish_date)}</td>
                                                    <td>{formatDate(doc.effective_date)}</td>
                                                    <td>{formatDate(doc.abolish_date)}</td>
                                                    <td>
                                                        <span className={`status-badge ${STATUS_MAP[doc.ocr_status]?.cls || 'pending'}`}>
                                                            {STATUS_MAP[doc.ocr_status]?.label || doc.ocr_status}
                                                        </span>
                                                        {(doc.ocr_status === 'failed' || doc.ocr_status === 'skipped') && (
                                                            <button
                                                                className="btn btn-sm btn-outline"
                                                                style={{ marginLeft: 4, fontSize: 11, padding: '1px 6px' }}
                                                                onClick={() => handleRetryOcr(doc.id)}
                                                            >
                                                                🔁重试
                                                            </button>
                                                        )}
                                                        {(doc.ocr_status === 'completed' || doc.ocr_status === 'failed' || doc.ocr_status === 'skipped') && (
                                                            <button
                                                                className="btn btn-sm btn-outline"
                                                                style={{ marginLeft: 4, fontSize: 11, padding: '1px 6px' }}
                                                                onClick={() => handleRemoteOcr(doc.id)}
                                                                title="使用阿里云 OCR 进行高精度识别(仅首页)"
                                                            >
                                                                🌐远程OCR
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge ${STATUS_MAP[doc.verification_status]?.cls || 'pending'}`}>
                                                            {STATUS_MAP[doc.verification_status]?.label || doc.verification_status}
                                                        </span>
                                                        {(doc.verification_status === 'failed' || doc.verification_status === 'skipped') && (
                                                            <button
                                                                className="btn btn-sm btn-outline"
                                                                style={{ marginLeft: 4, fontSize: 11, padding: '1px 6px' }}
                                                                onClick={() => handleRetryVerify(doc.id)}
                                                            >
                                                                🔁重试
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td style={{ display: 'flex', gap: 4 }}>
                                                        <button
                                                            className="btn btn-sm btn-outline"
                                                            onClick={() => setPreviewDoc(doc)}
                                                        >
                                                            查看
                                                        </button>
                                                        {isAdmin && (
                                                            <>
                                                                <button
                                                                    className="btn btn-sm btn-outline"
                                                                    onClick={() => { setEditDoc(doc); setShowEditModal(true); }}
                                                                >
                                                                    编辑
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-danger"
                                                                    onClick={() => handleDelete(doc.id)}
                                                                >
                                                                    删除
                                                                </button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <div className="pagination">
                                        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
                                        <span>第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页</span>
                                        <button disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(page + 1)}>下一页</button>
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
                    onError={(msg) => showToast(msg, 'error')}
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
                    onError={(msg) => showToast(msg, 'error')}
                />
            )}

            {/* ─── 系统设置弹窗 ─── */}
            {showSettingsModal && (
                <SettingsModal
                    onClose={() => setShowSettingsModal(false)}
                    onSuccess={() => { setShowSettingsModal(false); showToast('设置已保存'); }}
                    onError={(msg) => showToast(msg, 'error')}
                />
            )}

            {/* ─── 安全 PDF 预览器 ─── */}
            {previewDoc && (
                <PDFViewer
                    url={documentAPI.previewUrl(previewDoc.id)}
                    title={previewDoc.document_number || previewDoc.file_name}
                    onClose={() => setPreviewDoc(null)}
                />
            )}

            {/* ─── Toast ─── */}
            {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
        </div>
    );
}

/* ─── 上传弹窗组件 ─── */
function UploadModal({ standardTypes, engineeringTypes, onClose, onSuccess, onError }) {
    const [file, setFile] = useState(null);
    const [standardType, setStandardType] = useState(standardTypes[0] || '');
    const [engineeringType, setEngineeringType] = useState(engineeringTypes[0] || '');
    const [uploading, setUploading] = useState(false);

    const handleUpload = async () => {
        if (!file) { onError('请选择PDF文件'); return; }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('standard_type', standardType);
            formData.append('engineering_type', engineeringType);
            await documentAPI.upload(formData);
            onSuccess();
        } catch (err) {
            onError(err.response?.data?.error || '上传失败');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title">上传 PDF 文档</div>
                <div className="form-group">
                    <label>选择文件</label>
                    <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} />
                </div>
                <div className="form-group">
                    <label>标准类型</label>
                    <select value={standardType} onChange={(e) => setStandardType(e.target.value)}>
                        {standardTypes.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>工程类型</label>
                    <select value={engineeringType} onChange={(e) => setEngineeringType(e.target.value)}>
                        {engineeringTypes.map((et) => <option key={et} value={et}>{et}</option>)}
                    </select>
                </div>
                <div className="form-actions">
                    <button className="btn btn-outline" onClick={onClose}>取消</button>
                    <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
                        {uploading ? '上传中...' : '确认上传'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── 编辑弹窗组件 ─── */
function EditModal({ doc, standardTypes, engineeringTypes, onClose, onSuccess, onError }) {
    const [form, setForm] = useState({
        document_number: doc.document_number || '',
        standard_type: doc.standard_type || '',
        engineering_type: doc.engineering_type || '',
        publish_date: doc.publish_date?.substring(0, 10) || '',
        effective_date: doc.effective_date?.substring(0, 10) || '',
        abolish_date: doc.abolish_date?.substring(0, 10) || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await documentAPI.update(doc.id, form);
            onSuccess();
        } catch (err) {
            onError(err.response?.data?.error || '更新失败');
        } finally {
            setSaving(false);
        }
    };

    const updateField = (key, val) => setForm({ ...form, [key]: val });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title">编辑文档属性</div>
                <div className="form-group">
                    <label>标准号</label>
                    <input value={form.document_number} onChange={(e) => updateField('document_number', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>标准类型</label>
                    <select value={form.standard_type} onChange={(e) => updateField('standard_type', e.target.value)}>
                        {standardTypes.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>工程类型</label>
                    <select value={form.engineering_type} onChange={(e) => updateField('engineering_type', e.target.value)}>
                        {engineeringTypes.map((et) => <option key={et} value={et}>{et}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>发布日期</label>
                    <input type="date" value={form.publish_date} onChange={(e) => updateField('publish_date', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>实施日期</label>
                    <input type="date" value={form.effective_date} onChange={(e) => updateField('effective_date', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>废止日期</label>
                    <input type="date" value={form.abolish_date} onChange={(e) => updateField('abolish_date', e.target.value)} />
                </div>
                <div className="form-actions">
                    <button className="btn btn-outline" onClick={onClose}>取消</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : '保存修改'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── 系统设置弹窗组件 ─── */
function SettingsModal({ onClose, onSuccess, onError }) {
    const [form, setForm] = useState({
        alibaba_access_key_id: '',
        alibaba_access_key_secret: '',
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLoading(true);
        settingsAPI.getOcr()
            .then(res => {
                setForm({
                    alibaba_access_key_id: res.data.alibaba_access_key_id || '',
                    alibaba_access_key_secret: res.data.alibaba_access_key_secret || '',
                });
            })
            .catch(() => {
                onError('无法加载系统设置');
            })
            .finally(() => setLoading(false));
    }, [onError]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsAPI.updateOcr(form);
            onSuccess();
        } catch (err) {
            onError(err.response?.data?.error || '设置保存失败');
        } finally {
            setSaving(false);
        }
    };

    const updateField = (key, val) => setForm({ ...form, [key]: val });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title">系统设置 (阿里云 OCR 配置)</div>
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>加载中...</div>
                ) : (
                    <>
                        <div className="form-group">
                            <label>Access Key ID</label>
                            <input
                                placeholder="请输入阿里云 Access Key ID"
                                value={form.alibaba_access_key_id}
                                onChange={(e) => updateField('alibaba_access_key_id', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Access Key Secret</label>
                            <input
                                type="password"
                                placeholder="请输入阿里云 Access Key Secret"
                                value={form.alibaba_access_key_secret}
                                onChange={(e) => updateField('alibaba_access_key_secret', e.target.value)}
                            />
                        </div>
                        <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
                            配置后，可在文档列表中手动点击“远程OCR”按钮，调用阿里云高精度 OCR (仅扫描首页) 进行识别纠错。不配置则只使用本地引擎。
                        </p>
                        <div className="form-actions">
                            <button className="btn btn-outline" onClick={onClose}>取消</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? '保存中...' : '保存配置'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
