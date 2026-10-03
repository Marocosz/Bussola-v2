import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, overflowOffendersOutsideScrollers, smallTargets, animacoesAcabaram } from './helpers.mjs';
import { mockEstudos, stubClipboard, MATERIAIS } from './fixtures/estudos.mjs';

// Citações [n] e a âncora # da seção são inline no texto: ficam fora da regra de 44px.
// (os botões de citação não têm classe: identificados pelo nome "[n]").
const semInline = (lista) => lista.filter((s) => !/"\[\d+\]"|bloco-secao-ancora/.test(s));

const tituloTopbar = (page) => page.locator('.m-topbar-title');
const voltar = (page) => page.getByRole('button', { name: 'Voltar' });

// ---------------------------------------------------------------------------
// Task 1 — helper
// ---------------------------------------------------------------------------
// O culpado é position:fixed de propósito: um bloco largo no fluxo faria o Chrome mobile alargar a
// viewport de layout (innerWidth passa a 900) e nada pareceria estourar.
test('overflowOffendersOutsideScrollers aceita rolagem interna e acusa o resto', async ({ page }) => {
  await gotoApp(page, '/estudos');
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="t-rola" style="width:200px;overflow-x:auto"><div class="t-rola-filho" style="width:900px;height:10px"></div></div>
      <div class="t-estoura" style="position:fixed;top:0;left:0;width:900px;height:10px"></div>`);
  });
  const doTeste = (lista) => lista.filter((s) => /t-rola-filho|t-estoura/.test(s)).map((s) => s.split(' ')[0]);
  expect(doTeste(await overflowOffendersOutsideScrollers(page))).toEqual(['div.t-estoura']);
  expect(doTeste(await overflowOffenders(page))).toEqual(['div.t-rola-filho', 'div.t-estoura']);
});

// ---------------------------------------------------------------------------
// Task 2 — topbar das sub-rotas
// ---------------------------------------------------------------------------
test.describe('topbar das sub-rotas', () => {
  test('/estudos: topbar "Estudos" sem Voltar', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await expect(tituloTopbar(page)).toHaveText('Estudos');
    await expect(voltar(page)).toHaveCount(0);
  });

  test('kit por link direto: "Kit do Claude" com Voltar de 44px que vai para a biblioteca', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/kit');
    await expect(tituloTopbar(page)).toHaveText('Kit do Claude');
    await animacoesAcabaram(page);
    const b = await voltar(page).boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(Math.round(b.x)).toBe(8);
    await expect(voltar(page).locator('i')).toHaveClass(/fa-arrow-left/);
    await voltar(page).click();
    await expect(page).toHaveURL(/\/estudos$/);
    await expect(tituloTopbar(page)).toHaveText('Estudos');
    await expect(voltar(page)).toHaveCount(0);
    // replace: o link direto não deixa a entrada do kit para trás
    expect(await page.evaluate(() => window.history.state.idx)).toBe(0);
  });

  test('kit a partir da biblioteca: Voltar volta no histórico', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await page.locator('.page-header').getByRole('link', { name: /Kit do Claude/ }).click();
    await expect(page).toHaveURL(/\/estudos\/kit$/);
    const idx = await page.evaluate(() => window.history.state.idx);
    await voltar(page).click();
    await expect(page).toHaveURL(/\/estudos$/);
    expect(await page.evaluate(() => window.history.state.idx)).toBe(idx - 1);
  });

  test('leitura: topbar com o tema e Voltar preserva o filtro', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await page.locator('.estudos-tema', { hasText: 'Banco de Dados' }).click();
    await expect(page).toHaveURL(/\/estudos\?tema=901$/);
    await page.locator('.estudo-card', { hasText: 'Índices B-tree' }).click();
    await expect(page).toHaveURL(/\/estudos\/9101$/);
    await expect(tituloTopbar(page)).toHaveText('Banco de Dados');
    await voltar(page).click();
    await expect(page).toHaveURL(/\/estudos\?tema=901$/);
    await expect(tituloTopbar(page)).toHaveText('Estudos');
  });

  test('leitura sem tema e material inexistente: topbar "Estudos" com Voltar', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9105');
    await expect(page.locator('.estudo-cabecalho h1')).toContainText('Material sem tema');
    await expect(tituloTopbar(page)).toHaveText('Estudos');
    await expect(voltar(page)).toBeVisible();
    await gotoApp(page, '/estudos/999');
    await expect(page.locator('.estudos-vazio h2')).toHaveText('Material não encontrado');
    await expect(voltar(page)).toBeVisible();
  });

  test('trocar de rota pela barra inferior limpa o título', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/kit');
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Panorama', { exact: true }).click();
    await expect(page).toHaveURL(/\/panorama$/);
    await expect(tituloTopbar(page)).toHaveText('Panorama');
    await expect(voltar(page)).toHaveCount(0);
  });

  test('título longo não estoura a topbar', async ({ page }) => {
    await mockEstudos(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/estudos/9103');
    await expect(tituloTopbar(page)).toHaveText('Redes de Computadores e Protocolos da Internet');
    const bar = await page.locator('.m-topbar').boundingBox();
    expect(bar.x + bar.width).toBeLessThanOrEqual(360);
    expect(await overflowOffendersOutsideScrollers(page)).not.toContainEqual(expect.stringContaining('m-topbar'));
  });
});

// ---------------------------------------------------------------------------
// Task 3 — biblioteca
// ---------------------------------------------------------------------------
test.describe('biblioteca', () => {
  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px (com materiais)`, async ({ page }) => {
      await mockEstudos(page);
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/estudos');
      await page.locator('.estudo-card').first().waitFor();
      expect(await overflowOffenders(page), `${w}px`).toEqual([]);
      const temas = await page.locator('.estudos-temas').boundingBox();
      expect(temas.x).toBeGreaterThanOrEqual(0);
      expect(temas.x + temas.width).toBeLessThanOrEqual(w);
    });
  }

  test('biblioteca vazia (banco real) sem overflow em 360px e botão de 48px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/estudos');
    await expect(page.locator('.estudos-vazio h2')).toHaveText('Sua biblioteca está vazia');
    expect(await overflowOffenders(page)).toEqual([]);
    expect((await page.locator('.estudos-vazio .btn-primary').boundingBox()).height).toBeGreaterThanOrEqual(48);
  });

  test('alvos de toque ≥ 44px', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await page.locator('.estudo-card').first().waitFor();
    await animacoesAcabaram(page);
    await expect.poll(() => smallTargets(page, '.estudos-scope')).toEqual([]);
  });

  test('cards em 1 coluna: gutter de 16px e 12px entre eles; textos ≥ 12px', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    const cards = await page.locator('.estudo-card').all();
    expect(cards).toHaveLength(MATERIAIS.length);
    const caixas = await Promise.all(cards.map((c) => c.boundingBox()));
    for (const b of caixas) {
      expect(Math.round(b.x)).toBe(16);
      expect(Math.round(b.width)).toBe(390 - 32);
    }
    expect(Math.round(caixas[1].y - (caixas[0].y + caixas[0].height))).toBe(12);
    for (const sel of ['.estudo-card-tema', '.estudo-card-nivel', '.estudo-tag', '.estudo-etiqueta']) {
      const px = await page.locator(sel).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(px, sel).toBeGreaterThanOrEqual(12);
    }
  });

  test('faixa de temas rola na horizontal e filtra', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    const faixa = page.locator('.estudos-temas');
    await expect(faixa).toHaveAttribute('aria-label', 'Temas');
    await expect(faixa.locator('h2')).toBeHidden();
    expect(await faixa.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    await faixa.locator('.estudos-tema', { hasText: 'Banco de Dados' }).click();
    await expect(page.locator('.estudo-card')).toHaveCount(2);
    await faixa.locator('.estudos-tema', { hasText: 'Sem tema' }).click();
    await expect(page.locator('.estudo-card')).toHaveCount(1);
  });

  test('chips de tipo e "Só não estudados" filtram', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await page.locator('.estudos-chips').getByRole('button', { name: 'Resumo' }).click();
    await expect(page.locator('.estudo-card')).toHaveCount(1);
    await page.locator('.estudos-chips').getByRole('button', { name: 'Todos' }).click();
    await page.locator('.estudos-check').click();
    await expect(page.locator('.estudo-card')).toHaveCount(MATERIAIS.length - 1);
  });

  test('sem efeito de hover no toque', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    const card = page.locator('.estudo-card').first();
    await card.hover();
    await animacoesAcabaram(page);
    await expect.poll(() => card.evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  });

  test('faixa de temas: scroll-padding-inline mantém o respiro no snap', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await expect.poll(() => page.locator('.estudos-temas').evaluate((e) => getComputedStyle(e).scrollPaddingInlineStart)).toBe('8px');
  });
});

// ---------------------------------------------------------------------------
// Task 4 — leitura
// ---------------------------------------------------------------------------
test.describe('leitura', () => {
  for (const w of [360, 390, 430, 768, 769]) {
    test(`sem overflow fora dos blocos roláveis em ${w}px`, async ({ page }) => {
      await mockEstudos(page);
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/estudos/9101');
      await page.locator('.bloco-quiz').waitFor();
      expect(await overflowOffendersOutsideScrollers(page), `${w}px`).toEqual([]);
    });
  }

  test('comparação e código rolam dentro do bloco (o bloco cabe na tela)', async ({ page }) => {
    await mockEstudos(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/estudos/9101');
    for (const sel of ['.bloco-comparacao', '.bloco-codigo-corpo pre']) {
      const el = page.locator(sel).first();
      await el.waitFor();
      const b = await el.boundingBox();
      expect(b.x, sel).toBeGreaterThanOrEqual(16);
      expect(b.x + b.width, sel).toBeLessThanOrEqual(360 - 16 + 1);
      expect(await el.evaluate((e) => getComputedStyle(e).overflowX), sel).toBe('auto');
    }
    // o tema do highlight.js faz o próprio <code class="hljs"> rolar; o que importa é que algo role dentro do bloco
    expect(await page.locator('.bloco-codigo-corpo pre').evaluate((e) => [e, e.querySelector('code')].some((x) => x.scrollWidth > x.clientWidth))).toBe(true);
  });

  test('cabeçalho: sem breadcrumb, título visível, texto do material com 16px', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await expect(page.locator('.estudo-breadcrumb')).toBeHidden();
    await expect(page.locator('.estudo-cabecalho h1')).toBeVisible();
    expect(await page.locator('.estudo-coluna').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBe(16);
  });

  test('alvos ≥ 44px no cabeçalho e nos blocos (exceto citações inline)', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.locator('.bloco-quiz').waitFor();
    await animacoesAcabaram(page);
    await expect.poll(() => smallTargets(page, '.estudo-cabecalho')).toEqual([]);
    await expect.poll(async () => semInline(await smallTargets(page, '.estudo-coluna'))).toEqual([]);
  });

  test('ações: Estudado + lixeira na 1ª linha, Pedir ao Claude e destino em largura total', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.locator('.estudo-btn-estudado').waitFor();
    await animacoesAcabaram(page);
    await expect.poll(async () => {
      const estudado = await page.locator('.estudo-btn-estudado').boundingBox();
      const lixeira = await page.locator('.estudo-btn-excluir').boundingBox();
      const pedir = await page.locator('.estudo-acoes .pedir-claude-gatilho').boundingBox();
      const destino = await page.locator('.estudo-destino').boundingBox();
      return [
        Math.round(lixeira.y) - Math.round(estudado.y),
        Math.round(lixeira.x + lixeira.width),
        Math.round(lixeira.x - (estudado.x + estudado.width)),
        Math.round(pedir.width),
        Math.round(destino.width),
        Math.round(pedir.y - (estudado.y + estudado.height)),
      ];
    }).toEqual([0, 390 - 16, 8, 390 - 32, 390 - 32, 8]);
  });

  test('marcar como estudado e responder o quiz', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.locator('.estudo-btn-estudado').click();
    await expect(page.locator('.estudo-btn-estudado')).toHaveText(/Estudado/);
    await page.locator('.bloco-quiz-opcao', { hasText: 'B-tree' }).click();
    await expect(page.locator('.bloco-quiz-feedback strong')).toHaveText('Correto!');
  });

  test('Pedir ao Claude (material) abre um sheet e copia o comando', async ({ page }) => {
    await stubClipboard(page);
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.locator('.estudo-acoes .pedir-claude-gatilho').click();
    const sheet = page.locator('.modal-overlay.is-sheet .pedir-claude-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.locator('.pedir-claude-menu')).toHaveCount(0);
    await expect(sheet.locator('.pedir-claude-alvo')).toHaveText('Material inteiro');
    await animacoesAcabaram(page);
    await expect.poll(() => smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    await sheet.getByRole('button', { name: 'Aprofundar' }).click();
    await expect(sheet).toHaveCount(0);
    expect(await page.evaluate(() => window.__clip)).toEqual(['/estudos aprofundar material:9101']);
    await expect(page.locator('.toast-notification', { hasText: 'Comando copiado' })).toBeVisible();
  });

  test('Pedir ao Claude do bloco copia o comando do bloco; destino claude.ai muda a frase', async ({ page }) => {
    await stubClipboard(page);
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.getByRole('button', { name: 'Pedir ao Claude sobre o bloco b3' }).click();
    const sheet = page.locator('.pedir-claude-sheet');
    await expect(sheet.locator('.pedir-claude-alvo')).toHaveText('Bloco b3');
    await sheet.getByRole('button', { name: 'Simplificar' }).click();
    await page.locator('.estudo-destino').getByRole('button', { name: 'claude.ai' }).click();
    await page.locator('.estudo-acoes .pedir-claude-gatilho').click();
    await page.locator('.pedir-claude-sheet').getByRole('button', { name: 'Criar exercícios' }).click();
    expect(await page.evaluate(() => window.__clip)).toEqual([
      '/estudos simplificar material:9101 bloco:b3',
      'Use a skill estudos para criar exercícios sobre o material 9101 no Bússola.',
    ]);
  });

  test('Tirar dúvida: sem autofocus e "Copiar comando" acima do teclado', async ({ page }) => {
    await stubClipboard(page);
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--vvh', '420px');
      document.documentElement.style.setProperty('--kb-inset', '424px');
    });
    await page.locator('.estudo-acoes .pedir-claude-gatilho').click();
    await page.locator('.pedir-claude-sheet').getByRole('button', { name: 'Tirar dúvida' }).click();
    const campo = page.getByRole('textbox', { name: 'Sua dúvida' });
    await expect(campo).toBeVisible();
    await expect(campo).not.toBeFocused();
    const copiar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Copiar comando' });
    await expect(copiar).toBeDisabled();
    await campo.fill('por que "B-tree"?');
    await expect.poll(async () => { const b = await copiar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
    await copiar.click();
    expect(await page.evaluate(() => window.__clip)).toEqual([`/estudos duvida material:9101 "por que 'B-tree'?"`]);
  });

  test('copiar código: botão de 44px copia o código do bloco', async ({ page }) => {
    await stubClipboard(page);
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    const copiar = page.locator('.bloco-codigo-copiar');
    await expect.poll(async () => (await copiar.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await copiar.click();
    expect((await page.evaluate(() => window.__clip))[0]).toContain('CREATE INDEX idx_usuario_email_criado_em');
  });

  test('769 toque: itens do popover "Pedir ao Claude" com ≥ 44px', async ({ page }) => {
    await mockEstudos(page);
    await page.setViewportSize({ width: 769, height: 900 });
    await gotoApp(page, '/estudos/9101');
    await page.locator('.estudo-acoes .pedir-claude-gatilho').click();
    await expect(page.locator('.pedir-claude-menu')).toBeVisible();
    await animacoesAcabaram(page);
    await expect.poll(() => smallTargets(page, '.pedir-claude-menu')).toEqual([]);
  });

  test('360: "Copiar comando" do rodapé do sheet fica em uma linha', async ({ page }) => {
    await mockEstudos(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/estudos/9101');
    await page.locator('.estudo-acoes .pedir-claude-gatilho').click();
    await page.locator('.pedir-claude-sheet').getByRole('button', { name: 'Tirar dúvida' }).click();
    const copiar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Copiar comando' });
    await expect(copiar).toBeVisible();
    await animacoesAcabaram(page);
    await expect.poll(async () => (await copiar.boundingBox()).height).toBeLessThanOrEqual(56);
  });

  test('excluir pede confirmação e volta para a biblioteca', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.locator('.estudo-btn-excluir').click();
    await page.getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(page).toHaveURL(/\/estudos$/);
  });
});
