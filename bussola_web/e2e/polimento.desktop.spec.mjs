import { test, expect } from '@playwright/test';
import { gotoApp, congelarAgenda } from './helpers.mjs';

// Varredura final: o que mudou para o toque continua igual com mouse.

test('desktop: botão da IA continua na tela depois de estreitar a janela e volta ao lugar ao alargar', async ({ page }) => {
  await gotoApp(page, '/financas');
  const fab = page.locator('.ai-floating-container');
  await expect(fab).toBeVisible();
  const antes = await fab.boundingBox();
  for (const [w, h] of [[900, 700], [800, 500]]) {
    await page.setViewportSize({ width: w, height: h });
    await expect.poll(async () => {
      const b = await fab.boundingBox();
      return b.x >= 0 && b.y >= 0 && b.x + 60 <= w && b.y + 60 <= h;
    }).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(async () => { const b = await fab.boundingBox(); return [Math.round(b.x), Math.round(b.y)]; })
    .toEqual([Math.round(antes.x), Math.round(antes.y)]);
});

test('desktop: selo do card ainda "levanta" no hover do mouse', async ({ page }) => {
  await congelarAgenda(page);
  await gotoApp(page, '/agenda');
  const card = page.locator('.selo-card').first();
  await card.hover();
  await expect(card.locator('.selo-badge')).not.toHaveCSS('transform', 'none');
});
