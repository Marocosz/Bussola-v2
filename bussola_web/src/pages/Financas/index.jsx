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
    
    // Controle de UI
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

    const dropdownRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('bussola_financas_accordions', JSON.stringify(openMonths));
    }, [openMonths]);

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
            
            // BLINDAGEM: Verifica se o resultado é válido e tem a estrutura esperada
            if (result && typeof result === 'object') {
                
                // Lógica de abrir o primeiro mês (apenas se tiver dados válidos)
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
                // Inicializa com estrutura vazia para não quebrar a tela
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

    const handleEditTransaction = (transacao) => {
        setEditingData(transacao);
        setActiveModal(transacao.tipo_recorrencia || 'pontual'); // Fallback para 'pontual'
    };

    const handleEditCategory = (categoria) => {
        setEditingData(categoria);
        setActiveModal('category');
    };

    const handleDeleteCategory = async (id) => {
        // MENSAGEM ATUALIZADA
        if (!confirm('Ao excluir esta categoria, todas as transações vinculadas a ela serão movidas para "Indefinida". Deseja continuar?')) return;
        
        try {
            await deleteCategoria(id);
            addToast({ type: 'success', title: 'Sucesso', description: 'Categoria removida e transações migradas.' });
            fetchData();
        } catch (error) {
            // Caso tente apagar a própria Indefinida, o back retorna erro
            const msg = error.response?.data?.detail || 'Erro ao excluir categoria.';
            addToast({ type: 'error', title: 'Erro', description: msg });
        }
    };

    const handleCloseModal = () => {
        setActiveModal(null);
        setEditingData(null);
    };

    if (loading) return <div className="loading-screen">Carregando Finanças...</div>;

    // Se carregou mas data continua null (erro grave), exibe fallback
    if (!data) return <div className="loading-screen">Erro ao carregar dados.</div>;

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
                
                {/* Coluna 1: Pontuais */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Transações Pontuais</h2>
                        <button className="btn-primary" onClick={() => { setEditingData(null); setActiveModal('pontual'); }}>
                            <i className="fa-solid fa-plus"></i> Pontual
                        </button>
                    </div>
                    
                    {/* BLINDAGEM: ?. e || {} em todos os acessos a objetos */}
                    {Object.keys(data.transacoes_pontuais || {}).length > 0 ? (
                        Object.entries(data.transacoes_pontuais || {}).map(([mes, transactions]) => (
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
                                                {(transactions || []).map(t => (
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

                {/* Coluna 2: Recorrentes */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Recorrentes e Parceladas</h2>
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

                    {Object.keys(data.transacoes_recorrentes || {}).length > 0 ? (
                        Object.entries(data.transacoes_recorrentes || {}).map(([mes, transactions]) => (
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
                                                {(transactions || []).map(t => (
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

                {/* Coluna 3: Categorias */}
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