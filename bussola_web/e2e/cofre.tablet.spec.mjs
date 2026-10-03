import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';

for (const w of [769, 900, 1024]) {
  test(`tablet ${w}px: tabela sem overflow e sem a lista do celular`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/cofre');
    await expect(page.locator('.data-table')).toBeVisible();
    await expect(page.locator('.cofre-m')).toHaveCount(0);
    await expect(page.locator('.app-fab')).toHaveCount(0);
    expect(await overflowOffenders(page)).toEqual([]);
    // As ações da última coluna não podem ficar cortadas pelo cartão (overflow hidden).
    const card = await page.locator('.data-table').first().evaluate((t) => {
      const c = t.parentElement.getBoundingClientRect();
      const b = t.querySelector('tbody tr:first-child .btn-delete').getBoundingClientRect();
      return { cartaoDireita: c.right, botaoDireita: b.right };
    });
    expect(card.botaoDireita).toBeLessThanOrEqual(card.cartaoDireita);
  });
}

test('tablet: botões dos modais com 44px', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await page.getByRole('button', { name: /Guardar Segredo/ }).click();
  await expect(page.locator('.modal-overlay .modal-footer')).toBeVisible();
  await expect
    .poll(() => smallTargets(page, '.modal-overlay'))
    .toEqual([]);
  await page.keyboard.press('Escape');
  await page.locator('.btn-view-secret').first().click();
  await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
  await expect(page.locator('.secret-display-box')).toBeVisible();
  await expect
    .poll(() => smallTargets(page, '.modal-overlay'))
    .toEqual([]);
});

test('tablet: controles da página com 44px', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
  await expect
    .poll(() => smallTargets(page, '.cofre-scope .cofre-content-wrapper'))
    .toEqual([]);
});

test('tablet: sem destaque de hover na linha (toque)', async ({ page }) => {
  await gotoApp(page, '/cofre');
  const row = page.locator('.data-table tbody tr').first();
  await row.hover();
  // a linha tem transição? sem hover, o fundo já é o final: poll aguarda qualquer transição
  await expect
    .poll(() => row.evaluate((e) => getComputedStyle(e).backgroundColor))
    .toBe('rgba(0, 0, 0, 0)');
});
