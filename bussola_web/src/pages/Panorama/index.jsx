import React, { useEffect, useState } from 'react';
import { getPanoramaData, getCategoryHistory } from '../../services/api';
import { logger } from '../../utils/logger';
import { KpiCard } from './components/KpiCard';
import { ProvisoesModal, RoteiroModal, RegistrosModal } from './components/PanoramaModals';
import { useToast } from '../../context/ToastContext';
import { CustomSelect } from '../../components/CustomSelect'; // Reaproveitando componente
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { computeRange } from '../../utils/dateRange';
import { useThemeColors } from '../../hooks/useThemeColors';
import './styles.css';

import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, 
  ArcElement, PointElement, LineElement, RadialLinearScale, Filler
} from 'chart.js';
import { Bar, Doughnut, Line, Radar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, 
    ArcElement, PointElement, LineElement, RadialLinearScale, Filler
);

export function Panorama() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Filtro de período: intervalo de datas (presets + personalizado), estilo Provisões.
    const [range, setRange] = useState(() => computeRange('mes'));
    
    // Modo Privacidade
    const [privacyMode, setPrivacyMode] = useState(() => {
        return localStorage.getItem('panorama_privacy') === 'true';
    });
    
    // Gráfico dinâmico
    const [selectedCategory, setSelectedCategory] = useState('');
    const [dynamicChartData, setDynamicChartData] = useState(null);

    // Modais
    const [modalProvisoesOpen, setModalProvisoesOpen] = useState(false);
    const [modalRoteiroOpen, setModalRoteiroOpen] = useState(false);
    const [modalRegistrosOpen, setModalRegistrosOpen] = useState(false);

    // Hooks de Contexto
    const { addToast } = useToast();
    const C = useThemeColors();

    // Toggle Privacy
    const togglePrivacy = () => {
        const newState = !privacyMode;
        setPrivacyMode(newState);
        localStorage.setItem('panorama_privacy', newState);
    };

    const fetchCategoryHistory = async (id) => {
        try {
            // Nota: O endpoint de histórico ainda usa lógica padrão de 6 meses
            const history = await getCategoryHistory(id);
            setDynamicChartData(history);
        } catch (error) { 
            logger.error("Erro ao buscar histórico da categoria", { error: String(error) });
            addToast({ type: 'warning', title: 'Atenção', description: 'Não foi possível carregar o histórico detalhado.' });
        }
    };

    // Chamada principal API
    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const result = await getPanoramaData(range?.start, range?.end);
                setData(result);
                
                if (result.categorias_para_filtro.length > 0) {
                    let targetId = selectedCategory;
                    const categoryExists = result.categorias_para_filtro.find(c => c.id === targetId);
                    
                    if (!targetId || !categoryExists) {
                        targetId = result.categorias_para_filtro[0].id;
                        setSelectedCategory(targetId);
                    }
                    await fetchCategoryHistory(targetId);
                }
            } catch (error) {
                logger.error("Erro inesperado", { error: String(error) });
                addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar o Panorama Geral.' });
            } finally {
                setLoading(false);
            }
        }
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range?.start, range?.end]);

    const handleCategoryChange = (e) => {
        const id = e.target.value;
        setSelectedCategory(Number(id));
        fetchCategoryHistory(id);
    };

    if (loading && !data) return (
        <div className="container main-container panorama-scope">
            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-gauge-high"></i> Panorama</h1>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--cor-azul-primario)' }}></i>
            </div>
        </div>
    );

    if (!data) return <div className="container">Erro ao carregar dados.</div>;

    const { kpis } = data;
    const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // ==========================================
    // CÁLCULOS DE BI
    // ==========================================

    const receitaTotal = kpis.receita_mes || 0;
    const despesaTotal = kpis.despesa_mes || 0;
    const poupanca = receitaTotal - despesaTotal;
    let taxaPoupanca = receitaTotal > 0 ? (poupanca / receitaTotal) * 100 : 0;
    const taxaPoupancaVisual = Math.max(0, Math.min(100, taxaPoupanca));
    const corPoupanca = poupanca >= 0 ? C.verde : C.vermelho;
    const restoPoupanca = 100 - taxaPoupancaVisual;

    const tarefasPendentesTotal =
        kpis.tarefas_pendentes.critica +
        kpis.tarefas_pendentes.alta +
        kpis.tarefas_pendentes.media +
        kpis.tarefas_pendentes.baixa;
    const tarefasConcluidas = kpis.tarefas_concluidas || 0;
    const totalTarefas = tarefasPendentesTotal + tarefasConcluidas;
    const taxaExecucao = totalTarefas > 0 ? (tarefasConcluidas / totalTarefas) * 100 : 0;

    // [P0] Linha de Caixa REAL vinda do backend (patrimônio, com baseline) —
    // não mais uma soma-corrente falsa começando do zero.
    const saldoAcumuladoData = data.evolucao_caixa_real || [];

    // [P0] Forecast honesto: só existe quando hoje ∈ período (senão, período fechado).
    const fc = data.forecast;
    const statusProjecao = fc?.status || 'safe';
    const weeklySpendData = data.gasto_semanal.data; // média por dia da semana (backend)

    // ==========================================
    // CONFIGURAÇÃO DOS GRÁFICOS
    // ==========================================

    const gaugeData = {
        labels: ['Poupado', 'Gasto'],
        datasets: [{
            data: [taxaPoupancaVisual, restoPoupanca],
            backgroundColor: [corPoupanca, C.trilho],
            borderWidth: 0,
            cutout: '75%', circumference: 180, rotation: 270,
        }]
    };

    const execucaoData = {
        labels: ['Concluído', 'Pendente'],
        datasets: [{
            data: [tarefasConcluidas, tarefasPendentesTotal],
            backgroundColor: [C.azul, C.trilho],
            borderWidth: 0, cutout: '70%'
        }]
    };

    const evolucaoData = {
        labels: data.evolucao_labels,
        datasets: [
            { type: 'line', label: 'Caixa (patrimônio)', data: saldoAcumuladoData, borderColor: C.azul, borderWidth: 2, pointRadius: 2, tension: 0.4, order: 0 },
            { type: 'bar', label: 'Receitas', data: data.evolucao_mensal_receita, backgroundColor: C.verde, borderRadius: 4, order: 1 },
            { type: 'bar', label: 'Despesas', data: data.evolucao_mensal_despesa, backgroundColor: C.vermelho, borderRadius: 4, order: 1 },
        ],
    };

    const radarTarefasData = {
        labels: ['Crítica', 'Alta', 'Média', 'Baixa'],
        datasets: [{
            label: 'Risco (Pendências)',
            data: [kpis.tarefas_pendentes.critica, kpis.tarefas_pendentes.alta, kpis.tarefas_pendentes.media, kpis.tarefas_pendentes.baixa],
            backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: C.vermelho, pointBackgroundColor: C.vermelho, pointBorderColor: C.texto,
        }]
    };

    const radarOptions = {
        scales: { r: { angleLines: { color: C.grid }, grid: { color: C.grid }, pointLabels: { color: C.textoSec, font: { size: 10 } }, ticks: { display: false, backdropColor: 'transparent' } } },
        plugins: { legend: { display: false } }, maintainAspectRatio: false
    };

    const roscaGastosData = {
        labels: data.gastos_por_categoria.labels,
        datasets: [{ data: data.gastos_por_categoria.data, backgroundColor: data.gastos_por_categoria.colors, borderWidth: 0, hoverOffset: 4 }],
    };

    const projecaoData = fc ? {
        labels: ['Realizado', 'Projeção (fim período)'],
        datasets: [{
            label: 'Valores (R$)',
            data: [fc.realizado, fc.projetado],
            backgroundColor: [C.azul, statusProjecao === 'danger' ? C.vermelho : C.laranja],
            borderRadius: 6,
            barThickness: 25,
        }]
    } : null;

    const weeklyPatternData = {
        labels: data.gasto_semanal.labels,
        datasets: [{
            label: 'Média por dia (R$)',
            data: weeklySpendData,
            backgroundColor: (ctx) => {
                const value = ctx.raw;
                const max = Math.max(...weeklySpendData, 1); // Evita divisão por zero
                const opacity = 0.3 + (value / max) * 0.7;
                return `rgba(245, 158, 11, ${opacity})`;
            },
            borderRadius: 4,
        }]
    };

    const dynamicDataConfig = dynamicChartData ? {
        labels: dynamicChartData.labels,
        datasets: [{ label: `Evolução Histórica`, data: dynamicChartData.data, borderColor: C.azul, backgroundColor: 'rgba(74, 109, 255, 0.1)', fill: true, tension: 0.4, pointRadius: 4 }]
    } : null;

    return (
        <div className="container main-container panorama-scope">
            
            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-gauge-high"></i> Panorama</h1>
                </div>
            </div>

            <div className="panorama-content-wrapper">
                
                {/* 1. KPIS GERAIS */}
                <div className="panel-section">
                    <div className="panel-header">
                        <div className="panel-header-left">
                            <h2>Indicadores Chave</h2>
                            <button className={`btn-privacy-toggle ${privacyMode ? 'active' : ''}`} onClick={togglePrivacy} title={privacyMode ? "Mostrar valores" : "Ocultar valores"}>
                                <i className={`fa-solid ${privacyMode ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                        
                        <div className="period-controls-group">
                            <DateRangeFilter initialPreset="mes" onChange={setRange} />
                        </div>
                    </div>
                    
                    <div className="kpi-grid-horizontal">
                        <div className="kpi-group">
                            <span className="group-label">Finanças</span>
                            <div className="kpi-row finance-row">
                                <KpiCard iconClass="fa-solid fa-arrow-up" value={fmt(kpis.receita_mes)} label="Receita" type="receita" isPrivacy={privacyMode} />
                                <KpiCard iconClass="fa-solid fa-arrow-down" value={fmt(kpis.despesa_mes)} label="Despesa" type="despesa" isPrivacy={privacyMode} />
                                <KpiCard iconClass="fa-solid fa-scale-balanced" value={fmt(kpis.balanco_mes)} label="Balanço" type={kpis.balanco_mes >= 0 ? 'receita' : 'despesa'} isPrivacy={privacyMode} />
                                <KpiCard iconClass="fa-solid fa-vault" value={fmt(kpis.caixa)} label="Caixa" type="azul" isPrivacy={privacyMode} />
                            </div>
                        </div>
                        <div className="divider-vertical"></div>
                        <div className="kpi-group">
                            <span className="group-label">Agenda</span>
                            <div className="kpi-row">
                                <KpiCard iconClass="fa-solid fa-check" value={kpis.compromissos_realizados} label="Realizados" type="receita" />
                                <KpiCard iconClass="fa-solid fa-hourglass" value={kpis.compromissos_pendentes} label="Pendentes" type="pendente" />
                                <KpiCard iconClass="fa-solid fa-xmark" value={kpis.compromissos_perdidos} label="Perdidos" type="despesa" />
                            </div>
                        </div>
                        <div className="divider-vertical"></div>
                        <div className="kpi-group wide-group">
                            <span className="group-label">Registros</span>
                            <div className="kpi-row">
                                <KpiCard iconClass="fa-regular fa-note-sticky" value={kpis.total_anotacoes} label="Anotações" type="azul" />
                                <KpiCard iconClass="fa-solid fa-check-double" value={kpis.tarefas_concluidas} label="Concluídas" type="receita" />
                                <div className="mini-stats-column">
                                    <span className="mini-stat-title">Tarefas Pendentes</span>
                                    <div className="mini-stat-grid">
                                        <span className="prio-tag critica">{kpis.tarefas_pendentes.critica} <small>Crít.</small></span>
                                        <span className="prio-tag alta">{kpis.tarefas_pendentes.alta} <small>Alta</small></span>
                                        <span className="prio-tag media">{kpis.tarefas_pendentes.media} <small>Méd.</small></span>
                                        <span className="prio-tag baixa">{kpis.tarefas_pendentes.baixa} <small>Baixa</small></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="divider-vertical"></div>
                        <div className="kpi-group cofre-group">
                            <span className="group-label">Cofre</span>
                            <div className="kpi-column">
                                <KpiCard iconClass="fa-solid fa-key" value={kpis.chaves_ativas} label="Ativas" type="azul" />
                                <KpiCard iconClass="fa-solid fa-lock-open" value={kpis.chaves_expiradas} label="Expiradas" type="despesa" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. PAINEL DE AÇÕES RAPIDAS */}
                <div className="action-buttons-panel">
                    <button className="action-card-btn" onClick={() => setModalProvisoesOpen(true)}>
                        <div className="icon-box prov"><i className="fa-solid fa-file-invoice-dollar"></i></div>
                        <div className="text-box"><h3>Provisões</h3><span>Contas a pagar/receber</span></div>
                        <i className="fa-solid fa-chevron-right arrow"></i>
                    </button>
                    <button className="action-card-btn" onClick={() => setModalRoteiroOpen(true)}>
                        <div className="icon-box rot"><i className="fa-regular fa-calendar-check"></i></div>
                        <div className="text-box"><h3>Roteiro</h3><span>Agenda e compromissos</span></div>
                        <i className="fa-solid fa-chevron-right arrow"></i>
                    </button>
                    <button className="action-card-btn" onClick={() => setModalRegistrosOpen(true)}>
                        <div className="icon-box reg"><i className="fa-solid fa-list-check"></i></div>
                        <div className="text-box"><h3>Registros</h3><span>Notas e tarefas</span></div>
                        <i className="fa-solid fa-chevron-right arrow"></i>
                    </button>
                </div>

                {/* 3. GRID DE INTELEGÊNCIA & GRÁFICOS */}
                <div className="charts-grid-layout">
                    
                    {/* A. FLUXO DE CAIXA + ACUMULADO */}
                    <div className="chart-wrapper span-8">
                        <div className="chart-header"><h3>Fluxo & Caixa <span className="chart-subtitle">· últimos 12 meses</span></h3></div>
                        <div className={`chart-body ${privacyMode ? 'privacy-blur' : ''}`}>
                            <Bar data={evolucaoData} options={{ maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top' } } }} />
                        </div>
                    </div>

                    {/* B. VELOCÍMETRO (GAUGE) */}
                    <div className="chart-wrapper span-4 gauge-wrapper">
                        <div className="chart-header full-width"><h3>Taxa de Poupança</h3></div>
                        <div className={`chart-body gauge-body ${privacyMode ? 'privacy-blur' : ''}`}>
                            <Doughnut data={gaugeData} options={{ maintainAspectRatio: false, rotation: -90, circumference: 180, plugins: { legend: { display: false }, tooltip: { enabled: false } } }} />
                            <div className="gauge-center-label">
                                <span className="gauge-percentage" style={{ color: corPoupanca }}>{taxaPoupanca.toFixed(1)}%</span>
                                <p className="gauge-subtitle">da receita economizada</p>
                            </div>
                        </div>
                    </div>

                    {/* C. PROJEÇÃO DE FIM DE PERÍODO (FORECASTING) */}
                    <div className="chart-wrapper span-6">
                        <div className="chart-header">
                            <h3>Projeção do período</h3>
                            {fc && (
                                <span className={`forecast-status ${statusProjecao}`}>
                                    {statusProjecao === 'danger' ? 'ALERTA: ritmo acima da receita' : 'Ritmo seguro'}
                                </span>
                            )}
                        </div>
                        <div className={`chart-body ${privacyMode ? 'privacy-blur' : ''}`}>
                            {fc ? (
                                <Bar
                                    data={projecaoData}
                                    options={{
                                        indexAxis: 'y',
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: { x: { grid: { color: C.grid } } }
                                    }}
                                />
                            ) : (
                                <div className="panorama-empty-note">
                                    <i className="fa-solid fa-calendar-check"></i>
                                    <p>Período fechado</p>
                                    <span>Balanço realizado: <strong>{fmt(kpis.balanco_mes)}</strong></span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* D. PADRÕES DE GASTO (HEATMAP SEMANAL) */}
                    <div className="chart-wrapper span-6">
                        <div className="chart-header">
                            <h3>Média por dia da semana</h3>
                        </div>
                        <div className={`chart-body ${privacyMode ? 'privacy-blur' : ''}`}>
                            <Bar 
                                data={weeklyPatternData} 
                                options={{ 
                                    maintainAspectRatio: false,
                                    plugins: { legend: { display: false } },
                                    scales: { 
                                        y: { display: false },
                                        x: { grid: { display: false } }
                                    }
                                }} 
                            />
                        </div>
                    </div>

                    {/* E. DISTRIBUIÇÃO DE GASTOS */}
                    <div className="chart-wrapper span-4">
                        <div className="chart-header"><h3>Gastos por Categoria</h3></div>
                        <div className={`chart-body ${privacyMode ? 'privacy-blur' : ''}`}>
                            <Doughnut data={roscaGastosData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } } } }} />
                        </div>
                    </div>

                    {/* F. RADAR DE RISCO */}
                    <div className="chart-wrapper span-4">
                        <div className="chart-header"><h3>Perfil de Risco (Pendências)</h3></div>
                        <div className="chart-body">
                            <Radar data={radarTarefasData} options={radarOptions} />
                        </div>
                    </div>

                    {/* G. ÍNDICE DE PRODUTIVIDADE */}
                    <div className="chart-wrapper span-4 col-flex">
                        <div className="chart-header"><h3>Eficiência de Tarefas</h3></div>
                        <div className="chart-body centered-body">
                            <div className="donut-container">
                                <Doughnut data={execucaoData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                            </div>
                            <div className="donut-center-label">
                                <span className="donut-percentage">{taxaExecucao.toFixed(0)}%</span>
                                <p className="donut-sublabel">Concluídas</p>
                            </div>
                        </div>
                        <div className="efficiency-footer">
                            <div className="efficiency-stat">
                                <strong>{tarefasConcluidas}</strong>
                                <span>Feitas</span>
                            </div>
                            <div className="efficiency-stat">
                                <strong>{tarefasPendentesTotal}</strong>
                                <span>Pendentes</span>
                            </div>
                        </div>
                    </div>

                    {/* H. HISTÓRICO DETALHADO */}
                    <div className="chart-wrapper span-12">
                        <div className="chart-header with-select">
                            <h3>Histórico da Categoria</h3>
                            <div className="category-select-wrapper">
                                <CustomSelect
                                    name="categoryHistory"
                                    value={selectedCategory}
                                    options={data.categorias_para_filtro.map(c => ({ value: c.id, label: c.nome }))}
                                    onChange={handleCategoryChange}
                                />
                            </div>
                        </div>
                        <div className={`chart-body tall-body ${privacyMode ? 'privacy-blur' : ''}`}>
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