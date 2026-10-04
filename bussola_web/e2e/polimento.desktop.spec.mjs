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

// Contraste WCAG entre o texto e o fundo de um elemento (cores sólidas rgb/rgba opaco).
const contraste = (loc) => loc.evaluate((e) => {
  const cs = getComputedStyle(e);
  const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
  const [a, b] = [lum(rgb(cs.color)), lum(rgb(cs.backgroundColor))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
});

test('desktop: .btn-secondary com contraste ≥ 4.5:1 no tema claro (e o escuro igual)', async ({ page }) => {
  await gotoApp(page, '/__ui');
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  const botao = page.locator('.modal-footer .btn-secondary').first();
  await page.mouse.move(2, 2);
  const escuro = await botao.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(escuro).toBe('rgb(72, 74, 79)'); // #484a4f: tema escuro (o das bases visuais) não muda
  // Sem transição: a troca de tema anima o fundo (0.3s) e a leitura pegaria a cor do meio do caminho.
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });
  await page.evaluate(() => document.body.classList.add('light-theme'));
  await expect.poll(() => botao.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(escuro);
  expect(await contraste(botao)).toBeGreaterThanOrEqual(4.5);
});

test('desktop: selo do card ainda "levanta" no hover do mouse', async ({ page }) => {
  await congelarAgenda(page);
  await gotoApp(page, '/agenda');
  const card = page.locator('.selo-card').first();
  await card.hover();
  await expect(card.locator('.selo-badge')).not.toHaveCSS('transform', 'none');
});
