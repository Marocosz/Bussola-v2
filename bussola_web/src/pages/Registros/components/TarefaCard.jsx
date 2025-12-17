import React, { useState } from 'react';
import { updateTarefaStatus, deleteTarefa, toggleSubtarefa, addSubtarefa } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext';

// --- COMPONENTE RECURSIVO (Item de Subtarefa) ---
const SubtaskItem = ({ sub, tarefaId, onToggle, onUpdate, level = 0 }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newSubTitle, setNewSubTitle] = useState("");

    const handleAddChild = async () => {
        if (!newSubTitle.trim()) return;
        try {
            await addSubtarefa(tarefaId, newSubTitle, sub.id); 
            onUpdate();
            setNewSubTitle("");
            setIsAdding(false);
        } catch (error) {
            console.error("Erro ao criar sub-etapa", error);
        }
    };

    const paddingLeft = level * 18; 

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div 
                className="subtask-row" 
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 8px', paddingLeft: `${paddingLeft}px` }}
            >
                <i 
                    className={`fa-regular ${sub.concluido ? 'fa-square-check' : 'fa-square'}`}
                    onClick={(e) => { e.stopPropagation(); onToggle(sub.id); }}
                    style={{ 
                        cursor: 'pointer', 
                        color: sub.concluido ? 'var(--cor-verde-sucesso)' : 'var(--cor-texto-secundario)',
                        fontSize: '1rem'
                    }}
                ></i>
                
                <span 
                    className={sub.concluido ? 'riscado' : ''} 
                    style={{ flex: 1, fontSize: '0.9rem', color: 'var(--cor-texto-secundario)', cursor:'default' }}
                >
                    {sub.titulo}
                </span>

                <button 
                    onClick={() => setIsAdding(!isAdding)} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cor-texto-secundario)', opacity: 0.5, transition:'opacity 0.2s' }}
                    title="Adicionar sub-etapa"
                    onMouseEnter={e => e.target.style.opacity = 1}
                    onMouseLeave={e => e.target.style.opacity = 0.5}
                >
                    <i className="fa-solid fa-plus"></i>
                </button>
            </div>

            {isAdding && (
                <div style={{ marginLeft: `${paddingLeft + 24}px`, marginBottom: '8px', display:'flex', gap:'5px', marginTop:'4px' }}>
                    <input 
                        className="form-input" 
                        style={{ height: '30px', fontSize: '0.85rem', padding: '0 8px', borderRadius:'6px' }}
                        value={newSubTitle}
                        onChange={e => setNewSubTitle(e.target.value)}
                        placeholder="Nome da sub-etapa..."
                        onKeyDown={e => e.key === 'Enter' && handleAddChild()}
                        autoFocus
                    />
                    <button 
                        onClick={handleAddChild}
                        style={{ background: 'var(--cor-azul-primario)', color:'white', border:'none', borderRadius:'6px', width:'30px', height:'30px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    >
                        <i className="fa-solid fa-check" style={{fontSize:'0.8rem'}}></i>
                    </button>
                </div>
            )}

            {sub.subtarefas && sub.subtarefas.length > 0 && (
                <div className="subtask-children">
                    {sub.subtarefas.map(child => (
                        <SubtaskItem 
                            key={child.id} 
                            sub={child} 
                            tarefaId={tarefaId}
                            onToggle={onToggle} 
                            onUpdate={onUpdate}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- CARD PRINCIPAL DA TAREFA ---
export function TarefaCard({ tarefa, onUpdate, onEdit }) {
    const { addToast } = useToast();
    const confirm = useConfirm(); 
    const isConcluido = tarefa.status === 'Concluído';

    const handleCheck = async () => {
        const novoStatus = isConcluido ? 'Pendente' : 'Concluído';
        try {
            await updateTarefaStatus(tarefa.id, novoStatus);
            
            // --- ADICIONEI OS TOASTS AQUI ---
            if (novoStatus === 'Concluído') {
                addToast({ type: 'success', title: 'Concluído!', description: 'Tarefa marcada como feita.' });
            } else {
                addToast({ type: 'info', title: 'Reaberta', description: 'Tarefa voltou para pendentes.' });
            }
            // --------------------------------

            onUpdate();
        } catch (error) { 
            console.error(error);
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível atualizar a tarefa.' });
        }
    };

    const handleDelete = async () => {
        const isConfirmed = await confirm({
            title: 'Excluir Tarefa?',
            description: 'Deseja excluir esta tarefa e todas as suas sub-etapas?',
            confirmLabel: 'Excluir',
            variant: 'danger'
        });

        if(!isConfirmed) return;

        try {
            await deleteTarefa(tarefa.id);
            addToast({type:'success', title:'Excluído', description:'Tarefa removida.'});
            onUpdate();
        } catch { addToast({type:'error', title:'Erro', description:'Falha ao excluir.'}); }
    };

    const handleToggleSub = async (subId) => {
        try {
            await toggleSubtarefa(subId);
            onUpdate();
        } catch (error) { console.error(error); }
    };

    const calculateProgress = (subs) => {
        let total = 0;
        let checked = 0;
        const traverse = (items) => {
            if (!items) return;
            items.forEach(item => {
                total++;
                if (item.concluido) checked++;
                if (item.subtarefas && item.subtarefas.length > 0) traverse(item.subtarefas);
            });
        };
        traverse(subs);
        return { total, checked, percent: total > 0 ? Math.round((checked / total) * 100) : 0 };
    };

    const progressData = calculateProgress(tarefa.subtarefas);

    const formatDate = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    };

    const isAtrasado = tarefa.prazo && new Date(tarefa.prazo) < new Date() && !isConcluido;
    const prazoFormatado = formatDate(tarefa.prazo);

    const prioClass = {
        'Crítica': 'critica', 'Alta': 'alta', 'Média': 'media', 'Baixa': 'baixa'
    }[tarefa.prioridade] || 'media';

    return (
        <div className={`tarefa-card ${isConcluido ? 'concluida' : ''} ${isAtrasado ? 'card-atrasado' : ''}`}>
            <div className="tarefa-header">
                <button className={`check-btn ${isConcluido ? 'checked' : ''}`} onClick={handleCheck}>
                    {isConcluido && <i className="fa-solid fa-check"></i>}
                </button>

                <div className="tarefa-content">
                    <h4 className="tarefa-titulo">{tarefa.titulo}</h4>
                    
                    <div className="tarefa-meta">
                        <span className={`badge-prio ${prioClass}`}>{tarefa.prioridade}</span>
                        {prazoFormatado && (
                            <span className={`tarefa-prazo ${isAtrasado ? 'atrasado' : ''}`} title="Prazo">
                                <i className="fa-regular fa-calendar"></i> {prazoFormatado}
                            </span>
                        )}
                    </div>

                    {tarefa.descricao && <p className="tarefa-desc">{tarefa.descricao}</p>}
                </div>

                <div className="tarefa-actions">
                    <button className="btn-action-icon btn-edit" onClick={() => onEdit(tarefa)} title="Editar">
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button className="btn-action-icon btn-delete" onClick={handleDelete} title="Excluir">
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>

            {progressData.total > 0 && (
                <div className="subtarefas-container">
                    <div className="progresso-header">
                        <span className="progresso-title">Progresso</span>
                        <span className="progress-text">{progressData.percent}%</span>
                    </div>
                    
                    <div className="progress-bar-bg">
                        <div 
                            className="progress-bar-fill" 
                            style={{
                                width: `${progressData.percent}%`, 
                                backgroundColor: progressData.percent === 100 ? 'var(--cor-verde-sucesso)' : ''
                            }}
                        ></div>
                    </div>
                    
                    <div className="subtarefas-list">
                        {tarefa.subtarefas && tarefa.subtarefas.map(sub => (
                            <SubtaskItem 
                                key={sub.id} 
                                sub={sub} 
                                tarefaId={tarefa.id}
                                onToggle={handleToggleSub} 
                                onUpdate={onUpdate}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}