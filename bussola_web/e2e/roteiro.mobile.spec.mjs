import { test, expect } from '@playwright/test';
import { gotoApp, apiJson, congelarAgenda } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Infra do arquivo
// ---------------------------------------------------------------------------
const E2E = 'E2E Roteiro';

// Compromissos de teste (datas no fuso local, como o form envia). Relógio fixo: sex 02/10/2026.
const FIXTURES = [
  [`${E2E} manhã`, '2026-10-02T08:15:00'],
  [`${E2E} noite`, '2026-10-02T20:30:00'],
  [`${E2E} terça`, '2026-10-06T09:00:00'],
  [`${E2E} dia 15`, '2026-10-15T10:00:00'],
];

// Remove tudo que os testes criam (prefixo "E2E "): sem isso a base visual do desktop quebra.
async function limparE2E(request) {
  const dash = await apiJson(request, 'GET', '/agenda/');
  const todos = Object.values(dash.compromissos_por_mes || {}).flat();
  for (const c of todos.filter((x) => String(x.titulo).startsWith('E2E '))) {
    await apiJson(request, 'DELETE', `/agenda/${c.id}`);
  }
}

async function criar(request, titulo, data_hora) {
  return apiJson(request, 'POST', '/agenda/', {
    titulo, data_hora, local: 'Sala E2E', descricao: 'Criado pelo teste E2E', lembrete: false,
  });
}

test.beforeAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  for (const [titulo, dh] of FIXTURES) await criar(r, titulo, dh);
  await r.dispose();
});

test.afterAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  await r.dispose();
});

// ---------------------------------------------------------------------------
// Task 2 — lógica pura (importada pelo próprio Vite dev server)
// ---------------------------------------------------------------------------
test.describe('lógica pura', () => {
  test('semana, grade do mês e rótulos', async ({ page }) => {
    await congelarAgenda(page);
    await gotoApp(page, '/agenda');
    const r = await page.evaluate(async () => {
      const q = await import('/src/pages/Agenda/roteiroDates.js');
      const now = new Date(2026, 9, 2, 12);
      const grade = q.monthGrid(2026, 9);
      const nov = q.monthGrid(2026, 10);
      return {
        chave: q.dayKey(new Date(2026, 9, 2, 23, 59)),
        semana: q.weekKeys('2026-10-02'),
        faixa: q.weekRangeLabel(q.weekKeys('2026-10-02'), now),
        faixaMesmoMes: q.weekRangeLabel(q.weekKeys('2026-10-06'), now),
        faixaAno: q.weekRangeLabel(q.weekKeys('2026-12-31'), now),
        grade: [grade.length, grade[0].key, grade[0].isPadding, grade[4].key, grade[4].isPadding, grade[34].key, grade[5].weekday],
        nov: [nov.length, nov[0].key, nov[0].isPadding, nov.filter((c) => c.isPadding).length],
        mes: q.monthLabel(2026, 9),
        rotulos: ['2026-10-02', '2026-10-03', '2026-10-01', '2026-10-05', '2025-12-31'].map((k) => q.dayHeaderLabel(k, now)),
        partes: q.dayHeaderParts('2026-10-02', now),
        aria: [q.dayAriaLabel('2026-10-02', 0), q.dayAriaLabel('2026-10-02', 1), q.dayAriaLabel('2026-10-06', 3)],
        mais7: q.addDays('2026-10-30', 7),
        menos1: q.addDays('2026-01-01', -1),
      };
    });
    expect(r).toEqual({
      chave: '2026-10-02',
      semana: ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'],
      faixa: '27 set – 3 out',
      faixaMesmoMes: '4 – 10 out',
      faixaAno: '27 dez – 2 jan 2027',
      grade: [35, '2026-09-27', true, '2026-10-01', false, '2026-10-31', 'Sex'],
      nov: [35, '2026-11-01', false, 5],
      mes: 'Outubro de 2026',
      rotulos: ['Hoje · Sex, 2 de outubro', 'Amanhã · Sáb, 3 de outubro', 'Ontem · Qui, 1 de outubro', 'Seg, 5 de outubro', 'Qua, 31 de dezembro de 2025'],
      partes: { rel: 'Hoje', text: 'Sex, 2 de outubro' },
      aria: ['Sexta-feira, 2 de outubro', 'Sexta-feira, 2 de outubro, 1 compromisso', 'Terça-feira, 6 de outubro, 3 compromissos'],
      mais7: '2026-11-06',
      menos1: '2025-12-31',
    });
  });

  test('seções da lista: dia selecionado, próximos/anteriores e busca', async ({ page }) => {
    await congelarAgenda(page);
    await gotoApp(page, '/agenda');
    const r = await page.evaluate(async () => {
      const q = await import('/src/pages/Agenda/roteiroDates.js');
      const c = (id, titulo, data_hora, local = '') => ({ id, titulo, data_hora, local });
      const list = q.flattenCompromissos({
        'Outubro/2026': [
          c(3, 'Dentista', '2026-10-05T09:00:00', 'Consultório'),
          c(1, 'Daily', '2026-10-02T10:00:00'),
          c(2, 'Almoço', '2026-10-02T08:00:00', 'Coco Bambu'),
        ],
        'Setembro/2026': [c(4, 'Review', '2026-09-28T14:00:00', 'Zoom')],
      });
      const fmt = (secs) => secs.map((s) => `${s.key}:${s.items.map((i) => i.id).join(',')}`);
      return {
        ordem: list.map((i) => i.id),
        porDia: [...q.indexByDay(list).keys()],
        asc: fmt(q.buildDaySections(list, '2026-10-02', { order: 'asc' })),
        desc: fmt(q.buildDaySections(list, '2026-10-02', { order: 'desc' })),
        vazio: fmt(q.buildDaySections(list, '2026-10-03', { order: 'asc' })),
        busca: fmt(q.buildDaySections(list, '2026-10-03', { order: 'asc', search: '  ZOOM ' })),
        buscaDesc: fmt(q.buildDaySections(list, '2026-10-03', { order: 'desc', search: 'o' })),
        semNada: fmt(q.buildDaySections([], '2026-10-02', {})),
        semDados: q.flattenCompromissos(undefined).length,
      };
    });
    expect(r).toEqual({
      ordem: [4, 2, 1, 3],
      porDia: ['2026-09-28', '2026-10-02', '2026-10-05'],
      asc: ['2026-10-02:2,1', '2026-10-05:3'],
      desc: ['2026-10-02:2,1', '2026-09-28:4'],
      vazio: ['2026-10-03:', '2026-10-05:3'],
      busca: ['2026-09-28:4'],
      buscaDesc: ['2026-10-05:3', '2026-10-02:2', '2026-09-28:4'],
      semNada: ['2026-10-02:'],
      semDados: 0,
    });
  });
});
