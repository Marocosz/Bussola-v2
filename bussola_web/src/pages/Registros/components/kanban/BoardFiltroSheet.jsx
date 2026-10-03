import { Sheet } from '../../../../components/mobile/Sheet';
import { PRIO_COLORS } from './columns';

/** Celular: busca e prioridade do quadro num sheet (aplicação imediata; o quadro atualiza por trás). */
export function BoardFiltroSheet({ open, onClose, busca, onBusca, prio, onPrio, prios }) {
    return (
        <Sheet
            open={open}
            onClose={onClose}
            title="Filtrar tarefas"
            className="reg-sheet"
            footer={(
                <>
                    <button type="button" className="btn-secondary" onClick={() => { onBusca(''); onPrio('Todas'); }}>Limpar</button>
                    <button type="button" className="btn-primary" onClick={onClose}>Ver tarefas</button>
                </>
            )}
        >
            <div className="reg-sheet-campos">
                <label className="reg-sheet-label" htmlFor="kb-m-busca">Buscar</label>
                <input
                    id="kb-m-busca"
                    type="search"
                    className="form-input"
                    value={busca}
                    onChange={(e) => onBusca(e.target.value)}
                    placeholder="Título ou detalhes..."
                    enterKeyHint="search"
                />
                <span className="reg-sheet-label">Prioridade</span>
                <div className="reg-chip-grid" role="group" aria-label="Prioridade">
                    {prios.map((p) => (
                        <button
                            key={p}
                            type="button"
                            className={`reg-chip ${prio === p ? 'active' : ''}`}
                            aria-pressed={prio === p}
                            onClick={() => onPrio(p)}
                        >
                            {p !== 'Todas' && <span className="reg-chip-dot" style={{ backgroundColor: PRIO_COLORS[p] }}></span>}
                            <span>{p}</span>
                        </button>
                    ))}
                </div>
            </div>
        </Sheet>
    );
}
