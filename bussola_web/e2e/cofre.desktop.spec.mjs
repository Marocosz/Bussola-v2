import { test, expect } from '@playwright/test';
import { gotoApp, animacoesAcabaram, apiJson } from './helpers.mjs';

// Condição de "pronto" determinística: fontes carregadas, página no topo e geometria estável
// em amostras consecutivas (sidebar, conteúdo, tabela e altura do documento).
async function layoutEstavel(page) {
  await page.evaluate(() => document.fonts.ready);
  const amostra = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; };
    res(JSON.stringify({ y: window.scrollY, h: document.documentElement.scrollHeight, sb: r('.sidebar'), c: r('.app-content'), t: r('.data-table'), m: r('.modal-content') }));
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

// Modais do Cofre que este plano toca. Base gerada ANTES de mexer no código.
const MODAIS = [
  ['cofre-editar', async (p) => {
    await p.locator('.btn-edit-segredo').first().click();
    await p.locator('.locked-input-wrapper').waitFor();
  }],
  ['cofre-ver-segredo', async (p) => {
    await p.locator('.btn-view-secret').first().click();
    await p.getByRole('button', { name: 'Visualizar', exact: true }).click();
    await p.locator('.secret-display-box').waitFor();
  }],
  ['cofre-notas', async (p) => {
    await p.locator('.notes-preview').first().click();
    await p.locator('.notes-full-view').waitFor();
  }],
];

for (const [nome, abrir] of MODAIS) {
  test(`desktop cofre: ${nome} inalterado`, async ({ page }) => {
    await gotoApp(page, '/cofre');
    await abrir(page);
    await animacoesAcabaram(page);
    await layoutEstavel(page);
    await expect(page).toHaveScreenshot(`${nome}.png`);
  });
}

test('desktop cofre: linha da tabela destaca no hover', async ({ page }) => {
  await gotoApp(page, '/cofre');
  const row = page.locator('.data-table tbody tr').first();
  const bg = () => row.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await bg()).toBe('rgba(0, 0, 0, 0)');
  await row.hover();
  await expect.poll(bg).not.toBe('rgba(0, 0, 0, 0)');
});

// Mouse entre 1025 e 1279: Editar/Excluir não podem ficar cortados pelo cartão (overflow hidden).
for (const w of [1025, 1100, 1179, 1279]) {
  test(`desktop cofre ${w}px: ações da tabela dentro do cartão`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await gotoApp(page, '/cofre');
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
    const m = await page.locator('.data-table').first().evaluate((t) => {
      const c = t.parentElement.getBoundingClientRect();
      const b = t.querySelector('tbody tr:first-child .btn-delete').getBoundingClientRect();
      return { cartaoDireita: c.right, botaoDireita: b.right };
    });
    expect(m.botaoDireita).toBeLessThanOrEqual(m.cartaoDireita);
  });
}

test('desktop cofre: nada do layout mobile aparece', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await expect(page.locator('.data-table')).toBeVisible();
  await expect(page.locator('.section-header-flex')).toBeVisible();
  await expect(page.locator('.cofre-m')).toHaveCount(0);
  await expect(page.locator('.app-fab')).toHaveCount(0);
});

// Regressão: 'AAAA-MM-DD' era lido como meia-noite UTC e aparecia um dia antes no Brasil.
test('desktop cofre: data de expiração mostra o dia gravado', async ({ page, request }) => {
  const criado = await apiJson(request, 'POST', '/cofre/', { titulo: 'E2E Data certa', valor: 'E2E-x', data_expiracao: '2026-12-25' });
  try {
    await gotoApp(page, '/cofre');
    const linha = page.locator('.data-table tbody tr', { hasText: 'E2E Data certa' });
    await expect(linha).toContainText('25/12/2026');
  } finally {
    await apiJson(request, 'DELETE', `/cofre/${criado.id}`);
  }
});
