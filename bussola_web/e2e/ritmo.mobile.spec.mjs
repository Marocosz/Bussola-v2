import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, apiJson, smallTargets, animacoesAcabaram, textoX } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Infra do arquivo
// ---------------------------------------------------------------------------
// Busca de alimentos fixa: a tabela TACO local pode não existir no banco demo.
const FOODS = [
  { nome: 'Arroz, tipo 1, cozido', calorias_100g: 128, proteina_100g: 2.5, carbo_100g: 28.1, gordura_100g: 0.2 },
  { nome: 'Arroz, integral, cozido', calorias_100g: 124, proteina_100g: 2.6, carbo_100g: 25.8, gordura_100g: 1 },
];

const abrirAba = (page, nome) => page.getByRole('tab', { name: nome, exact: true }).click();

// Teclado virtual de 424px: a área visível fica com 420px e o layout segue com 844.
const teclado = (page) => page.evaluate(() => {
  document.documentElement.style.setProperty('--vvh', '420px');
  document.documentElement.style.setProperty('--kb-inset', '424px');
});

// Remove planos/dietas "E2E " e devolve o original como ativo (criar com ativo=true desativa o
// "Hipertrofia ABC 2025"/"Bulking Limpo"; sem isso a base visual do desktop quebra).
async function limparE2E(request) {
  for (const base of ['/ritmo/treinos', '/ritmo/nutricao']) {
    const itens = await apiJson(request, 'GET', base);
    const e2e = (x) => String(x.nome).startsWith('E2E ');
    const ativo = itens.find((x) => x.ativo);
    if (!ativo || e2e(ativo)) {
      const alvo = itens.find((x) => !e2e(x));
      if (alvo) await apiJson(request, 'PATCH', `${base}/${alvo.id}/ativar`);
    }
    for (const x of itens.filter(e2e)) await apiJson(request, 'DELETE', `${base}/${x.id}`);
  }
}

// Elementos de `sel` (ele e descendentes) que passam das bordas da viewport.
async function vazamentos(page, sel) {
  return page.evaluate((s) => {
    const vw = window.innerWidth;
    const out = [];
    for (const el of document.querySelectorAll(`${s}, ${s} *`)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right > vw + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    }
    return out;
  }, sel);
}

// Elementos que cortam o próprio texto (scrollWidth > clientWidth).
async function cortados(page, sel) {
  return page.locator(sel).evaluateAll((els) => els
    .filter((e) => e.getBoundingClientRect().width && e.scrollWidth > e.clientWidth + 1)
    .map((e) => `${e.className} "${e.textContent.trim().slice(0, 24)}" ${e.scrollWidth}>${e.clientWidth}`));
}

// Textos visíveis abaixo do mínimo: 12px (11px só em caixa alta).
async function textosPequenos(page, sel) {
  return page.evaluate((s) => {
    const out = [];
    for (const root of document.querySelectorAll(s)) {
      for (const el of root.querySelectorAll('*')) {
        const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!temTexto) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const fs = parseFloat(cs.fontSize);
        const min = cs.textTransform === 'uppercase' ? 11 : 12;
        if (fs < min - 0.01) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 20)}" ${fs}px`);
      }
    }
    return out;
  }, sel);
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
// Task 1 — infraestrutura
// ---------------------------------------------------------------------------
test('infra: limparE2E remove planos/dietas E2E e devolve os originais como ativos', async ({ request }) => {
  await apiJson(request, 'POST', '/ritmo/treinos', { nome: 'E2E Infra', ativo: true, dias: [] });
  await apiJson(request, 'POST', '/ritmo/nutricao', { nome: 'E2E Infra', ativo: true, refeicoes: [] });
  expect((await apiJson(request, 'GET', '/ritmo/treinos/ativo')).nome).toBe('E2E Infra');
  await limparE2E(request);
  expect((await apiJson(request, 'GET', '/ritmo/treinos/ativo')).nome).toBe('Hipertrofia ABC 2025');
  expect((await apiJson(request, 'GET', '/ritmo/nutricao/ativo')).nome).toBe('Bulking Limpo');
  const todos = [...await apiJson(request, 'GET', '/ritmo/treinos'), ...await apiJson(request, 'GET', '/ritmo/nutricao')];
  expect(todos.filter((x) => x.nome.startsWith('E2E '))).toEqual([]);
});

// ---------------------------------------------------------------------------
// Task 2 — visão bio
// ---------------------------------------------------------------------------
test.describe('visão bio', () => {
  test('topbar "Ritmo" e sem page-header no celular', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await expect(page.locator('.m-topbar-title')).toHaveText('Ritmo');
    await expect(page.locator('.ritmo-scope .page-header')).toHaveCount(0);
  });

  test('dados de bio em grade 2×4: 7 chips com os ícones atuais + Ajustar Perfil, sem cortar texto em 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const strip = page.locator('.bio-stat-strip');
    expect(await strip.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
    const icones = await strip.locator('.bio-stat-chip > i').evaluateAll((els) => els.map((e) => [...e.classList].find((c) => c.startsWith('fa-') && c !== 'fa-solid')));
    expect(icones).toEqual(['fa-weight-scale', 'fa-ruler-vertical', 'fa-percent', 'fa-fire-flame-curved', 'fa-brain', 'fa-droplet', 'fa-person-running']);
    const celulas = strip.locator(':scope > *');
    await expect(celulas).toHaveCount(8);
    const caixas = await celulas.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), h: r.height }; }));
    expect(new Set(caixas.map((c) => c.y)).size).toBe(4); // 4 linhas
    expect(caixas[7].x).toBeGreaterThan(caixas[6].x); // Ajustar Perfil na 2ª coluna da última linha
    for (const c of caixas) expect(c.h).toBeGreaterThanOrEqual(44);
    await expect(celulas.nth(7)).toHaveText(/Ajustar Perfil/);
    await expect(celulas.nth(7).locator('i')).toHaveClass(/fa-sliders/);
    expect(await cortados(page, '.chip-label, .chip-value')).toEqual([]);
    for (const fs of await strip.locator('.chip-value').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)))) {
      expect(fs).toBeGreaterThanOrEqual(14);
    }
  });

  test('painéis Volume e Macros empilhados em largura total', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const strip = await page.locator('.bio-stat-strip').boundingBox();
    const [vol, mac] = await page.locator('.bio-panel').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { y: r.y, h: r.height, w: r.width }; }));
    expect(mac.y).toBeGreaterThanOrEqual(vol.y + vol.h + 15); // 16px entre os painéis
    for (const p of [vol, mac]) expect(Math.abs(p.w - strip.width)).toBeLessThan(2);
    expect(Math.round(strip.width)).toBe(360 - 32); // gutter de 16px
  });

  test('volume: rótulo de 76px; muitos sets viram uma barra contínua; poucos seguem em blocos', async ({ page }) => {
    await page.route('**/ritmo/bio/latest', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.volume_semanal = { ...json.volume_semanal, Peito: 40 };
      await route.fulfill({ response: res, json });
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const linhas = page.locator('.vol-bar-row');
    const peito = linhas.filter({ hasText: 'Peito' });
    expect(await peito.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ')[0])).toBe('76px');
    await expect(peito.locator('.vol-blocks-track')).toHaveClass(/is-continuous/);
    await expect(peito.locator('.vol-block')).toHaveCount(1);
    const costas = linhas.filter({ hasText: 'Costas' });
    await expect(costas.locator('.vol-blocks-track')).not.toHaveClass(/is-continuous/);
    await expect(costas.locator('.vol-block')).toHaveCount(7);
    const trilha = await peito.locator('.vol-blocks-track').boundingBox();
    const contador = await peito.locator('.vol-bar-count').boundingBox();
    expect(trilha.width).toBeGreaterThan(100);
    expect(trilha.x + trilha.width).toBeLessThanOrEqual(contador.x);
  });

  for (const w of [360, 390, 430, 768]) {
    test(`visão bio sem vazar da tela em ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/ritmo');
      expect(await vazamentos(page, '.bio-overview-section')).toEqual([]);
    });
  }

  test('visão bio: textos legíveis e "Ajustar Perfil" abre o perfil em sheet', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    expect(await textosPequenos(page, '.bio-overview-section')).toEqual([]);
    await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet.locator('.modal-title')).toHaveText('Perfil Biológico & Metas');
  });
});

// ---------------------------------------------------------------------------
// Task 3 — abas, biblioteca, cards, Fab
// ---------------------------------------------------------------------------
test.describe('abas, biblioteca e cards', () => {
  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px nas duas abas`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/ritmo');
      for (const aba of ['Plano de Treino', 'Plano de Dieta']) {
        await abrirAba(page, aba);
        await expect(page.locator('.refeicao-card-pro').first()).toBeVisible();
        expect(await overflowOffenders(page), `${aba} @ ${w}px`).toEqual([]);
      }
    });
  }

  test('alvos de toque ≥ 44px e textos legíveis nas duas abas', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    for (const aba of ['Plano de Treino', 'Plano de Dieta']) {
      await abrirAba(page, aba);
      await expect(page.locator('.refeicao-card-pro').first()).toBeVisible();
      expect(await smallTargets(page, '.ritmo-scope'), aba).toEqual([]);
      expect(await textosPequenos(page, '.ritmo-scope'), aba).toEqual([]);
    }
  });

  test('abas: as pílulas atuais em largura total, 44px, texto inteiro em 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const abas = page.getByRole('tab');
    await expect(abas).toHaveText(['Plano de Treino', 'Plano de Dieta']);
    await expect(abas.first()).toHaveAttribute('aria-selected', 'true');
    await expect(abas.first()).toHaveClass(/tab-btn-pill/);
    for (const t of await abas.all()) {
      expect((await t.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    expect(await cortados(page, '.tab-btn-pill')).toEqual([]);
    await abrirAba(page, 'Plano de Dieta');
    await expect(abas.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.section-subtitle')).toHaveText('Meus Planos de Dieta');
    await expect(page.locator('.ritmo-scope main')).toHaveCount(0);
    await expect(page.locator('section.ritmo-content-area')).toHaveCount(1);
  });

  test('Fab: "Novo treino" na aba Treino e "Nova dieta" na aba Dieta (um por vez, sem botão no cabeçalho)', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await expect(page.locator('.ritmo-scope .header-actions-group')).toHaveCount(0);
    await expect(page.locator('.app-fab')).toHaveCount(1);
    await page.getByRole('button', { name: 'Novo treino' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet.locator('h2')).toHaveText('Configurar Treino');
    const cancelar = sheet.getByRole('button', { name: 'Cancelar' });
    await expect(cancelar).toBeVisible();
    // animação do sheet concluída: o botão para de se mover
    let ultimo = null;
    await expect.poll(async () => {
      const y = (await cancelar.boundingBox()).y;
      const parado = ultimo !== null && Math.abs(y - ultimo) < 0.5;
      ultimo = y;
      return parado;
    }).toBe(true);
    await cancelar.click();
    await abrirAba(page, 'Plano de Dieta');
    await expect(page.locator('.app-fab')).toHaveCount(1);
    await page.getByRole('button', { name: 'Nova dieta' }).click();
    await expect(sheet.locator('h2')).toHaveText('Configurar Dieta');
  });

  test('biblioteca: faixa com scroll-snap; ativar, excluir e estado vazio pelas ações de 44px', async ({ page, request }) => {
    await apiJson(request, 'POST', '/ritmo/treinos', {
      nome: 'E2E Treino biblioteca',
      ativo: false,
      dias: [{ nome: 'E2E Dia', ordem: 0, exercicios: [{ nome_exercicio: 'E2E Supino', grupo_muscular: 'Peito', series: 3, repeticoes_min: 8, repeticoes_max: 12 }] }],
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const faixa = page.locator('.plans-horizontal-selector');
    expect(await faixa.evaluate((e) => getComputedStyle(e).scrollSnapType)).toContain('x');
    expect(await faixa.locator('.plan-mini-card').first().evaluate((e) => getComputedStyle(e).scrollSnapAlign)).toContain('start');
    await expect(faixa).toHaveAttribute('data-offscreen-ok', /.*/); // React serializa o booleano como "true"
    expect(await smallTargets(page, '.plans-horizontal-selector')).toEqual([]);

    const original = page.locator('.plan-mini-card', { hasText: 'Hipertrofia ABC 2025' });
    const e2e = page.locator('.plan-mini-card', { hasText: 'E2E Treino biblioteca' });
    await e2e.getByRole('button', { name: 'Ativar' }).click();
    await expect(e2e).toHaveClass(/active/);
    await expect(page.locator('.refeicao-card-pro', { hasText: 'E2E Dia' })).toBeVisible();

    await e2e.getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Sim, Excluir' }).click();
    await expect(e2e).toHaveCount(0);

    // Sem plano ativo: estado vazio compacto
    const vazio = page.locator('.empty-state');
    await expect(vazio).toBeVisible();
    expect(await vazio.evaluate((e) => parseFloat(getComputedStyle(e).paddingLeft))).toBeLessThanOrEqual(16);
    // o toast de sucesso ainda desliza para dentro da tela: espera ele caber na viewport (ou sumir)
    await expect(page.locator('.toast-notification').last()).toBeVisible();
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.toast-notification')]
      .every((t) => t.getBoundingClientRect().right <= window.innerWidth + 0.5))).toBe(true);
    expect(await overflowOffenders(page)).toEqual([]);

    await original.getByRole('button', { name: 'Ativar' }).click();
    await expect(original).toHaveClass(/active/);
  });

  test('cards: mesmas tabelas, cabem em 360px e a pílula de macros quebra centralizada', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const treino = page.locator('.refeicao-card-pro').first();
    await expect(treino.locator('thead th')).toHaveText(['Exercício', 'Sets', 'Rep.']);
    const grupoFs = await treino.locator('.alim-grupo').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(grupoFs).toBeGreaterThanOrEqual(12);

    await abrirAba(page, 'Plano de Dieta');
    const refeicao = page.locator('.refeicao-card-pro', { hasText: 'Almoço' });
    await expect(refeicao.locator('thead th')).toHaveText(['Item', 'Qtd', 'P', 'C', 'G', 'Kcal']);
    const sobra = await page.locator('.alimentos-table-wrapper').evaluateAll((els) => els.map((e) => e.scrollWidth - e.clientWidth));
    for (const s of sobra) expect(s).toBeLessThanOrEqual(0);
    expect((await refeicao.locator('td.alim-name-td').first().boundingBox()).width).toBeGreaterThan(90);
    for (const fs of await refeicao.locator('td').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)))) {
      expect(fs).toBeGreaterThanOrEqual(12);
    }

    const pilula = refeicao.locator('.macro-summary-pill');
    expect(await pilula.evaluate((e) => getComputedStyle(e).flexWrap)).toBe('wrap');
    const pb = await pilula.boundingBox();
    const fb = await refeicao.locator('.refeicao-pro-footer').boundingBox();
    expect(Math.abs((pb.x + pb.width / 2) - (fb.x + fb.width / 2))).toBeLessThan(2);
    expect(pb.x + pb.width).toBeLessThanOrEqual(fb.x + fb.width + 0.5);
  });

  test('volume em 360px: linhas de 7 a 12 sets não vazam da trilha e a escala é 14px', async ({ page }) => {
    await page.route('**/ritmo/bio/latest', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.volume_semanal = { ...json.volume_semanal, Peito: 12, Costas: 9 };
      await route.fulfill({ response: res, json });
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const sobras = await page.locator('.vol-blocks-track').evaluateAll((els) => els.map((t) => {
      const filhos = [...t.children].reduce((s, c) => s + c.getBoundingClientRect().width, 0);
      return Math.round(filhos - t.getBoundingClientRect().width);
    }));
    for (const s of sobras) expect(s).toBeLessThanOrEqual(1);
    for (const fs of await page.locator('.vol-bar-label, .vol-bar-count').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)))) {
      expect(fs).toBe(14);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 4 — builder de treino
// ---------------------------------------------------------------------------
test.describe('builder de treino', () => {
  for (const w of [360, 430]) {
    test(`sheet cheio em ${w}px: exercício em bloco empilhado, sem overflow, alvos de 44px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      await gotoApp(page, '/ritmo');
      await page.getByRole('button', { name: 'Novo treino' }).click();
      const sheet = page.locator('.modal-overlay.is-sheet-full');
      await expect(sheet).toBeVisible();
      await sheet.getByRole('button', { name: '+ Add Exercício' }).click();
      const row = sheet.locator('.rb-ex-row').first();
      const r = await row.boundingBox();
      const [nome, grupo, sets, min, max, rm] = await Promise.all(
        ['.rb-f-nome', '.rb-f-grupo', '.rb-f-sets', '.rb-f-min', '.rb-f-max', '.rb-remove'].map((s) => row.locator(s).boundingBox()));
      expect(Math.abs(nome.width - r.width)).toBeLessThan(2);   // nome em largura total
      expect(Math.abs(grupo.width - r.width)).toBeLessThan(2);  // grupo em largura total
      expect(grupo.y).toBeGreaterThanOrEqual(nome.y + nome.height - 1);
      expect(sets.y).toBeGreaterThanOrEqual(grupo.y + grupo.height - 1);
      for (const b of [min, max]) expect(Math.abs(b.y - sets.y)).toBeLessThan(2); // linha numérica
      expect(rm.width).toBeGreaterThanOrEqual(44);
      expect(rm.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs((rm.y + rm.height) - (sets.y + sets.height))).toBeLessThan(2);
      for (const f of ['.rb-f-sets', '.rb-f-min', '.rb-f-max']) {
        await expect(row.locator(`${f} input`)).toHaveAttribute('inputmode', 'numeric');
      }
      expect(await overflowOffenders(page)).toEqual([]);
      expect(await smallTargets(page, '.modal-overlay.is-sheet-full')).toEqual([]);
      expect(await textosPequenos(page, '.modal-overlay.is-sheet-full')).toEqual([]);
    });
  }

  test('builder de treino: Salvar visível com o teclado aberto e corpo rolando', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await teclado(page);
    await page.getByRole('button', { name: 'Novo treino' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet-full');
    for (let i = 0; i < 3; i += 1) await sheet.getByRole('button', { name: '+ Add Exercício' }).click();
    const salvar = sheet.getByRole('button', { name: 'Salvar Plano' });
    await expect(salvar).toBeVisible();
    await expect.poll(async () => { const b = await salvar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
    await sheet.locator('.modal-body').evaluate((b) => b.scrollTo(0, 99999));
    const addDia = await sheet.getByRole('button', { name: 'Adicionar Dia' }).boundingBox();
    expect(addDia.y + addDia.height).toBeLessThanOrEqual((await salvar.boundingBox()).y);
  });

  test('Novo treino pelo Fab: cria com grupo no sheet, ativa e exclui', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoApp(page, '/ritmo');
    await page.getByRole('button', { name: 'Novo treino' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet-full');
    await expect(sheet.locator('h2')).toHaveText('Configurar Treino');
    await sheet.locator('input[placeholder="Ex: Push Pull Legs"]').fill('E2E Treino');
    await sheet.getByRole('button', { name: '+ Add Exercício' }).click();
    const row = sheet.locator('.rb-ex-row').first();
    await row.locator('.rb-f-nome input').fill('E2E Supino');
    await row.locator('.rb-f-grupo .custom-select-trigger').click();
    await page.locator('.cs-sheet-list .custom-option', { hasText: /^Peito$/ }).click();
    await expect(row.locator('.rb-f-grupo .custom-select-trigger')).toContainText('Peito');
    await row.locator('.rb-f-sets input').fill('4');
    await sheet.getByRole('button', { name: 'Salvar Plano' }).click();
    await expect(page.getByText('Plano salvo.')).toBeVisible();

    const card = page.locator('.plan-mini-card', { hasText: 'E2E Treino' });
    await expect(card).toHaveClass(/active/);
    const dia = page.locator('.refeicao-card-pro', { hasText: 'E2E Supino' });
    await expect(dia).toContainText('Peito');
    await expect(dia.locator('.ref-total-badge')).toHaveText('4 séries');

    const original = page.locator('.plan-mini-card', { hasText: 'Hipertrofia ABC 2025' });
    await original.getByRole('button', { name: 'Ativar' }).click();
    await expect(original).toHaveClass(/active/);
    await card.getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Sim, Excluir' }).click();
    await expect(card).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Task 5 — builder de dieta
// ---------------------------------------------------------------------------
test.describe('builder de dieta', () => {
  const abrirNovaDieta = async (page) => {
    await gotoApp(page, '/ritmo');
    await abrirAba(page, 'Plano de Dieta');
    await page.getByRole('button', { name: 'Nova dieta' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet-full');
    await expect(sheet).toBeVisible();
    return sheet;
  };

  for (const w of [360, 430]) {
    test(`sheet cheio em ${w}px: alimento em bloco (nome / Qtd+Un / Kcal P C G), sem overflow, alvos de 44px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      const sheet = await abrirNovaDieta(page);
      await sheet.getByRole('button', { name: '+ Add Alimento' }).click();
      const row = sheet.locator('.rb-food-row').first();
      const r = await row.boundingBox();
      const [nome, qtd, un, kcal, p, c, g, rm] = await Promise.all(
        ['.rb-f-nome', '.rb-f-qtd', '.rb-f-un', '.rb-f-kcal', '.rb-f-p', '.rb-f-c', '.rb-f-g', '.rb-remove'].map((s) => row.locator(s).boundingBox()));
      expect(Math.abs(nome.width - r.width)).toBeLessThan(2);
      expect(qtd.y).toBeGreaterThanOrEqual(nome.y + nome.height - 1);
      expect(Math.abs(un.y - qtd.y)).toBeLessThan(2);
      expect(kcal.y).toBeGreaterThanOrEqual(qtd.y + qtd.height - 1);
      for (const b of [p, c, g]) expect(Math.abs(b.y - kcal.y)).toBeLessThan(2);
      expect(rm.width).toBeGreaterThanOrEqual(44);
      expect(rm.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs((rm.y + rm.height) - (kcal.y + kcal.height))).toBeLessThan(2);
      await expect(row.locator('.rb-f-qtd input')).toHaveAttribute('inputmode', 'decimal');
      for (const f of ['.rb-f-kcal', '.rb-f-p', '.rb-f-c', '.rb-f-g']) {
        await expect(row.locator(`${f} input`)).toHaveAttribute('inputmode', 'numeric');
        expect((await row.locator(`${f} input`).boundingBox()).width).toBeGreaterThanOrEqual(48);
      }
      expect(await overflowOffenders(page)).toEqual([]);
      expect(await smallTargets(page, '.modal-overlay.is-sheet-full')).toEqual([]);
      expect(await textosPequenos(page, '.modal-overlay.is-sheet-full')).toEqual([]);
    });
  }

  test('builder de dieta: Salvar visível com o teclado aberto', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await abrirAba(page, 'Plano de Dieta');
    await teclado(page);
    await page.getByRole('button', { name: 'Nova dieta' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet-full');
    for (let i = 0; i < 3; i += 1) await sheet.getByRole('button', { name: '+ Add Alimento' }).click();
    const salvar = sheet.getByRole('button', { name: 'Salvar Dieta' });
    await expect(salvar).toBeVisible();
    await expect.poll(async () => { const b = await salvar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
  });

  test('Nova dieta pelo Fab: busca abaixo do nome, item travado, macros recalculados, salva e exclui', async ({ page }) => {
    await page.route('**/ritmo/local/foods**', (r) => r.fulfill({ json: FOODS }));
    await page.setViewportSize({ width: 360, height: 780 });
    const sheet = await abrirNovaDieta(page);
    await expect(sheet.locator('h2')).toHaveText('Configurar Dieta');
    await sheet.locator('input[placeholder="Ex: Cutting 2025"]').fill('E2E Dieta');
    await sheet.getByRole('button', { name: '+ Add Alimento' }).click();
    const row = sheet.locator('.rb-food-row').first();
    const nomeInput = row.locator('.rb-f-nome input');
    await nomeInput.fill('arroz');

    const dropdown = row.locator('.search-results-dropdown');
    await expect(dropdown).toContainText('Arroz, tipo 1, cozido');
    const nb = await nomeInput.boundingBox();
    const db = await dropdown.boundingBox();
    expect(Math.abs(db.y - (nb.y + nb.height))).toBeLessThan(2); // logo abaixo do campo de nome
    expect(Math.abs(db.width - nb.width)).toBeLessThan(2);       // na largura dele
    expect(await textosPequenos(page, '.search-results-dropdown')).toEqual([]);

    await dropdown.getByText('Arroz, tipo 1, cozido').click();
    await expect(dropdown).toHaveCount(0);
    await expect(nomeInput).toHaveValue('Arroz, tipo 1, cozido');
    const kcal = row.locator('.rb-f-kcal input');
    await expect(kcal).toHaveValue('128');
    await expect(kcal).toHaveJSProperty('readOnly', true);
    await expect(row.locator('.rb-f-un input')).toHaveValue('g');
    await row.locator('.rb-f-qtd input').fill('150');
    await expect(kcal).toHaveValue('192');
    await expect(row.locator('.rb-f-p input')).toHaveValue('4');
    await expect(row.locator('.rb-f-c input')).toHaveValue('42');
    expect(await overflowOffenders(page)).toEqual([]);

    await sheet.getByRole('button', { name: 'Salvar Dieta' }).click();
    await expect(page.getByText('Plano salvo.')).toBeVisible();
    const card = page.locator('.plan-mini-card', { hasText: 'E2E Dieta' });
    await expect(card).toHaveClass(/active/);
    const refeicao = page.locator('.refeicao-card-pro', { hasText: 'Arroz, tipo 1, cozido' });
    await expect(refeicao.locator('.ref-total-badge')).toHaveText('192 kcal');

    const original = page.locator('.plan-mini-card', { hasText: 'Bulking Limpo' });
    await original.getByRole('button', { name: 'Ativar' }).click();
    await expect(original).toHaveClass(/active/);
    await card.getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Sim, Excluir' }).click();
    await expect(card).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Task 6 — perfil (BioModal). Nunca salvar: o POST /bio muda a base do desktop.
// ---------------------------------------------------------------------------
test.describe('perfil', () => {
  test('perfil: coluna única, regra do Sugerido visível, toque aplica a sugestão, inputMode', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoApp(page, '/ritmo');
    await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet').first();
    await expect(sheet.locator('.modal-title')).toHaveText('Perfil Biológico & Metas');
    const colunas = (loc) => loc.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    expect(await colunas(sheet.locator('.bio-modal-grid'))).toBe(1);
    for (const g of await sheet.locator('.form-grid.two-cols').all()) expect(await colunas(g)).toBe(1);

    for (const n of ['peso', 'altura', 'bf_estimado', 'gasto_calorico_total', 'meta_proteina', 'meta_carbo', 'meta_gordura', 'meta_agua']) {
      await expect(sheet.locator(`input[name="${n}"]`)).toHaveAttribute('inputmode', 'decimal');
    }
    await expect(sheet.locator('input[name="idade"]')).toHaveAttribute('inputmode', 'numeric');

    const regras = sheet.locator('.meta-hint');
    await expect(regras).toHaveCount(5);
    await expect(regras.first()).toBeVisible();
    await expect(regras.first()).toHaveText('Regra: TMB x Fator Ativ. +/- Objetivo');
    await expect(regras.nth(1)).toHaveText('Regra: 2.0g por kg corporal');
    const badge0 = sheet.locator('.suggestion-badge').first();
    expect(await badge0.evaluate((e) => getComputedStyle(e, '::after').display)).toBe('none');

    const prot = sheet.locator('input[name="meta_proteina"]');
    await prot.fill('');
    const badge = sheet.locator('.meta-input-group', { has: page.locator('input[name="meta_proteina"]') }).locator('.suggestion-badge');
    const sugerido = (await badge.innerText()).match(/[\d.]+/)[0];
    await badge.click();
    await expect(prot).toHaveValue(sugerido);

    expect(await overflowOffenders(page)).toEqual([]);
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    expect(await textosPequenos(page, '.modal-overlay.is-sheet')).toEqual([]);
    await sheet.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
  });

  test('perfil: Confirmar visível com o teclado aberto', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await teclado(page);
    await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
    const confirmar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Confirmar' });
    await expect(confirmar).toBeVisible();
    await expect.poll(async () => { const b = await confirmar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
  });
});

// ---------------------------------------------------------------------------
// Task 7: capturas (abrir os PNGs e conferir espaçamento contra o mockup)
// ---------------------------------------------------------------------------
test('builder de treino: nome do dia alinhado com os rótulos e rótulo de volume sem corte', async ({ page }) => {
  for (const w of [360, 430]) {
    await page.setViewportSize({ width: w, height: 844 });
    await gotoApp(page, '/ritmo');
    const cortes = await page.locator('.vol-bar-label').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > e.parentElement.getBoundingClientRect().left + 77).map((e) => e.textContent));
    expect(cortes, `rótulos de volume cortados @ ${w}`).toEqual([]);
    await page.getByRole('button', { name: 'Novo treino' }).click();
    await page.getByRole('button', { name: '+ Add Exercício' }).click();
    await animacoesAcabaram(page);
    const dia = await textoX(page.locator('.rb-day-name').first());
    const rotulo = (await page.locator('.rb-label').first().boundingBox()).x;
    expect(Math.abs(dia - rotulo), `Treino A x=${dia} rótulo x=${rotulo} @ ${w}`).toBeLessThanOrEqual(2);
    await page.locator('.modal-overlay.is-sheet-full').getByRole('button', { name: 'Cancelar' }).click();
  }
});

test('capturas para a conferência visual (360/390/430)', async ({ page }, testInfo) => {
  for (const w of [360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 844 });
    await gotoApp(page, '/ritmo');
    expect(await overflowOffenders(page), `treino @ ${w}`).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-treino.png`), fullPage: true });
    await abrirAba(page, 'Plano de Dieta');
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-dieta.png`), fullPage: true });
    await page.getByRole('button', { name: 'Nova dieta' }).click();
    await page.getByRole('button', { name: '+ Add Alimento' }).click();
    await animacoesAcabaram(page);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-builder-dieta.png`) });
    await page.locator('.modal-overlay.is-sheet-full').getByRole('button', { name: 'Cancelar' }).click();
    await abrirAba(page, 'Plano de Treino');
    await page.getByRole('button', { name: 'Novo treino' }).click();
    await page.getByRole('button', { name: '+ Add Exercício' }).click();
    await animacoesAcabaram(page);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-builder-treino.png`) });
    await page.locator('.modal-overlay.is-sheet-full').getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
    await animacoesAcabaram(page);
    expect(await overflowOffenders(page), `perfil @ ${w}`).toEqual([]);
    await expect(page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-perfil.png`) });
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Cancelar' }).click();
  }
});
