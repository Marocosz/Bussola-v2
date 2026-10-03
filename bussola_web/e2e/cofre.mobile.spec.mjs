import { test, expect } from '@playwright/test';
import { gotoApp, apiJson } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Infra do arquivo
// ---------------------------------------------------------------------------
// "Perto" = 5 dias depois do relógio fixo (02/10/2026); "Expirado" = antes dele.
const SEGREDOS = [
  { titulo: 'E2E Banco Zeta', servico: 'E2E Financeiro', notas: 'E2E nota do banco\nsegunda linha', valor: 'E2E-senha-123', data_expiracao: '2026-10-07' },
  { titulo: 'E2E Expirado', servico: null, notas: null, valor: 'E2E-velha', data_expiracao: '2026-09-30' },
];

// Remove tudo que os testes criam (prefixo "E2E "): sem isso as bases do desktop quebram.
async function limparE2E(request) {
  for (const s of (await apiJson(request, 'GET', '/cofre/')).filter((x) => x.titulo.startsWith('E2E '))) {
    await apiJson(request, 'DELETE', `/cofre/${s.id}`);
  }
}

test.beforeAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  for (const s of SEGREDOS) await apiJson(r, 'POST', '/cofre/', s);
  await r.dispose();
});

test.afterAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  await r.dispose();
});

// Área de transferência falsa: registra as escritas e pode falhar (como o Safari fora de um gesto).
async function stubClipboard(page) {
  await page.addInitScript(() => {
    window.__clip = [];
    window.__clipFalha = false;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => ({
        writeText: (t) => {
          if (window.__clipFalha) return Promise.reject(new DOMException('negado', 'NotAllowedError'));
          window.__clip.push(t);
          return Promise.resolve();
        },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Task 1 — lógica pura (importada pelo próprio Vite dev server)
// ---------------------------------------------------------------------------
test.describe('lógica pura', () => {
  test('validadeInfo e filtrarSegredos', async ({ page }) => {
    await gotoApp(page, '/cofre');
    const r = await page.evaluate(async () => {
      const m = await import('/src/pages/Cofre/cofreLista.js');
      const agora = new Date(2026, 9, 2, 12);
      const v = (d) => m.validadeInfo(d, agora);
      const lista = [
        { id: 1, titulo: 'Conta Itaú', servico: 'Banco' },
        { id: 2, titulo: 'Netflix', servico: 'Entretenimento' },
        { id: 3, titulo: 'AWS', servico: null },
      ];
      return {
        nenhuma: v(null),
        ontem: v('2026-10-01'),
        hoje: v('2026-10-02'),
        amanha: v('2026-10-03'),
        cinco: v('2026-10-07'),
        trinta: v('2026-11-01'),
        longe: v('2026-12-25'),
        busca: m.filtrarSegredos(lista, 'itau').map((s) => s.id),
        servico: m.filtrarSegredos(lista, 'ENTRET').map((s) => s.id),
        vazia: m.filtrarSegredos(lista, '   ').length,
        data: m.formatarData('2026-12-25'),
        semData: m.formatarData(null),
      };
    });
    expect(r).toEqual({
      nenhuma: { nivel: 'nenhuma', texto: 'Não expira' },
      ontem: { nivel: 'expirado', texto: 'Expirou em 01/10/2026' },
      hoje: { nivel: 'perto', texto: 'Expira hoje' },
      amanha: { nivel: 'perto', texto: 'Expira amanhã' },
      cinco: { nivel: 'perto', texto: 'Expira em 5 dias' },
      trinta: { nivel: 'perto', texto: 'Expira em 30 dias' },
      longe: { nivel: 'ok', texto: 'Expira em 25/12/2026' },
      busca: [1],
      servico: [2],
      vazia: 3,
      data: '25/12/2026',
      semData: 'Não expira',
    });
  });

  test('escreverClipboard informa sucesso e falha', async ({ page }) => {
    await stubClipboard(page);
    await gotoApp(page, '/cofre');
    const r = await page.evaluate(async () => {
      const { escreverClipboard } = await import('/src/utils/clipboard.js');
      const ok = await escreverClipboard('abc');
      window.__clipFalha = true;
      const falha = await escreverClipboard('def');
      return { ok, falha, gravados: window.__clip };
    });
    expect(r).toEqual({ ok: true, falha: false, gravados: ['abc'] });
  });
});
