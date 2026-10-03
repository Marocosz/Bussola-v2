import { useState } from 'react';
import { ActionSheet } from '../../../../components/mobile/ActionSheet';
import { Sheet } from '../../../../components/mobile/Sheet';
import { COLUNAS, statusToKey } from './columns';

/** Celular: ações do card (Abrir / Mover para… / Excluir) e o sheet com as colunas de destino. */
export function BoardCardActions({ tarefa, onClose, onAbrir, onMover, onExcluir }) {
    const [movendo, setMovendo] = useState(null);
    const colAtual = tarefa ? COLUNAS.find((c) => c.key === statusToKey(tarefa.status)) : null;

    return (
        <>
            <ActionSheet
                open={!!tarefa}
                onClose={onClose}
                title={tarefa?.titulo}
                subtitle={colAtual?.label}
                icon="fa-solid fa-list-check"
                actions={tarefa ? [
                    { key: 'abrir', icon: 'fa-solid fa-pen-to-square', label: 'Abrir', onClick: () => onAbrir(tarefa) },
                    { key: 'mover', icon: 'fa-solid fa-arrow-right', label: 'Mover para…', onClick: () => setMovendo(tarefa) },
                    { key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: () => onExcluir(tarefa) },
                ] : []}
            />
            <Sheet open={!!movendo} onClose={() => setMovendo(null)} title="Mover para" className="reg-sheet">
                <div className="reg-opcoes">
                    {movendo && COLUNAS.filter((c) => c.status !== movendo.status).map((c) => (
                        <button
                            key={c.key}
                            type="button"
                            className="reg-opcao"
                            onClick={() => { const t = movendo; setMovendo(null); onMover(t, c.status); }}
                        >
                            <span className="reg-chip-dot" style={{ backgroundColor: c.accent }}></span>
                            <span>{c.label}</span>
                        </button>
                    ))}
                </div>
            </Sheet>
        </>
    );
}
