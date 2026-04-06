import React, { useState, useMemo } from 'react';
import { deleteAnotacao, toggleFixarAnotacao } from '../../../services/api';
import { useConfirm } from '../../../context/ConfirmDialogContext';

export const AnotacaoCard = React.memo(function AnotacaoCard({ anotacao, onUpdate, onEdit, onView }) {
    const confirm = useConfirm();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e) => {
        e.stopPropagation();

        const isConfirmed = await confirm({
            title: 'Excluir Anotação?',
            description: 'Esta anotação será permanentemente removida.',
            confirmLabel: 'Excluir',
            variant: 'danger'
        });

        if (isConfirmed) {
            await deleteAnotacao(anotacao.id);
            setIsDeleting(true);
            setTimeout(() => onUpdate(), 450);
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

    // Remove tags HTML (legado) ou sintaxe markdown para o preview
    const rawText = useMemo(() => {
        const isHtml = anotacao.conteudo && /<[a-z][\s\S]*>/i.test(anotacao.conteudo);
        return isHtml
            ? anotacao.conteudo.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : (anotacao.conteudo || '')
                .replace(/#{1,6}\s+/g, '')
                .replace(/(\*\*|__)(.*?)\1/g, '$2')
                .replace(/(\*|_)(.*?)\1/g, '$2')
                .replace(/~~(.*?)~~/g, '$1')
                .replace(/`{1,3}[^`]*`{1,3}/g, '')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/^[>-]\s+/gm, '')
                .replace(/\n{2,}/g, ' ')
                .trim();
    }, [anotacao.conteudo]);
    
    return (
        <div
            className={`anotacao-card ${anotacao.fixado ? 'fixado' : ''} ${isDeleting ? 'card-deleting' : ''}`}
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

            </div>
        </div>
    );
});