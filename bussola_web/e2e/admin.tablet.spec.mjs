import { test, expect } from '@playwright/test';
import { gotoApp, smallTargets, animacoesAcabaram } from './helpers.mjs';

// 769 touch usa o modal do desktop: fechar e rodapé precisam de alvo de toque >= 44px.
test('769 touch: modal Novo Usuário com alvos >= 44px', async ({ page }) => {
  await page.setViewportSize({ width: 769, height: 1024 });
  await gotoApp(page, '/panorama');
  await page.locator('button[title="Criar Novo Usuário"]').click();
  await page.locator('.admin-modal-content').waitFor();
  await animacoesAcabaram(page);
  expect(await smallTargets(page, '.admin-modal-content')).toEqual([]);
});
