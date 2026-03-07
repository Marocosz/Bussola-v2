import { useEffect, useState } from 'react';
import { getRegistrosDashboard, deleteGrupo } from '../../services/api';
import { AnotacaoCard } from './components/AnotacaoCard';
import { TarefaCard } from './components/TarefaCard';
import { AnotacaoModal } from './components/AnotacaoModal';
import { TarefaModal } from './components/TarefaModal';
import { GrupoModal } from './components/GrupoModal';
import { ViewAnotacaoModal } from './components/ViewAnotacaoModal';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { AiAssistant } from '../../components/AiAssistant';
import './styles.css';

export function Registros() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Hooks de Contexto
    const { addToast } = useToast();
    const dialogConfirm = useConfirm();

    // UI State - Aba ativa
    const [activeTab, setActiveTab] = useState('caderno');

    // UI State - Modais
    const [notaModalOpen, setNotaModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
    const [grupoModalOpen, setGrupoModalOpen] = useState(false);

    const [editingNota, setEditingNota] = useState(null);
    const [viewingNota, setViewingNota] = useState(null);
    const [editingGrupo, setEditingGrupo] = useState(null);
    const [editingTarefa, setEditingTarefa] = useState(null);

    // UI State - Filtros e Accordions (Caderno)
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [filtroGrupo, setFiltroGrupo] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');

    const [openGroups, setOpenGroups] = useState(() => {
        const savedState = localStorage.getItem('@Bussola:registros_accordions');
        if (savedState) {
            try { return JSON.parse(savedState); } catch (e) { console.error("Erro ao ler localStorage", e); }
        }
        return { 'fixados': true };
    });

    // UI State - Filtros (Tarefas)
    const [prioDropdownOpen, setPrioDropdownOpen] = useState(false);
    const [filtroPrioridade, setFiltroPrioridade] = useState('Todas');
    const [dataDropdownOpen, setDataDropdownOpen] = useState(false);
    const [filtroData, setFiltroData] = useState('Todas');
    const [showConcluidas, setShowConcluidas] = useState(false);

    useEffect(() => {
        localStorage.setItem('@Bussola:registros_accordions', JSON.stringify(openGroups));
    }, [openGroups]);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const result = await getRegistrosDashboard();
            setData(result);
            setError(null);
        } catch (err) {
            console.error("Erro dashboard:", err);
            setError("Não foi possível carregar os registros.");
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao sincronizar dados.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(false); }, []);

    // --- PROCESSAMENTO DE DADOS (ANOTAÇÕES) ---
    const processDataByGroup = () => {
        if (!data) return {};
        const grouped = {};
        let allNotes = [];

        if (data.anotacoes_por_mes) {
            Object.values(data.anotacoes_por_mes).forEach(notesList => {
                if (Array.isArray(notesList)) allNotes = [...allNotes, ...notesList];
            });
        }

        allNotes.forEach(nota => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchTitle = nota.titulo?.toLowerCase().includes(term);
                const rawContent = nota.conteudo?.replace(/<[^>]+>/g, ' ').toLowerCase() || '';
                const matchContent = rawContent.includes(term);
                if (!matchTitle && !matchContent) return;
            }

            const grupoNome = nota.grupo?.nome || 'Indefinido';
            if (filtroGrupo !== 'Todos' && grupoNome !== filtroGrupo) return;
            if (!grouped[grupoNome]) grouped[grupoNome] = [];
            grouped[grupoNome].push(nota);
        });
        return grouped;
    };

    const groupedNotes = data ? processDataByGroup() : {};

    const fixadas = (data?.anotacoes_fixadas || []).filter(nota => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const rawContent = nota.conteudo?.replace(/<[^>]+>/g, ' ').toLowerCase() || '';
        return nota.titulo?.toLowerCase().includes(term) || rawContent.includes(term);
    });

    const fixadasFiltered = filtroGrupo === 'Todos'
        ? fixadas
        : fixadas.filter(n => n.grupo?.nome === filtroGrupo);

    const grupos = data?.grupos_disponiveis || [];

    // --- PROCESSAMENTO DE DADOS (TAREFAS) ---
    const tarefasPendentesRaw = data?.tarefas_pendentes || [];
    const tarefasConcluidasRaw = data?.tarefas_concluidas || [];

    const filterByPrio = (list) => {
        if (filtroPrioridade === 'Todas') return list;
        return list.filter(t => t.prioridade === filtroPrioridade);
    };

    const filterByData = (list) => {
        if (filtroData === 'Todas') return list;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const fimSemana = new Date(hoje);
        fimSemana.setDate(hoje.getDate() + 7);
        return list.filter(t => {
            if (filtroData === 'Sem prazo') return !t.prazo;
            if (!t.prazo) return false;
            const prazo = new Date(t.prazo);
            prazo.setHours(0, 0, 0, 0);
            if (filtroData === 'Hoje') return prazo.getTime() === hoje.getTime();
            if (filtroData === 'Semana') return prazo >= hoje && prazo <= fimSemana;
            if (filtroData === 'Mês') return prazo.getMonth() === hoje.getMonth() && prazo.getFullYear() === hoje.getFullYear();
            if (filtroData === 'Atrasadas') return prazo < hoje;
            return true;
        });
    };

    const tarefasPendentes = filterByData(filterByPrio(tarefasPendentesRaw));
    const tarefasConcluidas = filterByData(filterByPrio(tarefasConcluidasRaw));

    const prioridades = [
        { label: 'Crítica', color: '#ef4444' },
        { label: 'Alta', color: '#f59e0b' },
        { label: 'Média', color: '#3b82f6' },
        { label: 'Baixa', color: '#10b981' }
    ];

    const filtrosData = [
        { label: 'Hoje', icon: 'fa-calendar-day' },
        { label: 'Semana', icon: 'fa-calendar-week' },
        { label: 'Mês', icon: 'fa-calendar' },
        { label: 'Atrasadas', icon: 'fa-triangle-exclamation' },
        { label: 'Sem prazo', icon: 'fa-calendar-xmark' },
    ];

    // --- HANDLERS ---
    const toggleAccordion = (key) => {
        setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleNewNota = () => { setEditingNota(null); setNotaModalOpen(true); };
    const handleEditNota = (nota) => { setEditingNota(nota); setNotaModalOpen(true); };

    const handleViewNota = (nota) => {
        setViewingNota(nota);
        setViewModalOpen(true);
    };

    const handleNewTarefa = () => {
        setEditingTarefa(null);
        setTarefaModalOpen(true);
    };

    const handleEditTarefa = (tarefa) => {
        setEditingTarefa(tarefa);
        setTarefaModalOpen(true);
    };

    const handleNewGrupo = () => {
        setEditingGrupo(null);
        setGrupoModalOpen(true);
        setDropdownOpen(false);
    };

    const handleEditGrupo = (grupo, e) => {
        e.stopPropagation();
        setEditingGrupo(grupo);
        setGrupoModalOpen(true);
        setDropdownOpen(false);
    };

    const handleDeleteGrupo = async (grupoId, e) => {
        e.stopPropagation();

        const isConfirmed = await dialogConfirm({
            title: 'Excluir Grupo?',
            description: 'Todas as anotações deste grupo serão movidas para "Indefinido". Esta ação não pode ser desfeita.',
            confirmLabel: 'Sim, excluir',
            variant: 'danger'
        });

        if (!isConfirmed) return;

        try {
            await deleteGrupo(grupoId);
            addToast({
                type: 'success',
                title: 'Grupo excluído',
                description: 'O grupo foi removido com sucesso.'
            });
            if (filtroGrupo !== 'Todos') setFiltroGrupo('Todos');
            fetchData(true);
        } catch (error) {
            console.error(error);
            addToast({
                type: 'error',
                title: 'Erro',
                description: 'Não foi possível excluir o grupo.'
            });
        }
    };

    const LoadingState = () => (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--cor-texto-secundario)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'var(--cor-azul-primario)' }}></i>
            <p style={{ fontSize: '0.9rem' }}>Carregando registros...</p>
        </div>
    );

    if (error) return (
        <div className="container" style={{ paddingTop: '100px', textAlign: 'center', color: 'var(--cor-vermelho-delete)' }}>
            <p>{error}</p>
            <button className="btn-secondary" onClick={() => fetchData(false)}>Tentar Novamente</button>
        </div>
    );

    if (!data && !loading) return null;

    return (
        <div className="container main-container registros-scope">

            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Caderno & Tarefas</h1>
                    <p>Organize suas ideias por grupos e gerencie suas pendências.</p>
                </div>
            </div>

            <div className="registros-wrapper">

                {/* HEADER ÚNICO COM ABAS */}
                <div className="column-header-flex registros-main-header">
                    <div className="tab-selector-wrapper">
                        <button
                            className={`tab-btn-pill ${activeTab === 'caderno' ? 'active' : ''}`}
                            onClick={() => setActiveTab('caderno')}
                        >
                            Caderno
                        </button>
                        <button
                            className={`tab-btn-pill ${activeTab === 'tarefas' ? 'active' : ''}`}
                            onClick={() => setActiveTab('tarefas')}
                        >
                            Tarefas
                        </button>
                    </div>

                    {/* Ações do Caderno */}
                    {activeTab === 'caderno' && (
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

                            <div className="custom-dropdown-wrapper">
                                <button
                                    className={`dropdown-trigger-btn ${filtroGrupo !== 'Todos' ? 'active' : ''}`}
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    disabled={loading}
                                >
                                    <span>{filtroGrupo === 'Todos' ? 'Todos os Grupos' : filtroGrupo}</span>
                                    <i className="fa-solid fa-chevron-down"></i>
                                </button>

                                {dropdownOpen && (
                                    <>
                                        <div className="dropdown-backdrop" onClick={() => setDropdownOpen(false)}></div>
                                        <div className="custom-dropdown-menu">
                                            <div className="dropdown-action-row" onClick={handleNewGrupo}>
                                                <div className="action-icon-circle"><i className="fa-solid fa-plus"></i></div>
                                                <span>Criar Novo Grupo</span>
                                            </div>
                                            <div className="dropdown-divider"></div>
                                            <div className={`dropdown-item ${filtroGrupo === 'Todos' ? 'selected' : ''}`} onClick={() => { setFiltroGrupo('Todos'); setDropdownOpen(false); }}>
                                                <span>Todos os Grupos</span>
                                            </div>
                                            <div className="dropdown-scroll-area">
                                                {grupos.map(g => (
                                                    <div key={g.id} className={`dropdown-item ${filtroGrupo === g.nome ? 'selected' : ''}`} onClick={() => { setFiltroGrupo(g.nome); setDropdownOpen(false); }}>
                                                        <div className="dropdown-item-info">
                                                            <span className="dot" style={{ backgroundColor: g.cor }}></span>
                                                            <span className="name">{g.nome}</span>
                                                        </div>
                                                        <div className="dropdown-item-actions">
                                                            <button className="btn-action-icon btn-edit" onClick={(e) => handleEditGrupo(g, e)}><i className="fa-solid fa-pen-to-square"></i></button>
                                                            <button className="btn-action-icon btn-delete" onClick={(e) => handleDeleteGrupo(g.id, e)}><i className="fa-solid fa-trash-can"></i></button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className={`dropdown-item ${filtroGrupo === 'Indefinido' ? 'selected' : ''}`} onClick={() => { setFiltroGrupo('Indefinido'); setDropdownOpen(false); }}>
                                                    <div className="dropdown-item-info"><span className="dot" style={{ backgroundColor: '#ccc' }}></span><span className="name">Indefinido</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button className="btn-primary small-btn" onClick={handleNewNota}>
                                <i className="fa-solid fa-plus"></i> Nota
                            </button>
                        </div>
                    )}

                    {/* Ações das Tarefas */}
                    {activeTab === 'tarefas' && (
                        <div className="header-actions-group">
                            {/* Filtro de Data */}
                            <div className="custom-dropdown-wrapper">
                                <button
                                    className={`dropdown-trigger-btn ${filtroData !== 'Todas' ? 'active' : ''}`}
                                    onClick={() => { setDataDropdownOpen(!dataDropdownOpen); setPrioDropdownOpen(false); }}
                                    style={{ minWidth: '130px' }}
                                    disabled={loading}
                                >
                                    <i className="fa-regular fa-calendar" style={{ fontSize: '0.8rem' }}></i>
                                    <span>{filtroData === 'Todas' ? 'Período' : filtroData}</span>
                                    <i className="fa-solid fa-chevron-down"></i>
                                </button>

                                {dataDropdownOpen && (
                                    <>
                                        <div className="dropdown-backdrop" onClick={() => setDataDropdownOpen(false)}></div>
                                        <div className="custom-dropdown-menu" style={{ width: '200px' }}>
                                            <div className={`dropdown-item ${filtroData === 'Todas' ? 'selected' : ''}`} onClick={() => { setFiltroData('Todas'); setDataDropdownOpen(false); }}>
                                                <div className="dropdown-item-info">
                                                    <i className="fa-regular fa-calendar-check" style={{ width: '14px', color: 'var(--cor-texto-secundario)' }}></i>
                                                    <span className="name">Todas as datas</span>
                                                </div>
                                            </div>
                                            <div className="dropdown-divider"></div>
                                            {filtrosData.map(f => (
                                                <div key={f.label} className={`dropdown-item ${filtroData === f.label ? 'selected' : ''}`} onClick={() => { setFiltroData(f.label); setDataDropdownOpen(false); }}>
                                                    <div className="dropdown-item-info">
                                                        <i className={`fa-solid ${f.icon}`} style={{ width: '14px', color: f.label === 'Atrasadas' ? 'var(--cor-vermelho-delete)' : 'var(--cor-texto-secundario)', fontSize: '0.8rem' }}></i>
                                                        <span className="name">{f.label}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Filtro de Prioridade */}
                            <div className="custom-dropdown-wrapper">
                                <button
                                    className={`dropdown-trigger-btn ${filtroPrioridade !== 'Todas' ? 'active' : ''}`}
                                    onClick={() => { setPrioDropdownOpen(!prioDropdownOpen); setDataDropdownOpen(false); }}
                                    style={{ minWidth: '130px' }}
                                    disabled={loading}
                                >
                                    <span>{filtroPrioridade === 'Todas' ? 'Prioridade' : filtroPrioridade}</span>
                                    <i className="fa-solid fa-chevron-down"></i>
                                </button>

                                {prioDropdownOpen && (
                                    <>
                                        <div className="dropdown-backdrop" onClick={() => setPrioDropdownOpen(false)}></div>
                                        <div className="custom-dropdown-menu" style={{ width: '200px' }}>
                                            <div className={`dropdown-item ${filtroPrioridade === 'Todas' ? 'selected' : ''}`} onClick={() => { setFiltroPrioridade('Todas'); setPrioDropdownOpen(false); }}>
                                                <span>Todas as prioridades</span>
                                            </div>
                                            <div className="dropdown-divider"></div>
                                            {prioridades.map(p => (
                                                <div key={p.label} className={`dropdown-item ${filtroPrioridade === p.label ? 'selected' : ''}`} onClick={() => { setFiltroPrioridade(p.label); setPrioDropdownOpen(false); }}>
                                                    <div className="dropdown-item-info">
                                                        <span className="dot" style={{ backgroundColor: p.color }}></span>
                                                        <span className="name">{p.label}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <button className="btn-primary small-btn" onClick={handleNewTarefa}>
                                <i className="fa-solid fa-plus"></i> Tarefa
                            </button>
                        </div>
                    )}
                </div>

                {/* CONTEÚDO: CADERNO */}
                {activeTab === 'caderno' && (
                    <div className="column-scroll-content">
                        {loading ? (
                            <LoadingState />
                        ) : (
                            <>
                                {fixadasFiltered.length > 0 && (
                                    <div className="group-accordion">
                                        <h3 className={`accordion-header pinned-header ${openGroups['fixados'] ? 'active' : ''}`} onClick={() => toggleAccordion('fixados')}>
                                            <div className="header-title-wrapper">
                                                <span><i className="fa-solid fa-thumbtack"></i> Fixados</span>
                                            </div>
                                            <div className="header-meta">
                                                <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.6 }}>{fixadasFiltered.length} {fixadasFiltered.length === 1 ? 'NOTA' : 'NOTAS'}</span>
                                                <i className={`fa-solid fa-chevron-down ${openGroups['fixados'] ? 'rotate' : ''}`}></i>
                                            </div>
                                        </h3>

                                        <div className={`accordion-wrapper ${openGroups['fixados'] ? 'open' : ''}`}>
                                            <div className="accordion-inner">
                                                <div className="accordion-content-padding">
                                                    <div className="notes-grid">
                                                        {fixadasFiltered.map(n => (
                                                            <AnotacaoCard
                                                                key={n.id}
                                                                anotacao={n}
                                                                onUpdate={() => fetchData(true)}
                                                                onEdit={handleEditNota}
                                                                onView={handleViewNota}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {Object.entries(groupedNotes).map(([grupoNome, notas]) => {
                                    const isOpen = !!openGroups[grupoNome];
                                    const grpObj = grupos.find(g => g.nome === grupoNome);
                                    const grpColor = grpObj ? grpObj.cor : '#999';

                                    return (
                                        <div className="group-accordion" key={grupoNome}>
                                            <h3 className={`accordion-header ${isOpen ? 'active' : ''}`} onClick={() => toggleAccordion(grupoNome)}>
                                                <div className="header-title-wrapper">
                                                    <span className="grp-dot" style={{ backgroundColor: grpColor }}></span>
                                                    <span>{grupoNome}</span>
                                                </div>
                                                <div className="header-meta">
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.6 }}>{notas.length} {notas.length === 1 ? 'NOTA' : 'NOTAS'}</span>
                                                    <i className={`fa-solid fa-chevron-down ${isOpen ? 'rotate' : ''}`}></i>
                                                </div>
                                            </h3>

                                            <div className={`accordion-wrapper ${isOpen ? 'open' : ''}`}>
                                                <div className="accordion-inner">
                                                    <div className="accordion-content-padding">
                                                        <div className="notes-grid">
                                                            {notas.map(n => (
                                                                <AnotacaoCard
                                                                    key={n.id}
                                                                    anotacao={n}
                                                                    onUpdate={() => fetchData(true)}
                                                                    onEdit={handleEditNota}
                                                                    onView={handleViewNota}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {fixadasFiltered.length === 0 && Object.keys(groupedNotes).length === 0 && (
                                    <div className="empty-state">
                                        <i className="fa-regular fa-folder-open"></i>
                                        <p>{searchTerm ? 'Nenhuma anotação encontrada.' : 'Nenhuma anotação neste grupo.'}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* CONTEÚDO: TAREFAS */}
                {activeTab === 'tarefas' && (
                    <div className="column-scroll-content">
                        {loading ? (
                            <LoadingState />
                        ) : (
                            <>
                                {tarefasPendentes.length === 0 && tarefasConcluidas.length === 0 ? (
                                    <div className="empty-state">
                                        <i className="fa-solid fa-check-double"></i>
                                        <p>Nenhuma tarefa pendente.</p>
                                    </div>
                                ) : (
                                    <div className="tarefas-grid">
                                        {tarefasPendentes.map(t => (
                                            <TarefaCard
                                                key={t.id}
                                                tarefa={t}
                                                onUpdate={() => fetchData(true)}
                                                onEdit={handleEditTarefa}
                                            />
                                        ))}
                                    </div>
                                )}

                                {tarefasConcluidasRaw.length > 0 && (
                                    <div className="concluidas-section">
                                        <div
                                            className={`concluidas-header-accordion ${showConcluidas ? 'active' : ''}`}
                                            onClick={() => setShowConcluidas(!showConcluidas)}
                                        >
                                            <span>Concluídas ({tarefasConcluidas.length})</span>
                                            <i className={`fa-solid fa-chevron-down ${showConcluidas ? 'rotate' : ''}`}></i>
                                        </div>

                                        <div className={`accordion-wrapper ${showConcluidas ? 'open' : ''}`}>
                                            <div className="accordion-inner">
                                                <div className="concluidas-content-wrapper" style={{ paddingTop: '10px' }}>
                                                    <div className="tarefas-grid completed">
                                                        {tarefasConcluidas.map(t => (
                                                            <TarefaCard
                                                                key={t.id}
                                                                tarefa={t}
                                                                onUpdate={() => fetchData(true)}
                                                                onEdit={handleEditTarefa}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* MODAIS */}
            <AnotacaoModal active={notaModalOpen} closeModal={() => setNotaModalOpen(false)} onUpdate={() => fetchData(true)} editingData={editingNota} gruposDisponiveis={grupos} />
            <TarefaModal active={tarefaModalOpen} closeModal={() => setTarefaModalOpen(false)} onUpdate={() => fetchData(true)} editingData={editingTarefa} />
            <GrupoModal
                active={grupoModalOpen}
                closeModal={() => setGrupoModalOpen(false)}
                onUpdate={() => fetchData(true)}
                editingData={editingGrupo}
                existingGroups={grupos}
            />
            <ViewAnotacaoModal active={viewModalOpen} closeModal={() => setViewModalOpen(false)} nota={viewingNota} onEdit={handleEditNota} />

            <AiAssistant context="registros" />
        </div>
    );
}