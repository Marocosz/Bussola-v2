import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, apiJson, smallTargets } from './helpers.mjs';

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
