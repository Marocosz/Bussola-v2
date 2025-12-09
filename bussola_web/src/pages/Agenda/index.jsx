import React, { useEffect, useState } from 'react';
import { getAgendaDashboard } from '../../services/api';
import { CompromissoCard } from './components/CompromissoCard';
import { AgendaModal } from './components/AgendaModal';
import './styles.css';

export function Agenda() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [openMonths, setOpenMonths] = useState({});
    
    // Tooltip State
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, compromissos: [] });

    const fetchData = async () => {
        try {
            const result = await getAgendaDashboard();
            setData(result);
            if(Object.keys(result.compromissos_por_mes).length > 0){
                const firstMonth = Object.keys(result.compromissos_por_mes)[0];
                setOpenMonths(prev => ({...prev, [firstMonth]: true}));
            }
        } catch(err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleAccordion = (key) => setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));
    const handleNew = () => { setEditingItem(null); setModalOpen(true); };
    const handleEdit = (item) => { setEditingItem(item); setModalOpen(true); };

    // Tooltip Logic
    const handleDayHover = (e, compromissos) => {
        if (!compromissos || compromissos.length === 0) return;
        const rect = e.target.getBoundingClientRect();
        setTooltip({
            visible: true,
            x: rect.right + window.scrollX - 280, // Ajuste simples de posição
            y: rect.bottom + window.scrollY + 5,
            compromissos
        });
    };

    const handleDayLeave = () => setTooltip({ ...tooltip, visible: false });

    if (loading) return <div className="loading-screen">Carregando Agenda...</div>;

    return (
        <div className="container">
            <div className="page-header">
                <h1>Roteiro</h1>
            </div>

            <div className="agenda-view-container">
                {/* Coluna da Esquerda: Lista */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Compromissos</h2>
                        <button className="btn-primary" onClick={handleNew}><i className="fa-solid fa-plus"></i> Adicionar</button>
                    </div>

                    {Object.keys(data.compromissos_por_mes).length > 0 ? (
                        Object.entries(data.compromissos_por_mes).map(([mes, comps]) => (
                            <div className="month-group" key={mes}>
                                <h3 className={`month-header ${openMonths[mes] ? 'active' : ''}`} onClick={() => toggleAccordion(mes)}>
                                    <span>{mes}</span>
                                    <i className={`fa-solid fa-chevron-down ${openMonths[mes] ? 'rotate' : ''}`}></i>
                                </h3>
                                {openMonths[mes] && (
                                    <div className="month-content">
                                        <div className="compromissos-grid">
                                            {comps.map(comp => (
                                                <CompromissoCard key={comp.id} comp={comp} onUpdate={fetchData} onEdit={handleEdit} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p style={{textAlign:'center', color:'var(--cor-texto-secundario)'}}>Nenhum compromisso agendado.</p>
                    )}
                </div>

                {/* Coluna da Direita: Calendário */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Calendário</h2>
                    </div>
                    <div className="dias-grid">
                        {data.calendar_days.map((item, idx) => (
                            item.type === 'month_divider' ? (
                                <div className="month-divider" key={idx}>
                                    <h2>{item.month_name} {item.year}</h2>
                                </div>
                            ) : (
                                <div 
                                    className={`dia-card ${item.is_today ? 'today' : ''} ${item.compromissos.length > 0 ? 'has-compromissos' : ''}`}
                                    key={idx}
                                    onMouseEnter={(e) => handleDayHover(e, item.compromissos)}
                                    onMouseLeave={handleDayLeave}
                                >
                                    <span className="dia-numero">{item.day_number}</span>
                                    <span className="dia-semana">{item.weekday_short}</span>
                                    <div className={`compromisso-indicator ${item.compromissos.length === 0 ? 'no-event' : ''}`}></div>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            </div>

            {/* Tooltip Flutuante */}
            <div className={`tooltip ${tooltip.visible ? 'visible' : ''}`} style={{top: tooltip.y, left: tooltip.x}}>
                {tooltip.compromissos.map((c, i) => (
                    <div key={i} className="tooltip-compromisso-item">
                        <p><span className="tooltip-titulo">{c.titulo}</span> <span className="tooltip-hora">{c.hora}</span></p>
                    </div>
                ))}
            </div>

            <AgendaModal 
                active={modalOpen} 
                closeModal={() => setModalOpen(false)} 
                onUpdate={fetchData} 
                editingData={editingItem} 
            />
        </div>
    );
}