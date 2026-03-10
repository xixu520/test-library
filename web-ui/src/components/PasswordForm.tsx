import { useState } from 'react';
import { authAPI } from '../services/api';

interface PasswordFormProps {
    onStatus: (msg: string, type?: 'success' | 'error') => void;
}

export default function PasswordForm({ onStatus }: PasswordFormProps) {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!oldPassword || !newPassword || !confirmPassword) {
            onStatus('请填写所有必填项', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            onStatus('两次输入的新密码不一致', 'error');
            return;
        }

        setLoading(true);
        try {
            await authAPI.updatePassword({
                old_password: oldPassword,
                new_password: newPassword
            });
            onStatus('密码已成功修改');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            onStatus(err.response?.data?.error || '修改失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="space-y-4" onSubmit={handleUpdate}>
            <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">当前密码</label>
                <input
                    type="password"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all transition-all"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="输入当前使用的密码"
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">新密码</label>
                <input
                    type="password"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all transition-all"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="输入新密码"
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">确认新密码</label>
                <input
                    type="password"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all transition-all"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码"
                />
            </div>
            <div className="flex justify-end pt-2">
                <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                    disabled={loading}
                >
                    {loading ? '正在提交...' : '修改密码'}
                </button>
            </div>
        </form>
    );
}
