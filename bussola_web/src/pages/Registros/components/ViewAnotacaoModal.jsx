import React from 'react';
import '../styles.css';

export function ViewAnotacaoModal({ active, closeModal, nota, onEdit }) {
    if (!active || !nota) return null;

    const grupoCor = nota.grupo?.cor || '#ccc';
    const grupoNome = nota.grupo?.nome || 'Indefinido';

    const dataFormatada = new Date(nota.data_criacao).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="modal-overlay registros-scope" onClick={closeModal}>
            <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
                
                {/* Header: Arredondado no topo, borda esquerda colorida */}
                <div className="view-modal-header" style={{ borderLeft: `6px solid ${grupoCor}` }}>
                    <div className="view-header-top-row">
                        <span className="view-group-badge" style={{ backgroundColor: grupoCor }}>
                            {grupoNome}
                        </span>
                        
                        {/* Botão X limpo */}
                        <button className="clean-close-btn" onClick={closeModal} title="Fechar">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    
                    <div className="view-header-main">
                        <h2 className="view-title">{nota.titulo}</h2>
                        <span className="view-date"><i className="fa-regular fa-clock"></i> {dataFormatada}</span>
                    </div>
                </div>

                <div className="modal-body view-body">
                    {/* Conteúdo HTML Renderizado */}
                    <div 
                        className="view-content-html"
                        dangerouslySetInnerHTML={{ __html: nota.conteudo }}
                    />

                    {/* Seção de Links (Visualização) */}
                    {nota.links && nota.links.length > 0 && (
                        <div className="view-links-container">
                            <h4 className="links-title"><i className="fa-solid fa-link"></i> Links Anexados</h4>
                            <div className="links-list-view">
                                {nota.links.map(link => (
                                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="link-item-view">
                                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                        <span>{link.url}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={closeModal}>Fechar</button>
                    <button className="btn-primary" onClick={() => { onEdit(nota); closeModal(); }}>
                        <i className="fa-solid fa-pen"></i> Editar Nota
                    </button>
                </div>
            </div>
        </div>
    );
}