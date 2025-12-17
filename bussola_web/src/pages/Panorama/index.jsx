import React, { useEffect, useState } from 'react';
import { getPanoramaData, getCategoryHistory } from '../../services/api';
import { KpiCard } from './components/KpiCard';
import { ProvisoesModal, RoteiroModal, RegistrosModal } from './components/PanoramaModals';
import { useToast } from '../../context/ToastContext'; // <--- Import Novo
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
    const [periodo, setPeriodo] = useState('Mensal'); 
    
    // Gráfico dinâmico
    const [selectedCategory, setSelectedCategory] = useState('');
    const [dynamicChartData, setDynamicChartData] = useState(null);

    // Modais
    const [modalProvisoesOpen, setModalProvisoesOpen] = useState(false);
    const [modalRoteiroOpen, setModalRoteiroOpen] = useState(false);
    const [modalRegistrosOpen, setModalRegistrosOpen] = useState(false);

    const { addToast } = useToast(); // <--- Hook Novo

    const fetchCategoryHistory = async (id, currentPeriod) => {
        try {
            const history = await getCategoryHistory(id, currentPeriod);
            setDynamicChartData(history);
        } catch (error) { 
            console.error("Erro ao buscar histórico da categoria:", error);
            // Toast de erro
            addToast({ type: 'warning', title: 'Erro', description: 'Não foi possível carregar o histórico da categoria.' });
        }
    };

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const result = await getPanoramaData(periodo); 
                setData(result);
                
                if (result.categorias_para_filtro.length > 0) {
                    let targetId = selectedCategory;
                    const categoryExists = result.categorias_para_filtro.find(c => c.id === targetId);
                    
                    if (!targetId || !categoryExists) {
                        targetId = result.categorias_para_filtro[0].id;
                        setSelectedCategory(targetId);
                    }
                    await fetchCategoryHistory(targetId, periodo);
                }
            } catch (error) {
                console.error("Erro", error);
                addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar o Panorama.' });
            } finally {
                setLoading(false);
            }
        }
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodo]);

    const handleCategoryChange = (e) => {
        const id = e.target.value;
        setSelectedCategory(id);
        fetchCategoryHistory(id, periodo);
    };

    if (loading && !data) return (
        <div className="container main-container panorama-scope">
            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Panorama Geral</h1>
                    <p>Carregando seus indicadores...</p>
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
    const corPoupanca = poupanca >= 0 ? '#10b981' : '#ef4444'; 
    const restoPoupanca = 100 - taxaPoupancaVisual;

    const tarefasPendentesTotal = 
        kpis.tarefas_pendentes.critica + 
        kpis.tarefas_pendentes.alta + 
        kpis.tarefas_pendentes.media + 
        kpis.tarefas_pendentes.baixa;
    const tarefasConcluidas = kpis.tarefas_concluidas || 0;
    const totalTarefas = tarefasPendentesTotal + tarefasConcluidas;
    const taxaExecucao = totalTarefas > 0 ? (tarefasConcluidas / totalTarefas) * 100 : 0;

    let acumuladoAtual = 0;
    const saldoAcumuladoData = data.evolucao_mensal_receita.map((receita, index) => {
        const despesa = data.evolucao_mensal_despesa[index] || 0;
        const saldoMes = receita - despesa;
        acumuladoAtual += saldoMes;
        return acumuladoAtual;
    });

    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = Math.max(1, today.getDate());
    
    const mediaGastoDiario = despesaTotal / currentDay;
    const despesaProjetada = mediaGastoDiario * daysInMonth;
    const statusProjecao = despesaProjetada > receitaTotal ? 'danger' : 'safe';

    const weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const weekDistribution = [0.12, 0.11, 0.14, 0.13, 0.25, 0.15, 0.10]; 
    const weeklySpendData = weekDistribution.map(pct => despesaTotal * pct);

    // ==========================================
    // CONFIGURAÇÃO DOS GRÁFICOS
    // ==========================================

    const gaugeData = {
        labels: ['Poupado', 'Gasto'],
        datasets: [{
            data: [taxaPoupancaVisual, restoPoupanca],
            backgroundColor: [corPoupanca, 'rgba(255, 255, 255, 0.1)'],
            borderWidth: 0,
            cutout: '75%', circumference: 180, rotation: 270,
        }]
    };

    const execucaoData = {
        labels: ['Concluído', 'Pendente'],
        datasets: [{
            data: [tarefasConcluidas, tarefasPendentesTotal],
            backgroundColor: ['#3b82f6', 'rgba(59, 130, 246, 0.2)'],
            borderWidth: 0, cutout: '70%'
        }]
    };

    const evolucaoData = {
        labels: data.evolucao_labels,
        datasets: [
            { type: 'line', label: 'Saldo Acumulado', data: saldoAcumuladoData, borderColor: '#4A6DFF', borderWidth: 2, pointRadius: 3, tension: 0.4, order: 0 },
            { type: 'bar', label: 'Receitas', data: data.evolucao_mensal_receita, backgroundColor: '#27ae60', borderRadius: 4, order: 1 },
            { type: 'bar', label: 'Despesas', data: data.evolucao_mensal_despesa, backgroundColor: '#e74c3c', borderRadius: 4, order: 1 },
        ],
    };

    const radarTarefasData = {
        labels: ['Crítica', 'Alta', 'Média', 'Baixa'],
        datasets: [{
            label: 'Risco (Pendências)',
            data: [kpis.tarefas_pendentes.critica, kpis.tarefas_pendentes.alta, kpis.tarefas_pendentes.media, kpis.tarefas_pendentes.baixa],
            backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444', pointBackgroundColor: '#ef4444', pointBorderColor: '#fff',
        }]
    };

    const radarOptions = {
        scales: { r: { angleLines: { color: 'rgba(255,255,255,0.1)' }, grid: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { color: 'var(--cor-texto-secundario)', font: { size: 10 } }, ticks: { display: false, backdropColor: 'transparent' } } },
        plugins: { legend: { display: false } }, maintainAspectRatio: false
    };

    const roscaGastosData = {
        labels: data.gastos_por_categoria.labels,
        datasets: [{ data: data.gastos_por_categoria.data, backgroundColor: data.gastos_por_categoria.colors, borderWidth: 0, hoverOffset: 4 }],
    };

    const projecaoData = {
        labels: ['Gasto Atual', 'Projeção (Fim Mês)'],
        datasets: [{
            label: 'Valores (R$)',
            data: [despesaTotal, despesaProjetada],
            backgroundColor: ['#3b82f6', statusProjecao === 'danger' ? '#ef4444' : '#f59e0b'],
            borderRadius: 6,
            barThickness: 25,
        }]
    };

    const weeklyPatternData = {
        labels: weekLabels,
        datasets: [{
            label: 'Gasto Médio (Est.)',
            data: weeklySpendData,
            backgroundColor: (ctx) => {
                const value = ctx.raw;
                const max = Math.max(...weeklySpendData);
                const opacity = 0.3 + (value / max) * 0.7; 
                return `rgba(245, 158, 11, ${opacity})`;
            },
            borderRadius: 4,
        }]
    };

    const dynamicDataConfig = dynamicChartData ? {
        labels: dynamicChartData.labels,
        datasets: [{ label: `Evolução (${periodo})`, data: dynamicChartData.data, borderColor: '#4A6DFF', backgroundColor: 'rgba(74, 109, 255, 0.1)', fill: true, tension: 0.4, pointRadius: 4 }]
    } : null;

    return (
        <div className="container main-container panorama-scope">
            
            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Panorama Geral</h1>
                    <p>Inteligência financeira e produtividade em tempo real.</p>
                </div>
            </div>

            <div className="panorama-content-wrapper">
                
                {/* 1. KPIS GERAIS */}
                <div className="panel-section">
                    <div className="panel-header">
                        <h2>Indicadores Chave</h2>
                        <div className="period-selector">
                            {['Mensal', 'Trimestral', 'Semestral'].map(p => (
                                <button key={p} className={periodo === p ? 'active' : ''} onClick={() => setPeriodo(p)}>{p}</button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="kpi-grid-horizontal">
                        <div className="kpi-group">
                            <span className="group-label">Finanças</span>
                            <div className="kpi-row finance-row">
                                <KpiCard iconClass="fa-solid fa-arrow-up" value={fmt(kpis.receita_mes)} label="Receita" type="receita" />
                                <KpiCard iconClass="fa-solid fa-arrow-down" value={fmt(kpis.despesa_mes)} label="Despesa" type="despesa" />
                                <KpiCard iconClass="fa-solid fa-scale-balanced" value={fmt(kpis.balanco_mes)} label="Balanço" type={kpis.balanco_mes >= 0 ? 'receita' : 'despesa'} />
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
                <div className="charts-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
                    
                    {/* A. FLUXO DE CAIXA + ACUMULADO */}
                    <div className="chart-wrapper" style={{ gridColumn: 'span 8' }}>
                        <div className="chart-header"><h3>Fluxo de Caixa & Acumulado</h3></div>
                        <div className="chart-body">
                            <Bar data={evolucaoData} options={{ maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top' } } }} />
                        </div>
                    </div>

                    {/* B. VELOCÍMETRO (GAUGE) */}
                    <div className="chart-wrapper" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="chart-header" style={{ width: '100%' }}><h3>Taxa de Poupança</h3></div>
                        <div className="chart-body" style={{ height: '200px', width: '100%', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                            <Doughnut data={gaugeData} options={{ maintainAspectRatio: false, rotation: -90, circumference: 180, plugins: { legend: { display: false }, tooltip: { enabled: false } } }} />
                            <div style={{ position: 'absolute', bottom: '20%', textAlign: 'center' }}>
                                <span style={{ fontSize: '2rem', fontWeight: 'bold', color: corPoupanca }}>{taxaPoupanca.toFixed(1)}%</span>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--cor-texto-secundario)' }}>da receita economizada</p>
                            </div>
                        </div>
                    </div>

                    {/* C. PROJEÇÃO DE FIM DE MÊS (FORECASTING) */}
                    <div className="chart-wrapper" style={{ gridColumn: 'span 6' }}>
                        <div className="chart-header">
                            <h3>Forecasting (Projeção)</h3>
                            <span style={{ fontSize: '0.8rem', color: statusProjecao === 'danger' ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                                {statusProjecao === 'danger' ? 'ALERTA: Risco de fechar no negativo' : 'Ritmo Seguro'}
                            </span>
                        </div>
                        <div className="chart-body">
                            <Bar 
                                data={projecaoData} 
                                options={{ 
                                    indexAxis: 'y', 
                                    maintainAspectRatio: false,
                                    plugins: { legend: { display: false } },
                                    scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' } } }
                                }} 
                            />
                        </div>
                    </div>

                    {/* D. PADRÕES DE GASTO (HEATMAP SEMANAL) */}
                    <div className="chart-wrapper" style={{ gridColumn: 'span 6' }}>
                        <div className="chart-header">
                            <h3>Padrão Semanal de Gastos</h3>
                        </div>
                        <div className="chart-body">
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
                    <div className="chart-wrapper" style={{ gridColumn: 'span 4' }}>
                        <div className="chart-header"><h3>Gastos por Categoria</h3></div>
                        <div className="chart-body">
                            <Doughnut data={roscaGastosData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } } } }} />
                        </div>
                    </div>

                    {/* F. RADAR DE RISCO */}
                    <div className="chart-wrapper" style={{ gridColumn: 'span 4' }}>
                        <div className="chart-header"><h3>Perfil de Risco (Pendências)</h3></div>
                        <div className="chart-body">
                            <Radar data={radarTarefasData} options={radarOptions} />
                        </div>
                    </div>

                    {/* G. ÍNDICE DE PRODUTIVIDADE */}
                    <div className="chart-wrapper" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column' }}>
                        <div className="chart-header"><h3>Eficiência de Tarefas</h3></div>
                        <div className="chart-body" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '180px', height: '180px' }}>
                                <Doughnut data={execucaoData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                            </div>
                            <div style={{ position: 'absolute', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#3b82f6' }}>{taxaExecucao.toFixed(0)}%</span>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--cor-texto-secundario)' }}>Concluídas</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--cor-borda)' }}>
                            <div style={{ textAlign: 'center' }}>
                                <strong style={{ display: 'block', fontSize: '1.1rem' }}>{tarefasConcluidas}</strong>
                                <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto-secundario)' }}>Feitas</span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <strong style={{ display: 'block', fontSize: '1.1rem' }}>{tarefasPendentesTotal}</strong>
                                <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto-secundario)' }}>Pendentes</span>
                            </div>
                        </div>
                    </div>

                    {/* H. HISTÓRICO DETALHADO */}
                    <div className="chart-wrapper" style={{ gridColumn: 'span 12' }}>
                        <div className="chart-header with-select">
                            <h3>Histórico da Categoria</h3>
                            <select value={selectedCategory} onChange={handleCategoryChange} className="chart-select">
                                {data.categorias_para_filtro.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                        <div className="chart-body" style={{ height: '300px' }}>
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