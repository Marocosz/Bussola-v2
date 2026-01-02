/**
 * ============================================================================
 * ARQUIVO: api.ts
 * DESCRIÇÃO: Camada de serviço responsável pela comunicação HTTP entre o
 * Frontend (React) e o Backend (FastAPI).
 * ============================================================================
 */

import axios from 'axios';

// ==========================================================
// 1. CONFIGURAÇÃO BASE & INTERCEPTORES
// ==========================================================

// Verifica se o Vite está rodando em modo de produção (Build/Docker)
const isProduction = import.meta.env.PROD;

const api = axios.create({
    // Se for produção (Docker), usa caminho relativo e deixa o Nginx gerenciar o proxy.
    // Se for dev local, aponta direto para o backend.
    baseURL: isProduction ? '/api/v1' : 'http://127.0.0.1:8000/api/v1', 
});

// [INTERCEPTOR DE REQUISIÇÃO]
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('@Bussola:token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Controle de Concorrência para Refresh Token
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Helper de Logout
const handleLogout = () => {
    localStorage.removeItem('@Bussola:token');
    localStorage.removeItem('@Bussola:refresh_token');
    localStorage.removeItem('@Bussola:user');
    window.location.href = '/login';
};

// [INTERCEPTOR DE RESPOSTA]
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // 1. Filtra erros que NÃO devem disparar refresh
        // Se o erro for "E-mail não verificado" ou login falhou, rejeita direto.
        if (error.response?.data?.detail?.includes("verificado") || 
            error.response?.data?.detail?.includes("incorretos")) {
             return Promise.reject(error);
        }

        // 2. Lógica de Refresh Token (Apenas para 401 genérico)
        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/refresh')) {
            
            if (isRefreshing) {
                // Se já tem alguém renovando, entra na fila
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('@Bussola:refresh_token');

            if (!refreshToken) {
                handleLogout();
                return Promise.reject(error);
            }

            try {
                // Chama a rota de renovação
                const response = await api.post('/auth/refresh', { refresh_token: refreshToken });
                
                const { access_token, refresh_token: newRefreshToken } = response.data;

                localStorage.setItem('@Bussola:token', access_token);
                // Opcional: Se o back retornar novo refresh, atualiza. Se não, mantém o antigo.
                if (newRefreshToken) {
                    localStorage.setItem('@Bussola:refresh_token', newRefreshToken);
                }

                api.defaults.headers.Authorization = `Bearer ${access_token}`;
                originalRequest.headers['Authorization'] = `Bearer ${access_token}`;

                processQueue(null, access_token);
                isRefreshing = false;

                return api(originalRequest);

            } catch (refreshError) {
                processQueue(refreshError, null);
                isRefreshing = false;
                handleLogout();
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// ==========================================================
// 2. MÓDULO AUTH (LOGIN & REGISTRO)
// ==========================================================

export const loginUser = async (formData: FormData) => {
    // Atenção: Agora a rota é /auth/access-token
    const response = await api.post('/auth/access-token', formData);
    return response.data;
};

export const loginGoogle = async (token: string) => {
    const response = await api.post('/auth/google', { token });
    return response.data;
};

export const logoutSession = async () => {
    const refreshToken = localStorage.getItem('@Bussola:refresh_token');
    const config = refreshToken ? { headers: { 'X-Refresh-Token': refreshToken } } : {};
    
    try {
        await api.post('/auth/logout', {}, config);
    } catch (error) {
        console.warn("Erro logout:", error);
    }
};

export const verifyUserEmail = async (token: string, email: string) => {
    const response = await api.post(`/users/verify-email?token=${token}&email=${email}`);
    return response.data;
};

export const requestPasswordRecovery = async (email: string) => {
    const response = await api.post(`/auth/password-recovery/${email}`);
    return response.data;
};

export const resetPassword = async (token: string, newPassword: string) => {
    const response = await api.post('/auth/reset-password', {
        token,
        new_password: newPassword
    });
    return response.data;
};

// ... (Mantenha o restante dos módulos Home, Finanças, etc. intactos)
// ==========================================================
// 3. MÓDULO HOME
// ==========================================================

export interface WeatherData {
    temperature: number;
    description: string;
    icon_class: string;
    city: string; 
}

export interface NewsArticle {
    title: string;
    url: string;
    source: { name: string };
    published_at: string;
    topic?: string; 
}

// [NOVO] Interface para a lista dinâmica de tópicos
export interface NewsTopic {
    id: string;
    label: string;
}

// A interface HomeData antiga pode ser removida se não for usada em outro lugar,
// pois agora buscamos separadamente. Mas mantive aqui por segurança.
export interface HomeData {
    weather: WeatherData | null;
    tech_news: NewsArticle[];
}

export const getWeather = async () => {
    try {
        const response = await api.get('/home/weather');
        return response.data;
    } catch (error) {
        console.error("Erro ao buscar clima:", error);
        return null;
    }
};

export const getNews = async () => {
    try {
        const response = await api.get('/home/news');
        return response.data;
    } catch (error) {
        console.error("Erro ao buscar notícias:", error);
        return [];
    }
};

// [NOVO] Busca a lista de tópicos dinamicamente do backend
export const getNewsTopics = async () => {
    try {
        const response = await api.get('/home/news/topics');
        return response.data; // Retorna array de {id, label}
    } catch (error) {
        console.error("Erro ao buscar tópicos:", error);
        return [];
    }
};

// ==========================================================
// 4. MÓDULO FINANÇAS
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

export const stopRecorrencia = async (id: number) => {
    // Chama a rota PATCH criada no backend para encerrar assinatura/parcelamento
    const response = await api.patch(`/financas/transacoes/${id}/encerrar-recorrencia`);
    return response.data;
};

// ==========================================================
// 5. MÓDULO PANORAMA (B.I. / Métricas)
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

export const getPanoramaData = async (month: number, year: number, periodLength: number) => {
    // Agora enviamos month, year e period_length como números na query string
    const response = await api.get('/panorama/', {
        params: {
            month: month,
            year: year,
            period_length: periodLength // O Backend espera snake_case
        }
    });
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
// 6. MÓDULO REGISTROS (ANOTAÇÕES E TAREFAS)
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
// 7. MÓDULO COFRE (GERENCIADOR DE SENHAS)
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
// 8. MÓDULO AGENDA
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
    compromissos?: { titulo: string, hora: string }[];
    month_name?: string;
    year?: number;
}

export interface AgendaDashboard {
    compromissos_por_mes: Record<string, Compromisso[]>;
    calendar_days: CalendarDay[];
}

export const getAgendaDashboard = async (mes: number | string, ano: number | string) => {
    // Definimos params como 'any' ou um objeto chave-valor para evitar erro de "propriedade não existe"
    const params: any = {}; 

    if (mes) params.mes = mes;
    if (ano) params.ano = ano;

    const response = await api.get('/agenda/', { params });
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
// 9. MÓDULO RITMO (FITNESS & SAÚDE)
// ==========================================================

export interface BioData {
    id?: number;
    peso: number;
    altura: number;
    idade: number;
    genero: string;
    nivel_atividade: string;
    objetivo: string;
    bf_estimado?: number | null;
    tmb?: number;
    gasto_calorico_total?: number | null;
    meta_proteina?: number | null;
    meta_carbo?: number | null;
    meta_gordura?: number | null;
    meta_agua?: number | null;
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

export interface DiaTreino {
    id?: number;
    nome: string;
    ordem: number;
    exercicios: ExercicioItem[];
}

export interface PlanoTreino {
    id?: number;
    nome: string;
    descricao?: string;
    ativo?: boolean;
    dias: DiaTreino[];
}

export const getPlanos = async (): Promise<PlanoTreino[]> => {
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

export const updatePlanoTreino = async (id: number, planoCompleto: PlanoTreino) => {
    const response = await api.put(`/ritmo/treinos/${id}`, planoCompleto);
    return response.data;
};

export const ativarPlano = async (id: number) => {
    const response = await api.patch(`/ritmo/treinos/${id}/ativar`);
    return response.data;
};

export const deletePlano = async (id: number) => {
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

export const searchLocalFoods = async (query: string) => {
    const response = await api.get(`/ritmo/local/foods?q=${query}`);
    return response.data;
};

// ==========================================================
// 10. CONFIGURAÇÃO DO SISTEMA E USUÁRIOS
// ==========================================================

export const getSystemConfig = async () => {
    try {
        const response = await api.get('/system/config');
        return response.data;
    } catch (error) {
        console.error("Erro ao carregar configurações do sistema", error);
        return {
            deployment_mode: "SELF_HOSTED",
            public_registration: false,
            google_login_enabled: false,
            stripe_enabled: false
        };
    }
};

interface CreateUserDTO {
    email: string;
    full_name: string;
    password?: string;
}

export const adminCreateUser = async (userData: CreateUserDTO) => {
    const response = await api.post('/users/', userData);
    return response.data;
};

export const registerUser = async (userData: any) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
};

export const updateUser = async (data: { 
    full_name?: string, 
    city?: string, 
    avatar_url?: string,
    news_preferences?: string[], // Lista de tópicos (tech, finance, etc)
    email?: string,
    password?: string
}) => {
    const response = await api.patch('/users/me', data);
    return response.data;
};

export type AiContext = 'ritmo' | 'financas' | 'agenda' | 'registros';

export const aiService = {
  getInsight: async (context: AiContext) => {
    try {
      // A URL dinâmica funciona perfeitamente para os dois casos:
      // context='ritmo'  -> GET /ai/ritmo/insight
      // context='agenda' -> GET /ai/agenda/insight
      const endpoint = `/ai/${context}/insight`; 
      
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar insight IA para ${context}:`, error);
      throw error; 
    }
  },
};

export default api;