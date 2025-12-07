import React from 'react';

export function CategoryCard({ categoria }) {
    // Define qual valor mostrar (gasto ou ganho) baseado no tipo
    const valor = categoria.tipo === 'despesa' ? categoria.total_gasto : categoria.total_ganho;
    const valorStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

    return (
        <div className="categoria-card">
            <div className="categoria-icon-box" style={{ backgroundColor: categoria.cor + '20' }}> {/* 20 é opacidade hex */}
                <i className={categoria.icone} style={{ color: categoria.cor }}></i>
            </div>
            <div className="categoria-info">
                <h4>{categoria.nome}</h4>
                <div className="categoria-meta">
                    {categoria.tipo === 'despesa' ? 'Gasto: ' : 'Ganho: '}
                    <strong>{valorStr}</strong>
                </div>
                {/* Barra de progresso visual simples se houver meta */}
                {categoria.meta_limite > 0 && categoria.tipo === 'despesa' && (
                    <div className="progress-bar-container">
                        <div 
                            className="progress-bar-fill" 
                            style={{ 
                                width: `${Math.min((valor / categoria.meta_limite) * 100, 100)}%`,
                                backgroundColor: valor > categoria.meta_limite ? 'var(--cor-vermelho-delete)' : categoria.cor 
                            }}
                        ></div>
                    </div>
                )}
            </div>
        </div>
    );
}