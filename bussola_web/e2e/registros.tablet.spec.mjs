import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';
import { comApi, limparRegistrosE2E } from './registros-data.mjs';

test.beforeAll(async ({ playwright }) => comApi(playwright, limparRegistrosE2E));

const aba = (page, nome) => page.locator('.tab-btn-pill', { hasText: nome }).click();

for (const w of [769, 900, 1024]) {
  test(`tablet ${w}px: cabeçalho do desktop, sem overflow nas 3 abas`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/registros');
    await expect(page.locator('.registros-main-header')).toBeVisible();
    await expect(page.locator('.m-segmented')).toHaveCount(0);
    for (const nome of ['Caderno', 'Tarefas', 'Jornada']) {
      await aba(page, nome);
      await page.waitForLoadState('networkidle');
      expect(await overflowOffenders(page), `${nome} @ ${w}px`).toEqual([]);
    }
  });
}

test('tablet: ações de nota, grupo e hábito visíveis sem hover', async ({ page }) => {
  await gotoApp(page, '/registros');
  if (!(await page.locator('.accordion-wrapper.open .anotacao-card').count())) {
    await page.locator('.accordion-header:not(.active)').first().click();
  }
  const card = page.locator('.accordion-wrapper.open .anotacao-card').first();
  await expect(card.locator('.anotacao-actions')).toHaveCSS('opacity', '1');
  await page.locator('.dropdown-trigger-btn').click();
  const menu = page.locator('.custom-dropdown-menu');
  await expect(menu.locator('.dropdown-item-actions').first()).toHaveCSS('opacity', '1');
  const m = await menu.boundingBox();
  expect(m.x).toBeGreaterThanOrEqual(0);
  expect(m.x + m.width).toBeLessThanOrEqual(900);
  // o menu cobre o centro do backdrop e a sidebar o canto esquerdo; clica numa área livre
  await page.mouse.click(800, 1100);
  await expect(menu).toHaveCount(0);
  await aba(page, 'Jornada');
  await expect(page.locator('.jk-habit-actions').first()).toHaveCSS('opacity', '1');
});

test('tablet: alvos ≥ 44px no cabeçalho e no quadro', async ({ page }) => {
  await gotoApp(page, '/registros');
  expect(await smallTargets(page, '.registros-main-header')).toEqual([]);
  await aba(page, 'Tarefas');
  await page.locator('.kb-board').waitFor();
  expect(await smallTargets(page, '.kb-board-scope')).toEqual([]);
});
