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
    
    // UI State - Controle de Modais
    const [notaModalOpen, setNotaModalOpen] = useState(false);
    const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
    const [editingNota, setEditingNota] = useState(null);

    // Controle de Accordion (Quais meses estão abertos)
    const [openMonths, setOpenMonths] = useState({'fixados': true});

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await getRegistrosDashboard();
            setData(result);
            setError(null);
            
            // Abre o primeiro mês automaticamente se houver dados
            if(result?.anotacoes_por_mes && Object.keys(result.anotacoes_por_mes).length > 0){
                const firstMonth = Object.keys(result.anotacoes_por_mes)[0];
                setOpenMonths(prev => ({...prev, [firstMonth]: true}));
            }
        } catch (err) {
            console.error("Erro dashboard:", err);
            setError("Não foi possível carregar os registros. Verifique a conexão com o servidor.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Função para abrir/fechar meses
    const toggleAccordion = (key) => setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));

    // Handlers para abrir modais
    const handleNewNota = () => { setEditingNota(null); setNotaModalOpen(true); };
    const handleEditNota = (nota) => { setEditingNota(nota); setNotaModalOpen(true); };

    // --- RENDERIZAÇÃO CONDICIONAL (Evita tela branca) ---
    if (loading) return (
        <div className="container" style={{paddingTop:'100px', textAlign:'center'}}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{fontSize:'2rem', color:'var(--cor-azul-primario)'}}></i>
            <p style={{marginTop:'1rem'}}>Carregando registros...</p>
        </div>
    );

    if (error) return (
        <div className="container" style={{paddingTop:'100px', textAlign:'center', color:'var(--cor-vermelho-delete)'}}>
            <i className="fa-solid fa-triangle-exclamation" style={{fontSize:'2rem', marginBottom:'1rem'}}></i>
            <p>{error}</p>
            <button className="btn-secondary" onClick={fetchData} style={{marginTop:'1rem'}}>Tentar Novamente</button>
        </div>
    );

    if (!data) return null; // Proteção final

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
        <div className="container" style={{paddingTop: '100px'}}>
            
            {/* --- HEADER --- */}
            <div className="registros-header">
                <div>
                    <h1>Caderno & Tarefas</h1>
                    <p>Gerencie suas anotações e pendências.</p>
                </div>
                <div className="header-controls">
                    {/* Select de Grupos */}
                    <select className="form-input" style={{width:'auto'}} value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}>
                        <option value="Todos">Todos os Grupos</option>
                        {grupos.map(g => (
                            <option key={g.id} value={g.nome}>{g.nome}</option>
                        ))}
                    </select>
                    
                    <button className="btn-primary" onClick={handleNewNota}>
                        <i className="fa-solid fa-note-sticky"></i> Nota
                    </button>
                    <button className="btn-secondary" onClick={() => setTarefaModalOpen(true)}>
                        <i className="fa-solid fa-check"></i> Tarefa
                    </button>
                </div>
            </div>

            {/* --- LAYOUT DUAS COLUNAS --- */}
            <div className="registros-layout">
                
                {/* 1. COLUNA ESQUERDA: ANOTAÇÕES */}
                <div className="column-anotacoes">
                    <h2 className="column-title">Caderno</h2>
                    
                    {/* Seção Fixados */}
                    {fixadas.length > 0 && (
                        <div className="section-group">
                            <h3 className="section-title"><i className="fa-solid fa-thumbtack"></i> Fixados</h3>
                            <div className="notes-grid">
                                {fixadas.map(n => (
                                    <AnotacaoCard key={n.id} anotacao={n} onUpdate={fetchData} onEdit={handleEditNota}/>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Seção por Mês (Accordion) */}
                    {Object.entries(meses).map(([mes, notas]) => {
                        const filtered = filterNotas(notas);
                        if(filtered.length === 0) return null;

                        const isOpen = openMonths[mes];

                        return (
                            <div className="section-group" key={mes}>
                                <h3 className={`month-header ${isOpen ? 'active' : ''}`} onClick={() => toggleAccordion(mes)}>
                                    <span>{mes}</span>
                                    <span style={{fontSize:'0.8rem', opacity:0.7, marginLeft:'auto', marginRight:'10px'}}>
                                        {filtered.length} notas
                                    </span>
                                    <i className={`fa-solid fa-chevron-down ${isOpen ? 'rotate' : ''}`}></i>
                                </h3>
                                
                                {isOpen && (
                                    <div className="month-content" style={{marginTop:'1rem'}}>
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
                    
                    {/* Empty State das Notas */}
                    {fixadas.length === 0 && Object.keys(meses).length === 0 && (
                        <div className="empty-state">
                            <i className="fa-regular fa-folder-open" style={{fontSize:'2.5rem', marginBottom:'1rem', opacity:0.3}}></i>
                            <p>Nenhuma anotação encontrada.</p>
                        </div>
                    )}
                </div>

                {/* 2. COLUNA DIREITA: TAREFAS */}
                <div className="column-tarefas">
                    <h2 className="column-title">Lista de Tarefas</h2>
                    
                    <div className="tarefas-list">
                        {tarefasPendentes.length === 0 && tarefasConcluidas.length === 0 && (
                            <div className="empty-msg" style={{textAlign:'center', padding:'2rem', color:'var(--cor-texto-secundario)'}}>
                                Nenhuma tarefa pendente.
                            </div>
                        )}
                        
                        {tarefasPendentes.map(t => (
                            <TarefaCard key={t.id} tarefa={t} onUpdate={fetchData} />
                        ))}
                    </div>

                    {tarefasConcluidas.length > 0 && (
                        <div className="concluidas-section">
                            <h4 className="concluidas-title">Concluídas Recentemente</h4>
                            <div className="tarefas-list completed">
                                {tarefasConcluidas.map(t => (
                                    <TarefaCard key={t.id} tarefa={t} onUpdate={fetchData} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MODAIS --- */}
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