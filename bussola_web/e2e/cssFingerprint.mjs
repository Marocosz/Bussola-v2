// Ferramenta da Task 1 do plano mobile-04 (escopo do Agenda/styles.css).
// Grava (CSS_ESCOPO=gravar) ou compara (CSS_ESCOPO=comparar) os estilos computados dos
// elementos que usam classes definidas no Agenda/styles.css, em todas as rotas. Sem a
// variável, os testes são pulados (outras páginas mudam nos planos seguintes).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { gotoApp, apiJson } from './helpers.mjs';

const SELETORES = [
  '.main-container', '.btn-action-icon', '.layout-grid-custom', '.agenda-column', '.column-header-flex',
  '.header-actions-group', '.header-search-wrapper', '.header-search-input', '.header-search-icon',
  '.btn-filter-sort', '.small-btn', '.empty-list-msg', '.calendar-nav-header', '.btn-nav-arrow',
  '.month-group', '.month-header', '.accordion-wrapper', '.accordion-inner', '.compromissos-grid',
  '.compromisso-card-modern', '.card-header-row', '.date-big', '.weekday-inline', '.top-actions',
  '.card-title', '.info-modern-row', '.info-text', '.card-footer-row', '.selo-status-tag',
  '.btn-concluir-action', '.btn-cancelar-action', '.footer-actions', '.dias-grid', '.dia-card',
  '.dia-numero', '.dia-semana', '.compromisso-indicator', '.tooltip', '.selo-badge',
];

const PROPS = [
  'display', 'position', 'z-index', 'width', 'height', 'min-height', 'box-sizing',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-top-style', 'border-top-color', 'border-right-width', 'border-bottom-width',
  'border-top-left-radius', 'border-top-right-radius', 'background-color', 'color',
  'font-size', 'font-weight', 'gap', 'justify-content', 'align-items', 'opacity', 'text-transform',
  'grid-template-columns', 'flex-wrap',
];

// Todas as rotas do app (routes/index.jsx). /estudos/:id usa o primeiro material do banco demo.
const ROTAS = [
  ['home', '/home'], ['panorama', '/panorama'], ['financas', '/financas'], ['agenda', '/agenda'],
  ['registros', '/registros'], ['estudos', '/estudos'], ['estudos-kit', '/estudos/kit'],
  ['estudos-leitura', 'leitura'], ['ritmo', '/ritmo'], ['cofre', '/cofre'],
  ['discord-link', '/discord/link'], ['conexoes-autorizar', '/conexoes/autorizar'], ['ui-lab', '/__ui'],
];

// Rotas públicas: abertas sem sessão (senão redirecionam para o app).
const ROTAS_PUBLICAS = [
  ['login', '/login'], ['register', '/register'], ['forgot-password', '/forgot-password'],
  ['reset-password', '/reset-password'], ['verify-email', '/verify-email'], ['register-success', '/register-success'],
];

// Aba/segmento pelo texto (desktop: .tab-btn-pill; celular: Segmented [role=tab]).
const aba = async (page, texto) => {
  await page.locator('.tab-btn-pill, [role="tab"]').filter({ hasText: texto }).first().click();
  await page.waitForLoadState('networkidle');
};

// Estados além da carga inicial onde aparecem classes do Agenda/styles.css (abas, modais, hover).
const ESTADOS = [
  ['registros-tarefas', '/registros', (p) => aba(p, 'Tarefas')],
  ['registros-jornada', '/registros', (p) => aba(p, 'Jornada')],
  ['ritmo-dieta', '/ritmo', (p) => aba(p, 'Dieta')],
  ['agenda-modal', '/agenda', async (p) => {
    await p.locator('.btn-primary', { hasText: 'Adicionar' }).click();
    await p.locator('.modal-content').waitFor();
  }, 'desktop'],
  ['financas-caixa', '/financas', async (p) => {
    await p.locator('.ph-kpi-btn').first().click();
    await p.locator('.modal-content').waitFor();
    await p.waitForLoadState('networkidle');
  }, 'desktop'],
  ['financas-metas', '/financas', async (p) => {
    await p.locator('.metas-entry').first().click();
    await p.locator('.modal-content').waitFor();
    await p.waitForLoadState('networkidle');
  }, 'desktop'],
  ['financas-hover-editar', '/financas', async (p) => {
    // As ações da linha só recebem o ponteiro com a linha em hover (button → inner → .row-actions → linha).
    const btn = p.locator('.row-actions .btn-action-icon.btn-edit-transacao').first();
    await btn.locator('xpath=../../..').hover();
    await p.waitForTimeout(300);
    await btn.hover();
  }, 'desktop'],
  ['home-minha-conta', '/home', async (p) => {
    await p.getByText('Minha Conta', { exact: true }).first().click();
    await p.waitForLoadState('networkidle');
  }, 'desktop'],
];

const NEWS = Array.from({ length: 8 }, (_, i) => ({
  title: `Noticia de exemplo numero ${i + 1} para o feed rapido`,
  url: 'https://example.com/noticia',
  source: { name: 'Fonte Demo' },
  topic: 'tech',
}));

export async function fingerprint(page) {
  return page.evaluate(({ sels, props }) => {
    const out = {};
    for (const s of sels) {
      const els = [...document.querySelectorAll(s)].slice(0, 8);
      if (!els.length) continue;
      out[s] = els.map((el) => {
        const cs = getComputedStyle(el);
        return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
      });
    }
    return out;
  }, { sels: SELETORES, props: PROPS });
}

// O banco demo não tem material de estudo (só o MCP cria): sem nenhum, a leitura usa um
// material simulado na rede, para renderizar a página carregada (não o "não encontrado").
const MATERIAL_ID = 987654;
const MATERIAL = {
  id: MATERIAL_ID, titulo: 'Material de exemplo', subtitulo: 'Subtitulo de exemplo', tipo: 'resumo', nivel: 'basico',
  tags: ['exemplo'], tema_id: null, tema_nome: null, tema_cor: null, estudado: false, estudado_em: null,
  criado_em: '2026-09-01T10:00:00', atualizado_em: '2026-09-01T10:00:00', blocos: [], fontes: [],
};

async function rotaDeLeitura(page, request) {
  const lista = await apiJson(request, 'GET', '/estudos/materiais');
  if (lista.length) return `/estudos/${lista[0].id}`;
  await page.route(new RegExp(`/estudos/materiais/${MATERIAL_ID}(\\?.*)?$`), (route) => route.fulfill({ json: MATERIAL }));
  return `/estudos/${MATERIAL_ID}`;
}

async function conferir(page, projeto, nome) {
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  await page.waitForTimeout(300);
  const atual = await fingerprint(page);
  const file = path.resolve('e2e/fixtures', `css-escopo-${projeto}-${nome}.json`);
  if (process.env.CSS_ESCOPO === 'gravar') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(atual, null, 1));
    return;
  }
  expect(atual).toEqual(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function registrarTestesDeEscopo(projeto) {
  test.skip(!process.env.CSS_ESCOPO, 'só na Task 1 do plano mobile-04 (CSS_ESCOPO=gravar|comparar)');

  for (const [nome, rota] of ROTAS) {
    test(`estilos computados de ${nome} (${projeto}) não mudam`, async ({ page, request }) => {
      if (nome === 'home') await page.route(/\/home\/news(\?.*)?$/, (route) => route.fulfill({ json: NEWS }));
      const destino = rota === 'leitura' ? await rotaDeLeitura(page, request) : rota;
      await gotoApp(page, destino);
      if (rota === 'leitura') await page.locator('.estudo-leitura').waitFor();
      await conferir(page, projeto, nome);
    });
  }

  for (const [nome, rota] of ROTAS_PUBLICAS) {
    test(`estilos computados de ${nome} sem sessão (${projeto}) não mudam`, async ({ page }) => {
      await page.addInitScript(() => { try { localStorage.clear(); } catch { /* sem storage */ } });
      await gotoApp(page, rota);
      await conferir(page, projeto, nome);
    });
  }

  for (const [nome, rota, preparar, so] of ESTADOS) {
    if (so && so !== projeto) continue;
    test(`estilos computados de ${nome} (${projeto}) não mudam`, async ({ page }) => {
      if (rota === '/home') await page.route(/\/home\/news(\?.*)?$/, (route) => route.fulfill({ json: NEWS }));
      await gotoApp(page, rota);
      await preparar(page);
      await conferir(page, projeto, nome);
    });
  }
}
