import { createPortal } from 'react-dom';
import { BaseModal } from '../BaseModal';

/**
 * Bottom sheet genérico. No desktop renderiza como diálogo centralizado.
 * Vai para o body via portal: assim não herda regras de escopo de página
 * (ex.: .ritmo-scope) de onde foi aberto.
 */
export function Sheet({ open, onClose, title, ariaLabel, children, footer, full = false, className = '' }) {
    if (!open) return null;
    return createPortal(
        <BaseModal onClose={onClose} sheet={full ? 'full' : 'auto'} className="app-sheet-overlay">
            <div
                className={`modal-content app-sheet ${className}`}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel || title}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sheet-grab" aria-hidden="true" />
                {title && (
                    <div className="modal-header app-sheet-header">
                        <h3>{title}</h3>
                        <button type="button" className="app-sheet-close" onClick={onClose} aria-label="Fechar">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                )}
                <div className="modal-body app-sheet-body">{children}</div>
                {footer && <div className="modal-footer app-sheet-footer">{footer}</div>}
            </div>
        </BaseModal>,
        document.body,
    );
}
