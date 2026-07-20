import React, { useEffect, useState, useRef } from 'react';
import { getFinancasDashboard, deleteCategoria } from '../../services/api';
import { logger } from '../../utils/logger';
import { TransactionCard } from './components/TransactionCard';
import { CategoryCard } from './components/CategoryCard';
import { FinancasModals } from './components/FinancasModals';
import { MetasModal } from '../Metas/MetasModal';
import { BaseModal } from '../../components/BaseModal';
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

    const [activeModal, setActiveModal] = useState(null);
    const [editingData, setEditingData] = useState(null);
    const [showMetas, setShowMetas] = useState(false);
    const [showCategorias, setShowCategorias] = useState(false);
    const [catView, setCatView] = useState('despesa');
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
            logger.error("Erro inesperado", { error: String(error) });
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar dados financeiros.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

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

        // Cofre: CADA movimentação vira uma linha própria (transferência neutra — não
        // conta em receita/despesa). Guarda o grupo inteiro para o expand ver o histórico.
        const cofreRows = (data.transacoes_cofre || []).flatMap(g =>
            (g.movimentacoes || []).map(mv => ({
                _isCofre: true,
                id: `cofremov-${mv.id}`,
                _movId: mv.id,
                id_grupo_recorrencia: g.id_grupo,
                tipo_recorrencia: 'cofre',
                descricao: `${mv.tipo === 'aporte' ? 'Aporte' : 'Retirada'} · ${g.nome}`,
                data: mv.data,
                valor: mv.valor,
                status: mv.status,
                tipo_mov: mv.tipo,
                categoria: { nome: g.nome, icone: g.icone, cor: g.cor },
                meta_id: g.meta_id,
                _cofreArquivada: !!g.arquivada,
                _cofreMovs: (g.movimentacoes || []).length > 1 ? g.movimentacoes : undefined,
            }))
        );

        let all = [...pontuais, ...recorrentes, ...cofreRows];

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

        // NÃO colapsa grupos: toda ocorrência é uma linha própria (30/07, 30/06, 30/05…).
        // Cada linha de parcelada/recorrente carrega o histórico COMPLETO do grupo
        // (todas as ocorrências) apenas para o expand — sem esconder nenhuma linha.
        const groupHistory = {};
        for (const t of recorrentes) {
            if (t.id_grupo_recorrencia) {
                if (!groupHistory[t.id_grupo_recorrencia]) groupHistory[t.id_grupo_recorrencia] = [];
                groupHistory[t.id_grupo_recorrencia].push(t);
            }
        }
        Object.values(groupHistory).forEach(list =>
            list.sort((a, b) => new Date(b.data) - new Date(a.data))  // histórico: mais recente primeiro
        );

        all = all.map(t => {
            if ((t.tipo_recorrencia === 'parcelada' || t.tipo_recorrencia === 'recorrente') && t.id_grupo_recorrencia) {
                const grupo = groupHistory[t.id_grupo_recorrencia];
                if (grupo && grupo.length > 1) return { ...t, _allParcelas: grupo };
            }
            return t;
        });

        return all.sort((a, b) => {
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

    const fmtCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const totalReceita = (data?.categorias_receita || []).reduce((sum, c) => sum + Number(c.total_ganho || 0), 0);
    const totalDespesa = (data?.categorias_despesa || []).reduce((sum, c) => sum + Number(c.total_gasto || 0), 0);
    const saldo = totalReceita - totalDespesa;
    const resumoPat = data?.resumo_patrimonio;
    const disponivel = resumoPat ? resumoPat.disponivel : saldo;
    const guardado = resumoPat ? resumoPat.guardado : 0;
    const qtdMetas = resumoPat ? (resumoPat.qtd_metas || 0) : 0;
    const qtdDespesa = (data?.categorias_despesa || []).length;
    const qtdReceita = (data?.categorias_receita || []).length;
    const qtdCategorias = qtdDespesa + qtdReceita;

    return (
        <div className="container main-container financas-scope">
            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-wallet"></i> Provisões Financeiras</h1>
                </div>
                <div className="page-header-kpis">
                    <span className="ph-kpi receita"><i className="fa-solid fa-arrow-trend-up"></i> {fmtCurrency(totalReceita)}</span>
                    <span className="ph-kpi despesa"><i className="fa-solid fa-arrow-trend-down"></i> {fmtCurrency(totalDespesa)}</span>
                    <span className={`ph-kpi ${disponivel >= 0 ? 'positivo' : 'negativo'}`} title="Disponível: dinheiro livre pra gastar (Total − Guardado). Guardar numa meta reduz isto, mas não é gasto."><i className="fa-solid fa-scale-balanced"></i> {fmtCurrency(disponivel)}</span>
                    {guardado > 0 && (
                        <span className="ph-kpi" title="Guardado nas metas/cofrinhos. Continua sendo seu — só saiu do disponível (não é gasto). O patrimônio total não muda ao guardar." style={{ color: 'var(--cor-azul-primario, #4f46e5)' }}><i className="fa-solid fa-piggy-bank"></i> {fmtCurrency(guardado)}</span>
                    )}
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
                                            {[['todos','Todos'],['pontual','Pontual'],['parcelada','Parcelada'],['recorrente','Recorrente'],['cofre','Cofre']].map(([val, label]) => (
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
                                        key={t.id}
                                        transacao={t}
                                        onUpdate={fetchData}
                                        onEdit={handleEditTransaction}
                                        isExpanded={expandedGroups.has(t.id)}
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
                    {/* Duas caixas sticky: Metas & Cofrinhos + Categorias */}
                    <div className="metas-cat-row">
                        <button className="metas-entry" onClick={() => setShowMetas(true)}>
                            <i className="fa-solid fa-piggy-bank metas-entry-bg" aria-hidden="true"></i>
                            <div className="metas-entry-head">
                                <span className="metas-entry-icon"><i className="fa-solid fa-piggy-bank"></i></span>
                                <span className="metas-entry-badge">{qtdMetas} {qtdMetas === 1 ? 'cofrinho' : 'cofrinhos'}</span>
                            </div>
                            <div className="metas-entry-body">
                                <strong className="metas-entry-title">Metas &amp; Cofrinhos</strong>
                                <span className="metas-entry-value">{fmtCurrency(guardado)}</span>
                                <span className="metas-entry-sub">{guardado > 0 ? 'guardado' : 'comece a guardar'}</span>
                            </div>
                            <span className="metas-entry-cta">Abrir <i className="fa-solid fa-arrow-right"></i></span>
                        </button>

                        <button className="metas-entry cat-entry" onClick={() => setShowCategorias(true)}>
                            <i className="fa-solid fa-tags metas-entry-bg" aria-hidden="true"></i>
                            <div className="metas-entry-head">
                                <span className="metas-entry-icon"><i className="fa-solid fa-tags"></i></span>
                                <span className="metas-entry-badge">{qtdDespesa} gasto · {qtdReceita} receita</span>
                            </div>
                            <div className="metas-entry-body">
                                <strong className="metas-entry-title">Categorias</strong>
                                <span className="metas-entry-value">{qtdCategorias}</span>
                                <span className="metas-entry-sub">{qtdCategorias === 1 ? 'categoria cadastrada' : 'categorias cadastradas'}</span>
                            </div>
                            <span className="metas-entry-cta">Gerenciar <i className="fa-solid fa-arrow-right"></i></span>
                        </button>
                    </div>
                </div>
            </div>

            {showMetas && (
                <MetasModal onClose={() => setShowMetas(false)} onUpdate={fetchData} />
            )}

            {showCategorias && (() => {
                const catList = catView === 'receita' ? (data?.categorias_receita || []) : (data?.categorias_despesa || []);
                return (
                    <BaseModal onClose={() => setShowCategorias(false)} className="modal">
                        <div className="modal-content categorias-modal financas-scope" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3><i className="fa-solid fa-tags" style={{ marginRight: 8, color: 'var(--cor-azul-primario)' }}></i> Categorias</h3>
                                <span className="close-btn" onClick={() => setShowCategorias(false)}>&times;</span>
                            </div>

                            <div className="cat-toolbar">
                                <div className="cat-toolbar-select">
                                    <CustomSelect
                                        name="catView"
                                        value={catView}
                                        options={[
                                            { value: 'despesa', label: 'Despesas', icon: 'fa-solid fa-arrow-trend-down', color: '#ef4444' },
                                            { value: 'receita', label: 'Receitas', icon: 'fa-solid fa-arrow-trend-up', color: '#22c55e' },
                                        ]}
                                        onChange={(e) => setCatView(e.target.value)}
                                    />
                                </div>
                                <button className="btn-primary" onClick={() => { setEditingData(null); setActiveModal('category'); }}>
                                    <i className="fa-solid fa-plus"></i> Nova Categoria
                                </button>
                            </div>

                            <div className="modal-body categorias-modal-body">
                                <div className="categoria-list">
                                    {catList.map(cat => (
                                        <CategoryCard key={cat.id} categoria={cat} onEdit={handleEditCategory} onDelete={handleDeleteCategory} />
                                    ))}
                                    {!catList.length && (
                                        <p className="empty-list-msg">Nenhuma categoria de {catView === 'receita' ? 'receita' : 'despesa'}.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </BaseModal>
                );
            })()}

            {/* FinancasModals por último → o form de categoria empilha sobre o modal de Categorias */}
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
