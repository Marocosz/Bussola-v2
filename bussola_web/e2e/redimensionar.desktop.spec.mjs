import { test, expect } from '@playwright/test';
import { gotoApp, congelarAgenda } from './helpers.mjs';

// A captura fullPage do Playwright estreita a janela por um instante: o layout de celular monta e
// qualquer efeito dele que role a JANELA desloca sidebar/Fab fixos na captura do desktop (foi a causa
// do flake de registros-tarefas). Aqui: estreitar e voltar não pode rolar a página em nenhuma tela
// com captura fullPage no desktop.
const TELAS = [
  ['home', '/home'], ['panorama', '/panorama'], ['financas', '/financas'], ['agenda', '/agenda'],
  ['registros', '/registros'], ['registros-tarefas', '/registros', 'Tarefas'], ['registros-jornada', '/registros', 'Jornada'],
  ['estudos', '/estudos'], ['estudos-kit', '/estudos/kit'], ['ritmo', '/ritmo'], ['cofre', '/cofre'],
];

const doisQuadros = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

for (const [nome, rota, aba] of TELAS) {
  test(`desktop ${nome}: estreitar a janela e voltar não rola a página`, async ({ page }) => {
    if (nome === 'agenda') await congelarAgenda(page);
    await gotoApp(page, rota);
    if (aba) {
      await page.locator('.tab-btn-pill', { hasText: aba }).click();
      await page.waitForLoadState('networkidle');
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.setViewportSize({ width: 320, height: 60 });
    await page.locator('.m-topbar').waitFor({ state: 'attached' });
    await doisQuadros(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.sidebar').waitFor();
    await doisQuadros(page);
    // A página volta ao desktop no topo (um efeito do celular pode rolar, mas tem de desfazer ao desmontar).
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}
