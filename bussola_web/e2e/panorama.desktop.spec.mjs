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

test('desktop panorama: grid sem spans inline, com data-widget na ordem atual', async ({ page }) => {
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  const cards = page.locator('.pv2-grid > .pcard');
  expect(await cards.evaluateAll((els) => els.map((e) => e.dataset.widget))).toEqual(
    ['evolucao', 'donut', 'orcamento', 'cofrinhos', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre'],
  );
  expect(await cards.evaluateAll((els) => els.filter((e) => e.style.gridColumn).length)).toBe(0);
  // `grid-column: span N` vira start = "span N" e end = "auto" no valor computado.
  const spans = await cards.evaluateAll((els) => els.map((e) => getComputedStyle(e).gridColumnStart));
  expect(spans).toEqual(['span 8', 'span 4', 'span 6', 'span 6', 'span 12', 'span 4', 'span 4', 'span 4', 'span 8', 'span 4']);
});

test('desktop panorama: nada do layout mobile aparece', async ({ page }) => {
  await usarFixture(page, { insights: 5 });
  await gotoApp(page, '/panorama');
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.pv2-attn-arrow')).toHaveCount(2);
  await expect(page.locator('.pv2-attn-row .pv2-alert')).toHaveCount(4);
  await expect(page.locator('.pv2-attn-row.is-carousel')).toHaveCount(0);
  await expect(page.locator('.pv2-donut-legend')).toBeHidden();
  await expect(page.locator('.pv2-readout')).toHaveCount(0);
  await expect(page.locator('.pv2-evo-months')).toHaveCount(0);
  await expect(page.locator('[data-widget="evolucao"] svg text')).toHaveCount(12);
  await expect(page.locator('.pv2-hero-label')).toHaveText('Caixa · patrimônio acumulado');
  expect(await page.locator('.pv2-hero-jar svg animate').count()).toBeGreaterThan(0);
});
