import React, { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PRIO_COLORS } from './columns';

function contarSubtarefas(subs) {
    let total = 0, feitas = 0;
    const walk = (items) => {
        if (!items) return;
        for (const it of items) {
            total += 1;
            if (it.concluido) feitas += 1;
            if (it.subtarefas?.length) walk(it.subtarefas);
        }
    };
    walk(subs);
    return { total, feitas, pct: total ? Math.round((feitas / total) * 100) : 0 };
}

function formatarPrazo(prazo) {
    if (!prazo) return null;
    return new Date(prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// `overlay` = render sem sortable (usado no DragOverlay).
// Desliga a animação de layout: em coluna grande (~86 cards) animar o transform
// de todos os itens por frame é o que trava o arraste.
const semAnimacao = () => false;

function BoardCardBase({ tarefa, onClick, hidden = false, overlay = false }) {
    const sortable = useSortable({ id: tarefa.id, disabled: overlay, animateLayoutChanges: semAnimacao });
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

    // Cálculos pesados memoizados: durante o arraste o dnd-kit re-renderiza cada
    // item por frame; sem isso, a árvore de subtarefas seria percorrida 86x/frame.
    const prog = useMemo(() => contarSubtarefas(tarefa.subtarefas), [tarefa.subtarefas]);
    const prazo = useMemo(() => formatarPrazo(tarefa.prazo), [tarefa.prazo]);
    const atrasado = useMemo(
        () => tarefa.prazo && new Date(tarefa.prazo) < new Date() && tarefa.status !== 'Concluído',
        [tarefa.prazo, tarefa.status],
    );
    const prioColor = PRIO_COLORS[tarefa.prioridade] || PRIO_COLORS['Média'];

    const style = overlay ? undefined : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div
            ref={overlay ? undefined : setNodeRef}
            style={style}
            className={`kb-card ${overlay ? 'kb-card--overlay' : ''} ${hidden ? 'kb-card--hidden' : ''}`}
            onClick={() => { if (!isDragging) onClick(tarefa); }}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
        >
            <span className="kb-card-prio" style={{ backgroundColor: prioColor }}></span>
            <div className="kb-card-body">
                <div className="kb-card-top">
                    <h4 className="kb-card-title">{tarefa.titulo}</h4>
                    {tarefa.fixado && <i className="fa-solid fa-thumbtack kb-card-pin"></i>}
                </div>
                <div className="kb-card-meta">
                    {prazo && (
                        <span className={`kb-chip ${atrasado ? 'kb-chip--late' : ''}`}>
                            <i className="fa-regular fa-calendar"></i> {prazo}
                        </span>
                    )}
                    {prog.total > 0 && (
                        <span className="kb-chip kb-chip--prog" title={`${prog.feitas}/${prog.total} etapas`}>
                            <i className="fa-solid fa-list-check"></i> {prog.feitas}/{prog.total}
                        </span>
                    )}
                </div>
                {prog.total > 0 && (
                    <div className="kb-card-progress">
                        <div className="kb-card-progress-fill" style={{ width: `${prog.pct}%` }}></div>
                    </div>
                )}
            </div>
        </div>
    );
}

// React.memo evita re-render vindo do pai (setState de onDragOver / filtros)
// para os cards cujas props não mudaram.
export const BoardCard = React.memo(BoardCardBase);
