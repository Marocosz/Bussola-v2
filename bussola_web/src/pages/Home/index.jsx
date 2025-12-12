import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHomeData } from '../../services/api';
import './styles.css';

// Importação das Imagens (Vite)
import walletAmico from '../../assets/images/Wallet-amico.svg';
import walletAmicoDark from '../../assets/images/Wallet-amico-dark.svg';
import systemPana from '../../assets/images/system-pana.svg';
import systemPanaDark from '../../assets/images/system-pana-dark.svg';

export function Home() {
    // Estado para o Relógio
    const [currentTime, setCurrentTime] = useState(new Date());

    // Estado para Dados da API (Clima e Notícias)
    const [dashboardData, setDashboardData] = useState({
        weather: null,
        tech_news: []
    });
    const [loading, setLoading] = useState(true);

    // Efeito: Relógio (Tic-tac a cada segundo)
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Efeito: Busca Dados ao carregar
    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getHomeData();
                setDashboardData(data);
            } catch (error) {
                console.error("Erro ao carregar dados da Home:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Helpers de Formatação de Data
    const formatTime = (date) => {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date) => {
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const formatted = date.toLocaleDateString('pt-BR', options);
        // Capitaliza a primeira letra (ex: "segunda-feira" -> "Segunda-feira")
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    return (
        <main className="container main-container">
            {/* Seção Hero */}
            <section className="hero-container">
                <div className="hero-content">
                    <div className="hero-text">
                        <h1>Bússola Hub</h1>
                        <p className="subtitle">
                            Este não é apenas um painel de controle; é um ecossistema integrado projetado para trazer clareza à
                            complexidade do seu dia a dia. Gerencie seus fluxos financeiros, domine sua agenda, capture ideias e 
                            proteja dados críticos em uma interface unificada,
                            oferecendo clareza e controle total sobre suas informações.
                        </p>
                    </div>

                    <div className="hero-info">
                        <div className="datetime-widget">
                            <div className="time-display">{formatTime(currentTime)}</div>
                            <div className="date-location-display">
                                <p>{formatDate(currentTime)}</p>
                                <p>Uberlândia, BR</p>
                            </div>
                        </div>

                        {/* Widget de Clima (Com Loading State) */}
                        <div className="weather-widget">
                            {loading ? (
                                <div className="weather-loading" style={{display:'flex', alignItems:'center', gap:'10px', width:'100%', justifyContent:'center'}}>
                                    <i className="fas fa-circle-notch fa-spin" style={{fontSize:'1.2rem', color:'var(--cor-azul-primario)'}}></i>
                                    <span style={{fontSize:'0.9rem', color:'var(--cor-texto-secundario)'}}>Carregando clima...</span>
                                </div>
                            ) : dashboardData.weather ? (
                                <>
                                    <i className={`wi ${dashboardData.weather.icon_class}`}></i>
                                    <div className="weather-details">
                                        <span className="temperature">{dashboardData.weather.temperature}°C</span>
                                        <span className="description">{dashboardData.weather.description}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="weather-error" style={{textAlign:'center', width:'100%', fontSize:'0.9rem', color:'var(--cor-texto-secundario)'}}>
                                    Clima indisponível
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Seção de Funcionalidades */}
            <section className="features-presentation-area">
                
                {/* Linha 1: Finanças e Agenda */}
                <div className="feature-row">
                    <div className="feature-image-showcase">
                        {/* Lógica de Tema: Baseada na classe .light-theme no body (gerida externamente) */}
                        <img src={walletAmico} alt="Análise de Finanças e Agenda" className="theme-image image-light-mode" />
                        <img src={walletAmicoDark} alt="Análise de Finanças e Agenda" className="theme-image image-dark-mode" />
                    </div>
                    <div className="feature-content-stack">
                        <div className="feature-item">
                            <h3 className="gradient-title">Provisões Financeiras</h3>
                            <p>Assuma o controle absoluto do seu fluxo de caixa. Desde o rastreamento de despesas recorrentes até a
                                visualização de orçamentos por categoria, a Bússola transforma dados financeiros complexos em
                                insights claros e acionáveis.</p>
                            <Link to="/financas" className="cta-link">
                                Explorar Finanças <i className="fa-solid fa-arrow-right-long"></i>
                            </Link>
                        </div>
                        <div className="feature-item">
                            <h3 className="gradient-title">Roteiro Estratégico</h3>
                            <p>Visualize seu tempo e organize seus compromissos com precisão. A agenda integrada permite o
                                gerenciamento de tarefas e eventos, garantindo que você esteja sempre um passo à frente do seu
                                cronograma.</p>
                            <Link to="/agenda" className="cta-link">
                                Acessar Agenda <i className="fa-solid fa-arrow-right-long"></i>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Linha 2: Registros e Cofre */}
                <div className="feature-row">
                    <div className="feature-content-stack align-right">
                        <div className="feature-item">
                            <h3 className="gradient-title">Registros e Conhecimento</h3>
                            <p>Capture ideias, insights e informações importantes instantaneamente. Crie uma base de conhecimento
                                pessoal estruturada com notas, listas de tarefas e links de referência.</p>
                            <Link to="/registros" className="cta-link">
                                <i className="fa-solid fa-arrow-left-long"></i> Ver Registros
                            </Link>
                        </div>
                        <div className="feature-item">
                            <h3 className="gradient-title">Cofre de Segredos</h3>
                            <p>Proteja suas informações mais sensíveis. Armazene senhas, chaves de API e credenciais com
                                criptografia robusta, monitorando datas de expiração e acessando dados com segurança.</p>
                            <Link to="/cofre" className="cta-link">
                                <i className="fa-solid fa-arrow-left-long"></i> Acessar Cofre
                            </Link>
                        </div>
                    </div>

                    <div className="feature-image-showcase">
                        <img src={systemPana} alt="Segurança e Registros" className="theme-image image-light-mode" />
                        <img src={systemPanaDark} alt="Segurança e Registros" className="theme-image image-dark-mode" />
                    </div>
                </div>
            </section>

            {/* Seção Panorama */}
            <section className="panorama-highlight-section">
                <div className="panorama-content">
                    <div className="panorama-icon"><i className="fa-solid fa-binoculars"></i></div>
                    <h2>Conheça o Panorama</h2>
                    <p>A visão de 30.000 pés da sua vida digital. O Panorama consolida métricas de finanças, agenda e produtividade
                        em um único dashboard inteligente, permitindo que você identifique tendências e tome decisões baseadas em
                        dados com uma rapidez sem precedentes.</p>
                    <Link to="/panorama" className="btn-primary large-button">Ver Panorama Completo</Link>
                </div>
            </section>

            {/* Footer de Notícias */}
            <footer className="news-footer-section">
                <div className="section-header">
                    <h2>Feed Rápido de Tecnologia</h2>
                </div>
                <div className="news-list">
                    {!loading && dashboardData.tech_news.length > 0 ? (
                        dashboardData.tech_news.map((article, index) => (
                            <a key={index} href={article.url} target="_blank" rel="noopener noreferrer" className="news-item">
                                <span className="news-title">{article.title}</span>
                                <span className="news-source">{article.source.name}</span>
                            </a>
                        ))
                    ) : (
                        <p className="news-error" style={{textAlign: 'center', color: 'var(--cor-texto-secundario)'}}>
                            {loading ? "Carregando notícias..." : "Não foi possível carregar as notícias no momento."}
                        </p>
                    )}
                </div>
            </footer>
        </main>
    );
}