import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';
import { usarFixture } from './panorama-fixture.mjs';

for (const w of [769, 900, 1024]) {
  test(`tablet ${w}px: sem overflow (dados reais)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/panorama');
    expect(await overflowOffenders(page)).toEqual([]);
  });

  test(`tablet ${w}px: sem overflow (payload fixo, 5 alertas)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await usarFixture(page, { insights: 5 });
    await gotoApp(page, '/panorama');
    expect(await overflowOffenders(page)).toEqual([]);
  });
}

test('tablet: grade de 6 colunas; Evolução e Pagamento inteiros, o resto em metades, sem buracos', async ({ page }) => {
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  const grid = page.locator('.pv2-grid');
  expect(await grid.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(6);
  const gb = await grid.boundingBox();
  const gap = await grid.evaluate((e) => parseFloat(getComputedStyle(e).columnGap));
  const box = await page.locator('.pv2-grid > [data-widget]').evaluateAll((els) => Object.fromEntries(els.map((e) => {
    const r = e.getBoundingClientRect();
    return [e.dataset.widget, { y: Math.round(r.y), w: r.width }];
  })));
  for (const k of ['evolucao', 'pagamento']) expect(Math.abs(box[k].w - gb.width)).toBeLessThanOrEqual(1);
  for (const k of ['donut', 'orcamento', 'cofrinhos', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre']) {
    expect(Math.abs(box[k].w - (gb.width - gap) / 2)).toBeLessThanOrEqual(1);
  }
  // dense: Média por dia sobe para o lado de Cofrinhos (o Pagamento, inteiro, iria deixar um buraco)
  expect(box.media.y).toBe(box.cofrinhos.y);
  expect(box.donut.y).toBe(box.orcamento.y);
  expect(box.ritmo.y).toBe(box.produtividade.y);
  expect(box.agenda.y).toBe(box.cofre.y);
});

test('tablet: setas, pontos, dispensar e olho com 44px (toque)', async ({ page }) => {
  await usarFixture(page, { insights: 5 });
  await gotoApp(page, '/panorama');
  await expect(page.locator('.pv2-attn-arrow')).toHaveCount(2); // tablet mantém a paginação do desktop
  expect(await smallTargets(page, '.panorama-scope')).toEqual([]);
  await page.getByRole('button', { name: 'Página 2' }).click();
  await expect(page.locator('.pv2-alert-empty')).toHaveCount(3);
});

test('tablet: legenda do donut visível e jarros numa linha só', async ({ page }) => {
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  await expect(page.locator('.pv2-donut-legend')).toBeVisible();
  const ys = await page.locator('.pv2-goal').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().y)));
  expect(new Set(ys).size).toBe(1);
});

test('tablet (sem hover): Evolução com botões de mês e leitura por toque', async ({ page }) => {
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  const card = page.locator('[data-widget="evolucao"]');
  const meses = card.locator('.pv2-evo-month');
  expect(await meses.count()).toBeGreaterThanOrEqual(6);
  await meses.nth((await meses.count()) - 2).click();
  await expect(card.locator('.pv2-readout')).toHaveText(/Receita.*Despesa.*Caixa/);
  expect((await meses.first().boundingBox()).height).toBeGreaterThanOrEqual(44);
});
