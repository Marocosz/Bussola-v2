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

// ---------------------------------------------------------------------------
// Fix final — KPIs por toque, faixa de KPIs e Atenção sem linhas órfãs, alvos de 44px em 769/1024
// ---------------------------------------------------------------------------
test('tablet (sem hover): tocar num KPI mostra a explicação em texto; tocar de novo esconde', async ({ page }) => {
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  const band = page.locator('.pv2-kpiband');
  const receita = band.locator('.pv2-kpi').first();
  const explica = page.locator('.pv2-kpi-explain');
  await expect(explica).toHaveCount(0);
  await expect(receita).toHaveAttribute('aria-expanded', 'false');
  await receita.click();
  await expect(receita).toHaveAttribute('aria-expanded', 'true');
  await expect(explica).toBeVisible();
  await expect(explica).toContainText('Receitas efetivadas no período');
  expect(parseFloat(await explica.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);
  await expect(receita).toHaveAttribute('aria-controls', 'pv2-kpi-explain');
  await expect(explica).toHaveAttribute('id', 'pv2-kpi-explain');
  await band.locator('.pv2-kpi-proj').click();
  await expect(explica).toContainText('Projeção de fechamento');
  await band.locator('.pv2-kpi-proj').click();
  await expect(explica).toHaveCount(0);
});

for (const w of [769, 900, 1024]) {
  test(`tablet ${w}px: KPIs em 3 + 2 sem linha órfã e Atenção em 2 × 2`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await usarFixture(page, { insights: 3 });
    await gotoApp(page, '/panorama');
    const band = page.locator('.pv2-kpiband');
    const bb = await band.boundingBox();
    const cells = await band.evaluate((e) => [...e.children].map((c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: Math.round(r.y), w: r.width }; }));
    expect(cells).toHaveLength(5);
    const linhas = {};
    for (const c of cells) (linhas[c.y] ||= []).push(c);
    const rows = Object.values(linhas);
    expect(rows.map((r) => r.length)).toEqual([3, 2]);
    for (const r of rows) expect(Math.abs(r.reduce((s, c) => s + c.w, 0) - bb.width)).toBeLessThanOrEqual(2);
    // a 1ª célula de cada linha não leva divisória esquerda perdida
    const bordas = await band.evaluate((e) => [...e.children].map((c) => getComputedStyle(c).borderLeftWidth));
    expect(bordas[0]).toBe('0px');
    expect(bordas[3]).toBe('0px');

    const alertas = await page.locator('.pv2-attn-row .pv2-alert').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { y: Math.round(r.y), w: r.width }; }));
    expect(alertas).toHaveLength(4); // 3 reais + "Sem aviso aqui"
    expect(alertas[0].y).toBe(alertas[1].y);
    expect(alertas[2].y).toBe(alertas[3].y);
    expect(alertas[2].y).toBeGreaterThan(alertas[0].y);
    expect(Math.abs(alertas[0].w - alertas[3].w)).toBeLessThanOrEqual(1);
  });

  test(`tablet ${w}px: todos os controles com 44px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await usarFixture(page, { insights: 3 });
    await gotoApp(page, '/panorama');
    expect(await smallTargets(page, '.panorama-scope')).toEqual([]);
  });
}

test('tablet (sem hover): o que o tooltip dizia tem alternativa visível (faixa do cubo e % do orçamento)', async ({ page }) => {
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  await expect(page.locator('.pv2-hero-period')).toContainText('+R$');
  await expect(page.locator('.pv2-hero-period')).toContainText('subiu');
  // Mercado 93% e Transporte 35% (Lazer, acima de 100%, já tem o selo)
  const orc = page.locator('[data-widget="orcamento"]');
  await expect(orc).toContainText('93%');
  await expect(orc).toContainText('35%');
});

test('tablet: privacidade e dispensar têm nome acessível próprio', async ({ page }) => {
  await usarFixture(page, { insights: 3 });
  await gotoApp(page, '/panorama');
  const olho = page.locator('.btn-privacy-toggle');
  await expect(olho).toHaveAttribute('aria-label', 'Ocultar valores');
  await expect(olho).toHaveAttribute('aria-pressed', 'false');
  await olho.click();
  await expect(olho).toHaveAttribute('aria-label', 'Mostrar valores');
  await expect(olho).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pv2-alert-dismiss').first()).toHaveAttribute('aria-label', 'Dispensar por 24h');
});
