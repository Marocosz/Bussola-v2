import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, overflowOffendersOutsideScrollers, animacoesAcabaram } from './helpers.mjs';
import { mockEstudos } from './fixtures/estudos.mjs';

const tituloTopbar = (page) => page.locator('.m-topbar-title');
const voltar = (page) => page.getByRole('button', { name: 'Voltar' });

// ---------------------------------------------------------------------------
// Task 1 — helper
// ---------------------------------------------------------------------------
// O culpado é position:fixed de propósito: um bloco largo no fluxo faria o Chrome mobile alargar a
// viewport de layout (innerWidth passa a 900) e nada pareceria estourar.
test('overflowOffendersOutsideScrollers aceita rolagem interna e acusa o resto', async ({ page }) => {
  await gotoApp(page, '/estudos');
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="t-rola" style="width:200px;overflow-x:auto"><div class="t-rola-filho" style="width:900px;height:10px"></div></div>
      <div class="t-estoura" style="position:fixed;top:0;left:0;width:900px;height:10px"></div>`);
  });
  const doTeste = (lista) => lista.filter((s) => /t-rola-filho|t-estoura/.test(s)).map((s) => s.split(' ')[0]);
  expect(doTeste(await overflowOffendersOutsideScrollers(page))).toEqual(['div.t-estoura']);
  expect(doTeste(await overflowOffenders(page))).toEqual(['div.t-rola-filho', 'div.t-estoura']);
});

// ---------------------------------------------------------------------------
// Task 2 — topbar das sub-rotas
// ---------------------------------------------------------------------------
test.describe('topbar das sub-rotas', () => {
  test('/estudos: topbar "Estudos" sem Voltar', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await expect(tituloTopbar(page)).toHaveText('Estudos');
    await expect(voltar(page)).toHaveCount(0);
  });

  test('kit por link direto: "Kit do Claude" com Voltar de 44px que vai para a biblioteca', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/kit');
    await expect(tituloTopbar(page)).toHaveText('Kit do Claude');
    await animacoesAcabaram(page);
    const b = await voltar(page).boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(Math.round(b.x)).toBe(8);
    await expect(voltar(page).locator('i')).toHaveClass(/fa-arrow-left/);
    await voltar(page).click();
    await expect(page).toHaveURL(/\/estudos$/);
    await expect(tituloTopbar(page)).toHaveText('Estudos');
    await expect(voltar(page)).toHaveCount(0);
    // replace: o link direto não deixa a entrada do kit para trás
    expect(await page.evaluate(() => window.history.state.idx)).toBe(0);
  });

  test('kit a partir da biblioteca: Voltar volta no histórico', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await page.locator('.page-header').getByRole('link', { name: /Kit do Claude/ }).click();
    await expect(page).toHaveURL(/\/estudos\/kit$/);
    const idx = await page.evaluate(() => window.history.state.idx);
    await voltar(page).click();
    await expect(page).toHaveURL(/\/estudos$/);
    expect(await page.evaluate(() => window.history.state.idx)).toBe(idx - 1);
  });

  test('leitura: topbar com o tema e Voltar preserva o filtro', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await page.locator('.estudos-tema', { hasText: 'Banco de Dados' }).click();
    await expect(page).toHaveURL(/\/estudos\?tema=901$/);
    await page.locator('.estudo-card', { hasText: 'Índices B-tree' }).click();
    await expect(page).toHaveURL(/\/estudos\/9101$/);
    await expect(tituloTopbar(page)).toHaveText('Banco de Dados');
    await voltar(page).click();
    await expect(page).toHaveURL(/\/estudos\?tema=901$/);
    await expect(tituloTopbar(page)).toHaveText('Estudos');
  });

  test('leitura sem tema e material inexistente: topbar "Estudos" com Voltar', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9105');
    await expect(page.locator('.estudo-cabecalho h1')).toContainText('Material sem tema');
    await expect(tituloTopbar(page)).toHaveText('Estudos');
    await expect(voltar(page)).toBeVisible();
    await gotoApp(page, '/estudos/999');
    await expect(page.locator('.estudos-vazio h2')).toHaveText('Material não encontrado');
    await expect(voltar(page)).toBeVisible();
  });

  test('trocar de rota pela barra inferior limpa o título', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/kit');
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Panorama', { exact: true }).click();
    await expect(page).toHaveURL(/\/panorama$/);
    await expect(tituloTopbar(page)).toHaveText('Panorama');
    await expect(voltar(page)).toHaveCount(0);
  });

  test('título longo não estoura a topbar', async ({ page }) => {
    await mockEstudos(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/estudos/9103');
    await expect(tituloTopbar(page)).toHaveText('Redes de Computadores e Protocolos da Internet');
    const bar = await page.locator('.m-topbar').boundingBox();
    expect(bar.x + bar.width).toBeLessThanOrEqual(360);
    expect(await overflowOffendersOutsideScrollers(page)).not.toContainEqual(expect.stringContaining('m-topbar'));
  });
});
