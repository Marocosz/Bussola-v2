import { test, expect } from '@playwright/test';
import { gotoApp, congelarAgenda, animacoesAcabaram } from './helpers.mjs';
import { criarTarefa, tarefaPorTitulo, limparRegistrosE2E } from './registros-data.mjs';

// Varredura final: polimento e robustez no celular.

test('quadro: falha só na releitura depois de gravar não acusa erro nem desfaz a mudança', async ({ page, request }) => {
  await criarTarefa(request, { titulo: 'E2E releitura', status: 'Pendente' });
  try {
    // A gravação (PATCH reordenar) passa; a PRIMEIRA leitura do quadro depois dela falha.
    let gravou = false;
    let falhou = false;
    await page.route(/\/api\/v1\/registros\/tarefas\/reordenar/, async (route) => {
      const r = await route.fetch();
      gravou = true;
      await route.fulfill({ response: r });
    });
    await page.route(/\/api\/v1\/registros\/tarefas\/board/, async (route) => {
      if (gravou && !falhou) { falhou = true; return route.fulfill({ status: 500, json: { detail: 'falha simulada' } }); }
      return route.continue();
    });
    await gotoApp(page, '/registros');
    await page.getByRole('tablist', { name: 'Seções de Registros' }).getByRole('tab', { name: 'Tarefas' }).click();
    await page.locator('.kb-card', { hasText: 'E2E releitura' }).getByRole('button', { name: /^Ações de/ }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Mover para…' }).click();
    await page.locator('.reg-sheet').getByRole('button', { name: 'Bloqueado' }).click();
    await expect.poll(async () => (await tarefaPorTitulo(request, 'E2E releitura'))?.status).toBe('Bloqueado');
    await expect(page.getByText('Agora em Bloqueado.')).toBeVisible();
    expect(falhou).toBe(true);
    await expect(page.getByText('Não consegui salvar a mudança.')).toHaveCount(0);
    await expect(page.locator('.kb-column').nth(2).locator('.kb-card', { hasText: 'E2E releitura' })).toHaveCount(1);
    await expect(page.locator('.kb-column').first().locator('.kb-card', { hasText: 'E2E releitura' })).toHaveCount(0);
  } finally {
    await limparRegistrosE2E(request);
  }
});

test.describe('compromisso (Roteiro)', () => {
  test.beforeEach(async ({ page }) => {
    await congelarAgenda(page);
    await gotoApp(page, '/agenda');
    await page.locator('.app-fab').click();
    await animacoesAcabaram(page);
  });

  test('fechar do cabeçalho é um <button> de verdade com rótulo', async ({ page }) => {
    const fechar = page.locator('.agenda-modal .modal-header').getByRole('button', { name: 'Fechar' });
    await expect(fechar).toHaveCount(1);
    expect(await fechar.evaluate((e) => e.tagName)).toBe('BUTTON');
    await expect(fechar).toHaveAttribute('type', 'button');
    await fechar.click();
    await expect(page.locator('.agenda-modal')).toHaveCount(0);
  });

  for (const largura of [360, 390]) {
    test(`placeholder da hora cabe inteiro no sheet a ${largura}px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      const texto = page.locator('.agenda-modal .pk-datetime-fields .pk-wrapper:last-child .pk-trigger-text');
      await expect(texto).toHaveText('Hora...');
      expect(await texto.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    });
  }
});
