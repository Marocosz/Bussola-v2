import { useEffect, useRef } from 'react';
import { COLUNAS } from './columns';

/** Celular: chips de status (com contagem) que levam à coluna e o botão de filtros. */
export function BoardMobileBar({ contagens, ativa, onSelect, filtrosAtivos, onFiltro }) {
    const chipsRef = useRef(null);

    // Mantém o chip da coluna visível à vista quando o swipe muda a coluna.
    useEffect(() => {
        chipsRef.current?.children[ativa]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }, [ativa]);

    return (
        <div className="kb-m-bar">
            <div className="kb-m-chips" role="tablist" aria-label="Colunas do quadro" ref={chipsRef} data-offscreen-ok>
                {COLUNAS.map((col, i) => (
                    <button
                        key={col.key}
                        type="button"
                        role="tab"
                        aria-selected={ativa === i}
                        aria-label={`${col.label}, ${contagens[i]} ${contagens[i] === 1 ? 'tarefa' : 'tarefas'}`}
                        className={`kb-m-chip ${ativa === i ? 'active' : ''}`}
                        style={{ '--kb-accent': col.accent }}
                        onClick={() => onSelect(i)}
                    >
                        <span className="kb-m-chip-dot" aria-hidden="true"></span>
                        <span>{col.label}</span>
                        <span className="kb-m-chip-count" aria-hidden="true">{contagens[i]}</span>
                    </button>
                ))}
            </div>
            <button
                type="button"
                className={`kb-m-filtro ${filtrosAtivos ? 'active' : ''}`}
                onClick={onFiltro}
                aria-haspopup="dialog"
                aria-label={filtrosAtivos ? `Filtros (${filtrosAtivos} ativos)` : 'Filtros'}
            >
                <i className="fa-solid fa-sliders"></i>
                {filtrosAtivos > 0 && <span className="kb-m-badge" aria-hidden="true">{filtrosAtivos}</span>}
            </button>
        </div>
    );
}
