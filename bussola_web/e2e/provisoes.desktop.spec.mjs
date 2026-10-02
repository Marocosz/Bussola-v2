import { test, expect } from '@playwright/test';
import { gotoApp, apiJson } from './helpers.mjs';

// Modais da página que os refactors deste plano tocam. Base gerada ANTES de mexer no código.
const MODAIS = [
  ['metas-modal', async (p) => {
    await p.locator('.metas-entry:not(.cat-entry)').click();
    await p.locator('.metas-modal').waitFor();
    await p.locator('.metas-grid, .metas-empty').first().waitFor();
  }],
  ['categorias-modal', async (p) => {
    await p.locator('.cat-entry').click();
    await p.locator('.categorias-modal').waitFor();
  }],
  ['categoria-form', async (p) => {
    await p.locator('.cat-entry').click();
    await p.getByRole('button', { name: 'Nova Categoria' }).click();
    await p.locator('input[name="nome"]').waitFor();
  }],
  ['caixa-modal', async (p) => {
    await p.locator('.ph-kpi-btn').click();
    await p.locator('.caixa-empty, .caixa-item').first().waitFor();
  }],
];

for (const [nome, abrir] of MODAIS) {
  test(`desktop provisões: ${nome} inalterado`, async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrir(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`${nome}.png`);
  });
}

test('desktop provisões: ações da linha só aparecem no hover', async ({ page }) => {
  await gotoApp(page, '/financas');
  const row = page.locator('.transacao-row').first();
  const opacity = () => row.locator('.row-actions').evaluate((e) => getComputedStyle(e).opacity);
  expect(await opacity()).toBe('0');
  await row.hover();
  await expect.poll(opacity).toBe('1');
});

test('desktop provisões: modal de transação mantém overflow visível (popovers não cortam)', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.getByRole('button', { name: 'Adicionar' }).first().click();
  await page.locator('.dropdown-menu a', { hasText: 'Pontual' }).click();
  expect(await page.locator('.modal-content').evaluate((e) => getComputedStyle(e).overflow)).toBe('visible');
});

test('desktop provisões: nada do layout mobile aparece', async ({ page }) => {
  await gotoApp(page, '/financas');
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.layout-grid-custom')).toBeVisible();
  await expect(page.locator('.m-prov')).toHaveCount(0);
  await expect(page.locator('.app-fab')).toHaveCount(0);
});

// Baselines adicionadas na revisão final (antes de mexer no código dos modais/linhas expandidas).
test('desktop provisões: MetasModal cofre e histórico inalterados', async ({ page, playwright }) => {
  const r = await playwright.request.newContext();
  const meta = await apiJson(r, 'POST', '/financas/metas', { nome: 'E2E Base desktop', valor_alvo: 1000, icone: 'fa-solid fa-piggy-bank', cor: '#4A6DFF' });
  try {
    await apiJson(r, 'POST', `/financas/metas/${meta.id}/movimentacoes`, { tipo: 'aporte', valor: 200, data: '2026-10-02T12:00:00-03:00' });
    await gotoApp(page, '/financas');
    await page.locator('.metas-entry:not(.cat-entry)').click();
    await page.locator('.metas-modal').waitFor();
    await page.locator('.meta-card').filter({ hasText: 'E2E Base desktop' }).getByRole('button', { name: 'Guardar' }).click();
    await page.locator('.cofre-body').waitFor();
    await page.waitForTimeout(600);
    await expect(page.locator('.metas-modal')).toHaveScreenshot('metas-cofre.png');
    await page.getByRole('button', { name: /Ver movimentações/ }).click();
    await page.locator('.meta-timeline li').first().waitFor();
    await page.waitForTimeout(400);
    await expect(page.locator('.metas-modal')).toHaveScreenshot('metas-historico.png');
  } finally {
    for (const mv of await apiJson(r, 'GET', `/financas/metas/${meta.id}/movimentacoes`)) {
      await apiJson(r, 'DELETE', `/financas/metas/${meta.id}/movimentacoes/${mv.id}`);
    }
    await apiJson(r, 'DELETE', `/financas/metas/${meta.id}`);
    await r.dispose();
  }
});

test('desktop provisões: parcelas expandidas inalteradas', async ({ page }) => {
  await gotoApp(page, '/financas');
  const wrapper = page.locator('.transacao-row-wrapper')
    .filter({ hasText: /Macbook Air|Viagem Férias/ })
    .filter({ has: page.locator('.btn-expand-parcelas') })
    .first();
  await wrapper.locator('.transacao-row').hover(); // as ações só aparecem no hover (desktop)
  await wrapper.locator('.btn-expand-parcelas').click();
  await wrapper.locator('.parcela-sub-row').first().waitFor();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  await expect(wrapper).toHaveScreenshot('parcelas-expandidas.png');
});

