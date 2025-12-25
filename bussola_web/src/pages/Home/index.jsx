import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { getWeather, getNews } from '../../services/api'; // [NOVO] Importando funções separadas
import { useToast } from '../../context/ToastContext'; 
import { useSystem } from '../../context/SystemContext';
import { AuthContext } from '../../context/AuthContext';

import './styles.css';

// Importação das Imagens (Vite)
import walletAmico from '../../assets/images/Wallet-amico.svg';
import walletAmicoDark from '../../assets/images/Wallet-amico-dark.svg';
import systemPana from '../../assets/images/system-pana.svg';
import systemPanaDark from '../../assets/images/system-pana-dark.svg';

export function Home() {
    const { user } = useContext(AuthContext);
    const { isSelfHosted } = useSystem();
    const { addToast } = useToast();

    // Estado para o Relógio
    const [currentTime, setCurrentTime] = useState(new Date());

    // [NOVO] Estados separados para Clima e Notícias
    const [weatherData, setWeatherData] = useState(null);
    const [newsData, setNewsData] = useState([]);
    
    // [NOVO] Loadings independentes
    const [loadingWeather, setLoadingWeather] = useState(true);
    const [loadingNews, setLoadingNews] = useState(true);

    // Efeito: Relógio (Atualiza a cada segundo)
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // [NOVO] Efeito: Busca CLIMA (Separado)
    useEffect(() => {
        const fetchWeather = async () => {
            setLoadingWeather(true);
            try {
                const data = await getWeather();
                setWeatherData(data);
            } catch (error) {
                console.error("Erro ao carregar clima:", error);
            } finally {
                setLoadingWeather(false);
            }
        };

        if (user) {
            fetchWeather();
        }
    }, [user?.city]); // Recarrega se mudar a cidade

    // [NOVO] Efeito: Busca NOTÍCIAS (Separado)
    useEffect(() => {
        const fetchNews = async () => {
            setLoadingNews(true);
            try {
                const data = await getNews();
                setNewsData(data || []);
            } catch (error) {
                console.error("Erro ao carregar notícias:", error);
            } finally {
                setLoadingNews(false);
            }
        };

        if (user) {
            fetchNews();
        }
    }, [JSON.stringify(user?.news_preferences)]); // Recarrega se mudar preferências

    // Helpers de Formatação
    const formatTime = (date) => {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date) => {
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const formatted = date.toLocaleDateString('pt-BR', options);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    // Lógica de exibição da cidade
    const displayCity = user?.city || weatherData?.city || "Localização";

    return (
        <main className="container main-container">
            {/* Seção Hero */}
            <section className="hero-container">
                <div className="hero-content">
                    <div className="hero-text">
                        <h1>Bússola Hub</h1>
                        <p className="subtitle">
                            Este não é apenas um painel de controle; é um ecossistema integrado projetado para trazer clareza à
                            complexidade do seu dia a dia. Gerencie seus fluxos financeiros, domine sua agenda e proteja seus dados.
                        </p>
                    </div>

                    <div className="hero-info">
                        <div className="datetime-widget">
                            <div className="time-display">{formatTime(currentTime)}</div>
                            <div className="date-location-display">
                                <p>{formatDate(currentTime)}</p>
                                <p><i className="fa-solid fa-location-dot" style={{marginRight:'5px'}}></i> {displayCity}</p>
                            </div>
                        </div>

                        {/* Widget de Clima */}
                        <div className="weather-widget">
                            {loadingWeather ? (
                                <div className="weather-loading" style={{display:'flex', alignItems:'center', gap:'10px', width:'100%', justifyContent:'center'}}>
                                    <i className="fas fa-circle-notch fa-spin" style={{fontSize:'1.2rem', color:'var(--cor-azul-primario)'}}></i>
                                    <span>Atualizando...</span>
                                </div>
                            ) : weatherData ? (
                                <>
                                    <i className={`wi ${weatherData.icon_class}`}></i>
                                    <div className="weather-details">
                                        <span className="temperature">{weatherData.temperature}°C</span>
                                        <span className="description">{weatherData.description}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="weather-error" style={{textAlign:'center', width:'100%', fontSize:'0.85rem', color:'var(--cor-texto-secundario)'}}>
                                    <i className="fa-solid fa-cloud-slash"></i> Clima indisponível
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Seção de Funcionalidades */}
            <section className="features-presentation-area">
                <div className="feature-row">
                    <div className="feature-image-showcase">
                        <img src={walletAmico} alt="Análise de Finanças" className="theme-image image-light-mode" />
                        <img src={walletAmicoDark} alt="Análise de Finanças" className="theme-image image-dark-mode" />
                    </div>
                    <div className="feature-content-stack">
                        <div className="feature-item">
                            <h3 className="gradient-title">Provisões Financeiras</h3>
                            <p>Assuma o controle absoluto do seu fluxo de caixa. Desde o rastreamento de despesas recorrentes até a
                                visualização de orçamentos por categoria.</p>
                            <Link to="/financas" className="cta-link">
                                Explorar Finanças <i className="fa-solid fa-arrow-right-long"></i>
                            </Link>
                        </div>
                        <div className="feature-item">
                            <h3 className="gradient-title">Roteiro Estratégico</h3>
                            <p>Visualize seu tempo e organize seus compromissos com precisão, garantindo que você esteja sempre um passo à frente.</p>
                            <Link to="/agenda" className="cta-link">
                                Acessar Agenda <i className="fa-solid fa-arrow-right-long"></i>
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="feature-row">
                    <div className="feature-content-stack align-right">
                        <div className="feature-item">
                            <h3 className="gradient-title">Registros e Conhecimento</h3>
                            <p>Capture ideias, insights e informações importantes instantaneamente. Crie uma base de conhecimento pessoal estruturada.</p>
                            <Link to="/registros" className="cta-link">
                                <i className="fa-solid fa-arrow-left-long"></i> Ver Registros
                            </Link>
                        </div>
                        <div className="feature-item">
                            <h3 className="gradient-title">Cofre de Segredos</h3>
                            <p>Proteja suas informações mais sensíveis. Armazene senhas e credenciais com criptografia robusta.</p>
                            <Link to="/cofre" className="cta-link">
                                <i className="fa-solid fa-arrow-left-long"></i> Acessar Cofre
                            </Link>
                        </div>
                    </div>

                    <div className="feature-image-showcase">
                        <img src={systemPana} alt="Segurança" className="theme-image image-light-mode" />
                        <img src={systemPanaDark} alt="Segurança" className="theme-image image-dark-mode" />
                    </div>
                </div>
            </section>

            {/* Seção Panorama */}
            <section className="panorama-highlight-section">
                <div className="panorama-content">
                    <div className="panorama-icon"><i className="fa-solid fa-binoculars"></i></div>
                    <h2>Conheça o Panorama</h2>
                    <p>A visão de 30.000 pés da sua vida digital. O Panorama consolida métricas de finanças, agenda e produtividade
                        em um único dashboard inteligente.</p>
                    <Link to="/panorama" className="btn-primary large-button">Ver Panorama Completo</Link>
                </div>
            </section>

            {/* Sponsor Banner (Self-Hosted) */}
            {isSelfHosted && (
                <section className="sponsor-section" style={{
                    marginTop: '60px',
                    padding: '30px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                    border: '1px solid var(--cor-borda)',
                    textAlign: 'center'
                }}>
                    <div style={{maxWidth: '600px', margin: '0 auto'}}>
                        <h3 style={{fontSize: '1.5rem', marginBottom: '10px', color: 'var(--cor-destaque)'}}>
                            <i className="fa-solid fa-heart" style={{marginRight: '10px', color: '#e53e3e'}}></i>
                            Apoie o Projeto
                        </h3>
                        <p style={{marginBottom: '20px', color: 'var(--cor-texto-secundario)'}}>
                            O Bússola Self-Hosted é open-source. Torne-se um sponsor.
                        </p>
                        <button className="btn-primary" style={{borderRadius: '25px', padding: '10px 25px'}}>
                            Torne-se um Sponsor
                        </button>
                    </div>
                </section>
            )}

            {/* Footer de Notícias */}
            <footer className="news-footer-section">
                <div className="section-header">
                    <h2>
                        <i className="fa-regular fa-newspaper" style={{marginRight:'10px'}}></i> 
                        Feed Rápido
                    </h2>
                </div>
                
                <div className="news-grid">
                    {!loadingNews && newsData.length > 0 ? (
                        newsData.map((article, index) => (
                            <a key={index} href={article.url} target="_blank" rel="noopener noreferrer" className="news-card">
                                <span className="news-topic-badge">{article.topic || 'Geral'}</span>
                                <h4 className="news-title">{article.title}</h4>
                                <div className="news-meta">
                                    <span className="news-source">{article.source.name}</span>
                                    <i className="fa-solid fa-external-link-alt"></i>
                                </div>
                            </a>
                        ))
                    ) : (
                        <div className="news-error-state">
                            <i className="fa-solid fa-satellite-dish"></i>
                            <p>{loadingNews ? "Buscando atualizações..." : "Nenhuma notícia encontrada no momento."}</p>
                        </div>
                    )}
                </div>
            </footer>
        </main>
    );
}