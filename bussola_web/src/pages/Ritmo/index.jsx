import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { 
    getBioData, 
    getPlanoAtivo, 
    getDietaAtiva 
} from '../../services/api';

import './styles.css';

export function Ritmo() {
    const { addToast } = useToast();
    
    // Estados de Dados
    const [bio, setBio] = useState(null);
    const [treinoAtivo, setTreinoAtivo] = useState(null);
    const [dietaAtiva, setDietaAtiva] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Estado da Aba (treino ou dieta)
    const [activeTab, setActiveTab] = useState('treino');

    // Estados dos Modais (Placeholder para o futuro)
    const [showBioModal, setShowBioModal] = useState(false);
    const [showTreinoModal, setShowTreinoModal] = useState(false);
    const [showDietaModal, setShowDietaModal] = useState(false);

    // Carregar Dados
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            
            // Busca Bio
            try {
                const bioData = await getBioData();
                setBio(bioData);
            } catch (error) {
                console.log("Sem dados de bio ainda.");
            }

            // Busca Treino
            try {
                const treinoData = await getPlanoAtivo();
                setTreinoAtivo(treinoData);
            } catch (error) {
                console.log("Sem treino ativo.");
            }

            // Busca Dieta
            try {
                const dietaData = await getDietaAtiva();
                setDietaAtiva(dietaData);
            } catch (error) {
                console.log("Sem dieta ativa.");
            }

        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar dados.' });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-screen">Carregando Ritmo...</div>;

    return (
        <div className="ritmo-container">
            {/* --- SEÇÃO HERO: BIO & METAS --- */}
            <div className="ritmo-hero">
                {/* Card Esquerdo: Perfil */}
                <div className="bio-card-main">
                    <div className="bio-avatar">
                        <i className="fa-solid fa-bolt"></i>
                    </div>
                    {bio ? (
                        <>
                            <h3>{bio.objetivo === 'ganho_massa' ? 'Bulking' : bio.objetivo === 'perda_peso' ? 'Cutting' : 'Manutenção'}</h3>
                            <p style={{color: 'var(--text-secondary)'}}>{bio.nivel_atividade}</p>
                            <button className="btn-new" style={{marginTop: '1rem', fontSize: '0.8rem'}} onClick={() => alert("Modal Bio em breve!")}>
                                <i className="fa-solid fa-pen"></i> Editar
                            </button>
                        </>
                    ) : (
                        <button className="btn-new" onClick={() => alert("Modal Bio em breve!")}>
                            Configurar Perfil
                        </button>
                    )}
                </div>

                {/* Card Direito: KPIs e Macros */}
                <div className="bio-stats-grid">
                    <div className="kpi-box">
                        <span className="kpi-label">Peso Atual</span>
                        <div className="kpi-value">{bio?.peso || '--'} <span>kg</span></div>
                    </div>
                    <div className="kpi-box">
                        <span className="kpi-label">Meta Diária</span>
                        <div className="kpi-value">{bio?.gasto_calorico_total ? Math.round(bio.gasto_calorico_total) : '--'} <span>kcal</span></div>
                    </div>
                    <div className="kpi-box">
                        <span className="kpi-label">TMB</span>
                        <div className="kpi-value">{bio?.tmb || '--'} <span>kcal</span></div>
                    </div>
                    <div className="kpi-box">
                        <span className="kpi-label">Hidratação</span>
                        <div className="kpi-value">{bio?.meta_agua ? (bio.meta_agua / 1000).toFixed(1) : '--'} <span>L</span></div>
                    </div>

                    {/* Macros */}
                    <div className="kpi-box" style={{gridColumn: '1 / -1'}}>
                        <span className="kpi-label">Metas de Macros</span>
                        <div className="meta-macros">
                            <div className="macro-pill">
                                <strong>{bio?.meta_proteina || 0}g</strong> Proteína
                            </div>
                            <div className="macro-pill">
                                <strong>{bio?.meta_carbo || 0}g</strong> Carbo
                            </div>
                            <div className="macro-pill">
                                <strong>{bio?.meta_gordura || 0}g</strong> Gordura
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- NAVEGAÇÃO INTERNA --- */}
            <div className="ritmo-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'treino' ? 'active' : ''}`}
                    onClick={() => setActiveTab('treino')}
                >
                    <i className="fa-solid fa-dumbbell"></i> Treino
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'nutricao' ? 'active' : ''}`}
                    onClick={() => setActiveTab('nutricao')}
                >
                    <i className="fa-solid fa-apple-whole"></i> Nutrição
                </button>
            </div>

            {/* --- CONTEÚDO TREINO --- */}
            {activeTab === 'treino' && (
                <div className="tab-content fade-in">
                    <div className="section-header">
                        <div className="section-title">
                            {treinoAtivo ? (
                                <>
                                    <i className="fa-solid fa-calendar-week"></i>
                                    <span>{treinoAtivo.nome}</span>
                                </>
                            ) : <span>Sem plano ativo</span>}
                        </div>
                        <button className="btn-new" onClick={() => alert("Modal Treino em breve!")}>
                            <i className="fa-solid fa-plus"></i> Novo Plano
                        </button>
                    </div>

                    {treinoAtivo ? (
                        <div className="treino-grid">
                            {treinoAtivo.dias.sort((a,b) => a.ordem - b.ordem).map(dia => (
                                <div key={dia.id} className="dia-card">
                                    <div className="dia-header">
                                        <span>{dia.nome}</span>
                                        <i className="fa-solid fa-chevron-right"></i>
                                    </div>
                                    <div className="exercicio-list">
                                        {dia.exercicios.map(ex => (
                                            <div key={ex.id} className="exercicio-item">
                                                <div>
                                                    <strong>{ex.nome_exercicio}</strong>
                                                    <div className="exercicio-sets">
                                                        {ex.series} x {ex.repeticoes_min}-{ex.repeticoes_max}
                                                    </div>
                                                </div>
                                                {ex.carga_prevista && (
                                                    <span style={{color: 'var(--primary-color)', fontWeight:'bold'}}>
                                                        {ex.carga_prevista}kg
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <i className="fa-solid fa-dumbbell fa-3x" style={{marginBottom: '1rem'}}></i>
                            <p>Você não tem nenhum plano de treino ativo.</p>
                            <p>Crie um novo para começar a monitorar sua evolução.</p>
                        </div>
                    )}
                </div>
            )}

            {/* --- CONTEÚDO NUTRIÇÃO --- */}
            {activeTab === 'nutricao' && (
                <div className="tab-content fade-in">
                    <div className="section-header">
                        <div className="section-title">
                            {dietaAtiva ? (
                                <>
                                    <i className="fa-solid fa-utensils"></i>
                                    <span>{dietaAtiva.nome}</span>
                                    <span style={{fontSize:'0.8rem', marginLeft:'10px', color:'var(--text-secondary)'}}>
                                        ({Math.round(dietaAtiva.calorias_calculadas || 0)} kcal)
                                    </span>
                                </>
                            ) : <span>Sem dieta ativa</span>}
                        </div>
                        <button className="btn-new" onClick={() => alert("Modal Dieta em breve!")}>
                            <i className="fa-solid fa-plus"></i> Nova Dieta
                        </button>
                    </div>

                    {dietaAtiva ? (
                        <div className="dieta-container">
                            {dietaAtiva.refeicoes.sort((a,b) => a.ordem - b.ordem).map(ref => (
                                <div key={ref.id} className="refeicao-card">
                                    <div className="refeicao-header">
                                        <span><i className="fa-regular fa-clock"></i> {ref.horario} - {ref.nome}</span>
                                        <span style={{fontSize:'0.9rem', color:'var(--primary-color)'}}>
                                            {Math.round(ref.total_calorias_refeicao || 0)} kcal
                                        </span>
                                    </div>
                                    <div className="alimentos-list">
                                        {ref.alimentos.map(alim => (
                                            <div key={alim.id} className="alimento-row">
                                                <span>
                                                    <strong>{alim.nome}</strong> 
                                                    <span style={{color:'var(--text-secondary)', marginLeft:'8px'}}>
                                                        {alim.quantidade}{alim.unidade}
                                                    </span>
                                                </span>
                                                <div className="alimento-macros">
                                                    <span>P: {alim.proteina}g</span>
                                                    <span>C: {alim.carbo}g</span>
                                                    <span>G: {alim.gordura}g</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <i className="fa-solid fa-carrot fa-3x" style={{marginBottom: '1rem'}}></i>
                            <p>Você não tem nenhuma dieta ativa.</p>
                            <p>Configure suas refeições para bater os macros.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}