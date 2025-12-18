import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { 
    getBioData, 
    getPlanoAtivo, 
    getDietaAtiva,
    getDietas,
    ativarDieta,
    deleteDieta
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
    const [dietas, setDietas] = useState([]); // Todas as dietas criadas
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); // Estado para atualizações sem "flash"
    
    // Estado da Aba
    const [activeTab, setActiveTab] = useState('treino');

    // Estados dos Modais
    const [showBioModal, setShowBioModal] = useState(false);
    const [showTreinoModal, setShowTreinoModal] = useState(false);
    const [showDietaModal, setShowDietaModal] = useState(false);
    
    // Estado para Edição
    const [dietaParaEditar, setDietaParaEditar] = useState(null);

    useEffect(() => {
        loadData(true); // Carga inicial com loading screen
    }, []);

    const loadData = async (initial = false) => {
        if (initial) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const [bioRes, treinoRes, dietaAtivaRes, todasDietasRes] = await Promise.allSettled([
                getBioData(),
                getPlanoAtivo(),
                getDietaAtiva(),
                getDietas()
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

            if (dietaAtivaRes.status === 'fulfilled') {
                setDietaAtiva(dietaAtivaRes.value);
            } else {
                setDietaAtiva(null);
            }

            if (todasDietasRes.status === 'fulfilled') {
                setDietas(todasDietasRes.value);
            }

        } catch (error) {
            console.error("Erro crítico ao carregar Ritmo:", error);
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao sincronizar dados.' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleAtivarDieta = async (id) => {
        try {
            setRefreshing(true);
            await ativarDieta(id);
            addToast({ type: 'success', title: 'Dieta Ativada', description: 'Plano alimentar atualizado com sucesso.' });
            await loadData(false);
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível ativar esta dieta.' });
            setRefreshing(false);
        }
    };

    const handleEditarDieta = (dieta) => {
        setDietaParaEditar(dieta);
        setShowDietaModal(true);
    };

    const handleExcluirDieta = async (id) => {
        if (!window.confirm("Deseja realmente excluir esta dieta?")) return;
        try {
            setRefreshing(true);
            await deleteDieta(id);
            addToast({ type: 'success', title: 'Excluído', description: 'Dieta removida do histórico.' });
            await loadData(false);
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Erro ao excluir dieta.' });
            setRefreshing(false);
        }
    };

    const handleCloseDietaModal = () => {
        setShowDietaModal(false);
        setDietaParaEditar(null);
    };

    // Função auxiliar para calcular macros totais de uma refeição
    const calcMealMacros = (alimentos) => {
        return alimentos.reduce((acc, curr) => ({
            kcal: acc.kcal + curr.calorias,
            p: acc.p + curr.proteina,
            c: acc.c + curr.carbo,
            g: acc.g + curr.gordura
        }), { kcal: 0, p: 0, c: 0, g: 0 });
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

                {/* Container principal com efeito visual de refresh silencioso */}
                <main className="ritmo-content-area" style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
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
                            {/* Seletor de Dietas Criadas */}
                            <div className="diet-selection-section">
                                <h3 className="section-subtitle">Meus Planos de Dieta</h3>
                                <div className="plans-horizontal-selector">
                                    {dietas.map(dieta => (
                                        <div key={dieta.id} className={`plan-mini-card ${dieta.ativo ? 'active' : ''}`}>
                                            <div className="plan-info">
                                                <span className="plan-name">{dieta.nome}</span>
                                                <span className="plan-cal">{Math.round(dieta.calorias_calculadas)} kcal</span>
                                            </div>
                                            <div className="plan-actions">
                                                {!dieta.ativo && (
                                                    <button title="Ativar" onClick={() => handleAtivarDieta(dieta.id)}><i className="fa-solid fa-play"></i></button>
                                                )}
                                                <button title="Editar" onClick={() => handleEditarDieta(dieta)}><i className="fa-solid fa-pen-to-square"></i></button>
                                                <button title="Excluir" onClick={() => handleExcluirDieta(dieta.id)} className="btn-del"><i className="fa-solid fa-trash"></i></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {dietaAtiva ? (
                                <div className="dieta-grid-custom">
                                    {dietaAtiva.refeicoes.sort((a,b) => a.ordem - b.ordem).map(ref => {
                                        const totals = calcMealMacros(ref.alimentos);
                                        return (
                                            <div key={ref.id} className="refeicao-card-pro">
                                                <div className="refeicao-pro-header">
                                                    <div className="ref-title-group">
                                                        <span className="ref-time">{ref.horario}</span>
                                                        <span className="ref-name">{ref.nome}</span>
                                                    </div>
                                                    <div className="ref-total-badge">
                                                        {Math.round(totals.kcal)} kcal
                                                    </div>
                                                </div>
                                                
                                                <div className="alimentos-table-wrapper">
                                                    <table className="alimentos-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Item</th>
                                                                <th className="text-right">Qtd</th>
                                                                <th className="text-right">P</th>
                                                                <th className="text-right">C</th>
                                                                <th className="text-right">G</th>
                                                                <th className="text-right">Kcal</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {ref.alimentos.map(alim => (
                                                                <tr key={alim.id}>
                                                                    <td className="alim-name-td">{alim.nome}</td>
                                                                    <td className="text-right alim-sub">{alim.quantidade}{alim.unidade}</td>
                                                                    <td className="text-right">{Math.round(alim.proteina)}g</td>
                                                                    <td className="text-right">{Math.round(alim.carbo)}g</td>
                                                                    <td className="text-right">{Math.round(alim.gordura)}g</td>
                                                                    <td className="text-right weight-700">{Math.round(alim.calorias)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div className="refeicao-pro-footer">
                                                    <div className="macro-summary-pill">
                                                        <span className="m-p">P: {Math.round(totals.p)}g</span>
                                                        <span className="m-c">C: {Math.round(totals.c)}g</span>
                                                        <span className="m-g">G: {Math.round(totals.g)}g</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
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

            {showBioModal && <BioModal onClose={() => setShowBioModal(false)} onSuccess={() => loadData(false)} />}
            {showTreinoModal && <TreinoModal onClose={() => setShowTreinoModal(false)} onSuccess={() => loadData(false)} />}
            {showDietaModal && (
                <DietaModal 
                    onClose={handleCloseDietaModal} 
                    onSuccess={() => loadData(false)} 
                    initialData={dietaParaEditar}
                />
            )}
        </div>
    );
}