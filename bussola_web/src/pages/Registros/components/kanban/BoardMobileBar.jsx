import { useEffect, useRef } from 'react';
import { COLUNAS } from './columns';
import { moverFocoRoving } from '../../../../components/mobile/rovingKeys';

/** Celular: chips de status (com contagem) que levam à coluna e o botão de filtros. */
export function BoardMobileBar({ contagens, ativa, onSelect, filtrosAtivos, onFiltro }) {
    const chipsRef = useRef(null);

    // Mantém o chip da coluna visível à vista quando o swipe muda a coluna. Rola só a faixa de chips
    // (na horizontal): scrollIntoView também rolaria a janela, e a página pulava na vertical.
    useEffect(() => {
        const faixa = chipsRef.current;
        const chip = faixa?.children[ativa];
        if (!chip) return;
        const ini = chip.getBoundingClientRect().left - faixa.getBoundingClientRect().left + faixa.scrollLeft;
        const fim = ini + chip.getBoundingClientRect().width;
        let left = null;
        if (ini < faixa.scrollLeft) left = ini;
        else if (fim > faixa.scrollLeft + faixa.clientWidth) left = fim - faixa.clientWidth;
        if (left !== null) faixa.scrollTo({ left, behavior: 'smooth' });
    }, [ativa]);

    return (
        <div className="kb-m-bar">
            {/* Abas das colunas: setas/Home/End trocam a coluna (tabindex móvel); cada chip controla a sua coluna. */}
            <div
                className="kb-m-chips" role="tablist" aria-label="Colunas do quadro" ref={chipsRef} data-offscreen-ok
                onKeyDown={(e) => { const i = moverFocoRoving(e, '[role="tab"]', 'horizontal'); if (i !== null) onSelect(i); }}
            >
                {COLUNAS.map((col, i) => (
                    <button
                        key={col.key}
                        type="button"
                        role="tab"
                        aria-selected={ativa === i}
                        aria-controls={`kb-col-${col.key}`}
                        tabIndex={ativa === i ? 0 : -1}
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
