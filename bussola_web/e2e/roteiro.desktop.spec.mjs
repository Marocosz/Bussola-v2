import { test, expect } from '@playwright/test';
import { gotoApp, congelarAgenda } from './helpers.mjs';

// Estados do Roteiro que este plano toca. Base gerada ANTES de mexer no CSS/JSX.
const ESTADOS = [
  ['agenda-tooltip', async (p) => {
    await p.locator('.dias-grid .dia-card.has-compromissos').first().hover();
    await expect(p.locator('.tooltip.visible')).toBeVisible();
  }],
  ['agenda-editar', async (p) => {
    const card = p.locator('.compromisso-card-modern').first();
    await card.hover();
    await card.locator('.btn-edit-transacao').click();
    await p.locator('.modal-content h3', { hasText: 'Editar Compromisso' }).waitFor();
  }],
  ['agenda-ordem-desc', async (p) => {
    await p.locator('.btn-filter-sort').click();
  }],
  ['agenda-mes-seguinte', async (p) => {
    await p.locator('.calendar-nav-header .btn-nav-arrow').last().click();
    await p.waitForLoadState('networkidle');
  }],
];

for (const [nome, preparar] of ESTADOS) {
  test(`desktop roteiro: ${nome} inalterado`, async ({ page }) => {
    await congelarAgenda(page);
    await gotoApp(page, '/agenda');
    await preparar(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`${nome}.png`);
  });
}

test('desktop roteiro: editar/excluir do card só aparecem no hover', async ({ page }) => {
  await gotoApp(page, '/agenda');
  const card = page.locator('.compromisso-card-modern').first();
  const opacity = () => card.locator('.top-actions').evaluate((e) => getComputedStyle(e).opacity);
  expect(await opacity()).toBe('0');
  await card.hover();
  await expect.poll(opacity).toBe('1');
});

test('desktop roteiro: nada do layout mobile aparece', async ({ page }) => {
  await gotoApp(page, '/agenda');
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.agenda-layout')).toBeVisible();
  await expect(page.locator('.m-roteiro')).toHaveCount(0);
  await expect(page.locator('.app-fab')).toHaveCount(0);
  await expect(page.locator('.m-topbar')).toHaveCount(0);
});
