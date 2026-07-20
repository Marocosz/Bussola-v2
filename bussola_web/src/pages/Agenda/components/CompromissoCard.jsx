import React from 'react';
import { setCompromissoStatus, deleteCompromisso } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext'; // <--- Import Novo

export function CompromissoCard({ comp, onUpdate, onEdit }) {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleSetStatus = async (newStatus) => {
        await setCompromissoStatus(comp.id, newStatus);
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
        setIsDeleting(true);
        setTimeout(() => onUpdate(), 450);
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
    if(comp.status === 'Cancelado') statusClass = 'cancelado';

    // Ícone do selo flutuante por status
    let statusIcon = 'fa-solid fa-clock';
    if(comp.status === 'Realizado') statusIcon = 'fa-solid fa-check';
    if(comp.status === 'Cancelado') statusIcon = 'fa-solid fa-xmark';
    if(comp.status === 'Perdido') statusIcon = 'fa-solid fa-triangle-exclamation';

    return (
        <div className={`compromisso-card-modern selo-card ${statusClass} ${isDeleting ? 'card-deleting' : ''}`}>

            {/* Selo flutuante de status + tag de estado integrada à direita dele */}
            <span className="selo-badge"><i className={statusIcon}></i></span>
            <span className={`selo-status-tag ${statusClass}`}>{comp.status}</span>

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
            
            {/* 4. RODAPÉ — só ações que fazem sentido pra cada estado.
                • Pendente / Perdido = desfecho ainda em aberto → Cancelar + Concluir.
                • Realizado / Cancelado = terminal deliberado → só Reabrir (desfazer engano).
                Perdido não oferece "Reabrir": o backend re-marca como Perdido qualquer
                pendente vencido, então reabrir voltaria ao mesmo lugar. */}
            <div className="card-footer-row">
                <div className="footer-actions">
                    {(comp.status === 'Pendente' || comp.status === 'Perdido') && (
                        <>
                            <button className="btn-cancelar-action" onClick={() => handleSetStatus('Cancelado')}>
                                <i className="fa-solid fa-xmark"></i> Cancelar
                            </button>
                            <button className="btn-concluir-action complete" onClick={() => handleSetStatus('Realizado')}>
                                Concluir <i className="fa-solid fa-check"></i>
                            </button>
                        </>
                    )}
                    {(comp.status === 'Realizado' || comp.status === 'Cancelado') && (
                        <button className="btn-concluir-action undo" onClick={() => handleSetStatus('Pendente')}>
                            <i className="fa-solid fa-rotate-left"></i> Reabrir
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}