import { useState } from 'react';
import { authAPI } from '../services/api';

/**
 * 登录页面组件。
 */
export default function LoginPage({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            setError('请输入用户名和密码');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await authAPI.login({ username, password });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            onLogin(res.data.user);
        } catch (err) {
            setError(err.response?.data?.error || '登录失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <form className="login-card" onSubmit={handleSubmit}>
                <h1>📂 PDF 文档管理系统</h1>

                {error && (
                    <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label>用户名</label>
                    <input
                        id="login-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入用户名"
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label>密码</label>
                    <input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入密码"
                    />
                </div>

                <button
                    id="login-submit"
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                    disabled={loading}
                >
                    {loading ? '登录中...' : '登 录'}
                </button>
            </form>
        </div>
    );
}
