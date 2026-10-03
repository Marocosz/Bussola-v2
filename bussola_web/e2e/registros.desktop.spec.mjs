import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { comApi, limparRegistrosE2E, criarTarefa, tarefaPorTitulo } from './registros-data.mjs';

test.beforeAll(async ({ playwright }) => comApi(playwright, limparRegistrosE2E));
test.afterAll(async ({ playwright }) => comApi(playwright, limparRegistrosE2E));

const aba = (page, nome) => page.locator('.tab-btn-pill', { hasText: nome }).click();

// Garante um acordeão aberto (o estado vem do localStorage; o padrão só abre "Fixados").
async function abrirAlgumAcordeao(page) {
  if (await page.locator('.accordion-wrapper.open .anotacao-card').count()) return;
  await page.locator('.accordion-header:not(.active)').first().click();
  await page.locator('.accordion-wrapper.open .anotacao-card').first().waitFor();
  await page.waitForTimeout(400);
}

// Condição de "pronto" determinística para capturas fullPage: fontes carregadas, página no topo
// (a captura posiciona sidebar/Fab fixos pelo scroll corrente) e geometria estável em amostras
// consecutivas (sidebar, conteúdo, quadro e altura do documento).
async function layoutEstavel(page) {
  await page.evaluate(() => document.fonts.ready);
  const amostra = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; };
    res(JSON.stringify({ y: window.scrollY, h: document.documentElement.scrollHeight, sb: r('.sidebar'), c: r('.app-content'), kb: r('.kb-board') }));
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

// Telas e modais que este plano toca. Base gerada ANTES de qualquer mudança de código.
const TELAS = [
  ['registros-tarefas', async (p) => { await aba(p, 'Tarefas'); await p.locator('.kb-board').waitFor(); }, { fullPage: true }],
  ['registros-jornada', async (p) => { await aba(p, 'Jornada'); await p.locator('.jk-kanban').waitFor(); }, { fullPage: true, mask: ['.jk-streak'] }],
  ['registros-dropdown-grupos', async (p) => {
    await p.locator('.dropdown-trigger-btn').click();
    await p.locator('.custom-dropdown-menu').waitFor();
  }, {}],
  ['modal-grupo', async (p) => {
    await p.locator('.dropdown-trigger-btn').click();
    await p.locator('.dropdown-action-row').click();
    await p.locator('.compact-modal').waitFor();
  }, {}],
  ['modal-ver-nota', async (p) => {
    await abrirAlgumAcordeao(p);
    await p.locator('.accordion-wrapper.open .anotacao-card').first().click();
    await p.locator('.view-modal').waitFor();
  }, {}],
  ['modal-tarefa', async (p) => {
    await aba(p, 'Tarefas');
    await p.locator('.kb-card').first().click();
    await p.getByRole('heading', { name: 'Editar Tarefa' }).waitFor();
  }, {}],
  ['modal-tarefa-nova', async (p) => {
    await aba(p, 'Tarefas');
    await p.getByRole('button', { name: 'Tarefa', exact: true }).click();
    await p.getByRole('heading', { name: 'Nova Tarefa' }).waitFor();
  }, {}],
  ['modal-habito', async (p) => {
    await aba(p, 'Jornada');
    await p.getByRole('button', { name: 'Hábito', exact: true }).click();
    await p.locator('.habito-modal-content').waitFor();
  }, {}],
  ['modal-habito-lista', async (p) => {
    await aba(p, 'Jornada');
    await p.getByRole('button', { name: 'Lista', exact: true }).click();
    await p.locator('.hl-modal-content').waitFor();
  }, {}],
];

for (const [nome, abrir, opts] of TELAS) {
  test(`desktop registros: ${nome} inalterado`, async ({ page }) => {
    await gotoApp(page, '/registros');
    await abrir(page);
    await page.waitForTimeout(400);
    await layoutEstavel(page);
    const { mask = [], ...resto } = opts;
    await expect(page).toHaveScreenshot(`${nome}.png`, { ...resto, mask: mask.map((s) => page.locator(s)) });
  });
}

test('desktop: cabeçalho com abas, sem segmentado nem Fab', async ({ page }) => {
  await gotoApp(page, '/registros');
  await expect(page.locator('.registros-main-header')).toBeVisible();
  await expect(page.locator('.m-segmented')).toHaveCount(0);
  await expect(page.locator('.app-fab')).toHaveCount(0);
});

test('desktop: ações do card de nota só no hover e sem "⋯"', async ({ page }) => {
  await gotoApp(page, '/registros');
  await abrirAlgumAcordeao(page);
  const card = page.locator('.accordion-wrapper.open .anotacao-card').first();
  await page.mouse.move(2, 2);
  await expect(card.locator('.anotacao-actions')).toHaveCSS('opacity', '0');
  await card.hover();
  await expect(card.locator('.anotacao-actions')).toHaveCSS('opacity', '1');
  await expect(card.locator('.reg-card-more')).toHaveCount(0);
});

test('desktop: arrastar um card com o mouse muda a coluna', async ({ page, request }) => {
  await criarTarefa(request, { titulo: 'E2E arrastar', status: 'Em andamento' });
  try {
    await gotoApp(page, '/registros');
    await aba(page, 'Tarefas');
    const card = page.locator('.kb-card', { hasText: 'E2E arrastar' });
    const alvo = page.locator('.kb-column', { has: page.locator('.kb-column-label', { hasText: 'Bloqueado' }) }).locator('.kb-column-body');
    const a = await card.boundingBox();
    const b = await alvo.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 5 });
    await page.mouse.move(b.x + b.width / 2, b.y + 30, { steps: 15 });
    await page.mouse.up();
    const colBloqueado = page.locator('.kb-column', { has: page.locator('.kb-column-label', { hasText: 'Bloqueado' }) });
    await expect(colBloqueado.locator('.kb-card', { hasText: 'E2E arrastar' })).toHaveCount(1);
    // E persiste (PATCH /tarefas/reordenar): o status gravado é o da coluna de destino.
    await expect.poll(async () => (await tarefaPorTitulo(request, 'E2E arrastar'))?.status).toBe('Bloqueado');
  } finally {
    await limparRegistrosE2E(request);
  }
});
