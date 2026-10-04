import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

// Varredura final de acessibilidade (teclado em abas/chips, painéis ligados às abas).

async function conferirAbasComTeclado(page, tablist, nomes) {
  const abas = tablist.getByRole('tab');
  await expect(abas).toHaveCount(nomes.length);
  const selecionada = (n) => tablist.getByRole('tab', { name: n, exact: true });
  // Tabindex móvel: só a aba ativa entra no Tab.
  await expect(selecionada(nomes[0])).toHaveAttribute('tabindex', '0');
  for (const n of nomes.slice(1)) await expect(selecionada(n)).toHaveAttribute('tabindex', '-1');

  await selecionada(nomes[0]).focus();
  await page.keyboard.press('ArrowRight');
  await expect(selecionada(nomes[1])).toHaveAttribute('aria-selected', 'true');
  await expect(selecionada(nomes[1])).toBeFocused();
  await expect(selecionada(nomes[1])).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('End');
  await expect(selecionada(nomes.at(-1))).toHaveAttribute('aria-selected', 'true');
  await expect(selecionada(nomes.at(-1))).toBeFocused();
  await page.keyboard.press('ArrowRight'); // circular
  await expect(selecionada(nomes[0])).toHaveAttribute('aria-selected', 'true');
  await expect(selecionada(nomes[0])).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(selecionada(nomes.at(-1))).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(selecionada(nomes[0])).toHaveAttribute('aria-selected', 'true');
  await expect(selecionada(nomes[0])).toBeFocused();
}

async function conferirPainel(page, tablist) {
  const ativa = tablist.locator('[role="tab"][aria-selected="true"]');
  const painelId = await ativa.getAttribute('aria-controls');
  expect(painelId).toBeTruthy();
  const painel = page.locator(`#${painelId}`);
  await expect(painel).toHaveAttribute('role', 'tabpanel');
  await expect(painel).toHaveAttribute('aria-labelledby', await ativa.getAttribute('id'));
}

// Grupo de radios/opções com tabindex móvel: só o selecionado no Tab; setas movem (e, em radio, selecionam).
async function conferirRadios(page, grupo, { seleciona = true, proxima = 'ArrowRight' } = {}) {
  const itens = grupo.locator(seleciona ? '[role="radio"]' : '[role="option"]');
  const attr = seleciona ? 'aria-checked' : 'aria-selected';
  const n = await itens.count();
  expect(n).toBeGreaterThan(1);
  const tabs = await itens.evaluateAll((els) => els.map((e) => e.getAttribute('tabindex')));
  expect(tabs.filter((t) => t === '0')).toHaveLength(1);
  expect(tabs.filter((t) => t === '-1')).toHaveLength(n - 1);
  const i0 = tabs.indexOf('0');
  await itens.nth(i0).focus();
  await page.keyboard.press(proxima);
  const i1 = (i0 + 1) % n;
  await expect(itens.nth(i1)).toBeFocused();
  if (seleciona) {
    await expect(itens.nth(i1)).toHaveAttribute(attr, 'true');
    await expect(itens.nth(i1)).toHaveAttribute('tabindex', '0');
  }
  await page.keyboard.press('End');
  await expect(itens.nth(n - 1)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(itens.nth(0)).toBeFocused();
}

test.describe('chips de escolha com teclado', () => {
  test('detalhe da tarefa: status e prioridade com setas (radiogroup)', async ({ page }) => {
    await gotoApp(page, '/registros');
    await page.getByRole('tablist', { name: 'Seções de Registros' }).getByRole('tab', { name: 'Tarefas' }).click();
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await conferirRadios(page, ov.getByRole('radiogroup', { name: 'Status' }));
    await conferirRadios(page, ov.getByRole('radiogroup', { name: 'Prioridade' }));
  });

  test('novo grupo: cores com setas (radiogroup)', async ({ page }) => {
    await gotoApp(page, '/registros');
    await page.locator('.reg-m-chips').getByRole('button', { name: 'Grupos', exact: true }).click();
    await page.locator('.reg-sheet').getByRole('button', { name: 'Novo grupo' }).click();
    const modal = page.locator('.modal-overlay.is-sheet', { has: page.locator('.compact-modal') });
    await conferirRadios(page, modal.getByRole('radiogroup', { name: 'Cor' }));
  });

  test('grupo da nota: opções com ↑/↓ (listbox) sem escolher ao mover', async ({ page }) => {
    await gotoApp(page, '/registros');
    await page.locator('.app-fab').click();
    await page.locator('.modal-overlay.is-sheet-full .nota-m-grupo').click();
    const lista = page.locator('.reg-sheet').getByRole('listbox', { name: 'Grupo da nota' });
    await conferirRadios(page, lista, { seleciona: false, proxima: 'ArrowDown' });
    await expect(page.locator('.reg-sheet')).toHaveCount(1); // mover não escolhe nem fecha
  });

  test('quadro: chips de coluna com setas e aria-controls para a coluna', async ({ page }) => {
    await gotoApp(page, '/registros');
    await page.getByRole('tablist', { name: 'Seções de Registros' }).getByRole('tab', { name: 'Tarefas' }).click();
    const chips = page.getByRole('tablist', { name: 'Colunas do quadro' }).getByRole('tab');
    await expect(chips).toHaveCount(5);
    for (const c of await chips.all()) {
      const alvo = await c.getAttribute('aria-controls');
      expect(alvo).toMatch(/^kb-col-/);
      await expect(page.locator(`#${alvo}`)).toHaveAttribute('role', 'tabpanel');
    }
    await chips.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(chips.nth(1)).toBeFocused();
    await expect(chips.nth(1)).toHaveAttribute('aria-selected', 'true');
  });
});

test('Provisões: linha sem controle aninhado (área da linha e Efetivar são irmãos) e Enter abre as ações', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.getByRole('button', { name: 'Remover filtro Este mês' }).click();
  const linha = page.locator('.m-tx-row').filter({ has: page.locator('.m-tx-efetivar') }).first();
  await expect(linha).toBeVisible();
  // Nenhum controle interativo dentro de outro (role=button/button contendo button).
  expect(await page.evaluate(() => [...document.querySelectorAll('.m-tx-row [role="button"] button, [role="button"].m-tx-row button, .m-tx-row button button')].length)).toBe(0);
  const abrir = linha.locator('.m-tx-hit');
  await expect(abrir).toHaveAttribute('aria-label', /^Ações de /);
  await abrir.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.action-sheet')).toBeVisible();
});

test.describe('abas com teclado e painel ligado', () => {
  test('Provisões: segmentado com setas/Home/End e tabpanel aria-labelledby', async ({ page }) => {
    await gotoApp(page, '/financas');
    const tablist = page.getByRole('tablist', { name: 'Seções de Provisões' });
    await conferirAbasComTeclado(page, tablist, ['Transações', 'Metas', 'Categorias']);
    await conferirPainel(page, tablist);
    await expect(page.getByRole('tabpanel', { name: 'Transações' })).toBeVisible();
  });

  test('Registros: segmentado com setas e tabpanel aria-labelledby', async ({ page }) => {
    await gotoApp(page, '/registros');
    const tablist = page.getByRole('tablist', { name: 'Seções de Registros' });
    await conferirAbasComTeclado(page, tablist, ['Caderno', 'Tarefas', 'Jornada']);
    await conferirPainel(page, tablist);
  });

  test('Ritmo: abas de plano com setas e aria-controls', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    const tablist = page.getByRole('tablist', { name: 'Planos' });
    await conferirAbasComTeclado(page, tablist, ['Plano de Treino', 'Plano de Dieta']);
    await conferirPainel(page, tablist);
  });
});
