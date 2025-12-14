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

    // Cor do Grupo (Default cinza se indefinido)
    const grupoCor = anotacao.grupo?.cor || '#ccc';
    
    // Tratamento de data
    const dateObj = new Date(anotacao.data_criacao);
    const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

    // Remove tags HTML para o preview
    const rawText = anotacao.conteudo.replace(/<[^>]+>/g, '');
    const previewText = rawText.length > 80 ? rawText.substring(0, 80) + '...' : rawText;

    return (
        <div 
            className={`anotacao-card ${anotacao.fixado ? 'fixado' : ''}`} 
            onClick={() => onView(anotacao)}
            style={{ borderLeftColor: grupoCor }} // Borda dinâmica via JS inline, CSS cuida do estilo
        >
            <div className="anotacao-header">
                <div className="anotacao-title-group">
                    <h3 className="anotacao-titulo">{anotacao.titulo}</h3>
                    <span className="anotacao-data">{dateStr}</span>
                </div>
                
                <div className="anotacao-actions">
                    <button className="btn-action-icon btn-pin" onClick={handlePin} title={anotacao.fixado ? "Desafixar" : "Fixar"}>
                        <i className={`fa-solid fa-thumbtack ${anotacao.fixado ? 'pinned' : ''}`}></i>
                    </button>
                    <button className="btn-action-icon" onClick={handleEditClick} title="Editar">
                        <i className="fa-solid fa-pen"></i>
                    </button>
                    <button className="btn-action-icon btn-delete-registro" onClick={handleDelete} title="Excluir">
                        <i className="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            <div className="anotacao-conteudo">
                {previewText || <span style={{opacity:0.5, fontStyle:'italic'}}>Sem conteúdo de texto...</span>}
            </div>

            {anotacao.links && anotacao.links.length > 0 && (
                <div className="anotacao-footer-links">
                    <i className="fa-solid fa-paperclip"></i> {anotacao.links.length} anexo(s)
                </div>
            )}
        </div>
    );
}