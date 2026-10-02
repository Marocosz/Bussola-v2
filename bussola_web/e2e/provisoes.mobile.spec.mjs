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
    // O mês corrente tem menos de 30 linhas no banco demo: mostra todas as datas para exercitar a paginação.
    await page.getByRole('button', { name: 'Remover filtro Este mês' }).click();
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

// ---------------------------------------------------------------------------
// Task 3 — ações por toque
// ---------------------------------------------------------------------------
test.describe('ações da linha', () => {
  test.describe.configure({ mode: 'serial' });
  const DESC = 'E2E Café mobile';
  const ITEM = '.action-sheet-item:not(.action-sheet-cancel)';

  test('Fab → Pontual: valor decimal, Salvar visível com teclado, cria a transação de hoje', async ({ page }) => {
    await gotoApp(page, '/financas');
    await page.getByRole('button', { name: 'Nova transação' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Pontual' }).click();
    const form = page.locator('.modal-overlay.is-sheet').first();
    await expect(form.locator('h3')).toHaveText('Nova Transação Única');
    await expect(form.locator('input[name="valor"]')).toHaveAttribute('inputmode', 'decimal');

    await page.setViewportSize({ width: 390, height: 480 }); // teclado aberto
    await expect(form.getByRole('button', { name: 'Salvar' })).toBeInViewport();

    await form.locator('input[name="descricao"]').fill(DESC);
    await form.locator('input[name="valor"]').fill('12.5');
    await form.locator('.pk-trigger').click();
    await page.locator('.pk-date-panel').getByRole('button', { name: 'Hoje' }).click();
    await form.locator('.custom-select-trigger').nth(0).click();
    await page.locator('.cs-sheet-list').getByRole('button', { name: /Alimentação/ }).click();
    await form.locator('.custom-select-trigger').nth(1).click();
    await page.locator('.cs-sheet-list').getByRole('button', { name: 'Pix' }).click();
    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Salvo com sucesso.')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await buscar(page, 'E2E Café');
    const row = page.locator('.m-tx-row');
    await expect(row).toHaveCount(1);
    await expect(page.locator('.m-tx-day-head')).toHaveText(['Hoje · 02/10']);
    await expect(row.locator('.m-tx-meta')).toHaveText('Alimentação · Pix');
    await expect(row.locator('.m-tx-valor')).toHaveText(/−\sR\$\s12,50/);
  });

  test('pontual: ActionSheet com Editar e Excluir; Editar abre o form preenchido', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'E2E Café');
    await page.locator('.m-tx-row .m-tx-title').click();
    const sheet = page.locator('.action-sheet');
    await expect(sheet.locator('.action-sheet-titles strong')).toHaveText(DESC);
    await expect(sheet.locator(ITEM)).toHaveText(['Editar', 'Excluir']);
    await sheet.getByRole('button', { name: 'Editar' }).click();
    const form = page.locator('.modal-overlay.is-sheet').first();
    await expect(form.locator('h3')).toHaveText('Editar Transação');
    await expect(form.locator('input[name="descricao"]')).toHaveValue(DESC);
    await form.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
  });

  test('teclado: Enter na linha abre o ActionSheet', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'E2E Café');
    await page.locator('.m-tx-row').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.action-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.action-sheet')).toHaveCount(0);
  });

  test('recorrente com histórico: Efetivar primário, Ver histórico e Encerrar (sem Excluir)', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'Netflix');
    const pendente = page.locator('.m-tx-row').filter({ has: page.locator('.m-tx-efetivar') }).first();
    const chip = await pendente.locator('.m-tx-efetivar').boundingBox();
    expect(chip.height).toBeGreaterThanOrEqual(44);
    expect(chip.width).toBeGreaterThanOrEqual(44);
    await pendente.locator('.m-tx-title').click();
    const items = page.locator('.action-sheet').locator(ITEM);
    await expect(items).toHaveText(['Efetivar', 'Editar', 'Ver histórico', 'Encerrar recorrência']);
    await expect(items.first()).toHaveClass(/is-primary/);
    await expect(items.last()).toHaveClass(/is-danger/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.action-sheet')).toHaveCount(0);
  });

  test('parcelada: Ver parcelas abre o sheet com todas as parcelas do grupo', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'Macbook');
    await page.locator('.m-tx-row .m-tx-title').first().click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Ver parcelas' }).click();
    const sheet = page.locator('.m-parcelas');
    await expect(sheet.locator('.parcela-sub-row')).toHaveCount(10);
    await expect(sheet.locator('.parcela-sub-current')).toHaveCount(1);
    expect(await overflowOffenders(page)).toEqual([]);
    for (const r of await sheet.locator('.parcela-sub-row').all()) expect((await r.boundingBox()).height).toBeGreaterThanOrEqual(44);
  });

  test('Excluir pelo ActionSheet remove a transação', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'E2E Café');
    await page.locator('.m-tx-row .m-tx-title').click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(page.getByText('Transação removida.')).toBeVisible();
    await expect(page.locator('.m-tx-row')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Task 4 — filtros
// ---------------------------------------------------------------------------
test.describe('filtros', () => {
  const FILTROS = /^Filtros/;
  const abrirFiltros = (page) => page.getByRole('button', { name: FILTROS }).click();
  const carregarTudo = async (page) => {
    const mais = page.getByRole('button', { name: /^Carregar mais/ });
    while (await mais.count()) await mais.click();
  };

  test('padrão no celular: chip "Este mês" removível e primeiro dia dentro do mês corrente', async ({ page }) => {
    await gotoApp(page, '/financas');
    await expect(page.locator('.m-active-chip')).toHaveText(['Este mês']);
    await expect(page.getByRole('button', { name: 'Filtros (1 ativo)' })).toBeVisible();
    const heads = page.locator('.m-tx-day-head');
    await expect(heads.first()).toBeVisible();
    for (const h of await heads.allTextContents()) expect(h).toMatch(/ · \d{2}\/10$/); // sem sufixo de ano: 2026
    await page.getByRole('button', { name: 'Remover filtro Este mês' }).click();
    await expect(page.locator('.m-active-chip')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible();
    await expect(page.locator('.m-tx-day-head').first()).not.toHaveText(/ · \d{2}\/10$/); // todas as datas: parcelas futuras
  });

  test('período removido pelo usuário não volta ao redimensionar (390 → 1280 → 390)', async ({ page }) => {
    await gotoApp(page, '/financas');
    await page.getByRole('button', { name: 'Remover filtro Este mês' }).click();
    await expect(page.locator('.m-active-chip')).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.m-tx-day-head').first()).toBeVisible();
    await expect(page.locator('.m-active-chip')).toHaveCount(0);
  });

  test('Tipo=Parcelada: "Ver N" bate com a lista e o chip remove', async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrirFiltros(page);
    const sheet = page.locator('.m-filters');
    await sheet.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Parcelada' }).click();
    await expect(sheet.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Parcelada' })).toHaveAttribute('aria-pressed', 'true');
    const ver = sheet.getByRole('button', { name: /^Ver \d+ transaç/ });
    const n = Number((await ver.textContent()).match(/\d+/)[0]);
    expect(n).toBeGreaterThan(0);
    await ver.click();
    await expect(sheet).toHaveCount(0);

    await expect(page.getByRole('button', { name: 'Filtros (2 ativos)' })).toBeVisible();
    await expect(page.locator('.m-filter-badge')).toHaveText('2');
    await carregarTudo(page);
    const rows = page.locator('.m-tx-row');
    await expect(rows).toHaveCount(n);
    expect([...new Set(await rows.evaluateAll((els) => els.map((e) => e.dataset.tipo)))]).toEqual(['parcelada']);

    await page.getByRole('button', { name: 'Remover filtro Parcelada' }).click();
    await expect(page.getByRole('button', { name: 'Filtros (1 ativo)' })).toBeVisible();
    await expect(page.locator('.m-filter-badge')).toHaveText('1');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('o contador do sheet acompanha o rascunho e só aplica no "Ver"', async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrirFiltros(page);
    const sheet = page.locator('.m-filters');
    const ver = sheet.getByRole('button', { name: /^Ver \d+ transaç/ });
    const total = Number((await ver.textContent()).match(/\d+/)[0]);
    await sheet.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Pendente' }).click();
    const pendentes = Number((await ver.textContent()).match(/\d+/)[0]);
    expect(pendentes).toBeLessThan(total);
    await page.keyboard.press('Escape'); // descarta o rascunho
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('.m-filter-badge')).toHaveText('1'); // só o "Este mês" padrão
  });

  test('Ordenar por maior valor desliga os cabeçalhos de dia e ordena', async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrirFiltros(page);
    const sheet = page.locator('.m-filters');
    await sheet.getByRole('group', { name: 'Ordenar' }).getByRole('button', { name: 'Maior valor' }).click();
    await sheet.getByRole('button', { name: /^Ver \d+ transaç/ }).click();
    await expect(page.locator('.m-tx-day-head')).toHaveCount(0);
    const valores = (await page.locator('.m-tx-valor').allTextContents())
      .slice(0, 6)
      .map((s) => Number(s.replace(/[^\d,]/g, '').replace(',', '.')));
    for (let i = 1; i < valores.length; i += 1) expect(valores[i]).toBeLessThanOrEqual(valores[i - 1]);
  });

  test('Período personalizado usa DatePicker em sheet e vira chip', async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrirFiltros(page);
    const sheet = page.locator('.m-filters');
    await sheet.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Personalizado' }).click();
    await expect(sheet.locator('.m-filter-range .pk-trigger')).toHaveCount(2);
    await sheet.locator('.m-filter-range .pk-trigger').first().click();
    await page.locator('.pk-date-panel').getByRole('button', { name: 'Hoje' }).click();
    await sheet.getByRole('button', { name: /^Ver \d+ transaç/ }).click();
    await expect(page.locator('.m-active-chip')).toHaveText(['02/10–…']);
  });

  test('sheet de filtros sem overflow em 360px e com alvos de 44px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoApp(page, '/financas');
    await abrirFiltros(page);
    await expect(page.locator('.m-filters')).toBeVisible();
    expect(await overflowOffenders(page)).toEqual([]);
    expect(await smallTargets(page, '.m-filters')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 5 — Metas
// ---------------------------------------------------------------------------
test.describe('metas', () => {
  test.describe.configure({ mode: 'serial' });
  const META = 'E2E Viagem';

  test.beforeAll(async ({ playwright }) => {
    const r = await playwright.request.newContext();
    await apiJson(r, 'POST', '/financas/metas', { nome: META, valor_alvo: 1000, icone: 'fa-solid fa-piggy-bank', cor: '#4A6DFF' });
    await r.dispose();
  });

  test('aba Metas: cards em 1 coluna e explicação visível', async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrirAba(page, 'Metas');
    await expect(page.locator('.metas-explain')).toContainText('transferência');
    await expect(page.locator('.m-metas .metas-kpis-info')).toHaveCount(0);
    const card = page.locator('.m-metas .meta-card').filter({ hasText: META });
    await expect(card).toBeVisible();
    const painel = await page.locator('.m-metas').boundingBox();
    expect(Math.round((await card.boundingBox()).width)).toBe(Math.round(painel.width));
    expect(await smallTargets(page, '.m-metas')).toEqual([]);
  });

  test('Guardar → cena em tela cheia, pote ao lado do saldo, confirmar alcançável, histórico em scroll único', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 480 });
    await gotoApp(page, '/financas');
    await abrirAba(page, 'Metas');
    await page.locator('.m-metas .meta-card').filter({ hasText: META }).getByRole('button', { name: 'Guardar' }).click();

    const sheet = page.locator('.modal-overlay.is-sheet-full');
    await expect(sheet.locator('.cofre-body')).toBeVisible();
    const jar = await sheet.locator('.jar').boundingBox();
    const saldo = await sheet.locator('.cofre-progress-num').boundingBox();
    expect(jar.width).toBeLessThanOrEqual(100);
    expect(jar.x).toBeGreaterThanOrEqual(saldo.x + saldo.width - 1);           // ao lado
    expect(Math.abs((jar.y + jar.height / 2) - (saldo.y + saldo.height / 2))).toBeLessThan(60); // mesma linha
    for (const b of await sheet.locator('.cofre-chips button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await overflowOffenders(page)).toEqual([]);

    await sheet.getByRole('button', { name: '+50', exact: true }).click();
    const confirmar = sheet.getByRole('button', { name: /^Guardar R\$/ });
    await expect(confirmar).toBeInViewport();
    await confirmar.click();
    await expect(page.getByText('Guardado!')).toBeVisible();
    await expect(sheet.locator('.cofre-progress-num strong')).toContainText('50,00');

    await sheet.getByRole('button', { name: /Ver movimentações/ }).click();
    await expect(sheet.locator('h3')).toContainText('Movimentações');
    await expect(sheet.locator('.meta-timeline li')).toHaveCount(1);
    expect(await sheet.locator('.meta-timeline-scroll').evaluate((e) => getComputedStyle(e).maxHeight)).toBe('none');
    for (const b of await sheet.locator('.meta-timeline .btn-action-icon').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await smallTargets(page, '.modal-overlay.is-sheet-full .modal-header')).toEqual([]);

    await sheet.getByRole('button', { name: 'Voltar' }).click();
    await expect(sheet.locator('.cofre-body')).toBeVisible();
    await sheet.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.locator('.modal-overlay.is-sheet-full')).toHaveCount(0);
  });

  test('Nova meta pelo Fab: form em tela cheia, valor decimal, ícone em sheet de 6 colunas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 480 });
    await gotoApp(page, '/financas');
    await abrirAba(page, 'Metas');
    await page.getByRole('button', { name: 'Nova meta' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet-full').first();
    await expect(sheet.locator('h3')).toHaveText('Nova meta');
    await expect(sheet.locator('input[type="number"]').first()).toHaveAttribute('inputmode', 'decimal');
    await expect(sheet.getByRole('button', { name: 'Salvar meta' })).toBeInViewport();

    await sheet.locator('.picker-preview').first().click();
    const grid = page.locator('.picker-sheet .picker-sheet-grid');
    await expect(grid).toBeVisible();
    expect(await grid.evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length)).toBe(6);
    const opcao = grid.locator('.icon-option').nth(3);
    const icone = await opcao.getAttribute('aria-label');
    await opcao.click();
    await expect(page.locator('.picker-sheet')).toHaveCount(0);
    await expect(sheet.locator('.picker-preview i').first()).toHaveAttribute('class', icone);

    await sheet.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.modal-overlay.is-sheet-full')).toHaveCount(0);
  });

  test('eixos do gráfico do histórico: dd/mm e BRL compacto', async ({ page }) => {
    await gotoApp(page, '/financas');
    const r = await page.evaluate(async () => {
      const m = await import('/src/pages/Metas/chartFormat.js');
      return [m.tickDiaMes('05/09/2026'), m.tickBRLCompacto(1234), m.tickBRLCompacto(15000), m.tickBRLCompacto('500')];
    });
    expect(r[0]).toBe('05/09');
    expect(r[1]).toMatch(/^R\$\s1,2\smil$/);
    expect(r[2]).toMatch(/^R\$\s15\smil$/);
    expect(r[3]).toMatch(/^R\$\s500$/);
  });
});
