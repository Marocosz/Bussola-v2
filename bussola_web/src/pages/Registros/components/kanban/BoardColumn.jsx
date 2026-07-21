import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BoardCard } from './BoardCard';

export function BoardColumn({ coluna, tarefas, cardVisivel, onCardClick, onQuickAdd }) {
    const { setNodeRef, isOver } = useDroppable({ id: coluna.key });
    const [adding, setAdding] = useState(false);
    const [titulo, setTitulo] = useState('');

    const confirmar = () => {
        if (titulo.trim()) onQuickAdd(coluna.status, titulo.trim());
        setTitulo('');
        setAdding(false);
    };

    const visiveis = tarefas.filter(cardVisivel);

    return (
        <div className="kb-column">
            <div className="kb-column-head">
                <span className="kb-column-accent" style={{ backgroundColor: coluna.accent }}></span>
                <span className="kb-column-label">{coluna.label}</span>
                <span className="kb-column-count">{tarefas.length}</span>
                <button className="kb-column-add" onClick={() => setAdding(true)} title="Nova tarefa"><i className="fa-solid fa-plus"></i></button>
            </div>

            <div ref={setNodeRef} className={`kb-column-body ${isOver ? 'kb-column-body--over' : ''}`}>
                <SortableContext items={tarefas.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tarefas.map(t => (
                        <BoardCard key={t.id} tarefa={t} onClick={onCardClick} hidden={!cardVisivel(t)} />
                    ))}
                </SortableContext>

                {visiveis.length === 0 && !adding && (
                    <div className="kb-column-empty">Solte aqui</div>
                )}

                {adding && (
                    <div className="kb-quickadd">
                        <textarea
                            className="form-input" autoFocus value={titulo}
                            onChange={e => setTitulo(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmar(); }
                                if (e.key === 'Escape') { setAdding(false); setTitulo(''); }
                            }}
                            placeholder="Título da tarefa..."
                        />
                        <div className="kb-quickadd-actions">
                            <button className="btn-primary kb-mini" onClick={confirmar}><i className="fa-solid fa-check"></i></button>
                            <button className="btn-secondary kb-mini" onClick={() => { setAdding(false); setTitulo(''); }}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
                )}
            </div>

            {!adding && (
                <button className="kb-column-addfoot" onClick={() => setAdding(true)}>
                    <i className="fa-solid fa-plus"></i> Nova tarefa
                </button>
            )}
        </div>
    );
}
