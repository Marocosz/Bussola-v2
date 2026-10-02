import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, apiJson, smallTargets } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Infra do arquivo
// ---------------------------------------------------------------------------
const abrirAba = (page, nome) => page.getByRole('tab', { name: nome, exact: true }).click();
const buscar = (page, texto) => page.getByRole('searchbox', { name: 'Buscar transações' }).fill(texto);

// Remove tudo que os testes criam (prefixo "E2E "): sem isso a base visual do desktop quebra.
async function limparE2E(request) {
  const dash = await apiJson(request, 'GET', '/financas/');
  const transacoes = [
    ...Object.values(dash.transacoes_pontuais || {}).flat(),
    ...Object.values(dash.transacoes_recorrentes || {}).flat(),
  ];
  for (const t of transacoes.filter((x) => String(x.descricao).startsWith('E2E '))) {
    await apiJson(request, 'DELETE', `/financas/transacoes/${t.id}`);
  }
  for (const g of (dash.transacoes_cofre || []).filter((x) => String(x.nome).startsWith('E2E '))) {
    for (const mv of g.movimentacoes || []) await apiJson(request, 'DELETE', `/financas/metas/${g.meta_id}/movimentacoes/${mv.id}`);
  }
  const metas = await apiJson(request, 'GET', '/financas/metas');
  for (const m of metas.metas.filter((x) => x.nome.startsWith('E2E '))) {
    for (const mv of await apiJson(request, 'GET', `/financas/metas/${m.id}/movimentacoes`)) {
      await apiJson(request, 'DELETE', `/financas/metas/${m.id}/movimentacoes/${mv.id}`);
    }
    await apiJson(request, 'DELETE', `/financas/metas/${m.id}`);
  }
  const cats = await apiJson(request, 'GET', '/financas/');
  for (const c of [...cats.categorias_despesa, ...cats.categorias_receita].filter((x) => x.nome.startsWith('E2E '))) {
    await apiJson(request, 'DELETE', `/financas/categorias/${c.id}`);
  }
  for (const a of (await apiJson(request, 'GET', '/financas/caixa/ajustes')).filter((x) => String(x.observacao || '').startsWith('E2E '))) {
    await apiJson(request, 'DELETE', `/financas/caixa/ajustes/${a.id}`);
  }
}

test.beforeAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  await r.dispose();
});

test.afterAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  await r.dispose();
});

// ---------------------------------------------------------------------------
// Task 1 — lógica pura (importada pelo próprio Vite dev server)
// ---------------------------------------------------------------------------
test.describe('lógica pura', () => {
  test('filterAndSortTransactions: busca sem acento, tipo, ordenação e histórico do grupo', async ({ page }) => {
    await gotoApp(page, '/financas');
    const r = await page.evaluate(async () => {
      const q = await import('/src/pages/Financas/transactionsQuery.js');
      const cat = (id, nome) => ({ id, nome, tipo: 'despesa' });
      const data = {
        transacoes_pontuais: { 'Outubro/2026': [
          { id: 1, descricao: 'Café da manhã', valor: 12, data: '2026-10-02T00:00:00', tipo_recorrencia: 'pontual', status: 'Efetivada', categoria: cat(9, 'Alimentação') },
          { id: 2, descricao: 'Mercado', valor: 300, data: '2026-10-01T00:00:00', tipo_recorrencia: 'pontual', status: 'Efetivada', categoria: cat(8, 'Mercado') },
        ] },
        transacoes_recorrentes: { 'Outubro/2026': [
          { id: 3, descricao: 'Netflix', valor: 55.9, data: '2026-10-05T00:00:00', tipo_recorrencia: 'recorrente', status: 'Pendente', id_grupo_recorrencia: 'g1', categoria: cat(7, 'Assinaturas') },
          { id: 4, descricao: 'Netflix', valor: 55.9, data: '2026-09-05T00:00:00', tipo_recorrencia: 'recorrente', status: 'Efetivada', id_grupo_recorrencia: 'g1', categoria: cat(7, 'Assinaturas') },
        ] },
        transacoes_cofre: [],
      };
      const f = { ...q.FILTER_DEFAULTS };
      const desc = { column: 'data', dir: 'desc' };
      const ids = (list) => list.map((t) => t.id);
      return {
        todas: ids(q.filterAndSortTransactions(data, f, desc)),
        busca: ids(q.filterAndSortTransactions(data, { ...f, search: 'cafe' }, desc)),
        buscaCategoria: ids(q.filterAndSortTransactions(data, { ...f, search: 'ASSINAT' }, desc)),
        recorrentes: ids(q.filterAndSortTransactions(data, { ...f, tipo: 'recorrente' }, desc)),
        porValor: ids(q.filterAndSortTransactions(data, f, { column: 'valor', dir: 'asc' })),
        grupo: q.filterAndSortTransactions(data, f, desc).find((t) => t.id === 3)._allParcelas.length,
        semDados: q.filterAndSortTransactions(null, f, desc).length,
      };
    });
    expect(r).toEqual({
      todas: [3, 1, 2, 4],
      busca: [1],
      buscaCategoria: [3, 4],
      recorrentes: [3, 4],
      porValor: [1, 4, 3, 2], // empate em 55,90 desempata pela data (asc)
      grupo: 2,
      semDados: 0,
    });
  });

  test('groupByDay: Hoje/Ontem/Amanhã, dia da semana e ano diferente', async ({ page }) => {
    await gotoApp(page, '/financas');
    const labels = await page.evaluate(async () => {
      const q = await import('/src/pages/Financas/transactionsQuery.js');
      const now = new Date(2026, 9, 2, 12);
      const list = ['2026-10-03T00:00:00', '2026-10-02T09:00:00', '2026-10-02T00:00:00', '2026-10-01T00:00:00', '2026-09-25T00:00:00', '2025-12-31T00:00:00']
        .map((data, i) => ({ id: i, data }));
      return q.groupByDay(list, now).map((g) => `${g.label}#${g.items.length}`);
    });
    expect(labels).toEqual(['Amanhã · 03/10#1', 'Hoje · 02/10#2', 'Ontem · 01/10#1', 'Sex · 25/09#1', 'Qua · 31/12/25#1']);
  });

  test('activeFilterChips: rótulos e ordem', async ({ page }) => {
    await gotoApp(page, '/financas');
    const chips = await page.evaluate(async () => {
      const q = await import('/src/pages/Financas/transactionsQuery.js');
      return q.activeFilterChips(
        { ...q.FILTER_DEFAULTS, tipo: 'parcelada', pagamento: 'pix', categoria: 9, datePreset: 'custom', dateStart: '2026-09-01', dateEnd: '2026-09-30' },
        { categorias_despesa: [{ id: 9, nome: 'Alimentação' }], categorias_receita: [] },
      );
    });
    expect(chips).toEqual([
      { key: 'tipo', label: 'Parcelada' },
      { key: 'pagamento', label: 'Pix' },
      { key: 'categoria', label: 'Alimentação' },
      { key: 'datePreset', label: '01/09–30/09' },
    ]);
  });
});
