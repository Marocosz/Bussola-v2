import React from 'react';
import { toggleFixarRegistro, toggleTarefaStatus, deleteRegistro } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function RegistroCard({ anotacao, onUpdate, onEdit }) {
    const { addToast } = useToast();

    const handleFixar = async (e) => {
        e.stopPropagation();
        await toggleFixarRegistro(anotacao.id);
        onUpdate();
    };

    const handleCheckTarefa = async (e) => {
        e.stopPropagation();
        await toggleTarefaStatus(anotacao.id);
        onUpdate();
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        if(!confirm('Excluir este registro?')) return;
        try {
            await deleteRegistro(anotacao.id);
            addToast({type:'success', title:'Excluído', description:'Registro removido.'});
            onUpdate();
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao excluir.'});
        }
    };

    // Remove tags HTML para verificar se tem conteúdo textual puro
    const temConteudo = anotacao.conteudo && anotacao.conteudo.replace(/<[^>]*>?/gm, '').trim().length > 0;

    return (
        <div className={`anotacao-card ${anotacao.fixado ? 'fixado' : ''} ${anotacao.is_tarefa && anotacao.status_tarefa === 'Concluído' ? 'tarefa-concluida' : ''}`}>
            <div className="anotacao-header">
                {anotacao.is_tarefa && (
                    <button className="tarefa-checkbox" onClick={handleCheckTarefa}>
                        <i className={anotacao.status_tarefa === 'Concluído' ? "fa-solid fa-check-square" : "fa-regular fa-square"}></i>
                    </button>
                )}
                
                <div className="anotacao-title-group">
                    <span className="anotacao-tipo-badge">{anotacao.tipo}</span>
                    <h3 className="anotacao-titulo">{anotacao.titulo}</h3>
                </div>

                <div className="anotacao-actions">
                    <button className="btn-action-icon btn-pin" onClick={handleFixar}>
                        <i className={`fa-solid fa-thumbtack ${anotacao.fixado ? 'pinned' : ''}`}></i>
                    </button>
                    <button className="btn-action-icon btn-edit-registro" onClick={() => onEdit(anotacao)}>
                        <i className="fa-solid fa-pencil"></i>
                    </button>
                    <button className="btn-action-icon btn-delete-registro" onClick={handleDelete}>
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>

            {/* Renderiza HTML Seguro */}
            {temConteudo && (
                <div className="anotacao-conteudo ql-snow">
                    <div className="ql-editor" dangerouslySetInnerHTML={{ __html: anotacao.conteudo }} />
                </div>
            )}

            {anotacao.links && anotacao.links.length > 0 && (
                <div className="anotacao-footer">
                    <ul className="links-list">
                        {anotacao.links.map(link => (
                            <li key={link.id}>
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                    <i className="fa-solid fa-link"></i> {link.url}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}