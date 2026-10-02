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

// ---------------------------------------------------------------------------
// Task 2 — layout mobile
// ---------------------------------------------------------------------------
test.describe('layout mobile', () => {
  test('topbar "Provisões", sem page-header, KPIs na ordem e aba Transações ativa', async ({ page }) => {
    await gotoApp(page, '/financas');
    await expect(page.locator('.m-topbar-title')).toHaveText('Provisões');
    await expect(page.locator('.page-header')).toHaveCount(0);
    const kpis = page.locator('.m-kpi .m-kpi-label');
    await expect(kpis.first()).toHaveText('Disponível');
    await expect(kpis.nth(1)).toHaveText('Receitas');
    await expect(kpis.nth(2)).toHaveText('Despesas');
    await expect(kpis.last()).toHaveText('Caixa');
    await expect(page.getByRole('tab', { name: 'Transações', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px nas 3 abas`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/financas');
      for (const aba of ['Transações', 'Metas', 'Categorias']) {
        await abrirAba(page, aba);
        await page.waitForLoadState('networkidle');
        expect(await overflowOffenders(page), `${aba} @ ${w}px`).toEqual([]);
      }
    });
  }

  test('alvos de toque ≥ 44px nas 3 abas', async ({ page }) => {
    await gotoApp(page, '/financas');
    for (const aba of ['Transações', 'Metas', 'Categorias']) {
      await abrirAba(page, aba);
      await page.waitForLoadState('networkidle');
      expect(await smallTargets(page, '.financas-scope'), aba).toEqual([]);
    }
  });

  test('trocar de aba troca o conteúdo e o Fab (um por vez)', async ({ page }) => {
    await gotoApp(page, '/financas');
    await expect(page.getByRole('button', { name: 'Nova transação' })).toBeVisible();
    await abrirAba(page, 'Metas');
    await expect(page.locator('.m-metas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova meta' })).toBeVisible();
    await abrirAba(page, 'Categorias');
    await expect(page.locator('.m-cats .categoria-list')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova categoria' })).toBeVisible();
    await expect(page.locator('.app-fab')).toHaveCount(1);
    await abrirAba(page, 'Transações');
    await expect(page.locator('.m-tx')).toBeVisible();
    await expect(page.locator('.app-fab')).toHaveCount(1);
  });

  test('tocar no KPI mostra a explicação; Caixa abre os ajustes em sheet', async ({ page }) => {
    await gotoApp(page, '/financas');
    const disponivel = page.locator('.m-kpi', { hasText: 'Disponível' });
    await disponivel.click();
    await expect(page.locator('.m-kpi-explain')).toContainText('Caixa − Guardado');
    await expect(disponivel).toHaveAttribute('aria-expanded', 'true');
    await disponivel.click();
    await expect(page.locator('.m-kpi-explain')).toHaveCount(0);
    await page.locator('.m-kpi', { hasText: 'Caixa' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('h3')).toContainText('Ajustes de Caixa');
  });

  test('lista agrupada por dia (cabeçalhos sem repetir) e "Carregar mais"', async ({ page }) => {
    await gotoApp(page, '/financas');
    const heads = await page.locator('.m-tx-day-head').allTextContents();
    expect(heads.length).toBeGreaterThan(1);
    for (const h of heads) expect(h).toMatch(/^(Hoje|Ontem|Amanhã|[A-Z][a-zá]{2}) · \d{2}\/\d{2}(\/\d{2})?$/);
    for (let i = 1; i < heads.length; i += 1) expect(heads[i]).not.toBe(heads[i - 1]);
    const rows = page.locator('.m-tx-row');
    await expect(rows).toHaveCount(30);
    await page.getByRole('button', { name: /^Carregar mais/ }).click();
    expect(await rows.count()).toBeGreaterThan(30);
  });

  test('linha em 2 níveis: título com reticências, valor à direita, textos ≥ 14px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/financas');
    const row = page.locator('.m-tx-row').first();
    const title = await row.locator('.m-tx-title').boundingBox();
    const valor = await row.locator('.m-tx-valor').boundingBox();
    const meta = await row.locator('.m-tx-meta').boundingBox();
    expect(title.width).toBeGreaterThan(80);
    expect(title.x + title.width).toBeLessThanOrEqual(valor.x + 1);
    expect(meta.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
    expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(56);
    for (const sel of ['.m-tx-title', '.m-tx-valor']) {
      const fs = await row.locator(sel).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(fs).toBeGreaterThanOrEqual(14);
    }
  });

  test('busca filtra a lista sem acento', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'netflix');
    const titles = await page.locator('.m-tx-row .m-tx-title').allTextContents();
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) expect(t).toMatch(/Netflix/);
  });

  test('Fab abre Pontual / Parcelada / Recorrente e leva ao form em sheet', async ({ page }) => {
    await gotoApp(page, '/financas');
    await page.getByRole('button', { name: 'Nova transação' }).click();
    // A linha "Cancelar" (sempre acrescentada pelo ActionSheet) não é uma opção.
    await expect(page.locator('.action-sheet .action-sheet-item:not(.action-sheet-cancel)')).toHaveText(['Pontual', 'Parcelada', 'Recorrente']);
    await page.locator('.action-sheet').getByRole('button', { name: 'Parcelada' }).click();
    const form = page.locator('.modal-overlay.is-sheet').first();
    await expect(form.locator('h3')).toHaveText('Nova Transação Parcelada');
    await form.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
  });
});
