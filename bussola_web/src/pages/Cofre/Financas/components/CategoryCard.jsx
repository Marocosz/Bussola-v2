import React, { useState } from 'react';

export function CategoryCard({ categoria, onEdit, onDelete }) {
    const [expanded, setExpanded] = useState(false);

    // Helpers de formatação
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    
    // 1. Define o valor atual
    const valorAtual = categoria.tipo === 'despesa' ? Number(categoria.total_gasto || 0) : Number(categoria.total_ganho || 0);
    const metaLimite = Number(categoria.meta_limite || 0);
    
    // 2. Verifica se tem meta definida
    const hasMeta = metaLimite > 0;
    
    // 3. Cálculo da porcentagem
    const percentMeta = hasMeta ? Math.min((valorAtual / metaLimite) * 100, 100) : 0;
    
    const isOverLimit = hasMeta && categoria.tipo === 'despesa' && valorAtual > metaLimite;
    const labelMeta = categoria.tipo === 'despesa' ? 'Limite' : 'Meta';

    // Verifica se é categoria de sistema
    const isSystemCategory = categoria.nome && categoria.nome.toLowerCase().includes('indefinida');

    return (
        <div className={`categoria-card ${expanded ? 'expanded' : ''}`}>
            
            <div 
                className="categoria-card-header" 
                onClick={() => setExpanded(!expanded)}
                style={{ cursor: 'pointer' }}
            >
                {/* 1. Ícone */}
                <div className="categoria-icon-box" style={{ backgroundColor: categoria.cor + '20' }}>
                    <i className={categoria.icone} style={{ color: categoria.cor }}></i>
                </div>

                {/* 2. Informações (Centro) */}
                <div className="categoria-info">
                    <div className="categoria-main-row">
                        <h4>{categoria.nome}</h4>
                        
                        {/* NOVA LÓGICA: 
                           Se for categoria NORMAL, o valor aparece aqui (ao lado do nome).
                           Se for de SISTEMA, o valor some daqui (vai pra direita).
                        */}
                        {!isSystemCategory && (
                            <span className={`categoria-valor ${categoria.tipo}`}>
                                {formatCurrency(valorAtual)}
                            </span>
                        )}
                    </div>

                    <div className="categoria-meta-line">
                        {hasMeta ? (
                            <span className="meta-text">
                                {labelMeta}: <strong>{formatCurrency(metaLimite)}</strong>
                            </span>
                        ) : (
                            <span className="meta-text-empty">Sem {labelMeta.toLowerCase()} definido</span>
                        )}
                    </div>

                    {hasMeta && (
                        <div className="progress-bar-container">
                            <div 
                                className="progress-bar-fill" 
                                style={{ 
                                    width: `${percentMeta}%`,
                                    backgroundColor: isOverLimit ? 'var(--cor-vermelho-delete)' : categoria.cor 
                                }}
                            ></div>
                        </div>
                    )}
                </div>

                {/* 3. Coluna Direita */}
                <div className="header-right-column">
                    
                    {/* Topo da Direita: Botões OU Valor (se for sistema) */}
                    <div className="header-actions-top" onClick={(e) => e.stopPropagation()}>
                        
                        {/* Se NÃO for sistema: Mostra os botões de editar/excluir */}
                        {!isSystemCategory ? (
                            <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onEdit && onEdit(categoria); }} 
                                    className="btn-action-icon btn-edit-transacao"
                                    title="Editar Categoria"
                                >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDelete && onDelete(categoria.id); }} 
                                    className="btn-action-icon btn-delete-transacao"
                                    title="Excluir Categoria"
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                </button>
                            </>
                        ) : (
                            /* NOVA LÓGICA:
                               Se FOR sistema: O valor aparece AQUI, ocupando o lugar dos botões
                               e ficando alinhado totalmente à direita.
                            */
                            <span className={`categoria-valor ${categoria.tipo}`} style={{ fontSize: '1rem' }}>
                                {formatCurrency(valorAtual)}
                            </span>
                        )}
                    </div>

                    {/* Seta (Fundo) */}
                    <button 
                        className={`btn-expand-card ${expanded ? 'rotate' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation(); 
                            setExpanded(!expanded);
                        }}
                    >
                        <i className="fa-solid fa-chevron-down"></i>
                    </button>
                </div>
            </div>

            {/* Detalhes... (Mantido igual) */}
            <div className={`categoria-details-wrapper ${expanded ? 'open' : ''}`}>
                <div className="categoria-details-inner">
                    <div className="stats-separator"></div>
                    <div className="categoria-stats-grid">
                        <div className="stat-item">
                            <span className="stat-label">Histórico Total</span>
                            <span className="stat-value">{formatCurrency(categoria.total_historico)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Média</span>
                            <span className="stat-value">{formatCurrency(categoria.media_valor)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Qtd. Trans.</span>
                            <span className="stat-value">{categoria.qtd_transacoes || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}