import React, { useEffect, useState, useRef } from 'react';
import { getFinancasDashboard, deleteCategoria } from '../../services/api';
import { TransactionCard } from './components/TransactionCard';
import { CategoryCard } from './components/CategoryCard';
import { FinancasModals } from './components/FinancasModals';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { AiAssistant } from '../../components/AiAssistant';
import './styles.css';

export function Financas() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Hooks de Contexto
    const { addToast } = useToast();
    const dialogConfirm = useConfirm(); // Renomeado para evitar conflito com window.confirm

    // Controle de UI - Accordions
    const [openMonths, setOpenMonths] = useState(() => {
        try {
            const saved = localStorage.getItem('bussola_financas_accordions');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    const [activeModal, setActiveModal] = useState(null);
    const [editingData, setEditingData] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);

    // Estados de Ordenação
    const [orderPontual, setOrderPontual] = useState(() => {
        return localStorage.getItem('bussola_financas_order_pontual') || 'desc';
    });

    const [orderRecorrente, setOrderRecorrente] = useState(() => {
        return localStorage.getItem('bussola_financas_order_recorrente') || 'desc';
    });

    const dropdownRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('bussola_financas_accordions', JSON.stringify(openMonths));
    }, [openMonths]);

    useEffect(() => {
        localStorage.setItem('bussola_financas_order_pontual', orderPontual);
    }, [orderPontual]);

    useEffect(() => {
        localStorage.setItem('bussola_financas_order_recorrente', orderRecorrente);
    }, [orderRecorrente]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    const fetchData = async () => {
        try {
            const result = await getFinancasDashboard();

            if (result && typeof result === 'object') {
                if (data === null && Object.keys(openMonths).length === 0) {
                    if (result.transacoes_pontuais && Object.keys(result.transacoes_pontuais).length > 0) {
                        const firstPontual = Object.keys(result.transacoes_pontuais)[0];
                        setOpenMonths(prev => ({ ...prev, [`pontual-${firstPontual}`]: true }));
                    }
                    if (result.transacoes_recorrentes && Object.keys(result.transacoes_recorrentes).length > 0) {
                        const firstRecorrente = Object.keys(result.transacoes_recorrentes)[0];
                        setOpenMonths(prev => ({ ...prev, [`recorrente-${firstRecorrente}`]: true }));
                    }
                }
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

    useEffect(() => {
        fetchData();
    }, []);

    const toggleAccordion = (key) => {
        setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const getSortedKeys = (obj, order) => {
        if (!obj) return [];
        const mesesMap = {
            "Janeiro": 1, "Fevereiro": 2, "Março": 3, "Abril": 4, "Maio": 5, "Junho": 6,
            "Julho": 7, "Agosto": 8, "Setembro": 9, "Outubro": 10, "Novembro": 11, "Dezembro": 12
        };
        return Object.keys(obj).sort((a, b) => {
            try {
                const [mesA, anoA] = a.split('/');
                const [mesB, anoB] = b.split('/');
                const dateA = new Date(parseInt(anoA), mesesMap[mesA] - 1);
                const dateB = new Date(parseInt(anoB), mesesMap[mesB] - 1);
                return order === 'asc' ? dateA - dateB : dateB - dateA;
            } catch (e) { return 0; }
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
        // --- SUBSTITUIÇÃO DO CONFIRM NATIVO PELO DIALOG CUSTOMIZADO ---
        const isConfirmed = await dialogConfirm({
            title: 'Excluir Categoria?',
            description: 'Todas as transações vinculadas a esta categoria serão movidas para "Indefinida". Esta ação não pode ser desfeita.',
            confirmLabel: 'Sim, excluir',
            variant: 'danger'
        });

        if (!isConfirmed) return;
        // --------------------------------------------------------------

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

    // Calculamos chaves apenas se data existe, senão array vazio
    const pontuaisKeys = data ? getSortedKeys(data.transacoes_pontuais, orderPontual) : [];
    const recorrentesKeys = data ? getSortedKeys(data.transacoes_recorrentes, orderRecorrente) : [];

    // Componente de Loading interno
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

                {/* --- COLUNA 1: PONTUAIS --- */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Transações Pontuais</h2>
                        <div className="header-actions-group">
                            <button
                                className="btn-filter-sort"
                                onClick={() => setOrderPontual(prev => prev === 'desc' ? 'asc' : 'desc')}
                                title={orderPontual === 'desc' ? "Mais antigos primeiro" : "Mais recentes primeiro"}
                                disabled={loading}
                            >
                                <i className={`fa-solid fa-arrow-${orderPontual === 'desc' ? 'down-wide-short' : 'up-wide-short'}`}></i>
                            </button>

                            <button className="btn-primary" onClick={() => { setEditingData(null); setActiveModal('pontual'); }}>
                                <i className="fa-solid fa-plus"></i> Pontual
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <LoadingState />
                    ) : (
                        pontuaisKeys.length > 0 ? (
                            pontuaisKeys.map((mes) => (
                                <div className="month-group" key={mes}>
                                    <h3
                                        className={`month-header ${openMonths[`pontual-${mes}`] ? 'active' : ''}`}
                                        onClick={() => toggleAccordion(`pontual-${mes}`)}
                                    >
                                        <span>{mes}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.6 }}>
                                                {(data.transacoes_pontuais[mes] || []).length} Transacão(s)
                                            </span>
                                            <i className={`fa-solid fa-chevron-down ${openMonths[`pontual-${mes}`] ? 'rotate' : ''}`}></i>
                                        </div>
                                    </h3>

                                    <div className={`accordion-wrapper ${openMonths[`pontual-${mes}`] ? 'open' : ''}`}>
                                        <div className="accordion-inner">
                                            <div className="month-content">
                                                <div className="transacoes-grid">
                                                    {(data.transacoes_pontuais[mes] || []).map(t => (
                                                        <TransactionCard
                                                            key={t.id}
                                                            transacao={t}
                                                            onUpdate={fetchData}
                                                            onEdit={handleEditTransaction}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="empty-list-msg">Nenhuma transação pontual.</p>
                        )
                    )}
                </div>

                {/* --- COLUNA 2: RECORRENTES --- */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Recorrentes e Parceladas</h2>
                        <div className="header-actions-group">
                            <button
                                className="btn-filter-sort"
                                onClick={() => setOrderRecorrente(prev => prev === 'desc' ? 'asc' : 'desc')}
                                title={orderRecorrente === 'desc' ? "Mais antigos primeiro" : "Mais recentes primeiro"}
                                disabled={loading}
                            >
                                <i className={`fa-solid fa-arrow-${orderRecorrente === 'desc' ? 'down-wide-short' : 'up-wide-short'}`}></i>
                            </button>

                            <div className="btn-group" style={{ position: 'relative' }} ref={dropdownRef}>
                                <button
                                    className="btn-primary"
                                    onClick={() => setShowDropdown(!showDropdown)}
                                >
                                    <i className="fa-solid fa-plus"></i> Adicionar
                                </button>
                                {showDropdown && (
                                    <div className="dropdown-menu visible" style={{ display: 'block' }}>
                                        <a onClick={() => { setEditingData(null); setActiveModal('parcelada'); setShowDropdown(false); }}>Parcelada</a>
                                        <a onClick={() => { setEditingData(null); setActiveModal('recorrente'); setShowDropdown(false); }}>Recorrente</a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <LoadingState />
                    ) : (
                        recorrentesKeys.length > 0 ? (
                            recorrentesKeys.map((mes) => (
                                <div className="month-group" key={mes}>
                                    <h3
                                        className={`month-header ${openMonths[`recorrente-${mes}`] ? 'active' : ''}`}
                                        onClick={() => toggleAccordion(`recorrente-${mes}`)}
                                    >
                                        <span>{mes}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.6 }}>
                                                {(data.transacoes_recorrentes[mes] || []).length} Transacão(s)
                                            </span>
                                            <i className={`fa-solid fa-chevron-down ${openMonths[`recorrente-${mes}`] ? 'rotate' : ''}`}></i>
                                        </div>
                                    </h3>

                                    <div className={`accordion-wrapper ${openMonths[`recorrente-${mes}`] ? 'open' : ''}`}>
                                        <div className="accordion-inner">
                                            <div className="month-content">
                                                <div className="transacoes-grid">
                                                    {(data.transacoes_recorrentes[mes] || []).map(t => (
                                                        <TransactionCard
                                                            key={t.id}
                                                            transacao={t}
                                                            onUpdate={fetchData}
                                                            onEdit={handleEditTransaction}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="empty-list-msg">Nenhuma transação recorrente.</p>
                        )
                    )}
                </div>

                {/* --- COLUNA 3: CATEGORIAS --- */}
                <div className="agenda-column" id="category-column">
                    <div className="column-header-flex">
                        <h2>Resumo</h2>
                        <button className="btn-primary" onClick={() => { setEditingData(null); setActiveModal('category'); }}>
                            <i className="fa-solid fa-plus"></i> Categoria
                        </button>
                    </div>

                    {loading ? (
                        <LoadingState />
                    ) : (
                        <>
                            <h4>Despesas do Mês</h4>
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

                            <h4 style={{ marginTop: '1.5rem' }}>Receitas do Mês</h4>
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