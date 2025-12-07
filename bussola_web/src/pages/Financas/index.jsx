import React, { useEffect, useState } from 'react';
import { getFinancasDashboard } from '../../services/api';
import { TransactionCard } from './components/TransactionCard';
import { CategoryCard } from './components/CategoryCard';
import { FinancasModals } from './components/FinancasModals';
import './styles.css'; // Você vai colar seu CSS antigo aqui

export function Financas() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Controle de UI
    const [openMonths, setOpenMonths] = useState({}); // { 'Janeiro/2025': true }
    const [activeModal, setActiveModal] = useState(null); // 'pontual', 'parcelada', 'recorrente', 'category'
    const [showDropdown, setShowDropdown] = useState(false);

    const fetchData = async () => {
        try {
            const result = await getFinancasDashboard();
            setData(result);
            
            // Abre o primeiro mês de cada lista por padrão
            const firstPontual = Object.keys(result.transacoes_pontuais)[0];
            const firstRecorrente = Object.keys(result.transacoes_recorrentes)[0];
            
            setOpenMonths(prev => ({
                ...prev,
                [`pontual-${firstPontual}`]: true,
                [`recorrente-${firstRecorrente}`]: true
            }));
        } catch (error) {
            console.error(error);
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

    if (loading) return <div className="loading-screen">Carregando Finanças...</div>;

    return (
        <div className="container">
            <div className="page-header">
                <h1>Provisões Financeiras</h1>
            </div>

            <div className="layout-grid-three-columns">
                
                {/* Coluna 1: Pontuais */}
                <div className="agenda-column">
                    <div className="column-header-flex">
                        <h2>Transações Pontuais</h2>
                        <button className="btn-primary" onClick={() => setActiveModal('pontual')}>
                            <i className="fa-solid fa-plus"></i> Pontual
                        </button>
                    </div>
                    
                    {Object.keys(data.transacoes_pontuais).length > 0 ? (
                        Object.entries(data.transacoes_pontuais).map(([mes, transactions]) => (
                            <div className="month-group" key={mes}>
                                <h3 
                                    className={`month-header ${openMonths[`pontual-${mes}`] ? 'active' : ''}`} 
                                    onClick={() => toggleAccordion(`pontual-${mes}`)}
                                >
                                    <span>{mes}</span>
                                    <i className={`fa-solid fa-chevron-down ${openMonths[`pontual-${mes}`] ? 'rotate' : ''}`}></i>
                                </h3>
                                {openMonths[`pontual-${mes}`] && (
                                    <div className="month-content">
                                        <div className="transacoes-grid">
                                            {transactions.map(t => (
                                                <TransactionCard key={t.id} transacao={t} onUpdate={fetchData} />
                                            ))}
                                        </div>
                                    </div>
                                )}
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
                        <div className="btn-group" style={{position: 'relative'}}>
                            <button 
                                className="btn-primary" 
                                onClick={() => setShowDropdown(!showDropdown)}
                            >
                                <i className="fa-solid fa-plus"></i> Adicionar
                            </button>
                            {showDropdown && (
                                <div className="dropdown-menu visible" style={{display: 'block'}}>
                                    <a onClick={() => { setActiveModal('parcelada'); setShowDropdown(false); }}>Compra Parcelada</a>
                                    <a onClick={() => { setActiveModal('recorrente'); setShowDropdown(false); }}>Transação Recorrente</a>
                                </div>
                            )}
                        </div>
                    </div>

                    {Object.keys(data.transacoes_recorrentes).length > 0 ? (
                        Object.entries(data.transacoes_recorrentes).map(([mes, transactions]) => (
                            <div className="month-group" key={mes}>
                                <h3 
                                    className={`month-header ${openMonths[`recorrente-${mes}`] ? 'active' : ''}`} 
                                    onClick={() => toggleAccordion(`recorrente-${mes}`)}
                                >
                                    <span>{mes}</span>
                                    <i className={`fa-solid fa-chevron-down ${openMonths[`recorrente-${mes}`] ? 'rotate' : ''}`}></i>
                                </h3>
                                {openMonths[`recorrente-${mes}`] && (
                                    <div className="month-content">
                                        <div className="transacoes-grid">
                                            {transactions.map(t => (
                                                <TransactionCard key={t.id} transacao={t} onUpdate={fetchData} />
                                            ))}
                                        </div>
                                    </div>
                                )}
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
                        <button className="btn-primary" onClick={() => setActiveModal('category')}>
                            <i className="fa-solid fa-plus"></i> Categoria
                        </button>
                    </div>

                    <h4>Despesas do Mês</h4>
                    <div className="category-grid">
                        {data.categorias_despesa.map(cat => (
                            <CategoryCard key={cat.id} categoria={cat} />
                        ))}
                        {data.categorias_despesa.length === 0 && <p className="empty-list-msg">Sem despesas.</p>}
                    </div>

                    <h4 style={{marginTop: '1.5rem'}}>Receitas do Mês</h4>
                    <div className="category-grid">
                        {data.categorias_receita.map(cat => (
                            <CategoryCard key={cat.id} categoria={cat} />
                        ))}
                        {data.categorias_receita.length === 0 && <p className="empty-list-msg">Sem receitas.</p>}
                    </div>
                </div>
            </div>

            {/* Modais */}
            <FinancasModals 
                activeModal={activeModal} 
                closeModal={() => setActiveModal(null)} 
                onUpdate={fetchData}
                dashboardData={data}
            />
        </div>
    );
}