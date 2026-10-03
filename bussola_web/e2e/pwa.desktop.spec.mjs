import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

const BASE = 'http://127.0.0.1:5173';

// Largura × altura do PNG (cabeçalho IHDR).
function tamanhoPng(buf) {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

test('manifest com nome, standalone, cores e ícones 192/512 + maskable', async ({ request }) => {
  const res = await request.get(`${BASE}/manifest.webmanifest`);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({
    name: 'Bússola',
    short_name: 'Bússola',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    theme_color: '#202124',
    background_color: '#202124',
  });
  const porTipo = (purpose, sizes) => m.icons.find((i) => i.purpose === purpose && i.sizes === sizes);
  for (const [purpose, sizes] of [['any', '192x192'], ['any', '512x512'], ['maskable', '512x512']]) {
    const icone = porTipo(purpose, sizes);
    expect(icone, `${purpose} ${sizes}`).toBeTruthy();
    expect(icone.type).toBe('image/png');
    const png = await request.get(`${BASE}${icone.src}`);
    expect(png.ok(), icone.src).toBe(true);
    const [w, h] = tamanhoPng(await png.body());
    expect(`${w}x${h}`).toBe(sizes);
  }
  const apple = await request.get(`${BASE}/icons/apple-touch-icon.png`);
  expect(tamanhoPng(await apple.body())).toEqual([180, 180]);
});

test('ícones: fundo #202124 nas bordas e o logo desenhado no centro', async ({ page }) => {
  await gotoApp(page, '/home');
  for (const src of ['/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/icon-192.png']) {
    const r = await page.evaluate(async (s) => {
      const img = new Image();
      img.src = s;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
      // procura um pixel claro (o logo é #eaeaea) numa faixa central
      let claro = false;
      for (let x = Math.round(img.width * 0.3); x < img.width * 0.7 && !claro; x += 2) {
        const [r0, g0, b0] = px(x, Math.round(img.height / 2));
        if (r0 > 150 && g0 > 150 && b0 > 150) claro = true;
      }
      return { canto: px(1, 1), claro };
    }, src);
    expect(r.canto, src).toEqual([32, 33, 36]);
    expect(r.claro, src).toBe(true);
  }
});

test('index.html: manifest, theme-color, apple-touch-icon e capable', async ({ page }) => {
  await gotoApp(page, '/home');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#202124');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test('sem service worker', async ({ page }) => {
  await gotoApp(page, '/home');
  // gotoApp espera o load + networkidle: um register() no boot já teria criado o registro.
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
});
