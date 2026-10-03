import { test, expect } from '@playwright/test';
import { gotoApp, smallTargets, animacoesAcabaram } from './helpers.mjs';

async function abrirAdmin(page) {
  await gotoApp(page, '/panorama');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Mais' }).click();
  await page.locator('.more-sheet').getByText('Novo Usuário', { exact: true }).click();
}

// Overlays fixos de tela cheia com fundo escurecido (um sheet = um fundo).
const fundos = (page) => page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => {
  const cs = getComputedStyle(el);
  if (cs.position !== 'fixed') return false;
  // overlays fechados (ex.: o UserDrawer, sempre montado) ficam invisíveis e não contam como fundo
  if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  const cheio = r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1;
  const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
  const alpha = m ? Number(m[1].split(',')[3] ?? 1) : 0;
  return cheio && alpha > 0 && alpha < 1;
}).length);

test('Novo Usuário pelo "Mais" abre um sheet só (sem fundo duplo), ancorado no rodapé', async ({ page }) => {
  await abrirAdmin(page);
  const sheet = page.locator('.modal-overlay.is-sheet');
  await expect(sheet).toHaveCount(1);
  await expect(page.locator('.admin-modal-wrapper')).toHaveCount(0);
  await expect(sheet.locator('h3')).toHaveText('Novo Usuário (Admin)');
  const content = sheet.locator('.modal-content');
  await expect.poll(async () => { const b = await content.boundingBox(); return Math.round(b.y + b.height); }).toBe(844);
  expect(await fundos(page)).toBe(1);
});

test('alvos ≥ 44px, inputs 16px, sem autofoco e atributos de teclado', async ({ page }) => {
  await abrirAdmin(page);
  await animacoesAcabaram(page);
  expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
  const sheet = page.locator('.modal-overlay.is-sheet');
  const fechar = sheet.getByRole('button', { name: 'Fechar' });
  await expect(fechar).toHaveAttribute('aria-label', 'Fechar');
  const email = page.locator('.admin-sheet-form input[type="email"]');
  await expect(email).toHaveAttribute('autocapitalize', 'off');
  await expect(page.locator('.admin-sheet-form input[type="password"]')).toHaveAttribute('autocomplete', 'new-password');
  const tamanhos = await page.locator('.admin-sheet-form input').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(tamanhos).toEqual([16, 16, 16]);
  // toque não abre o teclado sozinho
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
});

test('teclado virtual: "Criar Usuário" fica acima do teclado', async ({ page }) => {
  await page.goto('/panorama'); // garante o documento antes de mexer nas variáveis
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--vvh', '420px');
    document.documentElement.style.setProperty('--kb-inset', '424px');
  });
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Mais' }).click();
  await page.locator('.more-sheet').getByText('Novo Usuário', { exact: true }).click();
  const criar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Criar Usuário' });
  await expect(criar).toBeVisible();
  await animacoesAcabaram(page);
  await expect.poll(async () => { const b = await criar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
});

test('Cancelar e Fechar fecham o sheet', async ({ page }) => {
  await abrirAdmin(page);
  await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Mais' }).click();
  await page.locator('.more-sheet').getByText('Novo Usuário', { exact: true }).click();
  await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
});
