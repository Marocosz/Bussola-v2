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

// ---------------------------------------------------------------------------
// Correções finais: editor de nota (alterações não salvas), confirmação, conta, picker, rotação, recarga
// ---------------------------------------------------------------------------
const editor = (page) => page.locator('.modal-overlay.is-sheet-full');
const tituloNota = (page) => editor(page).getByRole('textbox', { name: 'Título', exact: true });
const dialogo = (page) => page.locator('.confirm-modal');

async function irParaRegistros(page) {
  await gotoApp(page, '/financas');
  await nav(page).getByText('Registros', { exact: true }).click();
  await expect(page).toHaveURL(/\/registros$/);
}

test('editor de nota: Voltar sem alterações fecha direto; com alterações pede confirmação, Cancelar mantém e o próximo Voltar pergunta de novo', async ({ page }) => {
  await irParaRegistros(page);
  await page.locator('.app-fab').click();
  await expect(editor(page)).toBeVisible();
  await expect.poll(() => marca(page)).not.toBeNull();
  await voltar(page);
  await expect(editor(page)).toHaveCount(0);
  await expect(dialogo(page)).toHaveCount(0);
  await expect.poll(() => marca(page)).toBeNull();

  await page.locator('.app-fab').click();
  await tituloNota(page).fill('E2E voltar editor');
  await expect.poll(() => marca(page)).not.toBeNull();
  await voltar(page);
  await expect(dialogo(page)).toContainText('Descartar alterações?');
  await expect(editor(page)).toBeVisible();
  await dialogo(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo(page)).toHaveCount(0);
  await expect(tituloNota(page)).toHaveValue('E2E voltar editor');
  await tick(page);
  await expect.poll(() => marca(page)).not.toBeNull();
  await expect(page).toHaveURL(/\/registros$/);

  // o editor voltou a ter entrada: o próximo Voltar pergunta de novo (não sai da rota)
  await voltar(page);
  await expect(dialogo(page)).toContainText('Descartar alterações?');
  await expect(editor(page)).toBeVisible();
  await expect(page).toHaveURL(/\/registros$/);
  await dialogo(page).getByRole('button', { name: 'Descartar' }).click();
  await expect(editor(page)).toHaveCount(0);
  await tick(page);
  await expect.poll(() => marca(page)).toBeNull();
  await expect(page).toHaveURL(/\/registros$/);
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('editor de nota: ESC passa pela mesma confirmação (sem empilhar diálogos)', async ({ page }) => {
  await irParaRegistros(page);
  await page.locator('.app-fab').click();
  await tituloNota(page).fill('E2E esc editor');
  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toContainText('Descartar alterações?');
  await expect(editor(page)).toBeVisible();
  await page.keyboard.press('Escape'); // com o diálogo aberto: não abre outro nem fecha o editor
  await expect(dialogo(page)).toHaveCount(1);
  await expect(editor(page)).toBeVisible();
  await dialogo(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo(page)).toHaveCount(0);
  await expect(tituloNota(page)).toHaveValue('E2E esc editor');
  await tituloNota(page).press('Escape');
  await expect(dialogo(page)).toContainText('Descartar alterações?');
  await dialogo(page).getByRole('button', { name: 'Descartar' }).click();
  await expect(editor(page)).toHaveCount(0);
  await tick(page);
  await expect.poll(() => marca(page)).toBeNull();
  await expect(page).toHaveURL(/\/registros$/);
});

test('Voltar sobre uma confirmação fecha só a confirmação; o sheet de baixo continua', async ({ page }) => {
  await gotoApp(page, '/__ui');
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  const modal = page.locator('.modal-overlay.is-sheet');
  await expect.poll(() => marca(page)).not.toBeNull();
  await modal.getByRole('button', { name: 'Abrir confirmação' }).click();
  await expect(dialogo(page)).toBeVisible();
  await voltar(page);
  await expect(dialogo(page)).toHaveCount(0);
  await tick(page);
  await expect(modal).toBeVisible();
  await expect.poll(() => marca(page)).not.toBeNull();
  await expect(page).toHaveURL(/\/__ui$/);

  // Cancelar pelo botão também tira só a entrada do diálogo
  await modal.getByRole('button', { name: 'Abrir confirmação' }).click();
  await dialogo(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo(page)).toHaveCount(0);
  await tick(page);
  await expect(modal).toBeVisible();
  await expect.poll(() => marca(page)).not.toBeNull();

  await voltar(page);
  await expect(modal).toHaveCount(0);
  await expect(page).toHaveURL(/\/__ui$/);
  await expect.poll(() => marca(page)).toBeNull();
});

test('Voltar sobre o "Descartar alterações?" do ✕ fecha só o diálogo; o editor continua com entrada', async ({ page }) => {
  await irParaRegistros(page);
  await page.locator('.app-fab').click();
  await tituloNota(page).fill('E2E voltar dialogo');
  await editor(page).locator('.nota-m-topbar').getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(dialogo(page)).toContainText('Descartar alterações?');
  await voltar(page);
  await expect(dialogo(page)).toHaveCount(0);
  await tick(page);
  await expect(editor(page)).toBeVisible();
  await expect(tituloNota(page)).toHaveValue('E2E voltar dialogo');
  await expect.poll(() => marca(page)).not.toBeNull();
  await voltar(page);
  await expect(dialogo(page)).toContainText('Descartar alterações?');
  await dialogo(page).getByRole('button', { name: 'Descartar' }).click();
  await expect(editor(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/registros$/);
});

test('Voltar fecha o painel "Minha conta" e fica na rota', async ({ page }) => {
  await irParaPanorama(page);
  await page.getByRole('button', { name: 'Minha conta' }).click();
  const drawer = page.locator('.drawer-content.open');
  await expect(drawer).toBeVisible();
  await expect.poll(() => marca(page)).not.toBeNull();
  await voltar(page);
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/panorama$/);
  await expect.poll(() => marca(page)).toBeNull();
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('form em tela cheia com picker aninhado: Voltar fecha o picker, depois o form', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.getByRole('button', { name: 'Nova transação' }).click();
  await page.locator('.action-sheet').getByRole('button', { name: 'Pontual' }).click();
  const form = page.locator('.modal-overlay.is-sheet', { has: page.locator('input[name="valor"]') });
  await expect(form).toBeVisible();
  await form.locator('.custom-select-trigger').nth(0).click();
  const lista = page.locator('.cs-sheet-list');
  await expect(lista).toBeVisible();
  await voltar(page);
  await expect(lista).toHaveCount(0);
  await expect(form).toBeVisible();
  await tick(page);
  await expect(form).toBeVisible();
  await voltar(page);
  await expect(form).toHaveCount(0);
  await expect(page).toHaveURL(/\/financas$/);
  await expect.poll(() => marca(page)).toBeNull();
});

test('girar para > 768 com um modal aberto tira a entrada; voltar a 390 recoloca', async ({ page }) => {
  await gotoApp(page, '/__ui');
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  const modal = page.locator('.modal-overlay');
  await expect.poll(() => marca(page)).not.toBeNull();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect.poll(() => marca(page)).toBeNull();
  await expect(modal).toBeVisible();
  await expect(page).toHaveURL(/\/__ui$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => marca(page)).not.toBeNull();
  await voltar(page);
  await expect(modal).toHaveCount(0);
  await expect(page).toHaveURL(/\/__ui$/);
  await expect.poll(() => marca(page)).toBeNull();
});

test('recarregar com um sheet aberto não deixa um Voltar "morto"', async ({ page }) => {
  await irParaPanorama(page);
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await expect.poll(() => marca(page)).not.toBeNull();
  await page.reload();
  await expect(nav(page)).toBeVisible();
  await expect.poll(() => marca(page)).toBeNull();
  await expect(page).toHaveURL(/\/panorama$/);
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});
