import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets, animacoesAcabaram } from './helpers.mjs';
import { DESLOGADO, semGoogle, cadastroAberto } from './fixtures/auth.mjs';

// [nome, rota, seletor do card]
const PUBLICAS = [
  ['login', '/login', '.auth-card'],
  ['register', '/register', '.auth-card'],
  ['forgot', '/forgot-password', '.auth-simple-card'],
  ['reset', '/reset-password?token=e2e', '.auth-simple-card'],
  ['verify', '/verify-email', '.auth-status-card'],
  ['register-success', '/register-success', '.auth-status-card'],
];

async function abrir(page, rota, card) {
  await semGoogle(page);
  await cadastroAberto(page);
  await gotoApp(page, rota);
  await page.locator(card).waitFor();
  await animacoesAcabaram(page); // animação de entrada
}

// ---------------------------------------------------------------------------
// Task 2 — telas de Auth
// ---------------------------------------------------------------------------
test.describe('auth deslogado', () => {
  test.use({ storageState: DESLOGADO });

  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px nas telas públicas`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      for (const [nome, rota, card] of PUBLICAS) {
        await abrir(page, rota, card);
        expect(await overflowOffenders(page), `${nome} @ ${w}px`).toEqual([]);
      }
    });
  }

  test('Esqueci/Nova senha/Status: card de largura total (16px) e alvos ≥ 44px', async ({ page }) => {
    for (const [nome, rota, card] of PUBLICAS.slice(2)) {
      await abrir(page, rota, card);
      const b = await page.locator(card).boundingBox();
      expect(Math.round(b.x), nome).toBe(16);
      expect(Math.round(b.width), nome).toBe(390 - 32);
      expect(await smallTargets(page, card), nome).toEqual([]);
    }
  });

  test('telas de status com fundo de card (variáveis corrigidas)', async ({ page }) => {
    for (const rota of ['/verify-email', '/register-success']) {
      await abrir(page, rota, '.auth-status-card');
      const card = page.locator('.auth-status-card');
      expect(await card.evaluate((e) => getComputedStyle(e).backgroundColor), rota).toBe('rgb(46, 47, 51)');
      expect(await card.evaluate((e) => getComputedStyle(e).borderTopColor), rota).not.toBe('rgb(229, 231, 235)');
    }
  });
});

test.describe('auth logado', () => {
  test('Discord e Autorizar conexão: sem overflow e card de largura total', async ({ page }) => {
    await page.route(/\/api\/v1\/oauth\/clientes\/[^/]+$/, (r) => r.fulfill({ json: { client_id: 'e2e', client_name: 'Claude' } }));
    for (const w of [360, 390, 430, 768]) {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/discord/link');
      await page.locator('.auth-status-card').waitFor();
      expect(await overflowOffenders(page), `discord @ ${w}`).toEqual([]);
      await gotoApp(page, '/conexoes/autorizar?client_id=e2e&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fcallback');
      await page.locator('.autorizar-acoes').waitFor();
      expect(await overflowOffenders(page), `autorizar @ ${w}`).toEqual([]);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, '/discord/link');
    await page.locator('.auth-status-card').waitFor();
    const d = await page.locator('.auth-status-card').boundingBox();
    expect(Math.round(d.x)).toBe(16);
    expect(Math.round(d.width)).toBe(390 - 32);
    expect(await smallTargets(page, '.auth-status-card')).toEqual([]);
    await gotoApp(page, '/conexoes/autorizar?client_id=e2e&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fcallback');
    await page.locator('.autorizar-acoes').waitFor();
    expect(Math.round((await page.locator('.autorizar-card').boundingBox()).width)).toBe(390 - 32);
    expect(await smallTargets(page, '.autorizar-card')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 3 — Login e Registro
// ---------------------------------------------------------------------------
test.describe('login e registro no celular', () => {
  test.use({ storageState: DESLOGADO });

  for (const [nome, rota] of [['login', '/login'], ['register', '/register']]) {
    test(`${nome}: card primeiro, sem ilustração nem parágrafo, gutter de 16px`, async ({ page }) => {
      await abrir(page, rota, '.auth-card');
      const card = await page.locator('.auth-card').boundingBox();
      const h1 = await page.locator('.auth-intro h1').boundingBox();
      expect(card.y).toBeLessThan(h1.y);
      expect(Math.round(card.x)).toBe(16);
      expect(Math.round(card.width)).toBe(390 - 32);
      await expect(page.locator('.auth-intro p')).toBeHidden();
      for (const img of await page.locator('.auth-intro-image').all()) await expect(img).toBeHidden();
      const fonte = await page.locator('.auth-intro h1').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(fonte).toBeGreaterThanOrEqual(24);
      expect(fonte).toBeLessThanOrEqual(32);
      expect(await smallTargets(page, '.auth-card')).toEqual([]);
    });
  }

  test('inputs de Login, Registro e Esqueci computam 16px (sem zoom do iOS)', async ({ page }) => {
    for (const [nome, rota, card] of [['login', '/login', '.auth-card'], ['register', '/register', '.auth-card'], ['forgot', '/forgot-password', '.auth-simple-card']]) {
      await abrir(page, rota, card);
      const fontes = await page.locator(`${card} input:not([type="hidden"]):not([type="checkbox"])`).evaluateAll((els) => els.map((e) => getComputedStyle(e).fontSize));
      expect(fontes.length, nome).toBeGreaterThan(0);
      for (const f of fontes) expect(f, nome).toBe('16px');
    }
  });

  test('viewport baixa (teclado): a página rola até o Entrar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 420 });
    await abrir(page, '/login', '.auth-card');
    expect(await page.locator('.auth-page').evaluate((e) => getComputedStyle(e).overflowY)).toBe('visible');
    const entrar = page.getByRole('button', { name: 'Entrar', exact: true });
    await entrar.scrollIntoViewIfNeeded();
    await expect(entrar).toBeInViewport();
  });

  for (const w of [390, 769]) {
    test(`sem efeito de hover no toque (Entrar e Enviar do Esqueci) em ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      for (const [rota, card] of [['/login', '.auth-card'], ['/forgot-password', '.auth-simple-card']]) {
        await abrir(page, rota, card);
        const btn = page.locator(`${card} .btn-primary`).first();
        const antes = await btn.evaluate((e) => [getComputedStyle(e).transform, getComputedStyle(e).boxShadow]);
        await btn.hover();
        await expect.poll(() => btn.evaluate((e) => (e.getAnimations().some((a) => a.playState === 'running')
          ? 'animando' : [getComputedStyle(e).transform, getComputedStyle(e).boxShadow])), rota).toEqual(antes);
        expect(antes[0], rota).toBe('none');
      }
    });
  }

  test('login de verdade pelo celular leva ao Início', async ({ page }) => {
    await abrir(page, '/login', '.auth-card');
    await page.getByLabel('E-mail').fill('demo@bussola.dev');
    await page.getByLabel('Senha').fill('Demo12345!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('.m-topbar-title')).toHaveText('Início');
  });
});
