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
