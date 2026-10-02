import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test('barra inferior com 5 itens, rótulos e item ativo da rota', async ({ page }) => {
  await gotoApp(page, '/financas');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toBeVisible();
  for (const r of ['Panorama', 'Provisões', 'Roteiro', 'Registros', 'Mais']) await expect(nav.getByText(r, { exact: true })).toBeVisible();
  await expect(nav.locator('.bottom-nav-item.active')).toHaveText(/Provisões/);
  for (const b of await nav.locator('.bottom-nav-item').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('aside.sidebar')).toHaveCount(0);
});

test('topbar mostra o título do módulo e é sticky', async ({ page }) => {
  await gotoApp(page, '/agenda');
  const bar = page.locator('.m-topbar');
  await expect(bar.locator('.m-topbar-title')).toHaveText('Roteiro');
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect(bar).toBeInViewport();
});

test('navegar pela barra inferior', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Registros', { exact: true }).click();
  await expect(page).toHaveURL(/\/registros$/);
  await expect(page.locator('.m-topbar-title')).toHaveText('Registros');
});

test('trocar de rota pela barra inferior volta ao topo', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.evaluate(() => window.scrollTo(0, 1500));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Registros', { exact: true }).click();
  await expect(page).toHaveURL(/\/registros$/);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0);
});

test('"Mais" abre o sheet com módulos e conta; Ritmo ativa o "Mais"', async ({ page }) => {
  await gotoApp(page, '/panorama');
  await page.getByRole('button', { name: 'Mais' }).click();
  const sheet = page.locator('.modal-overlay.is-sheet');
  for (const r of ['Ritmo', 'Cofre', 'Início', 'Estudos', 'Minha Conta', 'Sair']) await expect(sheet.getByText(r, { exact: true })).toBeVisible();
  await sheet.getByText('Ritmo', { exact: true }).click();
  await expect(page).toHaveURL(/\/ritmo$/);
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.bottom-nav-item.active')).toHaveText(/Mais/);
});

test('avatar abre Minha Conta em tela cheia', async ({ page }) => {
  await gotoApp(page, '/panorama');
  await page.getByRole('button', { name: 'Minha conta' }).click();
  const drawer = page.locator('.drawer-content.open');
  await expect(drawer).toBeVisible();
  expect(Math.round((await drawer.boundingBox()).width)).toBe(390);
});

test('conteúdo não fica atrás da barra inferior', async ({ page }) => {
  await gotoApp(page, '/cofre');
  const pad = await page.locator('.app-content').evaluate((e) => parseFloat(getComputedStyle(e).paddingBottom));
  expect(pad).toBeGreaterThanOrEqual(64 + 16);
});

test('toasts aparecem acima da barra inferior', async ({ page }) => {
  await gotoApp(page, '/cofre');
  const bottom = await page.locator('.toast-container').evaluate((e) => getComputedStyle(e).bottom);
  expect(parseFloat(bottom)).toBeGreaterThanOrEqual(64);
});

test('rota fora do menu: título padrão, sem robô, nada ativo', async ({ page }) => {
  await gotoApp(page, '/discord/link');
  await expect(page.locator('.m-topbar-title')).toHaveText('Bússola');
  await expect(page.locator('.m-topbar-btn.is-ai')).toHaveCount(0);
  await expect(page.locator('.bottom-nav-item.active')).toHaveCount(0);
});

test('tema claro: barra inferior usa as variáveis do tema', async ({ page }) => {
  await gotoApp(page, '/panorama');
  const dark = await page.locator('.bottom-nav').evaluate((e) => getComputedStyle(e).backgroundColor);
  await page.evaluate(() => document.body.classList.add('light-theme'));
  const light = await page.locator('.bottom-nav').evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(light).not.toBe(dark);
});

test('topbar e barra inferior não estouram a largura', async ({ page }) => {
  await gotoApp(page, '/registros');
  for (const sel of ['.m-topbar', '.bottom-nav']) {
    const b = await page.locator(sel).boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
  }
});
