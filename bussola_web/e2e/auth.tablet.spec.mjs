import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, animacoesAcabaram } from './helpers.mjs';
import { DESLOGADO, semGoogle, cadastroAberto } from './fixtures/auth.mjs';

// Tablet touch em retrato: o formulário tem de aparecer na primeira tela (sem ilustração acima).
test.describe('login e registro em tablet touch retrato', () => {
  test.use({ storageState: DESLOGADO });

  for (const [w, h] of [[769, 1024], [820, 1180], [834, 1194]]) {
    for (const [nome, rota] of [['login', '/login'], ['register', '/register']]) {
      test(`${nome} ${w}x${h}: card e envio na primeira tela, sem overflow`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await semGoogle(page);
        await cadastroAberto(page);
        await gotoApp(page, rota);
        await page.locator('.auth-card').waitFor();
        await animacoesAcabaram(page);
        const card = await page.locator('.auth-card').boundingBox();
        expect(card.y, 'topo do card').toBeLessThan(h / 2);
        const enviar = await page.locator('.auth-card button[type="submit"]').boundingBox();
        expect(enviar.y + enviar.height, 'botão de envio na primeira tela').toBeLessThanOrEqual(h);
        expect(Math.abs(card.x + card.width / 2 - w / 2), 'card centralizado').toBeLessThanOrEqual(1);
        expect(await overflowOffenders(page)).toEqual([]);
      });
    }
  }
});
