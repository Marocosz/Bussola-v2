import React, { useEffect, useState } from 'react';
import { getPanoramaData, getCategoryHistory } from '../../services/api'; // Importe a nova função
import { KpiCard } from './components/KpiCard';
import './styles.css';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement, // Necessário para linhas
  LineElement   // Necessário para linhas
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2'; // Importe Line

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement
);

export function Panorama() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Estados para o gráfico dinâmico
    const [selectedCategory, setSelectedCategory] = useState('');
    const [dynamicChartData, setDynamicChartData] = useState(null);

    useEffect(() => {
        async function loadData() {
            try {
                const result = await getPanoramaData();
                setData(result);
                
                // Se houver categorias, seleciona a primeira por padrão
                if (result.categorias_para_filtro.length > 0) {
                    const firstId = result.categorias_para_filtro[0].id;
                    setSelectedCategory(firstId);
                    // Busca dados da primeira categoria
                    fetchCategoryHistory(firstId);
                }
            } catch (error) {
                console.error("Erro ao carregar panorama", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Função para buscar dados quando muda o dropdown
    const fetchCategoryHistory = async (id) => {
        try {
            const history = await getCategoryHistory(id);
            setDynamicChartData(history);
        } catch (error) {
            console.error("Erro ao buscar histórico", error);
        }
    };

    const handleCategoryChange = (e) => {
        const id = e.target.value;
        setSelectedCategory(id);
        fetchCategoryHistory(id);
    };

    if (loading) return <div className="loading-screen">Carregando Panorama...</div>;
    if (!data) return <div className="container" style={{paddingTop:'100px'}}>Erro ao carregar.</div>;

    const { kpis } = data;
    const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // --- Configuração dos Gráficos Fixos ---
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
            { label: 'Receitas', data: data.evolucao_mensal_receita, backgroundColor: '#27ae60' },
            { label: 'Despesas', data: data.evolucao_mensal_despesa, backgroundColor: '#e74c3c' },
        ],
    };

    const semanalData = {
        labels: data.gasto_semanal.labels,
        datasets: [{
            label: 'Gasto Total',
            data: data.gasto_semanal.data,
            backgroundColor: '#4A6DFF',
        }],
    };

    // --- Configuração do Gráfico Dinâmico ---
    const dynamicDataConfig = dynamicChartData ? {
        labels: dynamicChartData.labels,
        datasets: [{
            label: 'Gasto (R$)',
            data: dynamicChartData.data,
            borderColor: '#4A6DFF',
            backgroundColor: 'rgba(74, 109, 255, 0.2)',
            fill: true,
            tension: 0.3
        }]
    } : null;

    return (
        <div className="container" style={{paddingTop: '100px'}}>
            <div className="page-header-actions">
                <h1>Panorama</h1>
                <button className="btn-primary">
                    <i className="fa-solid fa-file-excel"></i> Exportar Relatório
                </button>
            </div>

            <div className="panorama-grid">
                
                {/* COLUNA 1: KPIs */}
                <div className="kpi-column">
                    <KpiCard iconClass="fa-solid fa-arrow-up" value={fmt(kpis.receita_mes)} label="Receita do Mês" type="receita" />
                    <KpiCard iconClass="fa-solid fa-arrow-down" value={fmt(kpis.despesa_mes)} label="Despesa do Mês" type="despesa" />
                    <KpiCard iconClass="fa-solid fa-scale-balanced" value={fmt(kpis.balanco_mes)} label="Balanço do Mês" type={kpis.balanco_mes >= 0 ? 'receita' : 'despesa'} />
                    <hr className="kpi-divider" />
                    <KpiCard iconClass="fa-solid fa-check" value={kpis.compromissos_realizados} label="Compromissos Realizados" type="receita" />
                    <KpiCard iconClass="fa-solid fa-hourglass-half" value={kpis.compromissos_pendentes} label="Compromissos Pendentes" type="pendente" />
                    <KpiCard iconClass="fa-solid fa-times" value={kpis.compromissos_perdidos} label="Compromissos Perdidos" type="despesa" />
                    <hr className="kpi-divider" />
                    <KpiCard iconClass="fa-solid fa-key" value={kpis.chaves_ativas} label="Chaves Ativas" type="azul" />
                    <KpiCard iconClass="fa-solid fa-lock" value={kpis.chaves_expiradas} label="Chaves Expiradas" type="default" />
                </div>

                {/* COLUNA 2 */}
                <div className="charts-column">
                    <div className="chart-card">
                        <h3>Gastos por Categoria (Mês Atual)</h3>
                        <div className="chart-container">
                            <Doughnut data={roscaData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                        </div>
                    </div>
                    <div className="chart-card">
                        <h3>Padrão de Gasto Semanal</h3>
                        <div className="chart-container">
                            <Bar data={semanalData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                        </div>
                    </div>
                </div>

                {/* COLUNA 3 - COM O NOVO GRÁFICO */}
                <div className="charts-column">
                    <div className="chart-card">
                        <h3>Evolução Mensal (6 meses)</h3>
                        <div className="chart-container">
                            <Bar data={evolucaoData} options={{ maintainAspectRatio: false }} />
                        </div>
                    </div>

                    {/* --- GRÁFICO DINÂMICO ADICIONADO AQUI --- */}
                    <div className="chart-card">
                        <div className="chart-header-dynamic" style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'10px', marginBottom:'1rem'}}>
                            <h3>Gasto Mensal por</h3>
                            <select 
                                className="form-input-sm" 
                                value={selectedCategory} 
                                onChange={handleCategoryChange}
                                style={{padding: '5px', borderRadius: '5px', background: 'var(--cor-fundo)', color: 'var(--cor-texto-principal)', border: '1px solid var(--cor-borda)'}}
                            >
                                {data.categorias_para_filtro.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.nome}</option>
                                ))}
                            </select>
                        </div>
                        <div className="chart-container">
                            {dynamicDataConfig ? (
                                <Line data={dynamicDataConfig} options={{ maintainAspectRatio: false }} />
                            ) : (
                                <p style={{textAlign:'center', color: 'var(--cor-texto-secundario)'}}>Selecione uma categoria</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}