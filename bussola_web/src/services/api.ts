import axios from 'axios';

// ==========================================================
// 1. CONFIGURAÇÃO BASE
// ==========================================================
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/v1',
});

// Interceptor de REQUISIÇÃO: Injeta o token na ida
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('@Bussola:token');
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
});

// Interceptor de RESPOSTA (Logout Automático)
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.warn("Sessão inválida ou expirada. Redirecionando para login...");
            localStorage.removeItem('@Bussola:token');
            localStorage.removeItem('@Bussola:user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

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

// --- NOVO: Função para atualizar transação (PUT) ---
export const updateTransacao = async (id: number, data: any) => {
    const response = await api.put(`/financas/transacoes/${id}`, data);
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

// --- NOVO: Função para atualizar categoria (PUT) ---
export const updateCategoria = async (id: number, data: any) => {
    const response = await api.put(`/financas/categorias/${id}`, data);
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
        // Finanças
        receita_mes: number;
        despesa_mes: number;
        balanco_mes: number;
        
        // Agenda
        compromissos_realizados: number;
        compromissos_pendentes: number;
        compromissos_perdidos: number;
        proximo_compromisso?: { titulo: string; data: string; cor: string };
        
        // Registros
        total_anotacoes: number;
        tarefas_pendentes: {
            critica: number;
            alta: number;
            media: number;
            baixa: number;
        };
        tarefas_concluidas: number;
        
        // Cofre
        chaves_ativas: number;
        chaves_expiradas: number;
    };
    gastos_por_categoria: { labels: string[]; data: number[]; colors: string[] };
    evolucao_mensal_receita: number[];
    evolucao_mensal_despesa: number[];
    evolucao_labels: string[];
    gasto_semanal: { labels: string[]; data: number[] };
    categorias_para_filtro: Categoria[];
}

// Dados Principais (KPIs e Gráficos) - ALTERADO AQUI
export const getPanoramaData = async (period: string = 'Mensal'): Promise<PanoramaData> => {
    // Passa o periodo na query string
    const response = await api.get(`/panorama/?period=${period}`);
    return response.data;
};

// Histórico de Categoria (Gráfico Dinâmico)
export const getCategoryHistory = async (categoryId: number) => {
    const response = await api.get(`/panorama/history/${categoryId}`);
    return response.data;
};

// --- NOVAS FUNÇÕES PARA OS MODAIS (Lazy Loading) ---

export const getProvisoesData = async () => {
    const response = await api.get('/panorama/provisoes');
    return response.data;
};

export const getRoteiroData = async () => {
    const response = await api.get('/panorama/roteiro');
    return response.data;
};

export const getRegistrosResumoData = async () => {
    const response = await api.get('/panorama/registros');
    return response.data;
};

// ==========================================================
// 5. MÓDULO REGISTROS (ANOTAÇÕES E TAREFAS)
// ==========================================================

export interface GrupoAnotacao {
    id: number;
    nome: string;
    cor: string;
}

export interface LinkItem { id: number; url: string; }

export interface Anotacao {
    id: number;
    titulo: string;
    conteudo: string; // HTML
    fixado: boolean;
    data_criacao: string;
    grupo: GrupoAnotacao;
    links: LinkItem[];
}

export interface Subtarefa {
    id: number;
    titulo: string;
    concluido: boolean;
    parent_id?: number | null;
    subtarefas?: Subtarefa[]; // Aninhamento
}

export interface Tarefa {
    id: number;
    titulo: string;
    descricao: string;
    status: 'Pendente' | 'Em andamento' | 'Concluído';
    fixado: boolean;
    // --- NOVOS CAMPOS ---
    prioridade?: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
    prazo?: string; // Data ISO ou null
    // --------------------
    data_criacao: string;
    data_conclusao?: string;
    subtarefas: Subtarefa[];
}

export interface RegistrosDashboard {
    anotacoes_fixadas: Anotacao[];
    anotacoes_por_mes: Record<string, Anotacao[]>;
    tarefas_pendentes: Tarefa[];
    tarefas_concluidas: Tarefa[];
    grupos_disponiveis: GrupoAnotacao[];
}

// --- DASHBOARD ---
export const getRegistrosDashboard = async (): Promise<RegistrosDashboard> => {
    const response = await api.get('/registros/');
    return response.data;
};

// --- GRUPOS ---
export const createGrupo = async (data: { nome: string; cor?: string }) => {
    const response = await api.post('/registros/grupos', data);
    return response.data;
};

// --- NOVO: Funções para Editar e Excluir Grupos ---
export const updateGrupo = async (id: number, data: { nome: string; cor?: string }) => {
    const response = await api.put(`/registros/grupos/${id}`, data);
    return response.data;
};

export const deleteGrupo = async (id: number) => {
    const response = await api.delete(`/registros/grupos/${id}`);
    return response.data;
};

// --- ANOTAÇÕES ---
export const createAnotacao = async (data: any) => {
    const response = await api.post('/registros/anotacoes', data);
    return response.data;
};

export const updateAnotacao = async (id: number, data: any) => {
    const response = await api.put(`/registros/anotacoes/${id}`, data);
    return response.data;
};

export const deleteAnotacao = async (id: number) => {
    const response = await api.delete(`/registros/anotacoes/${id}`);
    return response.data;
};

export const toggleFixarAnotacao = async (id: number) => {
    const response = await api.patch(`/registros/anotacoes/${id}/toggle-fixar`);
    return response.data;
};

// --- TAREFAS ---
export const createTarefa = async (data: any) => {
    const response = await api.post('/registros/tarefas', data);
    return response.data;
};

// --- NOVO: Função para atualizar tarefa completa (PUT) ---
export const updateTarefa = async (id: number, data: any) => {
    const response = await api.put(`/registros/tarefas/${id}`, data);
    return response.data;
};

export const updateTarefaStatus = async (id: number, status: string) => {
    // Backend espera body: { "status": "Concluído" }
    const response = await api.patch(`/registros/tarefas/${id}/status`, { status });
    return response.data;
};

export const deleteTarefa = async (id: number) => {
    const response = await api.delete(`/registros/tarefas/${id}`);
    return response.data;
};

// --- SUBTAREFAS ---
export const addSubtarefa = async (tarefaId: number, titulo: string, parentId?: number) => {
    // Agora envia parent_id se existir
    const response = await api.post(`/registros/tarefas/${tarefaId}/subtarefas`, { 
        titulo, 
        parent_id: parentId || null 
    });
    return response.data;
};

export const toggleSubtarefa = async (subId: number) => {
    const response = await api.patch(`/registros/subtarefas/${subId}/toggle`);
    return response.data;
};


// ==========================================================
// 6. MÓDULO COFRE
// ==========================================================

export interface Segredo {
    id: number;
    titulo: string;
    servico: string;
    notas: string;
    data_expiracao: string; // String ISO
}

export interface SegredoValue {
    valor: string;
}

export const getSegredos = async (): Promise<Segredo[]> => {
    const response = await api.get('/cofre/');
    return response.data;
};

export const createSegredo = async (data: any) => {
    const response = await api.post('/cofre/', data);
    return response.data;
};

export const updateSegredo = async (id: number, data: any) => {
    const response = await api.put(`/cofre/${id}`, data);
    return response.data;
};

export const deleteSegredo = async (id: number) => {
    const response = await api.delete(`/cofre/${id}`);
    return response.data;
};

export const getSegredoValor = async (id: number): Promise<SegredoValue> => {
    const response = await api.get(`/cofre/${id}/valor`);
    return response.data;
};

// ==========================================================
// 7. MÓDULO AGENDA (Roteiro)
// ==========================================================

export interface Compromisso {
    id: number;
    titulo: string;
    descricao: string;
    local: string;
    data_hora: string; // ISO
    lembrete: boolean;
    status: 'Pendente' | 'Realizado' | 'Perdido';
}

export interface CalendarDay {
    type: 'day' | 'month_divider';
    full_date?: string;
    day_number?: string;
    weekday_short?: string;
    is_today?: boolean;
    compromissos?: {titulo: string, hora: string}[];
    month_name?: string;
    year?: number;
}

export interface AgendaDashboard {
    compromissos_por_mes: Record<string, Compromisso[]>;
    calendar_days: CalendarDay[];
}

export const getAgendaDashboard = async (): Promise<AgendaDashboard> => {
    const response = await api.get('/agenda/');
    return response.data;
};

export const createCompromisso = async (data: any) => {
    const response = await api.post('/agenda/', data);
    return response.data;
};

export const updateCompromisso = async (id: number, data: any) => {
    const response = await api.put(`/agenda/${id}`, data);
    return response.data;
};

export const toggleCompromissoStatus = async (id: number) => {
    const response = await api.patch(`/agenda/${id}/toggle-status`);
    return response.data;
};

export const deleteCompromisso = async (id: number) => {
    const response = await api.delete(`/agenda/${id}`);
    return response.data;
};

export default api;