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

// ---------------------------------------------------------------------------
// Task 2 — escopo do Auth sem mudar o desktop
// ---------------------------------------------------------------------------
test('efeitos globais preservados ao escopar o Auth (labels, input inválido, hover do primário)', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await page.getByRole('button', { name: 'Guardar Segredo' }).click();
  const label = page.locator('.modal-content .form-group label').first();
  expect(await label.evaluate((e) => getComputedStyle(e).marginLeft)).toBe('2px');
  const dias = page.locator('.modal-content input[type="number"]');
  await dias.fill('-5'); // min="0": inválido e preenchido
  await dias.blur(); // sem foco: o :focus não pode mascarar a borda de inválido
  // border-color tem transição de 0.2s: esperar o valor final em vez de ler no meio dela
  await expect.poll(() => dias.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe('rgb(239, 68, 68)');
  const salvar = page.locator('.modal-content .btn-primary');
  await salvar.hover();
  await expect.poll(() => salvar.evaluate((e) => getComputedStyle(e).filter)).toBe('brightness(1.1)');
});

test.describe('status (base depois da correção das variáveis)', () => {
  test.use({ storageState: DESLOGADO });
  for (const [nome, rota] of [['verify-email', '/verify-email'], ['register-success', '/register-success']]) {
    test(`desktop ${nome} com card visível`, async ({ page }) => {
      await gotoApp(page, rota);
      await page.locator('.auth-status-card').waitFor();
      await expect(page).toHaveScreenshot(`${nome}.png`);
    });
  }
});
