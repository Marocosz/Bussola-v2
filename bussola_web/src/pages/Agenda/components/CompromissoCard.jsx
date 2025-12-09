import React from 'react';
import { toggleCompromissoStatus, deleteCompromisso } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function CompromissoCard({ comp, onUpdate, onEdit }) {
    const { addToast } = useToast();

    const handleToggle = async () => {
        await toggleCompromissoStatus(comp.id);
        onUpdate();
    };

    const handleDelete = async () => {
        if(!confirm('Excluir este compromisso?')) return;
        await deleteCompromisso(comp.id);
        addToast({type:'success', title:'Excluído', description:'Compromisso removido.'});
        onUpdate();
    };

    const dataObj = new Date(comp.data_hora);
    const dia = dataObj.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
    const hora = dataObj.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    const diaSemana = dataObj.toLocaleDateString('pt-BR', {weekday:'long'});

    let statusClass = 'pendente';
    if(comp.status === 'Realizado') statusClass = 'realizado';
    if(comp.status === 'Perdido') statusClass = 'perdido';

    return (
        <div className="compromisso-card-detailed">
            <div className="compromisso-header">
                <h4>{comp.titulo}</h4>
                <div className="action-buttons-small">
                    <button className="reset" onClick={() => onEdit(comp)} title="Editar"><i className="fa-solid fa-pencil"></i></button>
                    <button className="done" onClick={handleToggle} title="Concluir/Reabrir">
                        <i className={comp.status === 'Realizado' ? "fa-solid fa-rotate-left" : "fa-solid fa-check"}></i>
                    </button>
                    <button className="reset" onClick={handleDelete} title="Excluir"><i className="fa-solid fa-trash"></i></button>
                </div>
            </div>
            
            <p className="compromisso-detail"><i className="fa-regular fa-calendar"></i> <span>{dia} ({diaSemana})</span></p>
            <p className="compromisso-detail"><i className="fa-regular fa-clock"></i> <span>{hora}</span></p>
            {comp.local && <p className="compromisso-detail"><i className="fa-solid fa-location-dot"></i> <span>{comp.local}</span></p>}
            {comp.descricao && <p className="compromisso-detail"><i className="fa-solid fa-align-left"></i> <span>{comp.descricao}</span></p>}
            
            <div className="footer-details">
                <span className={`status-badge ${statusClass}`}>{comp.status}</span>
            </div>
        </div>
    );
}