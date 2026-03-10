import { useState, useEffect } from 'react';
import { settingsAPI, authAPI } from '../services/api';
import { useAuthStore } from '../store/AuthContext';
import { useAuthorize } from '../hooks/useAuthorize';
import PasswordForm from '../components/PasswordForm';

interface SettingsViewProps {
    onBack: () => void;
}

/**
 * 全新独立设置页面组件
 * 采用左侧导航、右侧内容区的经典后台布局
 * 完全使用 Tailwind CSS 进行重构
 */
export default function SettingsView({ onBack }: SettingsViewProps) {
    const { user } = useAuthStore();
    const { can } = useAuthorize();

    const [activeTab, setActiveTab] = useState('system'); // 'profile' or 'system'

    // 系统设置状态
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [registerEnabled, setRegisterEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

    const showToast = (msg: string, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        if (activeTab === 'system') {
            setLoading(true);
            Promise.all([
                settingsAPI.getBaiduOcrSettings(),
                authAPI.getRegisterStatus()
            ])
                .then(([ocrRes, regRes]) => {
                    setApiKey(ocrRes.data.baidu_api_key || '');
                    setSecretKey(ocrRes.data.baidu_secret_key || '');
                    setRegisterEnabled(regRes.data.enabled);
                })
                .catch(() => showToast('加载最新设置失败', 'error'))
                .finally(() => setLoading(false));
        }
    }, [activeTab]);

    const handleSaveSystem = async () => {
        setLoading(true);
        try {
            await settingsAPI.saveBaiduOcrSettings({
                baidu_api_key: apiKey,
                baidu_secret_key: secretKey
            });
            showToast('设置已成功保存');
        } catch (err: any) {
            showToast(err.response?.data?.error || '保存失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRegister = async (enabled: boolean) => {
        const original = registerEnabled;
        setRegisterEnabled(enabled); // 乐观更新
        try {
            await authAPI.setRegisterStatus(enabled);
            showToast(enabled ? '开放注册已开启' : '开放注册已关闭');
        } catch (err: any) {
            setRegisterEnabled(original); // 回滚
            showToast(err.response?.data?.error || '切换失败', 'error');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* 顶栏用于返回和展示用户信息 */}
            <header className="h-14 bg-white border-b border-gray-200 flex justify-between items-center px-6 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors" onClick={onBack}>
                        ← 返回控制台
                    </button>
                    <h2 className="text-lg font-bold text-gray-800">设置中心</h2>
                </div>
                <div className="text-sm font-medium text-gray-600">
                    👤 {user?.username} ({user?.role})
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* 左侧导航栏 */}
                <aside className="w-60 bg-white border-r border-gray-200 py-6 overflow-y-auto">
                    <ul className="space-y-1">
                        <li
                            className={`px-6 py-3 text-sm cursor-pointer transition-all border-l-4 ${activeTab === 'profile' ? 'bg-indigo-50 text-indigo-600 border-indigo-600 font-semibold' : 'text-gray-600 border-transparent hover:bg-gray-50'}`}
                            onClick={() => setActiveTab('profile')}
                        >
                            个人设置
                        </li>
                        {can('system:config') && (
                            <li
                                className={`px-6 py-3 text-sm cursor-pointer transition-all border-l-4 ${activeTab === 'system' ? 'bg-indigo-50 text-indigo-600 border-indigo-600 font-semibold' : 'text-gray-600 border-transparent hover:bg-gray-50'}`}
                                onClick={() => setActiveTab('system')}
                            >
                                系统高级设置
                            </li>
                        )}
                    </ul>
                </aside>

                {/* 右侧内容区 */}
                <main className="flex-1 p-8 overflow-y-auto bg-gray-50">
                    {activeTab === 'profile' && (
                        <div className="max-w-3xl bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                            <h3 className="text-lg font-bold text-gray-800 mb-6 pb-4 border-b border-gray-100">个人资料设置</h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">用户名</label>
                                    <input className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed" type="text" value={user?.username || ''} disabled />
                                    <p className="text-[10px] text-gray-400 mt-1">用户名在创建后不可修改</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">角色</label>
                                    <input className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed" type="text" value={user?.role === 'admin' ? '系统管理员' : '普通用户'} disabled />
                                </div>
                            </div>

                            <hr className="my-8 border-gray-100" />

                            <h3 className="text-lg font-bold text-gray-800 mb-6 pb-4 border-b border-gray-100">安全设置</h3>
                            <PasswordForm onStatus={showToast} />
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div className="max-w-3xl space-y-6">
                            {/* 注册管理区块 */}
                            {can('register:toggle') && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 pb-4 border-b border-gray-100">用户注册管理</h3>
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-100 transition-colors">
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-gray-900">开放注册</p>
                                            <p className="text-xs text-gray-500">允许外部用户通过登录页自行注册账号</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-bold leading-none ${registerEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                {registerEnabled ? '已开启' : '已关闭'}
                                            </span>
                                            <button
                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${registerEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                                                onClick={() => handleToggleRegister(!registerEnabled)}
                                            >
                                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${registerEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-4 p-3.5 bg-amber-50 rounded-lg border border-amber-100">
                                        <p className="text-[11px] text-amber-700 leading-relaxed">
                                            ⚠ 关闭后新用户将无法自行注册，需由具有 auth:manage 权限的管理人员手动在数据库或后续管理端创建账号。
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* OCR 设置区块 */}
                            {can('system:config') && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 pb-4 border-b border-gray-100">OCR 识别服务 (百度云)</h3>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">API Key (Client ID)</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                placeholder="输入 Baidu API Key"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Secret Key (Client Secret)</label>
                                            <input
                                                type="password"
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                                                value={secretKey}
                                                onChange={(e) => setSecretKey(e.target.value)}
                                                placeholder="输入 Baidu Secret Key"
                                            />
                                        </div>
                                        <div className="p-3.5 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                            <p className="text-[11px] text-indigo-700 leading-relaxed">
                                                💡 建议使用“通用高精度含位置版”。留空则默认回退到本地识别。
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end mt-8">
                                        <button
                                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
                                            onClick={handleSaveSystem}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                    正在保存...
                                                </>
                                            ) : '保存配置'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* ─── Toast ─── */}
            {toast && (
                <div className={`fixed bottom-6 right-6 px-5 py-2.5 rounded shadow-lg text-white text-sm z-[3000] animate-in fade-in slide-in-from-bottom-2 duration-200 ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-green-600'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
