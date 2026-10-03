import { test, expect } from '@playwright/test';
import { gotoApp, apiJson, overflowOffenders, smallTargets, animacoesAcabaram } from './helpers.mjs';

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

const linha = (page, titulo) => page.locator('.cofre-m-item').filter({ has: page.locator('.cofre-m-titulo', { hasText: titulo }) });

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

// ---------------------------------------------------------------------------
// Task 2 — lista compacta
// ---------------------------------------------------------------------------
test.describe('lista compacta', () => {
  test('topbar "Cofre", sem tabela nem cabeçalho de seção; Fab "Guardar segredo"', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await expect(page.locator('.m-topbar-title')).toHaveText('Cofre');
    await expect(page.locator('.data-table')).toHaveCount(0);
    await expect(page.locator('.section-header-flex')).toHaveCount(0);
    await expect(page.locator('.cofre-m-item').first()).toBeVisible();
    const fab = page.locator('.app-fab');
    await expect(fab).toHaveCount(1);
    await expect(fab).toHaveAttribute('aria-label', 'Guardar segredo');
  });

  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/cofre');
      await expect(page.locator('.cofre-m-item').first()).toBeVisible();
      expect(await overflowOffenders(page), `${w}px`).toEqual([]);
    });
  }

  test('alvos de toque ≥ 44px (página e sheet de ações)', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await expect(page.locator('.cofre-m-item').first()).toBeVisible();
    expect(await smallTargets(page, '.cofre-scope')).toEqual([]);
    await page.getByRole('button', { name: 'Mais ações de E2E Banco Zeta' }).click();
    await expect(page.locator('.action-sheet .action-sheet-item').first()).toBeVisible();
    await animacoesAcabaram(page);
    await expect.poll(() => smallTargets(page, '.action-sheet')).toEqual([]);
  });

  test('espaçamento: gutter de 16px, 16px entre busca e lista, linhas com 64px+', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await expect(page.locator('.cofre-m-item').first()).toBeVisible();
    const busca = await page.getByRole('searchbox', { name: 'Buscar segredos' }).boundingBox();
    const lista = await page.locator('.cofre-m-lista').boundingBox();
    const vw = page.viewportSize().width;
    expect(Math.round(lista.x)).toBe(16);
    expect(Math.round(lista.width)).toBe(vw - 32);
    expect(Math.round(busca.x)).toBe(16);
    expect(Math.round(lista.y - (busca.y + busca.height))).toBe(16);
    for (const b of await page.locator('.cofre-m-item').all()) {
      expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(64);
    }
  });

  test('linha: título, serviço e validade em alerta', async ({ page }) => {
    await gotoApp(page, '/cofre');
    const zeta = linha(page, 'E2E Banco Zeta');
    await expect(zeta.locator('.cofre-m-icone i')).toHaveClass(/fa-key/);
    await expect(zeta.locator('.cofre-m-titulo')).toHaveText('E2E Banco Zeta');
    await expect(zeta.locator('.service-tag')).toHaveText('E2E Financeiro');
    const perto = zeta.locator('.cofre-m-validade');
    await expect(perto).toHaveText('Expira em 5 dias');
    await expect(perto).toHaveClass(/is-perto/);
    expect(await perto.evaluate((e) => getComputedStyle(e).color)).toBe('rgb(243, 156, 18)');
    const exp = linha(page, 'E2E Expirado').locator('.cofre-m-validade');
    await expect(exp).toHaveText('Expirou em 30/09/2026');
    await expect(exp).toHaveClass(/is-expirado/);
    const titulo = await zeta.locator('.cofre-m-titulo').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(titulo).toBeGreaterThanOrEqual(15);
  });

  test('busca sem acento por título e por serviço', async ({ page }) => {
    await gotoApp(page, '/cofre');
    const busca = page.getByRole('searchbox', { name: 'Buscar segredos' });
    await busca.fill('zeta');
    await expect(page.locator('.cofre-m-item')).toHaveCount(1);
    await busca.fill('E2E FINANCÉIRO'); // o seed demo também tem um serviço "Financeiro"
    await expect(page.locator('.cofre-m-item')).toHaveCount(1);
    await busca.fill('nada-que-exista');
    await expect(page.locator('.cofre-m-item')).toHaveCount(0);
    await expect(page.locator('.cofre-m-nada')).toContainText('Nenhum segredo encontrado');
    await busca.fill('');
    expect(await page.locator('.cofre-m-item').count()).toBeGreaterThan(2);
  });

  test('⋯ abre Editar / Ver notas / Excluir; sem notas não mostra "Ver notas"', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.getByRole('button', { name: 'Mais ações de E2E Banco Zeta' }).click();
    const sheet = page.locator('.action-sheet');
    await expect(sheet.locator('.action-sheet-titles strong')).toHaveText('E2E Banco Zeta');
    await expect(sheet.locator('.action-sheet-item')).toHaveText(['Editar', 'Ver notas', 'Excluir', 'Cancelar']);
    await expect(sheet.locator('.action-sheet-item.is-danger')).toHaveText('Excluir');
    await sheet.getByRole('button', { name: 'Cancelar' }).click();
    await expect(sheet).toHaveCount(0);
    await page.getByRole('button', { name: 'Mais ações de E2E Expirado' }).click();
    await expect(page.locator('.action-sheet .action-sheet-item')).toHaveText(['Editar', 'Excluir', 'Cancelar']);
  });

  test('Ver notas abre o texto completo em sheet', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.getByRole('button', { name: 'Mais ações de E2E Banco Zeta' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Ver notas' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet.locator('.notes-full-view')).toContainText('E2E nota do banco');
    await expect(sheet.locator('h3')).toContainText('E2E Banco Zeta');
  });

  test('Excluir pelo ⋯ pede confirmação e remove só aquele', async ({ page, request }) => {
    await apiJson(request, 'POST', '/cofre/', { titulo: 'E2E Apagar', servico: 'E2E', valor: 'x' });
    await gotoApp(page, '/cofre');
    await expect(linha(page, 'E2E Apagar')).toHaveCount(1);
    const antes = await page.locator('.cofre-m-item').count();
    await page.getByRole('button', { name: 'Mais ações de E2E Apagar' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Sim, Excluir' }).click();
    await expect(linha(page, 'E2E Apagar')).toHaveCount(0);
    await expect(page.locator('.cofre-m-item')).toHaveCount(antes - 1);
    await expect(linha(page, 'E2E Banco Zeta')).toHaveCount(1);
  });

  test('olho pede confirmação e abre o segredo em sheet', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.getByRole('button', { name: 'Ver senha de E2E Banco Zeta' }).click();
    await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
    await expect(page.locator('.modal-overlay.is-sheet .secret-display-box')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Task 3 — formulário e notas em sheet
// ---------------------------------------------------------------------------
test.describe('formulário em sheet', () => {
  test('Fab abre o form: campos empilhados, atributos de teclado e sem autofocus', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.locator('.app-fab').click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet.locator('h3')).toHaveText('Guardar Novo Segredo');
    await animacoesAcabaram(page);
    await expect(page.locator('#segredo-titulo')).not.toBeFocused();
    const valor = page.locator('#segredo-valor');
    await expect(valor).toHaveAttribute('autocomplete', 'new-password');
    await expect(valor).toHaveAttribute('autocapitalize', 'off');
    await expect(valor).toHaveAttribute('autocorrect', 'off');
    await expect(valor).toHaveAttribute('spellcheck', 'false');
    await expect(page.locator('#segredo-servico')).toHaveAttribute('autocapitalize', 'off');
    await expect(page.locator('#segredo-dias')).toHaveAttribute('inputmode', 'numeric');
    const t = await page.locator('#segredo-titulo').boundingBox();
    const s = await page.locator('#segredo-servico').boundingBox();
    expect(Math.round(s.x)).toBe(Math.round(t.x));
    expect(s.y).toBeGreaterThan(t.y + t.height);
    expect(Math.round(s.width)).toBe(Math.round(t.width));
  });

  test('fechar é um <button> de 44px com rótulo "Fechar"', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.locator('.app-fab').click();
    const fechar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' });
    expect(await fechar.evaluate((e) => e.tagName)).toBe('BUTTON');
    await animacoesAcabaram(page);
    await expect.poll(async () => { const b = await fechar.boundingBox(); return Math.min(b.width, b.height); }).toBeGreaterThanOrEqual(44);
    await fechar.click();
    await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  });

  test('alvos ≥ 44px no form novo e no de edição (senha travada)', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.locator('.app-fab').click();
    await animacoesAcabaram(page);
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).click();
    await page.getByRole('button', { name: 'Mais ações de E2E Banco Zeta' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('.locked-input-wrapper')).toBeVisible();
    await animacoesAcabaram(page);
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
  });

  test('teclado virtual: Salvar fica acima do teclado', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--vvh', '420px');
      document.documentElement.style.setProperty('--kb-inset', '424px');
    });
    await page.locator('.app-fab').click();
    const salvar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Salvar' });
    await expect(salvar).toBeVisible();
    await expect.poll(async () => { const b = await salvar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
  });

  test('criar pelo Fab e editar pelo ⋯', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.locator('.app-fab').click();
    await page.locator('#segredo-titulo').fill('E2E Criado no celular');
    await page.locator('#segredo-servico').fill('E2E Teste');
    await page.locator('#segredo-valor').fill('E2E-123');
    await page.locator('#segredo-dias').fill('10');
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Salvar' }).click();
    const novo = linha(page, 'E2E Criado no celular');
    await expect(novo).toHaveCount(1);
    await expect(novo.locator('.cofre-m-validade')).toHaveText('Expira em 10 dias');

    await page.getByRole('button', { name: 'Mais ações de E2E Criado no celular' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('#segredo-titulo')).toHaveValue('E2E Criado no celular');
    await page.locator('#segredo-titulo').fill('E2E Criado editado');
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Salvar' }).click();
    await expect(linha(page, 'E2E Criado editado')).toHaveCount(1);
    await expect(linha(page, 'E2E Criado no celular')).toHaveCount(0);
  });

  test('notas: fechar de 44px e texto sem rolagem interna dupla', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.getByRole('button', { name: 'Mais ações de E2E Banco Zeta' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Ver notas' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet.locator('.notes-full-view')).toBeVisible();
    await animacoesAcabaram(page);
    expect(await sheet.locator('.notes-full-view').evaluate((e) => getComputedStyle(e).maxHeight)).toBe('none');
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    await sheet.getByRole('button', { name: 'Fechar' }).first().click();
    await expect(sheet).toHaveCount(0);
  });
});

test.describe('edição preserva a validade', () => {
  test('editar só o nome mantém data_expiracao e mostra a validade atual', async ({ page, request }) => {
    await apiJson(request, 'POST', '/cofre/', { titulo: 'E2E Validade', servico: 'E2E', valor: 'E2E-v', data_expiracao: '2026-12-25' });
    await gotoApp(page, '/cofre');
    await page.getByRole('button', { name: 'Mais ações de E2E Validade' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('#segredo-dias')).toHaveValue('');
    await expect(page.locator('.modal-overlay.is-sheet')).toContainText('Expira em 25/12/2026 — deixe em branco para manter');
    await page.locator('#segredo-titulo').fill('E2E Validade editada');
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Salvar' }).click();
    await expect(linha(page, 'E2E Validade editada')).toHaveCount(1);
    const lista = await apiJson(request, 'GET', '/cofre/');
    expect(lista.find((s) => s.titulo === 'E2E Validade editada').data_expiracao).toBe('2026-12-25');
  });

  test('item sem validade: nenhum texto auxiliar', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.getByRole('button', { name: 'Mais ações de E2E Expirado' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('.segredo-dias-ajuda')).toHaveCount(1); // expirado ainda tem data
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).click();
    await page.locator('.app-fab').click();
    await expect(page.locator('.segredo-dias-ajuda')).toHaveCount(0);
  });
});

// Itens da revisão da Task 2
test.describe('lista: ajustes da revisão', () => {
  test('validade não quebra no meio da frase', async ({ page }) => {
    await gotoApp(page, '/cofre');
    const v = linha(page, 'E2E Expirado').locator('.cofre-m-validade');
    await expect(v).toHaveText('Expirou em 30/09/2026');
    expect(await v.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('nowrap');
  });

  test('cofre vazio: sem caixa de busca', async ({ page }) => {
    await page.route('**/api/v1/cofre/', (route) => (route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.continue()));
    await gotoApp(page, '/cofre');
    await expect(page.locator('.cofre-m-vazio')).toBeVisible();
    await expect(page.locator('.cofre-m-busca')).toHaveCount(0);
  });
});
