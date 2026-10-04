import { test, expect } from '@playwright/test';
import { gotoApp, congelarAgenda } from './helpers.mjs';

// Varredura final: o que mudou para o toque continua igual com mouse.

test('desktop: selo do card ainda "levanta" no hover do mouse', async ({ page }) => {
  await congelarAgenda(page);
  await gotoApp(page, '/agenda');
  const card = page.locator('.selo-card').first();
  await card.hover();
  await expect(card.locator('.selo-badge')).not.toHaveCSS('transform', 'none');
});
