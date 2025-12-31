import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getAgendaDashboard } from '../../services/api';
import { CompromissoCard } from './components/CompromissoCard';
import { AgendaModal } from './components/AgendaModal';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { AiAssistant } from '../../components/AiAssistant'; // [NOVO] Import da IA
import './styles.css';

// --- SUB-COMPONENTES MEMOIZADOS (PERFORMANCE FIX) ---

// 1. Componente de Dia do Calendário (Evita re-render ao passar o mouse)
const CalendarDay = React.memo(({ item, onHover, onLeave }) => {
    let cardClasses = 'dia-card';
    if (item.is_today) cardClasses += ' today';
    if (item.is_padding) cardClasses += ' dia-padding';
    if (!item.is_padding && item.compromissos?.length > 0) cardClasses += ' has-compromissos';

    return (
        <div
            className={cardClasses}
            onMouseEnter={(e) => !item.is_padding && onHover(e, item.compromissos)}
            onMouseLeave={onLeave}
        >
            <span className="dia-numero">{item.day_number}</span>
            <span className="dia-semana">{item.weekday_short}</span>
            <div className={`compromisso-indicator ${item.compromissos?.length > 0 && !item.is_padding ? '' : 'no-event'}`}></div>
        </div>
    );
});

// 2. Componente de Grupo de Mês (Lista Esquerda)
const MonthGroup = React.memo(({ mes, comps, isOpen, onToggle, onUpdate, onEdit }) => {
    return (
        <div className="month-group">
            <h3 className={`month-header ${isOpen ? 'active' : ''}`} onClick={() => onToggle(mes)}>
                <span className="month-title-text">{mes}</span>
                <div className="month-header-right">
                    <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.6 }}>
                        {comps.length} {comps.length === 1 ? 'COMPROMISSO' : 'COMPROMISSOS'}
                    </span>
                    <i className={`fa-solid fa-chevron-down ${isOpen ? 'rotate' : ''}`}></i>
                </div>
            </h3>
            
            <div className={`accordion-wrapper ${isOpen ? 'open' : ''}`}>
                <div className="accordion-inner">
                    <div className="month-content">
                        <div className="compromissos-grid">
                            {comps.map(comp => (
                                <CompromissoCard key={comp.id} comp={comp} onUpdate={onUpdate} onEdit={onEdit} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

// --- COMPONENTE PRINCIPAL ---

export function Agenda() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    
    const [viewDate, setViewDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc'); 

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

    const fetchData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            
            const month = viewDate.getMonth() + 1;
            const year = viewDate.getFullYear();

            const result = await getAgendaDashboard(month, year); 
            setData(result);
            
            if (!silent && result.compromissos_por_mes && Object.keys(result.compromissos_por_mes).length > 0) {
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
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { 
        fetchData(data !== null); 
    }, [viewDate]);

    // [OPTIMIZATION] useCallback garante que a função não seja recriada a cada render
    // Isso permite que o React.memo dos filhos funcione.
    const toggleAccordion = useCallback((key) => {
        setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleNew = () => { setEditingItem(null); setModalOpen(true); };
    const handleEdit = useCallback((item) => { setEditingItem(item); setModalOpen(true); }, []);
    
    // Função para passar para o CompromissoCard (que deve chamar fetchData)
    const handleUpdate = useCallback(() => fetchData(true), [viewDate]); 

    // [OPTIMIZATION] Handlers de Hover otimizados
    const handleDayHover = useCallback((e, compromissos) => {
        if (!compromissos || compromissos.length === 0) return;
        const rect = e.target.getBoundingClientRect();
        setTooltip({
            visible: true,
            x: rect.right + window.scrollX - 280,
            y: rect.bottom + window.scrollY + 5,
            compromissos
        });
    }, []);

    const handleDayLeave = useCallback(() => {
        setTooltip(prev => ({ ...prev, visible: false }));
    }, []);

    const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const formatMonthTitle = (date) => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Memoiza o cálculo dos dias para não rodar a cada tooltip hover
    const currentMonthDays = useMemo(() => {
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
    }, [data]); // Só recalcula se 'data' mudar

    // Memoiza o processamento da lista
    const processedData = useMemo(() => {
        if (!data || !data.compromissos_por_mes) return {};

        const filtered = {};
        Object.entries(data.compromissos_por_mes).forEach(([mes, items]) => {
            const matches = items.filter(item => 
                item.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.local && item.local.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            if (matches.length > 0) filtered[mes] = matches;
        });

        const sortedKeys = Object.keys(filtered);
        if (sortOrder === 'desc') sortedKeys.reverse();

        const sortedObj = {};
        sortedKeys.forEach(key => { sortedObj[key] = filtered[key]; });

        return sortedObj;
    }, [data, searchTerm, sortOrder]);

    const hasData = Object.keys(processedData).length > 0;

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
                    <div className="column-header-flex header-left-aligned">
                        <h2>Compromissos</h2>
                        
                        <div className="header-actions-group">
                            <div className="header-search-wrapper">
                                <i className="fa-solid fa-magnifying-glass header-search-icon"></i>
                                <input 
                                    type="text" 
                                    placeholder="Buscar..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="header-search-input"
                                />
                            </div>

                            <button
                                className="btn-filter-sort"
                                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                title={sortOrder === 'desc' ? "Mais antigos primeiro" : "Mais recentes primeiro"}
                            >
                                <i className={`fa-solid fa-arrow-${sortOrder === 'desc' ? 'up-wide-short' : 'down-wide-short'}`}></i>
                            </button>

                            <button className="btn-primary small-btn" onClick={handleNew}>
                                <i className="fa-solid fa-plus"></i> Adicionar
                            </button>
                        </div>
                    </div>

                    {loading && !data ? (
                        <LoadingState />
                    ) : (
                        <>
                            {hasData ? (
                                Object.entries(processedData).map(([mes, comps]) => (
                                    <MonthGroup 
                                        key={mes}
                                        mes={mes}
                                        comps={comps}
                                        isOpen={!!openMonths[mes]}
                                        onToggle={toggleAccordion}
                                        onUpdate={handleUpdate}
                                        onEdit={handleEdit}
                                    />
                                ))
                            ) : (
                                <p className="empty-list-msg">
                                    {searchTerm ? 'Nenhum compromisso encontrado.' : 'Nenhum compromisso agendado.'}
                                </p>
                            )}
                        </>
                    )}
                </div>

                <div className="agenda-column">
                    <div className="column-header-flex calendar-nav-header">
                        <button className="btn-nav-arrow" onClick={handlePrevMonth}>
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
                        
                        <h2 className="calendar-title-nav">{formatMonthTitle(viewDate)}</h2>
                        
                        <button className="btn-nav-arrow" onClick={handleNextMonth}>
                            <i className="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>

                    <div className="dias-grid">
                        {currentMonthDays.map((item, idx) => (
                            <CalendarDay 
                                key={idx} 
                                item={item} 
                                onHover={handleDayHover} 
                                onLeave={handleDayLeave} 
                            />
                        ))}
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
                onUpdate={() => fetchData(true)}
                editingData={editingItem}
            />

            {/* AI Assistant Integrado (Contexto Roteiro) */}
            <AiAssistant context="roteiro" />
        </div>
    );
}