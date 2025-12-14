import React from 'react';
import { toggleFixarAnotacao, deleteAnotacao } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function AnotacaoCard({ anotacao, onUpdate, onEdit }) {
    const { addToast } = useToast();

    const handleFixar = async (e) => {
        e.stopPropagation();
        try {
            await toggleFixarAnotacao(anotacao.id);
            onUpdate();
        } catch (error) { console.error(error); }
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (!confirm('Excluir esta anotação?')) return;
        try {
            await deleteAnotacao(anotacao.id);
            addToast({ type: 'success', title: 'Excluído', description: 'Anotação removida.' });
            onUpdate();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao excluir.' });
        }
    };

    // Remove tags HTML para verificar se tem conteúdo
    const conteudoLimpo = anotacao.conteudo ? anotacao.conteudo.replace(/<[^>]*>?/gm, '').trim() : '';
    const temConteudo = conteudoLimpo.length > 0;

    // Proteção contra objeto grupo nulo
    const nomeGrupo = anotacao.grupo ? anotacao.grupo.nome : 'Geral';
    const corGrupo = anotacao.grupo ? anotacao.grupo.cor : '#e0e7ff';

    return (
        <div className={`anotacao-card ${anotacao.fixado ? 'fixado' : ''}`} onClick={() => onEdit(anotacao)}>
            <div className="anotacao-header">
                <div className="anotacao-title-group">
                    <span className="anotacao-tipo-badge" style={{ backgroundColor: corGrupo }}>
                        {nomeGrupo}
                    </span>
                    <h3 className="anotacao-titulo">{anotacao.titulo || 'Sem título'}</h3>
                </div>

                <div className="anotacao-actions">
                    <button className="btn-action-icon btn-pin" onClick={handleFixar} title={anotacao.fixado ? "Desafixar" : "Fixar"}>
                        <i className={`fa-solid fa-thumbtack ${anotacao.fixado ? 'pinned' : ''}`}></i>
                    </button>
                    <button className="btn-action-icon btn-delete-registro" onClick={handleDelete} title="Excluir">
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>

            {temConteudo && (
                <div className="anotacao-conteudo ql-snow">
                    <div className="ql-editor" dangerouslySetInnerHTML={{ __html: anotacao.conteudo }} />
                </div>
            )}
            
            {/* Footer apenas se tiver links */}
            {anotacao.links && anotacao.links.length > 0 && (
                <div className="anotacao-footer">
                    <i className="fa-solid fa-link" style={{fontSize:'0.8rem', marginRight:'5px'}}></i> 
                    <span style={{fontSize:'0.8rem'}}>{anotacao.links.length} links anexados</span>
                </div>
            )}
        </div>
    );
}