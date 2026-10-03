import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, overflowOffendersOutsideScrollers } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Task 1 — helper
// ---------------------------------------------------------------------------
// O culpado é position:fixed de propósito: um bloco largo no fluxo faria o Chrome mobile alargar a
// viewport de layout (innerWidth passa a 900) e nada pareceria estourar.
test('overflowOffendersOutsideScrollers aceita rolagem interna e acusa o resto', async ({ page }) => {
  await gotoApp(page, '/estudos');
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="t-rola" style="width:200px;overflow-x:auto"><div class="t-rola-filho" style="width:900px;height:10px"></div></div>
      <div class="t-estoura" style="position:fixed;top:0;left:0;width:900px;height:10px"></div>`);
  });
  const doTeste = (lista) => lista.filter((s) => /t-rola-filho|t-estoura/.test(s)).map((s) => s.split(' ')[0]);
  expect(doTeste(await overflowOffendersOutsideScrollers(page))).toEqual(['div.t-estoura']);
  expect(doTeste(await overflowOffenders(page))).toEqual(['div.t-rola-filho', 'div.t-estoura']);
});
