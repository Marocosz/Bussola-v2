import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test('no celular o robô flutuante some e vira botão da topbar', async ({ page }) => {
  await gotoApp(page, '/financas');
  await expect(page.locator('.ai-floating-container')).toHaveCount(0);
  await page.getByRole('button', { name: 'Assistente de IA' }).click();
  const sheet = page.locator('.modal-overlay.is-sheet-full');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.ai-glass-card')).toBeVisible();
  await sheet.getByRole('button', { name: 'Fechar' }).click();
  await expect(sheet).toHaveCount(0);
});

test('Panorama e Cofre não têm robô', async ({ page }) => {
  await gotoApp(page, '/panorama');
  await expect(page.getByRole('button', { name: 'Assistente de IA' })).toHaveCount(0);
});
