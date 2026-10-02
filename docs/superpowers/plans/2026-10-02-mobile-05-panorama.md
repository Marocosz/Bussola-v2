# Mobile 05: Panorama no celular, plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o layout da página Panorama (`/panorama`) para o celular na opção aprovada "Cubo em cima": cubo de ~150px centralizado com rótulo, total, barras e período + privacidade abaixo; KPIs em grade 2×2 com Projeção numa linha inteira; widgets empilhados em 1 coluna na ordem aprovada, mantendo o design atual; "Atenção agora" como carrossel de 1 card só com alertas reais; legenda visível no donut; Evolução com 6 meses e leitura por toque. Tablet ganha a grade de 6 colunas (spec §6). Desktop (≥1025) fica idêntico.

**Architecture:**
- Tudo continua em `Panorama/index.jsx` (dono do estado). O JSX do return é reorganizado **sem mudar o DOM do desktop**: as seções do topo (`atencao`, `hero`, `kpis`) e os 10 widgets do grid viram constantes JSX num objeto, renderizadas por listas de chaves (`TOPO_DESKTOP`/`WIDGETS_DESKTOP`). No celular (`useIsMobile()`) as listas trocam para `TOPO_MOBILE`/`WIDGETS_MOBILE`. Como cada item é um `React.Fragment` com `key`, cruzar 768px **move** os nós em vez de remontar (o `DateRangeFilter` guarda o preset no estado interno e não pode remontar).
- Os spans inline (`style={{ gridColumn: 'span N' }}`) viram classes `.span-4/6/8/12` (+ `.is-wide-tablet` em Evolução e Pagamento); estilos inline com fonte pequena viram classes com os **mesmos valores do desktop**, para o celular poder sobrescrever. Cada card ganha `data-widget="<chave>"` (só atributo, usado pelos testes).
- Todo o CSS novo fica em `Panorama/panorama-v2.css`, em blocos `@media` no fim do arquivo (tablet, celular, `pointer: coarse`, `hover`). O `styles.css` v1 perde o CSS morto.
- Interações novas, só no celular: carrossel scroll-snap com indicador; botões de mês (44px) alinhados às colunas da Evolução + linha de leitura fixa; passo ‹ › com leitura na "Média por dia". O cubo fica parado no celular e com `prefers-reduced-motion` (as bolhas SMIL não são cobertas pelo CSS global).
- Testes: Playwright (`panorama.desktop.spec.mjs`, `panorama.mobile.spec.mjs`, `panorama.tablet.spec.mjs`) com um **payload fixo** do Panorama (`e2e/panorama-fixture.mjs`) servido por `page.route`. Nenhum teste grava no banco.

**Tech Stack:** React 19, Vite 7, CSS puro, SVG inline, Font Awesome (npm), `@playwright/test` 1.63.

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-responsivo-design.md` (§2 restrições, §4 fundação, §5.4 Panorama, §6 tablet, §8 verificação). Este plano é a etapa 7 da §7.
**Planos anteriores:** `2026-10-02-mobile-01-fundacao-shell.md` (harness, tokens, `Sheet`, shell; implementado) e `2026-10-02-mobile-02-provisoes.md` (cria em `e2e/helpers.mjs` os helpers `authHeaders`, `apiJson`, `smallTargets`, que este plano **reusa**). Pré-requisito: `grep -n "export async function smallTargets" bussola_web/e2e/helpers.mjs` encontra a função. Se não encontrar, pare: o plano 02 (Task 1, Step 3) ainda não foi executado.

## Global Constraints

- **Branch:** `feat/mobile-responsivo` (worktree `.claude/worktrees/mobile-responsivo`). Um commit por task. **Nunca** fazer push nem merge em `main`. Nunca usar `git stash`.
- **Commits** terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use um segundo `-m`).
- **Não redesenhar os widgets:** cubo (`Reservoir`), cards de alerta (chip, severidade, CTA "Ver →"), barras de orçamento, jarros (`MiniJar`), donut, barras de pagamento, gráficos SVG, Ritmo/Produtividade/Agenda/Cofre. Só ordem, largura, espaçamento, tamanho de fonte, quebra, alvo de toque e informação visível no lugar do tooltip. O que é novo (legenda do donut, botões de mês, leituras, indicador do carrossel) reusa o vocabulário visual existente (amostras de cor da legenda da Evolução, botão redondo `.pv2-attn-arrow`, pontos do carrossel).
- **Ícones:** só classes Font Awesome que já existem no código. Usadas neste plano: `fa-gauge-high`, `fa-chevron-left`, `fa-chevron-right`, `fa-xmark`, `fa-eye`, `fa-eye-slash`, `fa-lock`, `fa-circle-check`, `fa-triangle-exclamation`, `fa-clock`, `fa-circle-info`, `fa-chart-pie`, `fa-credit-card`, `fa-list-check`, `fa-heart-pulse`, `fa-dumbbell`, `fa-fire`, `fa-key`, `fa-regular fa-clock`, `fa-circle-notch`.
- **Espaçamento (tokens `--sp-1..6` = 4/8/12/16/24/32):** 8 dentro do card, 12 entre cards (gap do grid e do carrossel), 16 de gutter lateral e padding do card, 24 entre seções (hero → KPIs → Atenção → grid). Nenhum valor solto fora da escala no CSS novo, exceto tamanhos de controle (36/44/48/52/56px) e as classes que **copiam** um estilo inline do desktop (valores idênticos ao inline atual, para o desktop não mudar).
- **Toque:** alvo ≥ 44×44 em tudo que é interativo; nenhuma ação ou informação só no hover (tooltip não funciona com `hover: none`: legenda do donut, leitura da Evolução e da Média por dia substituem).
- **Tipografia mobile:** conteúdo principal ≥ 14px, secundário ≥ 12px, 11px só em rótulos em caixa alta.
- **Desktop (≥1025):** visualmente idêntico. Os PNGs de `e2e/desktop-visual.desktop.spec.mjs-snapshots/` (incluindo `panorama`) e os 2 novos de `panorama.desktop.spec.mjs-snapshots/` (Task 1) têm que passar em toda task. Tablet (769–1024) muda conforme a spec §6.
- **Sem mudança de API/backend.** `getPanoramaData` e os handlers atuais.
- **Dados de teste:** os testes não criam nada no banco. Os alertas do payload fixo têm ids `e2e-*`; o "dispensar" só grava no `localStorage` do contexto do teste (que é descartado).
- **Lint:** `npx eslint src/pages/Panorama` sem erros (linha de base medida: **0 problemas**). Regras v7: sem `setState` síncrono em `useEffect`, sem mutar acumuladores no render, `catch {` sem variável.
- **Build:** `npm run build` passa.

## API real dos primitivos (lida do código, use exatamente isto)

- `useIsMobile()` (≤768) e `useMediaQuery(query)` de `src/hooks/useIsMobile.js` (via `useSyncExternalStore`; `false` no SSR).
- `DateRangeFilter({ initialPreset = 'mes', onChange })` (`src/components/DateRangeFilter.jsx`): o **preset fica no estado interno** (por isso o componente não pode remontar). No celular abre `<Sheet title="Período">` (portal no `body`) com itens `div.drf-item` (48px) e, no "Personalizado", dois `DatePicker size="sm"` (`button.pk-trigger`). O gatilho é `button.drf-trigger`, com 44px sob `pointer: coarse` (regra global em `global.css`).
- `Sheet`: portal no `body`, dentro de `BaseModal` → `.modal-overlay.app-sheet-overlay.is-sheet` no celular. Fica fora de `.panorama-scope`, então as regras `.panorama-scope .modal-*` do `styles.css` v1 não alcançam nada (estão mortas).
- `TooltipHost` (`src/components/Tooltip.jsx`) só registra listeners quando `(hover: hover)` casa: no celular e no tablet `data-tooltip`/`title` não mostram nada.
- `tokens.css` já pausa as **animações CSS** com `prefers-reduced-motion: reduce` (`animation-duration: .01ms !important; animation-iteration-count: 1 !important`), o que cobre `pv2-floaty`, o `pv2-bob` inline e as ondas dos jarros. **Não cobre** os `<animate>` SMIL das bolhas do cubo.
- Shell: no celular o `.page-header` sem `.page-header-kpis` some (`global.css`) e o título "Panorama" vem da topbar. `.container` tem gutter de 16px ≤768 (`layout.css`). `.app-content` já tem `padding-bottom` da barra inferior. `Agenda/styles.css` define um `.main-container { padding-bottom: 5rem !important; min-height: 100vh }` **global** (fora do escopo deste plano) que também pega o Panorama; para vencer no celular use `.panorama-scope.main-container { … !important }`.
- **Ordem do CSS**: as páginas são importadas de forma estática em `routes/index.jsx` (Navbar → … Registros → … Panorama → Cofre → Ritmo); `main.jsx` importa `mobile.css`, `components.css` e `global.css` **depois** de `App`. Consequências: (1) o `@keyframes fadeInOverlay` de `global.css` (idêntico ao do Panorama) é o vencedor; (2) o `@keyframes scaleInModal` do `Panorama/styles.css` é a **definição vencedora** usada pelos modais de Registros e do `AdminUserModal` (os outros dois têm `scale(.95)`/`scale(.98)` diferentes) — por isso ele **fica**.
- `overflowOffenders(page)` ignora elementos dentro de `[data-offscreen-ok]` (o carrossel usa isso). `smallTargets(page, rootSelector)` (plano 02) lista `button, a[href], select, [role="button"], [role="tab"], input` visíveis menores que 43,5px.
- Projetos Playwright por sufixo: `*.mobile.spec.mjs` (390×844, touch, `pointer: coarse`, `hover: none`), `*.tablet.spec.mjs` (900×1200, touch), `*.desktop.spec.mjs` (1280×900, mouse). Relógio do navegador fixo em `2026-10-02 12:00 -03:00`; `toHaveScreenshot` com `animations: 'disabled'` e `maxDiffPixelRatio: 0.002`.
- A API fica em `http://127.0.0.1:8000/api/v1` no dev; o Panorama chama `GET /panorama/?start=AAAA-MM-DD&end=AAAA-MM-DD` (`end` exclusivo).
- Banco demo (`populate_db.py`): transações, categorias com limite, Ritmo, tarefas, compromissos, cofre. **Sem metas** (os 3 jarros aparecem "Vazio") e os alertas dependem da data do servidor. Por isso os testes de layout usam o payload fixo.

## Review Focus

1. **Remontar o `DateRangeFilter` ao reordenar o topo** (girar o celular cruza 768px: o rótulo volta para "Este mês" enquanto o intervalo continua outro). As seções são `Fragment` com `key`; o hero não muda de pai. Teste na Task 2 › "cruzar 768px com um período escolhido mantém o filtro".
2. **Carrossel do "Atenção agora"** (cards fora da tela contados como overflow, indicador apontando o card errado, dispensar o card errado, placeholders "Sem aviso aqui" voltando no celular). Testes na Task 4 › "só alertas reais, 1 por vez…" e "dispensar com alvo de 44px…".
3. **Regressão no desktop pelo refactor do JSX/inline → classes** (um span, uma fonte, um gap fora do lugar). Testes na Task 1 › `panorama.desktop.spec.mjs` (2 bases com payload fixo) + `desktop-visual` › `panorama`, rodados em toda task.
4. **Leitura da Evolução mostrando o mês errado** (o `slice(-6)` desloca os índices; o padrão é o último mês; tocar na coluna e no botão tem que dar o mesmo mês). Teste na Task 5 › "Evolução: 6 meses, botões de 44px e leitura fixa".
5. **Hero estourando 360px ou valores sem privacidade** (total com 7 dígitos; legenda/leitura nova sem `data-money` ficaria legível com o olho fechado). Testes na Task 3 › "sem overflow em 360px (valores grandes)" e Task 5 › "privacidade borra a legenda e as leituras".

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `bussola_web/e2e/panorama-fixture.mjs` | criar | payload fixo do `GET /panorama/` + `usarFixture(page, opts)` |
| `bussola_web/e2e/panorama.desktop.spec.mjs` | criar | bases visuais com payload fixo, estrutura do grid, nada do mobile, movimento reduzido |
| `bussola_web/e2e/panorama.mobile.spec.mjs` | criar | ordem/colunas, hero, KPIs, período, overflow, carrossel, widgets, fontes, alvos |
| `bussola_web/e2e/panorama.tablet.spec.mjs` | criar | grade de 6 colunas (dense), overflow, alvos de 44px |
| `bussola_web/src/pages/Panorama/index.jsx` | modificar | seções/widgets por chave; classes no lugar de spans/inline; ordem mobile; carrossel; legenda; Evolução/Média com leitura; cubo parado |
| `bussola_web/src/pages/Panorama/panorama-v2.css` | modificar | remove CSS morto; classes que substituem inline; blocos tablet/celular/toque/hover |
| `bussola_web/src/pages/Panorama/styles.css` | modificar | remove modais/tabelas mortos e `fadeInOverlay`; `dvh`; privacidade com hover só no mouse e 44px no toque |

---

### Task 1: Base visual do desktop + refactor sem mudança visual (classes, chaves, CSS morto)

**Files:**
- Create: `bussola_web/e2e/panorama-fixture.mjs`, `bussola_web/e2e/panorama.desktop.spec.mjs`
- Modify: `bussola_web/src/pages/Panorama/index.jsx`, `bussola_web/src/pages/Panorama/panorama-v2.css`, `bussola_web/src/pages/Panorama/styles.css`

**Interfaces:**
- Produces:
  - `PANORAMA_API` (regex), `MESES12`, `RECEITA12`, `DESPESA12`, `ALERTAS` (5 alertas `e2e-*`), `panoramaFixture({ insights = 3, caixa = 18500, guardado = 4200 })`, `usarFixture(page, opts?)`.
  - No `index.jsx`: constantes de módulo `TOPO_DESKTOP = ['atencao', 'hero', 'kpis']` e `WIDGETS_DESKTOP = ['evolucao', 'donut', 'orcamento', 'cofrinhos', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre']`; dentro do componente: `renderAlert(it)`, `atencao`, `hero`, `kpiCells`, `projecao`, `poupanca`, `kpiBand`, `widgets` (objeto por chave), `topo`.
  - Classes: `.span-4/.span-6/.span-8/.span-12`, `.is-wide-tablet`, `.pv2-hero-info`, `.pv2-hero-label-extra`, `.pv2-kpi-proj`, `.pv2-legend`, `.pv2-legend-item`, `.pv2-proj-chip`, `.pv2-kpi-big`, `.pv2-ritmo-row`, `.pv2-cofre-cap`; atributo `data-widget` em cada card do grid.

- [ ] **Step 1: Payload fixo do Panorama**

Criar `bussola_web/e2e/panorama-fixture.mjs`:

```js
// Dados fixos do Panorama para os testes E2E. Intercepta GET /api/v1/panorama/ e devolve um
// payload sintético e determinístico: o banco demo não tem cofrinhos nem alertas fixos, e vários
// números dependem da data do servidor. Não grava nada no banco (não há o que limpar).
export const PANORAMA_API = /\/api\/v1\/panorama\/(\?.*)?$/;

export const MESES12 = ['nov/25', 'dez/25', 'jan/26', 'fev/26', 'mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26'];
export const RECEITA12 = [7000, 7200, 6900, 7400, 7600, 7300, 7800, 8100, 7900, 8200, 8000, 8400];
export const DESPESA12 = [5200, 5100, 5600, 5300, 5000, 5400, 5900, 5200, 5500, 5300, 5230, 5120];
// Caixa sobe até o valor atual (o último ponto é o pico → cubo ~94% cheio, com bolhas).
const CAIXA_FATOR = [0.45, 0.52, 0.58, 0.63, 0.7, 0.74, 0.8, 0.85, 0.88, 0.93, 0.97, 1];

export const ALERTAS = [
  { id: 'e2e-orc', tipo: 'financas', severidade: 'perigo', titulo: 'Orçamento estourado: Lazer', detalhe: '128% do limite usado no período.', acao: '/financas' },
  { id: 'e2e-vencer', tipo: 'financas', severidade: 'aviso', titulo: '2 conta(s) vencendo em 7 dias', detalhe: 'Confira as provisões para não perder o prazo.', acao: '/financas' },
  { id: 'e2e-meta', tipo: 'metas', severidade: 'info', titulo: "Cofrinho 'Viagem' perto da meta", detalhe: 'No ritmo atual, deve concluir ainda este mês.', acao: '/financas' },
  { id: 'e2e-aportes', tipo: 'metas', severidade: 'info', titulo: '1 aporte(s) automático(s) a confirmar', detalhe: 'Confirme para efetivar nos seus cofrinhos.', acao: '/financas' },
  { id: 'e2e-parado', tipo: 'metas', severidade: 'info', titulo: "Cofrinho 'Notebook' parado", detalhe: 'Sem aportes há 52 dias.', acao: '/financas' },
];

export function panoramaFixture({ insights = 3, caixa = 18500, guardado = 4200 } = {}) {
  return {
    kpis: {
      caixa,
      receita_mes: 8400,
      despesa_mes: 5120,
      balanco_mes: 3280,
      tarefas_pendentes: { critica: 1, alta: 2, media: 3, baixa: 1 },
      tarefas_concluidas: 5,
      total_anotacoes: 12,
      compromissos_realizados: 4,
      compromissos_pendentes: 3,
      compromissos_perdidos: 1,
      proximo_compromisso: { titulo: 'Consulta médica', data: '2026-10-05T14:30:00' },
      chaves_ativas: 9,
      chaves_expiradas: 2,
    },
    forecast: { status: 'ok', realizado: 5120, projetado: 6100 },
    comparativo: { receita: 8077, despesa: 5230, balanco: 2847 },
    orcamento: [
      { nome: 'Lazer', cor: '#a855f7', icone: 'fa-solid fa-gamepad', gasto: 640, limite: 500, limite_mensal: 500, meses: 1, pct: 128 },
      { nome: 'Mercado', cor: '#27ae60', icone: 'fa-solid fa-cart-shopping', gasto: 930, limite: 1000, limite_mensal: 1000, meses: 1, pct: 93 },
      { nome: 'Transporte', cor: '#f39c12', icone: 'fa-solid fa-car', gasto: 210, limite: 600, limite_mensal: 600, meses: 1, pct: 35 },
    ],
    insights: ALERTAS.slice(0, insights),
    cofrinhos: {
      total_guardado: guardado,
      qtd: 3,
      metas: [
        { id: 9001, nome: 'Reserva de emergência', saldo_atual: 2500, valor_alvo: 10000, progresso_pct: 25, cor: '#4A6DFF', data_projetada: '2027-06-01' },
        { id: 9002, nome: 'Viagem', saldo_atual: 1200, valor_alvo: 1500, progresso_pct: 80, cor: '#a855f7', data_projetada: '2026-10-20' },
        { id: 9003, nome: 'Notebook', saldo_atual: 500, valor_alvo: 6000, progresso_pct: 8, cor: '#27ae60', data_projetada: null },
      ],
    },
    ritmo: { peso_atual: 78.4, peso_delta: -1.2, objetivo: 'hipertrofia', plano_ativo: 'Treino ABC', dieta_calorias: 2450 },
    gastos_por_categoria: { labels: ['Moradia', 'Mercado', 'Lazer', 'Transporte'], data: [2400, 930, 640, 210], colors: ['#4A6DFF', '#27ae60', '#a855f7', '#f39c12'] },
    receitas_por_categoria: { labels: [], data: [], colors: [] },
    gastos_por_tipo_pagamento: { labels: ['Pix', 'Crédito', 'Débito'], data: [2100, 1800, 400], colors: ['#27ae60', '#4A6DFF', '#f39c12'] },
    evolucao_labels: MESES12,
    evolucao_mensal_receita: RECEITA12,
    evolucao_mensal_despesa: DESPESA12,
    evolucao_caixa_real: CAIXA_FATOR.map((f) => Math.round(caixa * f)),
    gasto_semanal: { labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], data: [10, 20, 30, 80, 40, 50, 60] },
  };
}

// Registra a interceptação ANTES do gotoApp. Usa a resposta real só pelos cabeçalhos (CORS).
export async function usarFixture(page, opts) {
  await page.route(PANORAMA_API, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: panoramaFixture(opts) });
  });
}
```

- [ ] **Step 2: Bases visuais do desktop com payload fixo**

Criar `bussola_web/e2e/panorama.desktop.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { usarFixture } from './panorama-fixture.mjs';

// Bases geradas ANTES do refactor do JSX (Task 1). Cobrem o que o banco demo não tem:
// alertas com paginação (setas + pontos), jarros cheios, orçamento estourado, Projeção.
test('desktop panorama (payload fixo) inalterado', async ({ page }) => {
  await usarFixture(page, { insights: 5 });
  await gotoApp(page, '/panorama');
  await expect(page).toHaveScreenshot('panorama-fixture.png', { fullPage: true });
});

test('desktop panorama: 2ª página do Atenção agora inalterada', async ({ page }) => {
  await usarFixture(page, { insights: 5 });
  await gotoApp(page, '/panorama');
  await page.getByRole('button', { name: 'Próximos' }).click();
  await expect(page.locator('.pv2-alert-empty')).toHaveCount(3);
  await expect(page.locator('.pv2-section-top')).toHaveScreenshot('panorama-atencao-p2.png');
});
```

- [ ] **Step 3: Gerar a base ANTES de qualquer mudança de código**

Run (em `bussola_web/`): `npm run e2e:update -- --project=desktop e2e/panorama.desktop.spec.mjs`
Expected: 2 passed; criados `e2e/panorama.desktop.spec.mjs-snapshots/panorama-fixture-desktop-win32.png` e `panorama-atencao-p2-desktop-win32.png`. Abra os dois: o primeiro mostra 4 alertas com setas e 2 pontos, o cubo cheio, "Reserva de emergência/Viagem/Notebook" nos jarros e "Lazer 128%"; o segundo mostra 1 alerta + 3 "Sem aviso aqui".
Run: `npm run e2e -- --project=desktop e2e/panorama.desktop.spec.mjs e2e/desktop-visual.desktop.spec.mjs` duas vezes → Expected: tudo passa nas duas (a base é estável; as bolhas SMIL cabem no `maxDiffPixelRatio`). Se o PNG variar entre execuções, adicione `mask: [page.locator('.pv2-hero-jar')]` **só** no teste que variou e regenere.

- [ ] **Step 4: Testes de estrutura (falham: spans inline, sem `data-widget`)**

Acrescentar ao fim de `bussola_web/e2e/panorama.desktop.spec.mjs`:

```js
test('desktop panorama: grid sem spans inline, com data-widget na ordem atual', async ({ page }) => {
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  const cards = page.locator('.pv2-grid > .pcard');
  expect(await cards.evaluateAll((els) => els.map((e) => e.dataset.widget))).toEqual(
    ['evolucao', 'donut', 'orcamento', 'cofrinhos', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre'],
  );
  expect(await cards.evaluateAll((els) => els.filter((e) => e.style.gridColumn).length)).toBe(0);
  const spans = await cards.evaluateAll((els) => els.map((e) => getComputedStyle(e).gridColumnEnd));
  expect(spans).toEqual(['span 8', 'span 4', 'span 6', 'span 6', 'span 12', 'span 4', 'span 4', 'span 4', 'span 8', 'span 4']);
});

test('desktop panorama: nada do layout mobile aparece', async ({ page }) => {
  await usarFixture(page, { insights: 5 });
  await gotoApp(page, '/panorama');
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.pv2-attn-arrow')).toHaveCount(2);
  await expect(page.locator('.pv2-attn-row .pv2-alert')).toHaveCount(4);
  await expect(page.locator('.pv2-attn-row.is-carousel')).toHaveCount(0);
  await expect(page.locator('.pv2-donut-legend')).toBeHidden();
  await expect(page.locator('.pv2-readout')).toHaveCount(0);
  await expect(page.locator('.pv2-evo-months')).toHaveCount(0);
  await expect(page.locator('[data-widget="evolucao"] svg text')).toHaveCount(12);
  await expect(page.locator('.pv2-hero-label')).toHaveText('Caixa · patrimônio acumulado');
  expect(await page.locator('.pv2-hero-jar svg animate').count()).toBeGreaterThan(0);
});
```

Run: `npm run e2e -- --project=desktop e2e/panorama.desktop.spec.mjs`
Expected: "grid sem spans inline" FAIL (`dataset.widget` undefined e `style.gridColumn` preenchido); os outros 3 passam.

- [ ] **Step 5: Refactor do return do `index.jsx` (DOM do desktop igual)**

Em `bussola_web/src/pages/Panorama/index.jsx`:

(a) Logo depois da linha `const insightIcon = (it) => …;` (linha 22), inserir:

```jsx

// Ordem das seções do topo e dos widgets do grid (chaves dos objetos `topo` e `widgets`).
const TOPO_DESKTOP = ['atencao', 'hero', 'kpis'];
const WIDGETS_DESKTOP = ['evolucao', 'donut', 'orcamento', 'cofrinhos', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre'];
```

(b) Substituir **tudo** a partir da linha `  const kpiList = [` (inclusive) até o **fim do arquivo** por:

```jsx
  const kpiList = [
    { label: 'Receita', value: fmt(receita), arrow: dRec >= 0 ? '▲' : '▼', delta: fmtPct(dRec), dc: dRec >= 0 ? 'var(--green)' : 'var(--red)', vc: 'var(--text)', tip: 'Receitas efetivadas no período. A variação compara com o período anterior de mesma duração.' },
    { label: 'Despesa', value: fmt(despesa), arrow: dDesp >= 0 ? '▲' : '▼', delta: fmtPct(dDesp), dc: dDesp <= 0 ? 'var(--green)' : 'var(--red)', vc: 'var(--text)', tip: 'Despesas efetivadas no período. A variação compara com o período anterior de mesma duração.' },
    { label: 'Balanço', value: fmt(bal), arrow: bal >= 0 ? '▲' : '▼', delta: fmtPct(dBal), dc: bal >= 0 ? 'var(--green)' : 'var(--red)', vc: bal >= 0 ? 'var(--text)' : 'var(--red)', tip: 'Receitas menos despesas efetivadas no período. Positivo = sobrou; negativo = gastou mais do que entrou.' },
  ];

  // ---------- Atenção agora ----------
  const renderAlert = (it) => {
    const s = SEV[it.severidade] || SEV.info;
    return (
      <div key={it.id} className="pcard pv2-alert">
        <div className="pv2-alert-top">
          <div className="pv2-alert-chip" style={{ background: s.bg, color: s.c }}><i className={insightIcon(it)}></i></div>
          <div className="pv2-alert-sev" style={{ color: s.c }}>{s.label}</div>
          <button className="pv2-alert-dismiss" title="Dispensar por 24h" onClick={(e) => { e.stopPropagation(); dismissInsight(it.id); }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div>
          <div className="pv2-alert-title">{it.titulo}</div>
          {it.detalhe && <div className="pv2-alert-detail">{it.detalhe}</div>}
        </div>
        {it.acao && (
          <button className="pv2-btn pv2-alert-cta" style={{ color: s.c, background: s.bg, border: 'none' }} onClick={() => navigate(it.acao)}>Ver →</button>
        )}
      </div>
    );
  };

  // Some por completo (título + cards) quando não há alertas.
  const atencao = insights.length > 0 && (
    <div className="pv2-section-top">
      <div className="pv2-attn-head">
        <span className="pv2-attn-dot" />
        <span className="pv2-attn-title">Atenção agora</span>
        <span className="pv2-attn-count">{insights.length ? `${insights.length} ${insights.length === 1 ? 'alerta' : 'alertas'}` : ''}</span>
        {attnPages > 1 && (
          <div className="pv2-attn-nav">
            <button className="pv2-btn pv2-attn-arrow" onClick={() => setAttnPage(p => (p - 1 + attnPages) % attnPages)} aria-label="Anteriores"><i className="fa-solid fa-chevron-left"></i></button>
            <div className="pv2-attn-dots">
              {Array.from({ length: attnPages }, (_, i) => (
                <button key={i} className={`pv2-attn-dot-btn ${i === pageIdx ? 'active' : ''}`} onClick={() => setAttnPage(i)} aria-label={`Página ${i + 1}`} />
              ))}
            </div>
            <button className="pv2-btn pv2-attn-arrow" onClick={() => setAttnPage(p => (p + 1) % attnPages)} aria-label="Próximos"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
        )}
      </div>
      <div className="pv2-attn-row" key={pageIdx}>
        {alertSlots.map((it, idx) => (it ? renderAlert(it) : (
          <div key={`empty-${idx}`} className="pcard pv2-alert pv2-alert-empty">
            <i className="fa-solid fa-circle-check" style={{ fontSize: 20, color: 'var(--green)', opacity: 0.7 }}></i>
            <div className="pv2-alert-detail" style={{ marginTop: 0 }}>Sem aviso aqui</div>
          </div>
        )))}
      </div>
    </div>
  );

  // ---------- Hero: Caixa ----------
  const hero = (
    <div className="pv2-hero">
      <div className="pv2-hero-jar"><Reservoir total={total} disp={disp} guard={guardado} cap={cap} startLevel={startLevel} /></div>
      <div className="pv2-hero-info">
        <div className="pv2-hero-top">
          <div className="pv2-hero-label">Caixa · patrimônio<span className="pv2-hero-label-extra"> acumulado</span></div>
          <div className="pv2-hero-controls">
            <DateRangeFilter initialPreset="mes" onChange={setRange} />
            <button className={`btn-privacy-toggle ${privacy ? 'active' : ''}`} onClick={togglePrivacy} title={privacy ? 'Mostrar valores' : 'Ocultar valores'}>
              <i className={`fa-solid ${privacy ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
        </div>
        <div className="pv2-hero-total"><span data-money="">{fmt(total)}</span></div>
        <div className="pv2-hero-bars">
          <div className="pv2-hero-bar">
            <div className="pv2-hero-bar-head">
              <span className="lbl">Disponível <span>livre</span></span>
              <span className="val" style={{ color: disp < 0 ? 'var(--red)' : 'var(--text)' }}><span data-money="">{fmt(disp)}</span></span>
            </div>
            <div className="pv2-track"><div style={{ width: `${Math.max(2, Math.abs(disp) / denom * 100)}%`, height: '100%', borderRadius: 4, background: disp < 0 ? 'var(--red)' : 'linear-gradient(90deg,var(--blue),#7b8cff)' }} /></div>
          </div>
          <div className="pv2-hero-bar">
            <div className="pv2-hero-bar-head">
              <span className="lbl">Guardado <span><i className="fa-solid fa-lock" style={{ fontSize: 10 }}></i> travado</span></span>
              <span className="val"><span data-money="">{fmt(guardado)}</span></span>
            </div>
            <div className="pv2-track"><div style={{ width: `${guardado / denom * 100}%`, height: '100%', borderRadius: 4, background: 'rgba(74,109,255,.4)' }} /></div>
          </div>
        </div>
        {neg && (
          <div className="pv2-hero-neg"><span />Descoberto de {fmt(Math.abs(disp))} — cubra o disponível ou libere um cofrinho.</div>
        )}
        <div className="pv2-hero-note">Guardar é transferência neutra — sai do disponível, vira guardado, o total não muda.</div>
      </div>
    </div>
  );

  // ---------- Faixa de KPIs ----------
  const kpiCells = kpiList.map((k, i) => (
    <div key={`kpi-${i}`} className="pv2-kpi" data-tooltip={k.tip}>
      <div className="pv2-kpi-label">{k.label}</div>
      <div className="pv2-kpi-value" style={{ color: k.vc }}><span data-money="">{k.value}</span></div>
      <div className="pv2-kpi-delta" style={{ color: k.dc }}>{k.arrow} {k.delta} <span className="muted">vs anterior</span></div>
    </div>
  ));
  const projecao = fc && (
    <div key="projecao" className="pv2-kpi-extra pv2-kpi-proj" data-tooltip="Projeção de fechamento do período: o realizado até agora mais as pendências conhecidas. 'Seguro' quando deve fechar positivo.">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span className="pv2-kpi-label">Projeção</span>
        <span className="pv2-proj-chip" style={{ color: seguro ? 'var(--green)' : 'var(--red)', background: seguro ? 'rgba(39,174,96,.15)' : 'rgba(231,76,60,.15)' }}>{seguro ? 'seguro' : 'alerta'}</span>
      </div>
      <div className="pv2-track" style={{ marginBottom: 8 }}><div style={{ width: `${Math.min(100, Math.round(fc.realizado / (fc.projetado || 1) * 100))}%`, height: '100%', background: seguro ? 'var(--blue)' : 'var(--red)', borderRadius: 4 }} /></div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Fecha em <b style={{ color: seguro ? 'var(--green)' : 'var(--red)' }}><span data-money="">{fmt(fcClose)}</span></b> · projetado <span data-money="">{fmt(fc.projetado)}</span></div>
    </div>
  );
  const poupanca = (
    <div key="poupanca" className="pv2-kpi-extra" data-tooltip="Taxa de poupança: percentual da receita do período que não foi gasto (quanto maior, mais você guardou).">
      <div className="pv2-kpi-label">Poupança</div>
      <div className="pv2-kpi-big">{savingsPct}<span style={{ fontSize: '.55em' }}>%</span></div>
      <div className="pv2-track"><div style={{ width: `${Math.min(100, savingsPct)}%`, height: '100%', background: 'var(--green)', borderRadius: 4 }} /></div>
    </div>
  );
  const kpiBand = (
    <div className="pv2-kpiband">
      {[...kpiCells, projecao, poupanca]}
    </div>
  );

  // ---------- Widgets do grid (design atual; só a ordem/largura muda por tela) ----------
  const widgets = {
    evolucao: (
      <div className="pcard span-8 is-wide-tablet" data-widget="evolucao">
        <div className="pv2-card-head">
          <span className="pv2-card-title">Evolução · últimos 12 meses</span>
          <div className="pv2-legend">
            <span className="pv2-legend-item"><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--green)' }} />Receita</span>
            <span className="pv2-legend-item"><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--red)' }} />Despesa</span>
            <span className="pv2-legend-item"><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--blue)' }} />Caixa</span>
          </div>
        </div>
        <Evolution ev={ev.length ? ev : [{ m: '—', rec: 0, desp: 0, caixa: 0 }]} />
      </div>
    ),
    donut: (
      <div className="pcard span-4" data-widget="donut">
        <div className="pv2-card-title" style={{ marginBottom: 12 }}>Gastos por categoria</div>
        <Donut cats={cats} />
      </div>
    ),
    orcamento: (
      <div className="pcard pv2-eq span-6" data-widget="orcamento">
        <div className="pv2-card-title" style={{ marginBottom: 16 }}>
          Orçamento por categoria
          {(budget[0]?.meses || 1) > 1 && <span className="chart-subtitle"> · limite × {budget[0].meses} meses</span>}
        </div>
        {budget.length ? (
          <div className="pv2-budget">
            {budget.map((b) => {
              const over = b.pct != null && b.pct > 100;
              const near = b.pct != null && b.pct >= 90;
              const budgetTip = `${b.nome}: gasto ${fmt(b.gasto)}${b.limite > 0 ? ` de ${fmt(b.limite)}${b.pct != null ? ` (${Math.round(b.pct)}%)` : ''}` : ' · sem limite definido'}`;
              return (
                <div key={b.nome} data-tooltip={budgetTip}>
                  <div className="pv2-budget-head">
                    <span className="n">{b.nome} {over && <span className="pv2-badge-over">{Math.round(b.pct)}%</span>}</span>
                    <span className="amt"><span data-money="">{fmt(b.gasto)}</span>{b.limite > 0 ? <> / <span data-money="">{fmt(b.limite)}</span></> : ''}</span>
                  </div>
                  {b.limite > 0 && (
                    <div className="pv2-bar9"><div style={{ width: `${Math.min(100, b.pct || 0)}%`, height: '100%', borderRadius: 5, background: over ? 'var(--red)' : near ? 'var(--orange)' : 'var(--blue)' }} /></div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pv2-empty-note"><i className="fa-solid fa-list-check"></i><span>Sem orçamento no período (defina limites nas categorias).</span></div>
        )}
      </div>
    ),
    cofrinhos: (
      <div className="pcard pv2-eq span-6" data-widget="cofrinhos">
        <div className="pv2-card-title" style={{ marginBottom: 16 }}>Cofrinhos &amp; metas</div>
        <div className="pv2-goals">
          {goalSlots.map((m, i) => <MiniJar key={m ? m.id : `empty-${i}`} meta={m} />)}
        </div>
      </div>
    ),
    pagamento: (
      <div className="pcard span-12 is-wide-tablet" data-widget="pagamento">
        <div className="pv2-card-title" style={{ marginBottom: 16 }}>Gastos por forma de pagamento</div>
        <PayBars items={payItems} />
      </div>
    ),
    media: (
      <div className="pcard span-4" data-widget="media">
        <div className="pv2-card-head">
          <span className="pv2-card-title">Média por dia</span>
          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>média <span data-money="">{fmt(weekAvg)}</span></span>
        </div>
        {week.length ? <Weekday days={week} /> : <div className="pv2-empty-note"><span>Sem dados.</span></div>}
      </div>
    ),
    ritmo: (
      <div className="pcard span-4" data-widget="ritmo">
        <div className="pv2-card-title" style={{ marginBottom: 14 }}>Ritmo</div>
        {ritmo ? (
          <>
            <div className="pv2-row-baseline">
              <span style={{ fontSize: 30, fontWeight: 800 }}>{ritmo.peso_atual != null ? String(ritmo.peso_atual).replace('.', ',') : '—'}</span>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>kg</span>
              {ritmo.peso_delta != null && <span style={{ fontSize: 13, fontWeight: 700, color: ritmo.peso_delta <= 0 ? 'var(--green)' : 'var(--orange)', marginLeft: 'auto' }}>{ritmo.peso_delta <= 0 ? '▼' : '▲'} {Math.abs(ritmo.peso_delta)} kg</span>}
            </div>
            {ritmo.objetivo && <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>objetivo {ritmo.objetivo}</div>}
            <div className="pv2-divider" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div className="pv2-ritmo-row"><i className="fa-solid fa-dumbbell" style={{ color: 'var(--blue)', width: 16, textAlign: 'center' }}></i><span style={{ color: 'var(--muted)' }}>Treino ativo</span><b style={{ marginLeft: 'auto' }}>{ritmo.plano_ativo || '—'}</b></div>
              {ritmo.dieta_calorias ? <div className="pv2-ritmo-row"><i className="fa-solid fa-fire" style={{ color: 'var(--orange)', width: 16, textAlign: 'center' }}></i><span style={{ color: 'var(--muted)' }}>Meta calórica</span><b style={{ marginLeft: 'auto' }}>{Math.round(ritmo.dieta_calorias)} kcal</b></div> : null}
            </div>
          </>
        ) : (
          <div className="pv2-empty-note"><i className="fa-solid fa-heart-pulse"></i><span>Sem dados de saúde. Registre no Ritmo.</span></div>
        )}
      </div>
    ),
    produtividade: (
      <div className="pcard span-4" data-widget="produtividade">
        <div className="pv2-card-head">
          <span className="pv2-card-title">Produtividade</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{doneP}% feitas</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {prios.map((p, i) => (
            <div key={i} className="pv2-prio">
              <span className="pv2-prio-dot" style={{ background: p.color }} />
              <span style={{ flex: 1, color: 'var(--muted)' }}>{p.label}</span>
              <b>{p.count}</b>
            </div>
          ))}
        </div>
        <div className="pv2-divider">
          <div style={{ fontSize: 11.5, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Anotações no período</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{kpis.total_anotacoes || 0}</div>
        </div>
      </div>
    ),
    agenda: (
      <div className="pcard span-8" data-widget="agenda" style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 220px', minWidth: 200 }}>
          <div className="pv2-card-title" style={{ marginBottom: 14 }}>Agenda</div>
          <div className="pv2-mini-stats">
            <div className="pv2-mini-stat"><div className="num" style={{ color: 'var(--green)' }}>{kpis.compromissos_realizados || 0}</div><div className="cap">realizados</div></div>
            <div className="pv2-mini-stat"><div className="num" style={{ color: 'var(--blue)' }}>{kpis.compromissos_pendentes || 0}</div><div className="cap">pendentes</div></div>
            <div className="pv2-mini-stat"><div className="num" style={{ color: 'var(--red)' }}>{kpis.compromissos_perdidos || 0}</div><div className="cap">perdidos</div></div>
          </div>
        </div>
        <div className="pv2-next">
          <div style={{ fontSize: 11.5, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>Próximo compromisso</div>
          <div style={{ fontSize: 19, fontWeight: 800, margin: '8px 0 4px' }}>{prox?.titulo || 'Nada agendado'}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}><i className="fa-regular fa-clock"></i> {prox?.data ? fmtDateTime(prox.data) : '—'}</div>
        </div>
      </div>
    ),
    cofre: (
      <div className="pcard span-4" data-widget="cofre" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 14 }}><i className="fa-solid fa-key"></i> Cofre de senhas</div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)' }}>{kpis.chaves_ativas || 0}</div><div className="pv2-cofre-cap">chaves ativas</div></div>
          <div><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--orange)' }}>{kpis.chaves_expiradas || 0}</div><div className="pv2-cofre-cap">expiradas</div></div>
        </div>
      </div>
    ),
  };

  const topo = { atencao, hero, kpis: kpiBand };

  return (
    <div className="container main-container panorama-scope">
      <div className="page-header">
        <div className="page-header-main">
          <h1><i className="fa-solid fa-gauge-high"></i> Panorama</h1>
        </div>
      </div>
      <div className="pv2-root" data-privacy={privacy ? 'on' : 'off'}>
        <div className="pv2-inner">
          {/* Fragment com key: trocar a ordem MOVE os nós (o DateRangeFilter do hero não remonta). */}
          {TOPO_DESKTOP.map((k) => topo[k] && <React.Fragment key={k}>{topo[k]}</React.Fragment>)}
          <div className="pv2-grid">
            {WIDGETS_DESKTOP.map((k) => <React.Fragment key={k}>{widgets[k]}</React.Fragment>)}
          </div>
          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Classes que substituem os estilos inline (mesmos valores do desktop)**

Em `bussola_web/src/pages/Panorama/panorama-v2.css`, logo **depois** da linha

```css
.pv2-card-head { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
```

inserir:

```css

/* Spans do grid (antes inline). Tablet e celular sobrescrevem no fim do arquivo. */
.pv2-grid > .span-4 { grid-column: span 4; }
.pv2-grid > .span-6 { grid-column: span 6; }
.pv2-grid > .span-8 { grid-column: span 8; }
.pv2-grid > .span-12 { grid-column: span 12; }

/* Antes inline. Valores copiados do desktop (não mudar): o celular sobrescreve a fonte. */
.pv2-legend { display: flex; gap: 14px; font-size: 11.5px; color: var(--muted); }
.pv2-legend-item { display: inline-flex; align-items: center; gap: 5px; }
.pv2-proj-chip { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
.pv2-kpi-big { font-size: clamp(28px,3.4vw,38px); font-weight: 800; color: var(--green); line-height: 1; margin: 8px 0; }
.pv2-ritmo-row { display: flex; align-items: center; gap: 9px; font-size: 13px; }
.pv2-cofre-cap { font-size: 11.5px; color: var(--muted2); }
```

- [ ] **Step 7: Remover o CSS morto do `panorama-v2.css`**

Confirme antes: `node scripts/find-unused-css.mjs src/pages/Panorama/panorama-v2.css` lista exatamente `.pv2-head`, `.pv2-brand`, `.pv2-brand span`, `.pv2-title`, `.pv2-tabs`, `.pv2-tab`, `.pv2-tab.active`, `.pv2-custom-range` e os 7 `.pan-jar*` (15 regras). E `git grep -n "pv2-wave" -- bussola_web/src` só acha os próprios `@keyframes`.

Apagar de `panorama-v2.css`:
1. as duas linhas `@keyframes pv2-waveA { … }` e `@keyframes pv2-waveB { … }` (mantenha `pv2-floaty` e `pv2-bob`, que estão em uso);
2. o trecho que começa em `/* Header */` e termina na linha `.pv2-custom-range { display: flex; align-items: center; gap: 6px; margin-left: 6px; }` (inclusive, mais a linha em branco seguinte);
3. o trecho que começa em `.pan-jar { --cofre-cor: var(--blue);` e termina na linha `  font-size: 26px; text-shadow: 0 1px 3px rgba(0,0,0,.35); }` (fim de `.pan-jar-icon`), mantendo o comentário `/* Ritmo / Produtividade / Agenda / Cofre */` logo depois.

Run: `node scripts/find-unused-css.mjs src/pages/Panorama/panorama-v2.css` → Expected: `(nenhuma regra morta)`.

- [ ] **Step 8: Remover o CSS morto do `styles.css` (v1) e trocar `100vh` por `dvh`**

Confirme antes (todos devem achar **só** o próprio `Panorama/styles.css`, ou nada fora do escopo):
- `git grep -n "empty-cell" -- bussola_web/src` → só `Panorama/styles.css` (o detector não acusa por causa do `empty-${idx}` do JSX, que é um falso positivo dele);
- `git grep -n "text-center" -- bussola_web/src` → `Ritmo/index.jsx` (dentro de `.ritmo-scope`, que tem a própria `.ritmo-scope .text-center { … !important }`), `Ritmo/styles.css` e `Panorama/styles.css`;
- `git grep -n "modal\|close-btn\|btn-secondary" -- bussola_web/src/pages/Panorama/index.jsx` → nada (o Panorama não renderiza modal; o sheet do período é portal no `body`).

Substituir **todo** o conteúdo de `bussola_web/src/pages/Panorama/styles.css` por:

```css
.panorama-scope.main-container {
    padding-bottom: 5rem;
    min-height: 100vh;
    min-height: 100dvh;
    padding-top: 0 !important;
}

/* Botão de Privacidade (Olho) */
.btn-privacy-toggle {
    background: transparent;
    border: 1px solid var(--cor-borda);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--cor-texto-secundario);
    transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
}

.btn-privacy-toggle:hover, .btn-privacy-toggle.active {
    background-color: var(--cor-fundo-hover);
    color: var(--cor-azul-primario);
    border-color: var(--cor-azul-primario);
}

.chart-subtitle {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--cor-texto-secundario);
}

/* NÃO É MORTO: pela ordem de import das páginas, esta é a definição vencedora do
   @keyframes scaleInModal global, usada pelos modais de Registros e do AdminUserModal.
   Fica aqui até os keyframes compartilhados irem para components.css. */
@keyframes scaleInModal {
    from {
        opacity: 0;
        transform: scale(0.98) translateY(15px);
    }

    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}
```

(O `@keyframes fadeInOverlay` sai: o de `global.css`, idêntico, é importado por último e já é o vencedor.)

- [ ] **Step 9: Rodar os testes**

Run: `npm run e2e -- --project=desktop` → Expected: tudo passa, incluindo `panorama.desktop.spec.mjs` (4) e `desktop-visual` › `panorama` (os PNGs não mudam).
Run: `npx eslint src/pages/Panorama` → Expected: sem problemas.
Run: `npm run build` → Expected: OK.

- [ ] **Step 10: Commit**

```bash
git add bussola_web/src/pages/Panorama bussola_web/e2e/panorama-fixture.mjs bussola_web/e2e/panorama.desktop.spec.mjs bussola_web/e2e/panorama.desktop.spec.mjs-snapshots
git commit -m "refactor(web): Panorama com widgets por chave, spans e inline em classes, sem CSS morto (desktop identico)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Grade responsiva e ordem do celular (1 coluna) + tablet com 6 colunas

**Files:**
- Create: `bussola_web/e2e/panorama.mobile.spec.mjs`, `bussola_web/e2e/panorama.tablet.spec.mjs`
- Modify: `bussola_web/src/pages/Panorama/index.jsx`, `bussola_web/src/pages/Panorama/panorama-v2.css`

**Interfaces:**
- Consumes: `topo`, `widgets`, `TOPO_DESKTOP`, `WIDGETS_DESKTOP` (Task 1); `usarFixture`; `overflowOffenders`.
- Produces: `TOPO_MOBILE = ['hero', 'kpis', 'atencao']`, `WIDGETS_MOBILE = ['orcamento', 'cofrinhos', 'donut', 'evolucao', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre']`; `isMobile` no componente. CSS: celular = 1 coluna, gap 12, grid a 24px das seções, card com padding 16, `.pv2-eq` com altura automática; tablet = `repeat(6, minmax(0,1fr))` + `dense`, todos os cards em `span 3`, `.is-wide-tablet` em largura total, `.pv2-eq` com `min-height: 340px`.

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/panorama.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';
import { usarFixture } from './panorama-fixture.mjs';

const WIDGETS_MOBILE = ['orcamento', 'cofrinhos', 'donut', 'evolucao', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre'];
const caixa = (page, sel) => page.locator(sel).first().boundingBox();

// ---------------------------------------------------------------------------
// Task 2 — ordem e grade
// ---------------------------------------------------------------------------
test.describe('ordem e grade', () => {
  test('hero → KPIs → Atenção → widgets na ordem aprovada, em 1 coluna com gutter de 16', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const y = async (sel) => (await caixa(page, sel)).y;
    expect(await y('.pv2-hero')).toBeLessThan(await y('.pv2-kpiband'));
    expect(await y('.pv2-kpiband')).toBeLessThan(await y('.pv2-section-top'));
    expect(await y('.pv2-section-top')).toBeLessThan(await y('.pv2-grid'));

    const cards = page.locator('.pv2-grid > [data-widget]');
    expect(await cards.evaluateAll((els) => els.map((e) => e.dataset.widget))).toEqual(WIDGETS_MOBILE);
    const grid = await caixa(page, '.pv2-grid');
    expect(Math.round(grid.x)).toBe(16);
    const boxes = await cards.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; }));
    for (const b of boxes) {
      expect(Math.abs(b.x - grid.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(b.w - grid.width)).toBeLessThanOrEqual(1);
    }
  });

  test('espaçamento: 12 entre cards, 24 entre seções, 16 dentro do card', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const grid = page.locator('.pv2-grid');
    expect(await grid.evaluate((e) => getComputedStyle(e).rowGap)).toBe('12px');
    expect(await grid.evaluate((e) => getComputedStyle(e).marginTop)).toBe('24px');
    expect(await page.locator('[data-widget="ritmo"]').evaluate((e) => getComputedStyle(e).padding)).toBe('16px');
    expect(await page.locator('[data-widget="orcamento"]').evaluate((e) => getComputedStyle(e).height)).not.toBe('340px');
  });

  test('cruzar 768px com um período escolhido mantém o filtro (o hero não remonta)', async ({ page }) => {
    await gotoApp(page, '/panorama');
    await page.locator('.drf-trigger').click();
    await page.locator('.modal-overlay.is-sheet').getByText('Este ano', { exact: true }).click();
    await expect(page.locator('.drf-trigger')).toContainText('Este ano');
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('.pv2-section-top, .pv2-hero').first()).toBeVisible();
    await expect(page.locator('.drf-trigger')).toContainText('Este ano');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.drf-trigger')).toContainText('Este ano');
  });
});
```

Criar `bussola_web/e2e/panorama.tablet.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';
import { usarFixture } from './panorama-fixture.mjs';

for (const w of [769, 900, 1024]) {
  test(`tablet ${w}px: sem overflow (dados reais)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/panorama');
    expect(await overflowOffenders(page)).toEqual([]);
  });

  test(`tablet ${w}px: sem overflow (payload fixo, 5 alertas)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await usarFixture(page, { insights: 5 });
    await gotoApp(page, '/panorama');
    expect(await overflowOffenders(page)).toEqual([]);
  });
}

test('tablet: grade de 6 colunas; Evolução e Pagamento inteiros, o resto em metades, sem buracos', async ({ page }) => {
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  const grid = page.locator('.pv2-grid');
  expect(await grid.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(6);
  const gb = await grid.boundingBox();
  const gap = await grid.evaluate((e) => parseFloat(getComputedStyle(e).columnGap));
  const box = await page.locator('.pv2-grid > [data-widget]').evaluateAll((els) => Object.fromEntries(els.map((e) => {
    const r = e.getBoundingClientRect();
    return [e.dataset.widget, { y: Math.round(r.y), w: r.width }];
  })));
  for (const k of ['evolucao', 'pagamento']) expect(Math.abs(box[k].w - gb.width)).toBeLessThanOrEqual(1);
  for (const k of ['donut', 'orcamento', 'cofrinhos', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre']) {
    expect(Math.abs(box[k].w - (gb.width - gap) / 2)).toBeLessThanOrEqual(1);
  }
  // dense: Média por dia sobe para o lado de Cofrinhos (o Pagamento, inteiro, iria deixar um buraco)
  expect(box.media.y).toBe(box.cofrinhos.y);
  expect(box.donut.y).toBe(box.orcamento.y);
  expect(box.ritmo.y).toBe(box.produtividade.y);
  expect(box.agenda.y).toBe(box.cofre.y);
});
```

Run: `npm run e2e -- --project=mobile e2e/panorama.mobile.spec.mjs` → Expected: "hero → KPIs…" FAIL (Atenção vem antes do hero; widgets na ordem do desktop; grid com 2 colunas por causa do `@media (max-width: 600px)`); "espaçamento" FAIL (gap 18px, margin 34px, padding 20px, altura 340px); "cruzar 768px" passa (é guarda: tem que continuar passando depois da reordenação).
Run: `npm run e2e -- --project=tablet e2e/panorama.tablet.spec.mjs` → Expected: "grade de 6 colunas" FAIL (a 900px o `@media (max-width: 960px)` dá 6 colunas, mas os `span 8`/`span 12` criam colunas implícitas e nada fica em metades); os de overflow podem falhar pelo mesmo motivo (a 1024px a grade ainda tem 12 colunas).

- [ ] **Step 2: Ordem do celular no `index.jsx`**

(a) Trocar o bloco de constantes inserido na Task 1

```jsx
// Ordem das seções do topo e dos widgets do grid (chaves dos objetos `topo` e `widgets`).
const TOPO_DESKTOP = ['atencao', 'hero', 'kpis'];
const WIDGETS_DESKTOP = ['evolucao', 'donut', 'orcamento', 'cofrinhos', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre'];
```

por:

```jsx
// Ordem das seções do topo e dos widgets do grid (chaves dos objetos `topo` e `widgets`).
// No celular (≤768) vale a ordem aprovada no mockup "Cubo em cima"; o tablet usa a do desktop.
const TOPO_DESKTOP = ['atencao', 'hero', 'kpis'];
const TOPO_MOBILE = ['hero', 'kpis', 'atencao'];
const WIDGETS_DESKTOP = ['evolucao', 'donut', 'orcamento', 'cofrinhos', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre'];
const WIDGETS_MOBILE = ['orcamento', 'cofrinhos', 'donut', 'evolucao', 'pagamento', 'media', 'ritmo', 'produtividade', 'agenda', 'cofre'];
```

(b) Imports: logo depois de `import { computeRange } from '../../utils/dateRange';` acrescentar:

```jsx
import { useIsMobile } from '../../hooks/useIsMobile';
```

(c) Depois de `  const [dismissed, setDismissed] = useState(loadDismissed);` acrescentar:

```jsx
  const isMobile = useIsMobile();
```

(d) Trocar

```jsx
          {TOPO_DESKTOP.map((k) => topo[k] && <React.Fragment key={k}>{topo[k]}</React.Fragment>)}
          <div className="pv2-grid">
            {WIDGETS_DESKTOP.map((k) => <React.Fragment key={k}>{widgets[k]}</React.Fragment>)}
          </div>
```

por:

```jsx
          {(isMobile ? TOPO_MOBILE : TOPO_DESKTOP).map((k) => topo[k] && <React.Fragment key={k}>{topo[k]}</React.Fragment>)}
          <div className="pv2-grid">
            {(isMobile ? WIDGETS_MOBILE : WIDGETS_DESKTOP).map((k) => <React.Fragment key={k}>{widgets[k]}</React.Fragment>)}
          </div>
```

- [ ] **Step 3: CSS da grade (tablet e celular)**

Em `bussola_web/src/pages/Panorama/panorama-v2.css`:

(a) Trocar as 3 linhas

```css
.pv2-grid { display: grid; grid-template-columns: repeat(12,1fr); gap: 18px; margin-top: 34px; }
@media (max-width: 960px) { .pv2-grid { grid-template-columns: repeat(6,1fr); } }
@media (max-width: 600px) { .pv2-grid { grid-template-columns: repeat(2,1fr); } }
```

por:

```css
.pv2-grid { display: grid; grid-template-columns: repeat(12,1fr); gap: 18px; margin-top: 34px; }
```

(b) Apagar a linha `@media (max-width: 600px) { .pv2-eq { height: auto; } }` (o celular passa a tratar isso no bloco abaixo).

(c) Acrescentar ao **fim do arquivo**:

```css

/* =======================================================================
   RESPONSIVO — tablet (769–1024) e celular (≤768). Desktop (≥1025) não muda.
   ======================================================================= */

/* Tablet: 6 colunas; widgets em metades, Evolução e Pagamento em largura total.
   "dense" sobe a Média por dia para o lado de Cofrinhos (sem buraco antes do Pagamento). */
@media (min-width: 769px) and (max-width: 1024px) {
  .pv2-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); grid-auto-flow: dense; }
  .pv2-grid > .span-4,
  .pv2-grid > .span-6,
  .pv2-grid > .span-8,
  .pv2-grid > .span-12 { grid-column: span 3; }
  .pv2-grid > .is-wide-tablet { grid-column: 1 / -1; }
  .pv2-eq { height: auto; min-height: 340px; }
}

/* Celular — grade: 1 coluna, 12px entre cards, 24px entre seções, 16px dentro do card. */
@media (max-width: 768px) {
  .panorama-scope.main-container { padding-bottom: var(--sp-4) !important; }
  .pv2-grid { grid-template-columns: minmax(0, 1fr); gap: var(--sp-3); margin-top: var(--sp-5); }
  .pv2-grid > .span-4,
  .pv2-grid > .span-6,
  .pv2-grid > .span-8,
  .pv2-grid > .span-12 { grid-column: 1 / -1; }
  .pcard { padding: var(--sp-4); }
  .pv2-eq { height: auto; }
  .pv2-card-head { margin-bottom: var(--sp-3); }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/panorama.mobile.spec.mjs` → Expected: 3 passed.
Run: `npm run e2e -- --project=tablet e2e/panorama.tablet.spec.mjs` → Expected: 7 passed. Se `overflowOffenders` listar algo do hero a 769px (`.pv2-hero-bars`/`.pv2-hero-total`), corrija **dentro do bloco do tablet** (ex.: `.pv2-hero-bar { min-width: 0; }`) sem `overflow: hidden`, e registre na mensagem do commit.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (PNGs inalterados).
Run: `npx eslint src/pages/Panorama` → Expected: sem problemas.

- [ ] **Step 5: Commit**

```bash
git add bussola_web/src/pages/Panorama bussola_web/e2e/panorama.mobile.spec.mjs bussola_web/e2e/panorama.tablet.spec.mjs
git commit -m "feat(web): Panorama em 1 coluna no celular (ordem aprovada) e grade de 6 colunas no tablet" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hero "Cubo em cima", KPIs 2×2, período/privacidade e cubo parado

**Files:**
- Modify: `bussola_web/src/pages/Panorama/index.jsx`, `bussola_web/src/pages/Panorama/panorama-v2.css`, `bussola_web/src/pages/Panorama/styles.css`, `bussola_web/e2e/panorama.mobile.spec.mjs`, `bussola_web/e2e/panorama.desktop.spec.mjs`

**Interfaces:**
- Consumes: `hero`, `kpiCells`, `projecao`, `poupanca`, `isMobile` (Tasks 1–2); `useMediaQuery`.
- Produces: `Reservoir({ …, animate = true })` (sem `animate`: sem `pv2-bob` e sem as bolhas SMIL); `reduceMotion` no componente; no celular a faixa de KPIs na ordem Receita, Despesa, Balanço, Poupança, Projeção; CSS do hero centralizado (cubo 150px, controles por último via `order`), KPIs em grade 2×2 com divisórias, privacidade com 44px no toque e hover só com mouse.

- [ ] **Step 1: Testes que falham**

Acrescentar ao fim de `bussola_web/e2e/panorama.mobile.spec.mjs`:

```js
// ---------------------------------------------------------------------------
// Task 3 — hero, KPIs, período, privacidade, movimento, overflow
// ---------------------------------------------------------------------------
test.describe('hero e KPIs', () => {
  test('cubo de 150px centralizado em cima; rótulo, total, barras e controles abaixo, centralizados', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const jar = await caixa(page, '.pv2-hero-jar');
    expect(Math.round(jar.width)).toBe(150);
    expect(Math.abs(jar.x + jar.width / 2 - 195)).toBeLessThanOrEqual(1);
    const label = await caixa(page, '.pv2-hero-label');
    const total = await caixa(page, '.pv2-hero-total');
    const bars = await caixa(page, '.pv2-hero-bars');
    const trig = await caixa(page, '.pv2-hero-controls .drf-trigger');
    const eye = await caixa(page, '.btn-privacy-toggle');
    expect(label.y).toBeGreaterThanOrEqual(jar.y + jar.height - 1);
    expect(total.y).toBeGreaterThan(label.y);
    expect(bars.y).toBeGreaterThan(total.y);
    expect(trig.y).toBeGreaterThan(bars.y + bars.height - 1);
    expect(Math.abs((trig.x + eye.x + eye.width) / 2 - 195)).toBeLessThanOrEqual(2);
    expect(Math.round(eye.width)).toBe(44);
    expect(Math.round(eye.height)).toBe(44);
    await expect(page.locator('.pv2-hero-label')).toHaveText(/^caixa · patrimônio$/i, { useInnerText: true });
    for (const sel of ['.pv2-hero-label', '.pv2-hero-total']) {
      expect(await page.locator(sel).evaluate((e) => getComputedStyle(e).textAlign)).toBe('center');
    }
    expect(await smallTargets(page, '.pv2-hero')).toEqual([]);
  });

  test('total com clamp não estoura 360px com valor de 7 dígitos', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await usarFixture(page, { caixa: 1234567 });
    await gotoApp(page, '/panorama');
    const total = page.locator('.pv2-hero-total');
    await expect(total).toHaveText(/1\.234\.567/);
    const span = await total.locator('span').boundingBox();
    expect(span.x).toBeGreaterThanOrEqual(16);
    expect(span.x + span.width).toBeLessThanOrEqual(360 - 16);
    expect(parseFloat(await total.evaluate((e) => getComputedStyle(e).fontSize))).toBeLessThanOrEqual(48);
  });

  test('KPIs em grade 2×2 (Receita, Despesa, Balanço, Poupança) e Projeção em linha inteira', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const band = page.locator('.pv2-kpiband');
    expect(await band.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
    expect(await band.locator('.pv2-kpi-label').allTextContents()).toEqual(['Receita', 'Despesa', 'Balanço', 'Poupança', 'Projeção']);
    const bb = await band.boundingBox();
    const cells = await band.evaluate((e) => [...e.children].map((c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: Math.round(r.y), w: r.width }; }));
    expect(cells[0].y).toBe(cells[1].y);
    expect(cells[2].y).toBe(cells[3].y);
    expect(cells[2].y).toBeGreaterThan(cells[0].y);
    expect(cells[1].x).toBeGreaterThan(cells[0].x);
    expect(Math.abs(cells[4].w - bb.width)).toBeLessThanOrEqual(1);
    // valores do 2×2 no mesmo tamanho (Poupança não fica maior que os outros)
    const sizes = await band.locator('.pv2-kpi-value, .pv2-kpi-big').evaluateAll((els) => els.map((e) => getComputedStyle(e).fontSize));
    expect(new Set(sizes).size).toBe(1);
  });

  test('cubo parado no celular (sem flutuar, sem balançar, sem bolhas)', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    await expect(page.locator('.pv2-hero-jar svg animate')).toHaveCount(0);
    expect(await page.locator('.pv2-hero-jar').evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  });

  test('privacidade: o olho borra os valores do hero e dos KPIs', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    await page.locator('.btn-privacy-toggle').click();
    await expect(page.locator('.pv2-root')).toHaveAttribute('data-privacy', 'on');
    for (const sel of ['.pv2-hero-total [data-money]', '.pv2-kpiband [data-money]']) {
      await expect.poll(() => page.locator(sel).first().evaluate((e) => getComputedStyle(e).filter)).toContain('blur');
    }
  });
});

test.describe('período', () => {
  test('o sheet troca o intervalo e o rótulo do gatilho', async ({ page }) => {
    await gotoApp(page, '/panorama');
    await page.locator('.pv2-hero-controls .drf-trigger').click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    const req = page.waitForRequest((r) => /\/panorama\/\?.*start=2026-01-01.*end=2027-01-01/.test(r.url()));
    await sheet.getByText('Este ano', { exact: true }).click();
    await req;
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('.pv2-hero-controls .drf-trigger')).toContainText('Este ano');
  });

  test('personalizado com teclado aberto: os campos de data ficam alcançáveis', async ({ page }) => {
    await gotoApp(page, '/panorama');
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--vvh', '420px');
      document.documentElement.style.setProperty('--kb-inset', '424px');
    });
    await page.locator('.pv2-hero-controls .drf-trigger').click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await sheet.getByText('Personalizado', { exact: true }).click();
    const fim = sheet.locator('.drf-range .pk-trigger').last();
    await fim.scrollIntoViewIfNeeded();
    await expect.poll(async () => { const b = await fim.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
  });
});

const VARIANTES = [
  ['dados reais', null],
  ['payload fixo', {}],
  ['valores grandes', { caixa: 1234567, insights: 5 }],
  ['descoberto', { caixa: 3000 }],
];
for (const w of [360, 390, 430, 768]) {
  for (const [nome, opts] of VARIANTES) {
    test(`sem overflow em ${w}px (${nome})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      if (opts) await usarFixture(page, opts);
      await gotoApp(page, '/panorama');
      expect(await overflowOffenders(page)).toEqual([]);
    });
  }
}
```

Acrescentar ao fim de `bussola_web/e2e/panorama.desktop.spec.mjs`:

```js
test('desktop panorama: movimento reduzido tira as bolhas SMIL do cubo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  await expect(page.locator('.pv2-hero-jar svg')).toBeVisible();
  await expect(page.locator('.pv2-hero-jar svg animate')).toHaveCount(0);
});
```

Run: `npm run e2e -- --project=mobile e2e/panorama.mobile.spec.mjs` → Expected: os 5 de "hero e KPIs" FAIL (cubo de 200px ao lado do texto; KPIs em flex; bolhas presentes; olho de 36px); "período" passa (sheet do plano 01, guarda); overflow FAIL pelo menos em 360px (hero de 2 colunas).
Run: `npm run e2e -- --project=desktop e2e/panorama.desktop.spec.mjs` → Expected: "movimento reduzido" FAIL (as bolhas continuam).

- [ ] **Step 2: Cubo com `animate` e ordem dos KPIs no `index.jsx`**

(a) Trocar `import { useIsMobile } from '../../hooks/useIsMobile';` por:

```jsx
import { useIsMobile, useMediaQuery } from '../../hooks/useIsMobile';
```

(b) Trocar `function Reservoir({ total, disp, guard, cap, startLevel = 0 }) {` por:

```jsx
// animate=false (celular ou movimento reduzido): sem o balanço do líquido e sem as bolhas SMIL
// (o CSS global de reduced-motion não alcança <animate>).
function Reservoir({ total, disp, guard, cap, startLevel = 0, animate = true }) {
```

(c) Trocar

```jsx
      <g style={{ animation: 'pv2-bob 4.5s ease-in-out infinite', transformBox: 'view-box', transformOrigin: 'center' }}>
```

por:

```jsx
      <g style={animate ? { animation: 'pv2-bob 4.5s ease-in-out infinite', transformBox: 'view-box', transformOrigin: 'center' } : undefined}>
```

(d) Trocar `      {f > 0.04 && (` (o bloco das bolhas, comentário `{/* bolhas subindo (loop) dentro do líquido */}` logo acima) por:

```jsx
      {animate && f > 0.04 && (
```

(e) Depois de `  const isMobile = useIsMobile();` acrescentar:

```jsx
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
```

(f) No `hero`, trocar

```jsx
      <div className="pv2-hero-jar"><Reservoir total={total} disp={disp} guard={guardado} cap={cap} startLevel={startLevel} /></div>
```

por:

```jsx
      <div className="pv2-hero-jar"><Reservoir total={total} disp={disp} guard={guardado} cap={cap} startLevel={startLevel} animate={!isMobile && !reduceMotion} /></div>
```

(g) No `kpiBand`, trocar `      {[...kpiCells, projecao, poupanca]}` por:

```jsx
      {/* Celular: 2×2 Receita · Despesa / Balanço · Poupança e a Projeção numa linha inteira. */}
      {isMobile ? [...kpiCells, poupanca, projecao] : [...kpiCells, projecao, poupanca]}
```

- [ ] **Step 3: CSS do hero e dos KPIs no celular**

Acrescentar ao **fim** de `bussola_web/src/pages/Panorama/panorama-v2.css`:

```css

/* Celular — hero "Cubo em cima": cubo de 150px parado, depois rótulo, total, barras,
   aviso/nota e, por último, período + privacidade. O .pv2-hero-top vira "contents" para
   o rótulo e os controles virarem itens do mesmo flex (o DateRangeFilter não sai do lugar
   no DOM, então não remonta). */
@media (max-width: 768px) {
  .pv2-hero { grid-template-columns: minmax(0, 1fr); justify-items: center; gap: var(--sp-4); padding: var(--sp-2) 0 var(--sp-5); }
  .pv2-hero-jar { width: 150px; animation: none; }
  .pv2-hero-info { width: 100%; display: flex; flex-direction: column; }
  .pv2-hero-top { display: contents; }
  .pv2-hero-label { order: 1; text-align: center; margin-bottom: var(--sp-1); }
  .pv2-hero-label-extra { display: none; }
  .pv2-hero-total { order: 2; text-align: center; font-size: clamp(32px, 10vw, 48px); margin-bottom: var(--sp-4); }
  .pv2-hero-bars { order: 3; flex-direction: column; gap: var(--sp-3); max-width: none; }
  .pv2-hero-bar { min-width: 0; }
  .pv2-hero-bar-head .lbl { font-size: 14px; }
  .pv2-hero-neg { order: 4; align-self: center; margin-top: var(--sp-3); }
  .pv2-hero-note { order: 5; text-align: center; margin: var(--sp-3) auto 0; }
  .pv2-hero-controls { order: 6; justify-content: center; gap: var(--sp-2); margin-top: var(--sp-4); }

  /* KPIs: grade 2×2 com divisórias finas; Projeção (5º item) numa linha inteira. */
  .pv2-kpiband { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pv2-kpiband > .pv2-kpi,
  .pv2-kpiband > .pv2-kpi-extra { min-width: 0; padding: var(--sp-3); border-left: none; }
  .pv2-kpiband > :nth-child(odd) { padding-left: 0; }
  .pv2-kpiband > :nth-child(even) { padding-right: 0; border-left: 1px solid var(--line); }
  .pv2-kpiband > :nth-child(-n+2) { border-bottom: 1px solid var(--line); }
  .pv2-kpiband > .pv2-kpi-proj { grid-column: 1 / -1; padding-right: 0; border-top: 1px solid var(--line); }
  .pv2-kpi-value,
  .pv2-kpi-big { font-size: clamp(18px, 5.6vw, 24px); margin: var(--sp-2) 0; }
  .pv2-proj-chip { font-size: 12px; }
}
```

- [ ] **Step 4: Privacidade com hover só no mouse e 44px no toque**

Em `bussola_web/src/pages/Panorama/styles.css`, trocar

```css
.btn-privacy-toggle:hover, .btn-privacy-toggle.active {
    background-color: var(--cor-fundo-hover);
    color: var(--cor-azul-primario);
    border-color: var(--cor-azul-primario);
}
```

por:

```css
.btn-privacy-toggle.active {
    background-color: var(--cor-fundo-hover);
    color: var(--cor-azul-primario);
    border-color: var(--cor-azul-primario);
}

/* Hover só com mouse: no toque o :hover "gruda" e o olho parecia ativo depois de desligar. */
@media (hover: hover) and (pointer: fine) {
    .btn-privacy-toggle:hover {
        background-color: var(--cor-fundo-hover);
        color: var(--cor-azul-primario);
        border-color: var(--cor-azul-primario);
    }
}

@media (pointer: coarse) {
    .btn-privacy-toggle {
        width: var(--tap-min);
        height: var(--tap-min);
    }
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/panorama.mobile.spec.mjs` → Expected: tudo passa (3 da Task 2 + 5 hero/KPIs + 2 período + 16 overflow). Se o overflow listar algo dos widgets (Tasks 4–5 ainda não mexeram neles), corrija o elemento listado no bloco do celular e registre no commit.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (inclui "movimento reduzido" e os PNGs).
Run: `npm run e2e -- --project=tablet e2e/panorama.tablet.spec.mjs` → Expected: 7 passed.
Run: `npx eslint src/pages/Panorama` → Expected: sem problemas.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Panorama bussola_web/e2e/panorama.mobile.spec.mjs bussola_web/e2e/panorama.desktop.spec.mjs
git commit -m "feat(web): hero do Panorama com cubo em cima, KPIs 2x2 e cubo parado no celular/movimento reduzido" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: "Atenção agora" como carrossel no celular + alvos de 44px no toque

**Files:**
- Modify: `bussola_web/src/pages/Panorama/index.jsx`, `bussola_web/src/pages/Panorama/panorama-v2.css`, `bussola_web/e2e/panorama.mobile.spec.mjs`, `bussola_web/e2e/panorama.tablet.spec.mjs`

**Interfaces:**
- Consumes: `renderAlert`, `insights`, `dismissInsight`, `topo` (Task 1).
- Produces: estado `attnIdx`; `onAttnScroll(e)`; `atencaoMobile` (cabeçalho sem setas, `.pv2-attn-row.is-carousel[data-offscreen-ok][role=region][aria-label=Alertas]` só com alertas reais, `.pv2-attn-pips` decorativo quando há 2+); CSS do carrossel (snap, 1 card por vez, sombras no gutter); sob `pointer: coarse`: dispensar, CTA, setas e pontos com 44px; hovers do Panorama só com mouse.

- [ ] **Step 1: Testes que falham**

Acrescentar ao fim de `bussola_web/e2e/panorama.mobile.spec.mjs`:

```js
// ---------------------------------------------------------------------------
// Task 4 — Atenção agora
// ---------------------------------------------------------------------------
test.describe('Atenção agora (carrossel)', () => {
  const pipAtivo = (page) => page.locator('.pv2-attn-pip').evaluateAll((els) => els.findIndex((e) => e.classList.contains('active')));

  test('só alertas reais, 1 por vez, com snap e indicador', async ({ page }) => {
    await usarFixture(page, { insights: 3 });
    await gotoApp(page, '/panorama');
    const row = page.locator('.pv2-attn-row.is-carousel');
    await expect(row).toBeVisible();
    await expect(row.locator('.pv2-alert')).toHaveCount(3);
    await expect(page.locator('.pv2-alert-empty')).toHaveCount(0);
    await expect(page.locator('.pv2-attn-arrow')).toHaveCount(0);
    await expect(page.locator('.pv2-attn-count')).toHaveText('3 alertas');
    expect(await row.evaluate((e) => getComputedStyle(e).scrollSnapType)).toContain('x mandatory');

    const grid = await caixa(page, '.pv2-grid'); // largura do conteúdo (gutter de 16)
    const cards = await row.locator('.pv2-alert').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; }));
    expect(Math.abs(cards[0].x - grid.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(cards[0].w - grid.width)).toBeLessThanOrEqual(1);
    expect(cards[1].x).toBeGreaterThan(grid.x + grid.width); // o 2º fica fora (no máximo uma "espiada" no gutter)

    await expect(page.locator('.pv2-attn-pip')).toHaveCount(3);
    expect(await pipAtivo(page)).toBe(0);
    await row.evaluate((e) => e.scrollTo({ left: e.children[1].offsetLeft - e.children[0].offsetLeft }));
    await expect.poll(() => pipAtivo(page)).toBe(1);
    expect(await overflowOffenders(page)).toEqual([]);
  });

  test('dispensar com alvo de 44px remove o card e atualiza a contagem', async ({ page }) => {
    await usarFixture(page, { insights: 3 });
    await gotoApp(page, '/panorama');
    const primeiro = page.locator('.pv2-attn-row .pv2-alert').first();
    await expect(primeiro).toContainText('Orçamento estourado: Lazer');
    const x = primeiro.getByRole('button', { name: 'Dispensar por 24h' });
    const b = await x.boundingBox();
    expect(Math.round(b.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(b.height)).toBeGreaterThanOrEqual(44);
    await x.click();
    await expect(page.locator('.pv2-attn-row .pv2-alert')).toHaveCount(2);
    await expect(page.locator('.pv2-attn-row')).not.toContainText('Orçamento estourado: Lazer');
    await expect(page.locator('.pv2-attn-count')).toHaveText('2 alertas');
    expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('panorama_dismissed') || '{}')))).toEqual(['e2e-orc']);
    expect(await smallTargets(page, '.pv2-section-top')).toEqual([]);
  });

  test('um alerta: sem indicador; nenhum alerta: a seção some', async ({ page }) => {
    await usarFixture(page, { insights: 1 });
    await gotoApp(page, '/panorama');
    await expect(page.locator('.pv2-attn-row .pv2-alert')).toHaveCount(1);
    await expect(page.locator('.pv2-attn-pips')).toHaveCount(0);
    await expect(page.locator('.pv2-attn-count')).toHaveText('1 alerta');
    await page.locator('.pv2-alert').getByRole('button', { name: 'Dispensar por 24h' }).click();
    await expect(page.locator('.pv2-section-top')).toHaveCount(0);
  });

  test('"Ver →" com 44px leva para a página do alerta', async ({ page }) => {
    await usarFixture(page, { insights: 1 });
    await gotoApp(page, '/panorama');
    const ver = page.locator('.pv2-alert-cta');
    expect(Math.round((await ver.boundingBox()).height)).toBeGreaterThanOrEqual(44);
    await ver.click();
    await expect(page).toHaveURL(/\/financas$/);
  });
});
```

Acrescentar ao fim de `bussola_web/e2e/panorama.tablet.spec.mjs`:

```js
test('tablet: setas, pontos, dispensar e olho com 44px (toque)', async ({ page }) => {
  await usarFixture(page, { insights: 5 });
  await gotoApp(page, '/panorama');
  await expect(page.locator('.pv2-attn-arrow')).toHaveCount(2); // tablet mantém a paginação do desktop
  expect(await smallTargets(page, '.panorama-scope')).toEqual([]);
  await page.getByRole('button', { name: 'Página 2' }).click();
  await expect(page.locator('.pv2-alert-empty')).toHaveCount(3);
});
```

Run: `npm run e2e -- --project=mobile e2e/panorama.mobile.spec.mjs` → Expected: os 4 de "Atenção agora" FAIL (sem `.is-carousel`, com placeholders, dispensar de 24px, CTA de ~28px).
Run: `npm run e2e -- --project=tablet e2e/panorama.tablet.spec.mjs` → Expected: o novo FAIL (setas 27px, pontos 7px, dispensar 24px).

- [ ] **Step 2: Carrossel no `index.jsx`**

(a) Depois de `  const [dismissed, setDismissed] = useState(loadDismissed);` acrescentar:

```jsx
  const [attnIdx, setAttnIdx] = useState(0); // card visível do carrossel (celular)
```

(b) Logo **antes** da linha `  // ---------- Hero: Caixa ----------` inserir:

```jsx
  // Celular: carrossel com 1 card por vez, só alertas reais (sem "Sem aviso aqui").
  // O indicador acompanha o scroll; o passo é a distância entre dois cards (largura + gap).
  const onAttnScroll = (e) => {
    const el = e.currentTarget;
    const step = el.children.length > 1 ? el.children[1].offsetLeft - el.children[0].offsetLeft : el.clientWidth;
    setAttnIdx(Math.round(el.scrollLeft / (step || 1)));
  };
  const attnAtivo = Math.min(attnIdx, Math.max(0, insights.length - 1));
  const atencaoMobile = insights.length > 0 && (
    <div className="pv2-section-top">
      <div className="pv2-attn-head">
        <span className="pv2-attn-dot" />
        <span className="pv2-attn-title">Atenção agora</span>
        <span className="pv2-attn-count">{`${insights.length} ${insights.length === 1 ? 'alerta' : 'alertas'}`}</span>
      </div>
      <div className="pv2-attn-row is-carousel" data-offscreen-ok="" role="region" aria-label="Alertas" tabIndex={0} onScroll={onAttnScroll}>
        {insights.map((it) => renderAlert(it))}
      </div>
      {insights.length > 1 && (
        <div className="pv2-attn-pips" aria-hidden="true">
          {insights.map((it, i) => <span key={it.id} className={`pv2-attn-pip ${i === attnAtivo ? 'active' : ''}`} />)}
        </div>
      )}
    </div>
  );

```

(c) Trocar `  const topo = { atencao, hero, kpis: kpiBand };` por:

```jsx
  const topo = { atencao: isMobile ? atencaoMobile : atencao, hero, kpis: kpiBand };
```

- [ ] **Step 3: Hovers do Panorama só com mouse**

Em `bussola_web/src/pages/Panorama/panorama-v2.css`, trocar cada uma das 3 linhas abaixo pela versão envolvida em `@media (hover: hover) and (pointer: fine)` (o desktop não muda; no toque o `:hover` grudava):

```css
.pv2-btn:hover { opacity: .85; }
```
→
```css
@media (hover: hover) and (pointer: fine) { .pv2-btn:hover { opacity: .85; } }
```

```css
.pv2-alert-dismiss:hover { opacity: 1; color: var(--text); background: color-mix(in srgb, var(--muted2) 22%, transparent); }
```
→
```css
@media (hover: hover) and (pointer: fine) { .pv2-alert-dismiss:hover { opacity: 1; color: var(--text); background: color-mix(in srgb, var(--muted2) 22%, transparent); } }
```

```css
.pv2-attn-arrow:hover { color: var(--text); border-color: var(--blue); }
```
→
```css
@media (hover: hover) and (pointer: fine) { .pv2-attn-arrow:hover { color: var(--text); border-color: var(--blue); } }
```

- [ ] **Step 4: CSS do carrossel e dos alvos de toque**

Acrescentar ao **fim** de `bussola_web/src/pages/Panorama/panorama-v2.css`:

```css

/* Celular — Atenção agora: carrossel de 1 card por vez. A faixa avança sobre o gutter
   (margem −16 / padding 16) para as sombras do card não serem cortadas pelo scroll;
   o scroll-padding alinha o card ao conteúdo. */
@media (max-width: 768px) {
  .pv2-section-top { margin-top: var(--sp-5); padding-top: 0; }
  .pv2-attn-head { gap: var(--sp-2); margin-bottom: 0; }
  .pv2-attn-row.is-carousel {
    flex-wrap: nowrap;
    gap: var(--sp-3);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--sp-4);
    margin: 0 calc(var(--sp-4) * -1);
    padding: var(--sp-3) var(--sp-4) var(--sp-5);
    scrollbar-width: none;
    animation: none;
  }
  .pv2-attn-row.is-carousel::-webkit-scrollbar { display: none; }
  .pv2-attn-row.is-carousel > .pv2-alert { flex: 0 0 100%; min-width: 0; scroll-snap-align: start; padding: var(--sp-4); gap: var(--sp-3); }
  .pv2-alert-sev { font-size: 11px; }
  .pv2-attn-pips { display: flex; justify-content: center; align-items: center; gap: var(--sp-2); margin-top: calc(var(--sp-3) * -1); }
  .pv2-attn-pip { width: 7px; height: 7px; border-radius: 50%; background: var(--border); transition: width .2s, background .2s; }
  .pv2-attn-pip.active { width: 18px; border-radius: 4px; background: var(--blue); }
}

/* Toque (celular e tablet): alvos de 44px. Os pontos da paginação (tablet) ganham a área
   de toque e desenham o ponto de 7px / 18px num ::before, igual ao visual atual. */
@media (pointer: coarse) {
  .pv2-alert-dismiss { width: var(--tap-min); height: var(--tap-min); font-size: 14px; }
  .pv2-alert-cta { min-height: var(--tap-min); padding: 0 var(--sp-4); font-size: 14px; }
  .pv2-attn-arrow { width: var(--tap-min); height: var(--tap-min); font-size: 14px; }
  .pv2-attn-dots { gap: 0; }
  button.pv2-attn-dot-btn,
  button.pv2-attn-dot-btn.active { position: relative; width: var(--tap-min); height: var(--tap-min); border-radius: 50%; background: transparent; }
  button.pv2-attn-dot-btn::before { content: ''; position: absolute; top: 50%; left: 50%; width: 7px; height: 7px; border-radius: 50%; background: var(--border); transform: translate(-50%, -50%); transition: width .2s, background .2s; }
  button.pv2-attn-dot-btn.active::before { width: 18px; border-radius: 4px; background: var(--blue); }
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/panorama.mobile.spec.mjs` → Expected: tudo passa (inclui os 16 de overflow, agora com o carrossel).
Run: `npm run e2e -- --project=tablet e2e/panorama.tablet.spec.mjs` → Expected: 8 passed.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (inclui `panorama-atencao-p2.png`).
Run: `npx eslint src/pages/Panorama` → Expected: sem problemas.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Panorama bussola_web/e2e/panorama.mobile.spec.mjs bussola_web/e2e/panorama.tablet.spec.mjs
git commit -m "feat(web): Atencao agora em carrossel so com alertas reais no celular e alvos de 44px no toque" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Widgets no celular (legenda do donut, Evolução 6 meses, Média por dia, jarros, tipografia)

**Files:**
- Modify: `bussola_web/src/pages/Panorama/index.jsx`, `bussola_web/src/pages/Panorama/panorama-v2.css`, `bussola_web/e2e/panorama.mobile.spec.mjs`, `bussola_web/e2e/panorama.tablet.spec.mjs`

**Interfaces:**
- Consumes: `widgets.evolucao`, `widgets.media`, `ev`, `week`, `isMobile` (Tasks 1–2).
- Produces:
  - `Donut({ cats })` → svg + `.pv2-donut-legend` (linhas `.pv2-donut-legend-row` com amostra, nome, valor `data-money`, %), escondida em ≥1025.
  - `Evolution({ ev, compact = false, sel = -1, onSel })`: `compact` = viewBox `0 0 320 166`, colunas de borda a borda (`X0 = 0`), sem `<text>`, coluna `sel` destacada (`.pv2-evo-sel`); `onSel(i)` no toque da coluna.
  - `Weekday({ days, compact = false, sel = -1, onSel })`: `compact` = rótulos 12, dia `sel` em destaque.
  - Estados `evoSel`, `weekSel`; derivados `evBase`, `evShown` (últimos 6), `evIdx` (padrão: último), `weekMax`, `weekIdx` (padrão: dia de maior média).
  - No celular: `.pv2-evo-months` (botões de mês com 44px, `aria-pressed`), `.pv2-readout` (mês · Receita · Despesa · Caixa), `.pv2-week-readout` com `‹ ›` (`aria-label` "Dia anterior"/"Próximo dia").

- [ ] **Step 1: Testes que falham**

Acrescentar ao fim de `bussola_web/e2e/panorama.mobile.spec.mjs`:

```js
// ---------------------------------------------------------------------------
// Task 5 — widgets
// ---------------------------------------------------------------------------
// Textos visíveis abaixo do mínimo (12px; 11px se caixa alta). SVG: tamanho renderizado.
async function textosPequenos(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.pv2-root *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const svg = el.closest('svg');
      if (svg) {
        if (el.tagName.toLowerCase() !== 'text') continue;
        const px = parseFloat(cs.fontSize) * (svg.getBoundingClientRect().width / svg.viewBox.baseVal.width);
        if (px < 11.95) out.push(`svg text "${el.textContent.trim()}" ${px.toFixed(1)}px`);
        continue;
      }
      const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!temTexto) continue;
      const px = parseFloat(cs.fontSize);
      const min = cs.textTransform === 'uppercase' ? 11 : 12;
      if (px < min - 0.01) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 24)}" ${px}px`);
    }
    return out;
  });
}

test.describe('widgets', () => {
  test('Gastos por categoria: legenda visível com nome, valor e %', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const legenda = page.locator('[data-widget="donut"] .pv2-donut-legend');
    await expect(legenda).toBeVisible();
    const linhas = legenda.locator('.pv2-donut-legend-row');
    await expect(linhas).toHaveCount(4);
    await expect(linhas.nth(0)).toHaveText(/Moradia\s*R\$\s2\.400\s*57%/);
    await expect(linhas.nth(3)).toHaveText(/Transporte\s*R\$\s210\s*5%/);
    const nome = await legenda.locator('.pv2-donut-legend-name').first().evaluate((e) => getComputedStyle(e).fontSize);
    expect(parseFloat(nome)).toBeGreaterThanOrEqual(14);
  });

  test('Evolução: 6 meses, botões de 44px e leitura fixa (botão e coluna dão o mesmo mês)', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const card = page.locator('[data-widget="evolucao"]');
    await expect(card.locator('.pv2-card-title')).toHaveText('Evolução · últimos 6 meses');
    await expect(card.locator('svg text')).toHaveCount(0);
    const meses = card.locator('.pv2-evo-month');
    expect(await meses.allTextContents()).toEqual(['mai/26', 'jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26']);
    await expect(meses.last()).toHaveAttribute('aria-pressed', 'true');
    const leitura = card.locator('.pv2-readout');
    await expect(leitura).toHaveText(/out\/26.*Receita\s*R\$\s8\.400.*Despesa\s*R\$\s5\.120.*Caixa\s*R\$\s18\.500/);
    await card.getByRole('button', { name: 'jun/26' }).click();
    await expect(leitura).toHaveText(/jun\/26.*Receita\s*R\$\s8\.100.*Despesa\s*R\$\s5\.200.*Caixa\s*R\$\s15\.725/);
    // tocar na coluna de jul/26 (3ª de 6) dá o mesmo que o botão
    const svg = await card.locator('svg').boundingBox();
    await page.mouse.click(svg.x + svg.width * (2.5 / 6), svg.y + svg.height * 0.5);
    await expect(leitura).toHaveText(/jul\/26.*Receita\s*R\$\s7\.900/);
    await expect(card.getByRole('button', { name: 'jul/26' })).toHaveAttribute('aria-pressed', 'true');
    // botões alinhados às colunas: 1/6 da largura do gráfico cada, com 44px de altura
    const b = await meses.first().boundingBox();
    expect(Math.abs(b.width - svg.width / 6)).toBeLessThanOrEqual(1);
    expect(b.height).toBeGreaterThanOrEqual(44);
  });

  test('Média por dia: começa no dia de maior média e anda com ‹ ›', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const card = page.locator('[data-widget="media"]');
    const leitura = card.locator('.pv2-week-readout');
    await expect(leitura).toHaveText(/Qua\s*·\s*média\s*R\$\s80/);
    await card.getByRole('button', { name: 'Próximo dia' }).click();
    await expect(leitura).toHaveText(/Qui\s*·\s*média\s*R\$\s40/);
    await card.getByRole('button', { name: 'Dia anterior' }).click();
    await card.getByRole('button', { name: 'Dia anterior' }).click();
    await expect(leitura).toHaveText(/Ter\s*·\s*média\s*R\$\s30/);
  });

  test('Cofrinhos: os 3 jarros numa linha só em 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    const goals = await page.locator('.pv2-goal').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { y: Math.round(r.y), right: r.right }; }));
    expect(goals).toHaveLength(3);
    expect(new Set(goals.map((g) => g.y)).size).toBe(1);
    const card = await caixa(page, '[data-widget="cofrinhos"]');
    for (const g of goals) expect(g.right).toBeLessThanOrEqual(card.x + card.width);
  });

  test('privacidade borra a legenda e as leituras', async ({ page }) => {
    await usarFixture(page);
    await gotoApp(page, '/panorama');
    await page.locator('.btn-privacy-toggle').click();
    for (const sel of ['.pv2-donut-legend-val', '[data-widget="evolucao"] .pv2-readout [data-money]', '.pv2-week-readout [data-money]']) {
      await expect.poll(() => page.locator(sel).first().evaluate((e) => getComputedStyle(e).filter)).toContain('blur');
    }
  });

  for (const w of [360, 390]) {
    test(`tipografia mínima em ${w}px (12px; 11px em caixa alta) e conteúdo principal com 14px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await usarFixture(page, { insights: 3 });
      await gotoApp(page, '/panorama');
      expect(await textosPequenos(page)).toEqual([]);
      for (const sel of ['.pv2-budget-head', '.pv2-paybar-label', '.pv2-prio', '.pv2-ritmo-row', '.pv2-hero-bar-head .lbl', '.pv2-goal-name', '.pv2-readout']) {
        expect(parseFloat(await page.locator(sel).first().evaluate((e) => getComputedStyle(e).fontSize)), sel).toBeGreaterThanOrEqual(14);
      }
    });
  }

  test('todos os controles da página com 44px', async ({ page }) => {
    await usarFixture(page, { insights: 3 });
    await gotoApp(page, '/panorama');
    expect(await smallTargets(page, '.panorama-scope')).toEqual([]);
  });
});
```

Acrescentar ao fim de `bussola_web/e2e/panorama.tablet.spec.mjs`:

```js
test('tablet: legenda do donut visível e jarros numa linha só', async ({ page }) => {
  await usarFixture(page);
  await gotoApp(page, '/panorama');
  await expect(page.locator('.pv2-donut-legend')).toBeVisible();
  const ys = await page.locator('.pv2-goal').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().y)));
  expect(new Set(ys).size).toBe(1);
});
```

Run: `npm run e2e -- --project=mobile e2e/panorama.mobile.spec.mjs` → Expected: os 8 de "widgets" FAIL (sem legenda, Evolução com 12 meses em `<text>` de ~4,6px, sem leituras, jarros 2+1, fontes de 10,5–13px).
Run: `npm run e2e -- --project=tablet e2e/panorama.tablet.spec.mjs` → Expected: o novo FAIL.

- [ ] **Step 2: `Donut` com legenda**

Em `bussola_web/src/pages/Panorama/index.jsx`, substituir a função `Donut` inteira (de `function Donut({ cats }) {` até o `}` que a fecha, antes de `function Weekday`) por:

```jsx
function Donut({ cats }) {
  if (!cats.length) return <div className="pv2-empty-note"><i className="fa-solid fa-chart-pie"></i><span>Sem gastos no período.</span></div>;
  const { R, C, tot, segs } = donutSegments(cats);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: 4 }}>
        <svg viewBox="0 0 160 160" width="230" style={{ maxWidth: '100%' }}>
          {segs.map((c, i) => (
            <circle key={i} cx="80" cy="80" r={R} data-tooltip={`${c.n}: ${fmt(c.v)}`} style={{ fill: 'none', stroke: c.color, strokeWidth: 22, strokeDasharray: `${c.len} ${C - c.len}`, strokeDashoffset: -c.off, transform: 'rotate(-90deg)', transformOrigin: '80px 80px', cursor: 'pointer' }} />
          ))}
          <text x="80" y="75" textAnchor="middle" style={{ fill: 'var(--muted2)', fontSize: 11 }}>total</text>
          <text x="80" y="94" textAnchor="middle" data-money="" style={{ fill: 'var(--text)', fontSize: 17, fontWeight: 800 }}>{fmt(tot)}</text>
        </svg>
      </div>
      {/* Legenda visível: no toque não há tooltip. Escondida no desktop (≥1025), onde o hover mostra o valor. */}
      <div className="pv2-donut-legend">
        {segs.map((c, i) => (
          <div key={i} className="pv2-donut-legend-row">
            <span className="pv2-donut-legend-sw" style={{ background: c.color }} />
            <span className="pv2-donut-legend-name">{c.n}</span>
            <span className="pv2-donut-legend-val" data-money="">{fmt(c.v)}</span>
            <span className="pv2-donut-legend-pct">{Math.round(c.v / tot * 100)}%</span>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: `Weekday` e `Evolution` com modo compacto e seleção**

Substituir a função `Weekday` inteira (de `function Weekday({ days }) {` até o `}` que a fecha, antes do comentário `// Barras horizontais — Gastos por forma de pagamento`) por:

```jsx
// compact (celular): rótulos maiores; o dia `sel` fica em destaque; tocar na coluna chama onSel(i).
function Weekday({ days, compact = false, sel = -1, onSel }) {
  const max = Math.max(...days.map(d => d.v), 1);
  const bw = 26, gap = (260 - bw * 7) / 8, base = 96;
  return (
    <svg viewBox="0 0 260 120" width="100%">
      {days.map((d, i) => {
        const bh = d.v / max * 72; const x = gap + i * (bw + gap); const wk = d.d === 'Sáb' || d.d === 'Dom';
        return (
          <g key={i}>
            <rect x={x} y={base - bh} width={bw} height={bh} rx="5" style={{ fill: wk ? 'var(--orange)' : 'var(--blue)', fillOpacity: wk ? 0.9 : 0.75 }} />
            <text x={x + bw / 2} y="112" textAnchor="middle" style={{ fill: i === sel ? 'var(--text)' : 'var(--muted2)', fontSize: compact ? 12 : 10.5, fontWeight: i === sel ? 700 : undefined }}>{d.d}</text>
            {/* alvo de hover da coluna inteira → média do dia (no celular, toque seleciona) */}
            <rect x={x} y="0" width={bw} height={base} data-tooltip={`${d.d}: ${fmt(d.v)}`} onClick={onSel ? () => onSel(i) : undefined} style={{ fill: 'transparent', pointerEvents: 'all', cursor: onSel ? 'pointer' : 'help' }} />
          </g>
        );
      })}
    </svg>
  );
}
```

Substituir a função `Evolution` inteira (de `function Evolution({ ev }) {` até o `}` que a fecha, antes do comentário `// Jarro do cofrinho — IDÊNTICO`) por:

```jsx
// compact (celular): viewBox mais estreito (escala ~1, traço legível), colunas de borda a borda
// para alinhar com os botões de mês em HTML (que substituem os rótulos SVG), coluna `sel`
// destacada; tocar numa coluna chama onSel(i). Sem compact: desenho do desktop, intocado.
function Evolution({ ev, compact = false, sel = -1, onSel }) {
  const VBW = compact ? 320 : 640, VBH = compact ? 166 : 210;
  const X0 = compact ? 0 : 42, X1 = compact ? 320 : 624, W = X1 - X0, Y0 = compact ? 10 : 18, Y1 = compact ? 156 : 178, Hh = Y1 - Y0;
  const maxBar = Math.max(...ev.map(e => Math.max(e.rec, e.desp)), 1);
  const gw = W / ev.length, bw = Math.min(11, gw * 0.32);
  const grid = [0, 0.5, 1].map((g, i) => <line key={'g' + i} x1={X0} y1={Y1 - g * Hh} x2={X1} y2={Y1 - g * Hh} style={{ stroke: 'var(--line)', strokeWidth: 1 }} />);
  const tipFor = (e) => `${e.m} · Receita ${fmt(e.rec)} · Despesa ${fmt(e.desp)} · Caixa ${fmt(e.caixa)}`;
  const bars = ev.map((e, i) => {
    const cx = X0 + gw * i + gw / 2; const rh = e.rec / maxBar * Hh, dh = e.desp / maxBar * Hh;
    return (
      <g key={i}>
        {compact && i === sel && <rect className="pv2-evo-sel" x={X0 + gw * i + 2} y={Y0 - 6} width={gw - 4} height={Hh + 6} rx="8" />}
        <rect x={cx - bw - 1} y={Y1 - rh} width={bw} height={rh} rx="3" style={{ fill: 'var(--green)', fillOpacity: 0.85 }} />
        <rect x={cx + 1} y={Y1 - dh} width={bw} height={dh} rx="3" style={{ fill: 'var(--red)', fillOpacity: 0.8 }} />
        {!compact && <text x={cx} y="196" textAnchor="middle" style={{ fill: 'var(--muted2)', fontSize: 10 }}>{e.m}</text>}
        {/* alvo de hover da coluna inteira → valores do mês (no celular, toque seleciona) */}
        <rect x={cx - gw / 2} y={Y0} width={gw} height={Hh} data-tooltip={tipFor(e)} onClick={onSel ? () => onSel(i) : undefined} style={{ fill: 'transparent', pointerEvents: 'all', cursor: onSel ? 'pointer' : 'help' }} />
      </g>
    );
  });
  const cmin = Math.min(...ev.map(e => e.caixa)), cmax = Math.max(...ev.map(e => e.caixa)), cr = (cmax - cmin) || 1;
  const cyf = (v) => Y0 + 18 + (1 - (v - cmin) / cr) * (Hh - 30);
  const pts = ev.map((e, i) => `${X0 + gw * i + gw / 2},${cyf(e.caixa)}`).join(' ');
  const dots = ev.map((e, i) => (
    <circle key={'d' + i} cx={X0 + gw * i + gw / 2} cy={cyf(e.caixa)} r="3.2" data-tooltip={`${e.m} · Caixa ${fmt(e.caixa)}`} style={{ fill: 'var(--blue)', cursor: 'help' }} />
  ));
  return (
    <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%">
      {grid}{bars}
      <polyline points={pts} style={{ fill: 'none', stroke: 'var(--blue)', strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
      {dots}
    </svg>
  );
}
```

- [ ] **Step 4: Estado, derivados e os dois widgets no `Panorama`**

(a) Depois de `  const [attnIdx, setAttnIdx] = useState(0); // card visível do carrossel (celular)` acrescentar:

```jsx
  const [evoSel, setEvoSel] = useState(null);   // mês selecionado na Evolução (celular)
  const [weekSel, setWeekSel] = useState(null); // dia selecionado na Média por dia (celular)
```

(b) Depois da linha `  const weekAvg = week.length ? Math.round(week.reduce((s, w) => s + w.v, 0) / week.length) : 0;` acrescentar:

```jsx
  // Celular: últimos 6 meses (padrão = mês atual, o último) e dia de maior média.
  const evBase = ev.length ? ev : [{ m: '—', rec: 0, desp: 0, caixa: 0 }];
  const evShown = evBase.slice(-6);
  const evIdx = evoSel != null && evoSel < evShown.length ? evoSel : evShown.length - 1;
  const weekMax = week.reduce((best, w, i) => (w.v > week[best].v ? i : best), 0);
  const weekIdx = weekSel != null && weekSel < week.length ? weekSel : weekMax;
```

(c) Substituir a entrada `evolucao: ( … ),` do objeto `widgets` (de `    evolucao: (` até o `    ),` antes de `    donut: (`) por:

```jsx
    evolucao: (
      <div className="pcard span-8 is-wide-tablet" data-widget="evolucao">
        <div className="pv2-card-head">
          <span className="pv2-card-title">{isMobile ? 'Evolução · últimos 6 meses' : 'Evolução · últimos 12 meses'}</span>
          <div className="pv2-legend">
            <span className="pv2-legend-item"><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--green)' }} />Receita</span>
            <span className="pv2-legend-item"><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--red)' }} />Despesa</span>
            <span className="pv2-legend-item"><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--blue)' }} />Caixa</span>
          </div>
        </div>
        {isMobile ? (
          <>
            <Evolution ev={evShown} compact sel={evIdx} onSel={setEvoSel} />
            <div className="pv2-evo-months" style={{ gridTemplateColumns: `repeat(${evShown.length}, minmax(0, 1fr))` }}>
              {evShown.map((e, i) => (
                <button key={i} type="button" className={`pv2-evo-month ${i === evIdx ? 'active' : ''}`} aria-pressed={i === evIdx} onClick={() => setEvoSel(i)}>{e.m}</button>
              ))}
            </div>
            <div className="pv2-readout" aria-live="polite">
              <b>{evShown[evIdx].m}</b>
              <span className="pv2-legend-item"><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--green)' }} />Receita <b data-money="">{fmt(evShown[evIdx].rec)}</b></span>
              <span className="pv2-legend-item"><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--red)' }} />Despesa <b data-money="">{fmt(evShown[evIdx].desp)}</b></span>
              <span className="pv2-legend-item"><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--blue)' }} />Caixa <b data-money="">{fmt(evShown[evIdx].caixa)}</b></span>
            </div>
          </>
        ) : (
          <Evolution ev={evBase} />
        )}
      </div>
    ),
```

(d) Substituir a entrada `media: ( … ),` (de `    media: (` até o `    ),` antes de `    ritmo: (`) por:

```jsx
    media: (
      <div className="pcard span-4" data-widget="media">
        <div className="pv2-card-head">
          <span className="pv2-card-title">Média por dia</span>
          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>média <span data-money="">{fmt(weekAvg)}</span></span>
        </div>
        {week.length ? (
          <>
            <Weekday days={week} compact={isMobile} sel={isMobile ? weekIdx : -1} onSel={isMobile ? setWeekSel : undefined} />
            {/* Celular: a média de cada dia (antes só no tooltip). ‹ › porque 7 colunas não dão 44px em 360. */}
            {isMobile && (
              <div className="pv2-readout pv2-week-readout" aria-live="polite">
                <button type="button" className="pv2-readout-step" aria-label="Dia anterior" onClick={() => setWeekSel((weekIdx - 1 + week.length) % week.length)}><i className="fa-solid fa-chevron-left"></i></button>
                <span className="pv2-readout-text"><b>{week[weekIdx].d}</b> · média <b data-money="">{fmt(week[weekIdx].v)}</b></span>
                <button type="button" className="pv2-readout-step" aria-label="Próximo dia" onClick={() => setWeekSel((weekIdx + 1) % week.length)}><i className="fa-solid fa-chevron-right"></i></button>
              </div>
            )}
          </>
        ) : <div className="pv2-empty-note"><span>Sem dados.</span></div>}
      </div>
    ),
```

- [ ] **Step 5: CSS dos widgets**

Em `bussola_web/src/pages/Panorama/panorama-v2.css`, apagar a linha

```css
@media (max-width: 600px) { .pv2-paybar { grid-template-columns: 90px 1fr auto; gap: 10px; } }
```

e acrescentar ao **fim** do arquivo:

```css

/* Legenda do donut (toque não tem tooltip). Uma grade só, para valores e % alinharem. */
.pv2-donut-legend { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: var(--sp-2) var(--sp-3); margin-top: var(--sp-4); font-size: 14px; }
.pv2-donut-legend-row { display: contents; }
.pv2-donut-legend-sw { width: 10px; height: 10px; border-radius: 3px; }
.pv2-donut-legend-name { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv2-donut-legend-val { font-weight: 700; color: var(--text); text-align: right; white-space: nowrap; }
.pv2-donut-legend-pct { font-size: 12px; color: var(--muted2); text-align: right; min-width: 3ch; }
@media (min-width: 1025px) { .pv2-donut-legend { display: none; } }

/* Leituras por toque (só renderizadas no celular). */
.pv2-readout { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2) var(--sp-3); margin-top: var(--sp-3); font-size: 14px; color: var(--muted); }
.pv2-readout b { color: var(--text); }
.pv2-week-readout { flex-wrap: nowrap; justify-content: space-between; }
.pv2-readout-text { text-align: center; }
.pv2-readout-step { width: var(--tap-min); height: var(--tap-min); flex: none; border-radius: 50%; border: 1px solid var(--border); background: var(--card); color: var(--muted); display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; }
.pv2-evo-months { display: grid; margin-top: var(--sp-1); }
.pv2-evo-month { min-height: var(--tap-min); border: none; border-radius: 10px; background: transparent; color: var(--muted2); font: inherit; font-size: 12px; cursor: pointer; }
.pv2-evo-month.active { background: var(--track); color: var(--text); font-weight: 700; }
.pv2-evo-sel { fill: var(--track); }

/* Tablet e celular: os 3 jarros numa linha só (antes 2 + 1 órfão). */
@media (max-width: 1024px) {
  .pv2-goals { flex-wrap: nowrap; gap: var(--sp-3); }
  .pv2-goal { flex: 1 1 0; min-width: 0; }
}

/* Celular — tipografia dos widgets: principal ≥ 14px, secundário ≥ 12px. */
@media (max-width: 768px) {
  .pv2-legend { flex-wrap: wrap; gap: var(--sp-3); font-size: 12px; }
  .pv2-budget-head { gap: var(--sp-2); font-size: 14px; }
  .pv2-badge-over { font-size: 12px; }
  .pv2-goal-name { font-size: 14px; }
  .pv2-goal-eta { font-size: 12px; }
  .pv2-paybar { grid-template-columns: 90px minmax(0, 1fr) auto; gap: var(--sp-2); }
  .pv2-paybar-label,
  .pv2-paybar-val { font-size: 14px; }
  .pv2-prio,
  .pv2-ritmo-row { font-size: 14px; }
  .pv2-mini-stat .cap,
  .pv2-cofre-cap { font-size: 12px; }
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/panorama.mobile.spec.mjs` → Expected: tudo passa. Se `textosPequenos` listar um elemento, ajuste a fonte **dele** no bloco "tipografia dos widgets" (sem mudar o desktop).
Run: `npm run e2e -- --project=tablet e2e/panorama.tablet.spec.mjs` → Expected: 9 passed.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (legenda escondida, Evolução de 12 meses com `<text>`, PNGs iguais).
Run: `npx eslint src/pages/Panorama` → Expected: sem problemas.

- [ ] **Step 7: Commit**

```bash
git add bussola_web/src/pages/Panorama bussola_web/e2e/panorama.mobile.spec.mjs bussola_web/e2e/panorama.tablet.spec.mjs
git commit -m "feat(web): widgets do Panorama no celular (legenda do donut, Evolucao 6 meses com leitura, media por dia, jarros, tipografia)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verificação final (suíte, build, lint, conferência visual)

**Files:**
- Modify: nenhum arquivo de código, salvo correções apontadas pela conferência (cada uma no bloco `@media` certo de `panorama-v2.css`).

**Interfaces:**
- Consumes: tudo das Tasks 1–5.

- [ ] **Step 1: CSS morto e suíte completa**

Run (em `bussola_web/`): `node scripts/find-unused-css.mjs src/pages/Panorama/panorama-v2.css` → Expected: `(nenhuma regra morta)`.
Run: `node scripts/find-unused-css.mjs src/pages/Panorama/styles.css` → Expected: `(nenhuma regra morta)`.
Run: `npm run e2e` → Expected: tudo passa nos 3 projetos.
Run: `npm run e2e -- --project=desktop` mais uma vez → Expected: tudo passa (incluindo `desktop-visual` › `panorama` e as 2 bases de `panorama.desktop.spec.mjs`).

- [ ] **Step 2: Build e lint**

Run: `npm run build` → Expected: OK.
Run: `npx eslint src/pages/Panorama` → Expected: sem problemas (linha de base 0).
Run: `npm run lint 2>&1 | Select-String " error " | Measure-Object` → Expected: contagem ≤ à de antes do plano (anote os dois números para o commit).

- [ ] **Step 3: Conferência visual (360, 390, 430 e 900px), com screenshots olhados**

Gere as capturas com o payload fixo e com os dados reais (rode a partir de `bussola_web/`, com a API e o Vite de pé):

```powershell
@'
import { chromium } from '@playwright/test';
import { panoramaFixture, PANORAMA_API } from './e2e/panorama-fixture.mjs';
const state = 'e2e/.auth/state.json';
const browser = await chromium.launch();
for (const [w, touch] of [[360, true], [390, true], [430, true], [900, true]]) {
  for (const fixo of [true, false]) {
    const ctx = await browser.newContext({ storageState: state, viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: w <= 768, hasTouch: touch, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const page = await ctx.newPage();
    if (fixo) await page.route(PANORAMA_API, async (r) => r.fulfill({ response: await r.fetch(), json: panoramaFixture({ insights: 3 }) }));
    await page.goto('http://127.0.0.1:5173/panorama');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `../.superpowers/shots/final/panorama-${w}-${fixo ? 'fixo' : 'real'}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();
'@ | Set-Content -Encoding utf8 shots-panorama.mjs
node shots-panorama.mjs
Remove-Item shots-panorama.mjs
```

Abra **cada** PNG gerado em `.superpowers/shots/final/` e confira contra o mockup aprovado (`.superpowers/brainstorm/363-1790955507/content/05-panorama.html`, opção B "Cubo em cima", e a lista "Ordem proposta"):
- topbar "Panorama"; cubo centralizado (~150px de largura), "CAIXA · PATRIMÔNIO" e o total centralizados; barras Disponível/Guardado empilhadas; período + olho centralizados abaixo;
- KPIs 2×2 (Receita · Despesa / Balanço · Poupança) com divisórias finas e valores no mesmo tamanho; Projeção numa linha inteira;
- Atenção agora: 1 card por vez, sombra inteira (não cortada), indicador abaixo, nenhum "Sem aviso aqui";
- ordem: Orçamento → Cofrinhos (3 jarros numa linha) → Gastos por categoria (com legenda) → Evolução (6 meses, botões de mês, leitura) → Pagamento → Média por dia (leitura ‹ ›) → Ritmo → Produtividade → Agenda → Cofre;
- **espaçamento:** 16px de gutter; 12px entre os cards; 24px entre hero/KPIs/Atenção/grid; 16px dentro dos cards; 8px entre elementos dentro de um card (ex.: legenda do donut, leitura da Evolução); nada colado na barra inferior;
- nenhum texto principal abaixo de 14px; widgets com o mesmo visual do desktop (cores, raios, sombras);
- 900px: grade com Evolução e Pagamento inteiros e o resto em pares, sem buracos; legenda do donut visível;
- repita 390px no tema claro (Minha Conta → Tema) e confira contraste das divisórias e do indicador.

Corrija o que destoar no bloco `@media` correspondente (sem tocar no desktop), rode `npm run e2e` de novo e gere as capturas outra vez.

- [ ] **Step 4: Commit**

```bash
git add bussola_web/src bussola_web/e2e .superpowers/shots/final
git commit -m "test(web): verificacao final do Panorama no celular e tablet" -m "lint: <antes> -> <depois> erros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Se a conferência não exigiu nenhuma correção e as capturas não devem ir para o repositório, pule o `git add .superpowers/shots/final` e só registre a verificação no próximo commit da branch.)

---

## Decisões e suposições registradas neste plano

- **Módulos (Ritmo, Produtividade, Agenda, Cofre) em 1 coluna, não 2.** Em 360px cada coluna teria ~126px úteis: o card da Agenda tem blocos inline com `min-width: 200px` (estouraria) e as linhas do Ritmo ("Treino ativo … Treino ABC") quebrariam em 3. Mudar isso seria redesenhar o card.
- **Reordenação por JSX com `key`, não por `order` do CSS** (topo, widgets e KPIs), para a ordem de leitura/foco seguir a visual e o `DateRangeFilter` não remontar. A única reordenação por `order` é dentro do hero (rótulo/total/barras/controles), onde o filtro precisa ficar no mesmo pai.
- **Cubo parado no celular** (sem `pv2-floaty`, sem `pv2-bob`, sem bolhas SMIL), além de com `prefers-reduced-motion`. Motivo: bateria e o `drop-shadow` do SVG re-rasterizado a cada quadro numa página que rola muito. As ondas dos jarros (CSS do Metas) continuam, iguais às do cofre na aba Metas.
- **O SVG do cubo tem 150px de largura e ~225px de altura** (o viewBox 200×300 inclui halo e reflexo); o desenho do cubo em si fica com ~160px. Não cortei a área vazia para não mexer no desenho.
- **Rótulo "CAIXA · PATRIMÔNIO" no celular:** a palavra "acumulado" vai num `span` escondido ≤768, como no mockup; desktop/tablet seguem com o texto completo.
- **Média por dia ganhou leitura com ‹ ›** (não estava na lista aprovada), para cumprir "nenhuma informação só no tooltip": 7 colunas não chegam a 44px em 360px, então as setas (44px) são o controle; tocar na barra também seleciona. Começa no dia de maior média.
- **Evolução no celular:** os rótulos de mês saem do SVG e viram botões HTML de 44px alinhados às colunas (o SVG compacto vai de borda a borda). Começa no mês atual (o último).
- **Tablet:** legenda do donut visível (é toque), mas Evolução segue com 12 meses e sem leitura, e o "Atenção agora" mantém a paginação do desktop com os placeholders (agora com setas e pontos de 44px). Ficam só no tooltip, no tablet: valores mês a mês da Evolução, média por dia e o % do orçamento abaixo de 100%.
- **Tablet usa `grid-auto-flow: dense`:** a Média por dia aparece ao lado de Cofrinhos, antes do Pagamento (a ordem visual difere um pouco da do DOM).
- **Explicações dos KPIs** (`data-tooltip`: "Receitas efetivadas no período…") não ganham alternativa no celular: são texto de ajuda, e o "vs anterior" já está visível. O mesmo para o tooltip do cubo (Disponível/Guardado já aparecem nas barras).
- **Gap de 12px entre os widgets** (regra "entre cards") e 24px entre seções, mesmo com as sombras neumórficas grandes; se ficar apertado na conferência visual, a alternativa é 16px (`--sp-4`).
- **Carrossel avança sobre o gutter** (margem −16/padding 16) para as sombras não serem cortadas; com isso aparecem ~4px do próximo card na borda direita (dica de que há mais).
- **Pontos do carrossel no celular são só indicador** (`aria-hidden`, sem toque): o gesto é o swipe. A faixa tem `role="region"`, `aria-label="Alertas"` e `tabIndex=0` para rolar pelo teclado.
- **Jarros:** os 3 slots continuam sempre (inclusive "Vazio / crie um cofrinho"); em 360px os valores "R$ x / R$ y" quebram em 2 linhas dentro do jarro de ~90px.
- **CSS v1:** sai `.panorama-scope .modal-*`, `.close-btn`, `.btn-secondary`, `.empty-cell`, `.text-center` global (o Ritmo tem a própria versão escopada com `!important`) e o `@keyframes fadeInOverlay` (o de `global.css`, idêntico, vence). **Fica** o `@keyframes scaleInModal`: é a definição vencedora que os modais de Registros e o `AdminUserModal` usam hoje; tirá-lo mudaria a animação deles. Mover os keyframes para `components.css` fica para depois.
- **Classes que copiam inline** (`.pv2-legend` 14px/11.5px, `.pv2-proj-chip` 10.5px, `.pv2-kpi-big`, `.pv2-ritmo-row` 9px/13px, `.pv2-cofre-cap` 11.5px) carregam valores fora da escala de propósito: são os do desktop atual, para ele não mudar.
- **Payload fixo nos testes** (`page.route` em `GET /panorama/`): o banco demo não tem metas nem alertas estáveis, e Ritmo/Agenda/alertas dependem da data do servidor. Nada é gravado no banco, então não há limpeza `E2E `; o "dispensar" só mexe no `localStorage` do contexto do teste.
- **`.main-container` global da Agenda** (`padding-bottom: 5rem !important`) continua valendo no desktop do Panorama; no celular o Panorama sobrescreve com `!important` para não sobrar 80px vazios acima da barra inferior. Escopar a regra da Agenda é do plano 04.
- **O espaçador `<div style={{ height: 20 }} />` do fim da página** foi mantido (desktop).

## Rulings do controlador (vinculantes; prevalecem sobre as suposições acima)

- Módulos (Ritmo/Produtividade/Agenda/Cofre) em 1 coluna no celular: **aceito**.
- Cubo estático no celular (não só com reduced motion); ondas dos potes continuam: **aceito** (bateria).
- "Média por dia" com navegação ‹ ›: **aceito** (valores eram só tooltip; barras não cabem 44px).
- Tablet: **ajuste** — como tooltips não aparecem em dispositivos sem hover, a leitura por toque da Evolução (botões de mês + linha de valores) vale também quando `(hover: none)` em 769–1024 (pode manter 12 meses); placeholders "Sem aviso aqui" no tablet: aceito.
- "acumulado" oculto no celular: **aceito** (mockup aprovado).
- KPIs: **ajuste** — a spec proíbe informação só no hover; dê uma alternativa por toque às explicações dos KPIs (mesmo padrão do `KpiStrip` de Provisões do plano 02: tocar no KPI mostra a explicação em texto visível ou num sheet pequeno).
- `@keyframes scaleInModal` mantido; `fadeInOverlay`, `.text-center`, `.empty-cell` removidos: **aceito** (confirmar com a base visual).
- Dados fictícios via `page.route` (sem escrita no banco): **aceito**.
- Espaço de 12px entre widgets: **aceito**; se na conferência visual ficar apertado com as sombras, usar 16px (`--sp-4`) e registrar.
