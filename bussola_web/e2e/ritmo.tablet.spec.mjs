import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets, animacoesAcabaram, textoX } from './helpers.mjs';

const abaDieta = (p) => p.getByRole('tab', { name: 'Plano de Dieta', exact: true }).click();

// Texto abaixo de 10px (faixa 9.6–9.9px do desktop) não é aceitável no toque; os rótulos conhecidos
// têm piso próprio: .chip-label (caixa alta) ≥ 11px e .rb-label ≥ 12px.
const textosPequenos = (page, rootSelector) => page.evaluate((sel) => {
  const out = [];
  for (const root of document.querySelectorAll(sel)) {
    for (const el of root.querySelectorAll('*')) {
      const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!temTexto) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getBoundingClientRect().width) continue;
      const px = parseFloat(cs.fontSize);
      const minimo = el.matches('.chip-label') ? 11 : el.matches('.rb-label') ? 12 : 10;
      if (px < minimo - 0.01) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 20)}" ${px.toFixed(1)}px`);
    }
  }
  return out;
}, rootSelector);

for (const w of [769, 900, 1024]) {
  test(`tablet ${w}px: sem overflow, faixa bio 4×2 sem corte e 24px entre bio e abas`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/ritmo');
    expect(await overflowOffenders(page), `treino @ ${w}`).toEqual([]);
    const strip = page.locator('.bio-stat-strip');
    expect(await strip.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(4);
    const cortes = await page.locator('.chip-label, .chip-value').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    expect(cortes).toEqual([]);
    expect(await page.locator('.bio-panels-row').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
    await expect(page.locator('.app-fab')).toHaveCount(0);
    const gap = await page.evaluate(() => {
      const painel = document.querySelector('.bio-panels-row').getBoundingClientRect();
      const abas = document.querySelector('.plans-header-container').getBoundingClientRect();
      return Math.round(abas.top - painel.bottom);
    });
    expect(gap, `gap bio→abas @ ${w}`).toBe(24);
    expect(await textosPequenos(page, '.ritmo-scope .ritmo-content-wrapper'), `texto pequeno @ ${w}`).toEqual([]);
    await abaDieta(page);
    await expect(page.getByRole('button', { name: 'Nova Dieta' })).toBeVisible();
    expect(await overflowOffenders(page), `dieta @ ${w}`).toEqual([]);
  });
}

test('tablet: controles da página e dos builders com 44px e textos legíveis', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  expect(await smallTargets(page, '.ritmo-scope .ritmo-content-wrapper')).toEqual([]);
  await page.getByRole('button', { name: 'Novo Treino' }).click();
  await page.getByRole('button', { name: '+ Add Exercício' }).click();
  await page.getByRole('button', { name: 'Adicionar Dia' }).click();
  await animacoesAcabaram(page);
  expect(await smallTargets(page, '.ritmo-scope .modal-overlay')).toEqual([]);
  expect(await textosPequenos(page, '.ritmo-scope .modal-overlay'), 'texto pequeno no builder de treino').toEqual([]);
  const dia = await textoX(page.locator('.rb-day-name').first());
  const rotulo = (await page.locator('.rb-label').first().boundingBox()).x;
  expect(Math.abs(dia - rotulo), `Treino A x=${dia} rótulo x=${rotulo}`).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await abaDieta(page);
  await page.getByRole('button', { name: 'Nova Dieta' }).click();
  await page.getByRole('button', { name: '+ Add Alimento' }).click();
  await animacoesAcabaram(page);
  expect(await smallTargets(page, '.ritmo-scope .modal-overlay')).toEqual([]);
  expect(await textosPequenos(page, '.ritmo-scope .modal-overlay'), 'texto pequeno no builder de dieta').toEqual([]);
  const refeicao = await textoX(page.locator('.rb-day-name').first());
  const rotuloDieta = (await page.locator('.rb-label').first().boundingBox()).x;
  expect(Math.abs(refeicao - rotuloDieta), `refeição x=${refeicao} rótulo x=${rotuloDieta}`).toBeLessThanOrEqual(2);
});

test('tablet: regra do Sugerido visível sem hover e alvos do perfil com 44px', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
  await animacoesAcabaram(page);
  const regras = page.locator('.meta-hint');
  await expect(regras.first()).toBeVisible();
  expect(await page.locator('.suggestion-badge').first().evaluate((e) => getComputedStyle(e, '::after').display)).toBe('none');
  expect(await smallTargets(page, '.ritmo-scope .modal-overlay')).toEqual([]);
});

test('tablet: "Sugerido" com 44px de altura e foco visível com o token do tema', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
  await animacoesAcabaram(page);
  const badge = page.locator('.suggestion-badge').first();
  expect((await badge.boundingBox()).height).toBeGreaterThanOrEqual(44);
  // Foco por teclado (programático após clique do mouse não dispara :focus-visible).
  await badge.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(badge).toBeFocused();
  const outline = await badge.evaluate((e) => {
    const s = getComputedStyle(e);
    return { style: s.outlineStyle, color: s.outlineColor, width: parseFloat(s.outlineWidth) };
  });
  // O anel padrão do Chromium é "auto" com cor própria; só a regra :focus-visible do Ritmo dá sólido 2px azul.
  expect(outline).toEqual({ style: 'solid', color: 'rgb(74, 109, 255)', width: 2 });
});

test('capturas tablet para a conferência visual (900/1000)', async ({ page }, testInfo) => {
  for (const w of [900, 1000]) {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/ritmo');
    expect(await overflowOffenders(page), `treino @ ${w}`).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-treino.png`) });
    await abaDieta(page);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-dieta.png`) });
    await page.getByRole('button', { name: 'Nova Dieta' }).click();
    await page.getByRole('button', { name: '+ Add Alimento' }).click();
    await animacoesAcabaram(page);
    expect(await overflowOffenders(page), `builder dieta @ ${w}`).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-builder-dieta.png`) });
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('tab', { name: 'Plano de Treino', exact: true }).click();
    await page.getByRole('button', { name: 'Novo Treino' }).click();
    await page.getByRole('button', { name: '+ Add Exercício' }).click();
    await animacoesAcabaram(page);
    expect(await overflowOffenders(page), `builder treino @ ${w}`).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-builder-treino.png`) });
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
    await animacoesAcabaram(page);
    expect(await overflowOffenders(page), `perfil @ ${w}`).toEqual([]);
    await expect(page.locator('.meta-hint').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-perfil.png`) });
    await page.getByRole('button', { name: 'Cancelar' }).click();
  }
});

test('tablet: nenhuma ação/informação só no hover (ações do plano visíveis, ::after do tooltip desligado)', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  const acoes = page.locator('.plan-actions button');
  expect(await acoes.count()).toBeGreaterThan(0);
  for (const b of await acoes.all()) {
    await expect(b).toBeVisible();
    expect(await b.getAttribute('aria-label')).toBeTruthy();
  }
  const opacidade = await acoes.first().evaluate((e) => getComputedStyle(e.closest('.plan-actions')).opacity);
  expect(opacidade).toBe('1');
});
