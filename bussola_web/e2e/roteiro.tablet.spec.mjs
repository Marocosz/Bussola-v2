import { test, expect } from '@playwright/test';
import { gotoApp, congelarAgenda, overflowOffenders, smallTargets } from './helpers.mjs';

const cardsAbertos = (page) => page.locator('.accordion-wrapper.open .compromisso-card-modern');

for (const w of [900, 1024]) {
  test(`tablet ${w}px: 2 colunas sem overflow, cards em 1 coluna, cabeçalho dentro da coluna`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await congelarAgenda(page);
    await gotoApp(page, '/agenda');
    await expect(page.locator('.agenda-layout')).toBeVisible();
    await expect(page.locator('.m-roteiro')).toHaveCount(0);
    expect(await overflowOffenders(page)).toEqual([]);
    const xs = await cardsAbertos(page).evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().x)))]);
    expect(xs).toHaveLength(1);
    const cab = await page.locator('.column-header-flex.header-left-aligned').boundingBox();
    const add = await page.getByRole('button', { name: 'Adicionar' }).boundingBox();
    expect(add.x + add.width).toBeLessThanOrEqual(cab.x + cab.width);
  });
}

test('tablet: editar/excluir visíveis sem hover e controles com 44px', async ({ page }) => {
  await congelarAgenda(page);
  await gotoApp(page, '/agenda');
  const card = cardsAbertos(page).first();
  expect(await card.locator('.top-actions').evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  expect(await smallTargets(page, '.agenda-scope .agenda-layout')).toEqual([]);
});

test('tablet: tocar num dia do calendário não abre tooltip', async ({ page }) => {
  await congelarAgenda(page);
  await gotoApp(page, '/agenda');
  await page.locator('.dias-grid .dia-card.has-compromissos').first().tap();
  await page.waitForTimeout(300);
  await expect(page.locator('.agenda-scope .tooltip.visible')).toHaveCount(0);
});

test('tablet: dia da semana abaixo da data no card estreito', async ({ page }) => {
  await congelarAgenda(page);
  await gotoApp(page, '/agenda');
  const card = cardsAbertos(page).first();
  const data = await card.locator('.date-big').boundingBox();
  const dia = await card.locator('.weekday-inline').boundingBox();
  expect(dia.y).toBeGreaterThanOrEqual(data.y + data.height - 1);
  const acoes = await card.locator('.top-actions').boundingBox();
  const caixa = await card.boundingBox();
  expect(acoes.x + acoes.width).toBeLessThanOrEqual(caixa.x + caixa.width);
});
