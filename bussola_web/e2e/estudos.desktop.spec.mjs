import { test, expect } from '@playwright/test';
import { gotoApp, animacoesAcabaram } from './helpers.mjs';
import { mockEstudos } from './fixtures/estudos.mjs';

// Condição de "pronto": fontes carregadas, página no topo e geometria estável em amostras consecutivas.
async function layoutEstavel(page) {
  await page.evaluate(() => document.fonts.ready);
  const amostra = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; };
    res(JSON.stringify({ y: window.scrollY, h: document.documentElement.scrollHeight, sb: r('.sidebar'), c: r('.app-content'), q: r('.bloco-quiz') }));
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

// Base gerada ANTES de mexer no código, com dados interceptados (o banco demo não tem materiais).
const PAGINAS = [
  ['estudos-biblioteca', '/estudos', '.estudo-card'],
  ['estudos-kit', '/estudos/kit', '.kit-card'],
  ['estudos-leitura', '/estudos/9101', '.bloco-quiz'],
];

for (const [nome, rota, pronto] of PAGINAS) {
  test(`desktop ${nome} inalterado`, async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, rota);
    await page.locator(pronto).first().waitFor();
    await animacoesAcabaram(page);
    await layoutEstavel(page);
    await expect(page).toHaveScreenshot(`${nome}.png`, { fullPage: true });
  });
}

test('desktop estudos: "Pedir ao Claude" abre o popover (não um sheet)', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos/9101');
  await page.locator('.estudo-acoes .pedir-claude-gatilho').click();
  await expect(page.locator('.pedir-claude-menu')).toBeVisible();
  await expect(page.locator('.app-sheet')).toHaveCount(0);
});

test('desktop estudos: ações do bloco aparecem no hover', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos/9101');
  const bloco = page.locator('#bloco-b3');
  const opacity = () => bloco.locator('.estudo-bloco-acoes').evaluate((e) => getComputedStyle(e).opacity);
  expect(await opacity()).toBe('0');
  await bloco.hover();
  await expect.poll(opacity).toBe('1');
});

test('desktop estudos: tema selecionado continua destacado sob o mouse no menu', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos?tema=901');
  await page.locator('.estudos-barra .custom-dropdown-wrapper .dropdown-trigger-btn').click();
  const ativo = page.locator('.custom-dropdown-menu .dropdown-item.selected');
  const outro = page.locator('.custom-dropdown-menu .dropdown-item:not(.selected)').first();
  const fundo = (loc) => loc.evaluate((e) => getComputedStyle(e).backgroundColor);
  await page.mouse.move(0, 0);
  await expect(ativo).toHaveText(/Banco de Dados/);
  const ativoParado = await fundo(ativo);
  // Prova de que o teste enxerga o hover: um item comum muda de cor sob o mouse.
  const outroParado = await fundo(outro);
  await outro.hover();
  await expect.poll(() => fundo(outro)).not.toBe(outroParado);
  const hoverComum = await fundo(outro);
  expect(hoverComum).not.toBe(ativoParado);
  // O selecionado não troca a cor de destaque pela de hover e mantém o peso.
  await ativo.hover();
  await expect(ativo).toHaveCSS('background-color', ativoParado);
  await expect(ativo).toHaveCSS('font-weight', '600');
});

test('desktop estudos: materiais agrupados por tema e grupo recolhe', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos');
  const titulos = page.locator('.group-accordion .header-title-wrapper');
  await expect(titulos).toHaveText(['Banco de Dados', 'Redes de Computadores e Protocolos da Internet', 'Matemática', 'Sem tema']);
  const grupo = page.locator('.group-accordion').first();
  await expect(grupo.locator('.accordion-wrapper')).toHaveClass(/open/);
  await grupo.locator('.accordion-header').click();
  await expect(grupo.locator('.accordion-wrapper')).not.toHaveClass(/open/);
});

test('desktop estudos: sem topbar mobile nem botão Voltar', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos/kit');
  await expect(page.locator('.m-topbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Voltar' })).toHaveCount(0);
});
