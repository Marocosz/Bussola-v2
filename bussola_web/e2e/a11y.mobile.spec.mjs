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
