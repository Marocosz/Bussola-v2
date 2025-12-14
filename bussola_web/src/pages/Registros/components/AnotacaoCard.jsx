import React from 'react';
import { deleteAnotacao, toggleFixarAnotacao } from '../../../services/api';

export function AnotacaoCard({ anotacao, onUpdate, onEdit, onView }) {
    
    const handleDelete = async (e) => {
        e.stopPropagation();
        if (window.confirm("Excluir esta anotação?")) {
            await deleteAnotacao(anotacao.id);
            onUpdate();
        }
    };

    const handlePin = async (e) => {
        e.stopPropagation();
        await toggleFixarAnotacao(anotacao.id);
        onUpdate();
    };

    const handleEditClick = (e) => {
        e.stopPropagation();
        onEdit(anotacao);
    }

    const grupoCor = anotacao.grupo?.cor || '#ccc';
    
    // Tratamento de data
    const dateObj = new Date(anotacao.data_criacao);
    const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

    // Remove tags HTML para o preview e limita texto
    const rawText = anotacao.conteudo.replace(/<[^>]+>/g, ' ');
    
    return (
        <div 
            className={`anotacao-card ${anotacao.fixado ? 'fixado' : ''}`} 
            onClick={() => onView(anotacao)}
            style={{ borderLeftColor: grupoCor }}
        >
            {/* Header: Título, Data e Ações (Edit/Delete) */}
            <div className="anotacao-header">
                <div className="anotacao-title-group">
                    <h3 className="anotacao-titulo">{anotacao.titulo}</h3>
                    <span className="anotacao-data">{dateStr}</span>
                </div>
                
                <div className="anotacao-actions">
                    {/* Botões padronizados com Finanças */}
                    <button className="btn-action-icon btn-edit" onClick={handleEditClick} title="Editar">
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button className="btn-action-icon btn-delete" onClick={handleDelete} title="Excluir">
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>

            <div className="anotacao-conteudo">
                {rawText.trim() ? rawText : <span style={{opacity:0.5, fontStyle:'italic'}}>Sem conteúdo de texto...</span>}
            </div>

            {/* Footer: Botão Fixar (Esq) e Links (Dir) */}
            <div className="anotacao-footer">
                <button 
                    className={`footer-pin-btn ${anotacao.fixado ? 'pinned' : ''}`} 
                    onClick={handlePin}
                    title={anotacao.fixado ? "Desafixar" : "Fixar no topo"}
                >
                    <i className={`fa-solid fa-thumbtack ${anotacao.fixado ? 'pinned' : ''}`}></i>
                    {anotacao.fixado ? '' : ''} 
                </button>

                {anotacao.links && anotacao.links.length > 0 && (
                    <div className="anotacao-footer-links">
                        <i className="fa-solid fa-paperclip"></i> {anotacao.links.length}
                    </div>
                )}
            </div>
        </div>
    );
}