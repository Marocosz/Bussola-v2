import React, { useState, useEffect } from 'react';
import { createTarefa, updateTarefa, deleteTarefa } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import { useConfirm } from '../../../../context/ConfirmDialogContext';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { BaseModal } from '../../../../components/BaseModal';
import { ActionSheet } from '../../../../components/mobile/ActionSheet';
import { DatePicker } from '../../../../components/Pickers';
import { moverFocoRoving, tabIndexRoving } from '../../../../components/mobile/rovingKeys';
import { SubtaskTree } from './SubtaskTree';
import { COLUNAS, PRIO_COLORS } from './columns';

const PRIOS = ['Baixa', 'Média', 'Alta', 'Crítica'];

export function TarefaDetailPanel({ aberto, tarefa, onClose, onSaved }) {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const isMobile = useIsMobile();
    const editando = !!tarefa;

    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [prioridade, setPrioridade] = useState('Média');
    const [status, setStatus] = useState('Pendente');
    const [prazo, setPrazo] = useState('');
    const [subtarefas, setSubtarefas] = useState([]);
    const [salvando, setSalvando] = useState(false);
    const [menuAberto, setMenuAberto] = useState(false);

    // Chave "prev" pra resetar o form no render (evita setState em effect).
    const [prevId, setPrevId] = useState(null);
    const alvoId = tarefa ? tarefa.id : '__novo__';
    if (aberto && alvoId !== prevId) {
        setPrevId(alvoId);
        setTitulo(tarefa?.titulo || '');
        setDescricao(tarefa?.descricao || '');
        setPrioridade(tarefa?.prioridade || 'Média');
        setStatus(tarefa?.status || 'Pendente');
        setPrazo(tarefa?.prazo ? tarefa.prazo.split('T')[0] : '');
        setSubtarefas(tarefa?.subtarefas ? JSON.parse(JSON.stringify(tarefa.subtarefas)) : []);
        setMenuAberto(false);
    }
    useEffect(() => { if (!aberto) setPrevId(null); }, [aberto]);

    const salvar = async () => {
        if (!titulo.trim()) { addToast({ type: 'error', title: 'Ops', description: 'Dê um título à tarefa.' }); return; }
        setSalvando(true);
        try {
            const payload = { titulo, descricao, prioridade, status, prazo: prazo || null, subtarefas };
            if (editando) {
                await updateTarefa(tarefa.id, payload);
            } else {
                await createTarefa(payload);
            }
            addToast({ type: 'success', title: 'Salvo', description: 'Tarefa salva.' });
            onSaved();
            onClose();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar.' });
        } finally {
            setSalvando(false);
        }
    };

    const excluir = async () => {
        const ok = await confirm({ title: 'Excluir tarefa?', description: 'Isso remove a tarefa e todas as sub-etapas.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try {
            await deleteTarefa(tarefa.id);
            addToast({ type: 'success', title: 'Excluída', description: 'Tarefa removida.' });
            onSaved();
            onClose();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao excluir.' });
        }
    };

    if (!aberto) return null;

    return (
        <>
        <BaseModal onClose={onClose} className="registros-scope" sheet="full">
            <div
                className="modal-content large-modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '620px', maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}
            >
                <div className="modal-header">
                    <h2>{editando ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
                    {isMobile ? (
                        <div className="tarefa-m-head-acoes">
                            {editando && (
                                <button type="button" className="reg-icon-btn" aria-label="Mais ações" onClick={() => setMenuAberto(true)}>
                                    <i className="fa-solid fa-ellipsis"></i>
                                </button>
                            )}
                            <button type="button" className="reg-icon-btn" aria-label="Fechar" onClick={onClose}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    ) : (
                        <span className="close-btn" onClick={onClose}>&times;</span>
                    )}
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>O que precisa ser feito?</label>
                        {/* Sem foco automático no celular: o teclado não abre sobre o painel. */}
                        <input className="form-input" value={titulo} autoFocus={!isMobile}
                            onChange={e => setTitulo(e.target.value)} placeholder="Título..." />
                    </div>

                    {isMobile ? (
                        <>
                            <div className="form-group">
                                <span className="reg-campo-label" id="tarefa-status-label">Status</span>
                                <div
                                    className="reg-chip-grid" role="radiogroup" aria-labelledby="tarefa-status-label"
                                    onKeyDown={(e) => { const i = moverFocoRoving(e, '[role="radio"]'); if (i !== null) setStatus(COLUNAS[i].status); }}
                                >
                                    {COLUNAS.map((c, i) => (
                                        <button
                                            key={c.key}
                                            type="button"
                                            role="radio"
                                            aria-checked={status === c.status}
                                            tabIndex={tabIndexRoving(i, COLUNAS.findIndex(x => x.status === status))}
                                            className={`reg-chip ${status === c.status ? 'active' : ''}`}
                                            onClick={() => setStatus(c.status)}
                                        >
                                            <span className="reg-chip-dot" style={{ backgroundColor: c.accent }}></span>
                                            <span>{c.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <span className="reg-campo-label" id="tarefa-prio-label">Prioridade</span>
                                <div
                                    className="reg-chip-grid" role="radiogroup" aria-labelledby="tarefa-prio-label"
                                    onKeyDown={(e) => { const i = moverFocoRoving(e, '[role="radio"]'); if (i !== null) setPrioridade(PRIOS[i]); }}
                                >
                                    {PRIOS.map((p, i) => (
                                        <button
                                            key={p}
                                            type="button"
                                            role="radio"
                                            aria-checked={prioridade === p}
                                            tabIndex={tabIndexRoving(i, PRIOS.indexOf(prioridade))}
                                            className={`reg-chip ${prioridade === p ? 'active' : ''}`}
                                            onClick={() => setPrioridade(p)}
                                        >
                                            <span className="reg-chip-dot" style={{ backgroundColor: PRIO_COLORS[p] }}></span>
                                            <span>{p}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Status</label>
                                <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
                                    {COLUNAS.map(c => <option key={c.key} value={c.status}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Prioridade</label>
                                <select className="form-input" value={prioridade} onChange={e => setPrioridade(e.target.value)}
                                    style={{ borderLeft: `4px solid ${PRIO_COLORS[prioridade]}` }}>
                                    {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <DatePicker label="Prazo (opcional)" value={prazo} onChange={e => setPrazo(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Detalhes</label>
                        <textarea className="form-input" style={{ height: '70px' }} value={descricao}
                            onChange={e => setDescricao(e.target.value)} placeholder="Informações adicionais..." />
                    </div>

                    <div className="form-group">
                        <label><i className="fa-solid fa-list-check"></i> Subtarefas</label>
                        <SubtaskTree subtarefas={subtarefas} onChange={setSubtarefas} />
                    </div>
                </div>

                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                    {isMobile ? (
                        <>
                            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                            <button className="btn-primary" onClick={salvar} disabled={salvando}>
                                {salvando ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}
                            </button>
                        </>
                    ) : (
                        <>
                            {editando
                                ? <button className="btn-secondary" onClick={excluir} style={{ color: 'var(--cor-vermelho-delete)' }}><i className="fa-solid fa-trash-can"></i> Excluir</button>
                                : <span />}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                                <button className="btn-primary" onClick={salvar} disabled={salvando}>
                                    {salvando ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </BaseModal>
        {isMobile && editando && (
            <ActionSheet
                open={menuAberto}
                onClose={() => setMenuAberto(false)}
                title={tarefa.titulo}
                icon="fa-solid fa-list-check"
                actions={[{ key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir tarefa', variant: 'danger', onClick: excluir }]}
            />
        )}
        </>
    );
}
