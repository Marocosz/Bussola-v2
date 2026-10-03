import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';
import { usarFixture } from './panorama-fixture.mjs';

const WIDGETS_MOBILE = ['orcamento', 'cofrinhos', 'donut', 'evolucao', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre'];
const caixa = (page, sel) => page.locator(sel).first().boundingBox();

// ---------------------------------------------------------------------------
// Task 2 — ordem e grade
// ---------------------------------------------------------------------------
test.describe('ordem e grade', () => {
  test('hero → KPIs → Atenção → widgets na ordem aprovada, em 1 coluna com gutter de 16', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const y = async (sel) => (await caixa(page, sel)).y;
    expect(await y('.pv2-hero')).toBeLessThan(await y('.pv2-kpiband'));
    expect(await y('.pv2-kpiband')).toBeLessThan(await y('.pv2-section-top'));
    expect(await y('.pv2-section-top')).toBeLessThan(await y('.pv2-grid'));

    const cards = page.locator('.pv2-grid > [data-widget]');
    expect(await cards.evaluateAll((els) => els.map((e) => e.dataset.widget))).toEqual(WIDGETS_MOBILE);
    const grid = await caixa(page, '.pv2-grid');
    expect(Math.round(grid.x)).toBe(16);
    const boxes = await cards.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; }));
    for (const b of boxes) {
      expect(Math.abs(b.x - grid.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(b.w - grid.width)).toBeLessThanOrEqual(1);
    }
  });

  test('espaçamento: 12 entre cards, 24 entre seções, 16 dentro do card', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const grid = page.locator('.pv2-grid');
    expect(await grid.evaluate((e) => getComputedStyle(e).rowGap)).toBe('12px');
    expect(await grid.evaluate((e) => getComputedStyle(e).marginTop)).toBe('24px');
    expect(await page.locator('[data-widget="ritmo"]').evaluate((e) => getComputedStyle(e).padding)).toBe('16px');
    expect(await page.locator('[data-widget="orcamento"]').evaluate((e) => getComputedStyle(e).height)).not.toBe('340px');
  });

  test('cruzar 768px com um período escolhido mantém o filtro (o hero não remonta)', async ({ page }) => {
    await gotoApp(page, '/panorama');
    await page.locator('.drf-trigger').click();
    await page.locator('.modal-overlay.is-sheet').getByText('Este ano', { exact: true }).click();
    await expect(page.locator('.drf-trigger')).toContainText('Este ano');
    // Marca o nó DOM: se o React remontasse o filtro, o atributo sumiria (o texto sozinho não prova).
    await page.locator('.drf-trigger').evaluate((e) => e.setAttribute('data-e2e-marca', 'mesmo-no'));
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('.pv2-section-top, .pv2-hero').first()).toBeVisible();
    await expect(page.locator('.drf-trigger')).toContainText('Este ano');
    await expect(page.locator('.drf-trigger')).toHaveAttribute('data-e2e-marca', 'mesmo-no');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.drf-trigger')).toContainText('Este ano');
    await expect(page.locator('.drf-trigger')).toHaveAttribute('data-e2e-marca', 'mesmo-no');
  });
});

// ---------------------------------------------------------------------------
// Task 3 — hero, KPIs, período, privacidade, movimento, overflow
// ---------------------------------------------------------------------------
test.describe('hero e KPIs', () => {
  test('cubo de 150px centralizado em cima; rótulo, total, barras e controles abaixo, centralizados', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const jar = await caixa(page, '.pv2-hero-jar');
    expect(Math.round(jar.width)).toBe(150);
    expect(Math.abs(jar.x + jar.width / 2 - 195)).toBeLessThanOrEqual(1);
    const label = await caixa(page, '.pv2-hero-label');
    const total = await caixa(page, '.pv2-hero-total');
    const bars = await caixa(page, '.pv2-hero-bars');
    const trig = await caixa(page, '.pv2-hero-controls .drf-trigger');
    const eye = await caixa(page, '.btn-privacy-toggle');
    expect(label.y).toBeGreaterThanOrEqual(jar.y + jar.height - 1);
    expect(total.y).toBeGreaterThan(label.y);
    expect(bars.y).toBeGreaterThan(total.y);
    expect(trig.y).toBeGreaterThan(bars.y + bars.height - 1);
    expect(Math.abs((trig.x + eye.x + eye.width) / 2 - 195)).toBeLessThanOrEqual(2);
    expect(Math.round(eye.width)).toBe(44);
    expect(Math.round(eye.height)).toBe(44);
    await expect(page.locator('.pv2-hero-label')).toHaveText(/^caixa · patrimônio$/i, { useInnerText: true });
    for (const sel of ['.pv2-hero-label', '.pv2-hero-total']) {
      expect(await page.locator(sel).evaluate((e) => getComputedStyle(e).textAlign)).toBe('center');
    }
    expect(await smallTargets(page, '.pv2-hero')).toEqual([]);
  });

  test('total com clamp não estoura 360px com valor de 7 dígitos', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await usarFixture(page, { caixa: 1234567 });
    await gotoApp(page, '/panorama');
    const total = page.locator('.pv2-hero-total');
    await expect(total).toHaveText(/1\.234\.567/);
    const span = await total.locator('span').boundingBox();
    expect(span.x).toBeGreaterThanOrEqual(16);
    expect(span.x + span.width).toBeLessThanOrEqual(360 - 16);
    expect(parseFloat(await total.evaluate((e) => getComputedStyle(e).fontSize))).toBeLessThanOrEqual(48);
  });

  test('KPIs em grade 2×2 (Receita, Despesa, Balanço, Poupança) e Projeção em linha inteira', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const band = page.locator('.pv2-kpiband');
    expect(await band.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
    expect(await band.locator('.pv2-kpi-label').allTextContents()).toEqual(['Receita', 'Despesa', 'Balanço', 'Poupança', 'Projeção']);
    const bb = await band.boundingBox();
    const cells = await band.evaluate((e) => [...e.children].map((c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: Math.round(r.y), w: r.width }; }));
    expect(cells[0].y).toBe(cells[1].y);
    expect(cells[2].y).toBe(cells[3].y);
    expect(cells[2].y).toBeGreaterThan(cells[0].y);
    expect(cells[1].x).toBeGreaterThan(cells[0].x);
    expect(Math.abs(cells[4].w - bb.width)).toBeLessThanOrEqual(1);
    // valores do 2×2 no mesmo tamanho (Poupança não fica maior que os outros)
    const sizes = await band.locator('.pv2-kpi-value, .pv2-kpi-big').evaluateAll((els) => els.map((e) => getComputedStyle(e).fontSize));
    expect(new Set(sizes).size).toBe(1);
    // rótulo e valor de cada linha no mesmo y (Poupança não fica acima do Balanço): mede o texto desenhado
    const tops = await band.evaluate((e) => {
      const topo = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().top; };
      return [...e.children].slice(0, 4).map((c) => ({ l: topo(c.querySelector('.pv2-kpi-label')), v: topo(c.querySelector('.pv2-kpi-value, .pv2-kpi-big')) }));
    });
    expect(Math.abs(tops[0].v - tops[1].v)).toBeLessThanOrEqual(1);
    expect(Math.abs(tops[2].v - tops[3].v)).toBeLessThanOrEqual(1);
    expect(Math.abs(tops[2].l - tops[3].l)).toBeLessThanOrEqual(1);
  });

  test('tocar num KPI mostra a explicação em texto (aria-expanded); tocar de novo esconde', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const band = page.locator('.pv2-kpiband');
    const receita = band.locator('.pv2-kpi').first();
    const explica = page.locator('.pv2-kpi-explain');
    await expect(explica).toHaveCount(0);
    await expect(receita).toHaveAttribute('aria-expanded', 'false');
    await receita.click();
    await expect(receita).toHaveAttribute('aria-expanded', 'true');
    await expect(explica).toBeVisible();
    await expect(explica).toContainText('Receitas efetivadas no período');
    // outro KPI troca o texto
    await band.locator('.pv2-kpi-proj').click();
    await expect(explica).toContainText('Projeção de fechamento');
    await expect(receita).toHaveAttribute('aria-expanded', 'false');
    await band.locator('.pv2-kpi-proj').click();
    await expect(explica).toHaveCount(0);
  });

  test('cubo parado no celular (sem flutuar, sem balançar, sem bolhas)', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    await expect(page.locator('.pv2-hero-jar svg animate')).toHaveCount(0);
    expect(await page.locator('.pv2-hero-jar').evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  });

  test('privacidade: o olho borra os valores do hero e dos KPIs', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    await page.locator('.btn-privacy-toggle').click();
    await expect(page.locator('.pv2-root')).toHaveAttribute('data-privacy', 'on');
    for (const sel of ['.pv2-hero-total [data-money]', '.pv2-kpiband [data-money]']) {
      await expect.poll(() => page.locator(sel).first().evaluate((e) => getComputedStyle(e).filter)).toContain('blur');
    }
  });
});

test.describe('período', () => {
  test('o sheet troca o intervalo e o rótulo do gatilho', async ({ page }) => {
    await gotoApp(page, '/panorama');
    await page.locator('.pv2-hero-controls .drf-trigger').click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    const req = page.waitForRequest((r) => /\/panorama\/\?.*start=2026-01-01.*end=2027-01-01/.test(r.url()));
    await sheet.getByText('Este ano', { exact: true }).click();
    await req;
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('.pv2-hero-controls .drf-trigger')).toContainText('Este ano');
  });

  test('personalizado com teclado aberto: os campos de data ficam alcançáveis', async ({ page }) => {
    await gotoApp(page, '/panorama');
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--vvh', '420px');
      document.documentElement.style.setProperty('--kb-inset', '424px');
    });
    await page.locator('.pv2-hero-controls .drf-trigger').click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await sheet.getByText('Personalizado', { exact: true }).click();
    const fim = sheet.locator('.drf-range .pk-trigger').last();
    await fim.scrollIntoViewIfNeeded();
    await expect.poll(async () => { const b = await fim.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
  });
});

const VARIANTES = [
  ['dados reais', null],
  ['payload fixo', {}],
  ['valores grandes', { caixa: 1234567, insights: 5 }],
  ['descoberto', { caixa: 3000 }],
];
for (const w of [360, 390, 430, 768]) {
  for (const [nome, opts] of VARIANTES) {
    test(`sem overflow em ${w}px (${nome})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      if (opts) await usarFixture(page, opts);
      await gotoApp(page, '/panorama');
      expect(await overflowOffenders(page)).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------------------
// Task 4 — Atenção agora
// ---------------------------------------------------------------------------
test.describe('Atenção agora (carrossel)', () => {
  const pipAtivo = (page) => page.locator('.pv2-attn-pip').evaluateAll((els) => els.findIndex((e) => e.classList.contains('active')));

  test('só alertas reais, 1 por vez, com snap e indicador', async ({ page }) => {
    await usarFixture(page, { insights: 3 });
    await gotoApp(page, '/panorama');
    const row = page.locator('.pv2-attn-row.is-carousel');
    await expect(row).toBeVisible();
    await expect(row.locator('.pv2-alert')).toHaveCount(3);
    await expect(page.locator('.pv2-alert-empty')).toHaveCount(0);
    await expect(page.locator('.pv2-attn-arrow')).toHaveCount(0);
    await expect(page.locator('.pv2-attn-count')).toHaveText('3 alertas');
    expect(await row.evaluate((e) => getComputedStyle(e).scrollSnapType)).toContain('x mandatory');

    const grid = await caixa(page, '.pv2-grid'); // largura do conteúdo (gutter de 16)
    const cards = await row.locator('.pv2-alert').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; }));
    expect(Math.abs(cards[0].x - grid.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(cards[0].w - grid.width)).toBeLessThanOrEqual(1);
    expect(cards[1].x).toBeGreaterThan(grid.x + grid.width); // o 2º fica fora (no máximo uma "espiada" no gutter)

    await expect(page.locator('.pv2-attn-pip')).toHaveCount(3);
    expect(await pipAtivo(page)).toBe(0);
    await row.evaluate((e) => e.scrollTo({ left: e.children[1].offsetLeft - e.children[0].offsetLeft }));
    await expect.poll(() => pipAtivo(page)).toBe(1);
    expect(await overflowOffenders(page)).toEqual([]);
  });

  test('dispensar com alvo de 44px remove o card e atualiza a contagem', async ({ page }) => {
    await usarFixture(page, { insights: 3 });
    await gotoApp(page, '/panorama');
    const primeiro = page.locator('.pv2-attn-row .pv2-alert').first();
    await expect(primeiro).toContainText('Orçamento estourado: Lazer');
    const x = primeiro.getByRole('button', { name: 'Dispensar por 24h' });
    const b = await x.boundingBox();
    expect(Math.round(b.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(b.height)).toBeGreaterThanOrEqual(44);
    await x.click();
    await expect(page.locator('.pv2-attn-row .pv2-alert')).toHaveCount(2);
    await expect(page.locator('.pv2-attn-row')).not.toContainText('Orçamento estourado: Lazer');
    await expect(page.locator('.pv2-attn-count')).toHaveText('2 alertas');
    expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('panorama_dismissed') || '{}')))).toEqual(['e2e-orc']);
    expect(await smallTargets(page, '.pv2-section-top')).toEqual([]);
  });

  test('um alerta: sem indicador; nenhum alerta: a seção some', async ({ page }) => {
    await usarFixture(page, { insights: 1 });
    await gotoApp(page, '/panorama');
    await expect(page.locator('.pv2-attn-row .pv2-alert')).toHaveCount(1);
    await expect(page.locator('.pv2-attn-pips')).toHaveCount(0);
    await expect(page.locator('.pv2-attn-count')).toHaveText('1 alerta');
    await page.locator('.pv2-alert').getByRole('button', { name: 'Dispensar por 24h' }).click();
    await expect(page.locator('.pv2-section-top')).toHaveCount(0);
  });

  test('"Ver →" com 44px leva para a página do alerta', async ({ page }) => {
    await usarFixture(page, { insights: 1 });
    await gotoApp(page, '/panorama');
    const ver = page.locator('.pv2-alert-cta');
    expect(Math.round((await ver.boundingBox()).height)).toBeGreaterThanOrEqual(44);
    await ver.click();
    await expect(page).toHaveURL(/\/financas$/);
  });
});
