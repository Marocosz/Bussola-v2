# Mobile 04: Roteiro (Agenda), plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a página Roteiro (`/agenda`) para o celular no layout aprovado "Faixa da semana": topbar "Roteiro" com o ícone `fa-calendar-days` que abre o calendário do mês (o `.dias-grid` atual) num sheet, faixa de 7 dias com ‹ › e swipe, busca + ordenação numa linha, lista do dia selecionado seguida dos próximos dias com o `CompromissoCard` atual em 1 coluna (12px livres entre cards, editar/excluir sempre visíveis com 44px), Fab "Novo compromisso" e o `AgendaModal` como sheet (Título e Data/Hora empilhados, lembrete no corpo, rodapé 50/50). O tooltip de hover do dia sai do celular. Antes de tudo, o `Agenda/styles.css` ganha escopo (`.agenda-scope`) sem mudar nenhuma outra página. Tablet ganha os ajustes da spec §6. Desktop (≥1025) fica idêntico.

**Architecture:**
- `Agenda/index.jsx` continua dono do estado de dados (`data`, `loading`, `searchTerm`, `sortOrder`, modal) e dos handlers. No mobile (`useIsMobile()`), ele não renderiza `.page-header` nem o grid de 2 colunas: renderiza `<RoteiroMobile>` (novo, em `Agenda/mobile/`), que recebe dados e handlers por props e guarda só o estado de navegação (dia selecionado, calendário aberto, mês do calendário).
- A API já devolve **todos** os compromissos (`compromissos_por_mes`), então a faixa, os pontos e o calendário do celular são calculados no cliente por funções puras (`Agenda/roteiroDates.js`), sem novas chamadas e sem depender do `is_today` do backend (que usa o relógio real do servidor).
- CSS: Task 1 reescreve `Agenda/styles.css` com tudo do Roteiro sob `.agenda-scope` (e o calendário também sob `.roteiro-cal-sheet`, porque o `Sheet` é portal). As regras sem escopo cujos nomes outras páginas usam ficam **idênticas** num bloco "LEGADO" no fim do mesmo arquivo; `.main-container` e `.btn-action-icon`, que valem para o app inteiro, viram primitivos explícitos em `layout.css`/`components.css`. Um teste de "impressão digital" de estilos computados (gravado antes, comparado depois) prova que nada mudou fora do Roteiro.
- O CSS novo do celular fica em `Agenda/mobile/roteiro-mobile.css` (importado depois de `styles.css`). Tablet e toque ficam numa seção nova de `styles.css`.
- Testes: Playwright (`roteiro.mobile.spec.mjs`, `roteiro.tablet.spec.mjs`, `roteiro.desktop.spec.mjs`, `css-escopo.*.spec.mjs`). Funções puras testadas pelo próprio Vite (`page.evaluate(() => import('/src/...'))`). Dados de teste com prefixo `E2E ` criados/removidos pela API.

**Tech Stack:** React 19, Vite 7, CSS puro, Font Awesome (npm), `@playwright/test` 1.63.

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-responsivo-design.md` (§2 restrições, §4 fundação, §5.3 Roteiro, §6 tablet, §8 verificação). Este plano é a etapa 6 da §7.
**Planos anteriores:** `2026-10-02-mobile-01-fundacao-shell.md` (harness, tokens, `Sheet`/`Fab`/`TopbarActions`, shell; implementado) e `2026-10-02-mobile-02-provisoes.md` (cria `e2e/helpers.mjs` → `authHeaders`, `apiJson`, `smallTargets` e `src/components/mobile/Segmented.jsx`; executado antes deste). Este plano **reusa** `apiJson` e `smallTargets` e não recria nada do plano 02. Não usa `Segmented`.

## Global Constraints

- **Branch:** `feat/mobile-responsivo` (worktree `.claude/worktrees/mobile-responsivo`). Um commit por task. **Nunca** fazer push nem merge em `main`. **Nunca** usar `git stash`.
- **Commits** terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use um segundo `-m`).
- **Não redesenhar cards existentes:** o `CompromissoCard` (selo flutuante + tag de status, data grande, hora, dia da semana, caixa de local, descrição, Cancelar/Concluir/Reabrir, editar/excluir) mantém o visual. Só espaçamento, tamanho, quebra de linha, alvo de toque e ações visíveis. As células do calendário (`.dia-card`: número, dia da semana, ponto) mantêm o desenho; a faixa da semana usa as mesmas classes.
- **Ícones:** só classes Font Awesome que já existem no código. Usadas neste plano: `fa-calendar-days`, `fa-chevron-left`, `fa-chevron-right`, `fa-magnifying-glass`, `fa-arrow-up-wide-short`, `fa-arrow-down-wide-short`, `fa-plus`, `fa-circle-notch` (e, já no card, `fa-pen-to-square`, `fa-trash-can`, `fa-check`, `fa-xmark`, `fa-rotate-left`, `fa-clock`, `fa-triangle-exclamation`, `fa-location-dot`, `fa-align-left`).
- **Espaçamento (tokens `--sp-1..6` = 4/8/12/16/24/32):** 8 entre elementos dentro de um card e entre controles relacionados, **12 livres entre cards**, 16 de gutter lateral e entre blocos da página, 24 entre grupos de dia. Nenhum valor solto fora da escala no CSS novo, exceto tamanhos de controle (44/48/56px), o `--selo-saliencia` (26px = 22px do selo acima do card + anel de 4px, medida do selo existente) e raios/bordas. O usuário pediu cuidado explícito com o espaçamento entre informações e entre cards: há teste de medida (Task 3) e conferência visual em screenshot (Task 6).
- **Toque:** alvo ≥ 44×44 em tudo que é interativo; inputs com 16px (já garantido por `tokens.css`); nenhuma ação ou informação só no hover (o tooltip do dia sai do celular e do tablet; a lista mostra a mesma informação).
- **Tipografia mobile:** conteúdo principal ≥ 14px, secundário ≥ 12px, 11px só em rótulos em caixa alta (`.dia-semana`, tag de status).
- **Desktop (≥1025):** visualmente idêntico. Os PNGs de `e2e/desktop-visual.desktop.spec.mjs-snapshots/` (inclui `agenda.png` e `modal-compromisso.png`), os do plano 02 e os 4 novos de `roteiro.desktop.spec.mjs-snapshots/` (Task 1) têm que continuar passando em toda task. Tablet (769–1024) muda conforme a spec §6.
- **Sem mudança de API/backend.** Reusar `getAgendaDashboard`, `createCompromisso`, `updateCompromisso`, `setCompromissoStatus`, `deleteCompromisso` e os handlers da página.
- **Dados de teste:** tudo que os testes criam começa com `E2E ` e é removido via API (`limparE2E`) no `beforeAll` e no `afterAll` do arquivo. Sobra de dados quebra `agenda.png` (lista e pontos do calendário mudam).
- **Status calculado pelo relógio real do servidor:** o backend marca `Pendente` vencido como `Perdido` com `datetime.now()` real (o relógio fixo do Playwright só vale no navegador). Os testes **não** afirmam `Pendente`/`Perdido`; usam ações que existem nos dois (Concluir, Cancelar, editar, excluir).
- **Lint:** `npx eslint <arquivos tocados>` sem **novos** erros. Linha de base medida em `src/pages/Agenda`: **4 erros, 2 warnings** (`AgendaModal.jsx` `set-state-in-effect`; `index.jsx` `dialogConfirm` sem uso, `e` sem uso e bloco vazio no `catch`; 2 `exhaustive-deps`). Este plano zera os 4 erros (Tasks 1 e 5). Regras v7: sem `setState` síncrono em `useEffect`, sem mutar acumuladores no render (funções puras fora do componente), `catch {` sem variável.
- **Build:** `npm run build` passa.

## API real dos primitivos (lida do código, use exatamente isto)

- `useIsMobile()` / `useIsTablet()` de `src/hooks/useIsMobile.js` (≤768 / 769–1024), via `useSyncExternalStore`.
- `BaseModal({ children, onClose, className, sheet = 'auto' })`: **não é portal** (renderiza no lugar, então o `AgendaModal` fica dentro de `.agenda-scope`). No mobile põe `is-sheet` no `.modal-overlay`. ESC e clique no overlay chamam `onClose`. Trava de scroll com contador (`lockScroll`/`unlockScroll`: `position: fixed` no body + restaura `scrollY` ao destravar).
- `Sheet({ open, onClose, title, ariaLabel, children, footer, full, className })`: **portal no `document.body`** (fica fora de `.agenda-scope`; por isso as regras do calendário também valem em `.roteiro-cal-sheet`). Retorna `null` se `!open`. Com `title`, renderiza `h3` + `button.app-sheet-close[aria-label="Fechar"]` (44px). `className` vai em `.modal-content.app-sheet`. Corpo `.modal-body.app-sheet-body`: o `.modal-body` de `components.css` tem `gap: 1.2rem`, então o CSS novo zera esse gap com 4 classes (`.modal-content.app-sheet.roteiro-cal-sheet > .app-sheet-body`). Eventos React borbulham pela árvore React: renderize o sheet como irmão, nunca dentro de um elemento clicável.
- `Fab({ icon = 'fa-plus', label, onClick })`: portal no `body`, `button.app-fab[aria-label]` 56×56, visível só ≤768, `bottom: calc(var(--bottom-nav-h) + var(--safe-bottom) + var(--sp-4))`.
- `TopbarActions({ children })` (de `src/components/mobile/MobileChrome.jsx`): portal dos ícones no `.m-topbar-slot` da topbar mobile; só renderiza quando o slot existe (≤768). `mobile.css` já dá 44×44 a `.m-topbar-slot > button`. O título da topbar vem de `NAV_ITEMS` (`/agenda` → "Roteiro"); o robô (`fa-robot`) e o avatar são da topbar (o `AiAssistant` da página retorna `null` no mobile).
- `DateTimePicker` (`src/components/Pickers`): `div.pk-datetime-wrapper` com dois `button.pk-trigger` (data, hora; 45px). No mobile os painéis abrem em sheet: data `.pk-date-panel` com botão "Hoje"; hora `.pk-panel.pk-panel--sheet` com `.pk-time-col` (horas, minutos) de `button.pk-time-item[data-v]`; escolher o minuto fecha o painel.
- `ConfirmDialog` (`useConfirm`): `.confirm-overlay` com o botão do `confirmLabel` ("Excluir").
- **Ordem do CSS:** `tokens.css` → `layout.css` (via Navbar) → CSS das páginas na ordem de `routes/index.jsx` (Login, Home, Financas, …, **Agenda `styles.css` e depois `mobile/roteiro-mobile.css`**, Registros, Estudos, Panorama, Cofre, Ritmo, …) → `mobile.css` → `components.css` → `global.css`. Para vencer regras `!important` de `components.css` (ex.: `.btn-action-icon { width: 32px !important }`), o CSS novo usa `!important` com especificidade maior.
- `overflowOffenders(page)` ignora `[data-offscreen-ok]`. `smallTargets(page, root)` lista `button, a[href], select, [role="button"], [role="tab"], input` (exceto checkbox/radio/hidden) visíveis < 44×44 dentro de `root` (não olha `textarea` nem `label`).
- Projetos Playwright por sufixo: `*.mobile.spec.mjs` (390×844, touch, `pointer: coarse`, `hover: none`), `*.tablet.spec.mjs` (900×1200, touch), `*.desktop.spec.mjs` (1280×900, mouse). Relógio fixo `2026-10-02 12:00 -03:00` (**sexta-feira**; a semana do dia vai de dom 27/09 a sáb 03/10).
- Banco demo (`populate_db.py` → `create_agenda`): 60 compromissos aleatórios entre −2 e +2 meses da data em que o banco foi gerado (títulos "Daily Scrum", "Consulta Dentista", "Almoço Equipe", "Treino Pesado", "Review Projeto", "Aniversário Mãe"; locais "Google Meet", "Zoom", "Casa"…). Nenhum título começa com "E2E". Os testes não dependem de quantos há em cada dia.

## Review Focus

1. **Dia errado na faixa, no calendário ou na lista** (fuso de `data_hora` sem timezone, semana de domingo a sábado, viradas de mês/ano, "Hoje/Amanhã/Ontem"). Testes: Task 2 › "semana, grade do mês e rótulos" e "seções da lista"; Task 4 › "calendário: tocar num dia leva a faixa e a lista" e "‹ › trocam o mês".
2. **Espaçamento quebrado entre cards** (o selo flutuante de 22px + anel invade o card de cima com um gap de 12px "ingênuo"; gutter diferente de 16 na faixa). Teste: Task 3 › "espaçamento: gutter 16, 12px livres entre cards, 24 entre dias, 8 dentro do card".
3. **Regressão em outras páginas ao escopar o `Agenda/styles.css`** (o arquivo vaza `.btn-action-icon`, `.main-container`, `.agenda-column`, `.header-actions-group`, `.small-btn`… para Finanças, Registros, Ritmo, Cofre, Navbar). Testes: Task 1 › `css-escopo.desktop/mobile.spec.mjs` (estilos computados idênticos em todas as rotas) + todas as bases visuais do desktop.
4. **Salvar escondido pelo teclado ou form apertado no sheet** (Título + DateTimePicker lado a lado, lembrete no rodapé, rodapé estourando). Testes: Task 5 › "Fab abre o form em sheet…" e "teclado aberto (--vvh): Salvar continua visível".
5. **Gesto roubando o toque** (swipe da faixa selecionando o dia sob o dedo; Fab cobrindo o Concluir do último card). Testes: Task 4 › "swipe na faixa troca de semana e descarta o clique do gesto"; Task 3 › "o Fab não cobre o fim da lista".

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `bussola_web/e2e/roteiro.desktop.spec.mjs` | criar (T1), modificar (T6) | base visual do Roteiro no desktop, hover das ações, tooltip com body travado |
| `bussola_web/e2e/cssFingerprint.mjs` | criar (T1) | captura/comparação de estilos computados (ferramenta da Task 1) |
| `bussola_web/e2e/css-escopo.desktop.spec.mjs`, `css-escopo.mobile.spec.mjs` | criar (T1) | prova de que o escopo não muda outras páginas (só roda com `CSS_ESCOPO`) |
| `bussola_web/e2e/fixtures/css-escopo-*.json` | gerar (T1) | estilos computados de antes da mudança |
| `bussola_web/e2e/roteiro.mobile.spec.mjs` | criar (T2), modificar (T3–T6) | lógica pura, layout, navegação, form, ações, capturas |
| `bussola_web/e2e/roteiro.tablet.spec.mjs` | criar (T6) | 2 colunas, cards em 1 coluna, ações sem hover, sem tooltip no toque |
| `bussola_web/src/pages/Agenda/styles.css` | reescrever (T1), modificar (T3, T6) | tudo sob `.agenda-scope`; LEGADO compartilhado no fim; tablet/toque |
| `bussola_web/src/assets/styles/layout.css` | modificar (T1) | `.main-container` (wrapper comum das páginas) |
| `bussola_web/src/assets/styles/components.css` | modificar (T1, T6) | `.btn-action-icon` (definição única); `max-height: 90dvh` no modal |
| `bussola_web/src/pages/Agenda/index.jsx` | modificar (T1, T3, T5, T6) | `.agenda-scope`, lint, ramo mobile, modal montado sob demanda, tooltip |
| `bussola_web/src/pages/Agenda/roteiroDates.js` | criar (T2) | chaves de dia, semana, grade do mês, rótulos, seções da lista |
| `bussola_web/src/pages/Agenda/mobile/RoteiroMobile.jsx` | criar (T3), reescrever (T4) | faixa, ferramentas, lista, Fab, calendário em sheet, swipe |
| `bussola_web/src/pages/Agenda/mobile/roteiro-mobile.css` | criar (T3), modificar (T4, T5, T6) | todo o CSS do celular (página, calendário, modal) |
| `bussola_web/src/pages/Agenda/components/CompromissoCard.jsx` | modificar (T3) | `aria-label` em editar/excluir; separador "•" do dia da semana num span |
| `bussola_web/src/pages/Agenda/components/AgendaModal.jsx` | reescrever (T5) | estado inicial pelas props (sem effect), lembrete no corpo no mobile |

---

### Task 1: Base visual do desktop + escopo do `Agenda/styles.css` sem mudar nenhuma página

**Files:**
- Create: `bussola_web/e2e/roteiro.desktop.spec.mjs`, `bussola_web/e2e/cssFingerprint.mjs`, `bussola_web/e2e/css-escopo.desktop.spec.mjs`, `bussola_web/e2e/css-escopo.mobile.spec.mjs`, `bussola_web/e2e/fixtures/css-escopo-*.json` (gerados)
- Modify: `bussola_web/src/pages/Agenda/styles.css` (reescrito), `bussola_web/src/assets/styles/layout.css`, `bussola_web/src/assets/styles/components.css`, `bussola_web/src/pages/Agenda/index.jsx`

**Interfaces:**
- Produces:
  - Raiz da página com `className="container main-container agenda-scope"`.
  - Todas as regras do Roteiro prefixadas por `.agenda-scope`; as do calendário (`.dias-grid`, `.dia-card`, `.dia-numero`, `.dia-semana`, `.compromisso-indicator`, `.btn-nav-arrow`) por `:is(.agenda-scope, .roteiro-cal-sheet)`.
  - Bloco "LEGADO COMPARTILHADO" (sem escopo, idêntico ao original) no fim de `Agenda/styles.css` para `.agenda-column*`, `.empty-list-msg`, `.header-actions-group`, `.header-search-*`, `.small-btn` e o `@media (max-width: 768px)` de `.agenda-column`/`.column-header-flex`.
  - `.main-container` em `layout.css` e `.btn-action-icon` (+ hovers `btn-edit-transacao`/`btn-delete-transacao`) em `components.css`, com as mesmas declarações (inclusive `!important`).
  - Helpers E2E: `fingerprint(page)`, `registrarTestesDeEscopo(projeto)` em `e2e/cssFingerprint.mjs`.

- [ ] **Step 1: Spec de base visual do Roteiro no desktop**

Criar `bussola_web/e2e/roteiro.desktop.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

// Estados do Roteiro que este plano toca. Base gerada ANTES de mexer no CSS/JSX.
const ESTADOS = [
  ['agenda-tooltip', async (p) => {
    await p.locator('.dias-grid .dia-card.has-compromissos').first().hover();
    await expect(p.locator('.tooltip.visible')).toBeVisible();
  }],
  ['agenda-editar', async (p) => {
    const card = p.locator('.compromisso-card-modern').first();
    await card.hover();
    await card.locator('.btn-edit-transacao').click();
    await p.locator('.modal-content h3', { hasText: 'Editar Compromisso' }).waitFor();
  }],
  ['agenda-ordem-desc', async (p) => {
    await p.locator('.btn-filter-sort').click();
  }],
  ['agenda-mes-seguinte', async (p) => {
    await p.locator('.calendar-nav-header .btn-nav-arrow').last().click();
    await p.waitForLoadState('networkidle');
  }],
];

for (const [nome, preparar] of ESTADOS) {
  test(`desktop roteiro: ${nome} inalterado`, async ({ page }) => {
    await gotoApp(page, '/agenda');
    await preparar(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`${nome}.png`);
  });
}

test('desktop roteiro: editar/excluir do card só aparecem no hover', async ({ page }) => {
  await gotoApp(page, '/agenda');
  const card = page.locator('.compromisso-card-modern').first();
  const opacity = () => card.locator('.top-actions').evaluate((e) => getComputedStyle(e).opacity);
  expect(await opacity()).toBe('0');
  await card.hover();
  await expect.poll(opacity).toBe('1');
});

test('desktop roteiro: nada do layout mobile aparece', async ({ page }) => {
  await gotoApp(page, '/agenda');
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.agenda-layout')).toBeVisible();
  await expect(page.locator('.m-roteiro')).toHaveCount(0);
  await expect(page.locator('.app-fab')).toHaveCount(0);
  await expect(page.locator('.m-topbar')).toHaveCount(0);
});
```

- [ ] **Step 2: Gerar a base ANTES de qualquer mudança de código**

Run (em `bussola_web/`): `npm run e2e:update -- --project=desktop e2e/roteiro.desktop.spec.mjs`
Expected: 6 passed; criados 4 PNGs em `e2e/roteiro.desktop.spec.mjs-snapshots/`. Abra os 4 e confira: tooltip aberto ao lado de um dia do calendário; modal "Editar Compromisso" preenchido; lista com os meses na ordem inversa; calendário do mês seguinte.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (as bases antigas + as 6 novas), duas vezes seguidas sem variação. Se algo variar entre execuções, adicione `mask` no elemento dinâmico e regenere só aquele PNG.

- [ ] **Step 3: Ferramenta de impressão digital dos estilos computados**

Criar `bussola_web/e2e/cssFingerprint.mjs`:

```js
// Ferramenta da Task 1 do plano mobile-04 (escopo do Agenda/styles.css).
// Grava (CSS_ESCOPO=gravar) ou compara (CSS_ESCOPO=comparar) os estilos computados dos
// elementos que usam classes definidas no Agenda/styles.css, em todas as rotas. Sem a
// variável, os testes são pulados (outras páginas mudam nos planos seguintes).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

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

const ROTAS = [
  ['home', '/home'], ['panorama', '/panorama'], ['financas', '/financas'], ['agenda', '/agenda'],
  ['registros', '/registros'], ['estudos', '/estudos'], ['ritmo', '/ritmo'], ['cofre', '/cofre'],
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

export function registrarTestesDeEscopo(projeto) {
  test.skip(!process.env.CSS_ESCOPO, 'só na Task 1 do plano mobile-04 (CSS_ESCOPO=gravar|comparar)');

  for (const [nome, rota] of ROTAS) {
    test(`estilos computados de ${nome} (${projeto}) não mudam`, async ({ page }) => {
      if (nome === 'home') await page.route(/\/home\/news(\?.*)?$/, (route) => route.fulfill({ json: NEWS }));
      await gotoApp(page, rota);
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
    });
  }
}
```

Criar `bussola_web/e2e/css-escopo.desktop.spec.mjs`:

```js
import { registrarTestesDeEscopo } from './cssFingerprint.mjs';

registrarTestesDeEscopo('desktop');
```

Criar `bussola_web/e2e/css-escopo.mobile.spec.mjs`:

```js
import { registrarTestesDeEscopo } from './cssFingerprint.mjs';

registrarTestesDeEscopo('mobile');
```

- [ ] **Step 4: Gravar a impressão digital ANTES da mudança**

Run (PowerShell, em `bussola_web/`):
```powershell
$env:CSS_ESCOPO = 'gravar'; npm run e2e -- css-escopo; Remove-Item Env:CSS_ESCOPO
```
Expected: 16 passed; 16 arquivos em `e2e/fixtures/` (`css-escopo-desktop-*.json`, `css-escopo-mobile-*.json`). Rode `$env:CSS_ESCOPO = 'comparar'; npm run e2e -- css-escopo; Remove-Item Env:CSS_ESCOPO` → Expected: 16 passed (a captura é estável). Se alguma rota variar entre execuções, aumente o `waitForTimeout` dela e grave de novo.
Run: `npm run e2e -- css-escopo` (sem a variável) → Expected: 16 skipped.

- [ ] **Step 5: `.main-container` vira o wrapper comum em `layout.css`**

Em `bussola_web/src/assets/styles/layout.css`, logo depois do bloco

```css
main.container {
    flex-grow: 1;
    padding-top: 2rem;
    padding-bottom: 2rem;
}
```

inserir:

```css

/* Wrapper comum das páginas (.container.main-container). Antes vinha sem escopo de
   pages/Agenda/styles.css e já valia para todas as páginas (Home e Estudos dependem
   dele); fica aqui com as mesmas declarações. As páginas sobrescrevem com o seu escopo. */
.main-container {
    padding-bottom: 5rem !important;
    min-height: 100vh;
    min-height: 100dvh;
    box-sizing: border-box;
}
```

- [ ] **Step 6: `.btn-action-icon` vira a definição única em `components.css`**

Ao **final** de `bussola_web/src/assets/styles/components.css`, adicionar:

```css

/* ========================================================= */
/* BOTÃO DE ÍCONE (.btn-action-icon)                          */
/* Tamanho, borda e raio que valiam em TODO o app vinham, com */
/* !important, de pages/Agenda/styles.css (sem escopo): Navbar,*/
/* Cofre, Metas, Registros, UserDrawer e Finanças renderizam   */
/* com eles. Ficam aqui, idênticos, como a definição única     */
/* (spec §4.3). O visual "redondo" de global.css continua      */
/* valendo para o que não é !important. O alvo de 44px no      */
/* toque vem de tokens.css (min-width/min-height).             */
/* ========================================================= */
.btn-action-icon {
    width: 32px !important;
    height: 32px !important;
    font-size: 0.8rem;
    color: var(--cor-texto-secundario);
    background: transparent;
    border: 1px solid var(--cor-borda) !important;
    border-radius: 6px !important;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
}

.btn-action-icon.btn-edit-transacao:hover {
    background-color: #f59e0b !important;
    border-color: #f59e0b !important;
    color: #fff !important;
}

.btn-action-icon.btn-delete-transacao:hover {
    background-color: var(--cor-vermelho-delete) !important;
    border-color: var(--cor-vermelho-delete) !important;
    color: #fff !important;
}
```

- [ ] **Step 7: Reescrever `Agenda/styles.css` com escopo**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Agenda/styles.css` por:

```css
/* ==========================================================================
   AGENDA (ROTEIRO) - ESTILOS DA PÁGINA
   Arquivo: styles.css

   Tudo do Roteiro fica sob .agenda-scope (raiz da página). As regras do
   calendário também valem em .roteiro-cal-sheet: no celular o calendário
   abre num Sheet, que é portal no body (fora da raiz).

   No FIM do arquivo fica o LEGADO COMPARTILHADO: regras sem escopo cujos
   nomes de classe outras páginas também usam (Finanças, Registros, Ritmo).
   Ficam idênticas e na mesma posição de import para não mudar essas
   páginas, e DEPOIS do bloco com escopo para o Roteiro manter a mesma
   cascata de antes. Não edite o legado para o Roteiro: sobrescreva com
   .agenda-scope. .main-container foi para layout.css e .btn-action-icon
   para components.css.
   ========================================================================== */

/* ============================================= */
/* 1. ESTRUTURA GERAL E LAYOUT                   */
/* ============================================= */

/* LAYOUT GRID ESPECÍFICO DA AGENDA (2 Colunas) */
.agenda-scope .layout-grid-custom.agenda-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    align-items: stretch;
    max-width: 90%;
    width: 100%;
    margin: 0 auto;
}

/* ============================================= */
/* 3. CABEÇALHOS DAS COLUNAS (HEADER)            */
/* ============================================= */

.agenda-scope .agenda-layout .column-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 -1.2rem 1.5rem -1.2rem;
    padding: 0.8rem 1.5rem;
    background-color: var(--cor-card-secundario);
    border-bottom: 1px solid var(--cor-borda);
    border-right: 1px solid var(--cor-borda);
    position: relative;
    z-index: 2;
    min-height: 60px;
}

.agenda-scope .agenda-layout .header-left-aligned {
    justify-content: space-between !important; 
}

.agenda-scope .agenda-layout .column-header-flex h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--cor-texto-secundario);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.agenda-scope .btn-filter-sort {
    background: transparent;
    border: 1px solid var(--cor-borda);
    color: var(--cor-texto-secundario);
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
    font-size: 0.9rem;
}

.agenda-scope .btn-filter-sort:hover {
    background: var(--cor-fundo-hover);
    color: var(--cor-azul-primario);
    border-color: var(--cor-azul-primario);
}

.agenda-scope .btn-filter-sort:active {
    transform: translateY(1px);
}

/* Navegação do Calendário */
.agenda-scope .calendar-nav-header {
    display: flex;
    justify-content: center !important; 
    gap: 1.5rem;
    position: relative;
}

.agenda-scope .calendar-title-nav {
    min-width: 150px; 
    text-transform: capitalize !important; 
    text-align: center;
}

:is(.agenda-scope, .roteiro-cal-sheet) .btn-nav-arrow {
    background: transparent;
    border: 1px solid var(--cor-borda);
    color: var(--cor-texto-secundario);
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
}

:is(.agenda-scope, .roteiro-cal-sheet) .btn-nav-arrow:hover {
    background-color: var(--cor-fundo-hover);
    color: var(--cor-azul-primario);
    border-color: var(--cor-azul-primario);
}

/* 4. AJUSTE PARA 2 COLUNAS CONECTADAS: ver LEGADO COMPARTILHADO no fim do arquivo
      (.agenda-column também é usada por Finanças). */

/* ============================================= */
/* 5. LISTA DE COMPROMISSOS (GRID INTELIGENTE)   */
/* ============================================= */

.agenda-scope .month-group {
    display: flex;
    flex-direction: column;
    margin: 0;
}

.agenda-scope .month-group+.month-group {
    margin-top: 1.5rem !important;
}

.agenda-scope .month-header {
    background: transparent !important;
    border: none !important;
    border-bottom: 1px solid var(--cor-borda) !important;
    border-radius: 0 !important;
    padding: 0.2rem 0 0.4rem 0;
    margin-bottom: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
}

.agenda-scope .month-header:hover,
.agenda-scope .month-header.active {
    border-bottom-color: var(--cor-azul-primario) !important;
}

.agenda-scope .month-header:hover .month-title-text,
.agenda-scope .month-header.active .month-title-text {
    color: var(--cor-azul-primario);
}

.agenda-scope .month-title-text {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--cor-texto-secundario);
    transition: color 0.2s;
}

.agenda-scope .month-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--cor-texto-secundario);
}

.agenda-scope .month-header i {
    font-size: 0.8rem;
    transition: transform 0.3s ease;
}

.agenda-scope .month-header i.rotate {
    transform: rotate(180deg);
}

.agenda-scope .accordion-wrapper {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease-out;
}

.agenda-scope .accordion-wrapper.open {
    grid-template-rows: 1fr;
}

.agenda-scope .accordion-inner {
    overflow: hidden;
    min-height: 0;
}

.agenda-scope .month-content {
    padding-top: 0.5rem;
    padding-bottom: 0;
}

.agenda-scope .compromissos-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    /* row-gap folgado (>22px) evita colisão do selo com o card acima;
       padding-top dá espaço p/ o selo da 1ª linha (o .accordion-inner
       usa overflow:hidden e cortaria o selo saliente). */
    gap: 2rem 1rem;
    padding-top: 26px;
}

.agenda-scope .compromissos-grid>.compromisso-card-modern:last-child:nth-child(odd) {
    grid-column: span 2;
}

/* ============================================= */
/* 6. CARD DE COMPROMISSO (DESIGN MODERNO V2)    */
/* ============================================= */

.agenda-scope .compromisso-card-modern {
    --card-accent: var(--cor-azul-primario);
    background-color: var(--cor-card-principal);
    border: 1px solid var(--cor-borda);
    border-radius: 16px;
    padding: 1.9rem 1.2rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    position: relative;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    height: 100%;
    box-sizing: border-box;
}

.agenda-scope .compromisso-card-modern:hover {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--card-accent) 45%, var(--cor-borda));
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1),
        0 0 0 3px color-mix(in srgb, var(--card-accent) 12%, transparent);
}

/* Selo flutuante herda a cor de status do card */
.agenda-scope .compromisso-card-modern .selo-badge {
    --selo-cor: var(--card-accent);
}

/* Identidade de cor por status (usada no selo flutuante e no glow do hover) */
.agenda-scope .compromisso-card-modern.pendente {
    --card-accent: var(--cor-azul-primario);
}

.agenda-scope .compromisso-card-modern.realizado {
    --card-accent: var(--cor-verde-sucesso);
    opacity: 0.8;
}

.agenda-scope .compromisso-card-modern.perdido {
    --card-accent: var(--cor-vermelho-delete);
}

.agenda-scope .compromisso-card-modern.cancelado {
    --card-accent: #6b7280;
    opacity: 0.8;
}

/* --- 1. Header: Data e Botões --- */
.agenda-scope .card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.agenda-scope .date-highlight {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--cor-azul-primario);
}

.agenda-scope .date-big {
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: -1px;
}

.agenda-scope .time-group {
    display: flex;
    align-items: baseline;
    gap: 6px;
}

.agenda-scope .time-big {
    font-size: 1.2rem;
    font-weight: 600;
    opacity: 0.9;
}

.agenda-scope .weekday-inline {
    font-size: 0.9rem;
    color: var(--cor-texto-secundario);
    font-weight: 500;
    text-transform: capitalize;
}

.agenda-scope .top-actions {
    display: flex;
    gap: 8px;
    opacity: 0; 
    transition: opacity 0.2s ease;
}

.agenda-scope .compromisso-card-modern:hover .top-actions {
    opacity: 1; 
}

@media (max-width: 768px) {
    .agenda-scope .top-actions {
        opacity: 1 !important;
    }
}

/* .btn-action-icon e os hovers de editar/excluir: ver components.css (definição única). */

/* --- 2. Título --- */
.agenda-scope .card-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--cor-texto-principal);
    margin: 0;
    line-height: 1.4;
}

/* --- 3. Informações Modernas --- */
.agenda-scope .card-infos-container {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    margin-top: 0.2rem;
}

.agenda-scope .info-modern-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    max-width: 100%;
    padding: 0 10px;
}

.agenda-scope .location-box {
    border: 1px solid var(--cor-borda);
    border-radius: 8px;
    padding: 6px 10px;
    width: fit-content;
}

.agenda-scope .info-icon-badge {
    width: 24px;
    height: 24px;
    min-width: 24px;
    color: var(--cor-azul-primario);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
}

.agenda-scope .info-text {
    font-size: 0.95rem;
    color: var(--cor-texto-secundario);
    line-height: 1.4;
    padding-top: 2px;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: break-word;
}

/* --- 4. Footer --- */
.agenda-scope .card-footer-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-top: auto;
    padding-top: 1rem;
    position: relative;
}

/* Tag de estado — "sai de trás" do selo formando um único lockup:
   canto esquerdo reto (fica escondido atrás do selo) e só o direito
   arredondado. Fica atrás do selo (z-index menor) e herda a cor do
   status via --card-accent (mesmo do selo). */
.agenda-scope .selo-status-tag {
    position: absolute;
    top: -13px;
    left: 50px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    /* padding-left maior: o texto começa depois da parte que fica sob o selo */
    padding: 0 14px 0 22px;
    border-radius: 0 999px 999px 0;
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--card-accent);
    background: color-mix(in srgb, var(--card-accent) 16%, var(--cor-card-principal));
    box-shadow: 0 4px 10px -5px rgba(0, 0, 0, 0.4);
    z-index: 2;
    pointer-events: none;
    white-space: nowrap;
}

.agenda-scope .btn-concluir-action {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
}

.agenda-scope .btn-concluir-action.complete {
    background-color: var(--cor-azul-primario);
    color: white;
    box-shadow: 0 4px 12px rgba(74, 109, 255, 0.25);
}

.agenda-scope .btn-concluir-action.complete:hover {
    background-color: var(--cor-azul-hover);
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(74, 109, 255, 0.35);
}

.agenda-scope .btn-concluir-action.undo {
    background-color: var(--cor-fundo);
    border: 1px solid var(--cor-borda);
    color: var(--cor-texto-secundario);
}

.agenda-scope .btn-concluir-action.undo:hover {
    background-color: var(--cor-fundo-hover);
    color: var(--cor-texto-principal);
    border-color: var(--cor-texto-secundario);
}

.agenda-scope .footer-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.agenda-scope .btn-cancelar-action {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--cor-vermelho-delete);
    color: var(--cor-vermelho-delete);
    transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
}

.agenda-scope .btn-cancelar-action:hover {
    background: rgba(231, 76, 60, 0.1);
    transform: translateY(-1px);
}

/* ============================================= */
/* 8. CALENDÁRIO (DIAS E VISUALIZAÇÃO)           */
/* (também no sheet do celular: .roteiro-cal-sheet) */
/* ============================================= */

.agenda-scope .month-divider {
    display: none; 
}

:is(.agenda-scope, .roteiro-cal-sheet) .dias-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.5rem;
}

:is(.agenda-scope, .roteiro-cal-sheet) .dia-card {
    background-color: var(--cor-card-secundario);
    border: 1px solid var(--cor-borda);
    border-radius: 8px;
    padding: 0.2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1 / 1;
    position: relative;
    transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
}

:is(.agenda-scope, .roteiro-cal-sheet) .dia-card.dia-padding {
    background-color: transparent !important;
    border: 1px dashed var(--cor-borda) !important;
    background-image: repeating-linear-gradient(45deg,
            transparent,
            transparent 5px,
            rgba(128, 128, 128, 0.08) 5px,
            rgba(128, 128, 128, 0.08) 10px) !important;
    opacity: 0.6;
    pointer-events: none;
    box-shadow: none !important;
}

:is(.agenda-scope, .roteiro-cal-sheet) .dia-card.dia-padding .dia-numero,
:is(.agenda-scope, .roteiro-cal-sheet) .dia-card.dia-padding .dia-semana {
    color: var(--cor-texto-secundario);
    opacity: 0.5;
}

:is(.agenda-scope, .roteiro-cal-sheet) .dia-card.dia-padding .compromisso-indicator {
    display: none;
}

:is(.agenda-scope, .roteiro-cal-sheet) .dia-card.today {
    border: 2px solid var(--cor-azul-primario);
    background-color: var(--cor-card-principal);
}

:is(.agenda-scope, .roteiro-cal-sheet) .dia-card.today .dia-numero {
    color: var(--cor-azul-primario);
}

:is(.agenda-scope, .roteiro-cal-sheet) .dia-card:not(.dia-padding).has-compromissos {
    background-color: rgba(74, 109, 255, 0.05);
}

:is(.agenda-scope, .roteiro-cal-sheet) .dia-card:not(.dia-padding):hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    border-color: var(--cor-azul-primario);
    cursor: pointer;
}

:is(.agenda-scope, .roteiro-cal-sheet) .dia-numero {
    font-size: 0.9rem;
    font-weight: 600;
}

:is(.agenda-scope, .roteiro-cal-sheet) .dia-semana {
    font-size: 0.65rem;
    color: var(--cor-texto-secundario);
    text-transform: uppercase;
}

:is(.agenda-scope, .roteiro-cal-sheet) .compromisso-indicator {
    height: 5px;
    width: 5px;
    background-color: var(--cor-azul-primario);
    border-radius: 50%;
    margin-top: 2px;
}

:is(.agenda-scope, .roteiro-cal-sheet) .compromisso-indicator.no-event {
    background-color: transparent;
}

@media (max-width: 480px) {
    :is(.agenda-scope, .roteiro-cal-sheet) .dias-grid {
        gap: 2px;
    }

    :is(.agenda-scope, .roteiro-cal-sheet) .dia-semana {
        display: none;
    }
}

/* ============================================= */
/* 9. TOOLTIP                                    */
/* ============================================= */

.agenda-scope .tooltip {
    display: none;
    opacity: 0;
    position: absolute;
    z-index: 2500;
    background-color: var(--cor-card-principal);
    border: 1px solid var(--cor-borda);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    width: 250px;
    pointer-events: none;
    transition: opacity 0.2s ease;
    will-change: top, left, opacity; /* [OPTIMIZATION] Ajuda no desempenho de renderização */
}

.agenda-scope .tooltip.visible {
    display: block;
    opacity: 1;
}

.agenda-scope .tooltip-compromisso-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--cor-borda);
}

.agenda-scope .tooltip-compromisso-item:last-child {
    border-bottom: none;
}

.agenda-scope .tooltip-titulo {
    font-weight: 600;
    color: var(--cor-texto-principal);
    font-size: 0.85rem;
}

.agenda-scope .tooltip-hora {
    font-size: 0.8rem;
    color: var(--cor-texto-secundario);
    margin-left: auto;
}

/* ============================================= */
/* 10. RESPONSIVIDADE                             */
/* ============================================= */

@media (max-width: 768px) {

    /* No mobile, volta tudo para 1 coluna */
    .agenda-scope .layout-grid-custom.agenda-layout {
        grid-template-columns: 1fr;
        gap: 2rem;
    }

    /* Grid de compromissos no mobile vira 1 coluna também */
    .agenda-scope .compromissos-grid {
        grid-template-columns: 1fr;
    }

    /* Remove o span do último item no mobile */
    .agenda-scope .compromissos-grid>.compromisso-card-modern:last-child:nth-child(odd) {
        grid-column: span 1;
    }
}

/* ========================================================================== */
/* LEGADO COMPARTILHADO (sem escopo) — NÃO EDITAR PARA O ROTEIRO              */
/* Mesmas regras de antes, na mesma ordem relativa. Consumidores:             */
/*  - .agenda-column*, .empty-list-msg: Finanças (+ CaixaModal, MetasModal)   */
/*  - .header-actions-group: Finanças, Registros, Ritmo                        */
/*  - .header-search-*, .small-btn: Registros                                  */
/*  - @media 768 de .agenda-column/.column-header-flex: Finanças/Registros/Ritmo*/
/* Saem quando a página consumidora definir o seu (com o seu escopo).         */
/* ========================================================================== */

.agenda-column {
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
    height: 100%;
    padding: 0 1.2rem;
}

.empty-list-msg {
    text-align: center;
    padding: 2rem;
    color: var(--cor-texto-secundario);
    font-style: italic;
    border: 1px dashed var(--cor-borda);
    border-radius: 8px;
}

.agenda-column:last-child .column-header-flex {
    margin-bottom: 0.5rem !important;
}

.header-actions-group {
    display: flex;
    gap: 10px;
    align-items: center;
}

.header-search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.header-search-input {
    height: 32px !important;
    width: 180px;
    padding-left: 30px;
    padding-right: 10px;
    font-size: 0.85rem;
    border: 1px solid var(--cor-borda);
    background-color: var(--cor-fundo);
    color: var(--cor-texto-principal);
    border-radius: 8px;
    transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
}

.header-search-input:focus {
    border-color: var(--cor-azul-primario);
    outline: none;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    width: 200px;
}

.header-search-icon {
    position: absolute;
    left: 10px;
    color: var(--cor-texto-secundario);
    font-size: 0.8rem;
    pointer-events: none;
    z-index: 2;
}

.small-btn {
    padding: 0 14px;
    font-size: 0.85rem;
    height: 32px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 8px;
}

.agenda-column:first-child {
    padding-left: 0;
    position: relative;
    z-index: 10;
}

.agenda-column:first-child .column-header-flex {
    margin-left: 0;
    margin-right: -1.2rem;
    border-radius: 12px 0 0 12px;
}

.agenda-column:last-child {
    padding-right: 0;
    z-index: 1;
}

.agenda-column:last-child .column-header-flex {
    margin-left: -1.2rem;
    margin-right: 0;
    border-radius: 0 12px 12px 0;
    border-right: 1px solid var(--cor-borda);
}

@media (max-width: 768px) {
    .agenda-column:not(:last-child) {
        border-right: none;
        border-bottom: 1px dashed var(--cor-borda);
        padding-bottom: 2rem;
        padding-right: 0;
    }

    .column-header-flex {
        margin: 0 0 1.5rem 0;
        border-right: none;
        border-radius: 12px;
    }

    .agenda-column:last-child .column-header-flex,
    .agenda-column:first-child .column-header-flex {
        border-radius: 12px;
    }
}
```

> Por que a cascata do Roteiro não muda: toda regra própria ganhou exatamente `+1` classe (a relação entre elas é a mesma); as do legado ficam depois, então o único empate novo (`.agenda-scope .agenda-layout .column-header-flex` × `.agenda-column:first-child .column-header-flex`, ambas 0,3,0) continua resolvido a favor do legado, como antes (0,3,0 > 0,2,0). As únicas regras externas sem escopo com os mesmos nomes (`.accordion-*` em `global.css`) têm valores idênticos. Regras compartilhadas não ganham cópia com escopo (isso mudaria o empate com `.btn-primary` no botão "Adicionar").

- [ ] **Step 8: Raiz com `.agenda-scope` e lint em `index.jsx`**

Em `bussola_web/src/pages/Agenda/index.jsx`:

1. Remover a linha `import { useConfirm } from '../../context/ConfirmDialogContext';` e a linha `    const dialogConfirm = useConfirm();` (variável sem uso).
2. Substituir

```js
            try { return JSON.parse(savedState); } catch (e) { }
```

por

```js
            try { return JSON.parse(savedState); } catch { /* estado salvo inválido: começa fechado */ }
```

3. Substituir `        <div className="container main-container">` por `        <div className="container main-container agenda-scope">`.

- [ ] **Step 9: Comparar a impressão digital e as bases visuais**

Run (PowerShell, em `bussola_web/`):
```powershell
$env:CSS_ESCOPO = 'comparar'; npm run e2e -- css-escopo; Remove-Item Env:CSS_ESCOPO
```
Expected: 16 passed. Se uma rota falhar, o diff do `toEqual` mostra `seletor › índice › propriedade` e o valor antigo. Corrija **sem** mexer no visual: localize a regra original desse seletor em `git show HEAD:bussola_web/src/pages/Agenda/styles.css` e copie-a verbatim (sem escopo) para o bloco LEGADO, na posição relativa original; rode de novo até passar. Anote no commit cada regra que voltou ao legado.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (inclui `agenda.png`, `modal-compromisso.png`, os 4 PNGs novos, os do plano 02 e os de Registros).
Run: `npm run e2e -- --project=mobile` e `npm run e2e -- --project=tablet` → Expected: tudo passa (nada do Roteiro mudou ainda no celular).

- [ ] **Step 10: Build e lint**

Run: `npm run build` → Expected: OK.
Run: `npx eslint src/pages/Agenda` → Expected: **1 erro** (o `set-state-in-effect` pré-existente do `AgendaModal.jsx`, resolvido na Task 5) e 2 warnings `exhaustive-deps` (antes: 4 erros).

- [ ] **Step 11: Commit**

```bash
git add bussola_web/e2e bussola_web/src/pages/Agenda bussola_web/src/assets/styles/layout.css bussola_web/src/assets/styles/components.css
git commit -m "refactor(web): escopa o CSS do Roteiro (.agenda-scope) sem mudar outras paginas" -m "main-container -> layout.css, btn-action-icon -> components.css; regras com nome compartilhado ficam no LEGADO; impressao digital de estilos identica em 8 rotas (desktop e mobile)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Datas do Roteiro (funções puras) + infraestrutura do spec mobile

**Files:**
- Create: `bussola_web/src/pages/Agenda/roteiroDates.js`, `bussola_web/e2e/roteiro.mobile.spec.mjs`

**Interfaces:**
- Produces (`roteiroDates.js`, tudo puro, datas locais):
  - `DIAS_CURTOS: string[]` (`['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']`, igual ao backend).
  - `dayKey(date): 'AAAA-MM-DD'`, `parseKey(key): Date` (meia-noite local), `addDays(key, n): key`.
  - `weekKeys(key): key[7]` (domingo → sábado da semana de `key`); `weekRangeLabel(keys, now?)` ("27 set – 3 out", "4 – 10 out", "27 dez – 2 jan 2027").
  - `monthLabel(year, monthIndex)` ("Outubro de 2026"); `monthGrid(year, monthIndex): Array<{ key, day, weekday, isPadding }>` (semanas completas de domingo a sábado, como `_generate_month_grid`).
  - `flattenCompromissos(porMes): Compromisso[]` (ordem crescente de `data_hora`); `indexByDay(list): Map<key, Compromisso[]>`.
  - `dayHeaderParts(key, now?) → { rel: 'Hoje'|'Amanhã'|'Ontem'|null, text }`, `dayHeaderLabel(key, now?)` ("Hoje · Sex, 2 de outubro", "Seg, 5 de outubro", "Qua, 31 de dezembro de 2025"), `dayAriaLabel(key, count?)` ("Sexta-feira, 2 de outubro, 1 compromisso").
  - `buildDaySections(list, selectedKey, { order = 'asc', search = '' }) → Array<{ key, items }>`: sem busca, o dia selecionado (sempre, mesmo vazio) e depois os dias com compromisso seguintes (`asc`) ou anteriores, do mais recente ao mais antigo (`desc`); com busca (título ou local, sem diferenciar maiúsculas, como o desktop), todos os dias que casam, na ordem pedida. Dentro do dia, hora crescente.
- E2E: `limparE2E(request)`, `criar(request, titulo, data_hora)`, constante `E2E = 'E2E Roteiro'` e os 4 compromissos de teste criados no `beforeAll`.

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/roteiro.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, apiJson, smallTargets } from './helpers.mjs';

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
```

Run: `npm run e2e -- --project=mobile e2e/roteiro.mobile.spec.mjs`
Expected: os 2 FAIL (import de `/src/pages/Agenda/roteiroDates.js` dá 404). O `beforeAll` cria os 4 compromissos e o `afterAll` remove.

- [ ] **Step 2: `roteiroDates.js`**

Criar `bussola_web/src/pages/Agenda/roteiroDates.js`:

```js
// Datas do Roteiro no celular: chaves de dia, semana (domingo a sábado, igual ao
// calendário do backend), grade do mês, rótulos e as seções da lista.
// Funções puras (sem React). `data_hora` da API vem sem fuso: é hora local.

export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = (n) => String(n).padStart(2, '0');

/** 'AAAA-MM-DD' no fuso local. */
export function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Date à meia-noite local a partir de 'AAAA-MM-DD'. */
export function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function addDays(key, n) {
    const d = parseKey(key);
    d.setDate(d.getDate() + n);
    return dayKey(d);
}

/** As 7 chaves (domingo → sábado) da semana que contém `key`. */
export function weekKeys(key) {
    const inicio = addDays(key, -parseKey(key).getDay());
    return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
}

/** "27 set – 3 out", "4 – 10 out"; o ano só aparece quando o fim da semana não é do ano de `now`. */
export function weekRangeLabel(keys, now = new Date()) {
    const a = parseKey(keys[0]);
    const b = parseKey(keys[keys.length - 1]);
    const ano = b.getFullYear() !== now.getFullYear() ? ` ${b.getFullYear()}` : '';
    if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MESES_CURTOS[b.getMonth()]}${ano}`;
    return `${a.getDate()} ${MESES_CURTOS[a.getMonth()]} – ${b.getDate()} ${MESES_CURTOS[b.getMonth()]}${ano}`;
}

/** "Outubro de 2026" (`month` de 0 a 11). */
export function monthLabel(year, month) {
    const nome = MESES[month];
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${year}`;
}

/** Grade do mês em semanas completas de domingo a sábado (mesma regra do backend). */
export function monthGrid(year, month) {
    const primeiro = new Date(year, month, 1);
    const ultimo = new Date(year, month + 1, 0);
    const inicio = addDays(dayKey(primeiro), -primeiro.getDay());
    const total = primeiro.getDay() + ultimo.getDate() + (6 - ultimo.getDay());
    return Array.from({ length: total }, (_, i) => {
        const key = addDays(inicio, i);
        const d = parseKey(key);
        return { key, day: d.getDate(), weekday: DIAS_CURTOS[d.getDay()], isPadding: d.getMonth() !== month };
    });
}

/** Compromissos do dashboard (agrupados por mês) numa lista em ordem crescente de data/hora. */
export function flattenCompromissos(porMes) {
    return Object.values(porMes || {})
        .flat()
        .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
}

/** Map 'AAAA-MM-DD' → compromissos do dia, na ordem da lista recebida. */
export function indexByDay(list) {
    const map = new Map();
    for (const c of list) {
        const k = dayKey(new Date(c.data_hora));
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(c);
    }
    return map;
}

/** Cabeçalho do grupo do dia: { rel: 'Hoje'|'Amanhã'|'Ontem'|null, text: 'Sex, 2 de outubro' }. */
export function dayHeaderParts(key, now = new Date()) {
    const d = parseKey(key);
    const hoje = dayKey(now);
    const ano = d.getFullYear() !== now.getFullYear() ? ` de ${d.getFullYear()}` : '';
    const text = `${DIAS_CURTOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}${ano}`;
    let rel = null;
    if (key === hoje) rel = 'Hoje';
    else if (key === addDays(hoje, 1)) rel = 'Amanhã';
    else if (key === addDays(hoje, -1)) rel = 'Ontem';
    return { rel, text };
}

export function dayHeaderLabel(key, now = new Date()) {
    const { rel, text } = dayHeaderParts(key, now);
    return rel ? `${rel} · ${text}` : text;
}

/** Rótulo acessível do dia na faixa/calendário: "Sexta-feira, 2 de outubro, 1 compromisso". */
export function dayAriaLabel(key, count = 0) {
    const d = parseKey(key);
    const base = `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
    if (!count) return base;
    return `${base}, ${count} ${count === 1 ? 'compromisso' : 'compromissos'}`;
}

// Mesma regra da busca do desktop: título ou local, sem diferenciar maiúsculas.
const casa = (c, termo) => String(c.titulo || '').toLowerCase().includes(termo)
    || String(c.local || '').toLowerCase().includes(termo);

/**
 * Seções da lista do celular.
 * - Sem busca: o dia selecionado (sempre, mesmo vazio) e depois os dias com compromisso
 *   seguintes (`order='asc'`) ou anteriores, do mais recente ao mais antigo (`order='desc'`).
 * - Com busca: todos os dias com compromissos que casam, na ordem pedida.
 * `list` precisa estar em ordem crescente (flattenCompromissos): dentro do dia, hora crescente.
 */
export function buildDaySections(list, selectedKey, { order = 'asc', search = '' } = {}) {
    const termo = search.trim().toLowerCase();
    const porDia = indexByDay(termo ? list.filter((c) => casa(c, termo)) : list);
    const chaves = [...porDia.keys()].sort();
    if (termo) {
        const ordenadas = order === 'desc' ? chaves.reverse() : chaves;
        return ordenadas.map((key) => ({ key, items: porDia.get(key) }));
    }
    const resto = order === 'desc'
        ? chaves.filter((k) => k < selectedKey).reverse()
        : chaves.filter((k) => k > selectedKey);
    return [
        { key: selectedKey, items: porDia.get(selectedKey) || [] },
        ...resto.map((key) => ({ key, items: porDia.get(key) })),
    ];
}
```

- [ ] **Step 3: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/roteiro.mobile.spec.mjs` → Expected: 2 passed.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (prova que o `afterAll` limpou os compromissos `E2E `).

- [ ] **Step 4: Lint e commit**

Run: `npx eslint src/pages/Agenda/roteiroDates.js` → Expected: sem erros.

```bash
git add bussola_web/src/pages/Agenda/roteiroDates.js bussola_web/e2e/roteiro.mobile.spec.mjs
git commit -m "feat(web): datas do Roteiro no celular (semana, grade do mes, secoes da lista)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Layout mobile do Roteiro (faixa da semana, busca + ordenar, lista por dia, Fab)

**Files:**
- Create: `bussola_web/src/pages/Agenda/mobile/RoteiroMobile.jsx`, `bussola_web/src/pages/Agenda/mobile/roteiro-mobile.css`
- Modify: `bussola_web/src/pages/Agenda/index.jsx` (reescrito), `bussola_web/src/pages/Agenda/components/CompromissoCard.jsx`, `bussola_web/src/pages/Agenda/styles.css`, `bussola_web/e2e/roteiro.mobile.spec.mjs`

**Interfaces:**
- Consumes: `roteiroDates.js` (Task 2); `Fab` (plano 01); `CompromissoCard`; handlers da página.
- Produces:
  - `RoteiroMobile({ data, loading, searchTerm, onSearch, sortOrder, onToggleSort, onUpdate, onEdit, onNew })` → `div.m-roteiro` com `section.m-week` (`.m-week-head` com `button.m-week-nav[aria-label="Semana anterior"|"Próxima semana"]` e `.m-week-title`; `.m-week-strip` com 7 `button.m-week-day[aria-pressed][aria-label]` contendo `span.dia-card.m-week-cell(.today)(.is-selected)(.has-compromissos)` → `.dia-semana`, `.dia-numero`, `.compromisso-indicator(.no-event)`), `.m-roteiro-tools` (`input[type=search][aria-label="Buscar compromissos"]` + `button.m-roteiro-sort[aria-label="Mostrar dias anteriores"|"Mostrar próximos dias"]`), `.m-roteiro-list` com `section.m-day-group[data-day]` → `h2.m-day-head` (+ `span.m-day-rel`) e `.m-day-cards` (ou `p.empty-list-msg`), e `<Fab label="Novo compromisso">`.
  - `CompromissoCard`: botões com `aria-label="Editar"`/`"Excluir"`; `span.weekday-inline > span.weekday-sep[aria-hidden]` ("• ") + dia da semana (mesmo texto do desktop).
  - No mobile, `index.jsx` renderiza só `RoteiroMobile` + `AgendaModal` dentro de `.container.main-container.agenda-scope`.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/roteiro.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 3 — layout mobile
// ---------------------------------------------------------------------------
test.describe('layout mobile', () => {
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
```

Run: `npm run e2e -- --project=mobile e2e/roteiro.mobile.spec.mjs`
Expected: os testes de "layout mobile" FAIL (não há `.m-week-day`, `.m-day-group` nem o Fab); os 2 de "lógica pura" passam.

- [ ] **Step 2: `CompromissoCard`: nomes acessíveis e separador do dia da semana**

Em `bussola_web/src/pages/Agenda/components/CompromissoCard.jsx`:

1. Substituir `                        <span className="weekday-inline">• {diaSemana}</span>` por:

```jsx
                        <span className="weekday-inline"><span className="weekday-sep" aria-hidden="true">• </span>{diaSemana}</span>
```

2. Substituir

```jsx
                    <button className="btn-action-icon btn-edit-transacao" onClick={() => onEdit(comp)} title="Editar">
```

por

```jsx
                    <button className="btn-action-icon btn-edit-transacao" onClick={() => onEdit(comp)} title="Editar" aria-label="Editar">
```

3. Substituir

```jsx
                    <button className="btn-action-icon btn-delete-transacao" onClick={handleDelete} title="Excluir">
```

por

```jsx
                    <button className="btn-action-icon btn-delete-transacao" onClick={handleDelete} title="Excluir" aria-label="Excluir">
```

(O `title` sozinho some quando o `TooltipHost` remove o atributo no hover do desktop; o `aria-label` mantém o nome. O texto renderizado continua "• Sexta-feira".)

- [ ] **Step 3: `RoteiroMobile.jsx`**

Criar `bussola_web/src/pages/Agenda/mobile/RoteiroMobile.jsx`:

```jsx
import { useMemo, useState } from 'react';
import { CompromissoCard } from '../components/CompromissoCard';
import { Fab } from '../../../components/mobile/Fab';
import {
    addDays, buildDaySections, dayAriaLabel, dayHeaderParts, dayKey, DIAS_CURTOS,
    flattenCompromissos, indexByDay, parseKey, weekKeys, weekRangeLabel,
} from '../roteiroDates';
import './roteiro-mobile.css';

/** Um dia da faixa: o botão ocupa 1/7 da faixa; o card visual (.dia-card) fica dentro. */
function DiaDaSemana({ dia, count, isToday, isSelected, onSelect }) {
    const d = parseKey(dia);
    const cls = ['dia-card', 'm-week-cell', isToday && 'today', isSelected && 'is-selected', count > 0 && 'has-compromissos']
        .filter(Boolean)
        .join(' ');
    return (
        <button
            type="button"
            className="m-week-day"
            aria-pressed={isSelected}
            aria-label={dayAriaLabel(dia, count)}
            onClick={() => onSelect(dia)}
        >
            <span className={cls}>
                <span className="dia-semana">{DIAS_CURTOS[d.getDay()]}</span>
                <span className="dia-numero">{d.getDate()}</span>
                <span className={`compromisso-indicator ${count > 0 ? '' : 'no-event'}`}></span>
            </span>
        </button>
    );
}

/**
 * Roteiro no celular (spec §5.3, opção "Faixa da semana"): faixa de 7 dias com ‹ ›,
 * busca + ordenação, e a lista do dia selecionado seguida dos próximos (ou anteriores)
 * dias com o CompromissoCard atual. Dados e handlers vêm da página (index.jsx).
 */
export function RoteiroMobile({ data, loading, searchTerm, onSearch, sortOrder, onToggleSort, onUpdate, onEdit, onNew }) {
    const [hoje] = useState(() => dayKey(new Date()));
    const [selected, setSelected] = useState(hoje);

    const lista = useMemo(() => flattenCompromissos(data?.compromissos_por_mes), [data]);
    const porDia = useMemo(() => indexByDay(lista), [lista]);
    const semana = useMemo(() => weekKeys(selected), [selected]);
    const secoes = useMemo(
        () => buildDaySections(lista, selected, { order: sortOrder, search: searchTerm }),
        [lista, selected, sortOrder, searchTerm],
    );

    const mudarSemana = (dir) => setSelected((k) => addDays(k, 7 * dir));

    return (
        <div className="m-roteiro">
            <section className="m-week" aria-label="Semana">
                <div className="m-week-head">
                    <button type="button" className="btn-nav-arrow m-week-nav" aria-label="Semana anterior" onClick={() => mudarSemana(-1)}>
                        <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <span className="m-week-title">{weekRangeLabel(semana)}</span>
                    <button type="button" className="btn-nav-arrow m-week-nav" aria-label="Próxima semana" onClick={() => mudarSemana(1)}>
                        <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
                <div className="m-week-strip">
                    {semana.map((k) => (
                        <DiaDaSemana
                            key={k}
                            dia={k}
                            count={porDia.get(k)?.length || 0}
                            isToday={k === hoje}
                            isSelected={k === selected}
                            onSelect={setSelected}
                        />
                    ))}
                </div>
            </section>

            <div className="m-roteiro-tools">
                <label className="m-roteiro-search">
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                    <input
                        type="search"
                        placeholder="Buscar..."
                        aria-label="Buscar compromissos"
                        value={searchTerm}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                </label>
                <button
                    type="button"
                    className="btn-filter-sort m-roteiro-sort"
                    onClick={onToggleSort}
                    aria-label={sortOrder === 'desc' ? 'Mostrar próximos dias' : 'Mostrar dias anteriores'}
                >
                    <i className={`fa-solid fa-arrow-${sortOrder === 'desc' ? 'up-wide-short' : 'down-wide-short'}`}></i>
                </button>
            </div>

            {loading && !data ? (
                <p className="m-roteiro-loading">
                    <i className="fa-solid fa-circle-notch fa-spin"></i> Carregando agenda...
                </p>
            ) : (
                <div className="m-roteiro-list">
                    {secoes.length === 0 && <p className="empty-list-msg">Nenhum compromisso encontrado.</p>}
                    {secoes.map((s) => {
                        const cab = dayHeaderParts(s.key);
                        return (
                            <section key={s.key} className="m-day-group" data-day={s.key}>
                                <h2 className="m-day-head">
                                    {cab.rel && <><span className="m-day-rel">{cab.rel}</span>{' · '}</>}
                                    {cab.text}
                                </h2>
                                {s.items.length > 0 ? (
                                    <div className="m-day-cards">
                                        {s.items.map((c) => (
                                            <CompromissoCard key={c.id} comp={c} onUpdate={onUpdate} onEdit={onEdit} />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="empty-list-msg">Nenhum compromisso neste dia.</p>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            <Fab icon="fa-plus" label="Novo compromisso" onClick={onNew} />
        </div>
    );
}
```

- [ ] **Step 4: `roteiro-mobile.css`**

Criar `bussola_web/src/pages/Agenda/mobile/roteiro-mobile.css`:

```css
/* =========================================================================
   ROTEIRO NO CELULAR (≤768): faixa da semana, busca + ordenar e lista por dia
   com o CompromissoCard atual. Escala (tokens.css): 8 dentro do card e entre
   controles relacionados, 12 livres entre cards, 16 gutter e blocos, 24 entre
   dias. Importado depois de ../styles.css (ver index.jsx).
   ========================================================================= */

@media (max-width: 768px) {
    /* A .app-content já reserva a barra inferior; os 5rem do desktop sobrariam aqui. */
    .agenda-scope.main-container {
        padding-bottom: 0 !important;
    }

    .agenda-scope .m-roteiro {
        --selo-saliencia: 26px; /* o selo do card sobe 22px acima da borda + anel de 4px */
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
        padding-top: var(--sp-4);
        padding-bottom: calc(56px + var(--sp-4)); /* o Fab (56px) não cobre o fim da lista */
    }

    /* --- Faixa da semana --- */
    .agenda-scope .m-week {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
    }

    .agenda-scope .m-week-head {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
    }

    .agenda-scope .m-week-title {
        flex: 1;
        text-align: center;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--cor-texto-principal);
    }

    .agenda-scope .m-week .m-week-nav {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        border-radius: 12px;
    }

    /* Cada botão ocupa 1/7 da faixa (48px em 360); o card visual fica dentro com
       4px de cada lado (8px entre cards). A faixa recua 4px para os cards
       alinharem no gutter de 16px. */
    .agenda-scope .m-week-strip {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        margin-inline: calc(-1 * var(--sp-1));
        touch-action: pan-y;
        user-select: none;
    }

    .agenda-scope .m-week-day {
        display: flex;
        min-width: 0;
        padding: 0 var(--sp-1);
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .agenda-scope .m-week .dia-card.m-week-cell {
        flex: 1;
        min-width: 0;
        height: 56px;
        aspect-ratio: auto;
        gap: var(--sp-1);
        padding: var(--sp-1) 0;
        border-radius: 12px;
    }

    .agenda-scope .m-week .dia-card.m-week-cell .dia-semana {
        display: block;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .agenda-scope .m-week .dia-card.m-week-cell .dia-numero {
        font-size: 1.05rem;
        font-weight: 700;
        line-height: 1.1;
    }

    .agenda-scope .m-week .dia-card.m-week-cell .compromisso-indicator {
        width: var(--sp-2);
        height: var(--sp-2);
        margin-top: 0;
    }

    .agenda-scope .m-week .dia-card.m-week-cell.is-selected {
        background-color: var(--cor-azul-primario);
        border-color: var(--cor-azul-primario);
    }

    .agenda-scope .m-week .dia-card.m-week-cell.is-selected .dia-numero,
    .agenda-scope .m-week .dia-card.m-week-cell.is-selected .dia-semana {
        color: #fff;
    }

    .agenda-scope .m-week .dia-card.m-week-cell.is-selected .compromisso-indicator:not(.no-event) {
        background-color: #fff;
    }

    .agenda-scope .m-week-day:focus-visible {
        outline: none;
    }

    .agenda-scope .m-week-day:focus-visible .m-week-cell {
        outline: 2px solid var(--cor-azul-primario);
        outline-offset: 2px;
    }

    /* --- Busca + ordenar (uma linha) --- */
    .agenda-scope .m-roteiro-tools {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
    }

    .agenda-scope .m-roteiro-search {
        position: relative;
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
    }

    .agenda-scope .m-roteiro-search i {
        position: absolute;
        left: var(--sp-3);
        color: var(--cor-texto-secundario);
        font-size: 0.9rem;
        pointer-events: none;
    }

    .agenda-scope .m-roteiro-search input {
        width: 100%;
        height: var(--tap-min);
        padding: 0 var(--sp-3) 0 calc(var(--sp-3) + var(--sp-5));
        border: 1px solid var(--cor-borda);
        border-radius: 12px;
        background-color: var(--cor-fundo);
        color: var(--cor-texto-principal);
    }

    .agenda-scope .m-roteiro-search input:focus {
        outline: none;
        border-color: var(--cor-azul-primario);
    }

    .agenda-scope .m-roteiro-tools .m-roteiro-sort {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        border-radius: 12px;
    }

    /* --- Lista por dia --- */
    .agenda-scope .m-roteiro-list {
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
    }

    .agenda-scope .m-day-group {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
    }

    .agenda-scope .m-day-head {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: none;
        color: var(--cor-texto-secundario);
    }

    .agenda-scope .m-day-rel {
        color: var(--cor-azul-primario);
    }

    /* 12px livres entre o fim de um card e o selo do próximo: o selo sobe
       --selo-saliencia acima do card, então o gap soma os dois. O padding-top
       abre espaço para o selo do primeiro card. */
    .agenda-scope .m-day-cards {
        display: flex;
        flex-direction: column;
        gap: calc(var(--sp-3) + var(--selo-saliencia));
        padding-top: var(--selo-saliencia);
    }

    .agenda-scope .m-roteiro .empty-list-msg {
        margin: 0;
        padding: var(--sp-5) var(--sp-4);
        font-size: 0.875rem;
    }

    .agenda-scope .m-roteiro-loading {
        margin: 0;
        padding: var(--sp-6) 0;
        text-align: center;
        font-size: 0.875rem;
        color: var(--cor-texto-secundario);
    }

    .agenda-scope .m-roteiro-loading i {
        margin-right: var(--sp-2);
        color: var(--cor-azul-primario);
    }

    /* --- Card (mesmo desenho; só espaçamento, quebra e alvos de toque) --- */
    .agenda-scope .m-day-cards .compromisso-card-modern {
        height: auto;
        padding: var(--sp-6) var(--sp-4) var(--sp-4);
        gap: var(--sp-2);
    }

    .agenda-scope .m-day-cards .card-header-row {
        align-items: flex-start;
        gap: var(--sp-2);
    }

    .agenda-scope .m-day-cards .top-actions {
        flex-shrink: 0;
    }

    .agenda-scope .m-day-cards .card-infos-container {
        gap: var(--sp-2);
        margin-top: 0;
    }

    .agenda-scope .m-day-cards .card-footer-row {
        padding-top: var(--sp-2);
    }

    .agenda-scope .m-day-cards .footer-actions {
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: var(--sp-2);
    }

    .agenda-scope .compromisso-card-modern .btn-action-icon {
        width: var(--tap-min) !important;
        height: var(--tap-min) !important;
        font-size: 0.95rem;
    }

    .agenda-scope .compromisso-card-modern .btn-concluir-action,
    .agenda-scope .compromisso-card-modern .btn-cancelar-action {
        min-height: var(--tap-min);
    }
}

/* Celular pequeno: o dia da semana do cabeçalho do card desce para baixo da data. */
@media (max-width: 480px) {
    .agenda-scope .compromisso-card-modern .date-highlight {
        flex-wrap: wrap;
        column-gap: var(--sp-3);
        row-gap: 0;
        min-width: 0;
    }

    .agenda-scope .compromisso-card-modern .time-group {
        display: contents;
    }

    .agenda-scope .compromisso-card-modern .weekday-inline {
        flex-basis: 100%;
    }

    .agenda-scope .compromisso-card-modern .weekday-sep {
        display: none;
    }
}
```

- [ ] **Step 5: Efeitos de hover só com mouse (`styles.css`)**

Em `bussola_web/src/pages/Agenda/styles.css`, substituir

```css
.agenda-scope .compromisso-card-modern:hover {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--card-accent) 45%, var(--cor-borda));
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1),
        0 0 0 3px color-mix(in srgb, var(--card-accent) 12%, transparent);
}
```

por

```css
@media (hover: hover) and (pointer: fine) {
    .agenda-scope .compromisso-card-modern:hover {
        transform: translateY(-3px);
        border-color: color-mix(in srgb, var(--card-accent) 45%, var(--cor-borda));
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1),
            0 0 0 3px color-mix(in srgb, var(--card-accent) 12%, transparent);
    }
}
```

e substituir

```css
:is(.agenda-scope, .roteiro-cal-sheet) .dia-card:not(.dia-padding):hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    border-color: var(--cor-azul-primario);
    cursor: pointer;
}
```

por

```css
@media (hover: hover) and (pointer: fine) {
    :is(.agenda-scope, .roteiro-cal-sheet) .dia-card:not(.dia-padding):hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        border-color: var(--cor-azul-primario);
        cursor: pointer;
    }
}
```

(No toque o `:hover` "gruda" depois do tap e levantava o card/célula.)

- [ ] **Step 6: `index.jsx` com o ramo mobile**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Agenda/index.jsx` por (inclui as mudanças da Task 1):

```jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getAgendaDashboard } from '../../services/api';
import { CompromissoCard } from './components/CompromissoCard';
import { AgendaModal } from './components/AgendaModal';
import { useToast } from '../../context/ToastContext';
import { AiAssistant } from '../../components/AiAssistant'; // [NOVO] Import da IA
import { useIsMobile } from '../../hooks/useIsMobile';
import './styles.css';
import { RoteiroMobile } from './mobile/RoteiroMobile'; // depois do styles.css: o CSS mobile vence na cascata
import { logger } from '../../utils/logger';

// --- SUB-COMPONENTES MEMOIZADOS (PERFORMANCE FIX) ---

// 1. Componente de Dia do Calendário (Evita re-render ao passar o mouse)
const CalendarDay = React.memo(({ item, onHover, onLeave }) => {
    let cardClasses = 'dia-card';
    if (item.is_today) cardClasses += ' today';
    if (item.is_padding) cardClasses += ' dia-padding';
    if (!item.is_padding && item.compromissos?.length > 0) cardClasses += ' has-compromissos';

    return (
        <div
            className={cardClasses}
            onMouseEnter={(e) => !item.is_padding && onHover(e, item.compromissos)}
            onMouseLeave={onLeave}
        >
            <span className="dia-numero">{item.day_number}</span>
            <span className="dia-semana">{item.weekday_short}</span>
            <div className={`compromisso-indicator ${item.compromissos?.length > 0 && !item.is_padding ? '' : 'no-event'}`}></div>
        </div>
    );
});

// 2. Componente de Grupo de Mês (Lista Esquerda)
const MonthGroup = React.memo(({ mes, comps, isOpen, onToggle, onUpdate, onEdit }) => {
    return (
        <div className="month-group">
            <h3 className={`month-header ${isOpen ? 'active' : ''}`} onClick={() => onToggle(mes)}>
                <span className="month-title-text">{mes}</span>
                <div className="month-header-right">
                    <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.6 }}>
                        {comps.length} {comps.length === 1 ? 'COMPROMISSO' : 'COMPROMISSOS'}
                    </span>
                    <i className={`fa-solid fa-chevron-down ${isOpen ? 'rotate' : ''}`}></i>
                </div>
            </h3>
            
            <div className={`accordion-wrapper ${isOpen ? 'open' : ''}`}>
                <div className="accordion-inner">
                    <div className="month-content">
                        <div className="compromissos-grid">
                            {comps.map(comp => (
                                <CompromissoCard key={comp.id} comp={comp} onUpdate={onUpdate} onEdit={onEdit} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

// --- COMPONENTE PRINCIPAL ---

export function Agenda() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    
    const [viewDate, setViewDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc'); 

    const { addToast } = useToast();
    const isMobile = useIsMobile();
    
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, compromissos: [] });

    const [openMonths, setOpenMonths] = useState(() => {
        const savedState = localStorage.getItem('@Bussola:agenda_accordions');
        if (savedState) {
            try { return JSON.parse(savedState); } catch { /* estado salvo inválido: começa fechado */ }
        }
        return {};
    });

    useEffect(() => {
        localStorage.setItem('@Bussola:agenda_accordions', JSON.stringify(openMonths));
    }, [openMonths]);

    const fetchData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            
            const month = viewDate.getMonth() + 1;
            const year = viewDate.getFullYear();

            const result = await getAgendaDashboard(month, year); 
            setData(result);
            
            if (!silent && result.compromissos_por_mes && Object.keys(result.compromissos_por_mes).length > 0) {
                const firstMonth = Object.keys(result.compromissos_por_mes)[0];
                setOpenMonths(prev => {
                    if (Object.keys(prev).length === 0) return { [firstMonth]: true };
                    return prev;
                });
            }
        } catch (err) {
            logger.error("Erro inesperado", { error: String(err) });
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível carregar a agenda.' });
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { 
        fetchData(data !== null); 
    }, [viewDate]);

    // [OPTIMIZATION] useCallback garante que a função não seja recriada a cada render
    // Isso permite que o React.memo dos filhos funcione.
    const toggleAccordion = useCallback((key) => {
        setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleNew = () => { setEditingItem(null); setModalOpen(true); };
    const handleEdit = useCallback((item) => { setEditingItem(item); setModalOpen(true); }, []);
    
    // Função para passar para o CompromissoCard (que deve chamar fetchData)
    const handleUpdate = useCallback(() => fetchData(true), [viewDate]); 

    // [OPTIMIZATION] Handlers de Hover otimizados
    const handleDayHover = useCallback((e, compromissos) => {
        if (!compromissos || compromissos.length === 0) return;
        const rect = e.target.getBoundingClientRect();
        setTooltip({
            visible: true,
            x: rect.right + window.scrollX - 280,
            y: rect.bottom + window.scrollY + 5,
            compromissos
        });
    }, []);

    const handleDayLeave = useCallback(() => {
        setTooltip(prev => ({ ...prev, visible: false }));
    }, []);

    const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const formatMonthTitle = (date) => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Memoiza o cálculo dos dias para não rodar a cada tooltip hover
    const currentMonthDays = useMemo(() => {
        if (!data || !data.calendar_days) return [];
        const days = [];
        let dividersFound = 0;
        for (const item of data.calendar_days) {
            if (item.type === 'month_divider') {
                dividersFound++;
                if (dividersFound > 1) break; 
                continue; 
            }
            days.push(item);
        }
        return days;
    }, [data]); // Só recalcula se 'data' mudar

    // Memoiza o processamento da lista
    const processedData = useMemo(() => {
        if (!data || !data.compromissos_por_mes) return {};

        const filtered = {};
        Object.entries(data.compromissos_por_mes).forEach(([mes, items]) => {
            const matches = items.filter(item => 
                item.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.local && item.local.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            if (matches.length > 0) filtered[mes] = matches;
        });

        const sortedKeys = Object.keys(filtered);
        if (sortOrder === 'desc') sortedKeys.reverse();

        const sortedObj = {};
        sortedKeys.forEach(key => { sortedObj[key] = filtered[key]; });

        return sortedObj;
    }, [data, searchTerm, sortOrder]);

    const hasData = Object.keys(processedData).length > 0;

    const LoadingState = () => (
        <div className="loading-state-internal" style={{ padding: '2rem', textAlign: 'center', color: 'var(--cor-texto-secundario)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'var(--cor-azul-primario)' }}></i>
            <p style={{ fontSize: '0.9rem' }}>Carregando agenda...</p>
        </div>
    );

    // Celular (spec §5.3): faixa da semana + lista por dia; sem page-header, sem
    // calendário lateral e sem o tooltip de hover. O título vem da topbar do shell.
    if (isMobile) {
        return (
            <div className="container main-container agenda-scope">
                <RoteiroMobile
                    data={data}
                    loading={loading}
                    searchTerm={searchTerm}
                    onSearch={setSearchTerm}
                    sortOrder={sortOrder}
                    onToggleSort={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    onUpdate={handleUpdate}
                    onEdit={handleEdit}
                    onNew={handleNew}
                />
                <AgendaModal
                    active={modalOpen}
                    closeModal={() => setModalOpen(false)}
                    onUpdate={() => fetchData(true)}
                    editingData={editingItem}
                />
            </div>
        );
    }

    return (
        <div className="container main-container agenda-scope">
            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-calendar-days"></i> Roteiro</h1>
                </div>
                <div className="page-header-kpis">
                    <span className="ph-kpi"><i className="fa-solid fa-calendar"></i> {formatMonthTitle(viewDate)}</span>
                    {data && <span className="ph-kpi">
                        <i className="fa-solid fa-calendar-check"></i>
                        {Object.values(data.compromissos_por_mes || {}).reduce((s, a) => s + a.length, 0)} compromisso(s)
                    </span>}
                </div>
            </div>

            <div className="layout-grid-custom agenda-layout">
                <div className="agenda-column">
                    <div className="column-header-flex header-left-aligned">
                        <h2>Compromissos</h2>
                        
                        <div className="header-actions-group">
                            <div className="header-search-wrapper">
                                <i className="fa-solid fa-magnifying-glass header-search-icon"></i>
                                <input 
                                    type="text" 
                                    placeholder="Buscar..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="header-search-input"
                                />
                            </div>

                            <button
                                className="btn-filter-sort"
                                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                title={sortOrder === 'desc' ? "Mais antigos primeiro" : "Mais recentes primeiro"}
                            >
                                <i className={`fa-solid fa-arrow-${sortOrder === 'desc' ? 'up-wide-short' : 'down-wide-short'}`}></i>
                            </button>

                            <button className="btn-primary small-btn" onClick={handleNew}>
                                <i className="fa-solid fa-plus"></i> Adicionar
                            </button>
                        </div>
                    </div>

                    {loading && !data ? (
                        <LoadingState />
                    ) : (
                        <>
                            {hasData ? (
                                Object.entries(processedData).map(([mes, comps]) => (
                                    <MonthGroup 
                                        key={mes}
                                        mes={mes}
                                        comps={comps}
                                        isOpen={!!openMonths[mes]}
                                        onToggle={toggleAccordion}
                                        onUpdate={handleUpdate}
                                        onEdit={handleEdit}
                                    />
                                ))
                            ) : (
                                <p className="empty-list-msg">
                                    {searchTerm ? 'Nenhum compromisso encontrado.' : 'Nenhum compromisso agendado.'}
                                </p>
                            )}
                        </>
                    )}
                </div>

                <div className="agenda-column">
                    <div className="column-header-flex calendar-nav-header">
                        <button className="btn-nav-arrow" onClick={handlePrevMonth}>
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
                        
                        <h2 className="calendar-title-nav">{formatMonthTitle(viewDate)}</h2>
                        
                        <button className="btn-nav-arrow" onClick={handleNextMonth}>
                            <i className="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>

                    <div className="dias-grid">
                        {currentMonthDays.map((item, idx) => (
                            <CalendarDay 
                                key={idx} 
                                item={item} 
                                onHover={handleDayHover} 
                                onLeave={handleDayLeave} 
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className={`tooltip ${tooltip.visible ? 'visible' : ''}`} style={{ top: tooltip.y, left: tooltip.x }}>
                {tooltip.compromissos.map((c, i) => (
                    <div key={i} className="tooltip-compromisso-item">
                        <p><span className="tooltip-titulo">{c.titulo}</span> <span className="tooltip-hora">{c.hora}</span></p>
                    </div>
                ))}
            </div>

            <AgendaModal
                active={modalOpen}
                closeModal={() => setModalOpen(false)}
                onUpdate={() => fetchData(true)}
                editingData={editingItem}
            />

            {/* AI Assistant Integrado (Contexto Roteiro) */}
            <AiAssistant context="roteiro" />
        </div>
    );
}
```

- [ ] **Step 7: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/roteiro.mobile.spec.mjs` → Expected: tudo passa. Se `overflowOffenders` listar algo, corrija o CSS do elemento em `roteiro-mobile.css` (sem esconder com `overflow: hidden`). Se o teste de espaçamento falhar, ajuste só tokens/`--selo-saliencia` (nunca valores soltos).
Run: `npm run e2e -- --project=mobile` → Expected: tudo passa (inclui `shell.mobile.spec.mjs` › "topbar mostra o título do módulo e é sticky", que usa `/agenda`).
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (`agenda.png`, `modal-compromisso.png` e os 4 PNGs do Roteiro idênticos; "nada do layout mobile aparece").

- [ ] **Step 8: Lint e commit**

Run: `npx eslint src/pages/Agenda` → Expected: 1 erro (o do `AgendaModal.jsx`, pré-existente) e 2 warnings, nada novo.

```bash
git add bussola_web/src/pages/Agenda bussola_web/e2e/roteiro.mobile.spec.mjs
git commit -m "feat(web): Roteiro no celular com faixa da semana, lista por dia e Fab" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Calendário do mês em sheet (ícone da topbar) e swipe entre semanas

**Files:**
- Modify: `bussola_web/src/pages/Agenda/mobile/RoteiroMobile.jsx` (reescrito), `bussola_web/src/pages/Agenda/mobile/roteiro-mobile.css`, `bussola_web/e2e/roteiro.mobile.spec.mjs`

**Interfaces:**
- Consumes: `Sheet`, `TopbarActions` (plano 01); `monthGrid`, `monthLabel` (Task 2).
- Produces:
  - Botão `fa-calendar-days` com `aria-label="Abrir calendário"` no `.m-topbar-slot`.
  - `<Sheet title="Calendário" className="roteiro-cal-sheet">` com `.m-cal-nav` (`button.btn-nav-arrow[aria-label="Mês anterior"|"Próximo mês"]` + `.m-cal-title`) e `.dias-grid` (7 `span.m-cal-weekday` + células: `span.dia-card.dia-padding` fora do mês, `button.dia-card[aria-pressed][aria-label](.today)(.is-selected)(.has-compromissos)` no mês). Abre no mês do dia selecionado; tocar num dia seleciona, fecha e volta ao topo.
  - Swipe na `.m-week-strip` (pointer events, ≥ 48px na horizontal): troca de semana e descarta o clique que fecha o gesto.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/roteiro.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 4 — calendário em sheet e swipe
// ---------------------------------------------------------------------------
test.describe('calendário e swipe', () => {
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
});
```

Run: `npm run e2e -- --project=mobile e2e/roteiro.mobile.spec.mjs`
Expected: os testes de "calendário e swipe" FAIL (não há botão "Abrir calendário" nem swipe); os anteriores passam.

- [ ] **Step 2: `RoteiroMobile.jsx` com calendário e swipe**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Agenda/mobile/RoteiroMobile.jsx` por:

```jsx
import { useMemo, useRef, useState } from 'react';
import { CompromissoCard } from '../components/CompromissoCard';
import { Fab } from '../../../components/mobile/Fab';
import { Sheet } from '../../../components/mobile/Sheet';
import { TopbarActions } from '../../../components/mobile/MobileChrome';
import {
    addDays, buildDaySections, dayAriaLabel, dayHeaderParts, dayKey, DIAS_CURTOS,
    flattenCompromissos, indexByDay, monthGrid, monthLabel, parseKey, weekKeys, weekRangeLabel,
} from '../roteiroDates';
import './roteiro-mobile.css';

const SWIPE_MIN = 48; // deslocamento horizontal (px) que troca de semana

/** Um dia da faixa: o botão ocupa 1/7 da faixa; o card visual (.dia-card) fica dentro. */
function DiaDaSemana({ dia, count, isToday, isSelected, onSelect }) {
    const d = parseKey(dia);
    const cls = ['dia-card', 'm-week-cell', isToday && 'today', isSelected && 'is-selected', count > 0 && 'has-compromissos']
        .filter(Boolean)
        .join(' ');
    return (
        <button
            type="button"
            className="m-week-day"
            aria-pressed={isSelected}
            aria-label={dayAriaLabel(dia, count)}
            onClick={() => onSelect(dia)}
        >
            <span className={cls}>
                <span className="dia-semana">{DIAS_CURTOS[d.getDay()]}</span>
                <span className="dia-numero">{d.getDate()}</span>
                <span className={`compromisso-indicator ${count > 0 ? '' : 'no-event'}`}></span>
            </span>
        </button>
    );
}

/** O .dias-grid atual (mesmas células do desktop), calculado no cliente a partir da lista completa. */
function CalendarioMes({ grade, porDia, hoje, selected, onPick }) {
    return (
        <div className="dias-grid">
            {DIAS_CURTOS.map((w) => (
                <span key={w} className="m-cal-weekday" aria-hidden="true">{w}</span>
            ))}
            {grade.map((c) => {
                if (c.isPadding) {
                    return (
                        <span key={c.key} className="dia-card dia-padding">
                            <span className="dia-numero">{c.day}</span>
                            <span className="dia-semana">{c.weekday}</span>
                            <span className="compromisso-indicator no-event"></span>
                        </span>
                    );
                }
                const n = porDia.get(c.key)?.length || 0;
                const cls = ['dia-card', c.key === hoje && 'today', c.key === selected && 'is-selected', n > 0 && 'has-compromissos']
                    .filter(Boolean)
                    .join(' ');
                return (
                    <button
                        key={c.key}
                        type="button"
                        className={cls}
                        aria-pressed={c.key === selected}
                        aria-label={dayAriaLabel(c.key, n)}
                        onClick={() => onPick(c.key)}
                    >
                        <span className="dia-numero">{c.day}</span>
                        <span className="dia-semana">{c.weekday}</span>
                        <span className={`compromisso-indicator ${n > 0 ? '' : 'no-event'}`}></span>
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Roteiro no celular (spec §5.3, opção "Faixa da semana"): calendário do mês na topbar
 * (sheet), faixa de 7 dias com ‹ › e swipe, busca + ordenação, e a lista do dia
 * selecionado seguida dos próximos (ou anteriores) dias com o CompromissoCard atual.
 * Dados e handlers vêm da página (index.jsx).
 */
export function RoteiroMobile({ data, loading, searchTerm, onSearch, sortOrder, onToggleSort, onUpdate, onEdit, onNew }) {
    const [hoje] = useState(() => dayKey(new Date()));
    const [selected, setSelected] = useState(hoje);
    const [calOpen, setCalOpen] = useState(false);
    const [calMonth, setCalMonth] = useState(() => {
        const d = new Date();
        return { y: d.getFullYear(), m: d.getMonth() };
    });
    const swipe = useRef(null);
    const engolirClique = useRef(false);

    const lista = useMemo(() => flattenCompromissos(data?.compromissos_por_mes), [data]);
    const porDia = useMemo(() => indexByDay(lista), [lista]);
    const semana = useMemo(() => weekKeys(selected), [selected]);
    const secoes = useMemo(
        () => buildDaySections(lista, selected, { order: sortOrder, search: searchTerm }),
        [lista, selected, sortOrder, searchTerm],
    );
    const grade = useMemo(() => monthGrid(calMonth.y, calMonth.m), [calMonth]);

    const mudarSemana = (dir) => setSelected((k) => addDays(k, 7 * dir));

    const abrirCalendario = () => {
        const d = parseKey(selected);
        setCalMonth({ y: d.getFullYear(), m: d.getMonth() });
        setCalOpen(true);
    };

    const mudarMes = (dir) => setCalMonth(({ y, m }) => {
        const d = new Date(y, m + dir, 1);
        return { y: d.getFullYear(), m: d.getMonth() };
    });

    const escolherNoCalendario = (key) => {
        setSelected(key);
        setCalOpen(false);
        // O unlockScroll do sheet restaura o scroll antigo; depois disso, volta ao topo
        // para a faixa e o cabeçalho do dia escolhido aparecerem.
        requestAnimationFrame(() => window.scrollTo(0, 0));
    };

    // Swipe horizontal na faixa troca de semana; o clique que fecha o gesto é descartado.
    const onPointerDown = (e) => {
        engolirClique.current = false;
        swipe.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e) => {
        const ini = swipe.current;
        swipe.current = null;
        if (!ini) return;
        const dx = e.clientX - ini.x;
        const dy = e.clientY - ini.y;
        if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
            engolirClique.current = true;
            mudarSemana(dx < 0 ? 1 : -1);
        }
    };

    const onClickCapture = (e) => {
        if (!engolirClique.current) return;
        engolirClique.current = false;
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <div className="m-roteiro">
            <TopbarActions>
                <button type="button" aria-label="Abrir calendário" onClick={abrirCalendario}>
                    <i className="fa-solid fa-calendar-days"></i>
                </button>
            </TopbarActions>

            <section className="m-week" aria-label="Semana">
                <div className="m-week-head">
                    <button type="button" className="btn-nav-arrow m-week-nav" aria-label="Semana anterior" onClick={() => mudarSemana(-1)}>
                        <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <span className="m-week-title">{weekRangeLabel(semana)}</span>
                    <button type="button" className="btn-nav-arrow m-week-nav" aria-label="Próxima semana" onClick={() => mudarSemana(1)}>
                        <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
                <div
                    className="m-week-strip"
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => { swipe.current = null; }}
                    onClickCapture={onClickCapture}
                >
                    {semana.map((k) => (
                        <DiaDaSemana
                            key={k}
                            dia={k}
                            count={porDia.get(k)?.length || 0}
                            isToday={k === hoje}
                            isSelected={k === selected}
                            onSelect={setSelected}
                        />
                    ))}
                </div>
            </section>

            <div className="m-roteiro-tools">
                <label className="m-roteiro-search">
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                    <input
                        type="search"
                        placeholder="Buscar..."
                        aria-label="Buscar compromissos"
                        value={searchTerm}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                </label>
                <button
                    type="button"
                    className="btn-filter-sort m-roteiro-sort"
                    onClick={onToggleSort}
                    aria-label={sortOrder === 'desc' ? 'Mostrar próximos dias' : 'Mostrar dias anteriores'}
                >
                    <i className={`fa-solid fa-arrow-${sortOrder === 'desc' ? 'up-wide-short' : 'down-wide-short'}`}></i>
                </button>
            </div>

            {loading && !data ? (
                <p className="m-roteiro-loading">
                    <i className="fa-solid fa-circle-notch fa-spin"></i> Carregando agenda...
                </p>
            ) : (
                <div className="m-roteiro-list">
                    {secoes.length === 0 && <p className="empty-list-msg">Nenhum compromisso encontrado.</p>}
                    {secoes.map((s) => {
                        const cab = dayHeaderParts(s.key);
                        return (
                            <section key={s.key} className="m-day-group" data-day={s.key}>
                                <h2 className="m-day-head">
                                    {cab.rel && <><span className="m-day-rel">{cab.rel}</span>{' · '}</>}
                                    {cab.text}
                                </h2>
                                {s.items.length > 0 ? (
                                    <div className="m-day-cards">
                                        {s.items.map((c) => (
                                            <CompromissoCard key={c.id} comp={c} onUpdate={onUpdate} onEdit={onEdit} />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="empty-list-msg">Nenhum compromisso neste dia.</p>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            <Fab icon="fa-plus" label="Novo compromisso" onClick={onNew} />

            <Sheet open={calOpen} onClose={() => setCalOpen(false)} title="Calendário" className="roteiro-cal-sheet">
                <div className="m-cal-nav">
                    <button type="button" className="btn-nav-arrow" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>
                        <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <span className="m-cal-title">{monthLabel(calMonth.y, calMonth.m)}</span>
                    <button type="button" className="btn-nav-arrow" aria-label="Próximo mês" onClick={() => mudarMes(1)}>
                        <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
                <CalendarioMes grade={grade} porDia={porDia} hoje={hoje} selected={selected} onPick={escolherNoCalendario} />
            </Sheet>
        </div>
    );
}
```

- [ ] **Step 3: CSS do calendário em sheet**

Ao **final** de `bussola_web/src/pages/Agenda/mobile/roteiro-mobile.css`, adicionar:

```css

/* =========================================================================
   CALENDÁRIO DO MÊS (Sheet aberto pelo fa-calendar-days da topbar). O Sheet é
   portal no body: as regras base das células valem via :is(.agenda-scope,
   .roteiro-cal-sheet) em ../styles.css; aqui só o que é do sheet.
   ========================================================================= */

/* O .modal-body (components.css) tem gap de 1.2rem: a navegação e a grade ficam coladas pelo padding. */
.modal-content.app-sheet.roteiro-cal-sheet > .app-sheet-body {
    gap: 0;
}

.roteiro-cal-sheet .m-cal-nav {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding-bottom: var(--sp-3);
}

.roteiro-cal-sheet .m-cal-nav .btn-nav-arrow {
    width: var(--tap-min);
    height: var(--tap-min);
    flex-shrink: 0;
    border-radius: 12px;
}

.roteiro-cal-sheet .m-cal-title {
    flex: 1;
    text-align: center;
    font-size: 1rem;
    font-weight: 600;
    color: var(--cor-texto-principal);
}

/* Os nomes dos dias são a 1ª linha da própria grade (mesmo gap das células). */
.roteiro-cal-sheet .m-cal-weekday {
    padding-bottom: var(--sp-1);
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--cor-texto-secundario);
}

.roteiro-cal-sheet .dias-grid button.dia-card {
    min-width: 0;
    font: inherit;
    color: var(--cor-texto-principal);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}

/* A linha de nomes já diz o dia da semana. */
.roteiro-cal-sheet .dias-grid .dia-card .dia-semana {
    display: none;
}

.roteiro-cal-sheet .dias-grid .dia-card .dia-numero {
    font-size: 1rem;
}

.roteiro-cal-sheet .dias-grid .dia-card.is-selected {
    background-color: var(--cor-azul-primario);
    border-color: var(--cor-azul-primario);
}

.roteiro-cal-sheet .dias-grid .dia-card.is-selected .dia-numero {
    color: #fff;
}

.roteiro-cal-sheet .dias-grid .dia-card.is-selected .compromisso-indicator:not(.no-event) {
    background-color: #fff;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/roteiro.mobile.spec.mjs` → Expected: tudo passa. Em 360px as células têm ~45px (gap de 2px do `@media (max-width: 480px)` existente); se `smallTargets` acusar < 44, **não** reduza o gutter do sheet: confira se a regra existente do gap ≤480 está valendo no sheet (`:is(.agenda-scope, .roteiro-cal-sheet) .dias-grid`).
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa.

- [ ] **Step 5: Lint e commit**

Run: `npx eslint src/pages/Agenda` → Expected: nada novo (1 erro pré-existente do `AgendaModal.jsx`, 2 warnings).

```bash
git add bussola_web/src/pages/Agenda bussola_web/e2e/roteiro.mobile.spec.mjs
git commit -m "feat(web): calendario do mes em sheet na topbar e swipe entre semanas no Roteiro" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `AgendaModal` como sheet (campos empilhados, lembrete no corpo, rodapé 50/50) e fluxos do card

**Files:**
- Modify: `bussola_web/src/pages/Agenda/components/AgendaModal.jsx` (reescrito), `bussola_web/src/pages/Agenda/index.jsx`, `bussola_web/src/pages/Agenda/mobile/roteiro-mobile.css`, `bussola_web/e2e/roteiro.mobile.spec.mjs`

**Interfaces:**
- Consumes: `BaseModal` (sheet automático no mobile), `DateTimePicker`, `useIsMobile`.
- Produces:
  - `AgendaModal({ active, closeModal, onUpdate, editingData })`: montado só enquanto aberto (o pai usa `{modalOpen && <AgendaModal key=… />}`), estado inicial vindo das props (sem `useEffect`). Overlay com `className="modal agenda-modal"`. `span.close-btn[role="button"][aria-label="Fechar"]`. Lembrete em `div.form-group-checkbox.agenda-lembrete`: no corpo no mobile, no rodapé (como hoje) no desktop.
  - No mobile: Título e Data/Hora empilhados (16px), corpo com padding 16 e gap 16, rodapé com Cancelar/Salvar 50/50 de 48px.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/roteiro.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 5 — form em sheet e ações do card
// ---------------------------------------------------------------------------
test.describe('novo compromisso e ações do card', () => {
  const form = (page) => page.locator('.modal-overlay.is-sheet.agenda-modal');
  const titulo = (page) => form(page).locator('input[placeholder="Ex: Reunião de Equipe"]');

  test('Fab abre o form em sheet: Título e Data/Hora empilhados, lembrete no corpo, rodapé 50/50', async ({ page }) => {
    await gotoApp(page, '/agenda');
    await page.getByRole('button', { name: 'Novo compromisso' }).click();
    await expect(form(page).locator('h3')).toHaveText('Novo Compromisso');
    const t = await titulo(page).boundingBox();
    const dh = await form(page).locator('.pk-datetime-wrapper').boundingBox();
    expect(dh.y).toBeGreaterThanOrEqual(t.y + t.height);
    expect(Math.round(dh.width)).toBe(Math.round(t.width));
    expect(Math.round(t.x)).toBe(16);
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
```

Run: `npm run e2e -- --project=mobile e2e/roteiro.mobile.spec.mjs`
Expected: os testes de layout do form FAIL (Data/Hora ao lado do Título, lembrete no rodapé, sem `.agenda-modal`); os de ações podem passar ou falhar só pelo seletor `.agenda-modal`.

- [ ] **Step 2: `AgendaModal.jsx`**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Agenda/components/AgendaModal.jsx` por:

```jsx
import { useState } from 'react';
import { createCompromisso, updateCompromisso } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { BaseModal } from '../../../components/BaseModal';
import { DateTimePicker } from '../../../components/Pickers';
import { useIsMobile } from '../../../hooks/useIsMobile';

// 'AAAA-MM-DDTHH:mm' local a partir do data_hora da API (mesmo formato do DateTimePicker).
function toInputValue(dataHora) {
    const d = new Date(dataHora);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Form de compromisso. O pai monta só enquanto está aberto e troca a `key` entre
 * "novo" e cada edição, então o estado inicial vem direto das props (sem effect).
 * No celular o BaseModal vira sheet: campos empilhados, lembrete no corpo e o
 * rodapé só com Cancelar/Salvar (50/50).
 */
export function AgendaModal({ active, closeModal, onUpdate, editingData }) {
    const { addToast } = useToast();
    const isMobile = useIsMobile();

    const [titulo, setTitulo] = useState(() => editingData?.titulo ?? '');
    const [dataHora, setDataHora] = useState(() => (editingData ? toInputValue(editingData.data_hora) : ''));
    const [local, setLocal] = useState(() => editingData?.local || '');
    const [descricao, setDescricao] = useState(() => editingData?.descricao || '');
    const [lembrete, setLembrete] = useState(() => !!editingData?.lembrete);

    if (!active) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { titulo, data_hora: dataHora, local, descricao, lembrete };
        
        try {
            if (editingData) {
                await updateCompromisso(editingData.id, payload);
                addToast({type:'success', title:'Atualizado', description:'Compromisso salvo.'});
            } else {
                await createCompromisso(payload);
                addToast({type:'success', title:'Criado', description:'Novo compromisso.'});
            }
            onUpdate();
            closeModal();
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao salvar.'});
        }
    };

    const campoLembrete = (
        <div className="form-group-checkbox agenda-lembrete" style={isMobile ? undefined : { marginRight: 'auto' }}>
            <input 
                type="checkbox" 
                checked={lembrete} 
                onChange={e => setLembrete(e.target.checked)} 
                id="lembrete-check" 
                style={{width:'18px', height:'18px', cursor:'pointer'}}
            />
            <label htmlFor="lembrete-check" style={{cursor:'pointer'}}>Ativar Lembrete</label>
        </div>
    );

    return (
        <BaseModal onClose={closeModal} className="modal agenda-modal">
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{editingData ? 'Editar Compromisso' : 'Novo Compromisso'}</h3>
                    <span className="close-btn" role="button" aria-label="Fechar" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group" style={{flexGrow:2}}>
                                <label>Título</label>
                                <input 
                                    className="form-input" 
                                    value={titulo} 
                                    onChange={e => setTitulo(e.target.value)} 
                                    required 
                                    placeholder="Ex: Reunião de Equipe"
                                />
                            </div>
                            <div className="form-group" style={{flexGrow:1}}>
                                <DateTimePicker
                                    label="Data e Hora"
                                    value={dataHora}
                                    onChange={e => setDataHora(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Local (Opcional)</label>
                            <input 
                                className="form-input" 
                                value={local} 
                                onChange={e => setLocal(e.target.value)} 
                                placeholder="Ex: Sala de Reunião 1 ou Google Meet"
                            />
                        </div>
                        <div className="form-group">
                            <label>Descrição (Opcional)</label>
                            <textarea 
                                className="form-input" 
                                rows="3" 
                                value={descricao} 
                                onChange={e => setDescricao(e.target.value)}
                                placeholder="Detalhes adicionais..."
                            ></textarea>
                        </div>
                        {isMobile && campoLembrete}
                    </div>
                    <div className="modal-footer">
                        {!isMobile && campoLembrete}
                        <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button type="submit" className="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
}
```

- [ ] **Step 3: `index.jsx` monta o modal só enquanto aberto**

Em `bussola_web/src/pages/Agenda/index.jsx`, o bloco abaixo aparece **duas vezes** (ramo mobile e ramo desktop); substitua as duas ocorrências (com a indentação de cada uma)

```jsx
                <AgendaModal
                    active={modalOpen}
                    closeModal={() => setModalOpen(false)}
                    onUpdate={() => fetchData(true)}
                    editingData={editingItem}
                />
```

e

```jsx
            <AgendaModal
                active={modalOpen}
                closeModal={() => setModalOpen(false)}
                onUpdate={() => fetchData(true)}
                editingData={editingItem}
            />
```

respectivamente por

```jsx
                {modalOpen && (
                    <AgendaModal
                        key={editingItem ? `editar-${editingItem.id}` : 'novo'}
                        active
                        closeModal={() => setModalOpen(false)}
                        onUpdate={() => fetchData(true)}
                        editingData={editingItem}
                    />
                )}
```

e

```jsx
            {modalOpen && (
                <AgendaModal
                    key={editingItem ? `editar-${editingItem.id}` : 'novo'}
                    active
                    closeModal={() => setModalOpen(false)}
                    onUpdate={() => fetchData(true)}
                    editingData={editingItem}
                />
            )}
```

- [ ] **Step 4: CSS do form em sheet**

Ao **final** de `bussola_web/src/pages/Agenda/mobile/roteiro-mobile.css`, adicionar:

```css

/* =========================================================================
   AGENDAMODAL COMO SHEET (≤768). O BaseModal não é portal: o overlay fica
   dentro de .agenda-scope. Rolagem, rodapé fixo e teclado vêm de
   components.css (.modal-overlay.is-sheet).
   ========================================================================= */
@media (max-width: 768px) {
    .agenda-scope .agenda-modal .modal-header {
        padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-4);
    }

    .agenda-scope .agenda-modal .close-btn {
        width: var(--tap-min);
        height: var(--tap-min);
        display: grid;
        place-items: center;
        line-height: 1;
    }

    .agenda-scope .agenda-modal .modal-body {
        padding: var(--sp-4);
        gap: var(--sp-4);
    }

    /* Título e Data/Hora empilhados (lado a lado, o DateTimePicker ficava espremido). */
    .agenda-scope .agenda-modal .form-row {
        flex-direction: column;
        gap: var(--sp-4);
    }

    .agenda-scope .agenda-modal .agenda-lembrete {
        min-height: var(--tap-min);
        gap: var(--sp-3);
    }

    .agenda-scope .agenda-modal .agenda-lembrete label {
        flex: 1;
        min-height: var(--tap-min);
        display: flex;
        align-items: center;
        font-size: 0.95rem;
        color: var(--cor-texto-principal);
    }

    .agenda-scope .agenda-modal .modal-footer {
        padding: var(--sp-3) var(--sp-4);
        gap: var(--sp-2);
    }

    .agenda-scope .agenda-modal .modal-footer > button {
        flex: 1 1 0;
        min-width: 0;
        min-height: 48px;
    }
}
```

(O `padding-bottom` do rodapé continua vindo do `!important` de `components.css`, com a safe-area.)

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/roteiro.mobile.spec.mjs` → Expected: tudo passa.
Run: `npm run e2e -- --project=mobile` → Expected: tudo passa (`modais-reais`, `pickers`, `ui-lab`).
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa; em especial `modal-compromisso.png` e `agenda-editar.png` idênticos (no desktop o lembrete continua no rodapé, à esquerda).

- [ ] **Step 6: Lint e commit**

Run: `npx eslint src/pages/Agenda` → Expected: **0 erros** (o `set-state-in-effect` do `AgendaModal.jsx` saiu) e 2 warnings `exhaustive-deps` pré-existentes do `index.jsx`.

```bash
git add bussola_web/src/pages/Agenda bussola_web/e2e/roteiro.mobile.spec.mjs
git commit -m "feat(web): AgendaModal como sheet no celular (campos empilhados, lembrete no corpo, rodape 50/50)" -m "Modal montado so enquanto aberto (estado inicial pelas props, sem effect): lint da Agenda 4 -> 0 erros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tablet (769–1024), tooltip só com mouse (e correto com body travado) e verificação final

**Files:**
- Create: `bussola_web/e2e/roteiro.tablet.spec.mjs`
- Modify: `bussola_web/src/pages/Agenda/styles.css`, `bussola_web/src/pages/Agenda/index.jsx`, `bussola_web/src/pages/Agenda/mobile/roteiro-mobile.css`, `bussola_web/src/assets/styles/components.css`, `bussola_web/e2e/roteiro.desktop.spec.mjs`, `bussola_web/e2e/roteiro.mobile.spec.mjs`

**Interfaces:**
- Consumes: `smallTargets`, `overflowOffenders`.
- Produces: no tablet, cards em 1 coluna dentro da coluna da lista (spec §6), cabeçalho da lista que quebra linha, dia da semana abaixo da data no card estreito, editar/excluir visíveis sem hover e controles de 44px no toque; tooltip do dia só quando `(hover: hover)`, com `position: fixed` e coordenadas de viewport (certo com o body travado pelo `scrollLock`); `.modal-content` com `max-height: 90dvh` (fallback `90vh`).

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/roteiro.tablet.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';

const cardsAbertos = (page) => page.locator('.accordion-wrapper.open .compromisso-card-modern');

for (const w of [900, 1024]) {
  test(`tablet ${w}px: 2 colunas sem overflow, cards em 1 coluna, cabeçalho dentro da coluna`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/agenda');
    await expect(page.locator('.agenda-layout')).toBeVisible();
    await expect(page.locator('.m-roteiro')).toHaveCount(0);
    expect(await overflowOffenders(page)).toEqual([]);
    const xs = await cardsAbertos(page).evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().x)))]);
    expect(xs).toHaveLength(1);
    const cab = await page.locator('.column-header-flex.header-left-aligned').boundingBox();
    const add = await page.getByRole('button', { name: 'Adicionar' }).boundingBox();
    expect(add.x + add.width).toBeLessThanOrEqual(cab.x + cab.width);
  });
}

test('tablet: editar/excluir visíveis sem hover e controles com 44px', async ({ page }) => {
  await gotoApp(page, '/agenda');
  const card = cardsAbertos(page).first();
  expect(await card.locator('.top-actions').evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  expect(await smallTargets(page, '.agenda-scope .agenda-layout')).toEqual([]);
});

test('tablet: tocar num dia do calendário não abre tooltip', async ({ page }) => {
  await gotoApp(page, '/agenda');
  await page.locator('.dias-grid .dia-card.has-compromissos').first().tap();
  await page.waitForTimeout(300);
  await expect(page.locator('.agenda-scope .tooltip.visible')).toHaveCount(0);
});

test('tablet: dia da semana abaixo da data no card estreito', async ({ page }) => {
  await gotoApp(page, '/agenda');
  const card = cardsAbertos(page).first();
  const data = await card.locator('.date-big').boundingBox();
  const dia = await card.locator('.weekday-inline').boundingBox();
  expect(dia.y).toBeGreaterThanOrEqual(data.y + data.height - 1);
  const acoes = await card.locator('.top-actions').boundingBox();
  const caixa = await card.boundingBox();
  expect(acoes.x + acoes.width).toBeLessThanOrEqual(caixa.x + caixa.width);
});
```

Em `bussola_web/e2e/roteiro.desktop.spec.mjs`, adicionar ao final:

```js
test('desktop roteiro: tooltip acompanha o dia mesmo com o body travado (scrollLock)', async ({ page }) => {
  await gotoApp(page, '/agenda');
  await page.evaluate(() => window.scrollTo(0, 120));
  // mesmo estado que o lockScroll deixa: body fixo deslocado pelo scroll
  await page.evaluate(() => {
    const y = window.scrollY;
    Object.assign(document.body.style, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', width: '100%' });
  });
  const dia = page.locator('.dias-grid .dia-card.has-compromissos').first();
  await dia.hover();
  const tip = page.locator('.tooltip.visible');
  await expect(tip).toBeVisible();
  const d = await dia.boundingBox();
  const t = await tip.boundingBox();
  expect(t.y).toBeGreaterThanOrEqual(d.y);
  expect(t.y).toBeLessThanOrEqual(d.y + d.height + 6);
  expect(t.x).toBeGreaterThanOrEqual(0);
});
```

Run: `npm run e2e -- --project=tablet e2e/roteiro.tablet.spec.mjs` → Expected: FAIL (cards em 2 colunas, ações com `opacity: 0`, botões de 32px, cabeçalho estourando, tooltip aparece no toque).
Run: `npm run e2e -- --project=desktop e2e/roteiro.desktop.spec.mjs` → Expected: o teste do body travado FAIL (o tooltip sai 120px acima); os demais passam.

- [ ] **Step 2: Tooltip só com mouse e em coordenadas de viewport**

Em `bussola_web/src/pages/Agenda/index.jsx`, substituir

```jsx
    // [OPTIMIZATION] Handlers de Hover otimizados
    const handleDayHover = useCallback((e, compromissos) => {
        if (!compromissos || compromissos.length === 0) return;
        const rect = e.target.getBoundingClientRect();
        setTooltip({
            visible: true,
            x: rect.right + window.scrollX - 280,
            y: rect.bottom + window.scrollY + 5,
            compromissos
        });
    }, []);
```

por

```jsx
    // [OPTIMIZATION] Handlers de Hover otimizados
    // Tooltip do dia só com mouse: no toque (tablet) a lista já mostra os compromissos.
    // Coordenadas de viewport + `position: fixed` (styles.css): não dependem do scroll nem
    // do body travado pelo scrollLock (que deixa o body em `position: fixed`).
    const handleDayHover = useCallback((e, compromissos) => {
        if (!compromissos || compromissos.length === 0) return;
        if (!window.matchMedia('(hover: hover)').matches) return;
        const rect = e.target.getBoundingClientRect();
        setTooltip({
            visible: true,
            x: Math.max(8, rect.right - 280),
            y: rect.bottom + 5,
            compromissos
        });
    }, []);
```

Em `bussola_web/src/pages/Agenda/styles.css`, no bloco `.agenda-scope .tooltip {`, substituir a linha `    position: absolute;` por `    position: fixed;`.

(Sem scroll horizontal e com a janela no topo, `fixed` + coordenadas de viewport dá a mesma posição de antes: `agenda-tooltip.png` não muda.)

- [ ] **Step 3: Tablet e toque (`styles.css`)**

Ao **final** de `bussola_web/src/pages/Agenda/styles.css` (depois do bloco LEGADO), adicionar:

```css

/* ============================================= */
/* 11. TABLET (769–1024) E TOQUE                 */
/* ============================================= */

@media (min-width: 769px) and (max-width: 1024px) {
    /* spec §6: grid de cards com 1 coluna dentro da coluna da lista */
    .agenda-scope .compromissos-grid {
        grid-template-columns: 1fr;
    }

    .agenda-scope .compromissos-grid>.compromisso-card-modern:last-child:nth-child(odd) {
        grid-column: auto;
    }

    /* Cabeçalho da lista quebra linha: "Compromissos" em cima, busca + ordenar + Adicionar embaixo */
    .agenda-scope .agenda-layout .column-header-flex.header-left-aligned {
        flex-wrap: wrap;
        gap: var(--sp-2);
    }

    .agenda-scope .header-left-aligned .header-actions-group {
        flex: 1 1 100%;
        min-width: 0;
        gap: var(--sp-2);
    }

    .agenda-scope .header-left-aligned .header-search-wrapper {
        flex: 1 1 auto;
        min-width: 0;
    }

    .agenda-scope .header-left-aligned .header-search-input,
    .agenda-scope .header-left-aligned .header-search-input:focus {
        width: 100%;
    }
}

/* Sem mouse: editar/excluir sempre visíveis (no celular já valia pelo @media 768). */
@media (hover: none), (pointer: coarse) {
    .agenda-scope .top-actions {
        opacity: 1;
    }
}

/* Toque: alvos de 44px nos controles da página (o .btn-action-icon já tem min 44 em tokens.css). */
@media (pointer: coarse) {
    .agenda-scope .btn-filter-sort,
    :is(.agenda-scope, .roteiro-cal-sheet) .btn-nav-arrow {
        width: var(--tap-min);
        height: var(--tap-min);
    }

    .agenda-scope .small-btn {
        height: var(--tap-min);
        min-height: var(--tap-min);
    }

    .agenda-scope .header-search-input {
        height: var(--tap-min) !important;
    }

    .agenda-scope .btn-concluir-action,
    .agenda-scope .btn-cancelar-action,
    .agenda-scope .month-header {
        min-height: var(--tap-min);
    }
}
```

- [ ] **Step 4: Dia da semana abaixo da data também no card estreito do tablet**

Em `bussola_web/src/pages/Agenda/mobile/roteiro-mobile.css`, substituir

```css
/* Celular pequeno: o dia da semana do cabeçalho do card desce para baixo da data. */
@media (max-width: 480px) {
```

por

```css
/* Celular pequeno e tablet (card de ~300px na coluna da lista): o dia da semana do
   cabeçalho do card desce para baixo da data. */
@media (max-width: 480px), (min-width: 769px) and (max-width: 1024px) {
```

- [ ] **Step 5: `dvh` no modal centralizado**

Em `bussola_web/src/assets/styles/components.css`, no bloco `.modal-content {` do topo, substituir

```css
    max-height: 90vh;
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

por

```css
    max-height: 90vh;
    max-height: 90dvh; /* barra do navegador no tablet; no desktop é igual a 90vh */
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

- [ ] **Step 6: Capturas para a conferência visual**

Ao final de `bussola_web/e2e/roteiro.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Conferência visual (só com ROTEIRO_SHOTS=1): lista, calendário e form em 360/390/430
// ---------------------------------------------------------------------------
test('capturas para conferência visual', async ({ page }) => {
  test.skip(!process.env.ROTEIRO_SHOTS, 'só na conferência visual (ROTEIRO_SHOTS=1)');
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
```

- [ ] **Step 7: Rodar os testes**

Run: `npm run e2e -- --project=tablet` → Expected: `roteiro.tablet.spec.mjs` (5) e as demais specs de tablet passam. Se `overflowOffenders` listar algo do cabeçalho da página ou do `AiAssistant`, corrija o CSS do elemento listado sob `.agenda-scope` (sem `overflow: hidden`).
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa, incluindo `agenda-tooltip.png` idêntico e o teste do body travado.
Run: `npm run e2e -- --project=mobile` → Expected: tudo passa (a captura fica `skipped`).

- [ ] **Step 8: Suíte completa, build e lint**

Run: `npm run e2e` → Expected: tudo passa nos 3 projetos.
Run: `npm run e2e -- --project=desktop` mais uma vez, depois do `afterAll` do mobile → Expected: tudo passa (prova que os compromissos `E2E ` foram removidos).
Run: `npm run build` → Expected: OK.
Run: `npx eslint src/pages/Agenda src/assets/styles` → Expected: 0 erros, 2 warnings pré-existentes.
Run: `npm run lint 2>&1 | Select-String " error " | Measure-Object` → Expected: contagem ≤ à de antes do plano menos 4 (registre os dois números no commit).

- [ ] **Step 9: Conferência visual (360, 390, 430) — olhar os screenshots**

Run (PowerShell): `$env:ROTEIRO_SHOTS = '1'; npm run e2e -- --project=mobile e2e/roteiro.mobile.spec.mjs -g "capturas"; Remove-Item Env:ROTEIRO_SHOTS`
Abra (Read) os 12 PNGs de `bussola_web/test-results/roteiro-*.png` e confira contra o mockup aprovado ("Faixa da semana") e a regra de espaçamento:
- topbar "Roteiro" com `fa-calendar-days`, robô e avatar; nada cortado;
- faixa: 7 células iguais, 8px entre elas, alinhadas no gutter de 16px; hoje com borda azul, selecionado preenchido; ponto visível nos dias com compromisso; ‹ título › centralizado;
- 16px entre faixa, busca e lista; busca e ordenar na mesma linha, ambos com 44px;
- cabeçalho "Hoje · Sex, 2 de outubro" com "Hoje" em azul; 8px até o selo do primeiro card; 24px entre dias;
- cards: selo + tag de status iguais ao desktop; **12px livres** entre o fim de um card e o selo do próximo; 8px entre data, título, local e descrição; editar/excluir visíveis à direita; em 360 o dia da semana embaixo da data; Cancelar/Concluir/Reabrir sem quebrar feio;
- o último card não fica sob o Fab; calendário: grade inteira visível, nomes dos dias na 1ª linha, dia selecionado preenchido;
- form: Título e Data/Hora empilhados, lembrete no corpo, Cancelar/Salvar 50/50 no rodapé.
Corrija o que destoar só com tokens e rode o Step 8 de novo.

- [ ] **Step 10: Commit**

```bash
git add bussola_web/src bussola_web/e2e
git commit -m "feat(web): Roteiro no tablet (cards em 1 coluna, acoes sem hover), tooltip so com mouse e verificacao final" -m "lint: <antes> -> <depois> erros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Decisões e suposições registradas neste plano

1. **`.main-container` e `.btn-action-icon` não foram presos em `.agenda-scope`, e sim movidos (iguais, com `!important`) para `layout.css`/`components.css`.** Hoje eles valem para o app inteiro: Home e Estudos dependem do `padding-bottom`/`min-height`, e Navbar, Cofre, Metas, Registros e UserDrawer renderizam o botão de ícone com 32px, borda e raio 6 vindos do `!important` do Agenda. Prender no Roteiro mudaria o desktop de ~10 componentes. É a "definição única" da spec §4.3; cada página tira o `!important` no seu plano. Alternativa (se o controlador preferir): escopar e copiar as declarações para o escopo de cada consumidor.
2. **Regras com nome de classe compartilhado ficam sem escopo num bloco LEGADO** no fim de `Agenda/styles.css` (`.agenda-column*`, `.empty-list-msg`, `.header-actions-group`, `.header-search-*`, `.small-btn` e o `@media 768` de `.agenda-column`/`.column-header-flex`), porque Finanças, Registros e Ritmo dependem delas. Elas não ganham cópia com escopo: isso mudaria o empate com `.btn-primary` no "Adicionar".
3. **Prova de "nada mudou fora do Roteiro"** é uma impressão digital de estilos computados (`e2e/cssFingerprint.mjs`, fixtures em `e2e/fixtures/`), que só roda com `CSS_ESCOPO=gravar|comparar` e não roda por padrão (as páginas mudam nos planos seguintes).
4. **Ordenação no celular:** `asc` (padrão) = dia selecionado e os **próximos** dias; `desc` = dia selecionado e os **anteriores**, do mais recente ao mais antigo. Mesmo botão e ícones do desktop; `aria-label` "Mostrar dias anteriores"/"Mostrar próximos dias".
5. **Busca no celular** procura em todas as datas (título ou local, como o desktop) e mostra só os dias que casam, sem o dia selecionado vazio.
6. **‹ › e swipe** movem a seleção ±7 dias (mesmo dia da semana), então a faixa sempre contém o dia selecionado. Limiar do swipe: 48px na horizontal, maior que o deslocamento vertical.
7. **Calendário em sheet:** título "Calendário", ‹ mês › no corpo (padrão do calendário do desktop) e uma linha com os nomes dos dias (no ≤480 o `.dia-semana` das células já some hoje). Abre no mês do dia selecionado ("mês atual" na primeira abertura). É montado no cliente com a lista completa (a API já devolve tudo), sem nova chamada por mês, e "hoje" vem do relógio do aparelho, não do `is_today` do backend.
8. **"12px entre cards"** é medido como espaço livre entre o fim de um card e o topo visível do selo flutuante do próximo (o selo sobe 22px + anel de 4px). O `gap` real é `12px + --selo-saliencia` (26px). Com `gap: 12px` puro o selo invadiria o card de cima (o próprio CSS do desktop avisa isso).
9. **Dia da semana abaixo da data** vale em ≤480 (pedido) **e no tablet**, onde o card fica com ~300px na coluna da lista e o cabeçalho não cabe.
10. **Lista mostra todos os próximos dias** com compromisso, sem limite nem "carregar mais" (o volume real é de dezenas).
11. **Fab "Novo compromisso" não pré-preenche** a data com o dia selecionado (o form continua igual ao do desktop).
12. **`AgendaModal` montado só enquanto aberto** (com `key`), com estado inicial pelas props: remove o `set-state-in-effect` e não muda o desktop. Trocar a janela entre celular e desktop com o modal aberto remonta o form (perde o que foi digitado), caso raro aceito.
13. **Tooltip do dia:** sai do celular (não é renderizado) e do tablet (`hover: none`); a informação já está na lista. No desktop passa a `position: fixed` com coordenadas de viewport (corrige o deslocamento com o body travado) e mantém `e.target` (o mesmo cálculo de antes) para `agenda-tooltip.png` não mudar.
14. **`.close-btn` do `AgendaModal`** continua `span` (não muda o desktop), com `role="button"`/`aria-label="Fechar"` e 44px no celular.
15. **Faixa da semana:** botão de 1/7 da faixa (48px em 360) com o `.dia-card` visual dentro (8px entre células), faixa recuada 4px para alinhar no gutter; células com 56px de altura e ponto de 8px. "Hoje" usa o `.today` existente; o selecionado é preenchido de azul.
16. **Hover:** os efeitos de "levantar" do card e da célula do calendário passam a valer só com `(hover: hover) and (pointer: fine)` (no toque o `:hover` grudava).
17. **`max-height: 90dvh`** entra no `.modal-content` de `components.css` (todos os modais centralizados; no desktop é igual a `90vh`).
18. **Status `Pendente`/`Perdido`** depende do relógio real do servidor; os testes não o afirmam. Os PNGs do desktop (inclusive os 4 novos) dependem da data real do dia da geração, como `agenda.png` já depende.

## Rulings do controlador (vinculantes)

1. `.main-container` e `.btn-action-icon` **movidos sem mudança** (inclusive `!important`) para `layout.css`/`components.css` em vez de escopados: **aceito** — preserva o desktop; registrar como dívida de CSS.
2. Bloco "LEGADO" com regras compartilhadas não escopadas no fim de `Agenda/styles.css`: **aceito**.
3. "12px entre cards" = 12px livres até o selo do próximo card (12 + 26 do selo): **aceito**.
4–7. Ordenação asc/desc a partir do dia selecionado, busca em todas as datas, ‹ › e swipe = ±7 dias, sheet do calendário construído no cliente e "hoje" pelo relógio do dispositivo, dia da semana abaixo da data em ≤480 e no tablet: **aceitos**.
8. Fab: **ajuste** — se o dia selecionado não for hoje, o novo compromisso abre com a data do dia selecionado pré-preenchida (hora atual arredondada como hoje); hoje → comportamento atual. Se o `AgendaModal` não aceitar data inicial de forma simples, adicionar uma prop opcional `initialDate` (sem mudar o desktop). Lista sem limite de dias: aceito.
9. Tooltip só com mouse, `position: fixed`, mantendo `e.target`: **aceito**.
10. Testes sem asserção de Pendente/Perdido; base desktop dependente da data de geração (já é assim): **aceito**.
