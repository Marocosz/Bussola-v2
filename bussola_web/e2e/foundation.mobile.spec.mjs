import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test('tokens existem e viewport cobre a safe area', async ({ page }) => {
  await gotoApp(page, '/cofre');
  const t = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return { sp3: s.getPropertyValue('--sp-3').trim(), zSheet: s.getPropertyValue('--z-sheet').trim(), nav: s.getPropertyValue('--bottom-nav-h').trim() };
  });
  expect(t).toEqual({ sp3: '12px', zSheet: '300', nav: '64px' });
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
});

test('inputs têm 16px no mobile (sem zoom do iOS)', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await page.getByRole('button', { name: 'Guardar Segredo' }).click();
  const sizes = await page.locator('.modal-content input, .modal-content textarea').evaluateAll(
    (els) => els.map((e) => getComputedStyle(e).fontSize));
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) expect(s).toBe('16px');
});

test('tooltip global não aparece em dispositivo de toque', async ({ page }) => {
  await gotoApp(page, '/financas');
  // Dispara o mouseover (o que o tap sintético gera no toque) num elemento com title na viewport.
  const ok = await page.evaluate(() => {
    for (const e of document.querySelectorAll('[title]')) {
      const b = e.getBoundingClientRect();
      if (b.width && b.height && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight) {
        e.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: b.left + 2, clientY: b.top + 2 }));
        return true;
      }
    }
    return false;
  });
  expect(ok).toBe(true);
  await page.waitForTimeout(300);  await expect(page.locator('.app-tooltip')).toHaveCount(0);
});


