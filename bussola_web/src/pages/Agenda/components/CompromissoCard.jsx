import React from 'react';
import { toggleCompromissoStatus, deleteCompromisso } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext'; // <--- Import Novo

export function CompromissoCard({ comp, onUpdate, onEdit }) {
    const { addToast } = useToast();
    const confirm = useConfirm(); // <--- Hook Novo

    const handleToggle = async () => {
        await toggleCompromissoStatus(comp.id);
        onUpdate();
    };

    const handleDelete = async () => {
        // --- SUBSTITUIÇÃO DO CONFIRM NATIVO ---
        const isConfirmed = await confirm({
            title: 'Excluir Compromisso?',
            description: 'Você tem certeza que deseja remover este compromisso da sua agenda?',
            confirmLabel: 'Excluir',
            variant: 'danger'
        });

        if(!isConfirmed) return;
        // --------------------------------------

        await deleteCompromisso(comp.id);
        addToast({type:'success', title:'Excluído', description:'Compromisso removido.'});
        onUpdate();
    };

    const dataObj = new Date(comp.data_hora);
    const dia = dataObj.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
    const hora = dataObj.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    
    // Dia da semana completo e Capitalizado
    const diaSemanaRaw = dataObj.toLocaleDateString('pt-BR', {weekday:'long'});
    const diaSemana = diaSemanaRaw.charAt(0).toUpperCase() + diaSemanaRaw.slice(1);

    // Classes de Status
    let statusClass = 'pendente';
    if(comp.status === 'Realizado') statusClass = 'realizado';
    if(comp.status === 'Perdido') statusClass = 'perdido';

    const isRealizado = comp.status === 'Realizado';

    return (
        <div className={`compromisso-card-modern ${statusClass}`}>
            
            {/* 1. TOPO: Data, Hora, Dia da Semana e Botões */}
            <div className="card-header-row">
                <div className="date-highlight">
                    <span className="date-big">{dia}</span>
                    <span className="time-group">
                        <span className="time-big">{hora}</span>
                        <span className="weekday-inline">• {diaSemana}</span>
                    </span>
                </div>
                
                <div className="top-actions">
                    {/* Botões atualizados: Ícones novos e classes para hover específico */}
                    <button className="btn-action-icon btn-edit-transacao" onClick={() => onEdit(comp)} title="Editar">
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button className="btn-action-icon btn-delete-transacao" onClick={handleDelete} title="Excluir">
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>

            {/* 2. TÍTULO */}
            <h3 className="card-title">{comp.titulo}</h3>

            {/* 3. INFORMAÇÕES */}
            <div className="card-infos-container">
                {comp.local && (
                    <div className="info-modern-row location-box">
                        <div className="info-icon-badge">
                            <i className="fa-solid fa-location-dot"></i>
                        </div>
                        <span className="info-text">{comp.local}</span>
                    </div>
                )}
                {comp.descricao && (
                    <div className="info-modern-row">
                        <div className="info-icon-badge">
                            <i className="fa-solid fa-align-left"></i>
                        </div>
                        <span className="info-text">{comp.descricao}</span>
                    </div>
                )}
            </div>
            
            {/* 4. RODAPÉ (Status Esquerda | Botão Direita) */}
            <div className="card-footer-row">
                
                {/* Status na Esquerda */}
                <span className={`status-badge-modern ${statusClass}`}>
                    {comp.status}
                </span>

                {/* Botão na Direita */}
                <button 
                    className={`btn-concluir-action ${isRealizado ? 'undo' : 'complete'}`} 
                    onClick={handleToggle}
                >
                    {isRealizado ? (
                        <>
                            <i className="fa-solid fa-rotate-left"></i> Reabrir
                        </>
                    ) : (
                        <>
                            Concluir <i className="fa-solid fa-check"></i>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}