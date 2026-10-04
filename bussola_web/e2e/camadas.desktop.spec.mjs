import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { registrarTestesDeCamadas } from './camadas.mjs';

registrarTestesDeCamadas('desktop');

// O foco inicial do BaseModal não passa por cima de um autoFocus do formulário (só no desktop).
test('desktop: autoFocus do formulário do Cofre continua valendo', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await page.getByRole('button', { name: 'Guardar Segredo' }).click();
  await expect(page.locator('#segredo-titulo')).toBeFocused();
});
