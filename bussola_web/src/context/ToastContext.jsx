import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback(({ type, title, description, duration = 4000 }) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newToast = { id, type, title, description };

        setToasts((prev) => [...prev, newToast]);

        // Auto remove após a duração definida
        setTimeout(() => {
            removeToast(id);
        }, duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            
            {/* Container Global de Toasts */}
            <div className="toast-container">
                {toasts.map((toast) => (
                    <div 
                        key={toast.id} 
                        className={`toast-notification toast-${toast.type}`}
                        onClick={() => removeToast(toast.id)}
                    >
                        <div className="toast-icon">
                            {toast.type === 'success' && <i className="fa-solid fa-circle-check"></i>}
                            {toast.type === 'error' && <i className="fa-solid fa-circle-xmark"></i>}
                            {toast.type === 'info' && <i className="fa-solid fa-circle-info"></i>}
                            {toast.type === 'warning' && <i className="fa-solid fa-triangle-exclamation"></i>}
                        </div>
                        <div className="toast-content">
                            <strong>{toast.title}</strong>
                            {toast.description && <p>{toast.description}</p>}
                        </div>
                        <button className="toast-close" type="button">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                        
                        {/* Barra de progresso visual do tempo */}
                        <div className="toast-progress" style={{animationDuration: '4s'}}></div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}