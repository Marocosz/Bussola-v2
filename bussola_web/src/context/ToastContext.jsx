import React, { createContext, useContext, useState, useCallback } from 'react';
import '../components/Toast/styles.css';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
    const [messages, setMessages] = useState([]);

    const addToast = useCallback(({ type, title, description }) => {
        const id = Math.random().toString(36).substr(2, 9); // ID único

        const toast = {
            id,
            type, // 'success', 'error', 'info'
            title,
            description,
        };

        setMessages((state) => [...state, toast]);

        // Remove automaticamente após 4 segundos
        setTimeout(() => {
            removeToast(id);
        }, 4000);
    }, []);

    const removeToast = useCallback((id) => {
        // Primeiro adiciona a classe de fade-out (opcional, requer lógica extra de componente)
        // Aqui vamos simplificar removendo do array
        setMessages((state) => state.filter((message) => message.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            
            {/* Renderiza o container de toasts aqui mesmo, globalmente */}
            <div className="toast-container">
                {messages.map((message) => (
                    <div 
                        key={message.id} 
                        className={`toast-message toast-${message.type}`}
                    >
                        {/* Ícones baseados no tipo */}
                        {message.type === 'success' && <i className="fa-solid fa-circle-check" style={{color: 'var(--cor-verde-sucesso)'}}></i>}
                        {message.type === 'error' && <i className="fa-solid fa-circle-exclamation" style={{color: 'var(--cor-vermelho-delete)'}}></i>}
                        {message.type === 'info' && <i className="fa-solid fa-circle-info" style={{color: 'var(--cor-azul-primario)'}}></i>}

                        <div className="toast-content">
                            <strong>{message.title}</strong>
                            {message.description && <p>{message.description}</p>}
                        </div>

                        <button 
                            className="toast-close-btn" 
                            type="button" 
                            onClick={() => removeToast(message.id)}
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}