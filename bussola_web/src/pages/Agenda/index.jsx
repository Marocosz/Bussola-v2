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
    
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, compromissos: [] });

    // --- MUDANÇA 1: Inicialização com LocalStorage ---
    // Tenta ler o estado salvo. Se não existir, inicia vazio {}.
    const [openMonths, setOpenMonths] = useState(() => {
        const savedState = localStorage.getItem('@Bussola:agenda_accordions');
        if (savedState) {
            try {
                return JSON.parse(savedState);
            } catch (e) {
                console.error("Erro ao ler localStorage", e);
            }
        }
        return {};
    });

    // --- MUDANÇA 2: Salvar no LocalStorage sempre que mudar ---
    useEffect(() => {
        localStorage.setItem('@Bussola:agenda_accordions', JSON.stringify(openMonths));
    }, [openMonths]);

    const fetchData = async () => {
        try {
            const result = await getAgendaDashboard();
            setData(result);
            
            // Lógica inteligente: Só abre o primeiro mês automaticamente se
            // o usuário NUNCA mexeu no accordion (estado vazio).
            // Se ele já abriu/fechou algo (estado salvo), respeitamos a escolha dele.
            if (result.compromissos_por_mes && Object.keys(result.compromissos_por_mes).length > 0) {
                const firstMonth = Object.keys(result.compromissos_por_mes)[0];
                setOpenMonths(prev => {
                    // Se não tem chaves (primeiro acesso), abre o primeiro mês
                    if (Object.keys(prev).length === 0) return { [firstMonth]: true };
                    return prev;
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleAccordion = (key) => setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));
    const handleNew = () => { setEditingItem(null); setModalOpen(true); };
    const handleEdit = (item) => { setEditingItem(item); setModalOpen(true); };

    const handleDayHover = (e, compromissos) => {
        if (!compromissos || compromissos.length === 0) return;
        const rect = e.target.getBoundingClientRect();
        setTooltip({
            visible: true,
            x: rect.right + window.scrollX - 280,
            y: rect.bottom + window.scrollY + 5,
            compromissos
        });
    };

    const handleDayLeave = () => setTooltip({ ...tooltip, visible: false });

    if (loading) return <div className="loading-screen">Carregando Agenda...</div>;

    return (
        <div className="container main-container">
            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Roteiro</h1>
                    <p>Organize seus compromissos, tarefas e eventos importantes.</p>
                </div>
            </div>

            <div className="layout-grid-custom agenda-layout">
                {/* Coluna da Esquerda: Lista */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Compromissos</h2>
                        <button className="btn-primary" onClick={handleNew}>
                            <i className="fa-solid fa-plus"></i> Adicionar
                        </button>
                    </div>

                    {Object.keys(data.compromissos_por_mes).length > 0 ? (
                        Object.entries(data.compromissos_por_mes).map(([mes, comps]) => (
                            <div className="month-group" key={mes}>
                                <h3 className={`month-header ${openMonths[mes] ? 'active' : ''}`} onClick={() => toggleAccordion(mes)}>
                                    <span>{mes}</span>
                                    <i className={`fa-solid fa-chevron-down ${openMonths[mes] ? 'rotate' : ''}`}></i>
                                </h3>
                                
                                {/* A classe 'open' controla a animação CSS (height) */}
                                <div className={`accordion-wrapper ${openMonths[mes] ? 'open' : ''}`}>
                                    <div className="accordion-inner">
                                        <div className="month-content">
                                            <div className="compromissos-grid">
                                                {comps.map(comp => (
                                                    <CompromissoCard key={comp.id} comp={comp} onUpdate={fetchData} onEdit={handleEdit} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="empty-list-msg">Nenhum compromisso agendado.</p>
                    )}
                </div>

                {/* Coluna da Direita: Calendário */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Calendário</h2>
                    </div>

                    <div className="dias-grid">
                        {data.calendar_days.map((item, idx) => {
                            if (item.type === 'month_divider') {
                                return (
                                    <div className="month-divider" key={idx}>
                                        <h2>{item.month_name} {item.year}</h2>
                                    </div>
                                );
                            }

                            // Determina classes dinamicamente
                            let cardClasses = 'dia-card';
                            if (item.is_today) cardClasses += ' today';
                            if (item.is_padding) cardClasses += ' dia-padding';
                            if (!item.is_padding && item.compromissos?.length > 0) cardClasses += ' has-compromissos';

                            return (
                                <div
                                    className={cardClasses}
                                    key={idx}
                                    onMouseEnter={(e) => !item.is_padding && handleDayHover(e, item.compromissos)}
                                    onMouseLeave={handleDayLeave}
                                >
                                    <span className="dia-numero">{item.day_number}</span>
                                    <span className="dia-semana">{item.weekday_short}</span>
                                    <div className={`compromisso-indicator ${item.compromissos?.length > 0 && !item.is_padding ? '' : 'no-event'}`}></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className={`tooltip ${tooltip.visible ? 'visible' : ''}`} style={{ top: tooltip.y, left: tooltip.x }}>
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