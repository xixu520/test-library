import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './store/AuthContext';

const rootElement = document.getElementById('root');
if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <AuthProvider>
                <App />
            </AuthProvider>
        </React.StrictMode>
    );
}
