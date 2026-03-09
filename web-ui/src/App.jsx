import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import './styles/index.css';

/**
 * 应用根组件。
 * 管理全局认证状态，控制登录/主界面切换。
 */
export default function App() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        // 尝试从 localStorage 恢复登录状态
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('token');
        if (savedUser && savedToken) {
            try {
                setUser(JSON.parse(savedUser));
            } catch {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            }
        }
    }, []);

    const handleLogin = (userData) => {
        setUser(userData);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    if (!user) {
        return <LoginPage onLogin={handleLogin} />;
    }

    return <Dashboard user={user} onLogout={handleLogout} />;
}
