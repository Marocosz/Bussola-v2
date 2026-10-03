import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { comApi, limparRegistrosE2E } from './registros-data.mjs';

test.beforeAll(async ({ playwright }) => comApi(playwright, limparRegistrosE2E));
test.afterAll(async ({ playwright }) => comApi(playwright, limparRegistrosE2E));

// ---------------------------------------------------------------------------
// Task 1 — lógica pura (importada pelo próprio Vite dev server)
// ---------------------------------------------------------------------------
test.describe('lógica pura', () => {
  test('jornadaUtils: hábitos de hoje, mensagem e data por extenso', async ({ page }) => {
    await gotoApp(page, '/registros');
    const r = await page.evaluate(async () => {
      const j = await import('/src/pages/Registros/jornadaUtils.js');
      const sexta = new Date(2026, 9, 2, 12);
      const h = (status, frequencia, feito) => ({ status, frequencia, registro_hoje: feito == null ? null : { concluido: feito } });
      const habitos = [h('ativo', ['sex'], true), h('ativo', ['sex', 'sab'], false), h('pausado', ['sex'], true), h('ativo', ['seg'], true)];
      return {
        hoje: j.getTodayKey(sexta),
        conta: j.contarHabitosHoje(habitos, sexta),
        vazio: j.contarHabitosHoje([], sexta),
        msg: j.calcularProgressoJornada(habitos, sexta).mensagem,
        msgVazio: j.calcularProgressoJornada([], sexta),
        data: j.formatarDataJornada(sexta),
      };
    });
    expect(r).toEqual({
      hoje: 'sex',
      conta: { feitos: 1, total: 2, pct: 50 },
      vazio: { feitos: 0, total: 0, pct: 0 },
      msg: 'Mais da metade. Bora!',
      msgVazio: { pct: 0, mensagem: 'Comece sua jornada!' },
      data: 'Sexta-feira, 2 de out',
    });
  });
});
