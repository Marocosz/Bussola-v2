import { BaseModal } from '../BaseModal';

/** Bottom sheet genérico. No desktop renderiza como diálogo centralizado. */
export function Sheet({ open, onClose, title, children, footer, full = false, className = '' }) {
    if (!open) return null;
    return (
        <BaseModal onClose={onClose} sheet={full ? 'full' : 'auto'} className="app-sheet-overlay">
            <div
                className={`modal-content app-sheet ${className}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
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
        </BaseModal>
    );
}