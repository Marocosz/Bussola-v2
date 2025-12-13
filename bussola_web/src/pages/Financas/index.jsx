import React, { useEffect, useState, useRef } from 'react';
import { getFinancasDashboard, deleteCategoria } from '../../services/api';
import { TransactionCard } from './components/TransactionCard';
import { CategoryCard } from './components/CategoryCard';
import { FinancasModals } from './components/FinancasModals';
import { useToast } from '../../context/ToastContext';
import './styles.css';

export function Financas() {
    // Inicializa com null
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    
    // Controle de UI - Accordions (Já persistido)
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

    // --- ESTADOS DE ORDENAÇÃO (AGORA PERSISTIDOS) ---
    // Inicializa lendo do LocalStorage, se não existir, usa 'desc'
    const [orderPontual, setOrderPontual] = useState(() => {
        return localStorage.getItem('bussola_financas_order_pontual') || 'desc';
    });

    const [orderRecorrente, setOrderRecorrente] = useState(() => {
        return localStorage.getItem('bussola_financas_order_recorrente') || 'desc';
    });

    const dropdownRef = useRef(null);

    // Efeito para salvar Accordions
    useEffect(() => {
        localStorage.setItem('bussola_financas_accordions', JSON.stringify(openMonths));
    }, [openMonths]);

    // --- NOVOS EFEITOS PARA SALVAR ORDENAÇÃO ---
    useEffect(() => {
        localStorage.setItem('bussola_financas_order_pontual', orderPontual);
    }, [orderPontual]);

    useEffect(() => {
        localStorage.setItem('bussola_financas_order_recorrente', orderRecorrente);
    }, [orderRecorrente]);

    // Fecha dropdown ao clicar fora
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
            
            // BLINDAGEM: Verifica se o resultado é válido
            if (result && typeof result === 'object') {
                
                // Lógica de abrir o primeiro mês (apenas se tiver dados válidos e nada salvo)
                if (data === null && Object.keys(openMonths).length === 0) {
                    if(result.transacoes_pontuais && Object.keys(result.transacoes_pontuais).length > 0){
                        const firstPontual = Object.keys(result.transacoes_pontuais)[0];
                        setOpenMonths(prev => ({ ...prev, [`pontual-${firstPontual}`]: true }));
                    }
                    if(result.transacoes_recorrentes && Object.keys(result.transacoes_recorrentes).length > 0){
                        const firstRecorrente = Object.keys(result.transacoes_recorrentes)[0];
                        setOpenMonths(prev => ({ ...prev, [`recorrente-${firstRecorrente}`]: true }));
                    }
                }

                setData(result);
            } else {
                console.error("Formato de dados inválido recebido da API:", result);
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
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar dados.' });
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

    // --- FUNÇÃO DE ORDENAÇÃO ---
    // Converte "Janeiro/2025" em Data real para comparar
    const getSortedKeys = (obj, order) => {
        if (!obj) return [];
        
        const mesesMap = {
            "Janeiro": 1, "Fevereiro": 2, "Março": 3, "Abril": 4, "Maio": 5, "Junho": 6,
            "Julho": 7, "Agosto": 8, "Setembro": 9, "Outubro": 10, "Novembro": 11, "Dezembro": 12
        };

        return Object.keys(obj).sort((a, b) => {
            // Formato esperado: "Mês/Ano"
            try {
                const [mesA, anoA] = a.split('/');
                const [mesB, anoB] = b.split('/');

                const dateA = new Date(parseInt(anoA), mesesMap[mesA] - 1);
                const dateB = new Date(parseInt(anoB), mesesMap[mesB] - 1);

                if (order === 'asc') {
                    return dateA - dateB; // Crescente (Antigo -> Novo)
                } else {
                    return dateB - dateA; // Decrescente (Novo -> Antigo)
                }
            } catch (e) {
                return 0; // Fallback se o formato estiver errado
            }
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
        if (!confirm('Ao excluir esta categoria, todas as transações vinculadas a ela serão movidas para "Indefinida". Deseja continuar?')) return;
        
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

    if (loading) return <div className="loading-screen">Carregando Finanças...</div>;
    if (!data) return <div className="loading-screen">Erro ao carregar dados.</div>;

    // Obtém chaves ordenadas
    const pontuaisKeys = getSortedKeys(data.transacoes_pontuais, orderPontual);
    const recorrentesKeys = getSortedKeys(data.transacoes_recorrentes, orderRecorrente);

    return (
        <div className="container main-container">
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
                            {/* BOTÃO FILTRO */}
                            <button 
                                className="btn-filter-sort" 
                                onClick={() => setOrderPontual(prev => prev === 'desc' ? 'asc' : 'desc')}
                                title={orderPontual === 'desc' ? "Mais antigos primeiro" : "Mais recentes primeiro"}
                            >
                                <i className={`fa-solid fa-arrow-${orderPontual === 'desc' ? 'down-wide-short' : 'up-wide-short'}`}></i>
                            </button>

                            <button className="btn-primary" onClick={() => { setEditingData(null); setActiveModal('pontual'); }}>
                                <i className="fa-solid fa-plus"></i> Pontual
                            </button>
                        </div>
                    </div>
                    
                    {pontuaisKeys.length > 0 ? (
                        pontuaisKeys.map((mes) => (
                            <div className="month-group" key={mes}>
                                <h3 
                                    className={`month-header ${openMonths[`pontual-${mes}`] ? 'active' : ''}`} 
                                    onClick={() => toggleAccordion(`pontual-${mes}`)}
                                >
                                    <span>{mes}</span>
                                    <i className={`fa-solid fa-chevron-down ${openMonths[`pontual-${mes}`] ? 'rotate' : ''}`}></i>
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
                    )}
                </div>

                {/* --- COLUNA 2: RECORRENTES --- */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Recorrentes e Parceladas</h2>
                        
                        <div className="header-actions-group">
                            {/* BOTÃO FILTRO */}
                            <button 
                                className="btn-filter-sort" 
                                onClick={() => setOrderRecorrente(prev => prev === 'desc' ? 'asc' : 'desc')}
                                title={orderRecorrente === 'desc' ? "Mais antigos primeiro" : "Mais recentes primeiro"}
                            >
                                <i className={`fa-solid fa-arrow-${orderRecorrente === 'desc' ? 'down-wide-short' : 'up-wide-short'}`}></i>
                            </button>

                            <div className="btn-group" style={{position: 'relative'}} ref={dropdownRef}>
                                <button 
                                    className="btn-primary" 
                                    onClick={() => setShowDropdown(!showDropdown)}
                                >
                                    <i className="fa-solid fa-plus"></i> Adicionar
                                </button>
                                {showDropdown && (
                                    <div className="dropdown-menu visible" style={{display: 'block'}}>
                                        <a onClick={() => { setEditingData(null); setActiveModal('parcelada'); setShowDropdown(false); }}>Parcelada</a>
                                        <a onClick={() => { setEditingData(null); setActiveModal('recorrente'); setShowDropdown(false); }}>Recorrente</a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {recorrentesKeys.length > 0 ? (
                        recorrentesKeys.map((mes) => (
                            <div className="month-group" key={mes}>
                                <h3 
                                    className={`month-header ${openMonths[`recorrente-${mes}`] ? 'active' : ''}`} 
                                    onClick={() => toggleAccordion(`recorrente-${mes}`)}
                                >
                                    <span>{mes}</span>
                                    <i className={`fa-solid fa-chevron-down ${openMonths[`recorrente-${mes}`] ? 'rotate' : ''}`}></i>
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

                    <h4 style={{marginTop: '1.5rem'}}>Receitas do Mês</h4>
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

            <FinancasModals 
                activeModal={activeModal} 
                closeModal={handleCloseModal} 
                onUpdate={fetchData}
                dashboardData={data}
                editingData={editingData} 
            />
        </div>
    );
}