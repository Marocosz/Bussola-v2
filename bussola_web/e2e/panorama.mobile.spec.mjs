import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { usarFixture } from './panorama-fixture.mjs';

const WIDGETS_MOBILE = ['orcamento', 'cofrinhos', 'donut', 'evolucao', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre'];
const caixa = (page, sel) => page.locator(sel).first().boundingBox();

// ---------------------------------------------------------------------------
// Task 2 — ordem e grade
// ---------------------------------------------------------------------------
test.describe('ordem e grade', () => {
  test('hero → KPIs → Atenção → widgets na ordem aprovada, em 1 coluna com gutter de 16', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const y = async (sel) => (await caixa(page, sel)).y;
    expect(await y('.pv2-hero')).toBeLessThan(await y('.pv2-kpiband'));
    expect(await y('.pv2-kpiband')).toBeLessThan(await y('.pv2-section-top'));
    expect(await y('.pv2-section-top')).toBeLessThan(await y('.pv2-grid'));

    const cards = page.locator('.pv2-grid > [data-widget]');
    expect(await cards.evaluateAll((els) => els.map((e) => e.dataset.widget))).toEqual(WIDGETS_MOBILE);
    const grid = await caixa(page, '.pv2-grid');
    expect(Math.round(grid.x)).toBe(16);
    const boxes = await cards.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; }));
    for (const b of boxes) {
      expect(Math.abs(b.x - grid.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(b.w - grid.width)).toBeLessThanOrEqual(1);
    }
  });

  test('espaçamento: 12 entre cards, 24 entre seções, 16 dentro do card', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const grid = page.locator('.pv2-grid');
    expect(await grid.evaluate((e) => getComputedStyle(e).rowGap)).toBe('12px');
    expect(await grid.evaluate((e) => getComputedStyle(e).marginTop)).toBe('24px');
    expect(await page.locator('[data-widget="ritmo"]').evaluate((e) => getComputedStyle(e).padding)).toBe('16px');
    expect(await page.locator('[data-widget="orcamento"]').evaluate((e) => getComputedStyle(e).height)).not.toBe('340px');
  });

  test('cruzar 768px com um período escolhido mantém o filtro (o hero não remonta)', async ({ page }) => {
    await gotoApp(page, '/panorama');
    await page.locator('.drf-trigger').click();
    await page.locator('.modal-overlay.is-sheet').getByText('Este ano', { exact: true }).click();
    await expect(page.locator('.drf-trigger')).toContainText('Este ano');
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('.pv2-section-top, .pv2-hero').first()).toBeVisible();
    await expect(page.locator('.drf-trigger')).toContainText('Este ano');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.drf-trigger')).toContainText('Este ano');
  });
});
