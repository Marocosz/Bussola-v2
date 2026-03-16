import React, { useEffect, useState, useRef } from 'react';
import { getFinancasDashboard, deleteCategoria } from '../../services/api';
import { TransactionCard } from './components/TransactionCard';
import { CategoryCard } from './components/CategoryCard';
import { FinancasModals } from './components/FinancasModals';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { AiAssistant } from '../../components/AiAssistant';
import { DatePicker } from '../../components/Pickers';
import { CustomSelect } from '../../components/CustomSelect';
import './styles.css';

export function Financas() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const { addToast } = useToast();
    const dialogConfirm = useConfirm();

    // Accordions das categorias
    const [openMonths, setOpenMonths] = useState(() => {
        try {
            const saved = localStorage.getItem('bussola_financas_accordions');
            return saved ? JSON.parse(saved) : { 'resumo-despesas': true, 'resumo-receitas': true };
        } catch (e) {
            return { 'resumo-despesas': true, 'resumo-receitas': true };
        }
    });

    const [activeModal, setActiveModal] = useState(null);
    const [editingData, setEditingData] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);

    const [orderTransacoes, setOrderTransacoes] = useState(() => {
        return localStorage.getItem('bussola_financas_order') || 'desc';
    });

    const [filterTipo, setFilterTipo] = useState('todos');
    const [filterStatus, setFilterStatus] = useState('todos');
    const [filterCategoria, setFilterCategoria] = useState(null);
    const [filterDatePreset, setFilterDatePreset] = useState('todos');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [openFilterDropdown, setOpenFilterDropdown] = useState(null);

    const PAGE_SIZE = 50;
    const [currentPage, setCurrentPage] = useState(1);

    const dropdownRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('bussola_financas_accordions', JSON.stringify(openMonths));
    }, [openMonths]);

    useEffect(() => {
        localStorage.setItem('bussola_financas_order', orderTransacoes);
    }, [orderTransacoes]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownRef]);

    const fetchData = async () => {
        try {
            const result = await getFinancasDashboard();
            if (result && typeof result === 'object') {
                setData(result);
            } else {
                setData({
                    transacoes_pontuais: {},
                    transacoes_recorrentes: {},
                    categorias_despesa: [],
                    categorias_receita: [],
                    icones_disponiveis: [],
                    cores_disponiveis: []
                });
            }
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar dados financeiros.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleAccordion = (key) => {
        setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleToggleExpand = (grupoId) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(grupoId)) next.delete(grupoId);
            else next.add(grupoId);
            return next;
        });
    };

    // Achata, filtra, agrupa parceladas e ordena todas as transações
    const getAllTransactions = () => {
        if (!data) return [];
        const pontuais = Object.values(data.transacoes_pontuais || {}).flat();
        const recorrentes = Object.values(data.transacoes_recorrentes || {}).flat();
        let all = [...pontuais, ...recorrentes];

        if (filterTipo !== 'todos') {
            all = all.filter(t => (t.tipo_recorrencia || 'pontual') === filterTipo);
        }
        if (filterStatus !== 'todos') {
            all = all.filter(t => {
                // Pontual é sempre Efetivada por regra de negócio
                if ((t.tipo_recorrencia || 'pontual') === 'pontual') return filterStatus === 'Efetivada';
                return t.status === filterStatus;
            });
        }
        if (filterCategoria) {
            all = all.filter(t => t.categoria?.id === filterCategoria);
        }

        // Filtro de data
        if (filterDatePreset !== 'todos') {
            const today = new Date();
            let start = null, end = null;
            if (filterDatePreset === 'semana') {
                start = new Date(today); start.setDate(today.getDate() - 6); start.setHours(0,0,0,0);
                end = new Date(today); end.setHours(23,59,59,999);
            } else if (filterDatePreset === 'mes') {
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            } else if (filterDatePreset === 'custom') {
                start = filterDateStart ? new Date(filterDateStart + 'T00:00:00') : null;
                end = filterDateEnd ? new Date(filterDateEnd + 'T23:59:59') : null;
            }
            if (start || end) {
                all = all.filter(t => {
                    const d = new Date(t.data);
                    if (start && d < start) return false;
                    if (end && d > end) return false;
                    return true;
                });
            }
        }

        // Agrupa parceladas e recorrentes pelo id_grupo_recorrencia
        const groups = {};
        const others = [];
        for (const t of all) {
            if ((t.tipo_recorrencia === 'parcelada' || t.tipo_recorrencia === 'recorrente') && t.id_grupo_recorrencia) {
                if (!groups[t.id_grupo_recorrencia]) groups[t.id_grupo_recorrencia] = [];
                groups[t.id_grupo_recorrencia].push(t);
            } else {
                others.push(t);
            }
        }

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const representatives = Object.values(groups).map(items => {
            const tipoGrupo = items[0].tipo_recorrencia;
            items.sort((a, b) => new Date(a.data) - new Date(b.data));

            const currentMonthItem = items.find(p => {
                const d = new Date(p.data);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            });

            let rep, expandItems;
            if (tipoGrupo === 'parcelada') {
                rep = currentMonthItem || items.find(p => p.status === 'Pendente') || items[items.length - 1];
                expandItems = items;
            } else {
                // recorrente: só histórico (passado + atual), sem futuras
                const history = items.filter(t => new Date(t.data) <= today);
                rep = currentMonthItem || (history.length > 0 ? history[history.length - 1] : items[items.length - 1]);
                expandItems = [...history].sort((a, b) => new Date(b.data) - new Date(a.data));
            }

            return { ...rep, _allParcelas: expandItems };
        });

        return [...others, ...representatives].sort((a, b) => {
            const dateA = new Date(a.data);
            const dateB = new Date(b.data);
            return orderTransacoes === 'desc' ? dateB - dateA : dateA - dateB;
        });
    };

    const handleEditTransaction = (transacao) => {
        setEditingData(transacao);
        setActiveModal(transacao.tipo_recorrencia || 'pontual');
    };

    const handleEditCategory = (categoria) => {
        setEditingData(categoria);
        setActiveModal('category');
    };

    const handleDeleteCategory = async (id) => {
        const isConfirmed = await dialogConfirm({
            title: 'Excluir Categoria?',
            description: 'Todas as transações vinculadas a esta categoria serão movidas para "Indefinida". Esta ação não pode ser desfeita.',
            confirmLabel: 'Sim, excluir',
            variant: 'danger'
        });
        if (!isConfirmed) return;

        try {
            await deleteCategoria(id);
            addToast({ type: 'success', title: 'Sucesso', description: 'Categoria removida e transações migradas.' });
            fetchData();
        } catch (error) {
            const msg = error.response?.data?.detail || 'Erro ao excluir categoria.';
            addToast({ type: 'error', title: 'Erro', description: msg });
        }
    };

    const handleCloseModal = () => {
        setActiveModal(null);
        setEditingData(null);
    };

    const allTransactions = getAllTransactions();
    const totalPages = Math.ceil(allTransactions.length / PAGE_SIZE);
    const pagedTransactions = allTransactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const LoadingState = () => (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--cor-texto-secundario)', gridColumn: '1/-1' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'var(--cor-azul-primario)' }}></i>
            <p style={{ fontSize: '0.9rem' }}>Carregando dados financeiros...</p>
        </div>
    );

    return (
        <div className="container main-container financas-scope">
            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Provisões Financeiras</h1>
                    <p>Controle total sobre suas entradas, saídas e planejamento.</p>
                </div>
            </div>

            <div className="layout-grid-custom">

                {/* --- COLUNA 1: TODAS AS TRANSAÇÕES --- */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Transações</h2>
                        <div className="header-actions-group">

                            {/* Filtro: Tipo */}
                            <div className="filter-dropdown-wrapper">
                                <button
                                    className={`filter-trigger-btn ${filterTipo !== 'todos' ? 'active' : ''}`}
                                    onClick={() => setOpenFilterDropdown(openFilterDropdown === 'tipo' ? null : 'tipo')}
                                    disabled={loading}
                                >
                                    <span>{filterTipo === 'todos' ? 'Tipo' : filterTipo.charAt(0).toUpperCase() + filterTipo.slice(1)}</span>
                                    <i className="fa-solid fa-chevron-down"></i>
                                </button>
                                {openFilterDropdown === 'tipo' && (
                                    <>
                                        <div className="filter-backdrop" onClick={() => setOpenFilterDropdown(null)}></div>
                                        <div className="filter-dropdown-menu">
                                            {[['todos','Todos'],['pontual','Pontual'],['parcelada','Parcelada'],['recorrente','Recorrente']].map(([val, label]) => (
                                                <div key={val} className={`filter-dropdown-item ${filterTipo === val ? 'selected' : ''}`} onClick={() => { setFilterTipo(val); setCurrentPage(1); setOpenFilterDropdown(null); }}>{label}</div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Filtro: Status */}
                            <div className="filter-dropdown-wrapper">
                                <button
                                    className={`filter-trigger-btn ${filterStatus !== 'todos' ? 'active' : ''}`}
                                    onClick={() => setOpenFilterDropdown(openFilterDropdown === 'status' ? null : 'status')}
                                    disabled={loading}
                                >
                                    <span>{filterStatus === 'todos' ? 'Status' : filterStatus}</span>
                                    <i className="fa-solid fa-chevron-down"></i>
                                </button>
                                {openFilterDropdown === 'status' && (
                                    <>
                                        <div className="filter-backdrop" onClick={() => setOpenFilterDropdown(null)}></div>
                                        <div className="filter-dropdown-menu">
                                            {[['todos','Todos'],['Pendente','Pendente'],['Efetivada','Efetivada']].map(([val, label]) => (
                                                <div key={val} className={`filter-dropdown-item ${filterStatus === val ? 'selected' : ''}`} onClick={() => { setFilterStatus(val); setCurrentPage(1); setOpenFilterDropdown(null); }}>{label}</div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Filtro: Categoria */}
                            {data && (
                                <div className="filter-dropdown-wrapper filter-categoria-cs">
                                    <CustomSelect
                                        name="filterCategoria"
                                        value={filterCategoria === null ? '' : filterCategoria}
                                        options={[
                                            { value: '', label: 'Categoria' },
                                            ...(data.categorias_despesa || []).map(c => ({ value: c.id, label: c.nome, icon: c.icone, color: c.cor, type: 'Despesa' })),
                                            ...(data.categorias_receita || []).map(c => ({ value: c.id, label: c.nome, icon: c.icone, color: c.cor, type: 'Receita' })),
                                        ]}
                                        onChange={e => { setFilterCategoria(e.target.value === '' ? null : Number(e.target.value)); setCurrentPage(1); }}
                                        placeholder="Categoria"
                                    />
                                </div>
                            )}

                            {/* Filtro: Data */}
                            <div className="filter-dropdown-wrapper">
                                <button
                                    className={`filter-trigger-btn ${filterDatePreset !== 'todos' ? 'active' : ''}`}
                                    onClick={() => setOpenFilterDropdown(openFilterDropdown === 'data' ? null : 'data')}
                                    disabled={loading}
                                >
                                    <span>{filterDatePreset === 'todos' ? 'Data' : filterDatePreset === 'semana' ? 'Esta semana' : filterDatePreset === 'mes' ? 'Este mês' : 'Personalizado'}</span>
                                    <i className="fa-solid fa-chevron-down"></i>
                                </button>
                                {openFilterDropdown === 'data' && (
                                    <>
                                        <div className="filter-backdrop" onClick={() => setOpenFilterDropdown(null)}></div>
                                        <div className="filter-dropdown-menu">
                                            {[['todos','Tudo'],['semana','Esta semana'],['mes','Este mês'],['custom','Personalizado']].map(([val, label]) => (
                                                <div key={val} className={`filter-dropdown-item ${filterDatePreset === val ? 'selected' : ''}`} onClick={() => { setFilterDatePreset(val); setCurrentPage(1); if (val !== 'custom') setOpenFilterDropdown(null); }}>{label}</div>
                                            ))}
                                            {filterDatePreset === 'custom' && (
                                                <div className="filter-date-range">
                                                    <DatePicker
                                                        size="sm"
                                                        value={filterDateStart}
                                                        onChange={e => { setFilterDateStart(e.target.value); setCurrentPage(1); }}
                                                        placeholder="Início"
                                                    />
                                                    <span style={{ color: 'var(--cor-texto-secundario)', flexShrink: 0 }}>—</span>
                                                    <DatePicker
                                                        size="sm"
                                                        value={filterDateEnd}
                                                        onChange={e => { setFilterDateEnd(e.target.value); setCurrentPage(1); }}
                                                        placeholder="Fim"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                className="btn-filter-sort"
                                onClick={() => { setOrderTransacoes(prev => prev === 'desc' ? 'asc' : 'desc'); setCurrentPage(1); }}
                                title={orderTransacoes === 'desc' ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}
                                disabled={loading}
                            >
                                <i className={`fa-solid fa-arrow-${orderTransacoes === 'desc' ? 'down-wide-short' : 'up-wide-short'}`}></i>
                            </button>

                            <div className="btn-group" style={{ position: 'relative' }} ref={dropdownRef}>
                                <button className="btn-primary" onClick={() => setShowDropdown(!showDropdown)}>
                                    <i className="fa-solid fa-plus"></i> Adicionar
                                </button>
                                {showDropdown && (
                                    <div className="dropdown-menu visible" style={{ display: 'block' }}>
                                        <a onClick={() => { setEditingData(null); setActiveModal('pontual'); setShowDropdown(false); }}>
                                            <i className="fa-solid fa-circle-dot" style={{ marginRight: '8px', opacity: 0.6 }}></i>Pontual
                                        </a>
                                        <a onClick={() => { setEditingData(null); setActiveModal('parcelada'); setShowDropdown(false); }}>
                                            <i className="fa-solid fa-layer-group" style={{ marginRight: '8px', opacity: 0.6 }}></i>Parcelada
                                        </a>
                                        <a onClick={() => { setEditingData(null); setActiveModal('recorrente'); setShowDropdown(false); }}>
                                            <i className="fa-solid fa-rotate" style={{ marginRight: '8px', opacity: 0.6 }}></i>Recorrente
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <LoadingState />
                    ) : allTransactions.length > 0 ? (
                        <>
                            <div className="transacoes-list">
                                <div className="table-header">
                                    <span></span>
                                    <span>Título</span>
                                    <span>Categoria</span>
                                    <span>Data</span>
                                    <span>Tag</span>
                                    <span>Valor</span>
                                </div>
                                {pagedTransactions.map(t => (
                                    <TransactionCard
                                        key={t._allParcelas ? t.id_grupo_recorrencia : t.id}
                                        transacao={t}
                                        onUpdate={fetchData}
                                        onEdit={handleEditTransaction}
                                        isExpanded={t.id_grupo_recorrencia ? expandedGroups.has(t.id_grupo_recorrencia) : false}
                                        onToggleExpand={handleToggleExpand}
                                    />
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="pagination-bar">
                                    <button
                                        className="btn-page"
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        title="Primeira página"
                                    >
                                        <i className="fa-solid fa-angles-left"></i>
                                    </button>
                                    <button
                                        className="btn-page"
                                        onClick={() => setCurrentPage(p => p - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        <i className="fa-solid fa-angle-left"></i>
                                    </button>

                                    <span className="pagination-info">
                                        {currentPage} <span>/ {totalPages}</span>
                                        <span className="pagination-count">· {allTransactions.length} transações</span>
                                    </span>

                                    <button
                                        className="btn-page"
                                        onClick={() => setCurrentPage(p => p + 1)}
                                        disabled={currentPage === totalPages}
                                    >
                                        <i className="fa-solid fa-angle-right"></i>
                                    </button>
                                    <button
                                        className="btn-page"
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        title="Última página"
                                    >
                                        <i className="fa-solid fa-angles-right"></i>
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="empty-list-msg">Nenhuma transação registrada.</p>
                    )}
                </div>

                {/* --- COLUNA 2: CATEGORIAS --- */}
                <div className="agenda-column" id="category-column">
                    <div className="column-header-flex">
                        <h2>Categorias</h2>
                        <button className="btn-primary" onClick={() => { setEditingData(null); setActiveModal('category'); }}>
                            <i className="fa-solid fa-plus"></i> Categoria
                        </button>
                    </div>

                    {loading ? (
                        <LoadingState />
                    ) : (
                        <>
                            <h3
                                className={`month-header ${openMonths['resumo-despesas'] ? 'active' : ''}`}
                                onClick={() => toggleAccordion('resumo-despesas')}
                            >
                                <span>Despesas do Mês</span>
                                <i className={`fa-solid fa-chevron-down ${openMonths['resumo-despesas'] ? 'rotate' : ''}`}></i>
                            </h3>
                            <div className={`accordion-wrapper ${openMonths['resumo-despesas'] ? 'open' : ''}`}>
                                <div className="accordion-inner">
                                    <div className="category-grid">
                                        {(data.categorias_despesa || []).map(cat => (
                                            <CategoryCard
                                                key={cat.id}
                                                categoria={cat}
                                                onEdit={handleEditCategory}
                                                onDelete={handleDeleteCategory}
                                            />
                                        ))}
                                        {(!data.categorias_despesa || data.categorias_despesa.length === 0) && <p className="empty-list-msg">Sem despesas.</p>}
                                    </div>
                                </div>
                            </div>

                            <h3
                                className={`month-header ${openMonths['resumo-receitas'] ? 'active' : ''}`}
                                onClick={() => toggleAccordion('resumo-receitas')}
                                style={{ marginTop: '0.5rem' }}
                            >
                                <span>Receitas do Mês</span>
                                <i className={`fa-solid fa-chevron-down ${openMonths['resumo-receitas'] ? 'rotate' : ''}`}></i>
                            </h3>
                            <div className={`accordion-wrapper ${openMonths['resumo-receitas'] ? 'open' : ''}`}>
                                <div className="accordion-inner">
                                    <div className="category-grid">
                                        {(data.categorias_receita || []).map(cat => (
                                            <CategoryCard
                                                key={cat.id}
                                                categoria={cat}
                                                onEdit={handleEditCategory}
                                                onDelete={handleDeleteCategory}
                                            />
                                        ))}
                                        {(!data.categorias_receita || data.categorias_receita.length === 0) && <p className="empty-list-msg">Sem receitas.</p>}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <FinancasModals
                activeModal={activeModal}
                closeModal={handleCloseModal}
                onUpdate={fetchData}
                dashboardData={data}
                editingData={editingData}
            />

            <AiAssistant context="financas" />
        </div>
    );
}
