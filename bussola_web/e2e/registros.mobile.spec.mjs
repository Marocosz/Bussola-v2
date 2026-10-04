import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets, apiJson } from './helpers.mjs';
import { comApi, limparRegistrosE2E, criarNota, grupoPorNome, notaPorTitulo, criarTarefa, tarefaPorTitulo, criarHabito, habitoPorTitulo } from './registros-data.mjs';

// ---------------------------------------------------------------------------
// Infra do arquivo
// ---------------------------------------------------------------------------
const abrirAba = (page, nome) => page.getByRole('tab', { name: nome, exact: true }).click();

// Simula teclado virtual de 424px: área visível de 420px com o layout em 844.
const teclado = (page) => page.evaluate(() => {
  const s = document.documentElement.style;
  s.setProperty('--vvh', '420px');
  s.setProperty('--kb-inset', '424px');
});

const focoEmCampo = (page) => page.evaluate(() => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName));

async function abrirAcordeao(page, nome) {
  const h = page.locator('.accordion-header', { hasText: nome }).first();
  if (!(await h.evaluate((e) => e.classList.contains('active')))) await h.click();
  await expect(h).toHaveClass(/active/);
  await page.waitForTimeout(350); // transição do acordeão (0.3s)
}

test.beforeAll(async ({ playwright }) => comApi(playwright, limparRegistrosE2E));
test.afterAll(async ({ playwright }) => comApi(playwright, limparRegistrosE2E));

// ---------------------------------------------------------------------------
// Task 1 — lógica pura (importada pelo próprio Vite dev server)
// ---------------------------------------------------------------------------
test.describe('lógica pura', () => {
  test('jornadaUtils: hábitos de hoje, mensagem e data por extenso', async ({ page }) => {
    await gotoApp(page, '/registros');
    const r = await page.evaluate(async () => {
      const j = await import('/src/pages/Registros/jornadaUtils.js');
      const sexta = new Date(2026, 9, 2, 12);
      const h = (status, frequencia, feito) => ({ status, frequencia, registro_hoje: feito == null ? null : { concluido: feito } });
      const habitos = [h('ativo', ['sex'], true), h('ativo', ['sex', 'sab'], false), h('pausado', ['sex'], true), h('ativo', ['seg'], true)];
      return {
        hoje: j.getTodayKey(sexta),
        conta: j.contarHabitosHoje(habitos, sexta),
        vazio: j.contarHabitosHoje([], sexta),
        msg: j.calcularProgressoJornada(habitos, sexta).mensagem,
        msgVazio: j.calcularProgressoJornada([], sexta),
        data: j.formatarDataJornada(sexta),
      };
    });
    expect(r).toEqual({
      hoje: 'sex',
      conta: { feitos: 1, total: 2, pct: 50 },
      vazio: { feitos: 0, total: 0, pct: 0 },
      msg: 'Mais da metade. Bora!',
      msgVazio: { pct: 0, mensagem: 'Comece sua jornada!' },
      data: 'Sexta-feira, 2 de out',
    });
  });
});

// ---------------------------------------------------------------------------
// Task 2 — casca e Caderno
// ---------------------------------------------------------------------------
// Abas já adaptadas ao celular (as próximas tasks acrescentam as outras).
const ABAS_VERIFICADAS = ['Caderno', 'Tarefas', 'Jornada'];

test.describe('casca e Caderno', () => {
  test('topbar "Registros", abas segmentadas de largura total e um Fab por aba', async ({ page }) => {
    await gotoApp(page, '/registros');
    await expect(page.locator('.m-topbar-title')).toHaveText('Registros');
    await expect(page.locator('.registros-main-header')).toHaveCount(0);
    const tabs = await page.locator('.reg-m-tabs').boundingBox();
    expect(Math.round(tabs.x)).toBe(16);
    expect(Math.round(tabs.width)).toBe(390 - 32);
    await expect(page.getByRole('tab', { name: 'Caderno', exact: true })).toHaveAttribute('aria-selected', 'true');
    for (const [aba, fab] of [['Caderno', 'Nova nota'], ['Tarefas', 'Nova tarefa'], ['Jornada', 'Novo hábito']]) {
      await abrirAba(page, aba);
      await expect(page.locator('.app-fab')).toHaveCount(1);
      await expect(page.locator('.app-fab')).toHaveAttribute('aria-label', fab);
    }
  });

  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/registros');
      for (const aba of ABAS_VERIFICADAS) {
        await abrirAba(page, aba);
        await page.waitForLoadState('networkidle');
        expect(await overflowOffenders(page), `${aba} @ ${w}px`).toEqual([]);
      }
    });
  }

  test('alvos de toque ≥ 44px nas abas', async ({ page }) => {
    await gotoApp(page, '/registros');
    for (const aba of ABAS_VERIFICADAS) {
      await abrirAba(page, aba);
      await page.waitForLoadState('networkidle');
      expect(await smallTargets(page, '.registros-scope'), aba).toEqual([]);
    }
  });

  test('Caderno: conteúdo ≥ 14px, secundário ≥ 12px, caixa alta ≥ 11px', async ({ page }) => {
    await gotoApp(page, '/registros');
    const t = await page.evaluate(() => {
      const fs = (sel) => [...document.querySelectorAll(sel)].map((e) => parseFloat(getComputedStyle(e).fontSize));
      return {
        principal: [...fs('.anotacao-titulo'), ...fs('.anotacao-conteudo'), ...fs('.reg-chip')],
        secundario: fs('.anotacao-data'),
        caixaAlta: fs('.accordion-header .header-meta span'),
      };
    });
    expect(Math.min(...t.principal)).toBeGreaterThanOrEqual(14);
    expect(Math.min(...t.secundario)).toBeGreaterThanOrEqual(12);
    expect(Math.min(...t.caixaAlta)).toBeGreaterThanOrEqual(11);
  });

  test('busca de largura total e chips de grupo filtram as notas', async ({ page, request }) => {
    const pessoal = await grupoPorNome(request, 'Pessoal');
    await criarNota(request, { titulo: 'E2E busca única', grupo_id: pessoal.id });
    await gotoApp(page, '/registros');
    const busca = page.getByRole('searchbox', { name: 'Buscar anotações' });
    expect(Math.round((await busca.boundingBox()).width)).toBe(390 - 32);
    await busca.fill('E2E busca única');
    await expect(page.locator('.accordion-header')).toHaveCount(1);
    await expect(page.locator('.accordion-header')).toContainText('Pessoal');
    await busca.fill('');
    const chips = page.locator('.reg-m-chips');
    await expect(chips.getByRole('button', { name: 'Todos', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await chips.getByRole('button', { name: 'Pessoal', exact: true }).click();
    await expect(chips.getByRole('button', { name: 'Pessoal', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const grupos = await page.locator('.group-accordion:not(:has(.pinned-header)) .header-title-wrapper').allTextContents();
    expect(grupos.map((g) => g.trim())).toEqual(['Pessoal']);
  });

  test('card de nota: ⋯ visível com Editar / Fixar / Excluir (sem ações de hover)', async ({ page, request }) => {
    const pessoal = await grupoPorNome(request, 'Pessoal');
    await criarNota(request, { titulo: 'E2E card menu', grupo_id: pessoal.id });
    await gotoApp(page, '/registros');
    await page.getByRole('searchbox', { name: 'Buscar anotações' }).fill('E2E card menu');
    await abrirAcordeao(page, 'Pessoal');
    const card = page.locator('.accordion-wrapper.open .anotacao-card', { hasText: 'E2E card menu' });
    await expect(card.locator('.anotacao-actions')).toHaveCount(0);
    const mais = card.getByRole('button', { name: 'Ações de E2E card menu' });
    const b = await mais.boundingBox();
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    await mais.click();
    await expect(page.locator('.view-modal')).toHaveCount(0); // o ⋯ não abre a nota
    const acoes = page.locator('.action-sheet');
    await expect(acoes.locator('.action-sheet-item')).toHaveText(['Editar', 'Fixar no topo', 'Excluir', 'Cancelar']);
    await acoes.getByRole('button', { name: 'Fixar no topo' }).click();
    await expect.poll(async () => (await notaPorTitulo(request, 'E2E card menu'))?.fixado).toBe(true);
    await expect(page.locator('.group-accordion').first().locator('.pinned-header')).toHaveCount(1); // Fixados primeiro

    await page.locator('.accordion-wrapper.open .anotacao-card', { hasText: 'E2E card menu' }).first()
      .getByRole('button', { name: /^Ações de/ }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
    const editor = page.locator('.modal-overlay.is-sheet');
    await expect(editor).toBeVisible();
    await expect(editor.locator('.modal-body input[type="text"]').first()).toHaveValue('E2E card menu');
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);

    await page.locator('.accordion-wrapper.open .anotacao-card', { hasText: 'E2E card menu' }).first()
      .getByRole('button', { name: /^Ações de/ }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir' }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Excluir' }).click();
    await expect.poll(() => notaPorTitulo(request, 'E2E card menu')).toBeNull();
  });

  test('chip "Grupos" abre a gestão com editar/excluir de 44px; criar e excluir um grupo', async ({ page }) => {
    await gotoApp(page, '/registros');
    const chips = page.locator('.reg-m-chips');
    await chips.getByRole('button', { name: 'Grupos', exact: true }).click();
    const sheet = page.locator('.reg-sheet');
    await expect(sheet.getByRole('heading', { name: 'Grupos' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Editar Pessoal' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Excluir Pessoal' })).toBeVisible();
    expect(await smallTargets(page, '.reg-sheet')).toEqual([]);

    await sheet.getByRole('button', { name: 'Novo grupo' }).click();
    await expect(page.locator('.reg-sheet')).toHaveCount(0); // fecha antes: o modal ficaria atrás do sheet
    const modal = page.locator('.modal-overlay.is-sheet', { has: page.locator('.compact-modal') });
    await expect(modal.getByRole('heading', { name: 'Novo Grupo' })).toBeVisible();
    expect(await focoEmCampo(page)).toBe(false);
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    await modal.getByPlaceholder('Ex: Estudos...').fill('E2E Grupo');
    const cores = modal.getByRole('radio');
    expect(await cores.count()).toBeGreaterThan(0);
    await cores.last().click();
    await expect(cores.last()).toHaveAttribute('aria-checked', 'true');
    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(chips.getByRole('button', { name: 'E2E Grupo', exact: true })).toBeVisible();

    await chips.getByRole('button', { name: 'Grupos', exact: true }).click();
    await page.locator('.reg-sheet').getByRole('button', { name: 'Excluir E2E Grupo' }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(chips.getByRole('button', { name: 'E2E Grupo', exact: true })).toHaveCount(0);
  });

  test('Novo grupo com teclado (--vvh 420): Salvar visível', async ({ page }) => {
    await gotoApp(page, '/registros');
    await teclado(page);
    await page.locator('.reg-m-chips').getByRole('button', { name: 'Grupos', exact: true }).click();
    await page.locator('.reg-sheet').getByRole('button', { name: 'Novo grupo' }).click();
    const salvar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Salvar' });
    await expect.poll(async () => { const b = await salvar.boundingBox(); return b && Math.round(b.y + b.height); }).toBeLessThanOrEqual(420);
  });
});

// ---------------------------------------------------------------------------
// Task 3 — editor de nota e visualização
// ---------------------------------------------------------------------------
test.describe('editor e visualização de nota', () => {
  test('Fab → tela cheia com ✕ · fixar · preview · Salvar, sem dica de atalhos e sem foco automático', async ({ page }) => {
    await gotoApp(page, '/registros');
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await expect(ov).toBeVisible();
    const top = ov.locator('.nota-m-topbar');
    for (const nome of ['Fechar', 'Fixar no topo', 'Pré-visualizar', 'Salvar']) {
      await expect(top.getByRole('button', { name: nome, exact: true })).toBeVisible();
    }
    await expect(ov.getByText('Ctrl+B negrito', { exact: false })).toBeHidden();
    await expect(ov.locator('.modal-footer-custom')).toBeHidden();
    expect(await focoEmCampo(page)).toBe(false);
    // barra de formatação: uma linha só, rolável, botões de 40px
    const btns = ov.locator('.md-toolbar .md-toolbar-btn');
    const tops = await btns.evaluateAll((bs) => [...new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)))]);
    expect(tops).toHaveLength(1);
    const alturas = await btns.evaluateAll((bs) => [...new Set(bs.map((b) => Math.round(b.getBoundingClientRect().height)))]);
    expect(alturas).toEqual([40]);
    expect(await ov.locator('.md-toolbar').evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    // 40px é exceção aprovada só para a barra de formatação
    expect((await smallTargets(page, '.modal-overlay.is-sheet-full')).filter((s) => !s.includes('md-toolbar-btn'))).toEqual([]);
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await overflowOffenders(page)).toEqual([]);
  });

  test('editor com teclado (--vvh 420): barra de formatação acima do teclado e Salvar visível', async ({ page }) => {
    await gotoApp(page, '/registros');
    await teclado(page);
    await page.locator('.app-fab').click();
    const tb = page.locator('.nota-editor .md-toolbar');
    await expect.poll(async () => { const b = await tb.boundingBox(); return b && Math.round(b.y + b.height); }).toBeLessThanOrEqual(421);
    const salvar = await page.locator('.nota-m-topbar').getByRole('button', { name: 'Salvar', exact: true }).boundingBox();
    expect(salvar.y).toBeGreaterThanOrEqual(0);
    expect((await page.locator('.nota-editor .md-textarea').boundingBox()).height).toBeGreaterThanOrEqual(88);
  });

  test('grupo em chip abre sheet; formatar, fixar e salvar a nota', async ({ page, request }) => {
    await gotoApp(page, '/registros');
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await ov.getByRole('textbox', { name: 'Título', exact: true }).fill('E2E nota editor');
    await ov.locator('.nota-m-grupo').click();
    const picker = page.locator('.reg-sheet');
    await expect(picker.getByRole('option', { name: 'Sem Grupo' })).toBeVisible();
    await picker.getByRole('option', { name: 'Estudos' }).click();
    await expect(picker).toHaveCount(0);
    await expect(ov.locator('.nota-m-grupo')).toContainText('Estudos');
    const ta = ov.locator('.md-textarea');
    await ta.fill('texto');
    await ta.evaluate((e) => e.setSelectionRange(5, 5));
    await ov.getByRole('button', { name: 'Negrito' }).click();
    await expect(ta).toHaveValue('texto****');
    await ov.getByRole('button', { name: 'Fixar no topo' }).click();
    await expect(ov.getByRole('button', { name: 'Fixar no topo' })).toHaveAttribute('aria-pressed', 'true');
    await ov.getByRole('button', { name: 'Pré-visualizar' }).click();
    await expect(ov.locator('.md-preview-inner')).toBeVisible();
    await expect(ov.locator('.md-toolbar')).toHaveCount(0);
    await ov.getByRole('button', { name: 'Pré-visualizar' }).click();
    await ov.locator('.nota-m-topbar').getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(ov).toHaveCount(0);
    const nota = await notaPorTitulo(request, 'E2E nota editor');
    expect(nota).toMatchObject({ conteudo: 'texto****', fixado: true, grupo: { nome: 'Estudos' } });
  });

  test('✕ do editor: fecha direto sem mudanças; com mudanças pergunta antes de descartar', async ({ page, request }) => {
    await gotoApp(page, '/registros');
    const ov = page.locator('.modal-overlay.is-sheet-full');
    const fechar = () => ov.locator('.nota-m-topbar').getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.locator('.app-fab').click();
    await expect(ov).toBeVisible();
    await fechar();
    await expect(ov).toHaveCount(0);
    await expect(page.locator('.confirm-modal')).toHaveCount(0);

    await page.locator('.app-fab').click();
    await ov.getByRole('textbox', { name: 'Título', exact: true }).fill('E2E descartar');
    await fechar();
    const dlg = page.locator('.confirm-modal');
    await expect(dlg).toContainText('Descartar alterações?');
    await dlg.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dlg).toHaveCount(0);
    await expect(ov.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue('E2E descartar');
    await fechar();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Descartar' }).click();
    await expect(ov).toHaveCount(0);
    expect(await notaPorTitulo(request, 'E2E descartar')).toBeNull();
  });

  test('ver nota: tela cheia; ⋯ com copiar/PDF e cópia confirmada por toast', async ({ page, context, request }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await criarNota(request, { titulo: 'E2E ver nota', conteudo: '# Olá\n\ntexto da nota', fixado: true });
    await gotoApp(page, '/registros');
    await page.locator('.accordion-wrapper.open .anotacao-card', { hasText: 'E2E ver nota' }).first().click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await expect(ov.locator('.view-modal')).toBeVisible();
    await expect(ov.getByRole('button', { name: 'Fechar' }).first()).toBeVisible();
    expect(await smallTargets(page, '.modal-overlay.is-sheet-full')).toEqual([]);
    await ov.getByRole('button', { name: 'Mais ações' }).click();
    const acoes = page.locator('.action-sheet');
    await expect(acoes.locator('.action-sheet-item')).toHaveText(['Copiar Markdown', 'Copiar texto', 'Baixar PDF', 'Cancelar']);
    await acoes.getByRole('button', { name: 'Copiar texto' }).click();
    await expect(page.locator('.toast-container')).toContainText('Copiado');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Olá');
    await ov.locator('.modal-footer').getByRole('button', { name: /Editar Nota/ }).click();
    await expect(page.locator('.nota-editor')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Task 4 — Tarefas
// ---------------------------------------------------------------------------
const NOMES_COLUNAS = ['A Fazer', 'Em Andamento', 'Bloqueado', 'Concluído', 'Cancelado'];
const CHAVES_COLUNAS = ['a_fazer', 'em_andamento', 'bloqueado', 'concluido', 'cancelado'];
const rotuloChip = (nome, n) => `${nome}, ${n} ${n === 1 ? 'tarefa' : 'tarefas'}`;

async function abrirTarefas(page) {
  await gotoApp(page, '/registros');
  await abrirAba(page, 'Tarefas');
  await page.locator('.kb-board').waitFor();
}

async function irParaColuna(page, idx) {
  await page.locator('.kb-m-chip').nth(idx).click();
  await expect(page.locator('.kb-m-chip').nth(idx)).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.locator('.kb-board').evaluate((e) => Math.round(e.scrollLeft / e.clientWidth))).toBe(idx);
}

test.describe('Tarefas', () => {
  test('chips com contagem por status; uma coluna por vez; chip ↔ swipe', async ({ page, request }) => {
    const board = await apiJson(request, 'GET', '/registros/tarefas/board');
    await abrirTarefas(page);
    await expect(page.locator('.kb-toolbar')).toHaveCount(0);
    const chips = page.locator('.kb-m-chip');
    await expect(chips).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) await expect(chips.nth(i)).toHaveAttribute('aria-label', rotuloChip(NOMES_COLUNAS[i], board[CHAVES_COLUNAS[i]].length));
    await expect(chips.first()).toHaveAttribute('aria-selected', 'true');
    const b = await page.locator('.kb-board').boundingBox();
    const c = await page.locator('.kb-column').first().boundingBox();
    expect(Math.round(c.width)).toBe(Math.round(b.width));
    await irParaColuna(page, 3);
    await page.locator('.kb-board').evaluate((e) => e.scrollTo({ left: e.clientWidth, behavior: 'instant' }));
    await expect(chips.nth(1)).toHaveAttribute('aria-selected', 'true');
  });

  test('o quadro cabe na tela: cada coluna rola por dentro e a página não rola', async ({ page }) => {
    await abrirTarefas(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(4);
    const corpo = page.locator('.kb-column').first().locator('.kb-column-body');
    expect(await corpo.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
    const quadro = await page.locator('.kb-board').boundingBox();
    expect(quadro.y + quadro.height).toBeLessThanOrEqual(844 - 64);
  });

  test('quick-add no topo da coluna cria a tarefa no status da coluna', async ({ page, request }) => {
    await abrirTarefas(page);
    const aFazer = page.locator('.kb-column').first();
    const add = await aFazer.getByRole('button', { name: 'Nova tarefa' }).boundingBox();
    const card = await aFazer.locator('.kb-card').first().boundingBox();
    expect(add.y).toBeLessThan(card.y);
    await irParaColuna(page, 1);
    const col = page.locator('.kb-column').nth(1);
    await col.getByRole('button', { name: 'Nova tarefa' }).click();
    const campo = col.getByRole('textbox', { name: 'Nova tarefa em Em Andamento' });
    await campo.fill('E2E quick-add');
    await campo.press('Enter');
    await expect(col.locator('.kb-card', { hasText: 'E2E quick-add' })).toBeVisible();
    expect((await tarefaPorTitulo(request, 'E2E quick-add')).status).toBe('Em andamento');
  });

  test('card do board: ⋯ abre Abrir / Mover para… / Excluir; mover e excluir', async ({ page, request }) => {
    await criarTarefa(request, { titulo: 'E2E menu card', status: 'Em andamento' });
    await abrirTarefas(page);
    await irParaColuna(page, 1);
    const card = page.locator('.kb-card', { hasText: 'E2E menu card' });
    const mais = card.getByRole('button', { name: 'Ações de E2E menu card' });
    const b = await mais.boundingBox();
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    await mais.click();
    await expect(page.locator('.modal-overlay:not(.app-sheet-overlay)')).toHaveCount(0); // não abriu o detalhe
    const acoes = page.locator('.action-sheet');
    await expect(acoes.locator('.action-sheet-item')).toHaveText(['Abrir', 'Mover para…', 'Excluir', 'Cancelar']);
    await acoes.getByRole('button', { name: 'Mover para…' }).click();
    const mover = page.locator('.reg-sheet');
    await expect(mover.locator('.reg-opcao')).toHaveText(['A Fazer', 'Bloqueado', 'Concluído', 'Cancelado']);
    await mover.getByRole('button', { name: 'Bloqueado' }).click();
    // Persistido pelo mesmo caminho do arraste (PATCH /tarefas/reordenar): o status gravado é o do destino.
    await expect.poll(async () => (await tarefaPorTitulo(request, 'E2E menu card'))?.status).toBe('Bloqueado');
    await expect(page.locator('.kb-m-chip').nth(2)).toHaveAttribute('aria-label', rotuloChip('Bloqueado', 1));
    await irParaColuna(page, 2);
    await page.locator('.kb-card', { hasText: 'E2E menu card' }).getByRole('button', { name: /^Ações de/ }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir' }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Excluir' }).click();
    await expect.poll(() => tarefaPorTitulo(request, 'E2E menu card')).toBeNull();
  });

  test('filtros em sheet: busca e prioridade com contador', async ({ page, request }) => {
    await criarTarefa(request, { titulo: 'E2E filtro crítico', prioridade: 'Crítica' });
    await abrirTarefas(page);
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    const sheet = page.locator('.reg-sheet');
    await sheet.getByRole('searchbox', { name: 'Buscar' }).fill('E2E filtro');
    await expect(page.locator('.kb-column').first().locator('.kb-card:visible')).toHaveCount(1);
    await sheet.getByRole('button', { name: 'Crítica' }).click();
    await expect(sheet.getByRole('button', { name: 'Crítica' })).toHaveAttribute('aria-pressed', 'true');
    await sheet.getByRole('button', { name: 'Ver tarefas' }).click();
    await expect(page.getByRole('button', { name: 'Filtros (2 ativos)' })).toBeVisible();
    await expect(page.locator('.kb-m-chip').first()).toHaveAttribute('aria-label', rotuloChip('A Fazer', 1));
    await page.getByRole('button', { name: 'Filtros (2 ativos)' }).click();
    await page.locator('.reg-sheet').getByRole('button', { name: 'Limpar' }).click();
    await page.locator('.reg-sheet').getByRole('button', { name: 'Ver tarefas' }).click();
    await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible();
  });

  test('arrastar só com toque longo: gesto rápido não arrasta; 350ms parado arrasta', async ({ page, request }) => {
    await criarTarefa(request, { titulo: 'E2E toque longo', status: 'Cancelado' }); // coluna só com ela: soltar não reordena o seed
    await abrirTarefas(page);
    await irParaColuna(page, 4);
    const card = page.locator('.kb-card', { hasText: 'E2E toque longo' });
    const b = await card.boundingBox();
    const x = b.x + b.width / 3;
    const y = b.y + b.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const toque = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] });
    await toque('touchStart', x, y);
    await toque('touchMove', x, y + 30);
    await toque('touchEnd');
    await expect(page.locator('.kb-card--overlay')).toHaveCount(0);
    await toque('touchStart', x, y);
    // Parado, o toque longo ativa sozinho (sem esperar um tempo fixo, que falhava sob carga).
    await expect(page.locator('.kb-card--overlay')).toHaveCount(1);
    await toque('touchMove', x, y + 10);
    await toque('touchMove', x, y + 20);
    await expect(page.locator('.kb-card--overlay')).toHaveCount(1);
    await toque('touchEnd');
    await expect(page.locator('.kb-card--overlay')).toHaveCount(0);
    expect(await card.evaluate((e) => getComputedStyle(e).touchAction)).toBe('manipulation');
  });

  test('quadro desatualizado não reverte o status mudado em outro aparelho', async ({ page, request }) => {
    try {
      const x = await criarTarefa(request, { titulo: 'E2E outro aparelho', status: 'Pendente' });
      await criarTarefa(request, { titulo: 'E2E vem pra fila', status: 'Em andamento' });
      await abrirTarefas(page);
      await expect(page.locator('.kb-column').first().locator('.kb-card', { hasText: 'E2E outro aparelho' })).toHaveCount(1);
      // Outro aparelho conclui X; esta página não recarrega.
      await apiJson(request, 'PATCH', `/registros/tarefas/${x.id}/status`, { status: 'Concluído' });
      await irParaColuna(page, 1);
      await page.locator('.kb-card', { hasText: 'E2E vem pra fila' }).getByRole('button', { name: /^Ações de/ }).click();
      await page.locator('.action-sheet').getByRole('button', { name: 'Mover para…' }).click();
      await page.locator('.reg-sheet').getByRole('button', { name: 'A Fazer' }).click();
      await expect.poll(async () => (await tarefaPorTitulo(request, 'E2E vem pra fila'))?.status).toBe('Pendente');
      expect((await tarefaPorTitulo(request, 'E2E outro aparelho')).status).toBe('Concluído');
      await expect(page.locator('.kb-column').nth(3).locator('.kb-card', { hasText: 'E2E outro aparelho' })).toHaveCount(1);
    } finally {
      await limparRegistrosE2E(request);
    }
  });

  test('voltar para a página recarrega o quadro (mudança feita em outro aparelho aparece)', async ({ page, request }) => {
    try {
      const t = await criarTarefa(request, { titulo: 'E2E volta visível', status: 'Pendente' });
      await abrirTarefas(page);
      await expect(page.locator('.kb-column').first().locator('.kb-card', { hasText: 'E2E volta visível' })).toHaveCount(1);
      await apiJson(request, 'PATCH', `/registros/tarefas/${t.id}/status`, { status: 'Bloqueado' });
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await expect(page.locator('.kb-column').nth(2).locator('.kb-card', { hasText: 'E2E volta visível' })).toHaveCount(1);
      await expect(page.locator('.kb-column').first().locator('.kb-card', { hasText: 'E2E volta visível' })).toHaveCount(0);
    } finally {
      await limparRegistrosE2E(request);
    }
  });

  test('"Mover para…" Concluído coloca o card no topo da coluna', async ({ page, request }) => {
    try {
      await criarTarefa(request, { titulo: 'E2E vai concluir', status: 'Pendente' });
      await abrirTarefas(page);
      await page.locator('.kb-card', { hasText: 'E2E vai concluir' }).getByRole('button', { name: /^Ações de/ }).click();
      await page.locator('.action-sheet').getByRole('button', { name: 'Mover para…' }).click();
      await page.locator('.reg-sheet').getByRole('button', { name: 'Concluído' }).click();
      await expect(page.locator('.kb-column').nth(3).locator('.kb-card').first()).toContainText('E2E vai concluir');
      await expect.poll(async () => (await tarefaPorTitulo(request, 'E2E vai concluir'))?.status).toBe('Concluído');
    } finally {
      await limparRegistrosE2E(request);
    }
  });

  test('toque longo reordena dentro da coluna e grava a ordem; não troca de coluna', async ({ page, request }) => {
    try {
      await criarTarefa(request, { titulo: 'E2E ordem A', status: 'Bloqueado' });
      await criarTarefa(request, { titulo: 'E2E ordem B', status: 'Bloqueado' });
      const ordemApi = async () => (await apiJson(request, 'GET', '/registros/tarefas/board')).bloqueado.map((t) => `${t.titulo}|${t.status}`);
      expect(await ordemApi()).toEqual(['E2E ordem A|Bloqueado', 'E2E ordem B|Bloqueado']);
      await abrirTarefas(page);
      await irParaColuna(page, 2);
      const col = page.locator('.kb-column').nth(2);
      await expect(col.locator('.kb-card')).toHaveText([/E2E ordem A/, /E2E ordem B/]);
      const cdp = await page.context().newCDPSession(page);
      const toque = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] });
      // O toque longo (250ms parado) ativa o arraste: espera o card "levantado" aparecer antes de mover.
      // Um tempo fixo falhava sob carga: o timer do sensor atrasava, o primeiro movimento passava da
      // tolerância e o gesto virava rolagem nativa (o quadro ia para outra coluna).
      const arrasteAtivo = () => expect(page.locator('.kb-card--overlay')).toHaveCount(1);

      // Arrastar A para baixo de B (mesma coluna).
      const a = await col.locator('.kb-card', { hasText: 'E2E ordem A' }).boundingBox();
      const b = await col.locator('.kb-card', { hasText: 'E2E ordem B' }).boundingBox();
      const x = a.x + a.width / 3;
      await toque('touchStart', x, a.y + a.height / 2);
      await arrasteAtivo();
      for (let i = 1; i <= 10; i += 1) {
        await toque('touchMove', x, a.y + a.height / 2 + ((b.y + b.height * 0.75) - (a.y + a.height / 2)) * (i / 10));
      }
      await toque('touchEnd');
      await expect.poll(ordemApi).toEqual(['E2E ordem B|Bloqueado', 'E2E ordem A|Bloqueado']);

      // Arrastar até a borda direita e segurar: o quadro não rola para outra coluna e nada muda de status.
      const a2 = await col.locator('.kb-card', { hasText: 'E2E ordem A' }).boundingBox();
      await toque('touchStart', a2.x + a2.width / 3, a2.y + a2.height / 2);
      await arrasteAtivo();
      for (let i = 1; i <= 10; i += 1) await toque('touchMove', a2.x + a2.width / 3 + ((385 - a2.x - a2.width / 3) * i) / 10, a2.y + a2.height / 2);
      for (let i = 0; i < 15; i += 1) { await toque('touchMove', 385 + (i % 2), a2.y + a2.height / 2); await page.waitForTimeout(60); }
      await toque('touchEnd');
      await page.waitForTimeout(300);
      expect(await page.locator('.kb-board').evaluate((e) => Math.round(e.scrollLeft / e.clientWidth))).toBe(2);
      expect(await ordemApi()).toEqual(['E2E ordem B|Bloqueado', 'E2E ordem A|Bloqueado']);
    } finally {
      await limparRegistrosE2E(request);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 5 — detalhe da tarefa
// ---------------------------------------------------------------------------
test.describe('detalhe da tarefa', () => {
  test('tela cheia sem foco automático; status e prioridade em chips; Excluir no ⋯', async ({ page, request }) => {
    await criarTarefa(request, { titulo: 'E2E detalhe', status: 'Em andamento', prioridade: 'Alta' });
    await abrirTarefas(page);
    await irParaColuna(page, 1);
    await page.locator('.kb-card', { hasText: 'E2E detalhe' }).click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await expect(ov.getByRole('heading', { name: 'Editar Tarefa' })).toBeVisible();
    expect(await focoEmCampo(page)).toBe(false);
    await expect(ov.getByRole('radio', { name: 'Em Andamento' })).toHaveAttribute('aria-checked', 'true');
    await expect(ov.getByRole('radio', { name: 'Alta' })).toHaveAttribute('aria-checked', 'true');
    await expect(ov.locator('.modal-footer').getByRole('button', { name: /Excluir/ })).toHaveCount(0);
    expect(await smallTargets(page, '.modal-overlay.is-sheet-full')).toEqual([]);
    await ov.getByRole('radio', { name: 'Bloqueado' }).click();
    await ov.getByRole('radio', { name: 'Crítica' }).click();
    await ov.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect.poll(async () => { const t = await tarefaPorTitulo(request, 'E2E detalhe'); return t && `${t.status}|${t.prioridade}`; }).toBe('Bloqueado|Crítica');

    await irParaColuna(page, 2);
    await page.locator('.kb-card', { hasText: 'E2E detalhe' }).click();
    await page.locator('.modal-overlay.is-sheet-full').getByRole('button', { name: 'Mais ações' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir tarefa' }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Excluir' }).click();
    await expect.poll(() => tarefaPorTitulo(request, 'E2E detalhe')).toBeNull();
  });

  test('subtarefas: linhas de 44px e recuo de 12px por nível', async ({ page }) => {
    await abrirTarefas(page);
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await expect(ov.getByRole('heading', { name: 'Nova Tarefa' })).toBeVisible();
    await expect(ov.getByRole('button', { name: 'Mais ações' })).toHaveCount(0);
    const raiz = ov.getByPlaceholder('Adicionar etapa principal...');
    await raiz.fill('Etapa 1');
    await raiz.press('Enter');
    await ov.getByRole('button', { name: 'Sub-etapa' }).click();
    const filha = ov.getByPlaceholder('Nome da sub-etapa...');
    await filha.fill('Etapa 1.1');
    await filha.press('Enter');
    const linhas = ov.locator('.kb-tree-row');
    await expect(linhas).toHaveCount(2);
    for (const l of await linhas.all()) expect((await l.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const pai = await linhas.nth(0).boundingBox();
    const sub = await linhas.nth(1).boundingBox();
    expect(sub.x - pai.x).toBeGreaterThan(0);
    expect(sub.x - pai.x).toBeLessThanOrEqual(12.5);
    expect(await smallTargets(page, '.modal-overlay.is-sheet-full')).toEqual([]);
    await ov.getByRole('button', { name: 'Cancelar' }).click();
    await expect(ov).toHaveCount(0);
  });

  test('detalhe com teclado (--vvh 420): Criar visível', async ({ page }) => {
    await abrirTarefas(page);
    await teclado(page);
    await page.locator('.app-fab').click();
    const criar = page.locator('.modal-overlay.is-sheet-full').getByRole('button', { name: 'Criar', exact: true });
    await expect.poll(async () => { const b = await criar.boundingBox(); return b && Math.round(b.y + b.height); }).toBeLessThanOrEqual(420);
  });
});

// ---------------------------------------------------------------------------
// Task 6 — Jornada
// ---------------------------------------------------------------------------
async function abrirJornada(page) {
  await gotoApp(page, '/registros');
  await abrirAba(page, 'Jornada');
  await page.locator('.jk-kanban').waitFor();
}

test.describe('Jornada', () => {
  test('linha "data · X de Y hábitos" com barra de progresso bate com a API', async ({ page, request }) => {
    const habitos = await apiJson(request, 'GET', '/registros/habitos');
    const hoje = habitos.filter((h) => h.status === 'ativo' && h.frequencia.includes('sex'));
    const feitos = hoje.filter((h) => h.registro_hoje?.concluido).length;
    await abrirJornada(page);
    await expect(page.locator('.reg-m-jornada-linha')).toHaveText(`Sexta-feira, 2 de out · ${feitos} de ${hoje.length} ${hoje.length === 1 ? 'hábito' : 'hábitos'}`);
    const barra = page.getByRole('progressbar', { name: 'Hábitos de hoje' });
    await expect(barra).toHaveAttribute('aria-valuenow', String(feitos));
    await expect(barra).toHaveAttribute('aria-valuemax', String(hoje.length));
  });

  test('sem hábitos para hoje: "Nenhum hábito hoje" e sem barra de progresso', async ({ page, request }) => {
    await criarHabito(request, { titulo: 'E2E fora de hoje', frequencia: ['seg'] });
    // Todos os hábitos passam a cair só em segunda (hoje é sexta no relógio fixo).
    await page.route(/\/api\/v1\/registros\/$/, async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.habitos = (json.habitos || []).map((h) => ({ ...h, frequencia: ['seg'] }));
      await route.fulfill({ response: res, json });
    });
    await abrirJornada(page);
    await expect(page.locator('.reg-m-jornada-linha')).toHaveText('Sexta-feira, 2 de out · Nenhum hábito hoje');
    await expect(page.getByRole('progressbar', { name: 'Hábitos de hoje' })).toHaveCount(0);
  });

  test('check-in: círculo ≥ 44px alterna o registro do dia', async ({ page, request }) => {
    await criarHabito(request, { titulo: 'E2E check-in', horario: '10:00' });
    await abrirJornada(page);
    const circulo = page.locator('.jk-habit-row', { hasText: 'E2E check-in' }).locator('.jk-circle');
    const b = await circulo.boundingBox();
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    const checkin = (r) => r.url().includes('/checkin') && r.request().method() === 'PATCH';
    const [r1] = await Promise.all([page.waitForResponse(checkin), circulo.click()]);
    const v1 = (await r1.json()).concluido;
    const [r2] = await Promise.all([page.waitForResponse(checkin), circulo.click()]);
    expect((await r2.json()).concluido).toBe(!v1);
  });

  test('hábito: ⋯ visível com Editar / Pausar / Excluir', async ({ page, request }) => {
    await criarHabito(request, { titulo: 'E2E hábito menu', horario: '09:00' });
    await abrirJornada(page);
    const linha = page.locator('.jk-habit-row', { hasText: 'E2E hábito menu' });
    await expect(linha.locator('.jk-habit-actions')).toHaveCount(0);
    await linha.getByRole('button', { name: 'Ações de E2E hábito menu' }).click();
    const acoes = page.locator('.action-sheet');
    await expect(acoes.locator('.action-sheet-item')).toHaveText(['Editar', 'Pausar', 'Excluir', 'Cancelar']);
    await expect(acoes).toContainText(/09:00 · \d+min/);
    await acoes.getByRole('button', { name: 'Pausar' }).click();
    await expect(linha.locator('.jk-badge-pausado')).toBeVisible();
    await linha.getByRole('button', { name: /^Ações de/ }).click();
    await expect(page.locator('.action-sheet').getByRole('button', { name: 'Retomar' })).toBeVisible();
    await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('.modal-overlay.is-sheet').getByRole('heading', { name: 'Editar Hábito' })).toBeVisible();
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Cancelar' }).click();
    await linha.getByRole('button', { name: /^Ações de/ }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir' }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Sim, excluir' }).click();
    await expect.poll(() => habitoPorTitulo(request, 'E2E hábito menu')).toBeNull();
  });

  test('"Lista" vai para a topbar só na Jornada e abre a lista em sheet', async ({ page }) => {
    await gotoApp(page, '/registros');
    const slot = page.locator('.m-topbar-slot');
    await expect(slot.getByRole('button', { name: 'Lista de hábitos' })).toHaveCount(0);
    await abrirAba(page, 'Jornada');
    await slot.getByRole('button', { name: 'Lista de hábitos' }).click();
    const ov = page.locator('.modal-overlay.is-sheet');
    await expect(ov.getByRole('heading', { name: 'Todos os Hábitos' })).toBeVisible();
    await expect(ov.getByRole('button', { name: 'Fechar' })).toBeInViewport();
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    await ov.getByRole('button', { name: 'Fechar' }).click();
    await abrirAba(page, 'Caderno');
    await expect(slot.getByRole('button', { name: 'Lista de hábitos' })).toHaveCount(0);
  });

  test('Novo hábito: sheet rola, rodapé fixo e Criar alcançável com teclado', async ({ page }) => {
    await abrirJornada(page);
    await teclado(page);
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet');
    const criar = ov.getByRole('button', { name: 'Criar Hábito' });
    await expect.poll(async () => { const b = await criar.boundingBox(); return b && Math.round(b.y + b.height); }).toBeLessThanOrEqual(420);
    expect(await focoEmCampo(page)).toBe(false);
    const corpo = ov.locator('.modal-body');
    expect(await corpo.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
    await corpo.evaluate((e) => e.scrollTo(0, e.scrollHeight));
    await expect(ov.locator('.habito-cores-wrapper')).toBeInViewport();
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
  });

  test('criar hábito pelo form do celular (Dias úteis)', async ({ page, request }) => {
    await abrirJornada(page);
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet');
    await ov.getByPlaceholder('Ex: Meditação matinal').fill('E2E hábito celular');
    await ov.getByRole('button', { name: 'Dias úteis' }).click();
    await ov.getByRole('button', { name: 'Criar Hábito' }).click();
    await expect.poll(async () => (await habitoPorTitulo(request, 'E2E hábito celular'))?.frequencia.join(',')).toBe('seg,ter,qua,qui,sex');
    await expect(page.locator('.jk-habit-row', { hasText: 'E2E hábito celular' })).toBeVisible();
  });

  test('Jornada: conteúdo ≥ 14px, secundário ≥ 12px, badges ≥ 11px', async ({ page }) => {
    await abrirJornada(page);
    const t = await page.evaluate(() => {
      const fs = (sel) => [...document.querySelectorAll(sel)].map((e) => parseFloat(getComputedStyle(e).fontSize));
      return { principal: [...fs('.jk-titulo'), ...fs('.reg-m-jornada-linha')], secundario: [...fs('.jk-meta'), ...fs('.jk-time')], badges: [...fs('.jk-streak'), ...fs('.jk-badge-atrasado'), ...fs('.jk-col-label')] };
    });
    expect(Math.min(...t.principal)).toBeGreaterThanOrEqual(14);
    expect(Math.min(...t.secundario)).toBeGreaterThanOrEqual(12);
    expect(Math.min(...t.badges)).toBeGreaterThanOrEqual(11);
  });
});

// ---------------------------------------------------------------------------
// Task 7 — capturas para a conferência visual (só com REG_SHOTS=1)
// ---------------------------------------------------------------------------
test.describe('capturas para conferência visual', () => {
  test.skip(!process.env.REG_SHOTS, 'rode com REG_SHOTS=1');
  for (const w of [360, 390, 430]) {
    test(`capturas ${w}px`, async ({ page }) => {
      const dir = 'test-results/registros-visual';
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/registros');
      await page.screenshot({ path: `${dir}/caderno-${w}.png`, fullPage: true });
      await page.locator('.reg-m-chips').getByRole('button', { name: 'Grupos', exact: true }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/grupos-${w}.png` });
      await page.keyboard.press('Escape');
      await page.locator('.app-fab').click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/editor-${w}.png` });
      // teclado simulado: a viewport visual encolhe e o inset sobe
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--vvh', '480px');
        document.documentElement.style.setProperty('--kb-inset', '364px');
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${dir}/editor-teclado-${w}.png` });
      await page.evaluate(() => {
        document.documentElement.style.removeProperty('--vvh');
        document.documentElement.style.removeProperty('--kb-inset');
      });
      await page.keyboard.press('Escape');
      await abrirAba(page, 'Tarefas');
      await page.locator('.kb-board').waitFor();
      await page.screenshot({ path: `${dir}/tarefas-${w}.png` });
      await page.locator('.kb-card').first().click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/tarefa-detalhe-${w}.png` });
      await page.keyboard.press('Escape');
      await abrirAba(page, 'Jornada');
      await page.locator('.jk-kanban').waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${dir}/jornada-${w}.png`, fullPage: true });
      await page.locator('.app-fab').click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/habito-${w}.png` });
    });
  }
});
