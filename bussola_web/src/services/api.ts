import axios from 'axios';

// ==========================================================
// 1. CONFIGURAÇÃO BASE (Mantendo o seu original)
// ==========================================================
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/v1',
});

// Interceptor: Injeta o token automaticamente se ele existir
api.interceptors.request.use((config) => {
    // Mantive a sua chave específica '@Bussola:token'
    const token = localStorage.getItem('@Bussola:token');
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
});

// ==========================================================
// 2. MÓDULO HOME (Adições para a nova funcionalidade)
// ==========================================================

// Interfaces (Tipagem para o TypeScript saber o formato dos dados)
export interface WeatherData {
    temperature: number;
    description: string;
    icon_class: string;
}

export interface NewsArticle {
    title: string;
    url: string;
    source: { name: string };
    published_at: string;
}

export interface HomeData {
    weather: WeatherData | null;
    tech_news: NewsArticle[];
}

// Função para buscar os dados da Home
export const getHomeData = async (): Promise<HomeData> => {
    // Chama a rota GET http://127.0.0.1:8000/api/v1/home/
    const response = await api.get('/home/'); 
    return response.data;
};

export default api;