import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSheetHistory } from '../hooks/useSheetHistory';
import { useEscape } from '../hooks/useEscape';

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

    // Quem tinha o foco ao abrir: ao fechar o diálogo, o foco volta para lá (senão cai no body).
    const openerRef = useRef(null);
    const estavaAberto = useRef(false);
    useEffect(() => {
        if (estavaAberto.current && !dialogState.isOpen) {
            const opener = openerRef.current;
            openerRef.current = null;
            const textoNoToque = window.matchMedia?.('(pointer: coarse)').matches && opener?.matches?.('input, textarea, select, [contenteditable="true"]');
            if (opener?.isConnected && !textoNoToque) opener.focus({ preventScroll: true });
        }
        estavaAberto.current = dialogState.isOpen;
    }, [dialogState.isOpen]);

    const openDialog = (opts) => {
        if (!estavaAberto.current) openerRef.current = document.activeElement;
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

    // Celular: o diálogo fica no topo da pilha do Voltar — o Voltar cancela só ele (o sheet de
    // baixo continua aberto).
    const isMobile = useIsMobile();
    useSheetHistory(isMobile && dialogState.isOpen, () => handleClose(dialogState.options ? null : false));
    // ESC cancela só o diálogo (ele é a camada de cima; o modal de baixo continua aberto).
    useEscape(dialogState.isOpen, () => handleClose(dialogState.options ? null : false));

    return (
        <ConfirmDialogContext.Provider value={openDialog}>
            {children}
            
            {dialogState.isOpen && (
                <div className="confirm-overlay">
                    <div className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-titulo">
                        <div className="confirm-header">
                            <div className={`icon-badge ${dialogState.variant}`}>
                                {dialogState.variant === 'danger' ? (
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                ) : (
                                    <i className="fa-solid fa-circle-info"></i>
                                )}
                            </div>
                            <h3 id="confirm-titulo">{dialogState.title}</h3>
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