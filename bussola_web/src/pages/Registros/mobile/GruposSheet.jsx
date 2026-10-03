import { Sheet } from '../../../components/mobile/Sheet';

/** Gestão de grupos no celular: editar/excluir sempre visíveis (44px) e "Novo grupo" no rodapé. */
export function GruposSheet({ open, onClose, grupos, onNew, onEdit, onDelete }) {
    return (
        <Sheet
            open={open}
            onClose={onClose}
            title="Grupos"
            className="reg-sheet"
            footer={(
                <button type="button" className="btn-primary" onClick={onNew}>
                    <i className="fa-solid fa-plus"></i> Novo grupo
                </button>
            )}
        >
            {grupos.length === 0 ? (
                <p className="reg-sheet-empty">Nenhum grupo ainda.</p>
            ) : (
                <ul className="reg-grupo-list">
                    {grupos.map((g) => (
                        <li key={g.id} className="reg-grupo-row">
                            <span className="reg-chip-dot" style={{ backgroundColor: g.cor }}></span>
                            <span className="reg-grupo-nome">{g.nome}</span>
                            <button type="button" className="reg-icon-btn" aria-label={`Editar ${g.nome}`} onClick={(e) => onEdit(g, e)}>
                                <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button type="button" className="reg-icon-btn is-danger" aria-label={`Excluir ${g.nome}`} onClick={(e) => onDelete(g.id, e)}>
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Sheet>
    );
}
