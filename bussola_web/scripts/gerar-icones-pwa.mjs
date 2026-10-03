// Gera os ícones do PWA a partir de src/assets/images/bussola.svg (logo #eaeaea sobre #202124).
// Rodar em bussola_web/:  node scripts/gerar-icones-pwa.mjs
// Usa o Chromium do @playwright/test (já instalado para o E2E). Os PNGs vão para public/icons/
// e são commitados; rode de novo só se o logo mudar.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const FUNDO = '#202124';
const svg = fs.readFileSync('src/assets/images/bussola.svg');
const src = `data:image/svg+xml;base64,${svg.toString('base64')}`;

// escala = largura do logo / lado do ícone (o logo é 919×825).
// Maskable: o logo inteiro dentro do círculo seguro (raio 40% do lado) → 56%.
const ICONES = [
  { arquivo: 'icon-192.png', lado: 192, escala: 0.78 },
  { arquivo: 'icon-512.png', lado: 512, escala: 0.78 },
  { arquivo: 'icon-maskable-512.png', lado: 512, escala: 0.56 },
  { arquivo: 'apple-touch-icon.png', lado: 180, escala: 0.72 },
];

const destino = path.resolve('public/icons');
fs.mkdirSync(destino, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { arquivo, lado, escala } of ICONES) {
    await page.setViewportSize({ width: lado, height: lado });
    await page.setContent(`<!doctype html><html><body style="margin:0;width:${lado}px;height:${lado}px;background:${FUNDO};display:grid;place-items:center">
      <img src="${src}" alt="" style="display:block;width:${Math.round(lado * escala)}px;height:auto"></body></html>`);
    await page.locator('img').evaluate((img) => img.decode());
    await page.screenshot({ path: path.join(destino, arquivo), clip: { x: 0, y: 0, width: lado, height: lado } });
    console.log(`ok ${arquivo} (${lado}x${lado})`);
  }
} finally {
  await browser.close();
}
