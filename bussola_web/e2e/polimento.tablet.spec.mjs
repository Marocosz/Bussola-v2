import { test, expect } from '@playwright/test';
import { gotoApp, congelarAgenda } from './helpers.mjs';

// Varredura final: polimento no tablet (toque, sem hover).

test('selo do card não "levanta" no toque (hover só com mouse)', async ({ page }) => {
  await congelarAgenda(page);
  await gotoApp(page, '/agenda');
  const card = page.locator('.selo-card').first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await expect(card.locator('.selo-badge')).toHaveCSS('transform', 'none');
});
