import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { 
    getBioData, 
    getPlanoAtivo, 
    getDietaAtiva 
} from '../../services/api';

import { BioModal } from './components/BioModal';
import { TreinoModal } from './components/TreinoModal';
import { DietaModal } from './components/DietaModal';

import './styles.css';

export function Ritmo() {
    const { addToast } = useToast();
    
    // Estados de Dados
    const [bio, setBio] = useState(null);
    const [volumeSemanal, setVolumeSemanal] = useState({});
    const [treinoAtivo, setTreinoAtivo] = useState(null);
    const [dietaAtiva, setDietaAtiva] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Estado da Aba
    const [activeTab, setActiveTab] = useState('treino');

    // Estados dos Modais
    const [showBioModal, setShowBioModal] = useState(false);
    const [showTreinoModal, setShowTreinoModal] = useState(false);
    const [showDietaModal, setShowDietaModal] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [bioRes, treinoRes, dietaRes] = await Promise.allSettled([
                getBioData(),
                getPlanoAtivo(),
                getDietaAtiva()
            ]);

            if (bioRes.status === 'fulfilled') {
                const data = bioRes.value;
                setBio(data.bio);
                setVolumeSemanal(data.volume_semanal || {}); 
            }

            if (treinoRes.status === 'fulfilled') {
                setTreinoAtivo(treinoRes.value);
            } else {
                setTreinoAtivo(null);
            }

            if (dietaRes.status === 'fulfilled') {
                setDietaAtiva(dietaRes.value);
            } else {
                setDietaAtiva(null);
            }

        } catch (error) {
            console.error("Erro crítico ao carregar Ritmo:", error);
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao sincronizar dados.' });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="ritmo-scope loading-screen">
            <i className="fa-solid fa-circle-notch fa-spin"></i>
            <p>Sincronizando metabolismo...</p>
        </div>
    );

    return (
        <div className="ritmo-scope main-container">
            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Ritmo</h1>
                    <p>Sincronize sua biologia: gestão inteligente de treino, dieta e bio-indicadores.</p>
                </div>
            </div>

            <div className="ritmo-content-wrapper">
                <div className="bio-grid-layout">
                    <div className="volume-summary-box full-height">
                        <div className="box-header">Volume Semanal (Sets)</div>
                        <div className="volume-vertical-list">
                            {Object.entries(volumeSemanal).length > 0 ? (
                                Object.entries(volumeSemanal).map(([grupo, series]) => (
                                    <div key={grupo} className="vol-tag">
                                        <span className="tag-muscle">{grupo}</span>
                                        <span className="tag-count">{series}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-list-msg">Sem dados de volume.</div>
                            )}
                        </div>
                    </div>

                    <div className="bio-right-column">
                        <div className="profile-info-card">
                            <button className="btn-adjust-profile-square" onClick={() => setShowBioModal(true)}>
                                <i className="fa-solid fa-sliders"></i>
                                <span>Ajustar Perfil</span>
                            </button>
                            
                            <div className="bio-indicator-group">
                                <div className="bio-mini-card">
                                    <label>Peso Atual</label>
                                    <strong>{bio?.peso || '--'} <span>kg</span></strong>
                                </div>
                                <div className="bio-mini-card">
                                    <label>Meta Diária</label>
                                    <strong>{bio?.gasto_calorico_total ? Math.round(bio.gasto_calorico_total) : '--'} <span>kcal</span></strong>
                                </div>
                                <div className="bio-mini-card">
                                    <label>Taxa Metabólica</label>
                                    <strong>{bio?.tmb || '--'} <span>kcal</span></strong>
                                </div>
                                <div className="bio-mini-card">
                                    <label>Hidratação</label>
                                    <strong>{bio?.meta_agua ? (bio.meta_agua).toFixed(1) : '--'} <span>L</span></strong>
                                </div>
                            </div>
                        </div>

                        <div className="macros-clean-container">
                            <div className="box-header">Distribuição de Macros</div>
                            <div className="macros-horizontal-row">
                                <div className="macro-item-mini">
                                    <span className="m-label">Proteína</span>
                                    <span className="m-val">{bio?.meta_proteina || 0}g</span>
                                </div>
                                <div className="macro-item-mini">
                                    <span className="m-label">Carbo</span>
                                    <span className="m-val">{bio?.meta_carbo || 0}g</span>
                                </div>
                                <div className="macro-item-mini">
                                    <span className="m-label">Gordura</span>
                                    <span className="m-val">{bio?.meta_gordura || 0}g</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="column-header-flex plans-header-container">
                    <div className="tab-selector-wrapper">
                        <button 
                            className={`tab-btn-pill ${activeTab === 'treino' ? 'active' : ''}`}
                            onClick={() => setActiveTab('treino')}
                        >
                            Plano de Treino
                        </button>
                        <button 
                            className={`tab-btn-pill ${activeTab === 'nutricao' ? 'active' : ''}`}
                            onClick={() => setActiveTab('nutricao')}
                        >
                            Plano de Dieta
                        </button>
                    </div>
                    
                    <div className="header-actions-group">
                        <button className="btn-primary" onClick={() => activeTab === 'treino' ? setShowTreinoModal(true) : setShowDietaModal(true)}>
                            <i className="fa-solid fa-plus"></i>
                            <span>{activeTab === 'treino' ? 'Novo Treino' : 'Nova Dieta'}</span>
                        </button>
                    </div>
                </div>

                <main className="ritmo-content-area">
                    {activeTab === 'treino' && (
                        <div className="tab-content fade-in">
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
                                                            <span className="carga-badge">{ex.carga_prevista}kg</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <i className="fa-solid fa-dumbbell fa-3x"></i>
                                    <p>Defina um plano de treino para ver os indicadores.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'nutricao' && (
                        <div className="tab-content fade-in">
                            {dietaAtiva ? (
                                <div className="dieta-container">
                                    {dietaAtiva.refeicoes.sort((a,b) => a.ordem - b.ordem).map(ref => (
                                        <div key={ref.id} className="refeicao-card">
                                            <div className="refeicao-header">
                                                <span><i className="fa-regular fa-clock"></i> {ref.horario} - {ref.nome}</span>
                                                <span className="ref-cal">{Math.round(ref.total_calorias_refeicao || 0)} kcal</span>
                                            </div>
                                            <div className="alimentos-list">
                                                {ref.alimentos.map(alim => (
                                                    <div key={alim.id} className="alimento-row">
                                                        <span>
                                                            <strong>{alim.nome}</strong> 
                                                            <small>{alim.quantidade}{alim.unidade}</small>
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
                                    <i className="fa-solid fa-carrot fa-3x"></i>
                                    <p>Sua nutrição é o combustível. Configure sua dieta.</p>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {showBioModal && <BioModal onClose={() => setShowBioModal(false)} onSuccess={loadData} />}
            {showTreinoModal && <TreinoModal onClose={() => setShowTreinoModal(false)} onSuccess={loadData} />}
            {showDietaModal && <DietaModal onClose={() => setShowDietaModal(false)} onSuccess={loadData} />}
        </div>
    );
}