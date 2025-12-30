import React, { useEffect, useState } from 'react';
import { getAgendaDashboard } from '../../services/api';
import { CompromissoCard } from './components/CompromissoCard';
import { AgendaModal } from './components/AgendaModal';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import './styles.css';

// Removido o import do AiAssistant aqui!

export function Agenda() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    
    // [NOVO] Estado para controlar o mês visualizado no calendário
    const [viewDate, setViewDate] = useState(new Date());

    const { addToast } = useToast();
    const dialogConfirm = useConfirm();
    
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, compromissos: [] });

    const [openMonths, setOpenMonths] = useState(() => {
        const savedState = localStorage.getItem('@Bussola:agenda_accordions');
        if (savedState) {
            try { return JSON.parse(savedState); } catch (e) { }
        }
        return {};
    });

    useEffect(() => {
        localStorage.setItem('@Bussola:agenda_accordions', JSON.stringify(openMonths));
    }, [openMonths]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // [ALTERADO] Passamos o mês e ano do estado viewDate para a API
            // Nota: getMonth() retorna 0-11, a API espera 1-12.
            const month = viewDate.getMonth() + 1;
            const year = viewDate.getFullYear();

            // Assume que sua função de serviço aceita (mes, ano)
            const result = await getAgendaDashboard(month, year); 
            setData(result);
            
            if (result.compromissos_por_mes && Object.keys(result.compromissos_por_mes).length > 0) {
                const firstMonth = Object.keys(result.compromissos_por_mes)[0];
                setOpenMonths(prev => {
                    if (Object.keys(prev).length === 0) return { [firstMonth]: true };
                    return prev;
                });
            }
        } catch (err) {
            console.error(err);
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível carregar a agenda.' });
        } finally {
            setLoading(false);
        }
    };

    // [NOVO] Dispara o fetch sempre que o usuário mudar o mês
    useEffect(() => { fetchData(); }, [viewDate]);

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

    // [NOVO] Handlers de Navegação do Calendário
    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    // [NOVO] Formatador de nome de mês para o título (Ex: Janeiro 2025)
    const formatMonthTitle = (date) => {
        return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    };

    // [NOVO] Filtra apenas os dias do primeiro grid (Mês Atual) para renderizar
    const getCurrentMonthDays = () => {
        if (!data || !data.calendar_days) return [];
        
        const days = [];
        let dividersFound = 0;

        for (const item of data.calendar_days) {
            if (item.type === 'month_divider') {
                dividersFound++;
                if (dividersFound > 1) break; 
                continue; 
            }
            days.push(item);
        }
        return days;
    };

    const LoadingState = () => (
        <div className="loading-state-internal" style={{ padding: '2rem', textAlign: 'center', color: 'var(--cor-texto-secundario)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'var(--cor-azul-primario)' }}></i>
            <p style={{ fontSize: '0.9rem' }}>Carregando agenda...</p>
        </div>
    );

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
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Compromissos</h2>
                        <button className="btn-primary" onClick={handleNew}>
                            <i className="fa-solid fa-plus"></i> Adicionar
                        </button>
                    </div>

                    {loading ? (
                        <LoadingState />
                    ) : (
                        <>
                            {data && Object.keys(data.compromissos_por_mes).length > 0 ? (
                                Object.entries(data.compromissos_por_mes).map(([mes, comps]) => (
                                    <div className="month-group" key={mes}>
                                        <h3 className={`month-header ${openMonths[mes] ? 'active' : ''}`} onClick={() => toggleAccordion(mes)}>
                                            {/* Título do Mês (Esquerda) */}
                                            <span className="month-title-text">{mes}</span>
                                            
                                            {/* Info e Ícone (Direita) */}
                                            <div className="month-header-right">
                                                <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.6 }}>
                                                    {comps.length} {comps.length === 1 ? 'COMPROMISSO' : 'COMPROMISSOS'}
                                                </span>
                                                <i className={`fa-solid fa-chevron-down ${openMonths[mes] ? 'rotate' : ''}`}></i>
                                            </div>
                                        </h3>
                                        
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
                        </>
                    )}
                </div>

                <div className="agenda-column">
                    {/* Header do Calendário com Navegação */}
                    <div className="column-header-flex calendar-nav-header">
                        <button className="btn-nav-arrow" onClick={handlePrevMonth}>
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
                        
                        <h2 className="calendar-title-nav">{formatMonthTitle(viewDate)}</h2>
                        
                        <button className="btn-nav-arrow" onClick={handleNextMonth}>
                            <i className="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>

                    {loading ? (
                        <LoadingState />
                    ) : (
                        <div className="dias-grid">
                            {getCurrentMonthDays().map((item, idx) => {
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
                    )}
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