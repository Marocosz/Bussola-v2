import { Sheet } from './Sheet';

/** Lista de ações de um item (tocar na linha → ações). Fecha antes de executar. */
export function ActionSheet({ open, onClose, title, subtitle, icon, actions = [] }) {
    return (
        <Sheet open={open} onClose={onClose} ariaLabel={title} className="action-sheet">
            {(title || icon) && (
                <div className="action-sheet-head">
                    {icon && <span className="action-sheet-icon"><i className={icon}></i></span>}
                    <div className="action-sheet-titles">
                        {title && <strong>{title}</strong>}
                        {subtitle && <span>{subtitle}</span>}
                    </div>
                </div>
            )}
            <div className="action-sheet-list">
                {actions.map((a) => (
                    <button
                        key={a.key}
                        type="button"
                        className={`action-sheet-item ${a.variant ? `is-${a.variant}` : ''}`}
                        onClick={() => { onClose(); a.onClick(); }}
                    >
                        {a.icon && <i className={a.icon}></i>}
                        <span>{a.label}</span>
                    </button>
                ))}
                <button type="button" className="action-sheet-item action-sheet-cancel" onClick={onClose}>
                    <span>Cancelar</span>
                </button>
            </div>
        </Sheet>
    );
}