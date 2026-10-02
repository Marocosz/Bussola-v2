import { apiJson } from './helpers.mjs';

// Tudo que os testes de Registros criam começa com este prefixo e é removido no fim.
const E2E = 'E2E ';
const ehE2E = (s) => String(s || '').startsWith(E2E);
const COLUNAS = ['a_fazer', 'em_andamento', 'bloqueado', 'concluido', 'cancelado'];
const TODOS_DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

/** Contexto de API avulso (beforeAll/afterAll só têm fixtures de worker). */
export async function comApi(playwright, fn) {
  const r = await playwright.request.newContext();
  try {
    return await fn(r);
  } finally {
    await r.dispose();
  }
}

async function todasAsNotas(request) {
  const dash = await apiJson(request, 'GET', '/registros/');
  const porId = new Map();
  for (const n of [...(dash.anotacoes_fixadas || []), ...Object.values(dash.anotacoes_por_mes || {}).flat()]) {
    porId.set(n.id, n);
  }
  return { dash, notas: [...porId.values()] };
}

/** Remove notas, grupos, tarefas e hábitos "E2E ". Sem isso as bases visuais do desktop quebram. */
export async function limparRegistrosE2E(request) {
  const { dash, notas } = await todasAsNotas(request);
  for (const n of notas.filter((x) => ehE2E(x.titulo))) {
    await apiJson(request, 'DELETE', `/registros/anotacoes/${n.id}`);
  }
  for (const g of (dash.grupos_disponiveis || []).filter((x) => ehE2E(x.nome))) {
    await apiJson(request, 'DELETE', `/registros/grupos/${g.id}`);
  }
  const board = await apiJson(request, 'GET', '/registros/tarefas/board');
  for (const t of COLUNAS.flatMap((k) => board[k]).filter((x) => ehE2E(x.titulo))) {
    await apiJson(request, 'DELETE', `/registros/tarefas/${t.id}`);
  }
  for (const h of (await apiJson(request, 'GET', '/registros/habitos')).filter((x) => ehE2E(x.titulo))) {
    await apiJson(request, 'DELETE', `/registros/habitos/${h.id}`);
  }
}

export const criarNota = (request, data = {}) => apiJson(request, 'POST', '/registros/anotacoes', {
  titulo: 'E2E nota', conteudo: 'Texto E2E', grupo_id: null, fixado: false, links: [], ...data,
});

export const criarTarefa = (request, data = {}) => apiJson(request, 'POST', '/registros/tarefas', {
  titulo: 'E2E tarefa', descricao: '', prioridade: 'Média', status: 'Pendente', prazo: null, subtarefas: [], ...data,
});

export const criarHabito = (request, data = {}) => apiJson(request, 'POST', '/registros/habitos', {
  titulo: 'E2E hábito', descricao: null, horario: '10:00', frequencia: TODOS_DIAS, duracao_min: 15, cor: '#4A6DFF', ...data,
});

export async function notaPorTitulo(request, titulo) {
  const { notas } = await todasAsNotas(request);
  return notas.find((n) => n.titulo === titulo) || null;
}

export async function grupoPorNome(request, nome) {
  const dash = await apiJson(request, 'GET', '/registros/');
  return dash.grupos_disponiveis.find((g) => g.nome === nome) || null;
}

export async function tarefaPorTitulo(request, titulo) {
  const board = await apiJson(request, 'GET', '/registros/tarefas/board');
  for (const k of COLUNAS) {
    const t = board[k].find((x) => x.titulo === titulo);
    if (t) return t;
  }
  return null;
}

export async function habitoPorTitulo(request, titulo) {
  const lista = await apiJson(request, 'GET', '/registros/habitos');
  return lista.find((h) => h.titulo === titulo) || null;
}
