import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test.beforeEach(async ({ page }) => { await gotoApp(page, '/__ui'); });

test('modal existente vira bottom sheet ancorado no rodapé', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  const overlay = page.locator('.modal-overlay.is-sheet');
  await expect(overlay).toBeVisible();
  const content = page.locator('.modal-overlay.is-sheet > .modal-content');
  // a animação sheetUp (0.28s) desloca o sheet 24px no início: espera assentar no rodapé
  await expect.poll(async () => { const b = await content.boundingBox(); return Math.round(b.y + b.height); }).toBe(844);
  expect(Math.round((await content.boundingBox()).width)).toBe(390);
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeInViewport();
});

test('rodapé visível com viewport baixa (teclado aberto)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeInViewport();
  await page.locator('.modal-overlay.is-sheet .modal-body').evaluate((b) => b.scrollTo(0, 99999));
  await expect(page.getByText('Fim do conteúdo')).toBeInViewport();
});

test('scroll lock aninhado: fechar o de cima mantém a trava', async ({ page }) => {
  await page.evaluate(() => window.scrollTo(0, 300));
  // dispatchEvent: um click() normal rolaria o botão (fora da tela) de volta ao topo antes de abrir o modal
  await page.getByRole('button', { name: 'Abrir modal longo' }).dispatchEvent('click');
  await page.getByRole('button', { name: 'Abrir sheet aninhado' }).click();
  const aninhado = page.locator('.app-sheet-overlay');
  await expect(aninhado).toBeVisible();
  await aninhado.getByRole('button', { name: 'Fechar' }).click();
  await expect(aninhado).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
  await page.getByRole('button', { name: 'Fechar' }).first().click();
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(300);
});

test('modal com <form> (body+footer dentro do form): rodapé fixo e corpo rola', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir modal com form' }).click();
  await expect(page.getByRole('button', { name: 'Salvar form' })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 420 });
  await expect(page.getByRole('button', { name: 'Salvar form' })).toBeInViewport();
  await page.locator('.modal-overlay.is-sheet .modal-body').evaluate((b) => b.scrollTo(0, 99999));
  await expect(page.getByText('Fim do form')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Salvar form' })).toBeInViewport();
});

test('modal real (Cofre, Guardar Segredo) com viewport baixa: rodapé visível', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await page.setViewportSize({ width: 390, height: 420 });
  await page.getByRole('button', { name: 'Guardar Segredo' }).click();
  const overlay = page.locator('.modal-overlay.is-sheet');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole('button', { name: 'Salvar' })).toBeInViewport();
});

test('resize com modal aberto troca sheet ↔ modal sem fechar', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.modal-overlay')).toBeVisible();
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.modal-overlay.is-sheet')).toBeVisible();
});

test('action sheet executa a ação e fecha', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir ações' }).click();
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.locator('.action-sheet')).toHaveCount(0);
  await expect(page.getByTestId('ultima-acao')).toHaveText('editar');
});

test('sheet full ocupa a tela inteira', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir sheet cheio' }).click();
  const box = await page.locator('.modal-overlay.is-sheet-full > .modal-content').boundingBox();
  expect(Math.round(box.height)).toBe(844);
});

test('fab tem 56px e fica acima da área da barra inferior', async ({ page }) => {
  const box = await page.locator('.app-fab').boundingBox();
  expect(Math.round(box.width)).toBe(56);
  expect(box.y + box.height).toBeLessThanOrEqual(844 - 64);
});

test('teclado virtual (--vvh): rodapé fica na área visível com layout de 844', async ({ page }) => {
  // simula teclado de 424px: a área visível tem 420px e o layout segue com 844
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--vvh', '420px');
    document.documentElement.style.setProperty('--kb-inset', '424px');
  });
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  const salvar = page.getByRole('button', { name: 'Salvar' });
  await expect(salvar).toBeVisible();
  await expect.poll(async () => { const b = await salvar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
  const content = page.locator('.modal-overlay.is-sheet > .modal-content');
  expect((await content.boundingBox()).height).toBeLessThanOrEqual(413);
});

test('action sheet: nome acessível e linha Cancelar que só fecha', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir ações' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-label', /.+/);
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('.action-sheet')).toHaveCount(0);
  await expect(page.getByTestId('ultima-acao')).not.toHaveText('editar');
});