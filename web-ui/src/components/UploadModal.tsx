import { useState } from 'react';
import { documentAPI } from '../services/api';

interface UploadModalProps {
    standardTypes: string[];
    engineeringTypes: string[];
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
}

export default function UploadModal({ standardTypes, engineeringTypes, onClose, onSuccess, onError }: UploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [standardType, setStandardType] = useState(standardTypes[0] || '');
    const [engineeringType, setEngineeringType] = useState(engineeringTypes[0] || '');
    const [uploading, setUploading] = useState(false);

    const handleUpload = async () => {
        if (!file?.name) {
            onError('请选择PDF文件');
            return;
        }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file as Blob);
            formData.append('standard_type', standardType);
            formData.append('engineering_type', engineeringType);
            await documentAPI.upload(formData);
            onSuccess();
        } catch (err: any) {
            onError(err.response?.data?.error || '上传失败');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">上传 PDF 文档</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">选择文件</label>
                        <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-6 hover:border-indigo-400 transition-colors group cursor-pointer">
                            <input
                                type="file"
                                accept=".pdf"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                            />
                            <div className="text-center">
                                <span className="text-3xl mb-2 block">📄</span>
                                <p className="text-sm font-medium text-gray-600 group-hover:text-indigo-600">{file ? file.name : '点击或拖拽上传 PDF'}</p>
                                <p className="text-[10px] text-gray-400 mt-1">仅支持单个 PDF 文件，最大 50MB</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">标准类型</label>
                            <select
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all appearance-none cursor-pointer"
                                value={standardType}
                                onChange={(e) => setStandardType(e.target.value)}
                            >
                                {standardTypes.map((st: string) => <option key={st} value={st}>{st}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">工程类型</label>
                            <select
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all appearance-none cursor-pointer"
                                value={engineeringType}
                                onChange={(e) => setEngineeringType(e.target.value)}
                            >
                                {engineeringTypes.map((et: string) => <option key={et} value={et}>{et}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors" onClick={onClose}>取消</button>
                    <button
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
                        onClick={handleUpload}
                        disabled={uploading || !file}
                    >
                        {uploading ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                上传中...
                            </>
                        ) : '确认上传'}
                    </button>
                </div>
            </div>
        </div>
    );
}
