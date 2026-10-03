import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets, animacoesAcabaram } from './helpers.mjs';

// Feed de notícias vem de fonte externa: resposta fixa (igual à base do desktop).
const NEWS = Array.from({ length: 4 }, (_, i) => ({
  title: `Noticia de exemplo numero ${i + 1} para o feed rapido`,
  url: 'https://example.com/noticia',
  source: { name: 'Fonte Demo' },
  topic: 'tech',
}));

async function abrirHome(page) {
  await page.route(/\/home\/news(\?.*)?$/, (route) => route.fulfill({ json: NEWS }));
  await gotoApp(page, '/home');
  await page.locator('.news-card').first().waitFor();
  await animacoesAcabaram(page);
}

// Transform só vale depois que nenhuma transição/animação do elemento está em curso.
const transformAssentado = (loc) => loc.evaluate((e) => (e.getAnimations().some((a) => a.playState === 'running') ? 'animando' : getComputedStyle(e).transform));

for (const w of [360, 390, 430, 768, 769]) {
  test(`início sem overflow horizontal em ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 844 });
    await abrirHome(page);
    expect(await overflowOffenders(page), `${w}px`).toEqual([]);
  });
}

test('hero: 16px de gutter, h1 fluido e texto à esquerda', async ({ page }) => {
  await abrirHome(page);
  expect(Math.round((await page.locator('.hero-content').boundingBox()).x)).toBe(16);
  const h1 = page.locator('.hero-text h1');
  const px = await h1.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(px).toBeGreaterThanOrEqual(36);
  expect(px).toBeLessThanOrEqual(48);
  expect(await page.locator('.hero-content').evaluate((e) => getComputedStyle(e).textAlign)).toBe('left');
  expect(await page.locator('.hero-text .subtitle').evaluate((e) => getComputedStyle(e).textAlign)).toBe('left');
});

test('features: parágrafos à esquerda (inclusive a coluna "direita") e links de 44px', async ({ page }) => {
  await abrirHome(page);
  const direita = page.locator('.feature-content-stack.align-right');
  expect(await direita.evaluate((e) => getComputedStyle(e).textAlign)).toBe('left');
  const p = direita.locator('.feature-item p').first();
  expect(await p.evaluate((e) => getComputedStyle(e).borderLeftWidth)).toBe('3px');
  expect(await p.evaluate((e) => getComputedStyle(e).borderRightWidth)).toBe('0px');
  const secoes = ['.features-presentation-area', '.panorama-highlight-section', '.news-footer-section'];
  for (const sec of secoes) {
    expect(await smallTargets(page, sec), sec).toEqual([]);
    expect(await page.locator(sec).evaluate((e) => getComputedStyle(e).paddingLeft), sec).toBe('16px');
  }
});

for (const w of [390, 769]) {
  test(`sem efeito de hover no toque (card de notícia e imagem) em ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 844 });
    await abrirHome(page);
    const card = page.locator('.news-card').first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await expect.poll(() => transformAssentado(card)).toBe('none');
    const img = page.locator('.feature-image-showcase img:visible').first();
    await img.scrollIntoViewIfNeeded();
    await img.hover();
    await expect.poll(() => transformAssentado(img)).toBe('none');
  });
}
