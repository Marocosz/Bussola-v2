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

// ---------------------------------------------------------------------------
// Leitura: barra fixa, índice, progresso e fim do material
// ---------------------------------------------------------------------------
test('desktop leitura: índice lateral lista seção, perguntas e fontes e leva ao item', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos/9101');
  const indice = page.locator('.estudo-lateral .estudo-indice');
  await expect(indice).toBeVisible();
  await expect(indice.locator('.estudo-indice-texto')).toHaveText([
    'Formatação inline', 'Qual índice atende BETWEEN?', 'Por que índices deixam escritas mais lentas?', 'Fontes',
  ]);
  await expect(page.locator('.estudo-btn-indice')).toBeHidden();
  await indice.getByRole('link', { name: /Qual índice atende BETWEEN/ }).click();
  await expect(indice.locator('.estudo-indice-item.ativo')).toHaveText(/Qual índice atende BETWEEN/);
  await expect(page.locator('#bloco-b12')).toBeInViewport();
});

test('desktop leitura: barra fica fixa, mostra o título e volta ao topo', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos/9101');
  const barra = page.locator('.estudo-barra');
  await expect(barra).not.toHaveClass(/compacto/);
  await page.mouse.wheel(0, 1500);
  await expect(barra).toHaveClass(/compacto/);
  await expect.poll(async () => Math.round((await barra.boundingBox()).y)).toBe(12);
  await expect(barra.locator('.estudo-barra-titulo')).toBeVisible();
  await expect.poll(() => barra.evaluate((e) => Number(getComputedStyle(e).getPropertyValue('--progresso')))).toBeGreaterThan(0);
  await barra.getByRole('button', { name: 'Voltar ao topo' }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('desktop leitura: progresso das perguntas vem do servidor e soma o que é respondido', async ({ page }) => {
  await mockEstudos(page, { respostas: [{ bloco_id: 'b13', acertou: false, respondido_em: '2026-10-01T10:00:00' }] });
  await gotoApp(page, '/estudos/9101');
  const indice = page.locator('.estudo-lateral .estudo-indice');
  await expect(indice.locator('.estudo-indice-resumo')).toHaveText(/1\/2 respondidas · 0 acertos/);
  await expect(indice.locator('.estudo-indice-status.erro')).toHaveCount(1);
  await page.locator('.bloco-quiz-opcao', { hasText: 'B-tree' }).click();
  await expect(indice.locator('.estudo-indice-resumo')).toHaveText(/2\/2 respondidas · 1 acerto/);
  await expect(indice.locator('.estudo-indice-status.acerto')).toHaveCount(1);
});

test('desktop leitura: fim do material marca estudado e leva ao próximo do tema', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos/9101');
  const fim = page.locator('.estudo-fim');
  await fim.getByRole('button', { name: 'Marcar como estudado' }).click();
  await expect(fim.locator('.estudo-fim-status')).toHaveText(/Material estudado/);
  await expect(page.locator('.estudo-btn-estudado')).toHaveText(/Estudado/);
  await expect(fim.locator('.estudo-vizinho.anterior')).toHaveCount(0);
  await fim.locator('.estudo-vizinho.proximo').click();
  await expect(page).toHaveURL(/\/estudos\/9102$/);
  await expect(page.locator('.estudo-cabecalho h1')).toHaveText('Resumo: normalização');
  await expect(page.locator('.estudo-vizinho.anterior')).toHaveText(/Índices B-tree/);
});
