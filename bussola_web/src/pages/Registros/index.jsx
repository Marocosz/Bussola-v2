import React, { useEffect, useState } from 'react';
import { getRegistrosDashboard } from '../../services/api';
import { AnotacaoCard } from './components/AnotacaoCard';
import { TarefaCard } from './components/TarefaCard';
import { AnotacaoModal } from './components/AnotacaoModal';
import { TarefaModal } from './components/TarefaModal';
import './styles.css';

export function Registros() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtroGrupo, setFiltroGrupo] = useState('Todos');
    
    // UI State
    const [notaModalOpen, setNotaModalOpen] = useState(false);
    const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
    const [editingNota, setEditingNota] = useState(null);

    // Accordion State
    const [openMonths, setOpenMonths] = useState({'fixados': true});

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await getRegistrosDashboard();
            setData(result);
            setError(null);
            
            if(result?.anotacoes_por_mes && Object.keys(result.anotacoes_por_mes).length > 0){
                const firstMonth = Object.keys(result.anotacoes_por_mes)[0];
                setOpenMonths(prev => ({...prev, [firstMonth]: true}));
            }
        } catch (err) {
            console.error("Erro dashboard:", err);
            setError("Não foi possível carregar os registros.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleAccordion = (key) => setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));
    const handleNewNota = () => { setEditingNota(null); setNotaModalOpen(true); };
    const handleEditNota = (nota) => { setEditingNota(nota); setNotaModalOpen(true); };

    // --- RENDERIZAÇÃO CONDICIONAL ---
    if (loading) return (
        <div className="container" style={{paddingTop:'100px', textAlign:'center'}}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{fontSize:'2rem', color:'var(--cor-azul-primario)'}}></i>
            <p style={{marginTop:'1rem'}}>Carregando registros...</p>
        </div>
    );

    if (error) return (
        <div className="container" style={{paddingTop:'100px', textAlign:'center', color:'var(--cor-vermelho-delete)'}}>
            <p>{error}</p>
            <button className="btn-secondary" onClick={fetchData}>Tentar Novamente</button>
        </div>
    );

    if (!data) return null;

    // --- LÓGICA DE FILTROS ---
    const filterNotas = (notas) => {
        if (!notas) return [];
        return filtroGrupo === 'Todos' ? notas : notas.filter(n => n.grupo?.nome === filtroGrupo);
    };

    const fixadas = filterNotas(data.anotacoes_fixadas || []);
    const meses = data.anotacoes_por_mes || {};
    const tarefasPendentes = data.tarefas_pendentes || [];
    const tarefasConcluidas = data.tarefas_concluidas || [];
    const grupos = data.grupos_disponiveis || [];

    return (
        /* ADICIONEI A CLASSE 'registros-scope' AQUI PARA ISOLAR O CSS */
        <div className="container main-container registros-scope">
            
            {/* --- HERO SECTION --- */}
            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Caderno & Tarefas</h1>
                    <p>Centralize suas ideias, anotações de estudo e pendências diárias.</p>
                </div>
            </div>

            {/* --- LAYOUT DUAS COLUNAS --- */}
            <div className="registros-layout">
                
                {/* 1. COLUNA ESQUERDA: ANOTAÇÕES */}
                <div className="column-anotacoes">
                    <div className="column-header-flex">
                        <h2>CADERNO</h2>
                        <div className="header-actions-group">
                            <select 
                                className="form-input small-select" 
                                value={filtroGrupo} 
                                onChange={e => setFiltroGrupo(e.target.value)}
                            >
                                <option value="Todos">Todos</option>
                                {grupos.map(g => (
                                    <option key={g.id} value={g.nome}>{g.nome}</option>
                                ))}
                            </select>
                            <button className="btn-primary small-btn" onClick={handleNewNota}>
                                <i className="fa-solid fa-plus"></i> Nota
                            </button>
                        </div>
                    </div>
                    
                    <div className="column-content-wrapper">
                        {/* Fixados */}
                        {fixadas.length > 0 && (
                            <div className="month-group">
                                <h3 className={`month-header pinned-header ${openMonths['fixados'] ? 'active' : ''}`} onClick={() => toggleAccordion('fixados')}>
                                    <span><i className="fa-solid fa-thumbtack"></i> Fixados</span>
                                    <i className={`fa-solid fa-chevron-down ${openMonths['fixados'] ? 'rotate' : ''}`}></i>
                                </h3>
                                {openMonths['fixados'] && (
                                    <div className="month-content">
                                        <div className="notes-grid">
                                            {fixadas.map(n => (
                                                <AnotacaoCard key={n.id} anotacao={n} onUpdate={fetchData} onEdit={handleEditNota}/>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Histórico Meses */}
                        {Object.entries(meses).map(([mes, notas]) => {
                            const filtered = filterNotas(notas);
                            if(filtered.length === 0) return null;
                            const isOpen = openMonths[mes];

                            return (
                                <div className="month-group" key={mes}>
                                    <h3 className={`month-header ${isOpen ? 'active' : ''}`} onClick={() => toggleAccordion(mes)}>
                                        <span>{mes}</span>
                                        <span className="count-badge">{filtered.length}</span>
                                        <i className={`fa-solid fa-chevron-down ${isOpen ? 'rotate' : ''}`}></i>
                                    </h3>
                                    
                                    {isOpen && (
                                        <div className="month-content">
                                            <div className="notes-grid">
                                                {filtered.map(n => (
                                                    <AnotacaoCard key={n.id} anotacao={n} onUpdate={fetchData} onEdit={handleEditNota}/>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        
                        {/* Empty State */}
                        {fixadas.length === 0 && Object.keys(meses).length === 0 && (
                            <div className="empty-state">
                                <i className="fa-regular fa-folder-open"></i>
                                <p>Nenhuma anotação encontrada.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. COLUNA DIREITA: TAREFAS */}
                <div className="column-tarefas">
                    <div className="column-header-flex">
                        <h2>TAREFAS</h2>
                        <button className="btn-primary small-btn" onClick={() => setTarefaModalOpen(true)}>
                            <i className="fa-solid fa-plus"></i> Tarefa
                        </button>
                    </div>

                    <div className="column-content-wrapper">
                        <div className="tarefas-list">
                            {tarefasPendentes.length === 0 && tarefasConcluidas.length === 0 && (
                                <div className="empty-msg-tarefas">
                                    Nenhuma tarefa pendente.
                                </div>
                            )}
                            
                            {tarefasPendentes.map(t => (
                                <TarefaCard key={t.id} tarefa={t} onUpdate={fetchData} />
                            ))}
                        </div>

                        {tarefasConcluidas.length > 0 && (
                            <div className="concluidas-section">
                                <h4 className="concluidas-title">Concluídas</h4>
                                <div className="tarefas-list completed">
                                    {tarefasConcluidas.map(t => (
                                        <TarefaCard key={t.id} tarefa={t} onUpdate={fetchData} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAIS */}
            <AnotacaoModal 
                active={notaModalOpen} 
                closeModal={() => setNotaModalOpen(false)} 
                onUpdate={fetchData} 
                editingData={editingNota}
                gruposDisponiveis={grupos}
            />
            
            <TarefaModal 
                active={tarefaModalOpen} 
                closeModal={() => setTarefaModalOpen(false)} 
                onUpdate={fetchData}
            />
        </div>
    );
}