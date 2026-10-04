import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { BoardCard } from './BoardCard';

function BoardColumnBase({ coluna, tarefas, cardVisivel, onCardClick, onQuickAdd, onCardMenu }) {
    const { setNodeRef, isOver } = useDroppable({ id: coluna.key });
    const isMobile = useIsMobile();
    const [adding, setAdding] = useState(false);
    const [titulo, setTitulo] = useState('');

    const confirmar = () => {
        if (titulo.trim()) onQuickAdd(coluna.status, titulo.trim());
        setTitulo('');
        setAdding(false);
    };

    const cancelar = () => { setAdding(false); setTitulo(''); };

    const visiveis = tarefas.filter(cardVisivel);

    // No celular o quick-add fica no topo da coluna; no desktop, depois dos cards.
    const quickAdd = adding && (
        <div className="kb-quickadd">
            <textarea
                className="form-input" autoFocus value={titulo}
                onChange={e => setTitulo(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmar(); }
                    if (e.key === 'Escape') cancelar();
                }}
                placeholder="Título da tarefa..."
                aria-label={isMobile ? `Nova tarefa em ${coluna.label}` : undefined}
                enterKeyHint={isMobile ? 'done' : undefined}
            />
            <div className="kb-quickadd-actions">
                <button className="btn-primary kb-mini" onClick={confirmar} aria-label={isMobile ? 'Adicionar tarefa' : undefined}><i className="fa-solid fa-check"></i></button>
                <button className="btn-secondary kb-mini" onClick={cancelar} aria-label={isMobile ? 'Cancelar' : undefined}><i className="fa-solid fa-xmark"></i></button>
            </div>
        </div>
    );

    return (
        <div
            className="kb-column"
            id={isMobile ? `kb-col-${coluna.key}` : undefined}
            role={isMobile ? 'tabpanel' : undefined}
            aria-label={isMobile ? coluna.label : undefined}
        >
            <div className="kb-column-head">
                <span className="kb-column-accent" style={{ backgroundColor: coluna.accent }}></span>
                <span className="kb-column-label">{coluna.label}</span>
                <span className="kb-column-count">{tarefas.length}</span>
                <button className="kb-column-add" onClick={() => setAdding(true)} title="Nova tarefa"><i className="fa-solid fa-plus"></i></button>
            </div>

            <div ref={setNodeRef} className={`kb-column-body ${isOver ? 'kb-column-body--over' : ''}`}>
                {isMobile && !adding && (
                    <button type="button" className="kb-column-addtop" onClick={() => setAdding(true)}>
                        <i className="fa-solid fa-plus"></i> Nova tarefa
                    </button>
                )}
                {isMobile && quickAdd}

                <SortableContext items={tarefas.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tarefas.map(t => (
                        <BoardCard key={t.id} tarefa={t} onClick={onCardClick} hidden={!cardVisivel(t)} onMenu={onCardMenu} />
                    ))}
                </SortableContext>

                {visiveis.length === 0 && !adding && (
                    <div className="kb-column-empty">{isMobile ? 'Nenhuma tarefa aqui' : 'Solte aqui'}</div>
                )}

                {!isMobile && quickAdd}
            </div>

            {!adding && !isMobile && (
                <button className="kb-column-addfoot" onClick={() => setAdding(true)}>
                    <i className="fa-solid fa-plus"></i> Nova tarefa
                </button>
            )}
        </div>
    );
}

// Colunas cujo array `tarefas` não mudou de referência não re-renderizam
// (num drag cross-coluna, só 2 das 4 mudam).
export const BoardColumn = React.memo(BoardColumnBase);
