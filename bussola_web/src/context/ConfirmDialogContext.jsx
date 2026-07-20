import React, { createContext, useContext, useState, useRef } from 'react';

const ConfirmDialogContext = createContext();

export function ConfirmDialogProvider({ children }) {
    const [dialogState, setDialogState] = useState({
        isOpen: false,
        title: '',
        description: '',
        confirmLabel: 'Confirmar',
        cancelLabel: 'Cancelar',
        variant: 'danger', // 'danger' | 'info'
        options: null      // [{ label, value, variant }] — seletor multi-opção
    });

    const awaitingPromiseRef = useRef(null);

    const openDialog = (opts) => {
        setDialogState({
            isOpen: true,
            title: opts.title || 'Tem certeza?',
            description: opts.description || '',
            confirmLabel: opts.confirmLabel || 'Confirmar',
            cancelLabel: opts.cancelLabel || 'Cancelar',
            variant: opts.variant || 'danger',
            // Quando `options` é passado, renderiza N botões que resolvem o
            // `value` escolhido (cancelar → null). Sem `options` → true/false.
            options: Array.isArray(opts.options) ? opts.options : null
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

                        <div className={`confirm-footer ${dialogState.options ? 'confirm-footer-options' : ''}`}>
                            <button
                                className="btn-cancel"
                                onClick={() => handleClose(dialogState.options ? null : false)}
                            >
                                {dialogState.cancelLabel}
                            </button>
                            {dialogState.options ? (
                                dialogState.options.map((opt, i) => (
                                    <button
                                        key={opt.value}
                                        className={`btn-confirm ${opt.variant || 'info'}`}
                                        onClick={() => handleClose(opt.value)}
                                        autoFocus={i === 0}
                                    >
                                        {opt.label}
                                    </button>
                                ))
                            ) : (
                                <button
                                    className={`btn-confirm ${dialogState.variant}`}
                                    onClick={() => handleClose(true)}
                                    autoFocus
                                >
                                    {dialogState.confirmLabel}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </ConfirmDialogContext.Provider>
    );
}

export const useConfirm = () => useContext(ConfirmDialogContext);