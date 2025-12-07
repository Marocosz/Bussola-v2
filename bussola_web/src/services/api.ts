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
// 2. MÓDULO HOME
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

// ==========================================================
// 3. MÓDULO FINANÇAS
// ==========================================================

// Interfaces para tipagem dos dados financeiros
export interface Categoria {
    id: number;
    nome: string;
    tipo: 'despesa' | 'receita';
    icone: string;
    cor: string;
    meta_limite: number;
    total_gasto?: number; // Calculado no backend
    total_ganho?: number; // Calculado no backend
}

export interface Transacao {
    id: number;
    descricao: string;
    valor: number;
    data: string; // Vem como ISO String do backend
    categoria_id: number;
    categoria?: Categoria; // Objeto aninhado
    tipo_recorrencia: 'pontual' | 'parcelada' | 'recorrente';
    status: 'Pendente' | 'Efetivada';
    parcela_atual?: number;
    total_parcelas?: number;
    frequencia?: string;
}

export interface FinancasDashboard {
    categorias_despesa: Categoria[];
    categorias_receita: Categoria[];
    transacoes_pontuais: Record<string, Transacao[]>;     // Objeto { "Janeiro/2025": [lista...] }
    transacoes_recorrentes: Record<string, Transacao[]>;  // Objeto { "Janeiro/2025": [lista...] }
    icones_disponiveis: string[];
    cores_disponiveis: string[];
}

// --- Chamadas API Finanças ---

// Busca o dashboard completo (Categorias e Transações)
export const getFinancasDashboard = async (): Promise<FinancasDashboard> => {
    const response = await api.get('/financas/');
    return response.data;
};

// Cria uma nova transação (Pontual, Parcelada ou Recorrente)
export const createTransacao = async (data: any) => {
    const response = await api.post('/financas/transacoes', data);
    return response.data;
};

// Alterna status entre Pendente/Efetivada
export const toggleStatusTransacao = async (id: number) => {
    const response = await api.put(`/financas/transacoes/${id}/toggle-status`);
    return response.data;
};

// Exclui uma transação (ou grupo de recorrência)
export const deleteTransacao = async (id: number) => {
    const response = await api.delete(`/financas/transacoes/${id}`);
    return response.data;
};

// Cria uma nova categoria
export const createCategoria = async (data: any) => {
    const response = await api.post('/financas/categorias', data);
    return response.data;
};

// Exclui uma categoria
export const deleteCategoria = async (id: number) => {
    const response = await api.delete(`/financas/categorias/${id}`);
    return response.data;
};

// ==========================================================
// 4. MÓDULO PANORAMA (Novo)
// ==========================================================

export interface PanoramaData {
    kpis: {
        receita_mes: number;
        despesa_mes: number;
        balanco_mes: number;
        compromissos_realizados: number;
        compromissos_pendentes: number;
        compromissos_perdidos: number;
        chaves_ativas: number;
        chaves_expiradas: number;
        proximo_compromisso?: { titulo: string; data_hora: string };
    };
    gastos_por_categoria: { labels: string[]; data: number[]; colors: string[] };
    evolucao_mensal_receita: number[];
    evolucao_mensal_despesa: number[];
    evolucao_labels: string[];
    gasto_semanal: { labels: string[]; data: number[] };
    categorias_para_filtro: Categoria[];
}

// Busca os dados do dashboard unificado
export const getPanoramaData = async (): Promise<PanoramaData> => {
    const response = await api.get('/panorama/');
    return response.data;
};

export const getCategoryHistory = async (categoryId: number) => {
    const response = await api.get(`/panorama/history/${categoryId}`);
    return response.data;
};

export default api;