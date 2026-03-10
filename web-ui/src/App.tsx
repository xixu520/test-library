import { useState } from 'react';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import SettingsView from './pages/SettingsView';
import { AuthProvider, useAuthStore } from './store/AuthContext';
import './styles/index.css';

/**
 * 应用主内容组件（需在 AuthProvider 内部）
 */
function AppContent() {
    const { user } = useAuthStore();
    const [currentView, setCurrentView] = useState<'dashboard' | 'settings'>('dashboard');

    if (!user) {
        return <LoginPage />;
    }

    if (currentView === 'settings') {
        return <SettingsView onBack={() => setCurrentView('dashboard')} />;
    }

    return (
        <Dashboard
            onNavigateSettings={() => setCurrentView('settings')}
        />
    );
}

/**
 * 应用根组件。
 */
export default function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}
