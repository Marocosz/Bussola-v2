import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { mockEstudos } from './fixtures/estudos.mjs';

// Voltar do Android/navegador (mesma traversal do botão físico).
const voltar = (page) => page.evaluate(() => window.history.back());
const marca = (page) => page.evaluate(() => window.history.state?.__sheet ?? null);
const nav = (page) => page.getByRole('navigation', { name: 'Navegação principal' });
const mais = (page) => page.locator('.more-sheet');
// Espera determinística: deixa rodar as microtarefas e os setTimeout(0) já agendados pelo app
// (a checagem "a entrada do sheet ainda é o topo?" do fechamento) antes de conferir o histórico.
const tick = (page) => page.evaluate(() => new Promise((r) => setTimeout(() => setTimeout(r, 0), 0)));

async function irParaPanorama(page) {
  await gotoApp(page, '/financas');
  await nav(page).getByText('Panorama', { exact: true }).click();
  await expect(page).toHaveURL(/\/panorama$/);
}

test('Voltar fecha o sheet "Mais" e fica na rota; o próximo Voltar navega', async ({ page }) => {
  await irParaPanorama(page);
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await expect(mais(page)).toBeVisible();
  await expect.poll(() => marca(page)).not.toBeNull();
  await voltar(page);
  await expect(mais(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/panorama$/);
  await expect.poll(() => marca(page)).toBeNull();
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('sheets aninhados: um Voltar fecha só o de cima', async ({ page }) => {
  await gotoApp(page, '/__ui');
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  await page.getByRole('button', { name: 'Abrir sheet aninhado' }).click();
  const aninhado = page.locator('.app-sheet-overlay');
  await expect(aninhado).toBeVisible();
  await voltar(page);
  await expect(aninhado).toHaveCount(0);
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(1);
  await voltar(page);
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  await expect(page).toHaveURL(/\/__ui$/);
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('');
  await expect.poll(() => marca(page)).toBeNull();
});

test('tile do "Mais" navega para a rota certa, sem entrada órfã', async ({ page }) => {
  await irParaPanorama(page);
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await mais(page).getByText('Cofre', { exact: true }).click();
  await expect(page).toHaveURL(/\/cofre$/);
  await expect(mais(page)).toHaveCount(0);
  await tick(page); // passa o tick da checagem do fechamento
  await expect(page).toHaveURL(/\/cofre$/);
  expect(await marca(page)).toBeNull();
  await voltar(page);
  await expect(page).toHaveURL(/\/panorama$/);
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('fechar pelo X remove a entrada do sheet (o Voltar seguinte navega)', async ({ page }) => {
  await irParaPanorama(page);
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await expect.poll(() => marca(page)).not.toBeNull();
  await mais(page).getByRole('button', { name: 'Fechar' }).click();
  await expect(mais(page)).toHaveCount(0);
  await expect.poll(() => marca(page)).toBeNull();
  await expect(page).toHaveURL(/\/panorama$/);
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('Voltar sem sheet navega normalmente', async ({ page }) => {
  await gotoApp(page, '/financas');
  await nav(page).getByText('Registros', { exact: true }).click();
  await expect(page).toHaveURL(/\/registros$/);
  expect(await marca(page)).toBeNull();
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('ação do ActionSheet que abre outro sheet: um Voltar fecha o segundo e o próximo navega', async ({ page }) => {
  await gotoApp(page, '/financas');
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await mais(page).getByText('Cofre', { exact: true }).click();
  await expect(page).toHaveURL(/\/cofre$/);
  await page.locator('.cofre-m-mais').first().click();
  await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
  const form = page.locator('.modal-overlay.is-sheet', { has: page.locator('.locked-input-wrapper') });
  await expect(form).toBeVisible();
  await voltar(page);
  await expect(form).toHaveCount(0);
  await expect(page.locator('.action-sheet')).toHaveCount(0);
  await expect(page).toHaveURL(/\/cofre$/);
  await expect.poll(() => marca(page)).toBeNull();
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('Voltar (e o X) fecham o sheet mantendo a rolagem da página', async ({ page }) => {
  await gotoApp(page, '/__ui');
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(300);
  // dispatchEvent: um click() rolaria o botão (fora da tela) de volta ao topo
  await page.getByRole('button', { name: 'Abrir modal longo' }).dispatchEvent('click');
  await expect.poll(() => marca(page)).not.toBeNull();
  await voltar(page);
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  await tick(page);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(300);
  await page.getByRole('button', { name: 'Abrir modal longo' }).dispatchEvent('click');
  await expect.poll(() => marca(page)).not.toBeNull();
  await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).first().click();
  await expect.poll(() => marca(page)).toBeNull();
  await tick(page);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(300);
});

test('nenhuma página deixa entrada de sheet ao carregar', async ({ page }) => {
  for (const rota of ['/home', '/panorama', '/financas', '/agenda', '/registros', '/estudos', '/ritmo', '/cofre']) {
    await gotoApp(page, rota);
    await tick(page);
    expect(await marca(page), rota).toBeNull();
    await expect(page.locator('.modal-overlay'), rota).toHaveCount(0);
  }
});

test('Sair pelo "Mais" vai para o login sem deixar entrada de sheet', async ({ page }) => {
  // O logout de verdade põe o refresh token do demo na blacklist e quebraria os outros testes
  // (todos usam o mesmo e2e/.auth/state.json): a chamada é interceptada.
  await page.route(/\/api\/v1\/auth\/logout$/, (r) => r.fulfill({ status: 200, json: {} }));
  await irParaPanorama(page);
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await expect.poll(() => marca(page)).not.toBeNull();
  await mais(page).getByText('Sair', { exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await tick(page);
  expect(await marca(page)).toBeNull();
  await expect(page).toHaveURL(/\/login/);
});

test('Voltar da topbar (TopbarTitle) segue usando o idx do router depois de abrir e fechar um sheet', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos');
  await page.locator('.page-header').getByRole('link', { name: /Kit do Claude/ }).click();
  await expect(page).toHaveURL(/\/estudos\/kit$/);
  const idx = await page.evaluate(() => window.history.state.idx);
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await expect.poll(() => marca(page)).not.toBeNull();
  // A entrada do sheet preserva o state do react-router (usr/key/idx).
  expect(await page.evaluate(() => window.history.state.idx)).toBe(idx);
  await voltar(page);
  await expect(mais(page)).toHaveCount(0);
  await expect.poll(() => marca(page)).toBeNull();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page).toHaveURL(/\/estudos$/);
  expect(await page.evaluate(() => window.history.state.idx)).toBe(idx - 1);
});
