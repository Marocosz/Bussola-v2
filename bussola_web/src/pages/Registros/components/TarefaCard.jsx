import React from 'react';
import { updateTarefaStatus, deleteTarefa, toggleSubtarefa } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function TarefaCard({ tarefa, onUpdate }) {
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
        if(!confirm('Excluir tarefa?')) return;
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

    // Calcula progresso
    const totalSubs = tarefa.subtarefas?.length || 0;
    const subsFeitas = tarefa.subtarefas?.filter(s => s.concluido).length || 0;
    const progresso = totalSubs > 0 ? (subsFeitas / totalSubs) * 100 : 0;

    return (
        <div className={`tarefa-card ${isConcluido ? 'concluida' : ''}`}>
            <div className="tarefa-header">
                <div style={{display:'flex', gap:'10px', alignItems:'flex-start'}}>
                    <button className={`check-btn ${isConcluido ? 'checked' : ''}`} onClick={handleCheck}>
                        {isConcluido && <i className="fa-solid fa-check"></i>}
                    </button>
                    <div>
                        <h4 className="tarefa-titulo">{tarefa.titulo}</h4>
                        {tarefa.descricao && <p className="tarefa-desc">{tarefa.descricao}</p>}
                    </div>
                </div>
                <button className="btn-delete-mini" onClick={handleDelete}>
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>

            {/* Subtarefas */}
            {totalSubs > 0 && (
                <div className="subtarefas-container">
                    <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{width: `${progresso}%`}}></div>
                    </div>
                    <ul className="subtarefas-list">
                        {tarefa.subtarefas.map(sub => (
                            <li key={sub.id} onClick={() => handleToggleSub(sub.id)}>
                                <i className={`fa-regular ${sub.concluido ? 'fa-square-check' : 'fa-square'}`}></i>
                                <span className={sub.concluido ? 'riscado' : ''}>{sub.titulo}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}