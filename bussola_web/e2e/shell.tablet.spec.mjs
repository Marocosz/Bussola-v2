import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test('tablet: sidebar recolhida (só ícones), sem barra inferior', async ({ page }) => {
  await gotoApp(page, '/financas');
  const side = page.locator('aside.sidebar');
  await expect(side).toHaveClass(/collapsed/);
  expect(Math.round((await side.boundingBox()).width)).toBe(72);
  await expect(page.locator('.bottom-nav')).toHaveCount(0);
  await expect(page.locator('.sidebar-collapse')).toHaveCount(0);
});
