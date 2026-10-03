import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';

const abaDieta = (p) => p.getByRole('tab', { name: 'Plano de Dieta', exact: true }).click();

for (const w of [900, 1024]) {
  test(`tablet ${w}px: sem overflow nas duas abas e faixa bio em 4×2`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/ritmo');
    expect(await overflowOffenders(page), `treino @ ${w}`).toEqual([]);
    const strip = page.locator('.bio-stat-strip');
    expect(await strip.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(4);
    const cortes = await page.locator('.chip-label, .chip-value').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    expect(cortes).toEqual([]);
    expect(await page.locator('.bio-panels-row').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
    await expect(page.locator('.app-fab')).toHaveCount(0);
    await abaDieta(page);
    await expect(page.getByRole('button', { name: 'Nova Dieta' })).toBeVisible();
    expect(await overflowOffenders(page), `dieta @ ${w}`).toEqual([]);
  });
}

test('tablet: controles da página e dos builders com 44px', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  expect(await smallTargets(page, '.ritmo-scope .ritmo-content-wrapper')).toEqual([]);
  await page.getByRole('button', { name: 'Novo Treino' }).click();
  await page.getByRole('button', { name: '+ Add Exercício' }).click();
  await page.getByRole('button', { name: 'Adicionar Dia' }).click();
  expect(await smallTargets(page, '.ritmo-scope .modal-overlay')).toEqual([]);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await abaDieta(page);
  await page.getByRole('button', { name: 'Nova Dieta' }).click();
  await page.getByRole('button', { name: '+ Add Alimento' }).click();
  expect(await smallTargets(page, '.ritmo-scope .modal-overlay')).toEqual([]);
});

test('tablet: regra do Sugerido visível sem hover e alvos do perfil com 44px', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
  const regras = page.locator('.meta-hint');
  await expect(regras.first()).toBeVisible();
  expect(await page.locator('.suggestion-badge').first().evaluate((e) => getComputedStyle(e, '::after').display)).toBe('none');
  expect(await smallTargets(page, '.ritmo-scope .modal-overlay')).toEqual([]);
});

test('tablet: "Sugerido" com 44px de altura e foco visível', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
  const badge = page.locator('.suggestion-badge').first();
  await expect.poll(async () => (await badge.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Tab');
  await badge.focus();
  const outline = await badge.evaluate((e) => {
    const s = getComputedStyle(e);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThan(0);
});

test('capturas tablet para a conferência visual (900/1000)', async ({ page }, testInfo) => {
  for (const w of [900, 1000]) {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/ritmo');
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-treino.png`) });
    await abaDieta(page);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-dieta.png`) });
    await page.getByRole('button', { name: 'Nova Dieta' }).click();
    await page.getByRole('button', { name: '+ Add Alimento' }).click();
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-builder-dieta.png`) });
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('tab', { name: 'Plano de Treino', exact: true }).click();
    await page.getByRole('button', { name: 'Novo Treino' }).click();
    await page.getByRole('button', { name: '+ Add Exercício' }).click();
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-builder-treino.png`) });
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-perfil.png`) });
    await page.getByRole('button', { name: 'Cancelar' }).click();
  }
});

test('tablet: nenhuma ação/informação só no hover (ações do plano visíveis, ::after do tooltip desligado)', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  const acoes = page.locator('.plan-actions button');
  expect(await acoes.count()).toBeGreaterThan(0);
  for (const b of await acoes.all()) {
    await expect(b).toBeVisible();
    expect(await b.getAttribute('aria-label')).toBeTruthy();
  }
  const opacidade = await acoes.first().evaluate((e) => getComputedStyle(e.closest('.plan-actions')).opacity);
  expect(opacidade).toBe('1');
});
