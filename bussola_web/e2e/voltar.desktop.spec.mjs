import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

const tick = (page) => page.evaluate(() => new Promise((r) => setTimeout(() => setTimeout(r, 0), 0)));

test('desktop: modal não empilha histórico e o Voltar navega como antes', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.locator('aside.sidebar').getByRole('link', { name: 'Cofre' }).click();
  await expect(page).toHaveURL(/\/cofre$/);
  await page.getByRole('button', { name: 'Guardar Segredo' }).click();
  await expect(page.locator('.modal-overlay')).toBeVisible();
  await tick(page);
  expect(await page.evaluate(() => window.history.state?.__sheet ?? null)).toBeNull();
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/financas$/);
});
