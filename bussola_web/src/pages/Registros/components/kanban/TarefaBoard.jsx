import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
    useSensor, useSensors, pointerWithin, rectIntersection,
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

const VAZIO = { a_fazer: [], em_andamento: [], bloqueado: [], concluido: [], cancelado: [] };
const PRIOS = ['Todas', 'Crítica', 'Alta', 'Média', 'Baixa'];

// Detecção por ponteiro primeiro (enxerga colunas VAZIAS, que o closestCorners
// ignora) com fallback por interseção de retângulos.
const detectarColisao = (args) => {
    const porPonteiro = pointerWithin(args);
    return porPonteiro.length > 0 ? porPonteiro : rectIntersection(args);
};

const containerDoId = (id, estado) => {
    if (COL_KEYS.includes(id)) return id;
    return COL_KEYS.find(k => estado[k].some(t => t.id === id));
};

// Leva o card `activeId` para a coluna de `overId` (na posição do card sob o ponteiro ou no fim).
// Devolve o mesmo estado se já estiver na mesma coluna.
function moverEntreColunas(estado, activeId, overId) {
    const from = containerDoId(activeId, estado);
    const to = containerDoId(overId, estado);
    if (!from || !to || from === to) return estado;

    const item = estado[from].find(t => t.id === activeId);
    if (!item) return estado;

    const destino = [...estado[to]];
    const overIndex = destino.findIndex(t => t.id === overId);
    destino.splice(overIndex >= 0 ? overIndex : destino.length, 0, { ...item, status: keyToStatus(to) });
    return { ...estado, [from]: estado[from].filter(t => t.id !== activeId), [to]: destino };
}

// Estado final do soltar: troca de coluna (caso o último onDragOver ainda não tenha sido aplicado)
// e reordenação dentro da coluna de destino.
function soltarCard(estado, activeId, overId) {
    const movido = moverEntreColunas(estado, activeId, overId);
    const to = containerDoId(activeId, movido);
    if (!to) return null;
    const lista = movido[to];
    const oldIndex = lista.findIndex(t => t.id === activeId);
    const newIndex = lista.findIndex(t => t.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return movido;
    return { ...movido, [to]: arrayMove(lista, oldIndex, newIndex) };
}

const mesmaColuna = (a, b) => a.length === b.length && a.every((t, i) => t.id === b[i].id && t.status === b[i].status);

export function TarefaBoard({ novaRef }) {
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
                bloqueado: data.bloqueado, concluido: data.concluido, cancelado: data.cancelado,
            });
        } catch (e) {
            logger.error('Erro ao carregar board', { error: String(e) });
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar tarefas.' });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { carregar(); }, [carregar]);

    // Estado do quadro antes do arraste: volta para ele se o arraste for cancelado ou a API falhar.
    const antesDoArrasteRef = useRef(null);

    const onDragStart = ({ active }) => {
        antesDoArrasteRef.current = colunas;
        const k = containerDoId(active.id, colunas);
        const t = k && colunas[k].find(x => x.id === active.id);
        setActiveTarefa(t || null);
    };

    const onDragOver = ({ active, over }) => {
        if (!over) return;
        setColunas(prev => moverEntreColunas(prev, active.id, over.id));
    };

    // Otimista: aplica `novo` já e grava a coluna `to` (ordem + status). Se a API falhar, volta para `anterior`.
    const salvarColuna = useCallback(async (anterior, novo, to) => {
        setColunas(novo);
        try {
            await reordenarTarefas(keyToStatus(to), novo[to].map(t => t.id));
            return true;
        } catch (e) {
            logger.error('Erro ao reordenar', { error: String(e) });
            setColunas(anterior);
            addToast({ type: 'error', title: 'Erro', description: 'Não consegui salvar a mudança.' });
            return false;
        }
    }, [addToast]);

    // O novo estado é calculado aqui, a partir do `colunas` atual, e não dentro de um updater do
    // setColunas: updaters rodam depois, então os ids lidos logo em seguida ainda seriam nulos
    // e o PATCH /tarefas/reordenar nunca era enviado (o arraste não era salvo).
    const onDragEnd = ({ active, over }) => {
        setActiveTarefa(null);
        const anterior = antesDoArrasteRef.current || colunas;
        antesDoArrasteRef.current = null;
        if (!over) { setColunas(anterior); return; }

        const novo = soltarCard(colunas, active.id, over.id);
        const to = novo && containerDoId(active.id, novo);
        if (!to) { setColunas(anterior); return; }
        if (mesmaColuna(anterior[to], novo[to])) { setColunas(novo); return; } // soltou onde estava

        salvarColuna(anterior, novo, to);
    };

    const onDragCancel = () => {
        setActiveTarefa(null);
        if (antesDoArrasteRef.current) setColunas(antesDoArrasteRef.current);
        antesDoArrasteRef.current = null;
    };

    const quickAdd = useCallback(async (statusDestino, titulo) => {
        try {
            await createTarefa({ titulo, status: statusDestino });
            carregar();
        } catch (e) {
            logger.error('Erro no quick-add', { error: String(e) });
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao criar tarefa.' });
        }
    }, [carregar, addToast]);

    const abrirNova = useCallback(() => { setPanelTarefa(null); setPanelAberto(true); }, []);
    const abrirCard = useCallback((t) => { setPanelTarefa(t); setPanelAberto(true); }, []);

    // Expõe "abrir nova tarefa" pro botão que vive no cabeçalho da página.
    useEffect(() => {
        if (novaRef) novaRef.current = abrirNova;
        return () => { if (novaRef) novaRef.current = null; };
    }, [novaRef, abrirNova]);

    // Estável durante o arraste (só muda quando busca/filtro mudam), pra não
    // invalidar o memo dos cards a cada frame.
    const cardVisivel = useCallback((t) => {
        if (filtroPrio !== 'Todas' && t.prioridade !== filtroPrio) return false;
        if (busca) {
            const term = busca.toLowerCase();
            const emTitulo = t.titulo?.toLowerCase().includes(term);
            const emDesc = t.descricao?.toLowerCase().includes(term);
            if (!emTitulo && !emDesc) return false;
        }
        return true;
    }, [busca, filtroPrio]);

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
            </div>

            {loading ? (
                <div className="kb-loading"><i className="fa-solid fa-circle-notch fa-spin"></i> Carregando board...</div>
            ) : (
                <DndContext
                    sensors={sensors} collisionDetection={detectarColisao}
                    onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}
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
