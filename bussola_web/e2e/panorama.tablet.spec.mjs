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
  const n = await meses.count();
  const leitura = card.locator('.pv2-readout');
  await expect(leitura).toHaveText(/out\/26.*Receita\s*R\$\s8\.400/); // padrão: mês atual
  const alvo = meses.nth(n - 2);
  const nome = (await alvo.textContent()).trim();
  await alvo.click();
  await expect(alvo).toHaveAttribute('aria-pressed', 'true');
  await expect(meses.last()).toHaveAttribute('aria-pressed', 'false');
  await expect(leitura).toHaveText(new RegExp(`^${nome}.*Receita.*Despesa.*Caixa`));
  await expect(leitura).not.toHaveText(/out\/26/);
  expect((await meses.first().boundingBox()).height).toBeGreaterThanOrEqual(44);
  // geometria do desktop (sem texto no SVG); botões alinhados às colunas (12 colunas em 582/640 da largura)
  await expect(card.locator('svg text')).toHaveCount(0);
  const svg = await card.locator('svg').boundingBox();
  const b = await meses.first().boundingBox();
  expect(Math.abs(b.width - (svg.width * 582 / 640) / n)).toBeLessThanOrEqual(1);
  expect(Math.abs(b.x - (svg.x + svg.width * 42 / 640))).toBeLessThanOrEqual(1);
  // proporção do desenho do desktop (640x210), não o compacto ampliado
  expect(Math.abs(svg.width / svg.height - 640 / 210)).toBeLessThan(0.05);
});

test('tablet (sem hover): Média por dia com leitura e ‹ › (valor muda)', async ({ page }) => {
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  const card = page.locator('[data-widget="media"]');
  const leitura = card.locator('.pv2-week-readout');
  await expect(leitura).toHaveText(/Qua\s*·\s*média\s*R\$\s80/);
  await card.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(leitura).toHaveText(/Qui\s*·\s*média\s*R\$\s40/);
  await card.getByRole('button', { name: 'Dia anterior' }).click();
  await card.getByRole('button', { name: 'Dia anterior' }).click();
  await expect(leitura).toHaveText(/Ter\s*·\s*média\s*R\$\s30/);
  for (const nm of ['Dia anterior', 'Próximo dia']) {
    expect(Math.round((await card.getByRole('button', { name: nm }).boundingBox()).height)).toBeGreaterThanOrEqual(44);
  }
  // tocar na coluna também seleciona (Sáb = 7ª de 7)
  const svg = await card.locator('svg').boundingBox();
  await page.mouse.click(svg.x + svg.width * (6.5 / 7.2), svg.y + svg.height * 0.4);
  await expect(leitura).not.toHaveText(/Ter\s*·/);
});
