import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test('Financas: CustomSelect e DatePicker dentro do modal nao fecham o modal pai', async ({ page }) => {
  await gotoApp(page, '/financas');
  // na barra do mobile o botão pode ficar cortado: dispatchEvent dispara o clique sem depender de scroll
  await page.getByRole('button', { name: 'Adicionar' }).first().dispatchEvent('click');
  await page.locator('.dropdown-menu a', { hasText: 'Pontual' }).dispatchEvent('click');
  const modal = page.locator('.modal-overlay.is-sheet').first();
  await expect(modal).toBeVisible();

  const wrapper = modal.locator('.custom-select-wrapper', { hasText: 'Categoria' }).first();
  await wrapper.locator('.custom-select-trigger').click();
  const sheet = page.locator('.app-sheet');
  await expect(sheet).toBeVisible();
  const opt = sheet.locator('.custom-option').first();
  const label = (await opt.locator('.cs-opt-label').innerText()).trim();
  await opt.click();
  await expect(sheet).toHaveCount(0);
  await expect(modal).toBeVisible();
  await expect(wrapper.locator('.custom-select-trigger')).toContainText(label);

  await modal.locator('.pk-trigger').first().click();
  const panel = page.locator('.pk-date-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Hoje' }).click();
  await expect(panel).toHaveCount(0);
  await expect(modal).toBeVisible();
});

test('Ritmo: sheet do CustomSelect (portal) nao herda .ritmo-scope', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  await page.getByRole('button', { name: 'Novo Treino' }).click();
  const modal = page.locator('.modal-overlay.is-sheet').first();
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: '+ Add Exercício' }).click();
  await modal.locator('.custom-select-wrapper', { hasText: 'Grupo' }).locator('.custom-select-trigger').click();
  const sheet = page.locator('.app-sheet');
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate((el) => !!el.closest('.ritmo-scope'))).toBe(false);
  await expect(modal).toBeVisible();
});
