import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';

for (const w of [900, 1024]) {
  test(`tablet ${w}px: 2 colunas (direita 320px) sem overflow`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/financas');
    expect(await overflowOffenders(page)).toEqual([]);
    const cols = await page.locator('.layout-grid-custom').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' '));
    expect(cols).toHaveLength(2);
    expect(Math.round(parseFloat(cols[1]))).toBe(320);
    await expect(page.locator('.metas-entry')).toHaveCount(2);
    await expect(page.locator('.m-prov')).toHaveCount(0);
  });
}

test('tablet: ações da linha visíveis sem hover, com 44px e abaixo do valor', async ({ page }) => {
  await gotoApp(page, '/financas');
  const row = page.locator('.transacao-row').first();
  const actions = row.locator('.row-actions');
  expect(await actions.evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  const editar = actions.locator('.btn-edit-transacao');
  await expect(editar).toBeVisible();
  const b = await editar.boundingBox();
  expect(b.height).toBeGreaterThanOrEqual(44);
  const valor = await row.locator('.row-valor').boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(valor.y + valor.height - 1);
});

test('tablet: título da linha não some (largura útil) e cabeçalho alinhado', async ({ page }) => {
  await gotoApp(page, '/financas');
  const row = page.locator('.transacao-row').first();
  expect((await row.locator('.row-descricao').boundingBox()).width).toBeGreaterThan(100);
  const headerValor = await page.locator('.table-header span').nth(5).boundingBox();
  const rowValor = await row.locator('.row-valor-cell').boundingBox();
  expect(Math.abs((headerValor.x + headerValor.width) - (rowValor.x + rowValor.width))).toBeLessThan(4);
});

test('tablet: controles da página com 44px', async ({ page }) => {
  await gotoApp(page, '/financas');
  expect(await smallTargets(page, '.financas-scope .layout-grid-custom')).toEqual([]);
  expect(await smallTargets(page, '.financas-scope .page-header')).toEqual([]);
});
