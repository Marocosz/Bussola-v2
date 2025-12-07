import axios from 'axios';

// ==========================================================
// 1. CONFIGURAÇÃO BASE
// ==========================================================
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/v1',
});

// Interceptor: Injeta o token automaticamente se ele existir
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('@Bussola:token');
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
});

// ==========================================================
// 2. MÓDULO HOME
// ==========================================================

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

export const getHomeData = async (): Promise<HomeData> => {
    const response = await api.get('/home/'); 
    return response.data;
};

// ==========================================================
// 3. MÓDULO FINANÇAS
// ==========================================================

export interface Categoria {
    id: number;
    nome: string;
    tipo: 'despesa' | 'receita';
    icone: string;
    cor: string;
    meta_limite: number;
    total_gasto?: number;
    total_ganho?: number;
}

export interface Transacao {
    id: number;
    descricao: string;
    valor: number;
    data: string;
    categoria_id: number;
    categoria?: Categoria;
    tipo_recorrencia: 'pontual' | 'parcelada' | 'recorrente';
    status: 'Pendente' | 'Efetivada';
    parcela_atual?: number;
    total_parcelas?: number;
    frequencia?: string;
}

export interface FinancasDashboard {
    categorias_despesa: Categoria[];
    categorias_receita: Categoria[];
    transacoes_pontuais: Record<string, Transacao[]>;
    transacoes_recorrentes: Record<string, Transacao[]>;
    icones_disponiveis: string[];
    cores_disponiveis: string[];
}

export const getFinancasDashboard = async (): Promise<FinancasDashboard> => {
    const response = await api.get('/financas/');
    return response.data;
};

export const createTransacao = async (data: any) => {
    const response = await api.post('/financas/transacoes', data);
    return response.data;
};

export const toggleStatusTransacao = async (id: number) => {
    const response = await api.put(`/financas/transacoes/${id}/toggle-status`);
    return response.data;
};

export const deleteTransacao = async (id: number) => {
    const response = await api.delete(`/financas/transacoes/${id}`);
    return response.data;
};

export const createCategoria = async (data: any) => {
    const response = await api.post('/financas/categorias', data);
    return response.data;
};

export const deleteCategoria = async (id: number) => {
    const response = await api.delete(`/financas/categorias/${id}`);
    return response.data;
};

// ==========================================================
// 4. MÓDULO PANORAMA
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

export const getPanoramaData = async (): Promise<PanoramaData> => {
    const response = await api.get('/panorama/');
    return response.data;
};

export const getCategoryHistory = async (categoryId: number) => {
    const response = await api.get(`/panorama/history/${categoryId}`);
    return response.data;
};

// ==========================================================
// 5. MÓDULO REGISTROS (Novo)
// ==========================================================

export interface LinkItem { id: number; url: string; }

export interface Anotacao {
    id: number;
    titulo: string;
    conteudo: string; // HTML
    tipo: string;
    fixado: boolean;
    is_tarefa: boolean;
    status_tarefa: 'Pendente' | 'Concluído';
    data_criacao: string;
    links: LinkItem[];
}

export interface RegistrosDashboard {
    anotacoes_fixadas: Anotacao[];
    anotacoes_por_mes: Record<string, Anotacao[]>;
}

export const getRegistrosDashboard = async (): Promise<RegistrosDashboard> => {
    const response = await api.get('/registros/');
    return response.data;
};

export const createRegistro = async (data: any) => {
    const response = await api.post('/registros/', data);
    return response.data;
};

export const updateRegistro = async (id: number, data: any) => {
    const response = await api.put(`/registros/${id}`, data);
    return response.data;
};

export const deleteRegistro = async (id: number) => {
    const response = await api.delete(`/registros/${id}`);
    return response.data;
};

export const toggleFixarRegistro = async (id: number) => {
    const response = await api.patch(`/registros/${id}/toggle-fixar`);
    return response.data;
};

export const toggleTarefaStatus = async (id: number) => {
    const response = await api.patch(`/registros/${id}/toggle-tarefa`);
    return response.data;
};

export default api;