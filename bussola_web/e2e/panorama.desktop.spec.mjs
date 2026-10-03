import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { usarFixture } from './panorama-fixture.mjs';

// Bases geradas ANTES do refactor do JSX (Task 1). Cobrem o que o banco demo não tem:
// alertas com paginação (setas + pontos), jarros cheios, orçamento estourado, Projeção.
test('desktop panorama (payload fixo) inalterado', async ({ page }) => {
  await usarFixture(page, { insights: 5 });
  await gotoApp(page, '/panorama');
  await expect(page).toHaveScreenshot('panorama-fixture.png', { fullPage: true });
});

test('desktop panorama: 2ª página do Atenção agora inalterada', async ({ page }) => {
  await usarFixture(page, { insights: 5 });
  await gotoApp(page, '/panorama');
  await page.getByRole('button', { name: 'Próximos' }).click();
  await expect(page.locator('.pv2-alert-empty')).toHaveCount(3);
  await expect(page.locator('.pv2-section-top')).toHaveScreenshot('panorama-atencao-p2.png');
});
