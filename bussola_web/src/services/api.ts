/**
 * ============================================================================
 * ARQUIVO: api.ts
 * DESCRIÇÃO: Camada de serviço responsável pela comunicação HTTP entre o
 * Frontend (React) e o Backend (FastAPI).
 *
 * FUNÇÕES:
 * 1. Configura a instância base do Axios (URL, Timeouts).
 * 2. Gerencia Interceptors para injetar o Token JWT em requisições.
 * 3. Gerencia o Logout automático em caso de Token expirado (401/403).
 * 4. Centraliza todas as chamadas de API divididas por módulos do sistema.
 * ============================================================================
 */

import axios from 'axios'; // Importa a biblioteca Axios para requisições HTTP

// ==========================================================
// 1. CONFIGURAÇÃO BASE & INTERCEPTORES
// ==========================================================

// Cria uma instância personalizada do Axios
const api = axios.create({
    // Define a URL base para todas as requisições (ajuste conforme seu ambiente)
    baseURL: 'http://127.0.0.1:8000/api/v1',
});

// [INTERCEPTOR DE REQUISIÇÃO] Executa antes de cada request sair do front
api.interceptors.request.use((config) => {
    // Tenta buscar o token salvo no LocalStorage do navegador
    const token = localStorage.getItem('@Bussola:token');
    
    // Se o token existir, injeta no cabeçalho Authorization
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Retorna a configuração ajustada para seguir viagem
    return config;
});

// [INTERCEPTOR DE RESPOSTA] Executa quando o back retorna algo
api.interceptors.response.use(
    (response) => response, // Se der sucesso, apenas repassa a resposta
    (error) => {
        // Verifica se houve erro de resposta e se o status é 401 (Não autorizado) ou 403 (Proibido)
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.warn("Sessão inválida ou expirada. Redirecionando para login...");
            
            // Limpa os dados de autenticação do armazenamento local
            localStorage.removeItem('@Bussola:token');
            localStorage.removeItem('@Bussola:user');
            
            // Força o redirecionamento para a tela de login
            window.location.href = '/login';
        }
        // Repassa o erro para ser tratado no try/catch do componente
        return Promise.reject(error);
    }
);

// ==========================================================
// 2. MÓDULO HOME
// ==========================================================

// Interface para tipar os dados de Clima
export interface WeatherData {
    temperature: number; // Temperatura atual
    description: string; // Descrição (ex: "Céu limpo")
    icon_class: string;  // Classe do ícone CSS
}

// Interface para tipar notícias de tecnologia
export interface NewsArticle {
    title: string;       // Título da notícia
    url: string;         // Link original
    source: { name: string }; // Fonte da notícia
    published_at: string; // Data de publicação
}

// Interface agregadora da Home
export interface HomeData {
    weather: WeatherData | null; // Dados de clima (pode ser nulo)
    tech_news: NewsArticle[];    // Lista de notícias
}

// Busca os dados iniciais da Dashboard Home
export const getHomeData = async (): Promise<HomeData> => {
    const response = await api.get('/home/'); // Faz GET na rota /home/
    return response.data; // Retorna o JSON da resposta
};

// ==========================================================
// 3. MÓDULO FINANÇAS
// ==========================================================

// Interface para Categorias Financeiras
export interface Categoria {
    id: number;           // ID único
    nome: string;         // Nome da categoria
    tipo: 'despesa' | 'receita'; // Tipo restrito
    icone: string;        // String do ícone
    cor: string;          // Cor em Hex
    meta_limite: number;  // Meta de gastos
    total_gasto?: number; // Opcional: calculado no back
    total_ganho?: number; // Opcional: calculado no back
}

// Interface para Transações Financeiras
export interface Transacao {
    id: number;           // ID único
    descricao: string;    // Descrição do gasto
    valor: number;        // Valor monetário
    data: string;         // Data ISO
    categoria_id: number; // FK da categoria
    categoria?: Categoria; // Objeto categoria populado
    tipo_recorrencia: 'pontual' | 'parcelada' | 'recorrente'; // Tipo
    status: 'Pendente' | 'Efetivada'; // Status atual
    parcela_atual?: number; // Apenas para parceladas
    total_parcelas?: number; // Apenas para parceladas
    frequencia?: string;    // Apenas para recorrentes
}

// Interface do Dashboard Financeiro completo
export interface FinancasDashboard {
    categorias_despesa: Categoria[]; // Lista de categorias de despesa
    categorias_receita: Categoria[]; // Lista de categorias de receita
    transacoes_pontuais: Record<string, Transacao[]>;    // Mapa de transações
    transacoes_recorrentes: Record<string, Transacao[]>; // Mapa de recorrentes
    icones_disponiveis: string[];    // Lista de ícones permitidos
    cores_disponiveis: string[];     // Lista de cores permitidas
}

// Busca todos os dados da tela de Finanças
export const getFinancasDashboard = async (): Promise<FinancasDashboard> => {
    const response = await api.get('/financas/');
    return response.data;
};

// Cria uma nova transação
export const createTransacao = async (data: any) => {
    const response = await api.post('/financas/transacoes', data);
    return response.data;
};

// Atualiza uma transação existente
export const updateTransacao = async (id: number, data: any) => {
    const response = await api.put(`/financas/transacoes/${id}`, data);
    return response.data;
};

// Alterna o status (Pendente <-> Efetivada)
export const toggleStatusTransacao = async (id: number) => {
    const response = await api.put(`/financas/transacoes/${id}/toggle-status`);
    return response.data;
};

// Deleta uma transação
export const deleteTransacao = async (id: number) => {
    const response = await api.delete(`/financas/transacoes/${id}`);
    return response.data;
};

// Cria uma nova categoria
export const createCategoria = async (data: any) => {
    const response = await api.post('/financas/categorias', data);
    return response.data;
};

// Atualiza uma categoria existente
export const updateCategoria = async (id: number, data: any) => {
    const response = await api.put(`/financas/categorias/${id}`, data);
    return response.data;
};

// Deleta uma categoria
export const deleteCategoria = async (id: number) => {
    const response = await api.delete(`/financas/categorias/${id}`);
    return response.data;
};

// ==========================================================
// 4. MÓDULO PANORAMA (B.I. / Métricas)
// ==========================================================

// Interface complexa com todos os dados do Panorama
export interface PanoramaData {
    kpis: { // Key Performance Indicators
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
    gastos_por_categoria: { labels: string[]; data: number[]; colors: string[] }; // ChartJS Data
    evolucao_mensal_receita: number[]; // Array para gráficos de linha
    evolucao_mensal_despesa: number[]; // Array para gráficos de linha
    evolucao_labels: string[];         // Labels dos meses
    gasto_semanal: { labels: string[]; data: number[] }; // Gráfico semanal
    categorias_para_filtro: Categoria[]; // Para filtrar o histórico
}

// Busca dados do Panorama filtrado por período (padrão Mensal)
export const getPanoramaData = async (period: string = 'Mensal'): Promise<PanoramaData> => {
    const response = await api.get(`/panorama/?period=${period}`);
    return response.data;
};

// Busca histórico específico de uma categoria
export const getCategoryHistory = async (categoryId: number) => {
    const response = await api.get(`/panorama/history/${categoryId}`);
    return response.data;
};

// Busca provisões financeiras
export const getProvisoesData = async () => {
    const response = await api.get('/panorama/provisoes');
    return response.data;
};

// Busca dados do Roteiro (Agenda resumida)
export const getRoteiroData = async () => {
    const response = await api.get('/panorama/roteiro');
    return response.data;
};

// Busca resumo de registros
export const getRegistrosResumoData = async () => {
    const response = await api.get('/panorama/registros');
    return response.data;
};

// ==========================================================
// 5. MÓDULO REGISTROS (ANOTAÇÕES E TAREFAS)
// ==========================================================

// Interfaces auxiliares
export interface GrupoAnotacao { id: number; nome: string; cor: string; }
export interface LinkItem { id: number; url: string; }

// Interface de Anotação (Estilo Google Keep)
export interface Anotacao {
    id: number;
    titulo: string;
    conteudo: string;
    fixado: boolean;
    data_criacao: string;
    grupo: GrupoAnotacao;
    links: LinkItem[];
}

// Interface de Subtarefa (Checklist dentro da tarefa)
export interface Subtarefa {
    id: number;
    titulo: string;
    concluido: boolean;
    parent_id?: number | null;
    subtarefas?: Subtarefa[];
}

// Interface de Tarefa (Kanban/Lista)
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

// Interface do Dashboard de Registros
export interface RegistrosDashboard {
    anotacoes_fixadas: Anotacao[]; // Lista de fixados no topo
    anotacoes_por_mes: Record<string, Anotacao[]>; // Agrupado por mês
    tarefas_pendentes: Tarefa[];   // Lista a fazer
    tarefas_concluidas: Tarefa[];  // Histórico
    grupos_disponiveis: GrupoAnotacao[]; // Tags/Grupos
}

// Busca todos os dados de Registros
export const getRegistrosDashboard = async (): Promise<RegistrosDashboard> => {
    const response = await api.get('/registros/');
    return response.data;
};

// Cria grupo de anotação
export const createGrupo = async (data: { nome: string; cor?: string }) => {
    const response = await api.post('/registros/grupos', data);
    return response.data;
};

// Atualiza grupo
export const updateGrupo = async (id: number, data: { nome: string; cor?: string }) => {
    const response = await api.put(`/registros/grupos/${id}`, data);
    return response.data;
};

// Deleta grupo
export const deleteGrupo = async (id: number) => {
    const response = await api.delete(`/registros/grupos/${id}`);
    return response.data;
};

// Cria anotação
export const createAnotacao = async (data: any) => {
    const response = await api.post('/registros/anotacoes', data);
    return response.data;
};

// Atualiza anotação
export const updateAnotacao = async (id: number, data: any) => {
    const response = await api.put(`/registros/anotacoes/${id}`, data);
    return response.data;
};

// Deleta anotação
export const deleteAnotacao = async (id: number) => {
    const response = await api.delete(`/registros/anotacoes/${id}`);
    return response.data;
};

// Alterna estado de fixado da anotação
export const toggleFixarAnotacao = async (id: number) => {
    const response = await api.patch(`/registros/anotacoes/${id}/toggle-fixar`);
    return response.data;
};

// Cria tarefa
export const createTarefa = async (data: any) => {
    const response = await api.post('/registros/tarefas', data);
    return response.data;
};

// Atualiza dados da tarefa
export const updateTarefa = async (id: number, data: any) => {
    const response = await api.put(`/registros/tarefas/${id}`, data);
    return response.data;
};

// Atualiza apenas o status da tarefa (ex: arrastar no Kanban)
export const updateTarefaStatus = async (id: number, status: string) => {
    const response = await api.patch(`/registros/tarefas/${id}/status`, { status });
    return response.data;
};

// Deleta tarefa
export const deleteTarefa = async (id: number) => {
    const response = await api.delete(`/registros/tarefas/${id}`);
    return response.data;
};

// Adiciona subtarefa
export const addSubtarefa = async (tarefaId: number, titulo: string, parentId?: number) => {
    const response = await api.post(`/registros/tarefas/${tarefaId}/subtarefas`, { 
        titulo, 
        parent_id: parentId || null 
    });
    return response.data;
};

// Alterna checkbox da subtarefa
export const toggleSubtarefa = async (subId: number) => {
    const response = await api.patch(`/registros/subtarefas/${subId}/toggle`);
    return response.data;
};

// ==========================================================
// 6. MÓDULO COFRE (GERENCIADOR DE SENHAS)
// ==========================================================

// Interface de um segredo/senha
export interface Segredo {
    id: number;
    titulo: string;
    servico: string;
    notas: string;
    data_expiracao: string;
}

// Interface auxiliar para valor descriptografado
export interface SegredoValue { valor: string; }

// Lista todos os segredos (sem a senha real)
export const getSegredos = async (): Promise<Segredo[]> => {
    const response = await api.get('/cofre/');
    return response.data;
};

// Cria novo segredo (senha é enviada para criptografia no back)
export const createSegredo = async (data: any) => {
    const response = await api.post('/cofre/', data);
    return response.data;
};

// Atualiza segredo
export const updateSegredo = async (id: number, data: any) => {
    const response = await api.put(`/cofre/${id}`, data);
    return response.data;
};

// Deleta segredo
export const deleteSegredo = async (id: number) => {
    const response = await api.delete(`/cofre/${id}`);
    return response.data;
};

// Busca e descriptografa o valor da senha (exige validação no back)
export const getSegredoValor = async (id: number): Promise<SegredoValue> => {
    const response = await api.get(`/cofre/${id}/valor`);
    return response.data;
};

// ==========================================================
// 7. MÓDULO AGENDA
// ==========================================================

// Interface de Compromisso
export interface Compromisso {
    id: number;
    titulo: string;
    descricao: string;
    local: string;
    data_hora: string;
    lembrete: boolean;
    status: 'Pendente' | 'Realizado' | 'Perdido';
}

// Interface auxiliar para renderizar o calendário
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

// Dados do Dashboard da Agenda
export interface AgendaDashboard {
    compromissos_por_mes: Record<string, Compromisso[]>;
    calendar_days: CalendarDay[];
}

// Busca dados da Agenda
export const getAgendaDashboard = async (): Promise<AgendaDashboard> => {
    const response = await api.get('/agenda/');
    return response.data;
};

// Cria compromisso
export const createCompromisso = async (data: any) => {
    const response = await api.post('/agenda/', data);
    return response.data;
};

// Atualiza compromisso
export const updateCompromisso = async (id: number, data: any) => {
    const response = await api.put(`/agenda/${id}`, data);
    return response.data;
};

// Alterna status do compromisso
export const toggleCompromissoStatus = async (id: number) => {
    const response = await api.patch(`/agenda/${id}/toggle-status`);
    return response.data;
};

// Deleta compromisso
export const deleteCompromisso = async (id: number) => {
    const response = await api.delete(`/agenda/${id}`);
    return response.data;
};

// ==========================================================
// 8. MÓDULO RITMO (FITNESS & SAÚDE)
// ==========================================================

// --- BIO (DADOS BIOMÉTRICOS) ---

// Interface de Dados Biométricos
export interface BioData {
    id?: number;
    peso: number;
    altura: number;
    idade: number;
    genero: string;
    nivel_atividade: string;
    objetivo: string;
    bf_estimado?: number; // Percentual de gordura
    tmb?: number;         // Taxa metabólica basal
    gasto_calorico_total?: number;
    meta_proteina?: number;
    meta_carbo?: number;
    meta_gordura?: number;
    meta_agua?: number;
}

// Busca o registro biométrico mais recente
export const getBioData = async (): Promise<any> => {
    const response = await api.get('/ritmo/bio/latest');
    return response.data;
};

// Cria um novo registro biométrico
export const createBioData = async (data: BioData) => {
    const response = await api.post('/ritmo/bio', data);
    return response.data;
};

// --- TREINOS ---

// Item de exercício dentro de uma ficha
export interface ExercicioItem {
    id?: number;
    nome_exercicio: string;
    api_id?: number; // ID externo se houver
    grupo_muscular?: string;
    series: number;
    repeticoes_min: number;
    repeticoes_max: number;
    carga_prevista?: number;
    descanso_segundos?: number;
    observacao?: string;
}

// Dia de treino (ex: Treino A - Peito)
export interface DiaTreino { 
    id?: number; 
    nome: string; 
    ordem: number; 
    exercicios: ExercicioItem[]; 
}

// Plano Completo de Treino
export interface PlanoTreino { 
    id?: number; 
    nome: string; 
    descricao?: string; 
    ativo?: boolean; 
    dias: DiaTreino[]; 
}

// Busca todos os planos de treino
export const getPlanos = async (): Promise<PlanoTreino[]> => {
    const response = await api.get('/ritmo/treinos');
    return response.data;
};

// Busca o plano atualmente ativo
export const getPlanoAtivo = async (): Promise<PlanoTreino> => {
    const response = await api.get('/ritmo/treinos/ativo');
    return response.data;
};

// Cria novo plano de treino
export const createPlanoTreino = async (planoCompleto: PlanoTreino) => {
    const response = await api.post('/ritmo/treinos', planoCompleto);
    return response.data;
};

// Atualiza plano de treino
export const updatePlanoTreino = async (id: number, planoCompleto: PlanoTreino) => {
    const response = await api.put(`/ritmo/treinos/${id}`, planoCompleto);
    return response.data;
};

// Define um plano como ativo (desativa os outros)
export const ativarPlano = async (id: number) => {
    const response = await api.patch(`/ritmo/treinos/${id}/ativar`);
    return response.data;
};

// Deleta plano
export const deletePlano = async (id: number) => {
    const response = await api.delete(`/ritmo/treinos/${id}`);
    return response.data;
};

// --- NUTRIÇÃO ---

// Item alimentar
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

// Refeição (ex: Café da Manhã)
export interface Refeicao {
    id?: number;
    nome: string;
    horario?: string;
    ordem: number;
    alimentos: AlimentoItem[];
    total_calorias_refeicao?: number;
}

// Configuração de Dieta completa
export interface DietaConfig {
    id?: number;
    nome: string;
    ativo?: boolean;
    calorias_calculadas?: number;
    refeicoes: Refeicao[];
}

// Busca todas as dietas
export const getDietas = async (): Promise<DietaConfig[]> => {
    const response = await api.get('/ritmo/nutricao');
    return response.data;
};

// Busca dieta ativa
export const getDietaAtiva = async (): Promise<DietaConfig> => {
    const response = await api.get('/ritmo/nutricao/ativo');
    return response.data;
};

// Cria nova dieta
export const createDieta = async (dietaCompleta: DietaConfig) => {
    const response = await api.post('/ritmo/nutricao', dietaCompleta);
    return response.data;
};

// Atualiza dieta existente
export const updateDieta = async (id: number, dietaCompleta: DietaConfig) => {
    const response = await api.put(`/ritmo/nutricao/${id}`, dietaCompleta);
    return response.data;
};

// Ativa dieta
export const ativarDieta = async (id: number) => {
    const response = await api.patch(`/ritmo/nutricao/${id}/ativar`);
    return response.data;
};

// Deleta dieta
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

// ==========================================================
// 9. CONFIGURAÇÃO DO SISTEMA E USUÁRIOS
// ==========================================================

// Busca configurações globais do sistema (SaaS vs Self-Hosted)
export const getSystemConfig = async () => {
    try {
        const response = await api.get('/system/config');
        return response.data;
    } catch (error) {
        console.error("Erro ao carregar configurações do sistema", error);
        // Fallback seguro caso a API esteja offline
        return {
            deployment_mode: "SELF_HOSTED",
            public_registration: false,
            google_login_enabled: false,
            stripe_enabled: false
        };
    }
};

// DTO para criação de usuário Admin
interface CreateUserDTO {
    email: string;
    full_name: string;
    password?: string;
}

// Criação de usuário por Admin
export const adminCreateUser = async (userData: CreateUserDTO) => {
    const response = await api.post('/users/', userData);
    return response.data;
};

// Registro de usuário público (Self-Service)
export const registerUser = async (userData: any) => {
    const response = await api.post('/users/open', userData);
    return response.data;
};

// [NOVO] Solicita recuperação de senha (Envia e-mail)
export const requestPasswordRecovery = async (email: string) => {
    // A rota no backend espera: /api/v1/login/password-recovery/{email}
    const response = await api.post(`/login/password-recovery/${email}`);
    return response.data;
};

// [NOVO] Efetivar a troca de senha (Envia token e nova senha)
export const resetPassword = async (token: string, newPassword: string) => {
    // Envia o objeto JSON com token e nova senha para validação
    const response = await api.post('/login/reset-password', {
        token,
        new_password: newPassword
    });
    return response.data;
};

// Exporta a instância do API como padrão
export default api;