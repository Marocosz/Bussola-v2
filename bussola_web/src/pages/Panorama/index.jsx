// src/pages/Panorama/index.jsx
import React, { useEffect, useState } from 'react';
import { getPanoramaData, getCategoryHistory } from '../../services/api';
import { KpiCard } from './components/KpiCard';
import { ProvisoesModal, RoteiroModal, RegistrosModal } from './components/PanoramaModals';
import './styles.css';

import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

export function Panorama() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Filtro de Período (Visual por enquanto, backend preparado para futuro)
    const [periodo, setPeriodo] = useState('Mensal'); 
    
    // Gráfico dinâmico
    const [selectedCategory, setSelectedCategory] = useState('');
    const [dynamicChartData, setDynamicChartData] = useState(null);

    // Modais
    const [modalProvisoesOpen, setModalProvisoesOpen] = useState(false);
    const [modalRoteiroOpen, setModalRoteiroOpen] = useState(false);
    const [modalRegistrosOpen, setModalRegistrosOpen] = useState(false);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const result = await getPanoramaData(); 
                setData(result);
                
                if (result.categorias_para_filtro.length > 0) {
                    const firstId = result.categorias_para_filtro[0].id;
                    setSelectedCategory(firstId);
                    fetchCategoryHistory(firstId);
                }
            } catch (error) {
                console.error("Erro", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [periodo]);

    const fetchCategoryHistory = async (id) => {
        try {
            const history = await getCategoryHistory(id);
            setDynamicChartData(history);
        } catch (error) { console.error(error); }
    };

    const handleCategoryChange = (e) => {
        const id = e.target.value;
        setSelectedCategory(id);
        fetchCategoryHistory(id);
    };

    if (loading && !data) return <div className="loading-container"><i className="fa-solid fa-compass fa-spin"></i></div>;
    if (!data) return <div className="container">Erro ao carregar dados.</div>;

    const { kpis } = data;
    const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Configurações Gráficos
    const roscaData = {
        labels: data.gastos_por_categoria.labels,
        datasets: [{
            data: data.gastos_por_categoria.data,
            backgroundColor: data.gastos_por_categoria.colors,
            borderWidth: 0,
        }],
    };

    const evolucaoData = {
        labels: data.evolucao_labels,
        datasets: [
            { label: 'Receitas', data: data.evolucao_mensal_receita, backgroundColor: '#27ae60', borderRadius: 4 },
            { label: 'Despesas', data: data.evolucao_mensal_despesa, backgroundColor: '#e74c3c', borderRadius: 4 },
        ],
    };

    const dynamicDataConfig = dynamicChartData ? {
        labels: dynamicChartData.labels,
        datasets: [{
            label: 'Evolução da Categoria (R$)',
            data: dynamicChartData.data,
            borderColor: '#4A6DFF',
            backgroundColor: 'rgba(74, 109, 255, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4
        }]
    } : null;

    return (
        <div className="container main-container panorama-scope">
            
            {/* 1. HERO SECTION */}
            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Panorama Geral</h1>
                    <p>Visão consolidada de finanças, compromissos e tarefas.</p>
                </div>
            </div>

            <div className="panorama-content-wrapper">
                
                {/* 2. PAINEL DE KPIS (HORIZONTAL) */}
                <div className="panel-section">
                    <div className="panel-header">
                        <h2>Indicadores Chave</h2>
                        <div className="period-selector">
                            <button className={periodo === 'Mensal' ? 'active' : ''} onClick={() => setPeriodo('Mensal')}>Mensal</button>
                            <button className={periodo === 'Trimestral' ? 'active' : ''} onClick={() => setPeriodo('Trimestral')}>Trimestral</button>
                            <button className={periodo === 'Semestral' ? 'active' : ''} onClick={() => setPeriodo('Semestral')}>Semestral</button>
                        </div>
                    </div>
                    
                    <div className="kpi-grid-horizontal">
                        {/* Finanças */}
                        <div className="kpi-group">
                            <span className="group-label">Finanças</span>
                            <div className="kpi-row finance-row">
                                <KpiCard iconClass="fa-solid fa-arrow-up" value={fmt(kpis.receita_mes)} label="Receita" type="receita" />
                                <KpiCard iconClass="fa-solid fa-arrow-down" value={fmt(kpis.despesa_mes)} label="Despesa" type="despesa" />
                                <KpiCard iconClass="fa-solid fa-scale-balanced" value={fmt(kpis.balanco_mes)} label="Balanço" type={kpis.balanco_mes >= 0 ? 'receita' : 'despesa'} />
                            </div>
                        </div>

                        <div className="divider-vertical"></div>

                        {/* Agenda */}
                        <div className="kpi-group">
                            <span className="group-label">Agenda</span>
                            <div className="kpi-row">
                                <KpiCard iconClass="fa-solid fa-check" value={kpis.compromissos_realizados} label="Realizados" type="receita" />
                                <KpiCard iconClass="fa-solid fa-hourglass" value={kpis.compromissos_pendentes} label="Pendentes" type="pendente" />
                                <KpiCard iconClass="fa-solid fa-xmark" value={kpis.compromissos_perdidos} label="Perdidos" type="despesa" />
                            </div>
                        </div>

                        <div className="divider-vertical"></div>

                        {/* Tarefas & Notas */}
                        <div className="kpi-group wide-group">
                            <span className="group-label">Registros</span>
                            <div className="kpi-row">
                                <KpiCard iconClass="fa-regular fa-note-sticky" value={kpis.total_anotacoes} label="Anotações" type="azul" />
                                <KpiCard iconClass="fa-solid fa-check-double" value={kpis.tarefas_concluidas} label="Concluídas" type="receita" />
                                
                                <div className="mini-stats-column">
                                    <span className="mini-stat-title">Tarefas Pendentes</span>
                                    <div className="mini-stat-grid">
                                        <span className="prio-tag critica" title="Crítica">{kpis.tarefas_pendentes.critica} <small>Crít.</small></span>
                                        <span className="prio-tag alta" title="Alta">{kpis.tarefas_pendentes.alta} <small>Alta</small></span>
                                        <span className="prio-tag media" title="Média">{kpis.tarefas_pendentes.media} <small>Méd.</small></span>
                                        <span className="prio-tag baixa" title="Baixa">{kpis.tarefas_pendentes.baixa} <small>Baixa</small></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="divider-vertical"></div>

                        {/* Cofre - Verticalizado */}
                        <div className="kpi-group cofre-group">
                            <span className="group-label">Cofre</span>
                            <div className="kpi-column">
                                <KpiCard iconClass="fa-solid fa-key" value={kpis.chaves_ativas} label="Ativas" type="azul" />
                                <KpiCard iconClass="fa-solid fa-lock-open" value={kpis.chaves_expiradas} label="Expiradas" type="despesa" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. PAINEL DE AÇÕES (BOTÕES) */}
                <div className="action-buttons-panel">
                    <button className="action-card-btn" onClick={() => setModalProvisoesOpen(true)}>
                        <div className="icon-box prov"><i className="fa-solid fa-file-invoice-dollar"></i></div>
                        <div className="text-box">
                            <h3>Provisões</h3>
                            <span>Contas a pagar e receber futuras</span>
                        </div>
                        <i className="fa-solid fa-chevron-right arrow"></i>
                    </button>

                    <button className="action-card-btn" onClick={() => setModalRoteiroOpen(true)}>
                        <div className="icon-box rot"><i className="fa-regular fa-calendar-check"></i></div>
                        <div className="text-box">
                            <h3>Roteiro</h3>
                            <span>Agenda e compromissos futuros</span>
                        </div>
                        <i className="fa-solid fa-chevron-right arrow"></i>
                    </button>

                    <button className="action-card-btn" onClick={() => setModalRegistrosOpen(true)}>
                        <div className="icon-box reg"><i className="fa-solid fa-list-check"></i></div>
                        <div className="text-box">
                            <h3>Registros</h3>
                            <span>Resumo de notas e tarefas</span>
                        </div>
                        <i className="fa-solid fa-chevron-right arrow"></i>
                    </button>
                </div>

                {/* 4. GRÁFICOS */}
                <div className="charts-grid-layout">
                    <div className="chart-wrapper">
                        <div className="chart-header">
                            <h3>Evolução Financeira</h3>
                        </div>
                        <div className="chart-body">
                            <Bar data={evolucaoData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} />
                        </div>
                    </div>

                    <div className="chart-wrapper">
                        <div className="chart-header">
                            <h3>Distribuição de Gastos</h3>
                        </div>
                        <div className="chart-body">
                            <Doughnut data={roscaData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }} />
                        </div>
                    </div>

                    <div className="chart-wrapper full-width">
                        <div className="chart-header with-select">
                            <h3>Histórico por Categoria</h3>
                            <select value={selectedCategory} onChange={handleCategoryChange} className="chart-select">
                                {data.categorias_para_filtro.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                        <div className="chart-body" style={{height: '300px'}}>
                            {dynamicDataConfig && <Line data={dynamicDataConfig} options={{ maintainAspectRatio: false }} />}
                        </div>
                    </div>
                </div>

            </div>

            {/* MODAIS */}
            {modalProvisoesOpen && <ProvisoesModal onClose={() => setModalProvisoesOpen(false)} />}
            {modalRoteiroOpen && <RoteiroModal onClose={() => setModalRoteiroOpen(false)} />}
            {modalRegistrosOpen && <RegistrosModal onClose={() => setModalRegistrosOpen(false)} />}
        </div>
    );
}