import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// 使用 CDN worker 以避免 bundle 问题
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * 安全 PDF 预览组件。
 * 使用 Canvas 渲染 PDF 页面，禁止下载、打印和右键操作。
 */
interface PDFViewerProps {
    url: string;
    title?: string;
    onClose: () => void;
}

export default function PDFViewer({ url, title, onClose }: PDFViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 禁用右键菜单
        const handleContextMenu = (e: MouseEvent) => e.preventDefault();
        document.addEventListener('contextmenu', handleContextMenu);

        // 禁用键盘快捷键 (Ctrl+P, Ctrl+S, Ctrl+Shift+I)
        const handleKeyDown = (e: KeyboardEvent) => {
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

        let isMounted = true;
        let pdfDoc: any = null;

        const loadPDF = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');

                pdfDoc = await pdfjsLib.getDocument({
                    url,
                    httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
                }).promise;

                if (!isMounted) return;

                setPageCount(pdfDoc.numPages);
                const container = containerRef.current;
                if (!container) return;
                container.innerHTML = '';

                // 逐页渲染到 Canvas
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    if (!isMounted) break; // 如果组件已卸载，中途停止渲染

                    const page = await pdfDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 1.2 });

                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    canvas.style.userSelect = 'none';
                    canvas.style.pointerEvents = 'none';

                    if (!isMounted) break;
                    container.appendChild(canvas);

                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        await page.render({ canvasContext: ctx as any, viewport }).promise;
                    }
                }
            } catch (err) {
                if (isMounted) console.error('PDF 加载失败:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadPDF();

        return () => {
            isMounted = false;
            // 清理 PDF 示例，释放内存
            if (pdfDoc) {
                pdfDoc.destroy().catch(console.error);
            }
        };
    }, [url]);

    return (
        <div className="fixed inset-0 bg-gray-900/95 flex flex-col z-[3000] animate-in fade-in duration-300" onContextMenu={(e) => e.preventDefault()}>
            <div className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 flex-shrink-0 shadow-xl">
                <div className="flex items-center gap-3">
                    <span className="text-xl">📄</span>
                    <h3 className="text-sm font-bold text-gray-100">{title || '文档预览'}</h3>
                </div>
                <div className="flex items-center gap-6">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin"></span>
                                加载中
                            </span>
                        ) : `页面共 ${pageCount} 页`}
                    </span>
                    <button
                        className="px-4 py-1.5 border border-gray-700 rounded text-xs font-bold text-gray-300 hover:bg-gray-800 hover:border-gray-500 hover:text-white transition-all uppercase tracking-tighter"
                        onClick={onClose}
                    >
                        ✕ 关闭
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-800/50 p-6 flex flex-col items-center custom-scrollbar">
                {loading && (
                    <div className="flex flex-col items-center justify-center pt-20 animate-pulse">
                        <div className="text-6xl mb-4 opacity-20 text-indigo-400">📂</div>
                        <p className="text-sm font-medium text-gray-500">正在为您加载安全加密文档...</p>
                    </div>
                )}
                <div ref={containerRef} className="flex flex-col items-center gap-8 py-4 selection:bg-transparent shadow-2xl"></div>
            </div>
        </div>
    );
}
