import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

// Camadas (modal, sheet, confirmação, picker): ESC fecha só a de cima; foco entra no diálogo ao
// abrir (nunca num campo no toque) e volta para quem abriu ao fechar. Mesmo roteiro no desktop e no celular.
const modal = (page) => page.locator('.modal-overlay:not(.app-sheet-overlay)', { has: page.locator('h3', { hasText: 'Modal longo' }) });
const aninhado = (page) => page.locator('.app-sheet-overlay');
const dialogo = (page) => page.locator('.confirm-modal');
const picker = (page) => page.locator('.pk-date-panel');
const abrir = (page) => page.getByRole('button', { name: 'Abrir modal longo' });

export function registrarTestesDeCamadas(projeto) {
  test.beforeEach(async ({ page }) => { await gotoApp(page, '/__ui'); });

  test(`${projeto}: ESC com sheet aninhado fecha só o sheet`, async ({ page }) => {
    await abrir(page).click();
    await modal(page).getByRole('button', { name: 'Abrir sheet aninhado' }).click();
    await expect(aninhado(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(aninhado(page)).toHaveCount(0);
    await expect(modal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);
  });

  test(`${projeto}: ESC com confirmação aberta cancela só a confirmação`, async ({ page }) => {
    await abrir(page).click();
    await modal(page).getByRole('button', { name: 'Abrir confirmação' }).click();
    await expect(dialogo(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo(page)).toHaveCount(0);
    await expect(modal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);
  });

  test(`${projeto}: ESC com picker aberto dentro do modal fecha só o picker`, async ({ page }) => {
    await abrir(page).click();
    const gatilho = modal(page).getByText('Data no modal', { exact: true }).locator('..').locator('.pk-trigger');
    // Rola até o campo ANTES do clique: o evento de scroll chega no quadro seguinte e o picker do
    // desktop fecha em qualquer rolagem (fecharia logo depois de abrir).
    await gatilho.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await gatilho.click();
    await expect(picker(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(picker(page)).toHaveCount(0);
    await expect(modal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);
  });

  test(`${projeto}: foco entra no modal ao abrir (sem campo de texto) e volta ao botão ao fechar`, async ({ page }) => {
    await abrir(page).click();
    await expect(modal(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const a = document.activeElement;
      return Boolean(a && a.closest('.modal-overlay')) && !a.matches('input, textarea, select, [contenteditable="true"]');
    })).toBe(true);
    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);
    await expect(abrir(page)).toBeFocused();
  });

  test(`${projeto}: foco do sheet aninhado volta ao botão dentro do modal`, async ({ page }) => {
    await abrir(page).click();
    const botao = modal(page).getByRole('button', { name: 'Abrir sheet aninhado' });
    await botao.click();
    await expect(aninhado(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('.app-sheet-overlay')))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(aninhado(page)).toHaveCount(0);
    await expect(botao).toBeFocused();
  });
}
