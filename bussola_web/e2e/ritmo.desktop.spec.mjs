import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

// Busca de alimentos fixa: a tabela TACO local pode não existir no banco demo.
const FOODS = [
  { nome: 'Arroz, tipo 1, cozido', calorias_100g: 128, proteina_100g: 2.5, carbo_100g: 28.1, gordura_100g: 0.2 },
  { nome: 'Arroz, integral, cozido', calorias_100g: 124, proteina_100g: 2.6, carbo_100g: 25.8, gordura_100g: 1 },
];

// Seletores estáveis ao longo do plano (as abas viram role="tab" na Task 3).
const abaDieta = (p) => p.locator('.tab-btn-pill', { hasText: 'Plano de Dieta' }).click();
// Botões com `title`: dispatchEvent não passa o mouse por cima (sem balão do TooltipHost no screenshot).
const editarPlano = (p, nome) => p.locator('.plan-mini-card', { hasText: nome }).locator('button[title="Editar"]').dispatchEvent('click');

// Fontes prontas, scroll no topo e duas amostras de geometria iguais antes do screenshot.
async function layoutEstavel(page) {
  await page.evaluate(() => document.fonts.ready);
  const amostra = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; };
    res(JSON.stringify({ y: window.scrollY, h: document.documentElement.scrollHeight, sb: r('.sidebar'), c: r('.app-content'), m: r('.modal-content'), d: r('.search-results-dropdown') }));
  }))));
  await page.evaluate(() => window.scrollTo(0, 0));
  let anterior = '';
  await expect.poll(async () => {
    const atual = await amostra();
    const estavel = atual === anterior && JSON.parse(atual).y === 0;
    anterior = atual;
    return estavel;
  }, { timeout: 10_000, intervals: [100] }).toBe(true);
}

// Estados que os refactors deste plano tocam. Base gerada ANTES de mexer no código.
const CASOS = [
  ['ritmo-dieta', async (p) => {
    await abaDieta(p);
    await p.locator('.refeicao-card-pro').first().waitFor();
  }, { fullPage: true }],
  ['modal-treino-editar', async (p) => {
    await editarPlano(p, 'Hipertrofia ABC 2025');
    await p.locator('.modal-content .day-block').first().waitFor();
  }],
  ['modal-dieta-editar', async (p) => {
    await abaDieta(p);
    await editarPlano(p, 'Bulking Limpo');
    await p.locator('.modal-content .day-block').first().waitFor();
  }],
  ['modal-dieta-busca', async (p) => {
    await p.route('**/ritmo/local/foods**', (r) => r.fulfill({ json: FOODS }));
    await abaDieta(p);
    await p.getByRole('button', { name: 'Nova Dieta' }).click();
    await p.getByRole('button', { name: '+ Add Alimento' }).click();
    await p.locator('.modal-content input[autocomplete="off"]').first().fill('arroz');
    await expect(p.locator('.search-results-dropdown')).toContainText('Arroz, tipo 1, cozido');
  }],
  ['modal-bio', async (p) => {
    await p.getByRole('button', { name: 'Ajustar Perfil' }).click();
    await p.locator('.bio-modal-grid').waitFor();
  }],
];

for (const [nome, abrir, opts] of CASOS) {
  test(`desktop ritmo: ${nome} inalterado`, async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await abrir(page);
    await page.waitForTimeout(400);
    await layoutEstavel(page);
    await expect(page).toHaveScreenshot(`${nome}.png`, opts);
  });
}

test('desktop ritmo: nada do layout mobile aparece', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  await expect(page.locator('.ritmo-scope .page-header')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo Treino' })).toBeVisible();
  await expect(page.locator('.app-fab')).toHaveCount(0);
  expect(await page.locator('.bio-stat-strip').evaluate((e) => getComputedStyle(e).display)).toBe('flex');
  expect(await page.locator('.bio-panels-row').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
});
