import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor,
    useSensor, useSensors, pointerWithin, rectIntersection,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { getTarefasBoard, reordenarTarefas, createTarefa, deleteTarefa } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import { useConfirm } from '../../../../context/ConfirmDialogContext';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { logger } from '../../../../utils/logger';
import { COLUNAS, COL_KEYS, keyToStatus, statusToKey } from './columns';
import { BoardColumn } from './BoardColumn';
import { BoardCard } from './BoardCard';
import { TarefaDetailPanel } from './TarefaDetailPanel';
import { BoardMobileBar } from './BoardMobileBar';
import { BoardFiltroSheet } from './BoardFiltroSheet';
import { BoardCardActions } from './BoardCardActions';
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
    const confirm = useConfirm();
    const isMobile = useIsMobile();
    const [colunas, setColunas] = useState(VAZIO);
    const [loading, setLoading] = useState(true);
    const [activeTarefa, setActiveTarefa] = useState(null);

    const [busca, setBusca] = useState('');
    const [filtroPrio, setFiltroPrio] = useState('Todas');

    const [panelAberto, setPanelAberto] = useState(false);
    const [panelTarefa, setPanelTarefa] = useState(null);

    // Celular: coluna visível, sheet de filtros e card com o "⋯" aberto.
    const [colAtiva, setColAtiva] = useState(0);
    const [filtroAberto, setFiltroAberto] = useState(false);
    const [menuTarefa, setMenuTarefa] = useState(null);
    const boardRef = useRef(null);

    // Mouse: arrasta depois de 6px. Toque: só com toque longo (250ms parado, até 5px);
    // antes disso o gesto é rolagem/swipe. (O PointerSensor também capturava o toque.)
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
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
    // Caminho único de gravação do board: soltar do arraste e "Mover para…" do celular.
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

    // --- Celular: uma coluna por vez. O chip leva à coluna; o swipe (scroll-snap) atualiza o chip. ---
    const irParaColuna = useCallback((idx) => {
        setColAtiva(idx);
        const el = boardRef.current;
        if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
    }, []);

    const onBoardScroll = useCallback((e) => {
        const el = e.currentTarget;
        if (!el.clientWidth) return;
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        setColAtiva((prev) => (prev === idx ? prev : idx));
    }, []);

    // Altura do quadro no celular: do topo dele até acima da barra inferior; cada coluna rola por dentro.
    useEffect(() => {
        const el = boardRef.current;
        if (!isMobile || !el) return undefined;
        const medir = () => {
            el.style.setProperty('--kb-top', `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
        };
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, [isMobile, loading]);

    // "Mover para…": vai para o fim da coluna de destino (mesmo padrão do soltar numa coluna)
    // e grava pelo mesmo caminho do arraste (salvarColuna → PATCH /tarefas/reordenar).
    const moverPara = useCallback(async (tarefa, statusDestino) => {
        const from = containerDoId(tarefa.id, colunas);
        const to = statusToKey(statusDestino);
        if (!from || from === to) return;
        const item = colunas[from].find((t) => t.id === tarefa.id);
        const novo = {
            ...colunas,
            [from]: colunas[from].filter((t) => t.id !== tarefa.id),
            [to]: [...colunas[to], { ...item, status: statusDestino }],
        };
        if (await salvarColuna(colunas, novo, to)) {
            const destino = COLUNAS.find((c) => c.key === to).label;
            addToast({ type: 'success', title: 'Tarefa movida', description: `Agora em ${destino}.` });
        }
    }, [colunas, salvarColuna, addToast]);

    const excluirTarefa = useCallback(async (tarefa) => {
        const ok = await confirm({ title: 'Excluir tarefa?', description: 'Isso remove a tarefa e todas as sub-etapas.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try {
            await deleteTarefa(tarefa.id);
            addToast({ type: 'success', title: 'Excluída', description: 'Tarefa removida.' });
            carregar();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao excluir.' });
        }
    }, [confirm, addToast, carregar]);

    const contagens = COLUNAS.map((c) => colunas[c.key].filter(cardVisivel).length);
    const filtrosAtivos = (busca ? 1 : 0) + (filtroPrio !== 'Todas' ? 1 : 0);

    return (
        <div className="kb-board-scope">
            {isMobile ? (
                <BoardMobileBar
                    contagens={contagens}
                    ativa={colAtiva}
                    onSelect={irParaColuna}
                    filtrosAtivos={filtrosAtivos}
                    onFiltro={() => setFiltroAberto(true)}
                />
            ) : (
                <div className="kb-toolbar">
                    <div className="kb-toolbar-search">
                        <i className="fa-solid fa-magnifying-glass"></i>
                        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tarefa..." />
                    </div>
                    <select className="kb-toolbar-select" value={filtroPrio} onChange={e => setFiltroPrio(e.target.value)}>
                        {PRIOS.map(p => <option key={p} value={p}>{p === 'Todas' ? 'Prioridade' : p}</option>)}
                    </select>
                </div>
            )}

            {loading ? (
                <div className="kb-loading"><i className="fa-solid fa-circle-notch fa-spin"></i> Carregando board...</div>
            ) : (
                <DndContext
                    sensors={sensors} collisionDetection={detectarColisao}
                    onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}
                >
                    {/* data-offscreen-ok: as colunas fora da tela fazem parte de um carrossel rolável */}
                    <div className="kb-board" ref={boardRef} data-offscreen-ok onScroll={isMobile ? onBoardScroll : undefined}>
                        {COLUNAS.map(col => (
                            <BoardColumn
                                key={col.key} coluna={col} tarefas={colunas[col.key]}
                                cardVisivel={cardVisivel} onCardClick={abrirCard} onQuickAdd={quickAdd}
                                onCardMenu={isMobile ? setMenuTarefa : undefined}
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

            {isMobile && (
                <>
                    <BoardFiltroSheet
                        open={filtroAberto}
                        onClose={() => setFiltroAberto(false)}
                        busca={busca}
                        onBusca={setBusca}
                        prio={filtroPrio}
                        onPrio={setFiltroPrio}
                        prios={PRIOS}
                    />
                    <BoardCardActions
                        tarefa={menuTarefa}
                        onClose={() => setMenuTarefa(null)}
                        onAbrir={abrirCard}
                        onMover={moverPara}
                        onExcluir={excluirTarefa}
                    />
                </>
            )}
        </div>
    );
}
