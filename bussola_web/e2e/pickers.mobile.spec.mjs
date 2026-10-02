import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test.beforeEach(async ({ page }) => { await gotoApp(page, '/__ui'); });

// a animação sheetUp desloca o painel no início: espera assentar no rodapé
const sheetBottom = (loc) => expect.poll(async () => { const b = await loc.boundingBox(); return Math.round(b.y + b.height); });

test('DatePicker abre como sheet de largura total e seleciona', async ({ page }) => {
  await page.getByText('Data', { exact: true }).locator('..').locator('.pk-trigger').click();
  const panel = page.locator('.pk-date-panel');
  await expect(panel).toHaveClass(/pk-panel--sheet/);
  expect(Math.round((await panel.boundingBox()).width)).toBe(390);
  await sheetBottom(panel).toBe(844);
  await panel.getByRole('button', { name: 'Hoje' }).click();
  await expect(page.getByTestId('valores')).toHaveText(/^2026-10-02\|/);
});

test('TimePicker abre como sheet', async ({ page }) => {
  await page.getByText('Hora', { exact: true }).locator('..').locator('.pk-trigger').click();
  const panel = page.locator('.pk-panel.pk-panel--sheet');
  await expect(panel).toBeVisible();
  await sheetBottom(panel).toBe(844);
});

test('CustomSelect lista opções em sheet e seleciona', async ({ page }) => {
  await page.locator('.custom-select-trigger').click();
  await expect(page.locator('.modal-overlay.is-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Casa' }).click();
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  await expect(page.getByTestId('valores')).toHaveText(/\|2\|/);
});

test('DateRangeFilter abre presets em sheet', async ({ page }) => {
  await page.locator('.drf-trigger').click();
  await expect(page.locator('.modal-overlay.is-sheet')).toBeVisible();
  await expect(page.locator('.drf-menu')).toHaveCount(0);
});
