import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

const ROUTES = [
  ['home', '/home'], ['panorama', '/panorama'], ['financas', '/financas'],
  ['agenda', '/agenda'], ['registros', '/registros'], ['estudos', '/estudos'], ['ritmo', '/ritmo'], ['cofre', '/cofre'],
];

const NEWS = Array.from({ length: 8 }, (_, i) => ({
  title: `Noticia de exemplo numero ${i + 1} para o feed rapido`,
  url: 'https://example.com/noticia',
  source: { name: 'Fonte Demo' },
  topic: 'tech',
}));

for (const [name, path] of ROUTES) {
  test(`desktop ${name} inalterado`, async ({ page }) => {
    // Feed de noticias vem de fonte externa (muda a cada execucao): fixa a resposta.
    if (name === 'home') await page.route(/\/home\/news(\?.*)?$/, (route) => route.fulfill({ json: NEWS }));
    await gotoApp(page, path);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}

// Modais: cobrem os primitivos de modal/form que serão movidos na Task 3.
const MODALS = [
  ['modal-transacao', '/financas', async (p) => {
    await p.getByRole('button', { name: 'Adicionar' }).first().click();
    await p.locator('.dropdown-menu a', { hasText: 'Pontual' }).click();
  }],
  ['modal-compromisso', '/agenda', async (p) => { await p.getByRole('button', { name: 'Adicionar' }).click(); }],
  ['modal-segredo', '/cofre', async (p) => { await p.getByRole('button', { name: 'Guardar Segredo' }).click(); }],
  ['modal-nota', '/registros', async (p) => { await p.getByRole('button', { name: 'Nota' }).click(); }],
  ['modal-treino', '/ritmo', async (p) => { await p.getByRole('button', { name: 'Novo Treino' }).click(); }],
];

for (const [name, path, open] of MODALS) {
  test(`desktop ${name} inalterado`, async ({ page }) => {
    await gotoApp(page, path);
    await open(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`${name}.png`);
  });
}
