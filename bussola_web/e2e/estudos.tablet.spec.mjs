import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffendersOutsideScrollers, smallTargets } from './helpers.mjs';
import { mockEstudos } from './fixtures/estudos.mjs';

const ROTAS = [['biblioteca', '/estudos', '.estudo-card'], ['kit', '/estudos/kit', '.kit-card'], ['leitura', '/estudos/9101', '.bloco-quiz']];

for (const w of [900, 1024]) {
  for (const [nome, rota, pronto] of ROTAS) {
    test(`tablet ${w}px ${nome}: sem overflow`, async ({ page }) => {
      await mockEstudos(page);
      await page.setViewportSize({ width: w, height: 1200 });
      await gotoApp(page, rota);
      await page.locator(pronto).first().waitFor();
      expect(await overflowOffendersOutsideScrollers(page)).toEqual([]);
    });
  }
}

test('tablet: filtros, ações e gatilhos por bloco com 44px e visíveis sem hover', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos');
  await page.locator('.estudo-card').first().waitFor();
  expect(await smallTargets(page, '.estudos-temas')).toEqual([]);
  expect(await smallTargets(page, '.estudos-filtros')).toEqual([]);
  await gotoApp(page, '/estudos/9101');
  expect(await smallTargets(page, '.estudo-acoes')).toEqual([]);
  const acoesBloco = page.locator('#bloco-b3 .estudo-bloco-acoes');
  expect(await acoesBloco.evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  expect((await acoesBloco.locator('button').boundingBox()).height).toBeGreaterThanOrEqual(44);
});
