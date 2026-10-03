import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { DESLOGADO, semGoogle, cadastroAberto } from './fixtures/auth.mjs';

const PUBLICAS = [
  ['login', '/login', '.auth-card'],
  ['register', '/register', '.auth-card'],
  ['forgot-password', '/forgot-password', '.auth-simple-card'],
];

test.describe('deslogado', () => {
  test.use({ storageState: DESLOGADO });

  // Diagnóstico manual (usa a rede): DIAG_GSI=1. Ver o plano mobile-09, Task 1.
  test('diagnóstico: Login com o script do Google carregado', async ({ page }) => {
    test.skip(!process.env.DIAG_GSI, 'só com DIAG_GSI=1');
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    const gsiCarregou = page.waitForResponse(/accounts\.google\.com\/gsi\/client/);
    await gotoApp(page, '/login');
    await gsiCarregou;
    await page.waitForLoadState('networkidle');
    const caiu = await page.getByText('Algo deu errado.').isVisible();
    console.log(JSON.stringify({ caiu, erros }));
  });

  for (const [nome, rota, pronto] of PUBLICAS) {
    test(`desktop ${nome} inalterado`, async ({ page }) => {
      await semGoogle(page);
      await cadastroAberto(page);
      await gotoApp(page, rota);
      await page.locator(pronto).waitFor();
      // animações CSS (slideUpFade do card) são finalizadas pelo toHaveScreenshot (animations: 'disabled')
      await expect(page).toHaveScreenshot(`${nome}.png`, { fullPage: true });
    });
  }

  test('Login com o script do Google liberado não cai', async ({ page }) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await gotoApp(page, '/login');
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    await expect(page.getByText('Algo deu errado.')).toHaveCount(0);
    expect(erros).toEqual([]);
  });

  // Determinístico e sem rede: um GSI de mentira que lança no initTokenClient quando o hook
  // roda (é o que o GSI real faz sem client id). Fora do SaaS o botão não existe e o hook
  // do Google não pode rodar.
  test('Login fora do SaaS não inicializa o Google (initTokenClient)', async ({ page }) => {
    await page.route(/^https:\/\/accounts\.google\.com\/gsi\/client/, (r) => r.fulfill({
      contentType: 'text/javascript',
      body: `window.__gsiInit = 0;
window.google = { accounts: { oauth2: { initTokenClient: function () { window.__gsiInit++; throw new Error('Missing required parameter client_id.'); } } } };`,
    }));
    const gsiCarregou = page.waitForResponse(/accounts\.google\.com\/gsi\/client/);
    await gotoApp(page, '/login');
    await gsiCarregou;
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    await expect(page.getByText('Algo deu errado.')).toHaveCount(0);
    expect(await page.evaluate(() => window.__gsiInit)).toBe(0);
    await expect(page.getByRole('button', { name: /Entrar com Google/ })).toHaveCount(0);
  });
});

test('desktop admin-modal inalterado', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await page.locator('aside.sidebar').getByRole('button', { name: /Novo Usuário/ }).click();
  await page.locator('.admin-modal-content').waitFor();
  await expect(page).toHaveScreenshot('admin-modal.png');
});
