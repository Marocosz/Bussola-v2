import { Sheet } from '../../../components/mobile/Sheet';
import { moverFocoRoving, tabIndexRoving } from '../../../components/mobile/rovingKeys';

/**
 * Escolha do grupo da nota no celular (lista com o ponto de cor).
 * Teclado: ↑/↓, Home/End movem o foco entre as opções (tabindex móvel); Enter/Espaço escolhe.
 */
export function GrupoPickerSheet({ open, onClose, grupos, value, onChange }) {
    const opcoes = [{ id: '', nome: 'Sem Grupo', cor: null }, ...grupos];
    const selecionada = opcoes.findIndex((g) => String(value ?? '') === String(g.id));
    return (
        <Sheet open={open} onClose={onClose} title="Grupo" className="reg-sheet">
            <div
                className="reg-opcoes" role="listbox" aria-label="Grupo da nota"
                onKeyDown={(e) => moverFocoRoving(e, '[role="option"]', 'vertical')}
            >
                {opcoes.map((g, i) => {
                    const sel = i === selecionada;
                    return (
                        <button
                            key={g.id || 'sem-grupo'}
                            type="button"
                            role="option"
                            aria-selected={sel}
                            tabIndex={tabIndexRoving(i, selecionada)}
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
