import { Sheet } from '../../../components/mobile/Sheet';

/** Escolha do grupo da nota no celular (lista com o ponto de cor). */
export function GrupoPickerSheet({ open, onClose, grupos, value, onChange }) {
    const opcoes = [{ id: '', nome: 'Sem Grupo', cor: null }, ...grupos];
    return (
        <Sheet open={open} onClose={onClose} title="Grupo" className="reg-sheet">
            <div className="reg-opcoes" role="listbox" aria-label="Grupo da nota">
                {opcoes.map((g) => {
                    const sel = String(value ?? '') === String(g.id);
                    return (
                        <button
                            key={g.id || 'sem-grupo'}
                            type="button"
                            role="option"
                            aria-selected={sel}
                            className={`reg-opcao ${sel ? 'selected' : ''}`}
                            onClick={() => { onChange(g.id); onClose(); }}
                        >
                            <span
                                className="reg-chip-dot"
                                style={{ backgroundColor: g.cor || 'transparent', borderColor: g.cor ? 'transparent' : 'var(--cor-borda)' }}
                            ></span>
                            <span>{g.nome}</span>
                            {sel && <i className="fa-solid fa-check" aria-hidden="true"></i>}
                        </button>
                    );
                })}
            </div>
        </Sheet>
    );
}
