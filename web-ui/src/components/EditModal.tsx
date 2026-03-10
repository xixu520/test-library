import { useState } from 'react';
import { documentAPI } from '../services/api';
import { Document as StandardDocument } from '../types';

interface EditModalProps {
    doc: StandardDocument;
    standardTypes: string[];
    engineeringTypes: string[];
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
}

export default function EditModal({ doc, onClose, onSuccess, onError }: EditModalProps) {
    const [form, setForm] = useState({
        document_number: doc.document_number || '',
        standard_name: doc.standard_name || '',
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
        } catch (err: any) {
            onError(err.response?.data?.error || '更新失败');
        } finally {
            setSaving(false);
        }
    };

    const updateField = (key: string, val: string) => setForm({ ...form, [key]: val });

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">编辑文档属性</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">标准号</label>
                        <input
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all"
                            value={form.document_number}
                            onChange={(e) => updateField('document_number', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">标准名称</label>
                        <input
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all"
                            value={form.standard_name}
                            onChange={(e) => updateField('standard_name', e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">发布日期</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all"
                                value={form.publish_date}
                                onChange={(e) => updateField('publish_date', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">实施日期</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all"
                                value={form.effective_date}
                                onChange={(e) => updateField('effective_date', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">废止日期</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all"
                            value={form.abolish_date}
                            onChange={(e) => updateField('abolish_date', e.target.value)}
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors" onClick={onClose}>取消</button>
                    <button
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? '正在保存...' : '保存更改'}
                    </button>
                </div>
            </div>
        </div>
    );
}
