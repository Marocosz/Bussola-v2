import React, { useEffect } from 'react';

export function BaseModal({ children, onClose, className = '' }) {
    
    // Trava o scroll do body ao abrir
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // Fecha com ESC
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        // A classe 'modal-overlay' é padrão, e 'className' injeta o escopo (ex: 'registros-scope')
        // O clique aqui fecha o modal
        <div className={`modal-overlay ${className}`} onClick={onClose} style={{ display: 'flex' }}>
            {/* O clique aqui dentro NÃO fecha (stopPropagation) */}
            {/* Renderizamos o children diretamente, sem criar uma nova div 'modal-content' wrapper 
                para não quebrar seu layout flex/grid interno. 
                Quem usa o BaseModal é responsável por declarar a div.modal-content. */}
            {React.Children.map(children, child => {
                // Clona o elemento filho direto (que deve ser o modal-content)
                // e adiciona o stopPropagation nele
                if (React.isValidElement(child)) {
                    return React.cloneElement(child, {
                        onClick: (e) => {
                            e.stopPropagation();
                            if (child.props.onClick) child.props.onClick(e);
                        }
                    });
                }
                return child;
            })}
        </div>
    );
}