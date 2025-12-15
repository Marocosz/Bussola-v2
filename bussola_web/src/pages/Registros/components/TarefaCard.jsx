import React, { useState } from 'react';
import { updateTarefaStatus, deleteTarefa, toggleSubtarefa, addSubtarefa } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

// --- COMPONENTE RECURSIVO (Item de Subtarefa) ---
const SubtaskItem = ({ sub, tarefaId, onToggle, onUpdate, level = 0 }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newSubTitle, setNewSubTitle] = useState("");

    const handleAddChild = async () => {
        if (!newSubTitle.trim()) return;
        try {
            await addSubtarefa(tarefaId, newSubTitle, sub.id); // ID atual é o PAI da nova
            onUpdate();
            setNewSubTitle("");
            setIsAdding(false);
        } catch (error) {
            console.error("Erro ao criar sub-etapa", error);
        }
    };

    // Recuo visual baseado no nível de profundidade
    const paddingLeft = level * 15; 

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {/* Linha da Subtarefa */}
            <div 
                className="subtask-row" 
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '4px 0',
                    paddingLeft: `${paddingLeft}px` 
                }}
            >
                {/* Ícone de Toggle */}
                <i 
                    className={`fa-regular ${sub.concluido ? 'fa-square-check' : 'fa-square'}`}
                    onClick={(e) => { e.stopPropagation(); onToggle(sub.id); }}
                    style={{ 
                        cursor: 'pointer', 
                        color: sub.concluido ? 'var(--cor-verde-sucesso)' : 'var(--cor-texto-secundario)',
                        fontSize: '0.95rem'
                    }}
                ></i>
                
                {/* Texto */}
                <span 
                    className={sub.concluido ? 'riscado' : ''} 
                    style={{ 
                        flex: 1, 
                        fontSize: '0.85rem', 
                        color: 'var(--cor-texto-secundario)', 
                        cursor:'default' 
                    }}
                >
                    {sub.titulo}
                </span>

                {/* Botão Adicionar Filha (+ pequeno) */}
                <button 
                    onClick={() => setIsAdding(!isAdding)} 
                    style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        color: 'var(--cor-texto-secundario)', 
                        fontSize: '0.75rem', 
                        padding:'4px',
                        opacity: 0.6
                    }}
                    title="Adicionar sub-etapa"
                    onMouseEnter={e => e.target.style.opacity = 1}
                    onMouseLeave={e => e.target.style.opacity = 0.6}
                >
                    <i className="fa-solid fa-plus"></i>
                </button>
            </div>

            {/* Input para nova filha (aparece abaixo do pai) */}
            {isAdding && (
                <div style={{ marginLeft: `${paddingLeft + 24}px`, marginBottom: '5px', display:'flex', gap:'5px', marginTop:'2px' }}>
                    <input 
                        className="form-input" 
                        style={{ height: '26px', fontSize: '0.8rem', padding: '0 8px', borderRadius:'4px' }}
                        value={newSubTitle}
                        onChange={e => setNewSubTitle(e.target.value)}
                        placeholder="Nova etapa..."
                        onKeyDown={e => e.key === 'Enter' && handleAddChild()}
                        autoFocus
                    />
                    <button 
                        onClick={handleAddChild}
                        style={{ 
                            background: 'var(--cor-azul-primario)', color:'white', 
                            border:'none', borderRadius:'4px', width:'26px', height:'26px', 
                            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' 
                        }}
                    >
                        <i className="fa-solid fa-check" style={{fontSize:'0.7rem'}}></i>
                    </button>
                </div>
            )}

            {/* Recursividade: Renderiza os filhos deste item */}
            {sub.subtarefas && sub.subtarefas.length > 0 && (
                <div className="subtask-children">
                    {sub.subtarefas.map(child => (
                        <SubtaskItem 
                            key={child.id} 
                            sub={child} 
                            tarefaId={tarefaId}
                            onToggle={onToggle} 
                            onUpdate={onUpdate}
                            level={level + 1} // Aumenta o nível para recuo
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
    const isConcluido = tarefa.status === 'Concluído';

    const handleCheck = async () => {
        const novoStatus = isConcluido ? 'Pendente' : 'Concluído';
        try {
            await updateTarefaStatus(tarefa.id, novoStatus);
            onUpdate();
        } catch (error) { console.error(error); }
    };

    const handleDelete = async () => {
        if(!window.confirm('Excluir tarefa?')) return;
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

    // Calcula progresso percorrendo a árvore recursivamente
    const calculateProgress = (subs) => {
        let total = 0;
        let checked = 0;

        const traverse = (items) => {
            if (!items) return;
            items.forEach(item => {
                total++;
                if (item.concluido) checked++;
                if (item.subtarefas && item.subtarefas.length > 0) {
                    traverse(item.subtarefas);
                }
            });
        };

        traverse(subs);
        return { total, checked, percent: total > 0 ? Math.round((checked / total) * 100) : 0 };
    };

    const progressData = calculateProgress(tarefa.subtarefas);

    // Formatação
    const formatDate = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    };

    const isAtrasado = tarefa.prazo && new Date(tarefa.prazo) < new Date() && !isConcluido;
    const prazoFormatado = formatDate(tarefa.prazo);

    const prioClass = {
        'Crítica': 'critica',
        'Alta': 'alta',
        'Média': 'media',
        'Baixa': 'baixa'
    }[tarefa.prioridade] || 'media';

    return (
        <div className={`tarefa-card ${isConcluido ? 'concluida' : ''}`}>
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
                    <button className="btn-icon-sm" onClick={() => onEdit(tarefa)} title="Editar">
                        <i className="fa-solid fa-pen"></i>
                    </button>
                    <button className="btn-icon-sm delete" onClick={handleDelete} title="Excluir">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>

            {/* Barra de Progresso e Lista */}
            {progressData.total > 0 && (
                <div className="subtarefas-container">
                    <div className="progress-wrapper">
                        <div className="progress-bar-bg">
                            <div 
                                className="progress-bar-fill" 
                                style={{
                                    width: `${progressData.percent}%`, 
                                    backgroundColor: progressData.percent === 100 ? 'var(--cor-verde-sucesso)' : ''
                                }}
                            ></div>
                        </div>
                        <span className="progress-text">{progressData.percent}%</span>
                    </div>
                    
                    {/* Renderiza a lista recursiva */}
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