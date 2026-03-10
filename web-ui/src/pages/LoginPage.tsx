import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store/AuthContext';

/**
 * 登录页面组件。
 */
export default function LoginPage() {
    const { login } = useAuthStore();
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [registerEnabled, setRegisterEnabled] = useState(true);

    useEffect(() => {
        authAPI.getRegisterStatus()
            .then(res => setRegisterEnabled(res.data.enabled))
            .catch(() => setRegisterEnabled(false)); // 查询失败默认关闭注册
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            setError('请输入用户名和密码');
            return;
        }

        if (isRegister && password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (isRegister) {
                await authAPI.register({ username, password });
            }
            const res = await authAPI.login({ username, password });
            const { token, user } = res.data;
            login(token, user);
        } catch (err: any) {
            if (err.response?.status === 403 && isRegister) {
                setError('注册功能已关闭');
            } else {
                setError(err.response?.data?.error || (isRegister ? '注册失败' : '登录失败'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-4">
            <form className="bg-white rounded-2xl shadow-xl shadow-indigo-100/50 border border-gray-100 p-10 w-full max-w-sm animate-in fade-in zoom-in-95 duration-300" onSubmit={handleSubmit}>
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-indigo-600 mb-2 tracking-tight">📂 文档管理系统</h1>
                    <p className="text-sm text-gray-400 font-medium">
                        {isRegister ? '加入我们，开启高效档案管理' : '欢迎回来，请输入您的凭据'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-[13px] text-center font-medium animate-in shake duration-300">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 ml-1">用户名</label>
                        <input
                            id="login-username"
                            type="text"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="输入您的用户名"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 ml-1">密码</label>
                        <input
                            id="login-password"
                            type="password"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="输入您的密码"
                        />
                    </div>

                    {isRegister && (
                        <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 ml-1">确认密码</label>
                            <input
                                id="login-confirm-password"
                                type="password"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="请再次输入密码"
                            />
                        </div>
                    )}
                </div>

                <button
                    id="login-submit"
                    type="submit"
                    className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-8 flex items-center justify-center gap-2"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            {isRegister ? '注册中...' : '登录中...'}
                        </>
                    ) : (isRegister ? '注 册' : '登 录')}
                </button>

                <div className="mt-8 text-center">
                    {registerEnabled ? (
                        <button
                            type="button"
                            className="text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors"
                            onClick={() => {
                                setIsRegister(!isRegister);
                                setError('');
                            }}
                        >
                            {isRegister ? (
                                <>已有账号？ <span className="text-indigo-600">立即登录</span></>
                            ) : (
                                <>还没有账号？ <span className="text-indigo-600">立即注册</span></>
                            )}
                        </button>
                    ) : (
                        <p className="text-xs font-semibold text-gray-400">
                            暂不开放注册，请联系管理员分配账号
                        </p>
                    )}
                </div>
            </form>
        </div>
    );
}
