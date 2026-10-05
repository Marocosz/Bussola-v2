import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffendersOutsideScrollers, smallTargets, animacoesAcabaram } from './helpers.mjs';
import { mockEstudos } from './fixtures/estudos.mjs';

const ROTAS = [['biblioteca', '/estudos', '.estudo-card'], ['kit', '/estudos/kit', '.kit-card'], ['leitura', '/estudos/9101', '.bloco-quiz']];

// Citações [n] e a âncora # da seção são inline no texto: ficam fora da regra de 44px.
const semInline = (lista) => lista.filter((s) => !/"\[\d+\]"|bloco-secao-ancora/.test(s));

// 769 é o primeiro pixel do tablet; 1000 o último com a navegação compacta.
for (const w of [769, 820, 1000]) {
  for (const [nome, rota, pronto] of ROTAS) {
    test(`tablet touch ${w}px ${nome}: alvos de 44px e sem overflow`, async ({ page }) => {
      await mockEstudos(page);
      await page.setViewportSize({ width: w, height: 1100 });
      await gotoApp(page, rota);
      await page.locator(pronto).first().waitFor();
      await animacoesAcabaram(page);
      await expect.poll(async () => semInline(await smallTargets(page, '.estudos-scope'))).toEqual([]);
      expect(await overflowOffendersOutsideScrollers(page)).toEqual([]);
      if (process.env.ESTUDOS_SHOTS) await page.screenshot({ path: `${process.env.ESTUDOS_SHOTS}/t5-${nome}-${w}-touch.png` });
    });
  }
}

for (const w of [769, 900, 1024]) {
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
  expect(await smallTargets(page, '.estudos-barra')).toEqual([]);
  await gotoApp(page, '/estudos/9101');
  expect(await smallTargets(page, '.estudo-acoes')).toEqual([]);
  const acoesBloco = page.locator('#bloco-b3 .estudo-bloco-acoes');
  expect(await acoesBloco.evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  expect((await acoesBloco.locator('button').boundingBox()).height).toBeGreaterThanOrEqual(44);
});
