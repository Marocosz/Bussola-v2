import React from 'react';

export function KpiCard({ iconClass, value, label, type, subtext, isPrivacy = false }) {
    const getColorStyle = () => {
        switch(type) {
            case 'receita': return { bg: 'rgba(39, 174, 96, 0.15)', color: '#27ae60' }; 
            case 'despesa': return { bg: 'rgba(231, 76, 60, 0.15)', color: '#e74c3c' }; 
            case 'pendente': return { bg: 'rgba(243, 156, 18, 0.15)', color: '#f39c12' }; 
            case 'azul': return { bg: 'rgba(74, 109, 255, 0.15)', color: '#4A6DFF' }; 
            case 'critica': return { bg: 'rgba(231, 76, 60, 0.1)', color: '#c0392b', border: '1px solid #e74c3c' };
            default: return { bg: 'rgba(142, 142, 147, 0.15)', color: '#8e8e93' }; 
        }
    };

    const style = getColorStyle();

    return (
        <div className="kpi-card-new" style={{ borderColor: type === 'critica' ? style.color : 'transparent' }}>
            <div className="kpi-icon-wrapper" style={{ backgroundColor: style.bg, color: style.color }}>
                <i className={iconClass}></i>
            </div>
            <div className="kpi-content">
                {/* Aplica blur apenas no valor se o modo privacidade estiver ativo */}
                <span className={`kpi-value-text ${isPrivacy ? 'privacy-blur' : ''}`}>{value}</span>
                <span className="kpi-label-text">{label}</span>
                {subtext && <span className="kpi-subtext">{subtext}</span>}
            </div>
        </div>
    );
}