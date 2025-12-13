import React, { useState } from 'react';

export function CategoryCard({ categoria }) {
    const [expanded, setExpanded] = useState(false);

    // Helpers de formatação
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    
    // 1. Define o valor atual (Gasto ou Ganho)
    const valorAtual = categoria.tipo === 'despesa' ? Number(categoria.total_gasto || 0) : Number(categoria.total_ganho || 0);
    const metaLimite = Number(categoria.meta_limite || 0);
    
    // 2. Verifica se tem meta definida
    const hasMeta = metaLimite > 0;
    
    // 3. CÁLCULO DA PORCENTAGEM (PROGRESSIVA)
    const percentMeta = hasMeta ? Math.min((valorAtual / metaLimite) * 100, 100) : 0;
    
    // Verifica se estourou o limite (apenas para mudar a cor da despesa para vermelho)
    const isOverLimit = hasMeta && categoria.tipo === 'despesa' && valorAtual > metaLimite;

    // Rótulo dinâmico
    const labelMeta = categoria.tipo === 'despesa' ? 'Limite' : 'Meta';

    return (
        <div className={`categoria-card ${expanded ? 'expanded' : ''}`}>
            
            {/* --- CABEÇALHO DO CARD (Sempre Visível) --- */}
            {/* ALTERAÇÃO: onClick no header inteiro para expandir ao clicar em qualquer parte */}
            <div 
                className="categoria-card-header" 
                onClick={() => setExpanded(!expanded)}
                style={{ cursor: 'pointer' }}
            >
                {/* Ícone */}
                <div className="categoria-icon-box" style={{ backgroundColor: categoria.cor + '20' }}>
                    <i className={categoria.icone} style={{ color: categoria.cor }}></i>
                </div>

                {/* Informações Principais */}
                <div className="categoria-info">
                    <div className="categoria-main-row">
                        <h4>{categoria.nome}</h4>
                        <span className={`categoria-valor ${categoria.tipo}`}>
                            {formatCurrency(valorAtual)}
                        </span>
                    </div>

                    <div className="categoria-meta-line">
                        {/* Mostra texto apenas se houver meta/limite configurado */}
                        {hasMeta ? (
                            <span className="meta-text">
                                {labelMeta}: <strong>{formatCurrency(metaLimite)}</strong>
                            </span>
                        ) : (
                            <span className="meta-text-empty">Sem {labelMeta.toLowerCase()} definido</span>
                        )}
                    </div>

                    {/* BARRA DE PROGRESSO */}
                    {hasMeta && (
                        <div className="progress-bar-container">
                            <div 
                                className="progress-bar-fill" 
                                style={{ 
                                    // Aqui aplicamos a porcentagem calculada (Ex: 30%)
                                    width: `${percentMeta}%`,
                                    // Lógica de cor: Vermelho se estourou despesa, senão usa a cor da categoria
                                    backgroundColor: isOverLimit ? 'var(--cor-vermelho-delete)' : categoria.cor 
                                }}
                            ></div>
                        </div>
                    )}
                </div>

                {/* Botão de Expandir (Setinha) */}
                <button 
                    className={`btn-expand-card ${expanded ? 'rotate' : ''}`}
                    // O onClick aqui é redundante pois o pai já trata, mas mantemos para garantir a UI do botão
                    onClick={(e) => {
                        e.stopPropagation(); // Evita duplo disparo se necessário, mas não crítico aqui
                        setExpanded(!expanded);
                    }}
                >
                    <i className="fa-solid fa-chevron-down"></i>
                </button>
            </div>

            {/* --- DETALHES (Visível ao Expandir) --- */}
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