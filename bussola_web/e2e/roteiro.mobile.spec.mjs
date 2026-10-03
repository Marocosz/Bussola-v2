import { test, expect } from '@playwright/test';
import { gotoApp, apiJson, congelarAgenda, overflowOffenders, smallTargets } from './helpers.mjs';

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

// ---------------------------------------------------------------------------
// Task 3 — layout mobile
// ---------------------------------------------------------------------------
test.describe('layout mobile', () => {
  // A API usa o relógio real; o navegador roda em FIXED_NOW (sex 02/10/2026).
  test.beforeEach(async ({ page }) => {
    await congelarAgenda(page);
  });

  test('topbar "Roteiro", sem page-header, sem 2 colunas e sem tooltip; Fab de novo compromisso', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await expect(page.locator('.m-topbar-title')).toHaveText('Roteiro');
    await expect(page.locator('.page-header')).toHaveCount(0);
    await expect(page.locator('.agenda-layout')).toHaveCount(0);
    await expect(page.locator('.agenda-scope .tooltip')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Novo compromisso' })).toBeVisible();
    await expect(page.locator('.app-fab')).toHaveCount(1);
  });

  test('faixa da semana: domingo a sábado, hoje selecionado, ponto nos dias com compromisso', async ({ page }) => {
    await gotoApp(page, '/agenda');
    const dias = page.locator('.m-week-day');
    await expect(dias).toHaveCount(7);
    await expect(dias.locator('.dia-semana')).toHaveText(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']);
    await expect(dias.locator('.dia-numero')).toHaveText(['27', '28', '29', '30', '1', '2', '3']);
    await expect(page.locator('.m-week-title')).toHaveText('27 set – 3 out');
    const hoje = dias.nth(5);
    await expect(hoje).toHaveAttribute('aria-pressed', 'true');
    await expect(hoje).toHaveAttribute('aria-label', /^Sexta-feira, 2 de outubro, \d+ compromissos?$/);
    await expect(hoje.locator('.dia-card')).toHaveClass(/today/);
    await expect(hoje.locator('.dia-card')).toHaveClass(/is-selected/);
    await expect(hoje.locator('.compromisso-indicator')).not.toHaveClass(/no-event/);
  });

  test('lista: dia selecionado primeiro, depois os próximos dias em ordem, cards em 1 coluna', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await expect(page.locator('.m-day-head').first()).toHaveText('Hoje · Sex, 2 de outubro');
    const hoje = page.locator('.m-day-group').first();
    await expect(hoje.locator('.card-title')).toContainText([`${E2E} manhã`, `${E2E} noite`]);
    const dias = await page.locator('.m-day-group').evaluateAll((els) => els.map((e) => e.dataset.day));
    expect(dias[0]).toBe('2026-10-02');
    for (let i = 1; i < dias.length; i += 1) expect(dias[i] > dias[i - 1]).toBe(true);
    expect(dias).toContain('2026-10-06');
    const caixas = await page.locator('.m-day-cards .compromisso-card-modern').evaluateAll((els) => els.slice(0, 6)
      .map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.width)]; }));
    for (const c of caixas) expect(c).toEqual([16, 358]);
  });

  test('‹ › trocam a semana e levam a seleção junto (mesmo dia da semana)', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await page.getByRole('button', { name: 'Próxima semana' }).click();
    await expect(page.locator('.m-week-title')).toHaveText('4 – 10 out');
    await expect(page.locator('.m-week-day[aria-pressed="true"] .dia-numero')).toHaveText('9');
    await expect(page.locator('.m-day-head').first()).toHaveText('Sex, 9 de outubro');
    await expect(page.locator('.m-week-day').nth(2).locator('.compromisso-indicator')).not.toHaveClass(/no-event/);
    await page.getByRole('button', { name: 'Semana anterior' }).click();
    await page.getByRole('button', { name: 'Semana anterior' }).click();
    await expect(page.locator('.m-week-title')).toHaveText('20 – 26 set');
  });

  test('tocar num dia da faixa leva a lista para ele; hoje continua marcado', async ({ page }) => {
    await gotoApp(page, '/agenda');
    const dias = page.locator('.m-week-day');
    await dias.nth(6).click();
    await expect(dias.nth(6)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.m-day-head').first()).toHaveText('Amanhã · Sáb, 3 de outubro');
    await expect(dias.nth(5).locator('.dia-card')).toHaveClass(/today/);
    await expect(dias.nth(5).locator('.dia-card')).not.toHaveClass(/is-selected/);
  });

  // Ruling 8: fora de hoje, o novo compromisso já vem com o dia selecionado.
  test('Fab: hoje abre o form vazio; outro dia abre com a data dele e a próxima hora cheia', async ({ page }) => {
    await gotoApp(page, '/agenda');
    const fab = page.getByRole('button', { name: 'Novo compromisso' });
    const campos = page.locator('.modal .pk-trigger-text');
    await fab.click();
    await expect(campos).toHaveText(['Data...', 'Hora...']);
    await page.locator('.modal').getByRole('button', { name: 'Cancelar' }).click();
    await page.locator('.m-week-day').nth(6).click();
    await fab.click();
    await expect(campos).toHaveText(['3 de out. de 2026', '13:00']);
  });

  test('busca (título ou local) mostra todos os dias que casam', async ({ page }) => {
    await gotoApp(page, '/agenda');
    const busca = page.getByRole('searchbox', { name: 'Buscar compromissos' });
    const dias = () => page.locator('.m-day-group').evaluateAll((els) => els.map((e) => e.dataset.day));
    await busca.fill('e2e roteiro');
    await expect.poll(dias).toEqual(['2026-10-02', '2026-10-06', '2026-10-15']);
    await busca.fill('Sala E2E');
    await expect.poll(dias).toEqual(['2026-10-02', '2026-10-06', '2026-10-15']);
    await busca.fill('zzz nada casa');
    await expect(page.locator('.m-roteiro-list .empty-list-msg')).toHaveText('Nenhum compromisso encontrado.');
  });

  test('ordenar mostra os dias anteriores ao selecionado, do mais recente ao mais antigo', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await page.getByRole('button', { name: 'Mostrar dias anteriores' }).click();
    await expect(page.getByRole('button', { name: 'Mostrar próximos dias' })).toBeVisible();
    await expect(page.locator('.m-day-head').first()).toHaveText('Hoje · Sex, 2 de outubro');
    const dias = await page.locator('.m-day-group').evaluateAll((els) => els.map((e) => e.dataset.day));
    for (let i = 2; i < dias.length; i += 1) expect(dias[i] < dias[i - 1]).toBe(true);
    for (const d of dias.slice(1)) expect(d < '2026-10-02').toBe(true);
  });

  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/agenda');
      expect(await overflowOffenders(page), `@ ${w}px`).toEqual([]);
    });
  }

  test('alvos de toque ≥ 44px em 360 e 390', async ({ page }) => {
    for (const w of [360, 390]) {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/agenda');
      expect(await smallTargets(page, '.agenda-scope'), `página @ ${w}`).toEqual([]);
      expect(await smallTargets(page, '.m-topbar'), `topbar @ ${w}`).toEqual([]);
    }
  });

  test('espaçamento: gutter 16, 12px livres entre cards, 24 entre dias, 8 dentro do card', async ({ page }) => {
    await gotoApp(page, '/agenda');
    const m = await page.evaluate(() => {
      const r = (el) => el.getBoundingClientRect();
      const grupos = [...document.querySelectorAll('.m-day-group')];
      const cards = [...grupos[0].querySelectorAll('.compromisso-card-modern')];
      const selo2 = r(cards[1].querySelector('.selo-badge'));
      const card = cards[0];
      return {
        esquerda: ['.m-week-head', '.m-week .m-week-cell', '.m-roteiro-tools', '.m-day-head'].map((s) => Math.round(r(document.querySelector(s)).left)),
        direita: Math.round(window.innerWidth - r(card).right),
        // o anel do selo (box-shadow de 4px) faz parte do selo visível
        entreCards: Math.round(selo2.top - 4 - r(cards[0]).bottom),
        entreDias: Math.round(r(grupos[1]).top - r(grupos[0]).bottom),
        faixaParaFerramentas: Math.round(r(document.querySelector('.m-roteiro-tools')).top - r(document.querySelector('.m-week')).bottom),
        dataParaTitulo: Math.round(r(card.querySelector('.card-title')).top - r(card.querySelector('.card-header-row')).bottom),
        celulas: [...document.querySelectorAll('.m-week .m-week-cell')].slice(0, 2).map((e) => Math.round(r(e).left)),
      };
    });
    expect(m.esquerda).toEqual([16, 16, 16, 16]);
    expect(m.direita).toBe(16);
    expect(m.entreCards).toBe(12);
    expect(m.entreDias).toBe(24);
    expect(m.faixaParaFerramentas).toBe(16);
    expect(m.dataParaTitulo).toBe(8);
    expect(m.celulas[1] - m.celulas[0] - (await page.locator('.m-week .m-week-cell').first().evaluate((e) => Math.round(e.getBoundingClientRect().width)))).toBe(8);
  });

  test('≤480: dia da semana abaixo da data no cabeçalho do card; textos ≥ 14px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/agenda');
    const card = page.locator('.m-day-cards .compromisso-card-modern').first();
    const data = await card.locator('.date-big').boundingBox();
    const dia = await card.locator('.weekday-inline').boundingBox();
    expect(dia.y).toBeGreaterThanOrEqual(data.y + data.height - 1);
    await expect(card.locator('.weekday-sep')).toBeHidden();
    const acoes = await card.locator('.top-actions').boundingBox();
    expect(acoes.x + acoes.width).toBeLessThanOrEqual(360 - 16 - 16 + 1);
    for (const sel of ['.card-title', '.info-text', '.weekday-inline', '.m-day-head', '.m-week-title']) {
      const fs = await page.locator(sel).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(fs, sel).toBeGreaterThanOrEqual(14);
    }
  });

  test('editar/excluir sempre visíveis com 44px', async ({ page }) => {
    await gotoApp(page, '/agenda');
    const card = page.locator('.compromisso-card-modern', { hasText: `${E2E} manhã` });
    expect(await card.locator('.top-actions').evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
    for (const nome of ['Editar', 'Excluir']) {
      const b = await card.getByRole('button', { name: nome }).boundingBox();
      expect(Math.round(b.width), nome).toBe(44);
      expect(Math.round(b.height), nome).toBe(44);
    }
  });

  test('o Fab não cobre o fim da lista', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const rodape = await page.locator('.m-day-cards .compromisso-card-modern').last().locator('.card-footer-row').boundingBox();
    const fab = await page.locator('.app-fab').boundingBox();
    expect(rodape.y + rodape.height).toBeLessThanOrEqual(fab.y + 1);
  });
});

// ---------------------------------------------------------------------------
// Task 4 — calendário em sheet e swipe
// ---------------------------------------------------------------------------
test.describe('calendário e swipe', () => {
  test.beforeEach(async ({ page }) => {
    await congelarAgenda(page);
  });

  const abrirCalendario = (page) => page.locator('.m-topbar-slot').getByRole('button', { name: 'Abrir calendário' }).click();

  test('ícone da topbar abre o mês do dia selecionado; tocar num dia leva a faixa e a lista', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await page.evaluate(() => window.scrollTo(0, 600));
    await abrirCalendario(page);
    const sheet = page.locator('.roteiro-cal-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('h3')).toHaveText('Calendário');
    await expect(sheet.locator('.m-cal-title')).toHaveText('Outubro de 2026');
    await expect(sheet.locator('.m-cal-weekday')).toHaveText(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']);
    await expect(sheet.locator('.dias-grid .dia-card')).toHaveCount(35);
    await expect(sheet.locator('.dias-grid .dia-card.dia-padding')).toHaveCount(4);
    await expect(sheet.locator('.dia-card.today .dia-numero')).toHaveText('2');
    await expect(sheet.locator('.dia-card.is-selected .dia-numero')).toHaveText('2');
    const dia15 = sheet.getByRole('button', { name: /^Quinta-feira, 15 de outubro/ });
    await expect(dia15).toHaveClass(/has-compromissos/);
    await dia15.click();
    await expect(sheet).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0);
    await expect(page.locator('.m-week-title')).toHaveText('11 – 17 out');
    await expect(page.locator('.m-week-day[aria-pressed="true"] .dia-numero')).toHaveText('15');
    await expect(page.locator('.m-day-head').first()).toHaveText('Qui, 15 de outubro');
    await expect(page.locator('.m-day-group').first().locator('.card-title')).toContainText([`${E2E} dia 15`]);
  });

  test('‹ › trocam o mês; reabrir mostra o mês do dia escolhido', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await abrirCalendario(page);
    const sheet = page.locator('.roteiro-cal-sheet');
    await sheet.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(sheet.locator('.m-cal-title')).toHaveText('Novembro de 2026');
    await expect(sheet.locator('.dias-grid .dia-card')).toHaveCount(35);
    await expect(sheet.locator('.dias-grid .dia-card.dia-padding')).toHaveCount(5);
    await sheet.getByRole('button', { name: /^Terça-feira, 10 de novembro/ }).click();
    await expect(page.locator('.m-day-head').first()).toHaveText('Ter, 10 de novembro');
    await abrirCalendario(page);
    await expect(page.locator('.roteiro-cal-sheet .m-cal-title')).toHaveText('Novembro de 2026');
    await page.locator('.roteiro-cal-sheet').getByRole('button', { name: 'Mês anterior' }).click();
    await page.locator('.roteiro-cal-sheet').getByRole('button', { name: 'Mês anterior' }).click();
    await expect(page.locator('.roteiro-cal-sheet .m-cal-title')).toHaveText('Setembro de 2026');
    await page.locator('.roteiro-cal-sheet').getByRole('button', { name: 'Fechar' }).click();
    await expect(page.locator('.roteiro-cal-sheet')).toHaveCount(0);
    await expect(page.locator('.m-day-head').first()).toHaveText('Ter, 10 de novembro');
  });

  for (const w of [360, 390, 430, 768]) {
    test(`calendário sem overflow e com alvos ≥ 44px em ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/agenda');
      await abrirCalendario(page);
      await expect(page.locator('.roteiro-cal-sheet')).toBeVisible();
      expect(await overflowOffenders(page), `@ ${w}px`).toEqual([]);
      expect(await smallTargets(page, '.roteiro-cal-sheet'), `@ ${w}px`).toEqual([]);
    });
  }

  test('swipe na faixa troca de semana e descarta o clique do gesto', async ({ page }) => {
    await gotoApp(page, '/agenda');
    const strip = page.locator('.m-week-strip');
    const b = await strip.boundingBox();
    const y = b.y + b.height / 2;
    const gesto = async (de, para) => {
      await strip.dispatchEvent('pointerdown', { clientX: de, clientY: y, pointerType: 'touch', isPrimary: true });
      await strip.dispatchEvent('pointerup', { clientX: para, clientY: y + 4, pointerType: 'touch', isPrimary: true });
    };
    await gesto(b.x + b.width - 20, b.x + 20); // para a esquerda → próxima semana
    await expect(page.locator('.m-week-title')).toHaveText('4 – 10 out');
    // o clique que o navegador dispara ao fim do gesto não seleciona o dia sob o dedo
    await page.locator('.m-week-day').nth(1).dispatchEvent('click');
    await expect(page.locator('.m-week-day[aria-pressed="true"] .dia-numero')).toHaveText('9');
    // um toque normal depois seleciona
    await page.locator('.m-week-day').nth(1).click();
    await expect(page.locator('.m-week-day[aria-pressed="true"] .dia-numero')).toHaveText('5');
    await gesto(b.x + 20, b.x + b.width - 20); // para a direita → semana anterior
    await expect(page.locator('.m-week-title')).toHaveText('27 set – 3 out');
    await gesto(b.x + 100, b.x + 80); // curto demais: não troca
    await expect(page.locator('.m-week-title')).toHaveText('27 set – 3 out');
  });

  test('passou da meia-noite: ao voltar à página, "Hoje" passa para o dia 3', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await expect(page.locator('.m-day-head').first()).toHaveText('Hoje · Sex, 2 de outubro');
    await page.clock.setFixedTime(new Date('2026-10-03T00:30:00-03:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.locator('.m-day-head').first()).toHaveText('Hoje · Sáb, 3 de outubro');
    await expect(page.locator('.m-week-day .dia-card.today .dia-numero')).toHaveText('3');
    await expect(page.locator('.m-week-day[aria-pressed="true"] .dia-numero')).toHaveText('3');
  });
});

// ---------------------------------------------------------------------------
// Task 5 — form em sheet e ações do card
// ---------------------------------------------------------------------------
test.describe('novo compromisso e ações do card', () => {
  test.beforeEach(async ({ page }) => { await congelarAgenda(page); });
  const form = (page) => page.locator('.modal-overlay.is-sheet.agenda-modal');
  const titulo = (page) => form(page).locator('input[placeholder="Ex: Reunião de Equipe"]');

  test('Fab abre o form em sheet: Título e Data/Hora empilhados, lembrete no corpo, rodapé 50/50', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await page.getByRole('button', { name: 'Novo compromisso' }).click();
    await expect(form(page).locator('h3')).toHaveText('Novo Compromisso');
    await page.waitForTimeout(500); // deixa a animação do sheet terminar (medidas em subpixel)
    const t = await titulo(page).boundingBox();
    const dh = await form(page).locator('.pk-datetime-wrapper').boundingBox();
    expect(dh.y).toBeGreaterThanOrEqual(t.y + t.height);
    expect(Math.round(dh.width)).toBe(Math.round(t.width));
    // 16 de padding do corpo, contados a partir da borda interna do .modal-content (que tem 1px de borda)
    const recuo = await form(page).locator('.modal-content').evaluate((c) => c.clientLeft);
    expect(Math.round(t.x)).toBe(16 + recuo);
    await expect(form(page).locator('.modal-body .agenda-lembrete')).toBeVisible();
    await expect(form(page).locator('.modal-footer .agenda-lembrete')).toHaveCount(0);
    const cancelar = await form(page).getByRole('button', { name: 'Cancelar' }).boundingBox();
    const salvar = await form(page).getByRole('button', { name: 'Salvar' }).boundingBox();
    expect(Math.abs(cancelar.width - salvar.width)).toBeLessThanOrEqual(1);
    expect(Math.round(cancelar.height)).toBeGreaterThanOrEqual(48);
    expect(Math.round(salvar.y)).toBe(Math.round(cancelar.y));
    expect(await smallTargets(page, '.agenda-modal')).toEqual([]);
    expect(await overflowOffenders(page)).toEqual([]);
    await form(page).getByRole('button', { name: 'Fechar' }).click();
    await expect(form(page)).toHaveCount(0);
  });

  test('teclado aberto (--vvh): Salvar continua visível e o corpo rola até a descrição', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--vvh', '420px');
      document.documentElement.style.setProperty('--kb-inset', '424px');
    });
    await page.getByRole('button', { name: 'Novo compromisso' }).click();
    const salvar = form(page).getByRole('button', { name: 'Salvar' });
    await expect(salvar).toBeVisible();
    await expect.poll(async () => { const b = await salvar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
    await form(page).locator('.modal-body').evaluate((b) => b.scrollTo(0, 99999));
    const desc = await form(page).locator('textarea').boundingBox();
    expect(desc.y + desc.height).toBeLessThanOrEqual(420);
  });

  test('criar pelo Fab: aparece na lista de hoje com hora e lembrete', async ({ page, request }) => {
    await gotoApp(page, '/agenda');
    await page.getByRole('button', { name: 'Novo compromisso' }).click();
    await titulo(page).fill(`${E2E} criado no celular`);
    await form(page).locator('.pk-trigger').first().click();
    await page.locator('.pk-date-panel').getByRole('button', { name: 'Hoje' }).click();
    await form(page).locator('.pk-trigger').nth(1).click();
    const horas = page.locator('.pk-panel.pk-panel--sheet');
    await horas.locator('.pk-time-col').first().locator('[data-v="21"]').click();
    await horas.locator('.pk-time-col').nth(1).locator('[data-v="00"]').click();
    await expect(horas).toHaveCount(0);
    await form(page).getByText('Ativar Lembrete').click();
    await form(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(form(page)).toHaveCount(0);
    const card = page.locator('.m-day-group').first().locator('.compromisso-card-modern', { hasText: `${E2E} criado no celular` });
    await expect(card).toBeVisible();
    await expect(card.locator('.time-big')).toHaveText('21:00');
    const dash = await apiJson(request, 'GET', '/agenda/');
    const salvo = Object.values(dash.compromissos_por_mes).flat().find((c) => c.titulo === `${E2E} criado no celular`);
    expect(salvo.lembrete).toBe(true);
    expect(salvo.data_hora.startsWith('2026-10-02T21:00')).toBe(true);
  });

  test('editar pelo card: o form abre preenchido e salva', async ({ page }) => {
    await gotoApp(page, '/agenda');
    const card = page.locator('.compromisso-card-modern', { hasText: `${E2E} manhã` });
    await card.getByRole('button', { name: 'Editar' }).click();
    await expect(form(page).locator('h3')).toHaveText('Editar Compromisso');
    await expect(titulo(page)).toHaveValue(`${E2E} manhã`);
    await expect(form(page).locator('.pk-trigger').nth(1)).toContainText('08:15');
    await titulo(page).fill(`${E2E} manhã editado`);
    await form(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(form(page)).toHaveCount(0);
    await expect(page.locator('.card-title', { hasText: `${E2E} manhã editado` })).toBeVisible();
    // reabrir "Novo" depois de editar começa vazio (estado não vaza entre aberturas)
    await page.getByRole('button', { name: 'Novo compromisso' }).click();
    await expect(titulo(page)).toHaveValue('');
  });

  test('Concluir e Reabrir pelo card', async ({ page }) => {
    await gotoApp(page, '/agenda');
    const card = page.locator('.compromisso-card-modern', { hasText: `${E2E} noite` });
    await card.getByRole('button', { name: /Concluir/ }).click();
    await expect(card).toHaveClass(/realizado/);
    await expect(card.getByRole('button', { name: /Reabrir/ })).toBeVisible();
    await card.getByRole('button', { name: /Reabrir/ }).click();
    await expect(card.getByRole('button', { name: /Concluir/ })).toBeVisible();
  });

  test('excluir pelo card (com confirmação)', async ({ page, request }) => {
    await criar(request, `${E2E} para excluir`, '2026-10-02T22:00:00');
    await gotoApp(page, '/agenda');
    const card = page.locator('.compromisso-card-modern', { hasText: `${E2E} para excluir` });
    await card.getByRole('button', { name: 'Excluir' }).click();
    await page.locator('.confirm-overlay').getByRole('button', { name: 'Excluir' }).click();
    await expect(card).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Conferência visual (só com ROTEIRO_SHOTS=1): lista, calendário e form em 360/390/430
// ---------------------------------------------------------------------------
test('capturas para conferência visual', async ({ page }) => {
  test.skip(!process.env.ROTEIRO_SHOTS, 'só na conferência visual (ROTEIRO_SHOTS=1)');
  await congelarAgenda(page);
  for (const w of [360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 844 });
    await gotoApp(page, '/agenda');
    await page.screenshot({ path: `test-results/roteiro-${w}-lista.png` });
    await page.screenshot({ path: `test-results/roteiro-${w}-lista-inteira.png`, fullPage: true });
    await page.locator('.m-topbar-slot').getByRole('button', { name: 'Abrir calendário' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/roteiro-${w}-calendario.png` });
    await page.locator('.roteiro-cal-sheet').getByRole('button', { name: 'Fechar' }).click();
    await page.getByRole('button', { name: 'Novo compromisso' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/roteiro-${w}-form.png` });
    await page.locator('.agenda-modal').getByRole('button', { name: 'Cancelar' }).click();
  }
});
