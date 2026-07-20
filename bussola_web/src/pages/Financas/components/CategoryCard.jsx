import React, { useState } from 'react';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/**
 * Linha (item) de categoria — usada na lista `.categoria-list` do modal de Categorias.
 * Conceito "Selo flutuante": um selo (ícone + cor da categoria) transborda o topo-esquerdo
 * do card. Corpo limpo: nome + chip de tipo, valor do mês (herói, colorido por tipo) e barra
 * de limite/meta. Expansível para exibir estatísticas (histórico / média / qtd de transações).
 */
export function CategoryCard({ categoria, onEdit, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = (e) => {
        e.stopPropagation();
        if (!onDelete) return;
        setIsDeleting(true);
        setTimeout(() => onDelete(categoria.id), 400);
    };

    const cor = categoria.cor || '#8b90a0';
    const isDespesa = categoria.tipo === 'despesa';
    const valorAtual = isDespesa ? Number(categoria.total_gasto || 0) : Number(categoria.total_ganho || 0);
    const metaLimite = Number(categoria.meta_limite || 0);
    const hasMeta = metaLimite > 0;
    const percentRaw = hasMeta ? (valorAtual / metaLimite) * 100 : 0;
    const percentBar = Math.min(percentRaw, 100);
    const isOverLimit = hasMeta && isDespesa && valorAtual > metaLimite;
    const labelMeta = isDespesa ? 'Limite' : 'Meta';
    const isSystemCategory = categoria.nome && categoria.nome.toLowerCase().includes('indefinida');

    return (
        <div className={`catcard selo-card ${isDeleting ? 'catcard-deleting' : ''} ${expanded ? 'catcard-open' : ''}`}>
            <span className="selo-badge" style={{ '--selo-cor': cor }}>
                <i className={categoria.icone || 'fa-solid fa-tag'}></i>
            </span>

            <div className="catcard-head">
                <div className="catcard-id">
                    <div className="catcard-name-line">
                        <strong className="catcard-name" title={categoria.nome}>{categoria.nome}</strong>
                        <span className={`catcard-chip catcard-chip-${categoria.tipo}`}>
                            {isDespesa ? 'Despesa' : 'Receita'}
                        </span>
                    </div>
                    <span className={`catcard-value ${categoria.tipo}`}>{fmt(valorAtual)}</span>
                </div>

                <div className="catcard-actions">
                    {!isSystemCategory && (
                        <>
                            <button className="btn-action-icon btn-edit-transacao" title="Editar categoria"
                                onClick={() => onEdit && onEdit(categoria)}>
                                <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button className="btn-action-icon btn-delete-transacao" title="Excluir categoria"
                                onClick={handleDelete}>
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
                        </>
                    )}
                    <button className={`catcard-expand ${expanded ? 'open' : ''}`} title="Detalhes"
                        onClick={() => setExpanded(v => !v)}>
                        <i className="fa-solid fa-chevron-down"></i>
                    </button>
                </div>
            </div>

            {hasMeta ? (
                <div className="catcard-progress">
                    <div className="catcard-progress-top">
                        <span className="catcard-progress-label">
                            {labelMeta}: <strong>{fmt(metaLimite)}</strong>
                        </span>
                        <span className={`catcard-progress-pct ${isOverLimit ? 'over' : ''}`}>
                            {Math.round(percentRaw)}%
                        </span>
                    </div>
                    <div className="catcard-bar">
                        <span style={{ width: `${percentBar}%`, backgroundColor: isOverLimit ? 'var(--cor-vermelho-delete)' : cor }}></span>
                    </div>
                </div>
            ) : (
                <span className="catcard-nometa">
                    <i className="fa-regular fa-circle-dot"></i> sem {labelMeta.toLowerCase()} definido
                </span>
            )}

            <div className={`catcard-details ${expanded ? 'open' : ''}`}>
                <div className="catcard-details-inner">
                    <div className="catcard-stats">
                        <div className="catcard-stat">
                            <span className="catcard-stat-label">Histórico</span>
                            <strong>{fmt(categoria.total_historico)}</strong>
                        </div>
                        <div className="catcard-stat">
                            <span className="catcard-stat-label">Média</span>
                            <strong>{fmt(categoria.media_valor)}</strong>
                        </div>
                        <div className="catcard-stat">
                            <span className="catcard-stat-label">Transações</span>
                            <strong>{categoria.qtd_transacoes || 0}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
