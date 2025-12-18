import axios from 'axios';

// ==========================================================
// 1. CONFIGURAÇÃO BASE & INTERCEPTORES
// ==========================================================
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/v1',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('@Bussola:token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
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
        receita_mes: number;
        despesa_mes: number;
        balanco_mes: number;
        compromissos_realizados: number;
        compromissos_pendentes: number;
        compromissos_perdidos: number;
        proximo_compromisso?: { titulo: string; data: string; cor: string };
        total_anotacoes: number;
        tarefas_pendentes: { critica: number; alta: number; media: number; baixa: number; };
        tarefas_concluidas: number;
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

export const getPanoramaData = async (period: string = 'Mensal'): Promise<PanoramaData> => {
    const response = await api.get(`/panorama/?period=${period}`);
    return response.data;
};

export const getCategoryHistory = async (categoryId: number) => {
    const response = await api.get(`/panorama/history/${categoryId}`);
    return response.data;
};

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
export interface GrupoAnotacao { id: number; nome: string; cor: string; }
export interface LinkItem { id: number; url: string; }

export interface Anotacao {
    id: number;
    titulo: string;
    conteudo: string;
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
    subtarefas?: Subtarefa[];
}

export interface Tarefa {
    id: number;
    titulo: string;
    descricao: string;
    status: 'Pendente' | 'Em andamento' | 'Concluído';
    fixado: boolean;
    prioridade?: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
    prazo?: string;
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

export const getRegistrosDashboard = async (): Promise<RegistrosDashboard> => {
    const response = await api.get('/registros/');
    return response.data;
};

export const createGrupo = async (data: { nome: string; cor?: string }) => {
    const response = await api.post('/registros/grupos', data);
    return response.data;
};

export const updateGrupo = async (id: number, data: { nome: string; cor?: string }) => {
    const response = await api.put(`/registros/grupos/${id}`, data);
    return response.data;
};

export const deleteGrupo = async (id: number) => {
    const response = await api.delete(`/registros/grupos/${id}`);
    return response.data;
};

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

export const createTarefa = async (data: any) => {
    const response = await api.post('/registros/tarefas', data);
    return response.data;
};

export const updateTarefa = async (id: number, data: any) => {
    const response = await api.put(`/registros/tarefas/${id}`, data);
    return response.data;
};

export const updateTarefaStatus = async (id: number, status: string) => {
    const response = await api.patch(`/registros/tarefas/${id}/status`, { status });
    return response.data;
};

export const deleteTarefa = async (id: number) => {
    const response = await api.delete(`/registros/tarefas/${id}`);
    return response.data;
};

export const addSubtarefa = async (tarefaId: number, titulo: string, parentId?: number) => {
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
    data_expiracao: string;
}

export interface SegredoValue { valor: string; }

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
// 7. MÓDULO AGENDA
// ==========================================================
export interface Compromisso {
    id: number;
    titulo: string;
    descricao: string;
    local: string;
    data_hora: string;
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

// ==========================================================
// 8. MÓDULO RITMO (FITNESS & SAÚDE)
// ==========================================================

// --- BIO ---
export interface BioData {
    id?: number;
    peso: number;
    altura: number;
    idade: number;
    genero: string;
    nivel_atividade: string;
    objetivo: string;
    bf_estimado?: number;
    tmb?: number;
    gasto_calorico_total?: number;
    meta_proteina?: number;
    meta_carbo?: number;
    meta_gordura?: number;
    meta_agua?: number;
}

export const getBioData = async (): Promise<any> => {
    const response = await api.get('/ritmo/bio/latest');
    return response.data;
};

export const createBioData = async (data: BioData) => {
    const response = await api.post('/ritmo/bio', data);
    return response.data;
};

// --- TREINOS ---
export interface ExercicioItem {
    id?: number;
    nome_exercicio: string;
    api_id?: number;
    grupo_muscular?: string;
    series: number;
    repeticoes_min: number;
    repeticoes_max: number;
    carga_prevista?: number;
    descanso_segundos?: number;
    observacao?: string;
}

export interface DiaTreino { id?: number; nome: string; ordem: number; exercicios: ExercicioItem[]; }
export interface PlanoTreino { id?: number; nome: string; descricao?: string; ativo?: boolean; dias: DiaTreino[]; }

export const getPlanosTreino = async (): Promise<PlanoTreino[]> => {
    const response = await api.get('/ritmo/treinos');
    return response.data;
};

export const getPlanoAtivo = async (): Promise<PlanoTreino> => {
    const response = await api.get('/ritmo/treinos/ativo');
    return response.data;
};

export const createPlanoTreino = async (planoCompleto: PlanoTreino) => {
    const response = await api.post('/ritmo/treinos', planoCompleto);
    return response.data;
};

export const ativarPlanoTreino = async (id: number) => {
    const response = await api.patch(`/ritmo/treinos/${id}/ativar`);
    return response.data;
};

export const deletePlanoTreino = async (id: number) => {
    const response = await api.delete(`/ritmo/treinos/${id}`);
    return response.data;
};

// --- NUTRIÇÃO ---
export interface AlimentoItem {
    id?: number;
    nome: string;
    quantidade: number;
    unidade: string;
    calorias: number;
    proteina: number;
    carbo: number;
    gordura: number;
}

export interface Refeicao {
    id?: number;
    nome: string;
    horario?: string;
    ordem: number;
    alimentos: AlimentoItem[];
    total_calorias_refeicao?: number;
}

export interface DietaConfig {
    id?: number;
    nome: string;
    ativo?: boolean;
    calorias_calculadas?: number;
    refeicoes: Refeicao[];
}

export const getDietas = async (): Promise<DietaConfig[]> => {
    const response = await api.get('/ritmo/nutricao');
    return response.data;
};

export const getDietaAtiva = async (): Promise<DietaConfig> => {
    const response = await api.get('/ritmo/nutricao/ativo');
    return response.data;
};

export const createDieta = async (dietaCompleta: DietaConfig) => {
    const response = await api.post('/ritmo/nutricao', dietaCompleta);
    return response.data;
};


export const updateDieta = async (id: number, dietaCompleta: DietaConfig) => {
    const response = await api.put(`/ritmo/nutricao/${id}`, dietaCompleta);
    return response.data;
};

export const ativarDieta = async (id: number) => {
    const response = await api.patch(`/ritmo/nutricao/${id}/ativar`);
    return response.data;
};

export const deleteDieta = async (id: number) => {
    const response = await api.delete(`/ritmo/nutricao/${id}`);
    return response.data;
};

// --- BUSCAS E INTEGRAÇÕES ---

/** Busca local na tabela TACO (Backend carrega taco.json) */
export const searchLocalFoods = async (query: string) => {
    const response = await api.get(`/ritmo/local/foods?q=${query}`);
    return response.data;
};

export const searchExternalExercises = async (query: string) => {
    const response = await api.get(`/ritmo/external/exercises?q=${query}`);
    return response.data;
};

export default api;