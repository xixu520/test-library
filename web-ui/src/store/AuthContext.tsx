import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { mapRoleToPermissions } from '../utils/permissions';

interface AuthContextType {
    user: User | null;
    token: string | null;
    permissions: string[];
    darkMode: boolean;
    toggleDarkMode: () => void;
    login: (token: string, user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [darkMode, setDarkMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('darkMode');
        return saved === 'true';
    });

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser) as User;
                setToken(storedToken);
                setUser(parsedUser);
                setPermissions(parsedUser.permissions || mapRoleToPermissions(parsedUser.role));
            } catch (error) {
                console.error('Failed to parse user from local storage:', error);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
    }, []);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('darkMode', String(darkMode));
    }, [darkMode]);

    const toggleDarkMode = () => setDarkMode(!darkMode);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        setPermissions(newUser.permissions || mapRoleToPermissions(newUser.role));
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        setPermissions([]);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, token, permissions, darkMode, toggleDarkMode, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthStore = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthStore must be used within an AuthProvider');
    }
    return context;
};
