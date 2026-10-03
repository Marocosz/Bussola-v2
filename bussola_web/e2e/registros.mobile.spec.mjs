import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';
import { comApi, limparRegistrosE2E, criarNota, grupoPorNome, notaPorTitulo } from './registros-data.mjs';

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
const ABAS_VERIFICADAS = ['Caderno'];

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
