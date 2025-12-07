import React from 'react';

export function KpiCard({ iconClass, value, label, type }) {
    // Lógica de cores baseada no tipo (receita, despesa, info, etc.)
    const getColorStyle = () => {
        switch(type) {
            case 'receita': return { bg: 'rgba(39, 174, 96, 0.2)', color: '#27ae60' }; // Verde
            case 'despesa': return { bg: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c' }; // Vermelho
            case 'pendente': return { bg: 'rgba(243, 156, 18, 0.2)', color: '#f39c12' }; // Laranja
            case 'azul': return { bg: 'rgba(74, 109, 255, 0.2)', color: '#4A6DFF' }; // Azul
            default: return { bg: 'rgba(142, 142, 147, 0.2)', color: '#8e8e93' }; // Cinza
        }
    };

    const style = getColorStyle();

    return (
        <div className="kpi-card">
            <div className="kpi-icon" style={{ backgroundColor: style.bg, color: style.color }}>
                <i className={iconClass}></i>
            </div>
            <div className="kpi-info">
                <span className="kpi-value">{value}</span>
                <span className="kpi-label">{label}</span>
            </div>
        </div>
    );
}