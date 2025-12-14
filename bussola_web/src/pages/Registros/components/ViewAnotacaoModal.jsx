import React from 'react';
import '../styles.css';

export function ViewAnotacaoModal({ active, closeModal, nota, onEdit }) {
    if (!active || !nota) return null;

    const grupoCor = nota.grupo?.cor || '#ccc';
    const grupoNome = nota.grupo?.nome || 'Indefinido';

    // Formata data
    const dataFormatada = new Date(nota.data_criacao).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="modal-overlay registros-scope" onClick={closeModal}>
            <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
                
                {/* Header do Modal com a cor do grupo */}
                <div className="view-modal-header" style={{ borderLeft: `6px solid ${grupoCor}` }}>
                    <div className="view-meta-top">
                        <span className="view-group-badge" style={{ backgroundColor: grupoCor }}>
                            {grupoNome}
                        </span>
                        <div className="view-actions">
                            <button className="icon-btn" onClick={() => { onEdit(nota); closeModal(); }} title="Editar">
                                <i className="fa-solid fa-pen"></i>
                            </button>
                            <button className="icon-btn close" onClick={closeModal} title="Fechar">
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <h2 className="view-title">{nota.titulo}</h2>
                    <span className="view-date"><i className="fa-regular fa-clock"></i> {dataFormatada}</span>
                </div>

                <div className="modal-body view-body">
                    {/* Conteúdo HTML */}
                    <div 
                        className="view-content-html"
                        dangerouslySetInnerHTML={{ __html: nota.conteudo }}
                    />

                    {/* Links se houver */}
                    {nota.links && nota.links.length > 0 && (
                        <div className="view-links-section">
                            <h4><i className="fa-solid fa-link"></i> Links Anexados</h4>
                            <ul>
                                {nota.links.map(link => (
                                    <li key={link.id}>
                                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                                            {link.url}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={closeModal}>Fechar</button>
                    <button className="btn-primary" onClick={() => { onEdit(nota); closeModal(); }}>
                        Editar Nota
                    </button>
                </div>
            </div>
        </div>
    );
}