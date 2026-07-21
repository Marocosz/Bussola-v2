import React, { useState, useEffect, useCallback } from 'react';
import {
    DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
    useSensor, useSensors, closestCorners,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { getTarefasBoard, reordenarTarefas, createTarefa } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import { logger } from '../../../../utils/logger';
import { COLUNAS, COL_KEYS, keyToStatus } from './columns';
import { BoardColumn } from './BoardColumn';
import { BoardCard } from './BoardCard';
import { TarefaDetailPanel } from './TarefaDetailPanel';
import '../../styles/kanban.css';

const VAZIO = { a_fazer: [], em_andamento: [], concluido: [], cancelado: [] };
const PRIOS = ['Todas', 'Crítica', 'Alta', 'Média', 'Baixa'];

export function TarefaBoard() {
    const { addToast } = useToast();
    const [colunas, setColunas] = useState(VAZIO);
    const [loading, setLoading] = useState(true);
    const [activeTarefa, setActiveTarefa] = useState(null);

    const [busca, setBusca] = useState('');
    const [filtroPrio, setFiltroPrio] = useState('Todas');

    const [panelAberto, setPanelAberto] = useState(false);
    const [panelTarefa, setPanelTarefa] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const carregar = useCallback(async () => {
        try {
            const data = await getTarefasBoard();
            setColunas({
                a_fazer: data.a_fazer, em_andamento: data.em_andamento,
                concluido: data.concluido, cancelado: data.cancelado,
            });
        } catch (e) {
            logger.error('Erro ao carregar board', { error: String(e) });
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar tarefas.' });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { carregar(); }, [carregar]);

    const containerDoId = (id, estado) => {
        if (COL_KEYS.includes(id)) return id;
        return COL_KEYS.find(k => estado[k].some(t => t.id === id));
    };

    const onDragStart = ({ active }) => {
        const k = containerDoId(active.id, colunas);
        const t = k && colunas[k].find(x => x.id === active.id);
        setActiveTarefa(t || null);
    };

    const onDragOver = ({ active, over }) => {
        if (!over) return;
        setColunas(prev => {
            const from = containerDoId(active.id, prev);
            const to = containerDoId(over.id, prev);
            if (!from || !to || from === to) return prev;

            const item = prev[from].find(t => t.id === active.id);
            if (!item) return prev;

            const origem = prev[from].filter(t => t.id !== active.id);
            const destino = [...prev[to]];
            const overIndex = destino.findIndex(t => t.id === over.id);
            const insertAt = overIndex >= 0 ? overIndex : destino.length;
            destino.splice(insertAt, 0, { ...item, status: keyToStatus(to) });

            return { ...prev, [from]: origem, [to]: destino };
        });
    };

    const onDragEnd = ({ active, over }) => {
        setActiveTarefa(null);
        if (!over) return;

        const to = containerDoId(over.id, colunas);
        if (!to) return;

        let idsDestino = null;
        setColunas(prev => {
            const lista = [...prev[to]];
            const oldIndex = lista.findIndex(t => t.id === active.id);
            const newIndex = lista.findIndex(t => t.id === over.id);
            let final = lista;
            if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
                final = arrayMove(lista, oldIndex, newIndex);
            }
            idsDestino = final.map(t => t.id);
            return { ...prev, [to]: final };
        });

        if (idsDestino) {
            reordenarTarefas(keyToStatus(to), idsDestino).catch((e) => {
                logger.error('Erro ao reordenar', { error: String(e) });
                addToast({ type: 'error', title: 'Erro', description: 'Não consegui salvar a mudança.' });
                carregar(); // rollback: recarrega o estado do servidor
            });
        }
    };

    const quickAdd = async (statusDestino, titulo) => {
        try {
            await createTarefa({ titulo, status: statusDestino });
            carregar();
        } catch (e) {
            logger.error('Erro no quick-add', { error: String(e) });
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao criar tarefa.' });
        }
    };

    const abrirNova = () => { setPanelTarefa(null); setPanelAberto(true); };
    const abrirCard = (t) => { setPanelTarefa(t); setPanelAberto(true); };

    const cardVisivel = (t) => {
        if (filtroPrio !== 'Todas' && t.prioridade !== filtroPrio) return false;
        if (busca) {
            const term = busca.toLowerCase();
            const emTitulo = t.titulo?.toLowerCase().includes(term);
            const emDesc = t.descricao?.toLowerCase().includes(term);
            if (!emTitulo && !emDesc) return false;
        }
        return true;
    };

    return (
        <div className="kb-board-scope">
            <div className="kb-toolbar">
                <div className="kb-toolbar-search">
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tarefa..." />
                </div>
                <select className="kb-toolbar-select" value={filtroPrio} onChange={e => setFiltroPrio(e.target.value)}>
                    {PRIOS.map(p => <option key={p} value={p}>{p === 'Todas' ? 'Prioridade' : p}</option>)}
                </select>
                <button className="btn-primary small-btn" onClick={abrirNova}>
                    <i className="fa-solid fa-plus"></i> Nova Tarefa
                </button>
            </div>

            {loading ? (
                <div className="kb-loading"><i className="fa-solid fa-circle-notch fa-spin"></i> Carregando board...</div>
            ) : (
                <DndContext
                    sensors={sensors} collisionDetection={closestCorners}
                    onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
                >
                    <div className="kb-board">
                        {COLUNAS.map(col => (
                            <BoardColumn
                                key={col.key} coluna={col} tarefas={colunas[col.key]}
                                cardVisivel={cardVisivel} onCardClick={abrirCard} onQuickAdd={quickAdd}
                            />
                        ))}
                    </div>
                    <DragOverlay>
                        {activeTarefa ? <BoardCard tarefa={activeTarefa} onClick={() => {}} overlay /> : null}
                    </DragOverlay>
                </DndContext>
            )}

            <TarefaDetailPanel
                aberto={panelAberto} tarefa={panelTarefa}
                onClose={() => setPanelAberto(false)} onSaved={carregar}
            />
        </div>
    );
}
