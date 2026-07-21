import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { createTarefa, updateTarefa, deleteTarefa } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import { useConfirm } from '../../../../context/ConfirmDialogContext';
import { DatePicker } from '../../../../components/Pickers';
import { SubtaskTree } from './SubtaskTree';
import { COLUNAS, PRIO_COLORS } from './columns';

const PRIOS = ['Baixa', 'Média', 'Alta', 'Crítica'];

export function TarefaDetailPanel({ aberto, tarefa, onClose, onSaved }) {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const editando = !!tarefa;

    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [prioridade, setPrioridade] = useState('Média');
    const [status, setStatus] = useState('Pendente');
    const [prazo, setPrazo] = useState('');
    const [subtarefas, setSubtarefas] = useState([]);
    const [salvando, setSalvando] = useState(false);

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

    return (
        <AnimatePresence>
            {aberto && (
                <>
                    <Motion.div
                        className="kb-panel-backdrop"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <Motion.aside
                        className="kb-panel registros-scope"
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.22 }}
                    >
                        <div className="kb-panel-head">
                            <h2>{editando ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
                            <button className="close-btn" onClick={onClose}>&times;</button>
                        </div>

                        <div className="kb-panel-body">
                            <div className="form-group">
                                <label>O que precisa ser feito?</label>
                                <input className="form-input" value={titulo} autoFocus
                                    onChange={e => setTitulo(e.target.value)} placeholder="Título..." />
                            </div>

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

                        <div className="kb-panel-foot">
                            {editando
                                ? <button className="btn-secondary danger" onClick={excluir}><i className="fa-solid fa-trash-can"></i> Excluir</button>
                                : <span />}
                            <div className="kb-panel-foot-right">
                                <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                                <button className="btn-primary" onClick={salvar} disabled={salvando}>
                                    {salvando ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}
                                </button>
                            </div>
                        </div>
                    </Motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
