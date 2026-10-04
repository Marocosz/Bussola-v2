import { test, expect } from '@playwright/test';
import { gotoApp, congelarAgenda, animacoesAcabaram } from './helpers.mjs';

// Varredura final: polimento e robustez no celular.

test.describe('compromisso (Roteiro)', () => {
  test.beforeEach(async ({ page }) => {
    await congelarAgenda(page);
    await gotoApp(page, '/agenda');
    await page.locator('.app-fab').click();
    await animacoesAcabaram(page);
  });

  test('fechar do cabeçalho é um <button> de verdade com rótulo', async ({ page }) => {
    const fechar = page.locator('.agenda-modal .modal-header').getByRole('button', { name: 'Fechar' });
    await expect(fechar).toHaveCount(1);
    expect(await fechar.evaluate((e) => e.tagName)).toBe('BUTTON');
    await expect(fechar).toHaveAttribute('type', 'button');
    await fechar.click();
    await expect(page.locator('.agenda-modal')).toHaveCount(0);
  });

  for (const largura of [360, 390]) {
    test(`placeholder da hora cabe inteiro no sheet a ${largura}px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      const texto = page.locator('.agenda-modal .pk-datetime-fields .pk-wrapper:last-child .pk-trigger-text');
      await expect(texto).toHaveText('Hora...');
      expect(await texto.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    });
  }
});
