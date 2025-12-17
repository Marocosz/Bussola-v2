import React, { createContext, useContext, useState, useRef } from 'react';

const ConfirmDialogContext = createContext();

export function ConfirmDialogProvider({ children }) {
    const [dialogState, setDialogState] = useState({ 
        isOpen: false, 
        title: '', 
        description: '', 
        confirmLabel: 'Confirmar',
        cancelLabel: 'Cancelar',
        variant: 'danger' // 'danger' | 'info'
    });

    const awaitingPromiseRef = useRef(null);

    const openDialog = (options) => {
        setDialogState({
            isOpen: true,
            title: options.title || 'Tem certeza?',
            description: options.description || '',
            confirmLabel: options.confirmLabel || 'Confirmar',
            cancelLabel: options.cancelLabel || 'Cancelar',
            variant: options.variant || 'danger'
        });

        return new Promise((resolve) => {
            awaitingPromiseRef.current = { resolve };
        });
    };

    const handleClose = (value) => {
        setDialogState({ ...dialogState, isOpen: false });
        if (awaitingPromiseRef.current) {
            awaitingPromiseRef.current.resolve(value);
            awaitingPromiseRef.current = null;
        }
    };

    return (
        <ConfirmDialogContext.Provider value={openDialog}>
            {children}
            
            {dialogState.isOpen && (
                <div className="confirm-overlay">
                    <div className="confirm-modal">
                        <div className="confirm-header">
                            <div className={`icon-badge ${dialogState.variant}`}>
                                {dialogState.variant === 'danger' ? (
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                ) : (
                                    <i className="fa-solid fa-circle-info"></i>
                                )}
                            </div>
                            <h3>{dialogState.title}</h3>
                        </div>
                        
                        <div className="confirm-body">
                            <p>{dialogState.description}</p>
                        </div>

                        <div className="confirm-footer">
                            <button 
                                className="btn-cancel" 
                                onClick={() => handleClose(false)}
                            >
                                {dialogState.cancelLabel}
                            </button>
                            <button 
                                className={`btn-confirm ${dialogState.variant}`} 
                                onClick={() => handleClose(true)}
                                autoFocus
                            >
                                {dialogState.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmDialogContext.Provider>
    );
}

export const useConfirm = () => useContext(ConfirmDialogContext);