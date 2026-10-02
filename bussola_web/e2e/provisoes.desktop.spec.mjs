import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

// Modais da página que os refactors deste plano tocam. Base gerada ANTES de mexer no código.
const MODAIS = [
  ['metas-modal', async (p) => {
    await p.locator('.metas-entry:not(.cat-entry)').click();
    await p.locator('.metas-modal').waitFor();
    await p.locator('.metas-grid, .metas-empty').first().waitFor();
  }],
  ['categorias-modal', async (p) => {
    await p.locator('.cat-entry').click();
    await p.locator('.categorias-modal').waitFor();
  }],
  ['categoria-form', async (p) => {
    await p.locator('.cat-entry').click();
    await p.getByRole('button', { name: 'Nova Categoria' }).click();
    await p.locator('input[name="nome"]').waitFor();
  }],
  ['caixa-modal', async (p) => {
    await p.locator('.ph-kpi-btn').click();
    await p.locator('.caixa-empty, .caixa-item').first().waitFor();
  }],
];

for (const [nome, abrir] of MODAIS) {
  test(`desktop provisões: ${nome} inalterado`, async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrir(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`${nome}.png`);
  });
}

test('desktop provisões: ações da linha só aparecem no hover', async ({ page }) => {
  await gotoApp(page, '/financas');
  const row = page.locator('.transacao-row').first();
  const opacity = () => row.locator('.row-actions').evaluate((e) => getComputedStyle(e).opacity);
  expect(await opacity()).toBe('0');
  await row.hover();
  await expect.poll(opacity).toBe('1');
});

test('desktop provisões: modal de transação mantém overflow visível (popovers não cortam)', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.getByRole('button', { name: 'Adicionar' }).first().click();
  await page.locator('.dropdown-menu a', { hasText: 'Pontual' }).click();
  expect(await page.locator('.modal-content').evaluate((e) => getComputedStyle(e).overflow)).toBe('visible');
});

test('desktop provisões: nada do layout mobile aparece', async ({ page }) => {
  await gotoApp(page, '/financas');
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.layout-grid-custom')).toBeVisible();
  await expect(page.locator('.m-prov')).toHaveCount(0);
  await expect(page.locator('.app-fab')).toHaveCount(0);
});
