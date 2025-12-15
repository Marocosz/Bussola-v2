import React, { useEffect, useState } from 'react';
import { getRegistrosDashboard, deleteGrupo } from '../../services/api'; 
import { AnotacaoCard } from './components/AnotacaoCard';
import { TarefaCard } from './components/TarefaCard';
import { AnotacaoModal } from './components/AnotacaoModal';
import { TarefaModal } from './components/TarefaModal';
import { GrupoModal } from './components/GrupoModal';
import { ViewAnotacaoModal } from './components/ViewAnotacaoModal';
import './styles.css';

export function Registros() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // UI State
    const [notaModalOpen, setNotaModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
    const [grupoModalOpen, setGrupoModalOpen] = useState(false);
    
    const [editingNota, setEditingNota] = useState(null);
    const [viewingNota, setViewingNota] = useState(null);
    const [editingGrupo, setEditingGrupo] = useState(null);
    const [editingTarefa, setEditingTarefa] = useState(null); // NOVO

    // Controle do Dropdown
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [filtroGrupo, setFiltroGrupo] = useState('Todos');

    // Inicialização com LocalStorage
    const [openGroups, setOpenGroups] = useState(() => {
        const savedState = localStorage.getItem('@Bussola:registros_accordions');
        if (savedState) {
            try { return JSON.parse(savedState); } catch (e) { console.error("Erro ao ler localStorage", e); }
        }
        return {'fixados': true}; 
    });

    useEffect(() => {
        localStorage.setItem('@Bussola:registros_accordions', JSON.stringify(openGroups));
    }, [openGroups]);


    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await getRegistrosDashboard();
            setData(result);
            setError(null);
        } catch (err) {
            console.error("Erro dashboard:", err);
            setError("Não foi possível carregar os registros.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // --- PROCESSAMENTO DE DADOS ---
    const processDataByGroup = () => {
        if (!data) return {};
        const grouped = {};
        let allNotes = [];
        
        if (data.anotacoes_por_mes) {
            Object.values(data.anotacoes_por_mes).forEach(notesList => {
                if(Array.isArray(notesList)) allNotes = [...allNotes, ...notesList];
            });
        }

        allNotes.forEach(nota => {
            const grupoNome = nota.grupo?.nome || 'Indefinido';
            if (filtroGrupo !== 'Todos' && grupoNome !== filtroGrupo) return;
            if (!grouped[grupoNome]) grouped[grupoNome] = [];
            grouped[grupoNome].push(nota);
        });
        return grouped;
    };

    const groupedNotes = processDataByGroup();
    const fixadas = data?.anotacoes_fixadas || [];
    
    const fixadasFiltered = filtroGrupo === 'Todos' 
        ? fixadas 
        : fixadas.filter(n => n.grupo?.nome === filtroGrupo);

    const tarefasPendentes = data?.tarefas_pendentes || [];
    const tarefasConcluidas = data?.tarefas_concluidas || [];
    const grupos = data?.grupos_disponiveis || [];

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

    // Handler Nova Tarefa
    const handleNewTarefa = () => {
        setEditingTarefa(null);
        setTarefaModalOpen(true);
    };

    // Handler Editar Tarefa (NOVO)
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
        if (!window.confirm("Tem certeza? As anotações deste grupo serão movidas para 'Indefinido'.")) return;
        try {
            if(deleteGrupo) {
                await deleteGrupo(grupoId);
                if (filtroGrupo !== 'Todos') setFiltroGrupo('Todos');
                fetchData();
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir grupo.");
        }
    };

    if (loading && !data) return (
        <div className="container" style={{paddingTop:'100px', textAlign:'center'}}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{fontSize:'2rem', color:'var(--cor-azul-primario)'}}></i>
        </div>
    );

    if (error) return (
        <div className="container" style={{paddingTop:'100px', textAlign:'center', color:'var(--cor-vermelho-delete)'}}>
            <p>{error}</p>
            <button className="btn-secondary" onClick={fetchData}>Tentar Novamente</button>
        </div>
    );

    if (!data) return null;

    return (
        <div className="container main-container registros-scope">
            
            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Caderno & Tarefas</h1>
                    <p>Organize suas ideias por grupos e gerencie suas pendências.</p>
                </div>
            </div>

            <div className="registros-layout">
                
                {/* 1. COLUNA ESQUERDA: CADERNO */}
                <div className="registros-column column-anotacoes">
                    
                    <div className="column-header-flex">
                        <h2>CADERNO</h2>
                        <div className="header-actions-group">
                            <div className="custom-dropdown-wrapper">
                                <button 
                                    className={`dropdown-trigger-btn ${filtroGrupo !== 'Todos' ? 'active' : ''}`} 
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                >
                                    <span>{filtroGrupo === 'Todos' ? 'Todos os Grupos' : filtroGrupo}</span>
                                    <i className="fa-solid fa-chevron-down"></i>
                                </button>

                                {dropdownOpen && (
                                    <>
                                        <div className="dropdown-backdrop" onClick={() => setDropdownOpen(false)}></div>
                                        {/* DROPDOWN MENU COM ESTILO IGUAL FINANÇAS */}
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
                                                            <span className="dot" style={{backgroundColor: g.cor}}></span>
                                                            <span className="name">{g.nome}</span>
                                                        </div>
                                                        <div className="dropdown-item-actions">
                                                            <button className="btn-action-icon btn-edit" onClick={(e) => handleEditGrupo(g, e)}><i className="fa-solid fa-pen-to-square"></i></button>
                                                            <button className="btn-action-icon btn-delete" onClick={(e) => handleDeleteGrupo(g.id, e)}><i className="fa-solid fa-trash-can"></i></button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className={`dropdown-item ${filtroGrupo === 'Indefinido' ? 'selected' : ''}`} onClick={() => { setFiltroGrupo('Indefinido'); setDropdownOpen(false); }}>
                                                     <div className="dropdown-item-info"><span className="dot" style={{backgroundColor: '#ccc'}}></span><span className="name">Indefinido</span></div>
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
                    </div>

                    <div className="column-scroll-content">
                        {fixadasFiltered.length > 0 && (
                            <div className="group-accordion">
                                <h3 className={`accordion-header pinned-header ${openGroups['fixados'] ? 'active' : ''}`} onClick={() => toggleAccordion('fixados')}>
                                    <div className="header-title-wrapper">
                                        <span><i className="fa-solid fa-thumbtack"></i> Fixados</span>
                                    </div>
                                    <div className="header-meta">
                                        <span className="count-text">{fixadasFiltered.length} {fixadasFiltered.length === 1 ? 'nota' : 'notas'}</span>
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
                                                        onUpdate={fetchData} 
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
                                            <span className="grp-dot" style={{backgroundColor: grpColor}}></span>
                                            <span>{grupoNome}</span>
                                        </div>
                                        <div className="header-meta">
                                            <span className="count-text">{notas.length} {notas.length === 1 ? 'nota' : 'notas'}</span>
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
                                                            onUpdate={fetchData} 
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
                                <p>Nenhuma anotação neste grupo.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. COLUNA DIREITA: TAREFAS */}
                <div className="registros-column column-tarefas">
                    <div className="column-header-flex">
                        <h2>TAREFAS</h2>
                        <button className="btn-primary small-btn" onClick={handleNewTarefa}>
                            <i className="fa-solid fa-plus"></i> Tarefa
                        </button>
                    </div>

                    <div className="column-scroll-content">
                        <div className="tarefas-list">
                            {tarefasPendentes.length === 0 && tarefasConcluidas.length === 0 && (
                                <div className="empty-state">
                                    <i className="fa-solid fa-check-double"></i>
                                    <p>Nenhuma tarefa pendente.</p>
                                </div>
                            )}
                            
                            {tarefasPendentes.map(t => (
                                <TarefaCard 
                                    key={t.id} 
                                    tarefa={t} 
                                    onUpdate={fetchData} 
                                    onEdit={handleEditTarefa} // Passando a função
                                />
                            ))}
                        </div>

                        {tarefasConcluidas.length > 0 && (
                            <div className="concluidas-section">
                                <h4 className="concluidas-title">Concluídas</h4>
                                <div className="tarefas-list completed">
                                    {tarefasConcluidas.map(t => (
                                        <TarefaCard 
                                            key={t.id} 
                                            tarefa={t} 
                                            onUpdate={fetchData}
                                            onEdit={handleEditTarefa} // Passando a função
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAIS */}
            <AnotacaoModal active={notaModalOpen} closeModal={() => setNotaModalOpen(false)} onUpdate={fetchData} editingData={editingNota} gruposDisponiveis={grupos}/>
            
            {/* TAREFA MODAL ATUALIZADO */}
            <TarefaModal 
                active={tarefaModalOpen} 
                closeModal={() => setTarefaModalOpen(false)} 
                onUpdate={fetchData} 
                editingData={editingTarefa} // Passando dados de edição
            />
            
            <GrupoModal active={grupoModalOpen} closeModal={() => setGrupoModalOpen(false)} onUpdate={fetchData} editingData={editingGrupo}/>
            
            <ViewAnotacaoModal 
                active={viewModalOpen} 
                closeModal={() => setViewModalOpen(false)} 
                nota={viewingNota}
                onEdit={handleEditNota}
            />
        </div>
    );
}