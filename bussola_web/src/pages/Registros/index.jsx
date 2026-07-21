import { useEffect, useState, useMemo, useCallback } from 'react';
import { getRegistrosDashboard, deleteGrupo } from '../../services/api';

// ── Helpers de Jornada ──────────────────────────────────────────────────────
function getTodayKey() {
    const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    return dias[new Date().getDay()];
}
function calcularProgressoJornada(habitos) {
    const hoje = getTodayKey();
    const ativos = habitos.filter(h => h.status === 'ativo' && h.frequencia.includes(hoje));
    if (!ativos.length) return { pct: 0, mensagem: 'Comece sua jornada!' };
    const feitos = ativos.filter(h => h.registro_hoje?.concluido).length;
    const pct = Math.round((feitos / ativos.length) * 100);
    const mensagem = pct === 0 ? 'Comece sua jornada!'
        : pct < 25 ? 'Você está começando.'
        : pct < 50 ? 'Siga em frente!'
        : pct < 75 ? 'Mais da metade. Bora!'
        : pct < 100 ? 'Quase lá, não pare!'
        : 'Jornada completa! 🎉';
    return { pct, mensagem };
}
function formatarDataJornada() {
    const d = new Date();
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${diasSemana[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}
// ────────────────────────────────────────────────────────────────────────────
import { AnotacaoCard } from './components/AnotacaoCard';
import { AnotacaoModal } from './components/AnotacaoModal';
import { TarefaBoard } from './components/kanban/TarefaBoard';
import { GrupoModal } from './components/GrupoModal';
import { ViewAnotacaoModal } from './components/ViewAnotacaoModal';
import { HabitoModal } from './components/HabitoModal';
import { HabitoListaModal } from './components/HabitoListaModal';
import { JornadaTimeline } from './components/JornadaTimeline';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { AiAssistant } from '../../components/AiAssistant';
import './styles.css';
import { logger } from '../../utils/logger';

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
    const [grupoModalOpen, setGrupoModalOpen] = useState(false);
    const [habitoModalOpen, setHabitoModalOpen] = useState(false);
    const [habitoListaModalOpen, setHabitoListaModalOpen] = useState(false);

    const [editingNota, setEditingNota] = useState(null);
    const [viewingNota, setViewingNota] = useState(null);
    const [editingGrupo, setEditingGrupo] = useState(null);
    const [editingHabito, setEditingHabito] = useState(null);

    // UI State - Filtros e Accordions (Caderno)
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [filtroGrupo, setFiltroGrupo] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');

    const [openGroups, setOpenGroups] = useState(() => {
        const savedState = localStorage.getItem('@Bussola:registros_accordions');
        if (savedState) {
            try { return JSON.parse(savedState); } catch (e) { logger.error("Erro ao ler localStorage", { error: String(e) }); }
        }
        return { 'fixados': true };
    });

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
            logger.error("Erro no dashboard", { error: String(err) });
            setError("Não foi possível carregar os registros.");
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao sincronizar dados.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(false); }, []);

    // --- PROCESSAMENTO DE DADOS (ANOTAÇÕES) ---
    const groupedNotes = useMemo(() => {
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
    }, [data, searchTerm, filtroGrupo]);

    const fixadasFiltered = useMemo(() => {
        const fixadas = (data?.anotacoes_fixadas || []).filter(nota => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            const rawContent = nota.conteudo?.replace(/<[^>]+>/g, ' ').toLowerCase() || '';
            return nota.titulo?.toLowerCase().includes(term) || rawContent.includes(term);
        });
        return filtroGrupo === 'Todos'
            ? fixadas
            : fixadas.filter(n => n.grupo?.nome === filtroGrupo);
    }, [data, searchTerm, filtroGrupo]);

    const grupos = data?.grupos_disponiveis || [];

    // --- HANDLERS ---
    const handleSilentRefresh = useCallback(() => fetchData(true), []);

    const toggleAccordion = useCallback((key) => {
        setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleNewNota = useCallback(() => { setEditingNota(null); setNotaModalOpen(true); }, []);
    const handleEditNota = useCallback((nota) => { setEditingNota(nota); setNotaModalOpen(true); }, []);

    const handleViewNota = useCallback((nota) => {
        setViewingNota(nota);
        setViewModalOpen(true);
    }, []);

    const handleNewHabito = useCallback(() => { setEditingHabito(null); setHabitoModalOpen(true); }, []);
    const handleEditHabito = useCallback((habito) => { setEditingHabito(habito); setHabitoModalOpen(true); }, []);
    const handleEditHabitoFromLista = useCallback((habito) => {
        setHabitoListaModalOpen(false);
        setEditingHabito(habito);
        setHabitoModalOpen(true);
    }, []);

    const handleNewGrupo = useCallback(() => {
        setEditingGrupo(null);
        setGrupoModalOpen(true);
        setDropdownOpen(false);
    }, []);

    const handleEditGrupo = useCallback((grupo, e) => {
        e.stopPropagation();
        setEditingGrupo(grupo);
        setGrupoModalOpen(true);
        setDropdownOpen(false);
    }, []);

    const handleDeleteGrupo = useCallback(async (grupoId, e) => {
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
            logger.error("Erro inesperado", { error: String(error) });
            addToast({
                type: 'error',
                title: 'Erro',
                description: 'Não foi possível excluir o grupo.'
            });
        }
    }, [dialogConfirm, addToast, filtroGrupo]);

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

            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-book-open"></i> Caderno & Tarefas</h1>
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
                        <button
                            className={`tab-btn-pill ${activeTab === 'jornada' ? 'active' : ''}`}
                            onClick={() => setActiveTab('jornada')}
                        >
                            Jornada
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

                    {/* Ações da Jornada */}
                    {activeTab === 'jornada' && (() => {
                        const habitos = data?.habitos || [];
                        const { mensagem } = habitos.length ? calcularProgressoJornada(habitos) : { mensagem: '' };
                        return (
                            <div className="header-actions-group jk-header-info-group">
                                {habitos.length > 0 && (
                                    <div className="jk-header-date-msg">
                                        <span className="jk-header-date">
                                            <i className="fa-regular fa-calendar-days"></i>
                                            {formatarDataJornada()}
                                        </span>
                                        <span className="jk-header-date-sep"></span>
                                        <span className="jk-header-msg">{mensagem}</span>
                                    </div>
                                )}
                                <button
                                    className="btn-secondary small-btn"
                                    onClick={() => setHabitoListaModalOpen(true)}
                                    title="Ver todos os hábitos"
                                >
                                    <i className="fa-solid fa-list-ul"></i> Lista
                                </button>
                                <button className="btn-primary small-btn" onClick={handleNewHabito}>
                                    <i className="fa-solid fa-plus"></i> Hábito
                                </button>
                            </div>
                        );
                    })()}

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
                                                                onUpdate={handleSilentRefresh}
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
                                                                    onUpdate={handleSilentRefresh}
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

                {/* CONTEÚDO: TAREFAS (Board Kanban) */}
                {activeTab === 'tarefas' && (
                    <div className="column-scroll-content" style={{ display: 'flex', flexDirection: 'column' }}>
                        <TarefaBoard />
                    </div>
                )}

                {/* CONTEÚDO: JORNADA */}
                {activeTab === 'jornada' && (
                    <div className="column-scroll-content">
                        {loading ? (
                            <LoadingState />
                        ) : (
                            <JornadaTimeline
                                habitos={data?.habitos || []}
                                onUpdate={handleSilentRefresh}
                                onEdit={handleEditHabito}
                            />
                        )}
                    </div>
                )}

            </div>

            {/* MODAIS */}
            <AnotacaoModal active={notaModalOpen} closeModal={() => setNotaModalOpen(false)} onUpdate={handleSilentRefresh} editingData={editingNota} gruposDisponiveis={grupos} />
            <GrupoModal
                active={grupoModalOpen}
                closeModal={() => setGrupoModalOpen(false)}
                onUpdate={handleSilentRefresh}
                editingData={editingGrupo}
                existingGroups={grupos}
            />
            <ViewAnotacaoModal active={viewModalOpen} closeModal={() => setViewModalOpen(false)} nota={viewingNota} onEdit={handleEditNota} />
            <HabitoModal active={habitoModalOpen} closeModal={() => setHabitoModalOpen(false)} onUpdate={handleSilentRefresh} editingData={editingHabito} />
            <HabitoListaModal
                active={habitoListaModalOpen}
                closeModal={() => setHabitoListaModalOpen(false)}
                habitos={data?.habitos || []}
                onEdit={handleEditHabitoFromLista}
                onUpdate={handleSilentRefresh}
            />

            <AiAssistant context="registros" />
        </div>
    );
}