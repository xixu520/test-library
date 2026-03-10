import React from 'react';
import { ToastType } from '../hooks/useToast';

interface ToastProps {
    msg: string;
    type: ToastType;
}

const Toast: React.FC<ToastProps> = ({ msg, type }) => {
    const bgColor = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-amber-500',
        info: 'bg-blue-600'
    }[type];

    return (
        <div className={`fixed bottom-6 right-6 px-5 py-2.5 rounded shadow-lg text-white text-sm z-[5000] animate-in fade-in slide-in-from-bottom-2 duration-200 ${bgColor}`}>
            {msg}
        </div>
    );
};

export default Toast;
