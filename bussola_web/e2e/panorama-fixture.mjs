// Dados fixos do Panorama para os testes E2E. Intercepta GET /api/v1/panorama/ e devolve um
// payload sintético e determinístico: o banco demo não tem cofrinhos nem alertas fixos, e vários
// números dependem da data do servidor. Não grava nada no banco (não há o que limpar).
export const PANORAMA_API = /\/api\/v1\/panorama\/(\?.*)?$/;

export const MESES12 = ['nov/25', 'dez/25', 'jan/26', 'fev/26', 'mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26'];
export const RECEITA12 = [7000, 7200, 6900, 7400, 7600, 7300, 7800, 8100, 7900, 8200, 8000, 8400];
export const DESPESA12 = [5200, 5100, 5600, 5300, 5000, 5400, 5900, 5200, 5500, 5300, 5230, 5120];
// Caixa sobe até o valor atual (o último ponto é o pico → cubo ~94% cheio, com bolhas).
const CAIXA_FATOR = [0.45, 0.52, 0.58, 0.63, 0.7, 0.74, 0.8, 0.85, 0.88, 0.93, 0.97, 1];

export const ALERTAS = [
  { id: 'e2e-orc', tipo: 'financas', severidade: 'perigo', titulo: 'Orçamento estourado: Lazer', detalhe: '128% do limite usado no período.', acao: '/financas' },
  { id: 'e2e-vencer', tipo: 'financas', severidade: 'aviso', titulo: '2 conta(s) vencendo em 7 dias', detalhe: 'Confira as provisões para não perder o prazo.', acao: '/financas' },
  { id: 'e2e-meta', tipo: 'metas', severidade: 'info', titulo: "Cofrinho 'Viagem' perto da meta", detalhe: 'No ritmo atual, deve concluir ainda este mês.', acao: '/financas' },
  { id: 'e2e-aportes', tipo: 'metas', severidade: 'info', titulo: '1 aporte(s) automático(s) a confirmar', detalhe: 'Confirme para efetivar nos seus cofrinhos.', acao: '/financas' },
  { id: 'e2e-parado', tipo: 'metas', severidade: 'info', titulo: "Cofrinho 'Notebook' parado", detalhe: 'Sem aportes há 52 dias.', acao: '/financas' },
];

export function panoramaFixture({ insights = 3, caixa = 18500, guardado = 4200 } = {}) {
  return {
    kpis: {
      caixa,
      receita_mes: 8400,
      despesa_mes: 5120,
      balanco_mes: 3280,
      tarefas_pendentes: { critica: 1, alta: 2, media: 3, baixa: 1 },
      tarefas_concluidas: 5,
      total_anotacoes: 12,
      compromissos_realizados: 4,
      compromissos_pendentes: 3,
      compromissos_perdidos: 1,
      proximo_compromisso: { titulo: 'Consulta médica', data: '2026-10-05T14:30:00' },
      chaves_ativas: 9,
      chaves_expiradas: 2,
    },
    forecast: { status: 'ok', realizado: 5120, projetado: 6100 },
    comparativo: { receita: 8077, despesa: 5230, balanco: 2847 },
    orcamento: [
      { nome: 'Lazer', cor: '#a855f7', icone: 'fa-solid fa-gamepad', gasto: 640, limite: 500, limite_mensal: 500, meses: 1, pct: 128 },
      { nome: 'Mercado', cor: '#27ae60', icone: 'fa-solid fa-cart-shopping', gasto: 930, limite: 1000, limite_mensal: 1000, meses: 1, pct: 93 },
      { nome: 'Transporte', cor: '#f39c12', icone: 'fa-solid fa-car', gasto: 210, limite: 600, limite_mensal: 600, meses: 1, pct: 35 },
    ],
    insights: ALERTAS.slice(0, insights),
    cofrinhos: {
      total_guardado: guardado,
      qtd: 3,
      metas: [
        { id: 9001, nome: 'Reserva de emergência', saldo_atual: 2500, valor_alvo: 10000, progresso_pct: 25, cor: '#4A6DFF', data_projetada: '2027-06-01' },
        { id: 9002, nome: 'Viagem', saldo_atual: 1200, valor_alvo: 1500, progresso_pct: 80, cor: '#a855f7', data_projetada: '2026-10-20' },
        { id: 9003, nome: 'Notebook', saldo_atual: 500, valor_alvo: 6000, progresso_pct: 8, cor: '#27ae60', data_projetada: null },
      ],
    },
    ritmo: { peso_atual: 78.4, peso_delta: -1.2, objetivo: 'hipertrofia', plano_ativo: 'Treino ABC', dieta_calorias: 2450 },
    gastos_por_categoria: { labels: ['Moradia', 'Mercado', 'Lazer', 'Transporte'], data: [2400, 930, 640, 210], colors: ['#4A6DFF', '#27ae60', '#a855f7', '#f39c12'] },
    receitas_por_categoria: { labels: [], data: [], colors: [] },
    gastos_por_tipo_pagamento: { labels: ['Pix', 'Crédito', 'Débito'], data: [2100, 1800, 400], colors: ['#27ae60', '#4A6DFF', '#f39c12'] },
    evolucao_labels: MESES12,
    evolucao_mensal_receita: RECEITA12,
    evolucao_mensal_despesa: DESPESA12,
    evolucao_caixa_real: CAIXA_FATOR.map((f) => Math.round(caixa * f)),
    gasto_semanal: { labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], data: [10, 20, 30, 80, 40, 50, 60] },
  };
}

// Registra a interceptação ANTES do gotoApp. Usa a resposta real só pelos cabeçalhos (CORS).
export async function usarFixture(page, opts) {
  await page.route(PANORAMA_API, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: panoramaFixture(opts) });
  });
}
