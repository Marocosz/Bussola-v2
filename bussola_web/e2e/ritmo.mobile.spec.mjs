import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, apiJson, smallTargets } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Infra do arquivo
// ---------------------------------------------------------------------------
// Busca de alimentos fixa: a tabela TACO local pode não existir no banco demo.
const FOODS = [
  { nome: 'Arroz, tipo 1, cozido', calorias_100g: 128, proteina_100g: 2.5, carbo_100g: 28.1, gordura_100g: 0.2 },
  { nome: 'Arroz, integral, cozido', calorias_100g: 124, proteina_100g: 2.6, carbo_100g: 25.8, gordura_100g: 1 },
];

const abrirAba = (page, nome) => page.getByRole('tab', { name: nome, exact: true }).click();

// Teclado virtual de 424px: a área visível fica com 420px e o layout segue com 844.
const teclado = (page) => page.evaluate(() => {
  document.documentElement.style.setProperty('--vvh', '420px');
  document.documentElement.style.setProperty('--kb-inset', '424px');
});

// Remove planos/dietas "E2E " e devolve o original como ativo (criar com ativo=true desativa o
// "Hipertrofia ABC 2025"/"Bulking Limpo"; sem isso a base visual do desktop quebra).
async function limparE2E(request) {
  for (const base of ['/ritmo/treinos', '/ritmo/nutricao']) {
    const itens = await apiJson(request, 'GET', base);
    const e2e = (x) => String(x.nome).startsWith('E2E ');
    const ativo = itens.find((x) => x.ativo);
    if (!ativo || e2e(ativo)) {
      const alvo = itens.find((x) => !e2e(x));
      if (alvo) await apiJson(request, 'PATCH', `${base}/${alvo.id}/ativar`);
    }
    for (const x of itens.filter(e2e)) await apiJson(request, 'DELETE', `${base}/${x.id}`);
  }
}

// Elementos de `sel` (ele e descendentes) que passam das bordas da viewport.
async function vazamentos(page, sel) {
  return page.evaluate((s) => {
    const vw = window.innerWidth;
    const out = [];
    for (const el of document.querySelectorAll(`${s}, ${s} *`)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right > vw + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    }
    return out;
  }, sel);
}

// Elementos que cortam o próprio texto (scrollWidth > clientWidth).
async function cortados(page, sel) {
  return page.locator(sel).evaluateAll((els) => els
    .filter((e) => e.getBoundingClientRect().width && e.scrollWidth > e.clientWidth + 1)
    .map((e) => `${e.className} "${e.textContent.trim().slice(0, 24)}" ${e.scrollWidth}>${e.clientWidth}`));
}

// Textos visíveis abaixo do mínimo: 12px (11px só em caixa alta).
async function textosPequenos(page, sel) {
  return page.evaluate((s) => {
    const out = [];
    for (const root of document.querySelectorAll(s)) {
      for (const el of root.querySelectorAll('*')) {
        const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!temTexto) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const fs = parseFloat(cs.fontSize);
        const min = cs.textTransform === 'uppercase' ? 11 : 12;
        if (fs < min - 0.01) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 20)}" ${fs}px`);
      }
    }
    return out;
  }, sel);
}

test.beforeAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  await r.dispose();
});

test.afterAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  await r.dispose();
});

// ---------------------------------------------------------------------------
// Task 1 — infraestrutura
// ---------------------------------------------------------------------------
test('infra: limparE2E remove planos/dietas E2E e devolve os originais como ativos', async ({ request }) => {
  await apiJson(request, 'POST', '/ritmo/treinos', { nome: 'E2E Infra', ativo: true, dias: [] });
  await apiJson(request, 'POST', '/ritmo/nutricao', { nome: 'E2E Infra', ativo: true, refeicoes: [] });
  expect((await apiJson(request, 'GET', '/ritmo/treinos/ativo')).nome).toBe('E2E Infra');
  await limparE2E(request);
  expect((await apiJson(request, 'GET', '/ritmo/treinos/ativo')).nome).toBe('Hipertrofia ABC 2025');
  expect((await apiJson(request, 'GET', '/ritmo/nutricao/ativo')).nome).toBe('Bulking Limpo');
  const todos = [...await apiJson(request, 'GET', '/ritmo/treinos'), ...await apiJson(request, 'GET', '/ritmo/nutricao')];
  expect(todos.filter((x) => x.nome.startsWith('E2E '))).toEqual([]);
});
