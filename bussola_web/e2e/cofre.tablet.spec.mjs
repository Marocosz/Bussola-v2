import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets, animacoesAcabaram } from './helpers.mjs';

// 1080/1180/1194 = iPad 10a gen, Air e Pro 11" em paisagem (toque, sidebar expandida).
for (const w of [769, 900, 1024, 1025, 1080, 1180, 1194, 1279]) {
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
  // O projeto é de toque: a regra de hover (só mouse) não pode estar valendo.
  expect(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)).toBe(false);
  await row.hover();
  await animacoesAcabaram(page);
  expect(await row.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
});

test('tablet: "Alterar" da senha travada cabe no campo (sem 1px de estouro)', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await page.locator('.btn-edit-segredo').first().click();
  await expect(page.locator('.locked-input-wrapper')).toBeVisible();
  await animacoesAcabaram(page);
  const m = await page.evaluate(() => {
    const w = document.querySelector('.locked-input-wrapper').getBoundingClientRect();
    const b = document.querySelector('.locked-input-wrapper button').getBoundingClientRect();
    return { wTop: w.top, wBottom: w.bottom, bTop: b.top, bBottom: b.bottom };
  });
  // dentro da borda de 1px: margem de pelo menos 1px acima e abaixo
  expect(m.bTop - m.wTop).toBeGreaterThanOrEqual(1);
  expect(m.wBottom - m.bBottom).toBeGreaterThanOrEqual(1);
});

test('tablet: validade nova usa o dia local (22:30 em Brasília não vira o dia seguinte)', async ({ page }) => {
  // 22:30 -03:00 já é 01:30 do dia seguinte em UTC.
  await page.clock.setFixedTime(new Date('2026-10-02T22:30:00-03:00'));
  let corpo = null;
  await page.route(/\/api\/v1\/cofre\/?$/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    corpo = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { id: 999999, titulo: 'E2E fuso', servico: null, notas: null, data_expiracao: corpo.data_expiracao } });
  });
  await page.goto('/cofre');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Guardar Segredo/ }).click();
  await page.locator('#segredo-titulo').fill('E2E fuso');
  await page.locator('#segredo-valor').fill('E2E-senha-fuso');
  await page.locator('#segredo-dias').fill('10');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect.poll(() => corpo).not.toBeNull();
  expect(corpo.data_expiracao).toBe('2026-10-12');
});
