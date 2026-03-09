import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// 使用 CDN worker 以避免 bundle 问题
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * 安全 PDF 预览组件。
 * 使用 Canvas 渲染 PDF 页面，禁止下载、打印和右键操作。
 */
export default function PDFViewer({ url, title, onClose }) {
    const containerRef = useRef(null);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 禁用右键菜单
        const handleContextMenu = (e) => e.preventDefault();
        document.addEventListener('contextmenu', handleContextMenu);

        // 禁用键盘快捷键 (Ctrl+P, Ctrl+S, Ctrl+Shift+I)
        const handleKeyDown = (e) => {
            if (
                (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'P' || e.key === 'S')) ||
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                e.key === 'F12'
            ) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (!url) return;

        const loadPDF = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');

                const pdf = await pdfjsLib.getDocument({
                    url,
                    httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
                }).promise;

                setPageCount(pdf.numPages);
                const container = containerRef.current;
                if (!container) return;
                container.innerHTML = '';

                // 逐页渲染到 Canvas
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.2 });

                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    canvas.style.userSelect = 'none';
                    canvas.style.pointerEvents = 'none';
                    container.appendChild(canvas);

                    const ctx = canvas.getContext('2d');
                    await page.render({ canvasContext: ctx, viewport }).promise;
                }
            } catch (err) {
                console.error('PDF 加载失败:', err);
            } finally {
                setLoading(false);
            }
        };

        loadPDF();
    }, [url]);

    return (
        <div className="pdf-viewer-overlay" onContextMenu={(e) => e.preventDefault()}>
            <div className="pdf-viewer-toolbar">
                <span className="title">📄 {title || '文档预览'}</span>
                <span style={{ fontSize: 12, color: '#aaa' }}>
                    {loading ? '加载中...' : `共 ${pageCount} 页`}
                </span>
                <button className="btn btn-outline" style={{ color: '#fff', borderColor: '#555' }} onClick={onClose}>
                    ✕ 关闭
                </button>
            </div>
            <div className="pdf-viewer-canvas-container" ref={containerRef}>
                {loading && <p style={{ color: '#aaa', paddingTop: 40 }}>正在加载文档...</p>}
            </div>
        </div>
    );
}
