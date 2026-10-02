# Mobile 03: Registros (Caderno, editor de nota, Tarefas, Jornada), plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a página Registros (`/registros`) para o celular no layout aprovado (tela 3, kanban "uma coluna por vez"): abas segmentadas Caderno · Tarefas · Jornada de largura total, cada aba com uma barra fina e um `<Fab>`; Caderno com busca, chips de grupo, sheet de gestão de grupos e "⋯" no card atual de nota; editor de nota em tela cheia com barra de formatação presa acima do teclado; Tarefas com chips de status, uma coluna por vez com swipe (scroll-snap), quick-add no topo, "⋯" no card do board, filtros em sheet e arraste só com toque longo; detalhe da tarefa em tela cheia; Jornada com a linha "data · X de Y hábitos", check-in de 44px+ e "⋯" no lugar do hover. Tablet ganha os ajustes da spec §6. Desktop (≥1025) fica idêntico.

**Architecture:**
- `Registros/index.jsx` continua dono do estado (dados, aba, filtros do Caderno, modais). No celular (`useIsMobile()`) ele troca **só** o cabeçalho de abas (`.registros-main-header`) por `<Segmented>` + a barra da aba (`CadernoToolbar`, `JornadaResumo`) e renderiza o `<Fab>` da aba ativa. O conteúdo (acordeões, `TarefaBoard`, `JornadaTimeline`) é o mesmo do desktop; o CSS mobile reorganiza.
- Componentes com ação só no hover ganham um "⋯" **apenas quando `isMobile`** (`AnotacaoCard`, `BoardCard` via prop `onMenu`, `HabitoCard`), sempre com o `<ActionSheet>` renderizado como **irmão** do elemento clicável. No desktop o markup não muda.
- `TarefaBoard` troca `PointerSensor` por `MouseSensor` + `TouchSensor` (toque longo) e, no celular, renderiza `BoardMobileBar` (chips de status + filtros), `BoardFiltroSheet` e `BoardCardActions`; o `.kb-board` vira um carrossel scroll-snap com uma coluna por tela.
- Modais: `AnotacaoModal`, `ViewAnotacaoModal` e `TarefaDetailPanel` passam `sheet="full"` ao `BaseModal` (só afeta o celular). O editor de nota no celular tem barra superior própria e a toolbar de formatação reordenada (CSS `order`) para o rodapé do sheet cheio, que já respeita `--vvh`/`--kb-inset`.
- Todo o CSS novo fica em `Registros/styles/registros-mobile.css` (importado por último entre os CSS da página). Efeitos de hover que "grudam" no toque passam para `@media (hover: hover) and (pointer: fine)` (no desktop nada muda).
- Testes: Playwright (`registros.mobile.spec.mjs`, `registros.tablet.spec.mjs`, `registros.desktop.spec.mjs`) com dados `E2E ` criados/limpos pela API (`e2e/registros-data.mjs`). Funções puras testadas pelo próprio Vite (`page.evaluate(() => import('/src/...'))`).

**Tech Stack:** React 19, Vite 7, CSS puro, Font Awesome (npm), `@dnd-kit/core` + `@dnd-kit/sortable`, `@playwright/test` 1.63.

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-responsivo-design.md` (§2 restrições, §4 fundação, §5.2 Registros, §6 tablet, §8 verificação). Este plano é a etapa 5 da §7.
**Planos anteriores:** `2026-10-02-mobile-01-fundacao-shell.md` (harness, tokens, `Sheet`/`ActionSheet`/`Fab`/`TopbarActions`, shell; implementado) e `2026-10-02-mobile-02-provisoes.md` (cria `Segmented` e os helpers `authHeaders`/`apiJson`/`smallTargets`; **executado antes deste**). Este plano **reusa** esses artefatos e não os recria.

## Global Constraints

- **Branch:** `feat/mobile-responsivo` (worktree `.claude/worktrees/mobile-responsivo`). Um commit por task. **Nunca** fazer push, merge ou `git stash`.
- **Commits** terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use um segundo `-m`).
- **Não redesenhar cards existentes:** `AnotacaoCard` (selo flutuante `.selo-badge`, título, data, prévia, rodapé com o alfinete), `BoardCard` (barra de prioridade, chips de prazo/etapas, progresso), `HabitoCard` da Jornada (trilho + círculo + streak + badges). Só espaçamento, tamanho, quebra de linha, alvo de toque e ações visíveis.
- **Ícones:** só classes Font Awesome que já existem no código. Usadas neste plano: `fa-solid fa-ellipsis` (o "⋯", já usado no "Mais" da `BottomNav`), `fa-regular fa-folder-open`, `fa-solid fa-magnifying-glass`, `fa-solid fa-plus`, `fa-solid fa-pen-to-square`, `fa-solid fa-trash-can`, `fa-solid fa-thumbtack`, `fa-solid fa-note-sticky`, `fa-solid fa-xmark`, `fa-solid fa-eye`, `fa-solid fa-pen`, `fa-solid fa-chevron-down`, `fa-solid fa-check`, `fa-brands fa-markdown`, `fa-regular fa-copy`, `fa-solid fa-download`, `fa-solid fa-sliders`, `fa-solid fa-arrow-right`, `fa-solid fa-list-check`, `fa-solid fa-list-ul`, `fa-solid fa-pause`, `fa-solid fa-play`, `fa-solid fa-route`.
- **Espaçamento (tokens `--sp-1..6` = 4/8/12/16/24/32):** 8 entre elementos relacionados dentro de um card, 12 entre cards, 16 de gutter e entre blocos da página, 24 entre seções (acordeões de grupo). Nenhum valor de espaçamento solto no CSS novo, exceto tamanhos de controle (36/44/48/52/56px) e dimensões de pontos/badges (8/10/18px) que não são espaçamento.
- **Toque:** alvo ≥ 44×44 em tudo que é interativo (única exceção aprovada: os botões de 40px da barra de formatação do editor); inputs com 16px (já garantido por `tokens.css`); nenhuma ação só no hover.
- **Tipografia mobile:** conteúdo principal ≥ 14px, secundário ≥ 12px, 11px só em rótulos em caixa alta/badges.
- **Desktop (≥1025):** visualmente idêntico. Os PNGs de `e2e/desktop-visual.desktop.spec.mjs-snapshots/` (inclui `registros.png` e `modal-nota.png`), os de `provisoes.desktop.spec.mjs-snapshots/` (plano 02) e os 9 novos de `registros.desktop.spec.mjs-snapshots/` (Task 1) têm que continuar passando em toda task. Tablet (769–1024) pode mudar conforme a spec §6.
- **Sem mudança de API/backend.** Reusar `services/api.ts` (`getRegistrosDashboard`, `deleteGrupo`, `createGrupo`, `updateGrupo`, `createAnotacao`, `updateAnotacao`, `deleteAnotacao`, `toggleFixarAnotacao`, `exportAnotacaoPdf`, `getTarefasBoard`, `reordenarTarefas`, `createTarefa`, `updateTarefa`, `deleteTarefa`, `toggleCheckinHabito`, `toggleStatusHabito`, `deleteHabito`, `createHabito`, `updateHabito`) e os handlers existentes.
- **Dados de teste:** tudo que os testes criam começa com `E2E ` (notas, grupos, tarefas, hábitos) e é removido via API (`limparRegistrosE2E`) no `beforeAll`/`afterAll` de cada arquivo. Nenhum teste altera dado do seed (fixar, mover, reordenar ou fazer check-in só em itens `E2E `). Sobra de dados quebra `registros.png` e as bases novas.
- **Lint:** `npx eslint src/pages/Registros` sem **novos** erros. Linha de base medida em 2026-10-02: **4 erros, 5 warnings** (`AnotacaoModal.jsx` `no-useless-escape` na linha 24; `MarkdownViewer.jsx` 3× `no-unused-vars`; 5 `exhaustive-deps`). Regras v7: sem `setState` síncrono em `useEffect` (use "prev key" no render), sem mutar acumuladores no render, `catch {` sem variável. Não reestruture os `useEffect` existentes dos modais (eles hoje não acusam erro).
- **Build:** `npm run build` passa.

## API real dos primitivos (lida do código, use exatamente isto)

- `useIsMobile()` / `useIsTablet()` de `src/hooks/useIsMobile.js` (≤768 / 769–1024), via `useSyncExternalStore`.
- `BaseModal({ children, onClose, className, sheet = 'auto' })`: **não é portal**. No mobile põe `is-sheet` (e `is-sheet-full` com `sheet="full"`) no `.modal-overlay`; no desktop `sheet` não tem efeito. ESC e clique no overlay chamam `onClose`. Trava de scroll com contador.
- `Sheet({ open, onClose, title, ariaLabel, children, footer, full, className })`: **portal no `document.body`** (não herda `.registros-scope`; por isso as classes usadas dentro de sheets têm prefixo `.reg-` e **não** são escopadas). `null` se `!open`. Cabeçalho (h3 + `button.app-sheet-close[aria-label="Fechar"]`) só com `title`. Corpo `.modal-body.app-sheet-body`, rodapé `.modal-footer.app-sheet-footer` (filhos `flex:1; min-height:48px`). `className` vai no `.modal-content.app-sheet`.
- `ActionSheet({ open, onClose, title, subtitle, icon, actions })`: `actions: [{ key, icon /* classe FA completa */, label, onClick, variant?: 'primary'|'danger' }]`; chama `onClose()` e depois `onClick()` (sem argumentos); acrescenta a linha "Cancelar". Itens: `button.action-sheet-item(.is-primary|.is-danger)`. Raiz `.modal-content.app-sheet.action-sheet`.
- `Fab({ icon = 'fa-plus', label, onClick })`: portal no `body`, `button.app-fab[aria-label]`, visível só ≤768.
- `TopbarActions({ children })` (`src/components/mobile/MobileChrome.jsx`): portal dos filhos em `.m-topbar-slot` (botões filhos diretos já ganham 44×44 em `mobile.css`). Retorna `null` sem slot.
- `Segmented({ options: Array<{ value, label, icon? }>, value, onChange, label, className })` (plano 02, `src/components/mobile/Segmented.jsx`): `div.m-segmented[role="tablist"][aria-label]` com `button.m-segmented-item[role="tab"][aria-selected]`.
- Helpers E2E (plano 02, `e2e/helpers.mjs`): `gotoApp(page, path)` (relógio fixo **sexta 2026-10-02 12:00 -03:00**), `overflowOffenders(page)` (ignora `[data-offscreen-ok]`), `authHeaders()`, `apiJson(request, method, path, data?)`, `smallTargets(page, rootSelector)` (button, a[href], select, `[role=button]`, `[role=tab]`, inputs; < 43.5px).
- **Ordem de empilhamento:** `BaseModal` no celular usa `z-index: var(--z-sheet)` (300) e fica dentro da árvore da página; `Sheet` usa o mesmo z-index mas vem **depois no DOM** (portal) e portanto fica por cima. Consequência: um `BaseModal` aberto a partir de um `Sheet` ficaria **atrás** dele: feche o sheet antes de abrir o modal. `ConfirmDialog` no celular usa `--z-toast` (500) e fica por cima de tudo.
- Sheets cheios (`.is-sheet-full > .modal-content`) têm `height/max-height: var(--vvh)` e `margin-bottom: var(--kb-inset)`: o último filho do conteúdo fica logo acima do teclado. Simular teclado no teste: `--vvh: 420px; --kb-inset: 424px` no `documentElement`.
- **Ordem do CSS** (`main.jsx`): `tokens.css` → CSS das páginas (os de Registros: `styles.css`, `styles/markdown.css`, `styles/kanban.css` e, por último, o novo `styles/registros-mobile.css`) → `mobile.css` → `components.css` → `global.css`. Consequências: mesma especificidade que `styles.css` basta para vencê-lo; para vencer `.app-sheet > …` (0,2,0) use 3 classes; para vencer as regras de sheet de `components.css` com `!important` (até (0,4,1)) use `!important` com `.registros-scope.modal-overlay.is-sheet > …` (o `BaseModal` da página recebe `className="registros-scope"`).
- Projetos Playwright por sufixo: `*.mobile.spec.mjs` (390×844, touch, `pointer: coarse`, `hover: none`), `*.tablet.spec.mjs` (900×1200, touch), `*.desktop.spec.mjs` (1280×900, mouse).
- Banco demo (`populate_db.py`): grupos Pessoal, Trabalho, Estudos, Ideias, Projetos, Saúde; 30 notas em **HTML** (~10% fixadas) espalhadas nos grupos; 33 tarefas, todas `Pendente` (A Fazer), as outras 4 colunas vazias; hábitos Meditação Diária 07:00, Leitura Técnica 21:30, Alongamento 08:30 (todos os dias) e Trabalhar no Side Project 19:00 (ter/qui/sab/dom), com histórico dos 21 dias anteriores à criação do banco. Na sexta do relógio fixo ocorrem 3 hábitos. Atenção: `registro_hoje` e `streak` são calculados pelo servidor com a data **real**; testes não dependem deles (usam a resposta do PATCH de check-in) e a base visual da Jornada mascara `.jk-streak`.

## Review Focus

1. **O arraste sequestrar a rolagem ou reordenar sem querer no toque** (troca de sensores). Teste na Task 4 › "arrastar só com toque longo: gesto rápido não arrasta; 350ms parado arrasta" e, para o mouse, Task 1 › "desktop: arrastar um card com o mouse muda a coluna".
2. **Tocar no "⋯" disparar também o clique do card** (abrir a visualização/detalhe) ou iniciar arraste. Testes na Task 2 › "card de nota: ⋯ visível com Editar / Fixar / Excluir" (sem `.view-modal`) e Task 4 › "card do board: ⋯ abre Abrir / Mover para… / Excluir" (sem overlay do detalhe).
3. **Ação principal escondida pelo teclado** (Salvar e barra de formatação do editor; Criar Hábito; Salvar da tarefa e do grupo). Testes na Task 3 › "editor com teclado (--vvh 420)…", Task 5 › "detalhe com teclado…", Task 6 › "Novo hábito: sheet rola, rodapé fixo…" e Task 2 › "Novo grupo com teclado: Salvar visível".
4. **Modal aberto por trás de um sheet** (GrupoModal a partir do sheet "Grupos"; sheet "Mover para…" a partir do ActionSheet). Testes na Task 2 › "chip Grupos abre a gestão…; criar e excluir um grupo" e Task 4 › "card do board: ⋯ … mover e excluir".
5. **Regressão no desktop pelos componentes compartilhados** (`AnotacaoCard`, `AnotacaoModal`, `BoardCard`/`BoardColumn`/`TarefaBoard`, `TarefaDetailPanel`, `GrupoModal`, `HabitoModal`, `JornadaTimeline`, gates de hover). Teste na Task 1 › `registros.desktop.spec.mjs` (9 bases visuais + "ações só no hover" + arraste com mouse) rodado em toda task com `--project=desktop`.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `bussola_web/e2e/registros-data.mjs` | criar | `comApi`, `limparRegistrosE2E`, `criarNota/Tarefa/Habito`, buscas por título/nome |
| `bussola_web/e2e/registros.desktop.spec.mjs` | criar | 9 bases visuais, ações só no hover, arraste com mouse |
| `bussola_web/e2e/registros.mobile.spec.mjs` | criar | lógica pura, casca, Caderno, editor, Tarefas, detalhe, Jornada, capturas |
| `bussola_web/e2e/registros.tablet.spec.mjs` | criar | sem overflow, cabeçalho que quebra, ações visíveis sem hover, alvos |
| `bussola_web/src/pages/Registros/jornadaUtils.js` | criar | `getTodayKey`, `contarHabitosHoje`, `calcularProgressoJornada`, `formatarDataJornada` |
| `bussola_web/src/pages/Registros/index.jsx` | modificar | usa `jornadaUtils`; no celular: `Segmented`, barras das abas, `Fab`, `TopbarActions`, `GruposSheet` |
| `bussola_web/src/pages/Registros/mobile/CadernoToolbar.jsx` | criar | busca de largura total + chips de grupo + chip "Grupos" |
| `bussola_web/src/pages/Registros/mobile/GruposSheet.jsx` | criar | gestão de grupos (editar/excluir de 44px, "Novo grupo") |
| `bussola_web/src/pages/Registros/mobile/GrupoPickerSheet.jsx` | criar | escolha do grupo da nota no editor |
| `bussola_web/src/pages/Registros/mobile/JornadaResumo.jsx` | criar | "data · X de Y hábitos" + barra de progresso |
| `bussola_web/src/pages/Registros/components/AnotacaoCard.jsx` | modificar | "⋯" + `ActionSheet` no celular |
| `bussola_web/src/pages/Registros/components/AnotacaoModal.jsx` | modificar | `sheet="full"`, barra superior mobile, grupo em chip/sheet, aria-labels da toolbar |
| `bussola_web/src/pages/Registros/components/ViewAnotacaoModal.jsx` | modificar | `sheet="full"`, copiar/PDF num "⋯", toast de cópia |
| `bussola_web/src/pages/Registros/components/GrupoModal.jsx` | modificar | cores inline de 44px no celular, sem autofocus |
| `bussola_web/src/pages/Registros/components/HabitoModal.jsx` | modificar | sem autofocus no celular, classes para o CSS mobile |
| `bussola_web/src/pages/Registros/components/JornadaTimeline.jsx` | modificar | "⋯" + `ActionSheet` no `HabitoCard` (celular) |
| `bussola_web/src/pages/Registros/components/kanban/TarefaBoard.jsx` | substituir | sensores Mouse+Touch, barra/filtros/ações mobile, uma coluna por vez |
| `bussola_web/src/pages/Registros/components/kanban/BoardColumn.jsx` | substituir | quick-add no topo no celular, prop `onCardMenu` |
| `bussola_web/src/pages/Registros/components/kanban/BoardCard.jsx` | substituir | prop `onMenu` → botão "⋯" que não inicia arraste |
| `bussola_web/src/pages/Registros/components/kanban/BoardMobileBar.jsx` | criar | chips de status com contagem + botão de filtros |
| `bussola_web/src/pages/Registros/components/kanban/BoardFiltroSheet.jsx` | criar | busca + prioridade em sheet |
| `bussola_web/src/pages/Registros/components/kanban/BoardCardActions.jsx` | criar | ActionSheet do card + sheet "Mover para" |
| `bussola_web/src/pages/Registros/components/kanban/TarefaDetailPanel.jsx` | substituir | `sheet="full"`, sem autofocus, status/prioridade em chips, Excluir no "⋯" |
| `bussola_web/src/pages/Registros/styles/registros-mobile.css` | criar | todo o CSS mobile/tablet/toque da página |
| `bussola_web/src/pages/Registros/styles.css` | modificar | gates de hover, scrollbar só com mouse, `dvh` |
| `bussola_web/src/pages/Registros/styles/kanban.css` | modificar | gate de hover do card |
| `bussola_web/src/pages/Registros/styles/markdown.css` | modificar | `dvh` no modo tela cheia |

---

### Task 1: Base visual do desktop, dados de teste e helpers puros da Jornada

**Files:**
- Create: `bussola_web/e2e/registros-data.mjs`, `bussola_web/e2e/registros.desktop.spec.mjs`, `bussola_web/e2e/registros.mobile.spec.mjs`, `bussola_web/src/pages/Registros/jornadaUtils.js`
- Modify: `bussola_web/src/pages/Registros/index.jsx`

**Interfaces:**
- Produces:
  - `getTodayKey(now?) → 'dom'|'seg'|…|'sab'`; `contarHabitosHoje(habitos, now?) → { feitos, total, pct }` (ativos que ocorrem hoje); `calcularProgressoJornada(habitos, now?) → { pct, mensagem }` (mesmas mensagens de hoje); `formatarDataJornada(d?) → 'Sexta-feira, 2 de out'`.
  - E2E: `comApi(playwright, fn)`, `limparRegistrosE2E(request)`, `criarNota(request, data?)`, `criarTarefa(request, data?)`, `criarHabito(request, data?)`, `notaPorTitulo`, `grupoPorNome`, `tarefaPorTitulo`, `habitoPorTitulo` (todas `(request, texto) → objeto | null`).

- [ ] **Step 1: Helpers de dados de teste**

Criar `bussola_web/e2e/registros-data.mjs`:

```js
import { apiJson } from './helpers.mjs';

// Tudo que os testes de Registros criam começa com este prefixo e é removido no fim.
const E2E = 'E2E ';
const ehE2E = (s) => String(s || '').startsWith(E2E);
const COLUNAS = ['a_fazer', 'em_andamento', 'bloqueado', 'concluido', 'cancelado'];
const TODOS_DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

/** Contexto de API avulso (beforeAll/afterAll só têm fixtures de worker). */
export async function comApi(playwright, fn) {
  const r = await playwright.request.newContext();
  try {
    return await fn(r);
  } finally {
    await r.dispose();
  }
}

async function todasAsNotas(request) {
  const dash = await apiJson(request, 'GET', '/registros/');
  const porId = new Map();
  for (const n of [...(dash.anotacoes_fixadas || []), ...Object.values(dash.anotacoes_por_mes || {}).flat()]) {
    porId.set(n.id, n);
  }
  return { dash, notas: [...porId.values()] };
}

/** Remove notas, grupos, tarefas e hábitos "E2E ". Sem isso as bases visuais do desktop quebram. */
export async function limparRegistrosE2E(request) {
  const { dash, notas } = await todasAsNotas(request);
  for (const n of notas.filter((x) => ehE2E(x.titulo))) {
    await apiJson(request, 'DELETE', `/registros/anotacoes/${n.id}`);
  }
  for (const g of (dash.grupos_disponiveis || []).filter((x) => ehE2E(x.nome))) {
    await apiJson(request, 'DELETE', `/registros/grupos/${g.id}`);
  }
  const board = await apiJson(request, 'GET', '/registros/tarefas/board');
  for (const t of COLUNAS.flatMap((k) => board[k]).filter((x) => ehE2E(x.titulo))) {
    await apiJson(request, 'DELETE', `/registros/tarefas/${t.id}`);
  }
  for (const h of (await apiJson(request, 'GET', '/registros/habitos')).filter((x) => ehE2E(x.titulo))) {
    await apiJson(request, 'DELETE', `/registros/habitos/${h.id}`);
  }
}

export const criarNota = (request, data = {}) => apiJson(request, 'POST', '/registros/anotacoes', {
  titulo: 'E2E nota', conteudo: 'Texto E2E', grupo_id: null, fixado: false, links: [], ...data,
});

export const criarTarefa = (request, data = {}) => apiJson(request, 'POST', '/registros/tarefas', {
  titulo: 'E2E tarefa', descricao: '', prioridade: 'Média', status: 'Pendente', prazo: null, subtarefas: [], ...data,
});

export const criarHabito = (request, data = {}) => apiJson(request, 'POST', '/registros/habitos', {
  titulo: 'E2E hábito', descricao: null, horario: '10:00', frequencia: TODOS_DIAS, duracao_min: 15, cor: '#4A6DFF', ...data,
});

export async function notaPorTitulo(request, titulo) {
  const { notas } = await todasAsNotas(request);
  return notas.find((n) => n.titulo === titulo) || null;
}

export async function grupoPorNome(request, nome) {
  const dash = await apiJson(request, 'GET', '/registros/');
  return dash.grupos_disponiveis.find((g) => g.nome === nome) || null;
}

export async function tarefaPorTitulo(request, titulo) {
  const board = await apiJson(request, 'GET', '/registros/tarefas/board');
  for (const k of COLUNAS) {
    const t = board[k].find((x) => x.titulo === titulo);
    if (t) return t;
  }
  return null;
}

export async function habitoPorTitulo(request, titulo) {
  const lista = await apiJson(request, 'GET', '/registros/habitos');
  return lista.find((h) => h.titulo === titulo) || null;
}
```

- [ ] **Step 2: Spec do desktop (bases visuais + comportamento que não pode mudar)**

Criar `bussola_web/e2e/registros.desktop.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { comApi, limparRegistrosE2E, criarTarefa, tarefaPorTitulo } from './registros-data.mjs';

test.beforeAll(async ({ playwright }) => comApi(playwright, limparRegistrosE2E));
test.afterAll(async ({ playwright }) => comApi(playwright, limparRegistrosE2E));

const aba = (page, nome) => page.locator('.tab-btn-pill', { hasText: nome }).click();

// Garante um acordeão aberto (o estado vem do localStorage; o padrão só abre "Fixados").
async function abrirAlgumAcordeao(page) {
  if (await page.locator('.accordion-wrapper.open .anotacao-card').count()) return;
  await page.locator('.accordion-header:not(.active)').first().click();
  await page.locator('.accordion-wrapper.open .anotacao-card').first().waitFor();
  await page.waitForTimeout(400);
}

// Telas e modais que este plano toca. Base gerada ANTES de qualquer mudança de código.
const TELAS = [
  ['registros-tarefas', async (p) => { await aba(p, 'Tarefas'); await p.locator('.kb-board').waitFor(); }, { fullPage: true }],
  ['registros-jornada', async (p) => { await aba(p, 'Jornada'); await p.locator('.jk-kanban').waitFor(); }, { fullPage: true, mask: ['.jk-streak'] }],
  ['registros-dropdown-grupos', async (p) => {
    await p.locator('.dropdown-trigger-btn').click();
    await p.locator('.custom-dropdown-menu').waitFor();
  }, {}],
  ['modal-grupo', async (p) => {
    await p.locator('.dropdown-trigger-btn').click();
    await p.locator('.dropdown-action-row').click();
    await p.locator('.compact-modal').waitFor();
  }, {}],
  ['modal-ver-nota', async (p) => {
    await abrirAlgumAcordeao(p);
    await p.locator('.accordion-wrapper.open .anotacao-card').first().click();
    await p.locator('.view-modal').waitFor();
  }, {}],
  ['modal-tarefa', async (p) => {
    await aba(p, 'Tarefas');
    await p.locator('.kb-card').first().click();
    await p.getByRole('heading', { name: 'Editar Tarefa' }).waitFor();
  }, {}],
  ['modal-tarefa-nova', async (p) => {
    await aba(p, 'Tarefas');
    await p.getByRole('button', { name: 'Tarefa', exact: true }).click();
    await p.getByRole('heading', { name: 'Nova Tarefa' }).waitFor();
  }, {}],
  ['modal-habito', async (p) => {
    await aba(p, 'Jornada');
    await p.getByRole('button', { name: 'Hábito', exact: true }).click();
    await p.locator('.habito-modal-content').waitFor();
  }, {}],
  ['modal-habito-lista', async (p) => {
    await aba(p, 'Jornada');
    await p.getByRole('button', { name: 'Lista', exact: true }).click();
    await p.locator('.hl-modal-content').waitFor();
  }, {}],
];

for (const [nome, abrir, opts] of TELAS) {
  test(`desktop registros: ${nome} inalterado`, async ({ page }) => {
    await gotoApp(page, '/registros');
    await abrir(page);
    await page.waitForTimeout(400);
    const { mask = [], ...resto } = opts;
    await expect(page).toHaveScreenshot(`${nome}.png`, { ...resto, mask: mask.map((s) => page.locator(s)) });
  });
}

test('desktop: cabeçalho com abas, sem segmentado nem Fab', async ({ page }) => {
  await gotoApp(page, '/registros');
  await expect(page.locator('.registros-main-header')).toBeVisible();
  await expect(page.locator('.m-segmented')).toHaveCount(0);
  await expect(page.locator('.app-fab')).toHaveCount(0);
});

test('desktop: ações do card de nota só no hover e sem "⋯"', async ({ page }) => {
  await gotoApp(page, '/registros');
  await abrirAlgumAcordeao(page);
  const card = page.locator('.accordion-wrapper.open .anotacao-card').first();
  await page.mouse.move(2, 2);
  await expect(card.locator('.anotacao-actions')).toHaveCSS('opacity', '0');
  await card.hover();
  await expect(card.locator('.anotacao-actions')).toHaveCSS('opacity', '1');
  await expect(card.locator('.reg-card-more')).toHaveCount(0);
});

test('desktop: arrastar um card com o mouse muda a coluna', async ({ page, request }) => {
  await criarTarefa(request, { titulo: 'E2E arrastar', status: 'Em andamento' });
  try {
    await gotoApp(page, '/registros');
    await aba(page, 'Tarefas');
    const card = page.locator('.kb-card', { hasText: 'E2E arrastar' });
    const alvo = page.locator('.kb-column', { has: page.locator('.kb-column-label', { hasText: 'Bloqueado' }) }).locator('.kb-column-body');
    const a = await card.boundingBox();
    const b = await alvo.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 5 });
    await page.mouse.move(b.x + b.width / 2, b.y + 30, { steps: 15 });
    await page.mouse.up();
    await expect.poll(async () => (await tarefaPorTitulo(request, 'E2E arrastar'))?.status).toBe('Bloqueado');
  } finally {
    await limparRegistrosE2E(request);
  }
});
```

- [ ] **Step 3: Gerar a base ANTES de qualquer mudança de código**

Run (em `bussola_web/`): `npm run e2e:update -- --project=desktop e2e/registros.desktop.spec.mjs`
Expected: 12 passed; criados 9 PNGs em `e2e/registros.desktop.spec.mjs-snapshots/`. Abra os 9 e confira que cada um mostra a tela certa (board com "A Fazer" cheio; Jornada em 3 colunas; menu de grupos aberto; "Novo Grupo"; nota aberta; "Editar Tarefa"; "Nova Tarefa"; "Novo Hábito"; "Todos os Hábitos"). Rode `npm run e2e -- --project=desktop` duas vezes e confirme que tudo passa nas duas (os 13 de `desktop-visual`, os de Provisões e os 12 novos). Se alguma base variar entre execuções, adicione `mask` no elemento dinâmico e regenere só esse arquivo.

- [ ] **Step 4: Testes da lógica pura (falham: o módulo não existe)**

Criar `bussola_web/e2e/registros.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, apiJson, smallTargets } from './helpers.mjs';
import {
  comApi, limparRegistrosE2E, criarNota, criarTarefa, criarHabito,
  grupoPorNome, notaPorTitulo, tarefaPorTitulo, habitoPorTitulo,
} from './registros-data.mjs';

// ---------------------------------------------------------------------------
// Infra do arquivo
// ---------------------------------------------------------------------------
const abrirAba = (page, nome) => page.getByRole('tab', { name: nome, exact: true }).click();

// Simula teclado virtual de 424px: área visível de 420px com o layout em 844.
const teclado = (page) => page.evaluate(() => {
  const s = document.documentElement.style;
  s.setProperty('--vvh', '420px');
  s.setProperty('--kb-inset', '424px');
});

const focoEmCampo = (page) => page.evaluate(() => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName));

async function abrirAcordeao(page, nome) {
  const h = page.locator('.accordion-header', { hasText: nome }).first();
  if (!(await h.evaluate((e) => e.classList.contains('active')))) await h.click();
  await expect(h).toHaveClass(/active/);
  await page.waitForTimeout(350); // transição do acordeão (0.3s)
}

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
```

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs`
Expected: FAIL (`Failed to fetch dynamically imported module …/jornadaUtils.js`).

- [ ] **Step 5: Extrair os helpers da Jornada (sem mudar comportamento)**

Criar `bussola_web/src/pages/Registros/jornadaUtils.js`:

```js
// Helpers puros da Jornada (hábitos do dia). `now` é injetável para teste.
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function getTodayKey(now = new Date()) {
    return DIAS[now.getDay()];
}

/** Hábitos ativos que ocorrem hoje e quantos deles já foram feitos. */
export function contarHabitosHoje(habitos, now = new Date()) {
    const hoje = getTodayKey(now);
    const ativos = habitos.filter(h => h.status === 'ativo' && h.frequencia.includes(hoje));
    const feitos = ativos.filter(h => h.registro_hoje?.concluido).length;
    return { feitos, total: ativos.length, pct: ativos.length ? Math.round((feitos / ativos.length) * 100) : 0 };
}

export function calcularProgressoJornada(habitos, now = new Date()) {
    const { total, pct } = contarHabitosHoje(habitos, now);
    if (!total) return { pct: 0, mensagem: 'Comece sua jornada!' };
    const mensagem = pct === 0 ? 'Comece sua jornada!'
        : pct < 25 ? 'Você está começando.'
        : pct < 50 ? 'Siga em frente!'
        : pct < 75 ? 'Mais da metade. Bora!'
        : pct < 100 ? 'Quase lá, não pare!'
        : 'Jornada completa! 🎉';
    return { pct, mensagem };
}

export function formatarDataJornada(d = new Date()) {
    return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
```

Em `bussola_web/src/pages/Registros/index.jsx`, substituir o bloco das linhas 4–29:

```js
// ── Helpers de Jornada ──────────────────────────────────────────────────────
function getTodayKey() {
    const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    return dias[new Date().getDay()];
}
function calcularProgressoJornada(habitos) {
    const hoje = getTodayKey();
    const ativos = habitos.filter(h => h.status === 'ativo' && h.frequencia.includes(hoje));
    if (!ativos.length) return { pct: 0, mensagem: 'Comece sua jornada!' };
    const feitos = ativos.filter(h => h.registro_hoje?.concluido).length;
    const pct = Math.round((feitos / ativos.length) * 100);
    const mensagem = pct === 0 ? 'Comece sua jornada!'
        : pct < 25 ? 'Você está começando.'
        : pct < 50 ? 'Siga em frente!'
        : pct < 75 ? 'Mais da metade. Bora!'
        : pct < 100 ? 'Quase lá, não pare!'
        : 'Jornada completa! 🎉';
    return { pct, mensagem };
}
function formatarDataJornada() {
    const d = new Date();
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${diasSemana[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}
// ────────────────────────────────────────────────────────────────────────────
```

por:

```js
import { calcularProgressoJornada, formatarDataJornada } from './jornadaUtils';
```

(As chamadas `calcularProgressoJornada(habitos)` e `formatarDataJornada()` no cabeçalho da Jornada continuam iguais.)

- [ ] **Step 6: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs` → Expected: 1 passed.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (inclui `registros.png` e as 9 bases novas; o cabeçalho da Jornada com data e mensagem é o mesmo).
Run: `npm run build` → OK.
Run: `npx eslint src/pages/Registros` → Expected: 4 errors, 5 warnings (a linha de base; nenhum novo).

- [ ] **Step 7: Commit**

```bash
git add bussola_web/e2e/registros-data.mjs bussola_web/e2e/registros.desktop.spec.mjs bussola_web/e2e/registros.desktop.spec.mjs-snapshots bussola_web/e2e/registros.mobile.spec.mjs bussola_web/src/pages/Registros/jornadaUtils.js bussola_web/src/pages/Registros/index.jsx
git commit -m "test(web): base visual do desktop de Registros e helpers puros da Jornada" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Casca mobile (abas, Fab por aba) e Caderno (busca, chips, grupos, "⋯" no card)

**Files:**
- Create: `bussola_web/src/pages/Registros/mobile/CadernoToolbar.jsx`, `bussola_web/src/pages/Registros/mobile/GruposSheet.jsx`, `bussola_web/src/pages/Registros/styles/registros-mobile.css`
- Modify: `bussola_web/src/pages/Registros/index.jsx`, `bussola_web/src/pages/Registros/components/AnotacaoCard.jsx`, `bussola_web/src/pages/Registros/components/GrupoModal.jsx`, `bussola_web/src/pages/Registros/styles.css`, `bussola_web/e2e/registros.mobile.spec.mjs`

**Interfaces:**
- Consumes: `Segmented`, `Fab`, `ActionSheet`, `Sheet` (planos 01/02); `handleNewNota`, `handleNewGrupo`, `handleEditGrupo(grupo, e)`, `handleDeleteGrupo(id, e)` (já existem em `index.jsx`).
- Produces:
  - `CadernoToolbar({ searchTerm, onSearch, grupos, filtroGrupo, onFiltro, temIndefinido, onOpenGrupos })` → `div.reg-m-toolbar` com `input[type=search][aria-label="Buscar anotações"]` e `div.reg-m-chips[data-offscreen-ok]` de `button.reg-chip[aria-pressed]`.
  - `GruposSheet({ open, onClose, grupos, onNew, onEdit(grupo, e), onDelete(id, e) })` → `Sheet.reg-sheet` "Grupos" com `button.reg-icon-btn[aria-label="Editar <nome>"|"Excluir <nome>"]`.
  - `AnotacaoCard` no celular: `button.reg-card-more[aria-label="Ações de <título>"]` + `ActionSheet` (Editar / Fixar no topo|Desafixar / Excluir).
  - Container da página no celular: classes `reg-m reg-m-<aba>`.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/registros.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 2 — casca e Caderno
// ---------------------------------------------------------------------------
// Abas já adaptadas ao celular (as próximas tasks acrescentam as outras).
const ABAS_VERIFICADAS = ['Caderno'];

test.describe('casca e Caderno', () => {
  test('topbar "Registros", abas segmentadas de largura total e um Fab por aba', async ({ page }) => {
    await gotoApp(page, '/registros');
    await expect(page.locator('.m-topbar-title')).toHaveText('Registros');
    await expect(page.locator('.registros-main-header')).toHaveCount(0);
    const tabs = await page.locator('.reg-m-tabs').boundingBox();
    expect(Math.round(tabs.x)).toBe(16);
    expect(Math.round(tabs.width)).toBe(390 - 32);
    await expect(page.getByRole('tab', { name: 'Caderno', exact: true })).toHaveAttribute('aria-selected', 'true');
    for (const [aba, fab] of [['Caderno', 'Nova nota'], ['Tarefas', 'Nova tarefa'], ['Jornada', 'Novo hábito']]) {
      await abrirAba(page, aba);
      await expect(page.locator('.app-fab')).toHaveCount(1);
      await expect(page.locator('.app-fab')).toHaveAttribute('aria-label', fab);
    }
  });

  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/registros');
      for (const aba of ABAS_VERIFICADAS) {
        await abrirAba(page, aba);
        await page.waitForLoadState('networkidle');
        expect(await overflowOffenders(page), `${aba} @ ${w}px`).toEqual([]);
      }
    });
  }

  test('alvos de toque ≥ 44px nas abas', async ({ page }) => {
    await gotoApp(page, '/registros');
    for (const aba of ABAS_VERIFICADAS) {
      await abrirAba(page, aba);
      await page.waitForLoadState('networkidle');
      expect(await smallTargets(page, '.registros-scope'), aba).toEqual([]);
    }
  });

  test('Caderno: conteúdo ≥ 14px, secundário ≥ 12px, caixa alta ≥ 11px', async ({ page }) => {
    await gotoApp(page, '/registros');
    const t = await page.evaluate(() => {
      const fs = (sel) => [...document.querySelectorAll(sel)].map((e) => parseFloat(getComputedStyle(e).fontSize));
      return {
        principal: [...fs('.anotacao-titulo'), ...fs('.anotacao-conteudo'), ...fs('.reg-chip')],
        secundario: fs('.anotacao-data'),
        caixaAlta: fs('.accordion-header .header-meta span'),
      };
    });
    expect(Math.min(...t.principal)).toBeGreaterThanOrEqual(14);
    expect(Math.min(...t.secundario)).toBeGreaterThanOrEqual(12);
    expect(Math.min(...t.caixaAlta)).toBeGreaterThanOrEqual(11);
  });

  test('busca de largura total e chips de grupo filtram as notas', async ({ page, request }) => {
    const pessoal = await grupoPorNome(request, 'Pessoal');
    await criarNota(request, { titulo: 'E2E busca única', grupo_id: pessoal.id });
    await gotoApp(page, '/registros');
    const busca = page.getByRole('searchbox', { name: 'Buscar anotações' });
    expect(Math.round((await busca.boundingBox()).width)).toBe(390 - 32);
    await busca.fill('E2E busca única');
    await expect(page.locator('.accordion-header')).toHaveCount(1);
    await expect(page.locator('.accordion-header')).toContainText('Pessoal');
    await busca.fill('');
    const chips = page.locator('.reg-m-chips');
    await expect(chips.getByRole('button', { name: 'Todos', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await chips.getByRole('button', { name: 'Pessoal', exact: true }).click();
    await expect(chips.getByRole('button', { name: 'Pessoal', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const grupos = await page.locator('.group-accordion:not(:has(.pinned-header)) .header-title-wrapper').allTextContents();
    expect(grupos.map((g) => g.trim())).toEqual(['Pessoal']);
  });

  test('card de nota: ⋯ visível com Editar / Fixar / Excluir (sem ações de hover)', async ({ page, request }) => {
    const pessoal = await grupoPorNome(request, 'Pessoal');
    await criarNota(request, { titulo: 'E2E card menu', grupo_id: pessoal.id });
    await gotoApp(page, '/registros');
    await page.getByRole('searchbox', { name: 'Buscar anotações' }).fill('E2E card menu');
    await abrirAcordeao(page, 'Pessoal');
    const card = page.locator('.accordion-wrapper.open .anotacao-card', { hasText: 'E2E card menu' });
    await expect(card.locator('.anotacao-actions')).toHaveCount(0);
    const mais = card.getByRole('button', { name: 'Ações de E2E card menu' });
    const b = await mais.boundingBox();
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    await mais.click();
    await expect(page.locator('.view-modal')).toHaveCount(0); // o ⋯ não abre a nota
    const acoes = page.locator('.action-sheet');
    await expect(acoes.locator('.action-sheet-item')).toHaveText(['Editar', 'Fixar no topo', 'Excluir', 'Cancelar']);
    await acoes.getByRole('button', { name: 'Fixar no topo' }).click();
    await expect.poll(async () => (await notaPorTitulo(request, 'E2E card menu'))?.fixado).toBe(true);
    await expect(page.locator('.group-accordion').first().locator('.pinned-header')).toHaveCount(1); // Fixados primeiro

    await page.locator('.accordion-wrapper.open .anotacao-card', { hasText: 'E2E card menu' }).first()
      .getByRole('button', { name: /^Ações de/ }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
    const editor = page.locator('.modal-overlay.is-sheet');
    await expect(editor).toBeVisible();
    await expect(editor.locator('.modal-body input[type="text"]').first()).toHaveValue('E2E card menu');
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);

    await page.locator('.accordion-wrapper.open .anotacao-card', { hasText: 'E2E card menu' }).first()
      .getByRole('button', { name: /^Ações de/ }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir' }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Excluir' }).click();
    await expect.poll(() => notaPorTitulo(request, 'E2E card menu')).toBeNull();
  });

  test('chip "Grupos" abre a gestão com editar/excluir de 44px; criar e excluir um grupo', async ({ page }) => {
    await gotoApp(page, '/registros');
    const chips = page.locator('.reg-m-chips');
    await chips.getByRole('button', { name: 'Grupos', exact: true }).click();
    const sheet = page.locator('.reg-sheet');
    await expect(sheet.getByRole('heading', { name: 'Grupos' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Editar Pessoal' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Excluir Pessoal' })).toBeVisible();
    expect(await smallTargets(page, '.reg-sheet')).toEqual([]);

    await sheet.getByRole('button', { name: 'Novo grupo' }).click();
    await expect(page.locator('.reg-sheet')).toHaveCount(0); // fecha antes: o modal ficaria atrás do sheet
    const modal = page.locator('.modal-overlay.is-sheet', { has: page.locator('.compact-modal') });
    await expect(modal.getByRole('heading', { name: 'Novo Grupo' })).toBeVisible();
    expect(await focoEmCampo(page)).toBe(false);
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    await modal.getByPlaceholder('Ex: Estudos...').fill('E2E Grupo');
    const cores = modal.getByRole('radio');
    expect(await cores.count()).toBeGreaterThan(0);
    await cores.last().click();
    await expect(cores.last()).toHaveAttribute('aria-checked', 'true');
    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(chips.getByRole('button', { name: 'E2E Grupo', exact: true })).toBeVisible();

    await chips.getByRole('button', { name: 'Grupos', exact: true }).click();
    await page.locator('.reg-sheet').getByRole('button', { name: 'Excluir E2E Grupo' }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(chips.getByRole('button', { name: 'E2E Grupo', exact: true })).toHaveCount(0);
  });

  test('Novo grupo com teclado (--vvh 420): Salvar visível', async ({ page }) => {
    await gotoApp(page, '/registros');
    await teclado(page);
    await page.locator('.reg-m-chips').getByRole('button', { name: 'Grupos', exact: true }).click();
    await page.locator('.reg-sheet').getByRole('button', { name: 'Novo grupo' }).click();
    const salvar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Salvar' });
    await expect.poll(async () => { const b = await salvar.boundingBox(); return b && Math.round(b.y + b.height); }).toBeLessThanOrEqual(420);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs`
Expected: os testes de "casca e Caderno" FAIL (não há `.reg-m-tabs`, `.reg-m-chips`, `.reg-card-more`, Fab); o de "lógica pura" passa.

- [ ] **Step 2: Barra do Caderno**

Criar `bussola_web/src/pages/Registros/mobile/CadernoToolbar.jsx`:

```jsx
/** Barra do Caderno no celular: busca de largura total e chips de grupo (rolagem horizontal). */
export function CadernoToolbar({ searchTerm, onSearch, grupos, filtroGrupo, onFiltro, temIndefinido, onOpenGrupos }) {
    const chip = (valor, rotulo, cor) => (
        <button
            key={valor}
            type="button"
            className={`reg-chip ${filtroGrupo === valor ? 'active' : ''}`}
            aria-pressed={filtroGrupo === valor}
            onClick={() => onFiltro(valor)}
        >
            {cor && <span className="reg-chip-dot" style={{ backgroundColor: cor }}></span>}
            <span>{rotulo}</span>
        </button>
    );

    return (
        <div className="reg-m-toolbar">
            <label className="reg-m-search">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder="Buscar anotações..."
                    aria-label="Buscar anotações"
                    enterKeyHint="search"
                />
            </label>
            <div className="reg-m-chips" role="group" aria-label="Filtrar por grupo" data-offscreen-ok>
                {chip('Todos', 'Todos')}
                {grupos.map((g) => chip(g.nome, g.nome, g.cor))}
                {temIndefinido && chip('Indefinido', 'Indefinido', '#ccc')}
                <button type="button" className="reg-chip reg-chip-ghost" onClick={onOpenGrupos} aria-haspopup="dialog">
                    <i className="fa-regular fa-folder-open" aria-hidden="true"></i>
                    <span>Grupos</span>
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Sheet de gestão de grupos**

Criar `bussola_web/src/pages/Registros/mobile/GruposSheet.jsx`:

```jsx
import { Sheet } from '../../../components/mobile/Sheet';

/** Gestão de grupos no celular: editar/excluir sempre visíveis (44px) e "Novo grupo" no rodapé. */
export function GruposSheet({ open, onClose, grupos, onNew, onEdit, onDelete }) {
    return (
        <Sheet
            open={open}
            onClose={onClose}
            title="Grupos"
            className="reg-sheet"
            footer={(
                <button type="button" className="btn-primary" onClick={onNew}>
                    <i className="fa-solid fa-plus"></i> Novo grupo
                </button>
            )}
        >
            {grupos.length === 0 ? (
                <p className="reg-sheet-empty">Nenhum grupo ainda.</p>
            ) : (
                <ul className="reg-grupo-list">
                    {grupos.map((g) => (
                        <li key={g.id} className="reg-grupo-row">
                            <span className="reg-chip-dot" style={{ backgroundColor: g.cor }}></span>
                            <span className="reg-grupo-nome">{g.nome}</span>
                            <button type="button" className="reg-icon-btn" aria-label={`Editar ${g.nome}`} onClick={(e) => onEdit(g, e)}>
                                <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button type="button" className="reg-icon-btn is-danger" aria-label={`Excluir ${g.nome}`} onClick={(e) => onDelete(g.id, e)}>
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Sheet>
    );
}
```

- [ ] **Step 4: "⋯" no card de nota (só no celular)**

Em `bussola_web/src/pages/Registros/components/AnotacaoCard.jsx`:

1. Trocar as 3 primeiras linhas (imports) por:

```js
import React, { useState, useMemo } from 'react';
import { deleteAnotacao, toggleFixarAnotacao } from '../../../services/api';
import { useConfirm } from '../../../context/ConfirmDialogContext';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { ActionSheet } from '../../../components/mobile/ActionSheet';
```

2. Trocar

```js
    const confirm = useConfirm();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e) => {
        e.stopPropagation();
```

por

```js
    const confirm = useConfirm();
    const isMobile = useIsMobile();
    const [isDeleting, setIsDeleting] = useState(false);
    const [menuAberto, setMenuAberto] = useState(false);

    // `e` é opcional: o ActionSheet chama os handlers sem evento.
    const handleDelete = async (e) => {
        e?.stopPropagation();
```

3. Trocar

```js
    const handlePin = async (e) => {
        e.stopPropagation();
```

por

```js
    const handlePin = async (e) => {
        e?.stopPropagation();
```

4. Trocar

```jsx
    return (
        <div
            className={`anotacao-card selo-card ${anotacao.fixado ? 'fixado' : ''} ${isDeleting ? 'card-deleting' : ''}`}
```

por

```jsx
    return (
        <>
        <div
            className={`anotacao-card selo-card ${anotacao.fixado ? 'fixado' : ''} ${isDeleting ? 'card-deleting' : ''}`}
```

5. Trocar o bloco

```jsx
                <div className="anotacao-actions">
                    {/* Botões padronizados com Finanças */}
                    <button className="btn-action-icon btn-edit" onClick={handleEditClick} title="Editar">
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button className="btn-action-icon btn-delete" onClick={handleDelete} title="Excluir">
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
```

por

```jsx
                {isMobile ? (
                    <button
                        type="button"
                        className="reg-card-more"
                        aria-label={`Ações de ${anotacao.titulo}`}
                        onClick={(e) => { e.stopPropagation(); setMenuAberto(true); }}
                    >
                        <i className="fa-solid fa-ellipsis"></i>
                    </button>
                ) : (
                <div className="anotacao-actions">
                    {/* Botões padronizados com Finanças */}
                    <button className="btn-action-icon btn-edit" onClick={handleEditClick} title="Editar">
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button className="btn-action-icon btn-delete" onClick={handleDelete} title="Excluir">
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
                )}
```

6. Trocar o fim do componente

```jsx
            </div>
        </div>
    );
});
```

por

```jsx
            </div>
        </div>

        {/* Irmão do card (nunca dentro dele): o clique do sheet não pode subir até o onClick do card. */}
        {isMobile && (
            <ActionSheet
                open={menuAberto}
                onClose={() => setMenuAberto(false)}
                title={anotacao.titulo}
                subtitle={anotacao.grupo?.nome || 'Sem grupo'}
                icon="fa-solid fa-note-sticky"
                actions={[
                    { key: 'editar', icon: 'fa-solid fa-pen-to-square', label: 'Editar', onClick: () => onEdit(anotacao) },
                    { key: 'fixar', icon: 'fa-solid fa-thumbtack', label: anotacao.fixado ? 'Desafixar' : 'Fixar no topo', onClick: handlePin },
                    { key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: handleDelete },
                ]}
            />
        )}
        </>
    );
});
```

- [ ] **Step 5: GrupoModal com cores inline no celular**

Em `bussola_web/src/pages/Registros/components/GrupoModal.jsx`:

1. Trocar `import { BaseModal } from '../../../components/BaseModal';` por:

```js
import { BaseModal } from '../../../components/BaseModal';
import { useIsMobile } from '../../../hooks/useIsMobile';
```

2. Trocar `    const { addToast } = useToast();` por:

```js
    const { addToast } = useToast();
    const isMobile = useIsMobile();
```

3. Trocar todo o conteúdo de `<div className="modal-body" …>` (da linha `<div className="form-row" style={{display:'grid', gridTemplateColumns:'1fr auto', alignItems:'end', gap:'15px'}}>` até o `</div>` que a fecha, antes do `</div>` do `modal-body`), isto é, o bloco:

```jsx
                        <div className="form-row" style={{display:'grid', gridTemplateColumns:'1fr auto', alignItems:'end', gap:'15px'}}>
                            <div className="form-group">
                                <label>Nome do Grupo</label>
                                <input 
                                    className="form-input" 
                                    value={nome} 
                                    onChange={e => setNome(e.target.value)} 
                                    placeholder="Ex: Estudos..."
                                    required 
                                    autoFocus 
                                />
                            </div>
```

por:

```jsx
                        {isMobile ? (
                            <>
                                <div className="form-group">
                                    <label htmlFor="grupo-nome-m">Nome do Grupo</label>
                                    <input
                                        id="grupo-nome-m"
                                        className="form-input"
                                        value={nome}
                                        onChange={e => setNome(e.target.value)}
                                        placeholder="Ex: Estudos..."
                                        required
                                    />
                                </div>
                                {/* No celular as cores ficam à vista (o popover cortaria dentro do sheet). */}
                                <div className="form-group">
                                    <label id="grupo-cor-m">Cor</label>
                                    <div className="grupo-cores-m" role="radiogroup" aria-labelledby="grupo-cor-m">
                                        {availableColors.map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                role="radio"
                                                aria-checked={cor === c}
                                                aria-label={`Cor ${c}`}
                                                className={`grupo-cor-m ${cor === c ? 'selected' : ''}`}
                                                style={{ backgroundColor: c }}
                                                onClick={() => setCor(c)}
                                            />
                                        ))}
                                    </div>
                                    {availableColors.length === 0 && <p className="grupo-cores-vazio">Todas as cores já estão em uso.</p>}
                                </div>
                            </>
                        ) : (
                        <div className="form-row" style={{display:'grid', gridTemplateColumns:'1fr auto', alignItems:'end', gap:'15px'}}>
                            <div className="form-group">
                                <label>Nome do Grupo</label>
                                <input 
                                    className="form-input" 
                                    value={nome} 
                                    onChange={e => setNome(e.target.value)} 
                                    placeholder="Ex: Estudos..."
                                    required 
                                    autoFocus 
                                />
                            </div>
```

4. Trocar o fechamento do bloco desktop

```jsx
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer" style={{position: 'relative', zIndex: 1}}>
```

por

```jsx
                                    )}
                                </div>
                            </div>
                        </div>
                        )}
                    </div>

                    <div className="modal-footer" style={{position: 'relative', zIndex: 1}}>
```

- [ ] **Step 6: Página: abas segmentadas, barra do Caderno, Fab e sheet de grupos**

Em `bussola_web/src/pages/Registros/index.jsx`:

1. Trocar `import { AiAssistant } from '../../components/AiAssistant';` por:

```js
import { AiAssistant } from '../../components/AiAssistant';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Segmented } from '../../components/mobile/Segmented';
import { Fab } from '../../components/mobile/Fab';
import { CadernoToolbar } from './mobile/CadernoToolbar';
import { GruposSheet } from './mobile/GruposSheet';
```

2. Trocar `import './styles.css';` por:

```js
import './styles.css';
import './styles/registros-mobile.css';
```

3. Trocar `import { logger } from '../../utils/logger';` por:

```js
import { logger } from '../../utils/logger';

const ABAS = [
    { value: 'caderno', label: 'Caderno' },
    { value: 'tarefas', label: 'Tarefas' },
    { value: 'jornada', label: 'Jornada' },
];
```

4. Trocar `    const dialogConfirm = useConfirm();` por:

```js
    const dialogConfirm = useConfirm();
    const isMobile = useIsMobile();
```

5. Trocar `    const [editingHabito, setEditingHabito] = useState(null);` por:

```js
    const [editingHabito, setEditingHabito] = useState(null);
    const [gruposSheetOpen, setGruposSheetOpen] = useState(false);
```

6. Trocar `    const grupos = data?.grupos_disponiveis || [];` por:

```js
    const grupos = data?.grupos_disponiveis || [];

    // Chip "Indefinido" só aparece se houver nota sem grupo.
    const temIndefinido = useMemo(() => {
        if (!data) return false;
        const todas = [...(data.anotacoes_fixadas || []), ...Object.values(data.anotacoes_por_mes || {}).flat()];
        return todas.some((n) => !n.grupo);
    }, [data]);
```

7. Trocar `        <div className="container main-container registros-scope">` por:

```jsx
        <div className={['container main-container registros-scope', isMobile && `reg-m reg-m-${activeTab}`].filter(Boolean).join(' ')}>
```

8. Trocar

```jsx
                {/* HEADER ÚNICO COM ABAS */}
                <div className="column-header-flex registros-main-header">
```

por

```jsx
                {/* HEADER ÚNICO COM ABAS (no celular: abas segmentadas + a barra da aba) */}
                {isMobile ? (
                    <Segmented
                        label="Seções de Registros"
                        options={ABAS}
                        value={activeTab}
                        onChange={setActiveTab}
                        className="reg-m-tabs"
                    />
                ) : (
                <div className="column-header-flex registros-main-header">
```

9. Trocar

```jsx
                    {/* Ações das Tarefas */}
                    {activeTab === 'tarefas' && (
                        <div className="header-actions-group">
                            <button className="btn-primary small-btn" onClick={() => novaTarefaRef.current?.()}>
                                <i className="fa-solid fa-plus"></i> Tarefa
                            </button>
                        </div>
                    )}

                </div>
```

por

```jsx
                    {/* Ações das Tarefas */}
                    {activeTab === 'tarefas' && (
                        <div className="header-actions-group">
                            <button className="btn-primary small-btn" onClick={() => novaTarefaRef.current?.()}>
                                <i className="fa-solid fa-plus"></i> Tarefa
                            </button>
                        </div>
                    )}

                </div>
                )}

                {isMobile && activeTab === 'caderno' && (
                    <CadernoToolbar
                        searchTerm={searchTerm}
                        onSearch={setSearchTerm}
                        grupos={grupos}
                        filtroGrupo={filtroGrupo}
                        onFiltro={setFiltroGrupo}
                        temIndefinido={temIndefinido}
                        onOpenGrupos={() => setGruposSheetOpen(true)}
                    />
                )}
```

10. Trocar `            <AiAssistant context="registros" />` por:

```jsx
            {/* Celular: o "+" da aba ativa e a gestão de grupos (fecha antes de abrir o GrupoModal,
                que é BaseModal na árvore e ficaria atrás do sheet em portal). */}
            {isMobile && activeTab === 'caderno' && <Fab label="Nova nota" onClick={handleNewNota} />}
            {isMobile && activeTab === 'tarefas' && <Fab label="Nova tarefa" onClick={() => novaTarefaRef.current?.()} />}
            {isMobile && activeTab === 'jornada' && <Fab label="Novo hábito" onClick={handleNewHabito} />}
            {isMobile && (
                <GruposSheet
                    open={gruposSheetOpen}
                    onClose={() => setGruposSheetOpen(false)}
                    grupos={grupos}
                    onNew={() => { setGruposSheetOpen(false); handleNewGrupo(); }}
                    onEdit={(g, e) => { setGruposSheetOpen(false); handleEditGrupo(g, e); }}
                    onDelete={handleDeleteGrupo}
                />
            )}

            <AiAssistant context="registros" />
```

- [ ] **Step 7: Gates de hover e `dvh` no `styles.css`**

Em `bussola_web/src/pages/Registros/styles.css`:

1. Trocar

```css
.registros-scope.main-container {
    padding-bottom: 5rem !important;
    min-height: 100vh;
    box-sizing: border-box;
}
```

por

```css
.registros-scope.main-container {
    padding-bottom: 5rem !important;
    min-height: 100vh;
    min-height: 100dvh;
    box-sizing: border-box;
}
```

2. Trocar

```css
.registros-scope *::-webkit-scrollbar {
    display: none;
}
```

por

```css
/* Só com mouse: no toque a barra de rolagem nativa é a pista de que dá para rolar. */
@media (hover: hover) and (pointer: fine) {
    .registros-scope *::-webkit-scrollbar {
        display: none;
    }
}
```

3. Trocar

```css
    width: 100vw;
    height: 100vh;
    z-index: 98;
```

por

```css
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    z-index: 98;
```

4. Trocar

```css
.registros-scope .anotacao-card:hover {
    transform: translateY(-4px);
    border-color: color-mix(in srgb, var(--card-accent) 40%, var(--cor-borda));
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08),
        0 0 0 3px color-mix(in srgb, var(--card-accent) 12%, transparent);
}
```

por

```css
@media (hover: hover) and (pointer: fine) {
    .registros-scope .anotacao-card:hover {
        transform: translateY(-4px);
        border-color: color-mix(in srgb, var(--card-accent) 40%, var(--cor-borda));
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08),
            0 0 0 3px color-mix(in srgb, var(--card-accent) 12%, transparent);
    }
}
```

5. Trocar

```css
.registros-scope .footer-pin-btn:hover {
    color: var(--cor-azul-primario);
}

.registros-scope .footer-pin-btn:hover i {
    transform: rotate(-20deg) scale(1.2);
}
```

por

```css
@media (hover: hover) and (pointer: fine) {
    .registros-scope .footer-pin-btn:hover {
        color: var(--cor-azul-primario);
    }

    .registros-scope .footer-pin-btn:hover i {
        transform: rotate(-20deg) scale(1.2);
    }
}
```

6. Trocar

```css
.registros-scope .footer-pin-btn.pinned:hover i {
    transform: rotate(20deg) scale(1.2);
}
```

por

```css
@media (hover: hover) and (pointer: fine) {
    .registros-scope .footer-pin-btn.pinned:hover i {
        transform: rotate(20deg) scale(1.2);
    }
}
```

7. Trocar

```css
    max-height: 90vh;
    animation: scaleInModal 0.3s cubic-bezier(0.16, 1, 0.3, 1);
```

por

```css
    max-height: 90vh;
    max-height: 90dvh;
    animation: scaleInModal 0.3s cubic-bezier(0.16, 1, 0.3, 1);
```

8. Trocar

```css
.registros-scope .large-modal {
    max-width: 1000px;
    height: 85vh;
}
```

por

```css
.registros-scope .large-modal {
    max-width: 1000px;
    height: 85vh;
    height: 85dvh;
}
```

9. Trocar

```css
.registros-scope .color-swatch:hover {
    transform: scale(1.15);
    border-color: white;
    z-index: 2;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}
```

por

```css
@media (hover: hover) and (pointer: fine) {
    .registros-scope .color-swatch:hover {
        transform: scale(1.15);
        border-color: white;
        z-index: 2;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }
}
```

- [ ] **Step 8: CSS mobile da página (casca, Caderno, sheets e modais)**

Criar `bussola_web/src/pages/Registros/styles/registros-mobile.css`:

```css
/* ========================================================= */
/* REGISTROS NO CELULAR (≤768), TABLET E TOQUE                */
/* Carrega depois de styles.css, markdown.css e kanban.css    */
/* (mesma especificidade vence) e antes de mobile.css,        */
/* components.css e global.css: para vencer `.app-sheet > …`  */
/* use 3 classes; para vencer as regras de sheet com          */
/* !important, `.registros-scope.modal-overlay.is-sheet > …`  */
/* com !important.                                            */
/* Sheets (portal no body) não herdam .registros-scope: as    */
/* classes usadas neles têm prefixo .reg- e não têm escopo.   */
/* Escala: 8 dentro do card, 12 entre cards, 16 gutter e      */
/* blocos, 24 entre seções.                                   */
/* ========================================================= */

/* --- Peças compartilhadas (página e sheets) --- */
.reg-chip {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    min-height: var(--tap-min);
    min-width: var(--tap-min);
    padding: 0 var(--sp-4);
    border: 1px solid var(--cor-borda);
    border-radius: 999px;
    background: var(--cor-card-principal);
    color: var(--cor-texto-principal);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
}

.reg-chip.active {
    background: rgba(var(--cor-tema-rgb), 0.16);
    border-color: var(--cor-azul-primario);
    color: var(--cor-azul-primario);
    font-weight: 600;
}

.reg-chip-ghost {
    border-style: dashed;
    color: var(--cor-texto-secundario);
}

.reg-chip-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid transparent;
    flex-shrink: 0;
}

.reg-chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
}

.reg-icon-btn {
    width: var(--tap-min);
    height: var(--tap-min);
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border: 1px solid var(--cor-borda);
    border-radius: 12px;
    background: var(--cor-card-principal);
    color: var(--cor-texto-secundario);
    font-size: 1rem;
    cursor: pointer;
}

.reg-icon-btn.is-danger {
    color: var(--cor-vermelho-delete);
}

.reg-grupo-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
}

.reg-grupo-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 56px;
    border-top: 1px solid var(--cor-borda);
}

.reg-grupo-row:first-child {
    border-top: none;
}

.reg-grupo-nome {
    flex: 1;
    min-width: 0;
    font-size: 0.9375rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.reg-sheet-empty {
    margin: 0;
    padding: var(--sp-4) 0;
    color: var(--cor-texto-secundario);
    font-size: 0.875rem;
    text-align: center;
}

.reg-opcoes {
    display: flex;
    flex-direction: column;
}

.reg-opcao {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 52px;
    padding: 0 var(--sp-1);
    border: none;
    border-top: 1px solid var(--cor-borda);
    background: transparent;
    color: var(--cor-texto-principal);
    font: inherit;
    font-size: 0.9375rem;
    text-align: left;
    cursor: pointer;
}

.reg-opcao:first-child {
    border-top: none;
}

.reg-opcao.selected {
    color: var(--cor-azul-primario);
    font-weight: 600;
}

.reg-opcao .fa-check {
    margin-left: auto;
}

.reg-sheet-campos {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
}

.reg-sheet-campos .reg-chip-grid + .reg-sheet-label {
    margin-top: var(--sp-2);
}

.reg-sheet-label,
.reg-campo-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--cor-texto-secundario);
}

/* --- Página no celular --- */
@media (max-width: 768px) {
    .registros-scope.main-container {
        min-height: 0;
        padding-top: var(--sp-4);
        padding-bottom: calc(56px + var(--sp-4)) !important; /* o último card não fica sob o Fab */
    }

    .registros-scope .registros-wrapper {
        max-width: 100%;
        gap: var(--sp-4);
    }

    .registros-scope .column-scroll-content {
        padding-top: 0;
    }

    /* Barra do Caderno */
    .registros-scope .reg-m-toolbar {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
    }

    .registros-scope .reg-m-search {
        position: relative;
        display: flex;
        align-items: center;
    }

    .registros-scope .reg-m-search i {
        position: absolute;
        left: var(--sp-3);
        color: var(--cor-texto-secundario);
        pointer-events: none;
    }

    .registros-scope .reg-m-search input {
        width: 100%;
        height: var(--tap-min);
        padding: 0 var(--sp-3) 0 calc(var(--sp-6) + var(--sp-2));
        border: 1px solid var(--cor-borda);
        border-radius: 12px;
        background: var(--cor-card-principal);
        color: var(--cor-texto-principal);
        outline: none;
        box-sizing: border-box;
    }

    .registros-scope .reg-m-search input:focus {
        border-color: var(--cor-azul-primario);
    }

    .registros-scope .reg-m-chips {
        display: flex;
        gap: var(--sp-2);
        overflow-x: auto;
        scrollbar-width: none;
        overscroll-behavior-x: contain;
    }

    /* Acordeões e notas em 1 coluna (o card mantém o selo flutuante) */
    .registros-scope .group-accordion {
        margin-bottom: var(--sp-5);
    }

    .registros-scope .accordion-header {
        min-height: 48px;
        padding: var(--sp-2) 0;
        gap: var(--sp-3);
    }

    .registros-scope .header-title-wrapper {
        min-width: 0;
        font-size: 0.875rem;
    }

    .registros-scope .header-title-wrapper > span:last-child {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .registros-scope .accordion-content-padding {
        padding-top: 0;
    }

    .registros-scope .notes-grid {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--sp-3);
        padding-top: var(--sp-1); /* + margin-top do card = espaço do selo (22px + anel de 4px) */
    }

    .registros-scope .anotacao-card {
        margin-top: var(--sp-5);
        padding: var(--sp-6) var(--sp-4) var(--sp-4);
        gap: var(--sp-2);
    }

    .registros-scope .anotacao-header {
        gap: var(--sp-2);
    }

    .registros-scope .anotacao-footer {
        padding-top: var(--sp-2);
    }

    .registros-scope .footer-pin-btn {
        min-width: var(--tap-min);
        min-height: var(--tap-min);
        justify-content: center;
    }

    .registros-scope .reg-card-more {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        margin: calc(-1 * var(--sp-2)) calc(-1 * var(--sp-3)) 0 0;
        display: grid;
        place-items: center;
        border: none;
        border-radius: 12px;
        background: transparent;
        color: var(--cor-texto-secundario);
        font-size: 1rem;
        cursor: pointer;
    }

    .registros-scope .empty-state {
        padding: var(--sp-6) var(--sp-4);
    }

    /* Modais da página (todos viram sheet pelo BaseModal) */
    .registros-scope .modal-header,
    .registros-scope .view-modal-header {
        padding: var(--sp-3) var(--sp-4);
        gap: var(--sp-3);
    }

    .registros-scope.is-sheet-full .modal-header,
    .registros-scope.is-sheet-full .view-modal-header {
        border-radius: 0;
    }

    .registros-scope .modal-header h2 {
        font-size: 1.15rem;
        min-width: 0;
    }

    .registros-scope .close-btn {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
    }

    .registros-scope .modal-body {
        padding: var(--sp-4);
        gap: var(--sp-4);
    }

    .registros-scope .form-row {
        flex-direction: column;
        gap: var(--sp-4);
    }

    .registros-scope .modal-footer,
    .registros-scope .modal-footer-custom {
        padding: var(--sp-3) var(--sp-4);
        gap: var(--sp-2);
    }

    .registros-scope .modal-footer > .btn-primary,
    .registros-scope .modal-footer > .btn-secondary,
    .registros-scope .modal-footer-custom > .btn-primary,
    .registros-scope .modal-footer-custom > .btn-secondary {
        flex: 1;
        min-height: 48px;
    }

    /* .modal-footer-custom (Anotação/Hábito) fixo como o .modal-footer nos sheets */
    .registros-scope.modal-overlay.is-sheet > .modal-content > .modal-footer-custom,
    .registros-scope.modal-overlay.is-sheet > .modal-content > form > .modal-footer-custom {
        flex-shrink: 0;
        padding-bottom: calc(var(--sp-3) + var(--safe-bottom));
    }

    .registros-scope.modal-overlay.is-sheet > .modal-content:has(> .modal-footer-custom, > form > .modal-footer-custom) {
        padding-bottom: 0;
    }

    /* GrupoModal: cores à vista */
    .registros-scope .grupo-cores-m {
        display: grid;
        grid-template-columns: repeat(auto-fill, var(--tap-min));
        gap: var(--sp-2);
    }

    .registros-scope .grupo-cor-m {
        width: var(--tap-min);
        height: var(--tap-min);
        border-radius: 12px;
        border: 2px solid transparent;
        cursor: pointer;
    }

    .registros-scope .grupo-cor-m.selected {
        border-color: var(--cor-texto-principal);
        box-shadow: 0 0 0 2px var(--cor-azul-primario);
    }

    .registros-scope .grupo-cores-vazio {
        margin: 0;
        font-size: 0.875rem;
        color: var(--cor-texto-secundario);
    }
}

/* --- Sem hover (celular e tablet): ações sempre visíveis e sem "levantada" presa --- */
@media (hover: none) {
    .registros-scope .anotacao-actions,
    .registros-scope .dropdown-item-actions,
    .registros-scope .jk-habit-actions {
        opacity: 1;
    }

    .registros-scope .selo-card:hover .selo-badge {
        transform: none;
    }
}
```

- [ ] **Step 9: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs` → Expected: todos passam (1 + 11).
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (`registros.png`, `modal-nota.png`, as 9 bases de Registros e "ações só no hover"). Se `registros-dropdown-grupos.png` ou `modal-grupo.png` mudar, o ramo desktop do `GrupoModal` divergiu do original: compare com `git diff` e corrija.
Run: `npm run e2e -- --project=mobile` → Expected: tudo passa (os specs do shell continuam verdes).
Run: `npm run build` → OK.
Run: `npx eslint src/pages/Registros` → Expected: 4 errors (os mesmos) e nenhum novo.

- [ ] **Step 10: Conferência visual de espaçamento (390px)**

Rode `npm run dev`, abra `/registros` no DevTools em 390×844 e confira contra a tela 3 aprovada: 16px de gutter; 16px entre abas, busca e acordeões; 8px entre a busca e os chips; 24px entre acordeões; 12px entre cards (o selo de 44px não encosta no card de cima nem é cortado); dentro do card, 8px entre título, prévia e rodapé; "⋯" alinhado ao topo direito do card. Selo, título, data e prévia iguais aos do desktop.

- [ ] **Step 11: Commit**

```bash
git add bussola_web/src/pages/Registros bussola_web/e2e/registros.mobile.spec.mjs
git commit -m "feat(web): Registros no celular - abas segmentadas, Fab por aba e Caderno com chips, grupos e menu no card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Editor de nota em tela cheia e visualização com "⋯"

**Files:**
- Create: `bussola_web/src/pages/Registros/mobile/GrupoPickerSheet.jsx`
- Modify: `bussola_web/src/pages/Registros/components/AnotacaoModal.jsx`, `bussola_web/src/pages/Registros/components/ViewAnotacaoModal.jsx`, `bussola_web/src/pages/Registros/styles/markdown.css`, `bussola_web/src/pages/Registros/styles/registros-mobile.css`, `bussola_web/e2e/registros.mobile.spec.mjs`

**Interfaces:**
- Consumes: `Sheet`, `ActionSheet`, `BaseModal sheet="full"`, `.reg-chip`/`.reg-opcao` (Task 2).
- Produces:
  - `GrupoPickerSheet({ open, onClose, grupos, value, onChange })` → `Sheet.reg-sheet` "Grupo" com `button.reg-opcao[role=option][aria-selected]` ("Sem Grupo" + grupos).
  - Editor no celular: `.modal-content.nota-editor` com `.nota-m-topbar` (`Fechar`, `Fixar no topo`[aria-pressed], `Pré-visualizar`[aria-pressed], `Salvar`), título `[aria-label="Título"]`, chip `.nota-m-grupo`, toolbar `.md-toolbar[data-offscreen-ok]` com botões `aria-label` sem atalho ("Negrito", "Itálico"…).
  - Visualização no celular: `button[aria-label="Mais ações"]` → ActionSheet ("Copiar Markdown" quando for markdown, "Copiar texto", "Baixar PDF"); `button[aria-label="Fechar"]`.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/registros.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 3 — editor de nota e visualização
// ---------------------------------------------------------------------------
test.describe('editor e visualização de nota', () => {
  test('Fab → tela cheia com ✕ · fixar · preview · Salvar, sem dica de atalhos e sem foco automático', async ({ page }) => {
    await gotoApp(page, '/registros');
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await expect(ov).toBeVisible();
    const top = ov.locator('.nota-m-topbar');
    for (const nome of ['Fechar', 'Fixar no topo', 'Pré-visualizar', 'Salvar']) {
      await expect(top.getByRole('button', { name: nome, exact: true })).toBeVisible();
    }
    await expect(ov.getByText('Ctrl+B negrito', { exact: false })).toBeHidden();
    await expect(ov.locator('.modal-footer-custom')).toBeHidden();
    expect(await focoEmCampo(page)).toBe(false);
    // barra de formatação: uma linha só, rolável, botões de 40px
    const btns = ov.locator('.md-toolbar .md-toolbar-btn');
    const tops = await btns.evaluateAll((bs) => [...new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)))]);
    expect(tops).toHaveLength(1);
    const alturas = await btns.evaluateAll((bs) => [...new Set(bs.map((b) => Math.round(b.getBoundingClientRect().height)))]);
    expect(alturas).toEqual([40]);
    expect(await ov.locator('.md-toolbar').evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    // 40px é exceção aprovada só para a barra de formatação
    expect((await smallTargets(page, '.modal-overlay.is-sheet-full')).filter((s) => !s.includes('md-toolbar-btn'))).toEqual([]);
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await overflowOffenders(page)).toEqual([]);
  });

  test('editor com teclado (--vvh 420): barra de formatação acima do teclado e Salvar visível', async ({ page }) => {
    await gotoApp(page, '/registros');
    await teclado(page);
    await page.locator('.app-fab').click();
    const tb = page.locator('.nota-editor .md-toolbar');
    await expect.poll(async () => { const b = await tb.boundingBox(); return b && Math.round(b.y + b.height); }).toBeLessThanOrEqual(421);
    const salvar = await page.locator('.nota-m-topbar').getByRole('button', { name: 'Salvar', exact: true }).boundingBox();
    expect(salvar.y).toBeGreaterThanOrEqual(0);
    expect((await page.locator('.nota-editor .md-textarea').boundingBox()).height).toBeGreaterThanOrEqual(88);
  });

  test('grupo em chip abre sheet; formatar, fixar e salvar a nota', async ({ page, request }) => {
    await gotoApp(page, '/registros');
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await ov.getByRole('textbox', { name: 'Título' }).fill('E2E nota editor');
    await ov.locator('.nota-m-grupo').click();
    const picker = page.locator('.reg-sheet');
    await expect(picker.getByRole('option', { name: 'Sem Grupo' })).toBeVisible();
    await picker.getByRole('option', { name: 'Estudos' }).click();
    await expect(picker).toHaveCount(0);
    await expect(ov.locator('.nota-m-grupo')).toContainText('Estudos');
    const ta = ov.locator('.md-textarea');
    await ta.fill('texto');
    await ta.evaluate((e) => e.setSelectionRange(5, 5));
    await ov.getByRole('button', { name: 'Negrito' }).click();
    await expect(ta).toHaveValue('texto****');
    await ov.getByRole('button', { name: 'Fixar no topo' }).click();
    await expect(ov.getByRole('button', { name: 'Fixar no topo' })).toHaveAttribute('aria-pressed', 'true');
    await ov.getByRole('button', { name: 'Pré-visualizar' }).click();
    await expect(ov.locator('.md-preview-inner')).toBeVisible();
    await expect(ov.locator('.md-toolbar')).toHaveCount(0);
    await ov.getByRole('button', { name: 'Pré-visualizar' }).click();
    await ov.locator('.nota-m-topbar').getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(ov).toHaveCount(0);
    const nota = await notaPorTitulo(request, 'E2E nota editor');
    expect(nota).toMatchObject({ conteudo: 'texto****', fixado: true, grupo: { nome: 'Estudos' } });
  });

  test('ver nota: tela cheia; ⋯ com copiar/PDF e cópia confirmada por toast', async ({ page, context, request }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await criarNota(request, { titulo: 'E2E ver nota', conteudo: '# Olá\n\ntexto da nota', fixado: true });
    await gotoApp(page, '/registros');
    await page.locator('.accordion-wrapper.open .anotacao-card', { hasText: 'E2E ver nota' }).first().click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await expect(ov.locator('.view-modal')).toBeVisible();
    await expect(ov.getByRole('button', { name: 'Fechar' }).first()).toBeVisible();
    expect(await smallTargets(page, '.modal-overlay.is-sheet-full')).toEqual([]);
    await ov.getByRole('button', { name: 'Mais ações' }).click();
    const acoes = page.locator('.action-sheet');
    await expect(acoes.locator('.action-sheet-item')).toHaveText(['Copiar Markdown', 'Copiar texto', 'Baixar PDF', 'Cancelar']);
    await acoes.getByRole('button', { name: 'Copiar texto' }).click();
    await expect(page.locator('.toast-container')).toContainText('Copiado');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Olá');
    await ov.locator('.modal-footer').getByRole('button', { name: /Editar Nota/ }).click();
    await expect(page.locator('.nota-editor')).toBeVisible();
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs -g "editor e visualização"`
Expected: FAIL (não há `.is-sheet-full`, `.nota-m-topbar`, "Mais ações").

- [ ] **Step 2: Sheet de escolha do grupo**

Criar `bussola_web/src/pages/Registros/mobile/GrupoPickerSheet.jsx`:

```jsx
import { Sheet } from '../../../components/mobile/Sheet';

/** Escolha do grupo da nota no celular (lista com o ponto de cor). */
export function GrupoPickerSheet({ open, onClose, grupos, value, onChange }) {
    const opcoes = [{ id: '', nome: 'Sem Grupo', cor: null }, ...grupos];
    return (
        <Sheet open={open} onClose={onClose} title="Grupo" className="reg-sheet">
            <div className="reg-opcoes" role="listbox" aria-label="Grupo da nota">
                {opcoes.map((g) => {
                    const sel = String(value ?? '') === String(g.id);
                    return (
                        <button
                            key={g.id || 'sem-grupo'}
                            type="button"
                            role="option"
                            aria-selected={sel}
                            className={`reg-opcao ${sel ? 'selected' : ''}`}
                            onClick={() => { onChange(g.id); onClose(); }}
                        >
                            <span
                                className="reg-chip-dot"
                                style={{ backgroundColor: g.cor || 'transparent', borderColor: g.cor ? 'transparent' : 'var(--cor-borda)' }}
                            ></span>
                            <span>{g.nome}</span>
                            {sel && <i className="fa-solid fa-check" aria-hidden="true"></i>}
                        </button>
                    );
                })}
            </div>
        </Sheet>
    );
}
```

- [ ] **Step 3: Editor de nota no celular**

Em `bussola_web/src/pages/Registros/components/AnotacaoModal.jsx`:

1. Trocar `import { MarkdownViewer } from './MarkdownViewer';` por:

```js
import { MarkdownViewer } from './MarkdownViewer';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { GrupoPickerSheet } from '../mobile/GrupoPickerSheet';
```

2. Trocar `    const [dropdownOpen, setDropdownOpen] = useState(false);` por:

```js
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [grupoSheetOpen, setGrupoSheetOpen] = useState(false);
    const isMobile = useIsMobile();
```

3. Trocar

```jsx
    return (
        <BaseModal onClose={closeModal} className="registros-scope">
            <div
                className={`modal-content large-modal${isFullscreen ? ' md-modal-fullscreen' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ─────────────────────────────────── */}
                <div className="modal-header">
```

por

```jsx
    return (
        <>
        <BaseModal onClose={closeModal} className="registros-scope" sheet="full">
            <div
                className={`modal-content large-modal nota-editor${isFullscreen ? ' md-modal-fullscreen' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ─────────────────────────────────── */}
                {isMobile ? (
                    <div className="nota-m-topbar">
                        <button type="button" className="nota-m-icon" onClick={closeModal} aria-label="Fechar">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                        <span className="nota-m-titulo">{editingData ? 'Editar nota' : 'Nova nota'}</span>
                        <button
                            type="button"
                            className={`nota-m-icon ${fixado ? 'is-on' : ''}`}
                            onClick={() => setFixado(f => !f)}
                            aria-pressed={fixado}
                            aria-label="Fixar no topo"
                        >
                            <i className="fa-solid fa-thumbtack"></i>
                        </button>
                        <button
                            type="button"
                            className={`nota-m-icon ${editorMode === 'preview' ? 'is-on' : ''}`}
                            onClick={() => setEditorMode(m => (m === 'preview' ? 'edit' : 'preview'))}
                            aria-pressed={editorMode === 'preview'}
                            aria-label="Pré-visualizar"
                        >
                            <i className={`fa-solid ${editorMode === 'preview' ? 'fa-pen' : 'fa-eye'}`}></i>
                        </button>
                        <button type="button" className="btn-primary nota-m-salvar" onClick={handleSave} disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                ) : (
                <div className="modal-header">
```

4. Trocar

```jsx
                        <span className="close-btn" onClick={closeModal}>&times;</span>
                    </div>
                </div>
```

por

```jsx
                        <span className="close-btn" onClick={closeModal}>&times;</span>
                    </div>
                </div>
                )}
```

5. Trocar

```jsx
                    {/* Título + Grupo */}
                    <div className="form-row">
```

por

```jsx
                    {/* Título + Grupo */}
                    {isMobile ? (
                        <div className="nota-m-campos">
                            <input
                                type="text"
                                className="form-input nota-m-titulo-input"
                                placeholder="Título"
                                aria-label="Título"
                                value={titulo}
                                onChange={e => setTitulo(e.target.value)}
                            />
                            <button
                                type="button"
                                className="reg-chip nota-m-grupo"
                                onClick={() => setGrupoSheetOpen(true)}
                                aria-haspopup="dialog"
                                aria-label={`Grupo: ${selectedLabel}`}
                            >
                                {selectedColor && <span className="reg-chip-dot" style={{ backgroundColor: selectedColor }}></span>}
                                <span>{selectedLabel}</span>
                                <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
                            </button>
                        </div>
                    ) : (
                    <div className="form-row">
```

6. Trocar (fim do `form-row` de Título + Grupo)

```jsx
                        </div>
                    </div>

                    {/* ── Editor Markdown ──────────────────── */}
```

por

```jsx
                        </div>
                    </div>
                    )}

                    {/* ── Editor Markdown ──────────────────── */}
```

7. Trocar `                                <div className="md-toolbar">` por:

```jsx
                                <div className="md-toolbar" data-offscreen-ok>
```

8. Trocar

```jsx
                                                    title={action.title}
                                                    style={action.style || {}}
```

por

```jsx
                                                    title={action.title}
                                                    aria-label={isMobile ? action.title.replace(/ \(Ctrl\+[A-Z]\)$/, '') : undefined}
                                                    style={action.style || {}}
```

9. Trocar o fim do componente

```jsx
                </div>
            </div>
        </BaseModal>
    );
}
```

por

```jsx
                </div>
            </div>
        </BaseModal>
        {isMobile && (
            <GrupoPickerSheet
                open={grupoSheetOpen}
                onClose={() => setGrupoSheetOpen(false)}
                grupos={gruposDisponiveis}
                value={grupoId}
                onChange={setGrupoId}
            />
        )}
        </>
    );
}
```

(O rodapé `.modal-footer-custom`, as abas Escrever/Preview com a dica de atalhos, o rótulo "Conteúdo" e a barra de status ficam no DOM e são escondidos pelo CSS no celular; o fixar e o Salvar estão na barra superior.)

- [ ] **Step 4: Visualização da nota no celular**

Em `bussola_web/src/pages/Registros/components/ViewAnotacaoModal.jsx`:

1. Trocar `import { BaseModal } from '../../../components/BaseModal';` por:

```js
import { BaseModal } from '../../../components/BaseModal';
import { ActionSheet } from '../../../components/mobile/ActionSheet';
import { useIsMobile } from '../../../hooks/useIsMobile';
```

2. Trocar

```js
    const [pdfLoading, setPdfLoading] = useState(false);
    const { addToast } = useToast();
```

por

```js
    const [pdfLoading, setPdfLoading] = useState(false);
    const [menuAberto, setMenuAberto] = useState(false);
    const { addToast } = useToast();
    const isMobile = useIsMobile();
```

3. Trocar

```js
            await navigator.clipboard.writeText(text);
            setCopyState(type);
            setTimeout(() => setCopyState(null), 2000);
        } catch (e) {
            logger.error("Erro ao copiar", { error: String(e) });
        }
```

por

```js
            await navigator.clipboard.writeText(text);
            setCopyState(type);
            setTimeout(() => setCopyState(null), 2000);
            // No celular o feedback vem por toast (o ActionSheet já fechou).
            if (isMobile) addToast({ type: 'success', title: 'Copiado', description: type === 'md' ? 'Markdown copiado.' : 'Texto copiado.' });
        } catch (e) {
            logger.error("Erro ao copiar", { error: String(e) });
            if (isMobile) addToast({ type: 'error', title: 'Erro', description: 'Não foi possível copiar.' });
        }
```

4. Trocar

```jsx
        <BaseModal onClose={closeModal} className="registros-scope">
            <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
```

por

```jsx
        <>
        <BaseModal onClose={closeModal} className="registros-scope" sheet="full">
            <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
```

5. Trocar `                        <span className="close-btn" onClick={closeModal} title="Fechar">&times;</span>` por:

```jsx
                        {isMobile ? (
                            <div className="view-m-acoes">
                                <button type="button" className="reg-icon-btn" aria-label="Mais ações" onClick={() => setMenuAberto(true)}>
                                    <i className="fa-solid fa-ellipsis"></i>
                                </button>
                                <button type="button" className="reg-icon-btn" aria-label="Fechar" onClick={closeModal}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        ) : (
                            <span className="close-btn" onClick={closeModal} title="Fechar">&times;</span>
                        )}
```

6. Trocar

```jsx
                            {/* Botões de cópia */}
                            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
```

por

```jsx
                            {/* Botões de cópia (no celular ficam no "⋯") */}
                            {!isMobile && (
                            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
```

7. Trocar

```jsx
                                        : <><i className="fa-solid fa-download"></i> Download</>
                                    }
                                </button>
                            </div>
```

por

```jsx
                                        : <><i className="fa-solid fa-download"></i> Download</>
                                    }
                                </button>
                            </div>
                            )}
```

8. Trocar o fim do componente

```jsx
                </div>
            </div>
        </BaseModal>
    );
}
```

por

```jsx
                </div>
            </div>
        </BaseModal>
        {isMobile && (
            <ActionSheet
                open={menuAberto}
                onClose={() => setMenuAberto(false)}
                title={nota.titulo}
                icon="fa-solid fa-note-sticky"
                actions={[
                    ...(!conteudoIsHtml ? [{ key: 'md', icon: 'fa-brands fa-markdown', label: 'Copiar Markdown', onClick: () => handleCopy('md') }] : []),
                    { key: 'texto', icon: 'fa-regular fa-copy', label: 'Copiar texto', onClick: () => handleCopy('text') },
                    { key: 'pdf', icon: 'fa-solid fa-download', label: pdfLoading ? 'Gerando PDF...' : 'Baixar PDF', onClick: handleDownloadPdf },
                ]}
            />
        )}
        </>
    );
}
```

- [ ] **Step 5: `dvh` no modo tela cheia do editor (desktop)**

Em `bussola_web/src/pages/Registros/styles/markdown.css`, trocar

```css
    height: 100vh !important;
    max-height: 100vh !important;
```

por

```css
    height: 100vh !important;
    height: 100dvh !important;
    max-height: 100vh !important;
    max-height: 100dvh !important;
```

- [ ] **Step 6: CSS do editor e da visualização**

Ao final de `bussola_web/src/pages/Registros/styles/registros-mobile.css`, adicionar:

```css
/* --- Editor de nota (sheet cheio) e visualização --- */
@media (max-width: 768px) {
    .registros-scope .nota-m-topbar {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: var(--sp-2);
        border-bottom: 1px solid var(--cor-borda);
        background: var(--cor-card-secundario);
        flex-shrink: 0;
    }

    .registros-scope .nota-m-icon {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        display: grid;
        place-items: center;
        border: none;
        border-radius: 12px;
        background: transparent;
        color: var(--cor-texto-secundario);
        font-size: 1.05rem;
        cursor: pointer;
    }

    .registros-scope .nota-m-icon.is-on {
        color: var(--cor-azul-primario);
        background: rgba(var(--cor-tema-rgb), 0.14);
    }

    .registros-scope .nota-m-titulo {
        flex: 1;
        min-width: 0;
        font-size: 0.9375rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .registros-scope .nota-m-salvar {
        min-height: var(--tap-min);
        padding: 0 var(--sp-4);
        border-radius: 12px;
        flex-shrink: 0;
    }

    /* Corpo: campos em cima e o editor ocupando o resto até o rodapé do sheet */
    .registros-scope .nota-editor > .modal-body {
        gap: var(--sp-3);
        padding-bottom: 0;
    }

    .registros-scope .nota-editor > .modal-footer-custom,
    .registros-scope .nota-editor .editor-container > label,
    .registros-scope .nota-editor .md-editor-tabs,
    .registros-scope .nota-editor .md-status-bar {
        display: none;
    }

    .registros-scope .nota-m-campos {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        flex-shrink: 0;
    }

    .registros-scope .nota-m-titulo-input {
        font-weight: 600;
        padding-right: var(--sp-3);
    }

    .registros-scope .nota-m-grupo {
        align-self: flex-start;
        max-width: 100%;
    }

    .registros-scope .nota-m-grupo > span:not(.reg-chip-dot) {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .registros-scope .nota-editor .editor-container {
        flex: 1 1 auto;
        min-height: 0;
        margin: 0 calc(-1 * var(--sp-4));
    }

    .registros-scope .nota-editor .md-editor-wrapper,
    .registros-scope .nota-editor .md-editor-wrapper:focus-within {
        border: none;
        border-radius: 0;
        box-shadow: none;
    }

    .registros-scope .nota-editor .md-textarea,
    .registros-scope .nota-editor .md-preview-inner {
        min-height: 0;
        padding: var(--sp-3) var(--sp-4);
    }

    /* Barra de formatação: uma linha rolável, no rodapé do sheet (logo acima do teclado) */
    .registros-scope .nota-editor .md-toolbar {
        order: 2;
        flex-wrap: nowrap;
        flex-shrink: 0;
        overflow-x: auto;
        gap: var(--sp-1);
        padding: var(--sp-1) var(--sp-2);
        border-top: 1px solid var(--cor-borda);
        border-bottom: none;
        scrollbar-width: none;
        overscroll-behavior-x: contain;
    }

    .registros-scope .nota-editor .md-toolbar-btn {
        flex-shrink: 0;
        min-width: 40px;
        height: 40px;
        font-size: 1rem;
        border-radius: 10px;
    }

    .registros-scope .nota-editor .md-toolbar-sep {
        flex-shrink: 0;
    }

    /* Visualização */
    .registros-scope .view-header-top-row {
        gap: var(--sp-3);
        margin-bottom: var(--sp-3);
    }

    .registros-scope .view-m-acoes {
        display: flex;
        gap: var(--sp-2);
        flex-shrink: 0;
    }

    .registros-scope .view-title {
        font-size: 1.35rem;
    }

    .registros-scope .view-modal .modal-body {
        padding: var(--sp-4);
    }
}
```

- [ ] **Step 7: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs` → Expected: todos passam.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa, incluindo `modal-nota.png` (desktop-visual) e `modal-ver-nota.png`. Se mudarem, um ramo desktop do JSX divergiu do original (compare com `git diff`).
Run: `npm run build` → OK. Run: `npx eslint src/pages/Registros` → 4 errors, nenhum novo.

- [ ] **Step 8: Conferência visual (390px, com e sem teclado)**

No DevTools em 390×844: barra superior ✕ · "Nova nota" · alfinete · olho · Salvar numa linha, com 8px entre os botões; título e chip de grupo com 8px entre si e 12px até o texto; a barra de formatação encostada no rodapé, de borda a borda, rolando de lado; nenhuma dica de atalho. Ao focar o texto no celular real, a barra fica logo acima do teclado. Na visualização: badge, título e data como no desktop, "⋯" e ✕ de 44px no canto.

- [ ] **Step 9: Commit**

```bash
git add bussola_web/src/pages/Registros bussola_web/e2e/registros.mobile.spec.mjs
git commit -m "feat(web): editor de nota em tela cheia com barra de formatacao acima do teclado e visualizacao com menu" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tarefas no celular (uma coluna por vez, chips, quick-add, "⋯", filtros, toque longo)

**Files:**
- Create: `bussola_web/src/pages/Registros/components/kanban/BoardMobileBar.jsx`, `bussola_web/src/pages/Registros/components/kanban/BoardFiltroSheet.jsx`, `bussola_web/src/pages/Registros/components/kanban/BoardCardActions.jsx`
- Replace: `bussola_web/src/pages/Registros/components/kanban/TarefaBoard.jsx`, `bussola_web/src/pages/Registros/components/kanban/BoardColumn.jsx`, `bussola_web/src/pages/Registros/components/kanban/BoardCard.jsx`
- Modify: `bussola_web/src/pages/Registros/styles/kanban.css`, `bussola_web/src/pages/Registros/styles/registros-mobile.css`, `bussola_web/e2e/registros.mobile.spec.mjs`

**Interfaces:**
- Consumes: `COLUNAS`, `COL_KEYS`, `keyToStatus`, `statusToKey`, `PRIO_COLORS` (`columns.js`); `reordenarTarefas(status, ids)`, `deleteTarefa(id)`; `Sheet`, `ActionSheet`, `.reg-chip`, `.reg-opcao` (Task 2).
- Produces:
  - `BoardMobileBar({ contagens: number[5], ativa, onSelect(idx), filtrosAtivos, onFiltro })` → `div.kb-m-bar` com `div.kb-m-chips[role=tablist][data-offscreen-ok]` de `button.kb-m-chip[role=tab][aria-label="<Coluna>, N tarefa(s)"][aria-selected]` e `button.kb-m-filtro[aria-label="Filtros"|"Filtros (N ativos)"]`.
  - `BoardFiltroSheet({ open, onClose, busca, onBusca, prio, onPrio, prios })` → `Sheet.reg-sheet` "Filtrar tarefas" (searchbox "Buscar", chips de prioridade, rodapé "Limpar" · "Ver tarefas").
  - `BoardCardActions({ tarefa, onClose, onAbrir(t), onMover(t, status), onExcluir(t) })` → ActionSheet (Abrir / Mover para… / Excluir) + `Sheet.reg-sheet` "Mover para".
  - `BoardColumn` ganha `onCardMenu?`; `BoardCard` ganha `onMenu?` (`button.kb-card-menu[aria-label="Ações de <título>"]`, não inicia arraste).
  - `TarefaBoard`: sensores `MouseSensor` (6px) + `TouchSensor` (250ms, 5px) + teclado; `.kb-board[data-offscreen-ok]` (todas as larguras) com `--kb-top` medido no celular.

- [ ] **Step 1: Testes que falham**

Em `bussola_web/e2e/registros.mobile.spec.mjs`, trocar `const ABAS_VERIFICADAS = ['Caderno'];` por `const ABAS_VERIFICADAS = ['Caderno', 'Tarefas'];` e, ao final do arquivo, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 4 — Tarefas
// ---------------------------------------------------------------------------
const NOMES_COLUNAS = ['A Fazer', 'Em Andamento', 'Bloqueado', 'Concluído', 'Cancelado'];
const CHAVES_COLUNAS = ['a_fazer', 'em_andamento', 'bloqueado', 'concluido', 'cancelado'];
const rotuloChip = (nome, n) => `${nome}, ${n} ${n === 1 ? 'tarefa' : 'tarefas'}`;

async function abrirTarefas(page) {
  await gotoApp(page, '/registros');
  await abrirAba(page, 'Tarefas');
  await page.locator('.kb-board').waitFor();
}

async function irParaColuna(page, idx) {
  await page.locator('.kb-m-chip').nth(idx).click();
  await expect(page.locator('.kb-m-chip').nth(idx)).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.locator('.kb-board').evaluate((e) => Math.round(e.scrollLeft / e.clientWidth))).toBe(idx);
}

test.describe('Tarefas', () => {
  test('chips com contagem por status; uma coluna por vez; chip ↔ swipe', async ({ page, request }) => {
    const board = await apiJson(request, 'GET', '/registros/tarefas/board');
    await abrirTarefas(page);
    await expect(page.locator('.kb-toolbar')).toHaveCount(0);
    const chips = page.locator('.kb-m-chip');
    await expect(chips).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) await expect(chips.nth(i)).toHaveAttribute('aria-label', rotuloChip(NOMES_COLUNAS[i], board[CHAVES_COLUNAS[i]].length));
    await expect(chips.first()).toHaveAttribute('aria-selected', 'true');
    const b = await page.locator('.kb-board').boundingBox();
    const c = await page.locator('.kb-column').first().boundingBox();
    expect(Math.round(c.width)).toBe(Math.round(b.width));
    await irParaColuna(page, 3);
    await page.locator('.kb-board').evaluate((e) => e.scrollTo({ left: e.clientWidth, behavior: 'instant' }));
    await expect(chips.nth(1)).toHaveAttribute('aria-selected', 'true');
  });

  test('o quadro cabe na tela: cada coluna rola por dentro e a página não rola', async ({ page }) => {
    await abrirTarefas(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(4);
    const corpo = page.locator('.kb-column').first().locator('.kb-column-body');
    expect(await corpo.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
    const quadro = await page.locator('.kb-board').boundingBox();
    expect(quadro.y + quadro.height).toBeLessThanOrEqual(844 - 64);
  });

  test('quick-add no topo da coluna cria a tarefa no status da coluna', async ({ page, request }) => {
    await abrirTarefas(page);
    const aFazer = page.locator('.kb-column').first();
    const add = await aFazer.getByRole('button', { name: 'Nova tarefa' }).boundingBox();
    const card = await aFazer.locator('.kb-card').first().boundingBox();
    expect(add.y).toBeLessThan(card.y);
    await irParaColuna(page, 1);
    const col = page.locator('.kb-column').nth(1);
    await col.getByRole('button', { name: 'Nova tarefa' }).click();
    const campo = col.getByRole('textbox', { name: 'Nova tarefa em Em Andamento' });
    await campo.fill('E2E quick-add');
    await campo.press('Enter');
    await expect(col.locator('.kb-card', { hasText: 'E2E quick-add' })).toBeVisible();
    expect((await tarefaPorTitulo(request, 'E2E quick-add')).status).toBe('Em andamento');
  });

  test('card do board: ⋯ abre Abrir / Mover para… / Excluir; mover e excluir', async ({ page, request }) => {
    await criarTarefa(request, { titulo: 'E2E menu card', status: 'Em andamento' });
    await abrirTarefas(page);
    await irParaColuna(page, 1);
    const card = page.locator('.kb-card', { hasText: 'E2E menu card' });
    const mais = card.getByRole('button', { name: 'Ações de E2E menu card' });
    const b = await mais.boundingBox();
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    await mais.click();
    await expect(page.locator('.modal-overlay:not(.app-sheet-overlay)')).toHaveCount(0); // não abriu o detalhe
    const acoes = page.locator('.action-sheet');
    await expect(acoes.locator('.action-sheet-item')).toHaveText(['Abrir', 'Mover para…', 'Excluir', 'Cancelar']);
    await acoes.getByRole('button', { name: 'Mover para…' }).click();
    const mover = page.locator('.reg-sheet');
    await expect(mover.locator('.reg-opcao')).toHaveText(['A Fazer', 'Bloqueado', 'Concluído', 'Cancelado']);
    await mover.getByRole('button', { name: 'Bloqueado' }).click();
    await expect.poll(async () => (await tarefaPorTitulo(request, 'E2E menu card'))?.status).toBe('Bloqueado');
    await expect(page.locator('.kb-m-chip').nth(2)).toHaveAttribute('aria-label', rotuloChip('Bloqueado', 1));
    await irParaColuna(page, 2);
    await page.locator('.kb-card', { hasText: 'E2E menu card' }).getByRole('button', { name: /^Ações de/ }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir' }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Excluir' }).click();
    await expect.poll(() => tarefaPorTitulo(request, 'E2E menu card')).toBeNull();
  });

  test('filtros em sheet: busca e prioridade com contador', async ({ page, request }) => {
    await criarTarefa(request, { titulo: 'E2E filtro crítico', prioridade: 'Crítica' });
    await abrirTarefas(page);
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    const sheet = page.locator('.reg-sheet');
    await sheet.getByRole('searchbox', { name: 'Buscar' }).fill('E2E filtro');
    await expect(page.locator('.kb-column').first().locator('.kb-card:visible')).toHaveCount(1);
    await sheet.getByRole('button', { name: 'Crítica' }).click();
    await expect(sheet.getByRole('button', { name: 'Crítica' })).toHaveAttribute('aria-pressed', 'true');
    await sheet.getByRole('button', { name: 'Ver tarefas' }).click();
    await expect(page.getByRole('button', { name: 'Filtros (2 ativos)' })).toBeVisible();
    await expect(page.locator('.kb-m-chip').first()).toHaveAttribute('aria-label', rotuloChip('A Fazer', 1));
    await page.getByRole('button', { name: 'Filtros (2 ativos)' }).click();
    await page.locator('.reg-sheet').getByRole('button', { name: 'Limpar' }).click();
    await page.locator('.reg-sheet').getByRole('button', { name: 'Ver tarefas' }).click();
    await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible();
  });

  test('arrastar só com toque longo: gesto rápido não arrasta; 350ms parado arrasta', async ({ page, request }) => {
    await criarTarefa(request, { titulo: 'E2E toque longo', status: 'Cancelado' }); // coluna só com ela: soltar não reordena o seed
    await abrirTarefas(page);
    await irParaColuna(page, 4);
    const card = page.locator('.kb-card', { hasText: 'E2E toque longo' });
    const b = await card.boundingBox();
    const x = b.x + b.width / 3;
    const y = b.y + b.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const toque = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] });
    await toque('touchStart', x, y);
    await toque('touchMove', x, y + 30);
    await toque('touchEnd');
    await expect(page.locator('.kb-card--overlay')).toHaveCount(0);
    await toque('touchStart', x, y);
    await page.waitForTimeout(350);
    await toque('touchMove', x, y + 10);
    await toque('touchMove', x, y + 20);
    await expect(page.locator('.kb-card--overlay')).toHaveCount(1);
    await toque('touchEnd');
    await expect(page.locator('.kb-card--overlay')).toHaveCount(0);
    expect(await card.evaluate((e) => getComputedStyle(e).touchAction)).toBe('manipulation');
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs`
Expected: os testes de "Tarefas" e os de overflow/alvos (agora com a aba Tarefas) FAIL; os demais passam.

- [ ] **Step 2: Barra de chips do celular**

Criar `bussola_web/src/pages/Registros/components/kanban/BoardMobileBar.jsx`:

```jsx
import { useEffect, useRef } from 'react';
import { COLUNAS } from './columns';

/** Celular: chips de status (com contagem) que levam à coluna e o botão de filtros. */
export function BoardMobileBar({ contagens, ativa, onSelect, filtrosAtivos, onFiltro }) {
    const chipsRef = useRef(null);

    // Mantém o chip da coluna visível à vista quando o swipe muda a coluna.
    useEffect(() => {
        chipsRef.current?.children[ativa]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }, [ativa]);

    return (
        <div className="kb-m-bar">
            <div className="kb-m-chips" role="tablist" aria-label="Colunas do quadro" ref={chipsRef} data-offscreen-ok>
                {COLUNAS.map((col, i) => (
                    <button
                        key={col.key}
                        type="button"
                        role="tab"
                        aria-selected={ativa === i}
                        aria-label={`${col.label}, ${contagens[i]} ${contagens[i] === 1 ? 'tarefa' : 'tarefas'}`}
                        className={`kb-m-chip ${ativa === i ? 'active' : ''}`}
                        style={{ '--kb-accent': col.accent }}
                        onClick={() => onSelect(i)}
                    >
                        <span className="kb-m-chip-dot" aria-hidden="true"></span>
                        <span>{col.label}</span>
                        <span className="kb-m-chip-count" aria-hidden="true">{contagens[i]}</span>
                    </button>
                ))}
            </div>
            <button
                type="button"
                className={`kb-m-filtro ${filtrosAtivos ? 'active' : ''}`}
                onClick={onFiltro}
                aria-haspopup="dialog"
                aria-label={filtrosAtivos ? `Filtros (${filtrosAtivos} ativos)` : 'Filtros'}
            >
                <i className="fa-solid fa-sliders"></i>
                {filtrosAtivos > 0 && <span className="kb-m-badge" aria-hidden="true">{filtrosAtivos}</span>}
            </button>
        </div>
    );
}
```

- [ ] **Step 3: Sheet de filtros**

Criar `bussola_web/src/pages/Registros/components/kanban/BoardFiltroSheet.jsx`:

```jsx
import { Sheet } from '../../../../components/mobile/Sheet';
import { PRIO_COLORS } from './columns';

/** Celular: busca e prioridade do quadro num sheet (aplicação imediata; o quadro atualiza por trás). */
export function BoardFiltroSheet({ open, onClose, busca, onBusca, prio, onPrio, prios }) {
    return (
        <Sheet
            open={open}
            onClose={onClose}
            title="Filtrar tarefas"
            className="reg-sheet"
            footer={(
                <>
                    <button type="button" className="btn-secondary" onClick={() => { onBusca(''); onPrio('Todas'); }}>Limpar</button>
                    <button type="button" className="btn-primary" onClick={onClose}>Ver tarefas</button>
                </>
            )}
        >
            <div className="reg-sheet-campos">
                <label className="reg-sheet-label" htmlFor="kb-m-busca">Buscar</label>
                <input
                    id="kb-m-busca"
                    type="search"
                    className="form-input"
                    value={busca}
                    onChange={(e) => onBusca(e.target.value)}
                    placeholder="Título ou detalhes..."
                    enterKeyHint="search"
                />
                <span className="reg-sheet-label">Prioridade</span>
                <div className="reg-chip-grid" role="group" aria-label="Prioridade">
                    {prios.map((p) => (
                        <button
                            key={p}
                            type="button"
                            className={`reg-chip ${prio === p ? 'active' : ''}`}
                            aria-pressed={prio === p}
                            onClick={() => onPrio(p)}
                        >
                            {p !== 'Todas' && <span className="reg-chip-dot" style={{ backgroundColor: PRIO_COLORS[p] }}></span>}
                            <span>{p}</span>
                        </button>
                    ))}
                </div>
            </div>
        </Sheet>
    );
}
```

- [ ] **Step 4: Ações do card e sheet "Mover para"**

Criar `bussola_web/src/pages/Registros/components/kanban/BoardCardActions.jsx`:

```jsx
import { useState } from 'react';
import { ActionSheet } from '../../../../components/mobile/ActionSheet';
import { Sheet } from '../../../../components/mobile/Sheet';
import { COLUNAS, statusToKey } from './columns';

/** Celular: ações do card (Abrir / Mover para… / Excluir) e o sheet com as colunas de destino. */
export function BoardCardActions({ tarefa, onClose, onAbrir, onMover, onExcluir }) {
    const [movendo, setMovendo] = useState(null);
    const colAtual = tarefa ? COLUNAS.find((c) => c.key === statusToKey(tarefa.status)) : null;

    return (
        <>
            <ActionSheet
                open={!!tarefa}
                onClose={onClose}
                title={tarefa?.titulo}
                subtitle={colAtual?.label}
                icon="fa-solid fa-list-check"
                actions={tarefa ? [
                    { key: 'abrir', icon: 'fa-solid fa-pen-to-square', label: 'Abrir', onClick: () => onAbrir(tarefa) },
                    { key: 'mover', icon: 'fa-solid fa-arrow-right', label: 'Mover para…', onClick: () => setMovendo(tarefa) },
                    { key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: () => onExcluir(tarefa) },
                ] : []}
            />
            <Sheet open={!!movendo} onClose={() => setMovendo(null)} title="Mover para" className="reg-sheet">
                <div className="reg-opcoes">
                    {movendo && COLUNAS.filter((c) => c.status !== movendo.status).map((c) => (
                        <button
                            key={c.key}
                            type="button"
                            className="reg-opcao"
                            onClick={() => { const t = movendo; setMovendo(null); onMover(t, c.status); }}
                        >
                            <span className="reg-chip-dot" style={{ backgroundColor: c.accent }}></span>
                            <span>{c.label}</span>
                        </button>
                    ))}
                </div>
            </Sheet>
        </>
    );
}
```

- [ ] **Step 5: Card com "⋯" que não inicia arraste**

Substituir todo o conteúdo de `bussola_web/src/pages/Registros/components/kanban/BoardCard.jsx` por:

```jsx
import React, { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PRIO_COLORS } from './columns';

function contarSubtarefas(subs) {
    let total = 0, feitas = 0;
    const walk = (items) => {
        if (!items) return;
        for (const it of items) {
            total += 1;
            if (it.concluido) feitas += 1;
            if (it.subtarefas?.length) walk(it.subtarefas);
        }
    };
    walk(subs);
    return { total, feitas, pct: total ? Math.round((feitas / total) * 100) : 0 };
}

function formatarPrazo(prazo) {
    if (!prazo) return null;
    return new Date(prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// `overlay` = render sem sortable (usado no DragOverlay).
// Desliga a animação de layout: em coluna grande (~86 cards) animar o transform
// de todos os itens por frame é o que trava o arraste.
const semAnimacao = () => false;

// O "⋯" fica dentro do card arrastável: segura os eventos que os sensores
// (mouse, toque e teclado) escutam no card, para o toque no botão não virar arraste.
const pararArraste = (e) => e.stopPropagation();

function BoardCardBase({ tarefa, onClick, hidden = false, overlay = false, onMenu }) {
    const sortable = useSortable({ id: tarefa.id, disabled: overlay, animateLayoutChanges: semAnimacao });
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

    // Cálculos pesados memoizados: durante o arraste o dnd-kit re-renderiza cada
    // item por frame; sem isso, a árvore de subtarefas seria percorrida 86x/frame.
    const prog = useMemo(() => contarSubtarefas(tarefa.subtarefas), [tarefa.subtarefas]);
    const prazo = useMemo(() => formatarPrazo(tarefa.prazo), [tarefa.prazo]);
    const atrasado = useMemo(
        () => tarefa.prazo && new Date(tarefa.prazo) < new Date() && tarefa.status !== 'Concluído',
        [tarefa.prazo, tarefa.status],
    );
    const prioColor = PRIO_COLORS[tarefa.prioridade] || PRIO_COLORS['Média'];

    const style = overlay ? undefined : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div
            ref={overlay ? undefined : setNodeRef}
            style={style}
            className={`kb-card ${overlay ? 'kb-card--overlay' : ''} ${hidden ? 'kb-card--hidden' : ''}`}
            onClick={() => { if (!isDragging) onClick(tarefa); }}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
        >
            <span className="kb-card-prio" style={{ backgroundColor: prioColor }}></span>
            <div className="kb-card-body">
                <div className="kb-card-top">
                    <h4 className="kb-card-title">{tarefa.titulo}</h4>
                    {tarefa.fixado && <i className="fa-solid fa-thumbtack kb-card-pin"></i>}
                    {onMenu && (
                        <button
                            type="button"
                            className="kb-card-menu"
                            aria-label={`Ações de ${tarefa.titulo}`}
                            onClick={(e) => { e.stopPropagation(); onMenu(tarefa); }}
                            onMouseDown={pararArraste}
                            onTouchStart={pararArraste}
                            onKeyDown={pararArraste}
                        >
                            <i className="fa-solid fa-ellipsis"></i>
                        </button>
                    )}
                </div>
                <div className="kb-card-meta">
                    {prazo && (
                        <span className={`kb-chip ${atrasado ? 'kb-chip--late' : ''}`}>
                            <i className="fa-regular fa-calendar"></i> {prazo}
                        </span>
                    )}
                    {prog.total > 0 && (
                        <span className="kb-chip kb-chip--prog" title={`${prog.feitas}/${prog.total} etapas`}>
                            <i className="fa-solid fa-list-check"></i> {prog.feitas}/{prog.total}
                        </span>
                    )}
                </div>
                {prog.total > 0 && (
                    <div className="kb-card-progress">
                        <div className="kb-card-progress-fill" style={{ width: `${prog.pct}%` }}></div>
                    </div>
                )}
            </div>
        </div>
    );
}

// React.memo evita re-render vindo do pai (setState de onDragOver / filtros)
// para os cards cujas props não mudaram.
export const BoardCard = React.memo(BoardCardBase);
```

- [ ] **Step 6: Coluna com quick-add no topo no celular**

Substituir todo o conteúdo de `bussola_web/src/pages/Registros/components/kanban/BoardColumn.jsx` por:

```jsx
import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { BoardCard } from './BoardCard';

function BoardColumnBase({ coluna, tarefas, cardVisivel, onCardClick, onQuickAdd, onCardMenu }) {
    const { setNodeRef, isOver } = useDroppable({ id: coluna.key });
    const isMobile = useIsMobile();
    const [adding, setAdding] = useState(false);
    const [titulo, setTitulo] = useState('');

    const confirmar = () => {
        if (titulo.trim()) onQuickAdd(coluna.status, titulo.trim());
        setTitulo('');
        setAdding(false);
    };

    const cancelar = () => { setAdding(false); setTitulo(''); };

    const visiveis = tarefas.filter(cardVisivel);

    // No celular o quick-add fica no topo da coluna; no desktop, depois dos cards.
    const quickAdd = adding && (
        <div className="kb-quickadd">
            <textarea
                className="form-input" autoFocus value={titulo}
                onChange={e => setTitulo(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmar(); }
                    if (e.key === 'Escape') cancelar();
                }}
                placeholder="Título da tarefa..."
                aria-label={isMobile ? `Nova tarefa em ${coluna.label}` : undefined}
                enterKeyHint={isMobile ? 'done' : undefined}
            />
            <div className="kb-quickadd-actions">
                <button className="btn-primary kb-mini" onClick={confirmar} aria-label={isMobile ? 'Adicionar tarefa' : undefined}><i className="fa-solid fa-check"></i></button>
                <button className="btn-secondary kb-mini" onClick={cancelar} aria-label={isMobile ? 'Cancelar' : undefined}><i className="fa-solid fa-xmark"></i></button>
            </div>
        </div>
    );

    return (
        <div className="kb-column" role={isMobile ? 'tabpanel' : undefined} aria-label={isMobile ? coluna.label : undefined}>
            <div className="kb-column-head">
                <span className="kb-column-accent" style={{ backgroundColor: coluna.accent }}></span>
                <span className="kb-column-label">{coluna.label}</span>
                <span className="kb-column-count">{tarefas.length}</span>
                <button className="kb-column-add" onClick={() => setAdding(true)} title="Nova tarefa"><i className="fa-solid fa-plus"></i></button>
            </div>

            <div ref={setNodeRef} className={`kb-column-body ${isOver ? 'kb-column-body--over' : ''}`}>
                {isMobile && !adding && (
                    <button type="button" className="kb-column-addtop" onClick={() => setAdding(true)}>
                        <i className="fa-solid fa-plus"></i> Nova tarefa
                    </button>
                )}
                {isMobile && quickAdd}

                <SortableContext items={tarefas.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tarefas.map(t => (
                        <BoardCard key={t.id} tarefa={t} onClick={onCardClick} hidden={!cardVisivel(t)} onMenu={onCardMenu} />
                    ))}
                </SortableContext>

                {visiveis.length === 0 && !adding && (
                    <div className="kb-column-empty">{isMobile ? 'Nenhuma tarefa aqui' : 'Solte aqui'}</div>
                )}

                {!isMobile && quickAdd}
            </div>

            {!adding && !isMobile && (
                <button className="kb-column-addfoot" onClick={() => setAdding(true)}>
                    <i className="fa-solid fa-plus"></i> Nova tarefa
                </button>
            )}
        </div>
    );
}

// Colunas cujo array `tarefas` não mudou de referência não re-renderizam
// (num drag cross-coluna, só 2 das 4 mudam).
export const BoardColumn = React.memo(BoardColumnBase);
```

- [ ] **Step 7: Quadro (sensores, uma coluna por vez, ações e filtros do celular)**

Substituir todo o conteúdo de `bussola_web/src/pages/Registros/components/kanban/TarefaBoard.jsx` por:

```jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor,
    useSensor, useSensors, pointerWithin, rectIntersection,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { getTarefasBoard, reordenarTarefas, createTarefa, deleteTarefa } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import { useConfirm } from '../../../../context/ConfirmDialogContext';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { logger } from '../../../../utils/logger';
import { COLUNAS, COL_KEYS, keyToStatus, statusToKey } from './columns';
import { BoardColumn } from './BoardColumn';
import { BoardCard } from './BoardCard';
import { TarefaDetailPanel } from './TarefaDetailPanel';
import { BoardMobileBar } from './BoardMobileBar';
import { BoardFiltroSheet } from './BoardFiltroSheet';
import { BoardCardActions } from './BoardCardActions';
import '../../styles/kanban.css';

const VAZIO = { a_fazer: [], em_andamento: [], bloqueado: [], concluido: [], cancelado: [] };
const PRIOS = ['Todas', 'Crítica', 'Alta', 'Média', 'Baixa'];

// Detecção por ponteiro primeiro (enxerga colunas VAZIAS, que o closestCorners
// ignora) com fallback por interseção de retângulos.
const detectarColisao = (args) => {
    const porPonteiro = pointerWithin(args);
    return porPonteiro.length > 0 ? porPonteiro : rectIntersection(args);
};

export function TarefaBoard({ novaRef }) {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const isMobile = useIsMobile();
    const [colunas, setColunas] = useState(VAZIO);
    const [loading, setLoading] = useState(true);
    const [activeTarefa, setActiveTarefa] = useState(null);

    const [busca, setBusca] = useState('');
    const [filtroPrio, setFiltroPrio] = useState('Todas');

    const [panelAberto, setPanelAberto] = useState(false);
    const [panelTarefa, setPanelTarefa] = useState(null);

    // Celular: coluna visível, sheet de filtros e card com o "⋯" aberto.
    const [colAtiva, setColAtiva] = useState(0);
    const [filtroAberto, setFiltroAberto] = useState(false);
    const [menuTarefa, setMenuTarefa] = useState(null);
    const boardRef = useRef(null);

    // Mouse: arrasta depois de 6px. Toque: só com toque longo (250ms parado, até 5px);
    // antes disso o gesto é rolagem/swipe. (O PointerSensor também capturava o toque.)
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const carregar = useCallback(async () => {
        try {
            const data = await getTarefasBoard();
            setColunas({
                a_fazer: data.a_fazer, em_andamento: data.em_andamento,
                bloqueado: data.bloqueado, concluido: data.concluido, cancelado: data.cancelado,
            });
        } catch (e) {
            logger.error('Erro ao carregar board', { error: String(e) });
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar tarefas.' });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { carregar(); }, [carregar]);

    const containerDoId = (id, estado) => {
        if (COL_KEYS.includes(id)) return id;
        return COL_KEYS.find(k => estado[k].some(t => t.id === id));
    };

    const onDragStart = ({ active }) => {
        const k = containerDoId(active.id, colunas);
        const t = k && colunas[k].find(x => x.id === active.id);
        setActiveTarefa(t || null);
    };

    const onDragOver = ({ active, over }) => {
        if (!over) return;
        setColunas(prev => {
            const from = containerDoId(active.id, prev);
            const to = containerDoId(over.id, prev);
            if (!from || !to || from === to) return prev;

            const item = prev[from].find(t => t.id === active.id);
            if (!item) return prev;

            const origem = prev[from].filter(t => t.id !== active.id);
            const destino = [...prev[to]];
            const overIndex = destino.findIndex(t => t.id === over.id);
            const insertAt = overIndex >= 0 ? overIndex : destino.length;
            destino.splice(insertAt, 0, { ...item, status: keyToStatus(to) });

            return { ...prev, [from]: origem, [to]: destino };
        });
    };

    const onDragEnd = ({ active, over }) => {
        setActiveTarefa(null);
        if (!over) return;

        const to = containerDoId(over.id, colunas);
        if (!to) return;

        let idsDestino = null;
        setColunas(prev => {
            const lista = [...prev[to]];
            const oldIndex = lista.findIndex(t => t.id === active.id);
            const newIndex = lista.findIndex(t => t.id === over.id);
            let final = lista;
            if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
                final = arrayMove(lista, oldIndex, newIndex);
            }
            idsDestino = final.map(t => t.id);
            return { ...prev, [to]: final };
        });

        if (idsDestino) {
            reordenarTarefas(keyToStatus(to), idsDestino).catch((e) => {
                logger.error('Erro ao reordenar', { error: String(e) });
                addToast({ type: 'error', title: 'Erro', description: 'Não consegui salvar a mudança.' });
                carregar(); // rollback: recarrega o estado do servidor
            });
        }
    };

    const quickAdd = useCallback(async (statusDestino, titulo) => {
        try {
            await createTarefa({ titulo, status: statusDestino });
            carregar();
        } catch (e) {
            logger.error('Erro no quick-add', { error: String(e) });
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao criar tarefa.' });
        }
    }, [carregar, addToast]);

    const abrirNova = useCallback(() => { setPanelTarefa(null); setPanelAberto(true); }, []);
    const abrirCard = useCallback((t) => { setPanelTarefa(t); setPanelAberto(true); }, []);

    // Expõe "abrir nova tarefa" pro botão que vive no cabeçalho da página.
    useEffect(() => {
        if (novaRef) novaRef.current = abrirNova;
        return () => { if (novaRef) novaRef.current = null; };
    }, [novaRef, abrirNova]);

    // Estável durante o arraste (só muda quando busca/filtro mudam), pra não
    // invalidar o memo dos cards a cada frame.
    const cardVisivel = useCallback((t) => {
        if (filtroPrio !== 'Todas' && t.prioridade !== filtroPrio) return false;
        if (busca) {
            const term = busca.toLowerCase();
            const emTitulo = t.titulo?.toLowerCase().includes(term);
            const emDesc = t.descricao?.toLowerCase().includes(term);
            if (!emTitulo && !emDesc) return false;
        }
        return true;
    }, [busca, filtroPrio]);

    // --- Celular: uma coluna por vez. O chip leva à coluna; o swipe (scroll-snap) atualiza o chip. ---
    const irParaColuna = useCallback((idx) => {
        setColAtiva(idx);
        const el = boardRef.current;
        if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
    }, []);

    const onBoardScroll = useCallback((e) => {
        const el = e.currentTarget;
        if (!el.clientWidth) return;
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        setColAtiva((prev) => (prev === idx ? prev : idx));
    }, []);

    // Altura do quadro no celular: do topo dele até acima da barra inferior; cada coluna rola por dentro.
    useEffect(() => {
        const el = boardRef.current;
        if (!isMobile || !el) return undefined;
        const medir = () => {
            el.style.setProperty('--kb-top', `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
        };
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, [isMobile, loading]);

    // "Mover para…": vai para o fim da coluna de destino (mesmo padrão do soltar numa coluna).
    const moverPara = useCallback(async (tarefa, statusDestino) => {
        const from = COL_KEYS.find((k) => colunas[k].some((t) => t.id === tarefa.id));
        const to = statusToKey(statusDestino);
        if (!from || from === to) return;
        const idsDestino = [...colunas[to].map((t) => t.id), tarefa.id];
        setColunas((prev) => ({
            ...prev,
            [from]: prev[from].filter((t) => t.id !== tarefa.id),
            [to]: [...prev[to], { ...tarefa, status: statusDestino }],
        }));
        try {
            await reordenarTarefas(statusDestino, idsDestino);
            const destino = COLUNAS.find((c) => c.key === to).label;
            addToast({ type: 'success', title: 'Tarefa movida', description: `Agora em ${destino}.` });
        } catch (e) {
            logger.error('Erro ao mover tarefa', { error: String(e) });
            addToast({ type: 'error', title: 'Erro', description: 'Não consegui mover a tarefa.' });
            carregar();
        }
    }, [colunas, addToast, carregar]);

    const excluirTarefa = useCallback(async (tarefa) => {
        const ok = await confirm({ title: 'Excluir tarefa?', description: 'Isso remove a tarefa e todas as sub-etapas.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try {
            await deleteTarefa(tarefa.id);
            addToast({ type: 'success', title: 'Excluída', description: 'Tarefa removida.' });
            carregar();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao excluir.' });
        }
    }, [confirm, addToast, carregar]);

    const contagens = COLUNAS.map((c) => colunas[c.key].filter(cardVisivel).length);
    const filtrosAtivos = (busca ? 1 : 0) + (filtroPrio !== 'Todas' ? 1 : 0);

    return (
        <div className="kb-board-scope">
            {isMobile ? (
                <BoardMobileBar
                    contagens={contagens}
                    ativa={colAtiva}
                    onSelect={irParaColuna}
                    filtrosAtivos={filtrosAtivos}
                    onFiltro={() => setFiltroAberto(true)}
                />
            ) : (
                <div className="kb-toolbar">
                    <div className="kb-toolbar-search">
                        <i className="fa-solid fa-magnifying-glass"></i>
                        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tarefa..." />
                    </div>
                    <select className="kb-toolbar-select" value={filtroPrio} onChange={e => setFiltroPrio(e.target.value)}>
                        {PRIOS.map(p => <option key={p} value={p}>{p === 'Todas' ? 'Prioridade' : p}</option>)}
                    </select>
                </div>
            )}

            {loading ? (
                <div className="kb-loading"><i className="fa-solid fa-circle-notch fa-spin"></i> Carregando board...</div>
            ) : (
                <DndContext
                    sensors={sensors} collisionDetection={detectarColisao}
                    onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
                >
                    {/* data-offscreen-ok: as colunas fora da tela fazem parte de um carrossel rolável */}
                    <div className="kb-board" ref={boardRef} data-offscreen-ok onScroll={isMobile ? onBoardScroll : undefined}>
                        {COLUNAS.map(col => (
                            <BoardColumn
                                key={col.key} coluna={col} tarefas={colunas[col.key]}
                                cardVisivel={cardVisivel} onCardClick={abrirCard} onQuickAdd={quickAdd}
                                onCardMenu={isMobile ? setMenuTarefa : undefined}
                            />
                        ))}
                    </div>
                    <DragOverlay>
                        {activeTarefa ? <BoardCard tarefa={activeTarefa} onClick={() => {}} overlay /> : null}
                    </DragOverlay>
                </DndContext>
            )}

            <TarefaDetailPanel
                aberto={panelAberto} tarefa={panelTarefa}
                onClose={() => setPanelAberto(false)} onSaved={carregar}
            />

            {isMobile && (
                <>
                    <BoardFiltroSheet
                        open={filtroAberto}
                        onClose={() => setFiltroAberto(false)}
                        busca={busca}
                        onBusca={setBusca}
                        prio={filtroPrio}
                        onPrio={setFiltroPrio}
                        prios={PRIOS}
                    />
                    <BoardCardActions
                        tarefa={menuTarefa}
                        onClose={() => setMenuTarefa(null)}
                        onAbrir={abrirCard}
                        onMover={moverPara}
                        onExcluir={excluirTarefa}
                    />
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 8: Gate de hover do card no `kanban.css`**

Em `bussola_web/src/pages/Registros/styles/kanban.css`, trocar

```css
.kb-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.18); }
```

por

```css
@media (hover: hover) and (pointer: fine) {
    .kb-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.18); }
}
```

- [ ] **Step 9: CSS do quadro no celular e no toque**

Ao final de `bussola_web/src/pages/Registros/styles/registros-mobile.css`, adicionar:

```css
/* --- Tarefas: uma coluna por vez --- */
@media (max-width: 768px) {
    .registros-scope.main-container.reg-m-tarefas {
        padding-bottom: 0 !important; /* o quadro já desconta a barra inferior: a página não rola */
    }

    .registros-scope .kb-board-scope {
        gap: var(--sp-3);
        max-width: none;
    }

    .registros-scope .kb-m-bar {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
    }

    .registros-scope .kb-m-chips {
        flex: 1;
        min-width: 0;
        display: flex;
        gap: var(--sp-2);
        overflow-x: auto;
        scrollbar-width: none;
        overscroll-behavior-x: contain;
    }

    .registros-scope .kb-m-chip {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
        min-height: var(--tap-min);
        padding: 0 var(--sp-3);
        border: 1px solid var(--cor-borda);
        border-radius: 999px;
        background: var(--cor-card-principal);
        color: var(--cor-texto-secundario);
        font: inherit;
        font-size: 0.875rem;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
    }

    .registros-scope .kb-m-chip.active {
        color: var(--cor-texto-principal);
        border-color: var(--kb-accent);
        background: color-mix(in srgb, var(--kb-accent) 14%, var(--cor-card-principal));
    }

    .registros-scope .kb-m-chip-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--kb-accent);
    }

    .registros-scope .kb-m-chip-count {
        min-width: 24px;
        padding: 0 var(--sp-1);
        border-radius: 999px;
        background: var(--cor-card-secundario);
        color: var(--cor-texto-secundario);
        font-size: 0.75rem;
        text-align: center;
    }

    .registros-scope .kb-m-filtro {
        position: relative;
        flex-shrink: 0;
        width: var(--tap-min);
        height: var(--tap-min);
        display: grid;
        place-items: center;
        border: 1px solid var(--cor-borda);
        border-radius: 12px;
        background: var(--cor-card-principal);
        color: var(--cor-texto-principal);
        font-size: 1rem;
        cursor: pointer;
    }

    .registros-scope .kb-m-filtro.active {
        border-color: var(--cor-azul-primario);
        color: var(--cor-azul-primario);
    }

    .registros-scope .kb-m-badge {
        position: absolute;
        top: calc(-1 * var(--sp-1));
        right: calc(-1 * var(--sp-1));
        min-width: 18px;
        height: 18px;
        padding: 0 var(--sp-1);
        border-radius: 999px;
        background: var(--cor-azul-primario);
        color: #fff;
        font-size: 0.6875rem;
        font-weight: 700;
        display: grid;
        place-items: center;
    }

    /* Carrossel de colunas (scroll-snap) com altura até a barra inferior */
    .registros-scope .kb-board {
        flex: none;
        gap: 0;
        padding-bottom: 0;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
        height: calc(var(--vvh, 100dvh) - var(--kb-top, 240px) - var(--bottom-nav-h) - var(--safe-bottom) - var(--sp-4));
        min-height: 320px;
    }

    .registros-scope .kb-column {
        flex: 0 0 100%;
        min-width: 0;
        max-width: none;
        scroll-snap-align: start;
        scroll-snap-stop: always;
        background: transparent;
        border: none;
        border-radius: 0;
    }

    .registros-scope .kb-column-head,
    .registros-scope .kb-column-addfoot {
        display: none;
    }

    .registros-scope .kb-column-body {
        gap: var(--sp-3);
        padding: 0 0 calc(56px + var(--sp-4)); /* o último card não fica sob o Fab */
        border-radius: 0;
        overscroll-behavior-y: contain;
    }

    .registros-scope .kb-column-addtop {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        min-height: var(--tap-min);
        padding: 0 var(--sp-3);
        border: 1px dashed var(--cor-borda);
        border-radius: 12px;
        background: transparent;
        color: var(--cor-texto-secundario);
        font: inherit;
        font-size: 0.875rem;
        cursor: pointer;
    }

    .registros-scope .kb-quickadd {
        flex-shrink: 0;
        gap: var(--sp-2);
        padding: var(--sp-2);
    }

    .registros-scope .kb-quickadd-actions {
        gap: var(--sp-2);
    }

    .registros-scope .kb-mini {
        width: var(--tap-min);
        height: var(--tap-min);
    }

    .registros-scope .kb-column-empty {
        padding: var(--sp-5) var(--sp-4);
        font-size: 0.875rem;
    }

    .registros-scope .kb-card {
        flex-shrink: 0; /* overflow:hidden zeraria o tamanho mínimo dentro da coluna rolável */
    }

    .registros-scope .kb-card-body {
        padding: var(--sp-3);
    }

    .registros-scope .kb-card-top {
        align-items: flex-start;
    }

    .registros-scope .kb-card-title {
        font-size: 0.9375rem;
    }

    .registros-scope .kb-chip {
        font-size: 0.75rem;
        padding: var(--sp-1) var(--sp-2);
    }

    .registros-scope .kb-card-menu {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        margin: calc(-1 * var(--sp-3)) calc(-1 * var(--sp-3)) calc(-1 * var(--sp-2)) auto;
        display: grid;
        place-items: center;
        border: none;
        border-radius: 12px;
        background: transparent;
        color: var(--cor-texto-secundario);
        font-size: 1rem;
        cursor: pointer;
    }

    .registros-scope .kb-card-pin + .kb-card-menu {
        margin-left: var(--sp-1);
    }
}

/* Toque (celular e tablet): arraste só por toque longo, sem seleção/menu do sistema no card */
@media (pointer: coarse) {
    .registros-scope .kb-card {
        touch-action: manipulation;
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
    }
}
```

- [ ] **Step 10: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs` → Expected: todos passam (inclui overflow e alvos com a aba Tarefas).
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa, incluindo `registros-tarefas.png`, `modal-tarefa*.png` e "arrastar um card com o mouse muda a coluna" (agora pelo `MouseSensor`).
Run: `npm run build` → OK. Run: `npx eslint src/pages/Registros` → 4 errors, nenhum novo.

- [ ] **Step 11: Conferência visual (390px)**

No DevTools em 390×844, aba Tarefas: chips de 44px com 8px entre si e o botão de filtros à direita; a coluna ocupa toda a largura útil (16px de gutter); "+ Nova tarefa" tracejado no topo; 12px entre cards; o "⋯" no canto superior direito do card sem aumentar a altura do card em mais que ~8px; o card (barra de prioridade, chips, progresso) igual ao do desktop. Arraste a coluna de lado: ela "encaixa" na seguinte e o chip acompanha.

- [ ] **Step 12: Commit**

```bash
git add bussola_web/src/pages/Registros bussola_web/e2e/registros.mobile.spec.mjs
git commit -m "feat(web): Tarefas no celular - uma coluna por vez, chips de status, menu no card, filtros e arraste por toque longo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Detalhe da tarefa em tela cheia e subtarefas de 44px

**Files:**
- Replace: `bussola_web/src/pages/Registros/components/kanban/TarefaDetailPanel.jsx`
- Modify: `bussola_web/src/pages/Registros/styles/registros-mobile.css`, `bussola_web/e2e/registros.mobile.spec.mjs`

**Interfaces:**
- Consumes: `BaseModal sheet="full"`, `ActionSheet`, `.reg-chip`, `.reg-chip-grid`, `.reg-icon-btn`, `.reg-campo-label` (Task 2); `COLUNAS`, `PRIO_COLORS`.
- Produces: no celular, `TarefaDetailPanel` com `role="radiogroup"` de status (5) e prioridade (4) em `button.reg-chip[role=radio][aria-checked]`, `button[aria-label="Mais ações"]` (só editando) → ActionSheet "Excluir tarefa", rodapé Cancelar · Salvar/Criar. Desktop idêntico.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/registros.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 5 — detalhe da tarefa
// ---------------------------------------------------------------------------
test.describe('detalhe da tarefa', () => {
  test('tela cheia sem foco automático; status e prioridade em chips; Excluir no ⋯', async ({ page, request }) => {
    await criarTarefa(request, { titulo: 'E2E detalhe', status: 'Em andamento', prioridade: 'Alta' });
    await abrirTarefas(page);
    await irParaColuna(page, 1);
    await page.locator('.kb-card', { hasText: 'E2E detalhe' }).click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await expect(ov.getByRole('heading', { name: 'Editar Tarefa' })).toBeVisible();
    expect(await focoEmCampo(page)).toBe(false);
    await expect(ov.getByRole('radio', { name: 'Em Andamento' })).toHaveAttribute('aria-checked', 'true');
    await expect(ov.getByRole('radio', { name: 'Alta' })).toHaveAttribute('aria-checked', 'true');
    await expect(ov.locator('.modal-footer').getByRole('button', { name: /Excluir/ })).toHaveCount(0);
    expect(await smallTargets(page, '.modal-overlay.is-sheet-full')).toEqual([]);
    await ov.getByRole('radio', { name: 'Bloqueado' }).click();
    await ov.getByRole('radio', { name: 'Crítica' }).click();
    await ov.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect.poll(async () => { const t = await tarefaPorTitulo(request, 'E2E detalhe'); return t && `${t.status}|${t.prioridade}`; }).toBe('Bloqueado|Crítica');

    await irParaColuna(page, 2);
    await page.locator('.kb-card', { hasText: 'E2E detalhe' }).click();
    await page.locator('.modal-overlay.is-sheet-full').getByRole('button', { name: 'Mais ações' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir tarefa' }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Excluir' }).click();
    await expect.poll(() => tarefaPorTitulo(request, 'E2E detalhe')).toBeNull();
  });

  test('subtarefas: linhas de 44px e recuo de 12px por nível', async ({ page }) => {
    await abrirTarefas(page);
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet-full');
    await expect(ov.getByRole('heading', { name: 'Nova Tarefa' })).toBeVisible();
    await expect(ov.getByRole('button', { name: 'Mais ações' })).toHaveCount(0);
    const raiz = ov.getByPlaceholder('Adicionar etapa principal...');
    await raiz.fill('Etapa 1');
    await raiz.press('Enter');
    await ov.getByRole('button', { name: 'Sub-etapa' }).click();
    const filha = ov.getByPlaceholder('Nome da sub-etapa...');
    await filha.fill('Etapa 1.1');
    await filha.press('Enter');
    const linhas = ov.locator('.kb-tree-row');
    await expect(linhas).toHaveCount(2);
    for (const l of await linhas.all()) expect((await l.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const pai = await linhas.nth(0).boundingBox();
    const sub = await linhas.nth(1).boundingBox();
    expect(sub.x - pai.x).toBeGreaterThan(0);
    expect(sub.x - pai.x).toBeLessThanOrEqual(12.5);
    expect(await smallTargets(page, '.modal-overlay.is-sheet-full')).toEqual([]);
    await ov.getByRole('button', { name: 'Cancelar' }).click();
    await expect(ov).toHaveCount(0);
  });

  test('detalhe com teclado (--vvh 420): Criar visível', async ({ page }) => {
    await abrirTarefas(page);
    await teclado(page);
    await page.locator('.app-fab').click();
    const criar = page.locator('.modal-overlay.is-sheet-full').getByRole('button', { name: 'Criar', exact: true });
    await expect.poll(async () => { const b = await criar.boundingBox(); return b && Math.round(b.y + b.height); }).toBeLessThanOrEqual(420);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs -g "detalhe da tarefa"`
Expected: FAIL (o painel não é `is-sheet-full`, não há chips `role=radio`, o Excluir está no rodapé).

- [ ] **Step 2: Painel de detalhe**

Substituir todo o conteúdo de `bussola_web/src/pages/Registros/components/kanban/TarefaDetailPanel.jsx` por:

```jsx
import React, { useState, useEffect } from 'react';
import { createTarefa, updateTarefa, deleteTarefa } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import { useConfirm } from '../../../../context/ConfirmDialogContext';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { BaseModal } from '../../../../components/BaseModal';
import { ActionSheet } from '../../../../components/mobile/ActionSheet';
import { DatePicker } from '../../../../components/Pickers';
import { SubtaskTree } from './SubtaskTree';
import { COLUNAS, PRIO_COLORS } from './columns';

const PRIOS = ['Baixa', 'Média', 'Alta', 'Crítica'];

export function TarefaDetailPanel({ aberto, tarefa, onClose, onSaved }) {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const isMobile = useIsMobile();
    const editando = !!tarefa;

    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [prioridade, setPrioridade] = useState('Média');
    const [status, setStatus] = useState('Pendente');
    const [prazo, setPrazo] = useState('');
    const [subtarefas, setSubtarefas] = useState([]);
    const [salvando, setSalvando] = useState(false);
    const [menuAberto, setMenuAberto] = useState(false);

    // Chave "prev" pra resetar o form no render (evita setState em effect).
    const [prevId, setPrevId] = useState(null);
    const alvoId = tarefa ? tarefa.id : '__novo__';
    if (aberto && alvoId !== prevId) {
        setPrevId(alvoId);
        setTitulo(tarefa?.titulo || '');
        setDescricao(tarefa?.descricao || '');
        setPrioridade(tarefa?.prioridade || 'Média');
        setStatus(tarefa?.status || 'Pendente');
        setPrazo(tarefa?.prazo ? tarefa.prazo.split('T')[0] : '');
        setSubtarefas(tarefa?.subtarefas ? JSON.parse(JSON.stringify(tarefa.subtarefas)) : []);
        setMenuAberto(false);
    }
    useEffect(() => { if (!aberto) setPrevId(null); }, [aberto]);

    const salvar = async () => {
        if (!titulo.trim()) { addToast({ type: 'error', title: 'Ops', description: 'Dê um título à tarefa.' }); return; }
        setSalvando(true);
        try {
            const payload = { titulo, descricao, prioridade, status, prazo: prazo || null, subtarefas };
            if (editando) {
                await updateTarefa(tarefa.id, payload);
            } else {
                await createTarefa(payload);
            }
            addToast({ type: 'success', title: 'Salvo', description: 'Tarefa salva.' });
            onSaved();
            onClose();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar.' });
        } finally {
            setSalvando(false);
        }
    };

    const excluir = async () => {
        const ok = await confirm({ title: 'Excluir tarefa?', description: 'Isso remove a tarefa e todas as sub-etapas.', confirmLabel: 'Excluir', variant: 'danger' });
        if (!ok) return;
        try {
            await deleteTarefa(tarefa.id);
            addToast({ type: 'success', title: 'Excluída', description: 'Tarefa removida.' });
            onSaved();
            onClose();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao excluir.' });
        }
    };

    if (!aberto) return null;

    return (
        <>
        <BaseModal onClose={onClose} className="registros-scope" sheet="full">
            <div
                className="modal-content large-modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '620px', maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}
            >
                <div className="modal-header">
                    <h2>{editando ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
                    {isMobile ? (
                        <div className="tarefa-m-head-acoes">
                            {editando && (
                                <button type="button" className="reg-icon-btn" aria-label="Mais ações" onClick={() => setMenuAberto(true)}>
                                    <i className="fa-solid fa-ellipsis"></i>
                                </button>
                            )}
                            <button type="button" className="reg-icon-btn" aria-label="Fechar" onClick={onClose}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    ) : (
                        <span className="close-btn" onClick={onClose}>&times;</span>
                    )}
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>O que precisa ser feito?</label>
                        {/* Sem foco automático no celular: o teclado não abre sobre o painel. */}
                        <input className="form-input" value={titulo} autoFocus={!isMobile}
                            onChange={e => setTitulo(e.target.value)} placeholder="Título..." />
                    </div>

                    {isMobile ? (
                        <>
                            <div className="form-group">
                                <span className="reg-campo-label" id="tarefa-status-label">Status</span>
                                <div className="reg-chip-grid" role="radiogroup" aria-labelledby="tarefa-status-label">
                                    {COLUNAS.map(c => (
                                        <button
                                            key={c.key}
                                            type="button"
                                            role="radio"
                                            aria-checked={status === c.status}
                                            className={`reg-chip ${status === c.status ? 'active' : ''}`}
                                            onClick={() => setStatus(c.status)}
                                        >
                                            <span className="reg-chip-dot" style={{ backgroundColor: c.accent }}></span>
                                            <span>{c.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <span className="reg-campo-label" id="tarefa-prio-label">Prioridade</span>
                                <div className="reg-chip-grid" role="radiogroup" aria-labelledby="tarefa-prio-label">
                                    {PRIOS.map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            role="radio"
                                            aria-checked={prioridade === p}
                                            className={`reg-chip ${prioridade === p ? 'active' : ''}`}
                                            onClick={() => setPrioridade(p)}
                                        >
                                            <span className="reg-chip-dot" style={{ backgroundColor: PRIO_COLORS[p] }}></span>
                                            <span>{p}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Status</label>
                                <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
                                    {COLUNAS.map(c => <option key={c.key} value={c.status}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Prioridade</label>
                                <select className="form-input" value={prioridade} onChange={e => setPrioridade(e.target.value)}
                                    style={{ borderLeft: `4px solid ${PRIO_COLORS[prioridade]}` }}>
                                    {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <DatePicker label="Prazo (opcional)" value={prazo} onChange={e => setPrazo(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Detalhes</label>
                        <textarea className="form-input" style={{ height: '70px' }} value={descricao}
                            onChange={e => setDescricao(e.target.value)} placeholder="Informações adicionais..." />
                    </div>

                    <div className="form-group">
                        <label><i className="fa-solid fa-list-check"></i> Subtarefas</label>
                        <SubtaskTree subtarefas={subtarefas} onChange={setSubtarefas} />
                    </div>
                </div>

                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                    {isMobile ? (
                        <>
                            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                            <button className="btn-primary" onClick={salvar} disabled={salvando}>
                                {salvando ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}
                            </button>
                        </>
                    ) : (
                        <>
                            {editando
                                ? <button className="btn-secondary" onClick={excluir} style={{ color: 'var(--cor-vermelho-delete)' }}><i className="fa-solid fa-trash-can"></i> Excluir</button>
                                : <span />}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                                <button className="btn-primary" onClick={salvar} disabled={salvando}>
                                    {salvando ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </BaseModal>
        {isMobile && editando && (
            <ActionSheet
                open={menuAberto}
                onClose={() => setMenuAberto(false)}
                title={tarefa.titulo}
                icon="fa-solid fa-list-check"
                actions={[{ key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir tarefa', variant: 'danger', onClick: excluir }]}
            />
        )}
        </>
    );
}
```

- [ ] **Step 3: CSS do detalhe e das subtarefas**

Ao final de `bussola_web/src/pages/Registros/styles/registros-mobile.css`, adicionar:

```css
/* --- Detalhe da tarefa e subtarefas --- */
@media (max-width: 768px) {
    .registros-scope .tarefa-m-head-acoes {
        display: flex;
        gap: var(--sp-2);
        flex-shrink: 0;
    }

    .registros-scope .kb-subtree {
        gap: var(--sp-2);
    }

    .registros-scope .kb-tree-addroot,
    .registros-scope .kb-tree-add {
        gap: var(--sp-2);
    }

    .registros-scope .kb-tree-addroot .form-input,
    .registros-scope .kb-tree-add .form-input {
        flex: 1;
        min-width: 0;
    }

    .registros-scope .kb-tree-row {
        min-height: var(--tap-min);
        padding: 0;
        gap: var(--sp-1);
    }

    .registros-scope .kb-tree-check {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
    }

    .registros-scope .kb-tree-title {
        min-width: 0;
        font-size: 0.9375rem;
        overflow-wrap: anywhere;
    }

    .registros-scope .kb-icon-btn {
        width: var(--tap-min);
        height: var(--tap-min);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
    }

    /* Recuo limitado a 12px por nível (11px + 1px da linha guia) */
    .registros-scope .kb-tree-children {
        margin-left: 0;
        padding-left: calc(var(--sp-3) - 1px);
    }

    .registros-scope .kb-tree-empty {
        font-size: 0.875rem;
    }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs` → Expected: todos passam.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (`modal-tarefa.png` e `modal-tarefa-nova.png` idênticos: o ramo desktop do JSX é o original e `90dvh` = `90vh` no desktop).
Run: `npm run build` → OK. Run: `npx eslint src/pages/Registros` → 4 errors, nenhum novo.

- [ ] **Step 5: Conferência visual (390px)**

No DevTools: cabeçalho "Editar Tarefa" com "⋯" e ✕ de 44px; 16px entre os campos; chips de status/prioridade quebrando linha com 8px entre si; subtarefas com check, título e ações em 44px e cada nível recuado 12px; rodapé Cancelar · Salvar 50/50 fixo.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Registros bussola_web/e2e/registros.mobile.spec.mjs
git commit -m "feat(web): detalhe da tarefa em tela cheia com chips de status e prioridade e subtarefas de 44px" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Jornada no celular (resumo do dia, "⋯", Lista na topbar, HabitoModal e lista de hábitos)

**Files:**
- Create: `bussola_web/src/pages/Registros/mobile/JornadaResumo.jsx`
- Modify: `bussola_web/src/pages/Registros/index.jsx`, `bussola_web/src/pages/Registros/components/JornadaTimeline.jsx`, `bussola_web/src/pages/Registros/components/HabitoModal.jsx`, `bussola_web/src/pages/Registros/styles.css`, `bussola_web/src/pages/Registros/styles/registros-mobile.css`, `bussola_web/e2e/registros.mobile.spec.mjs`

**Interfaces:**
- Consumes: `contarHabitosHoje`, `formatarDataJornada` (Task 1); `TopbarActions`; `ActionSheet`.
- Produces:
  - `JornadaResumo({ habitos })` → `div.reg-m-jornada` com `p.reg-m-jornada-linha` ("Sexta-feira, 2 de out · X de Y hábitos") e `div[role=progressbar][aria-label="Hábitos de hoje"][aria-valuenow][aria-valuemax]`.
  - `HabitoCard` no celular: `button.jk-habit-more[aria-label="Ações de <título>"]` → ActionSheet (Editar / Pausar|Retomar / Excluir).
  - Topbar na aba Jornada: `button[aria-label="Lista de hábitos"]` em `.m-topbar-slot`.

- [ ] **Step 1: Testes que falham**

Em `bussola_web/e2e/registros.mobile.spec.mjs`, trocar `const ABAS_VERIFICADAS = ['Caderno', 'Tarefas'];` por `const ABAS_VERIFICADAS = ['Caderno', 'Tarefas', 'Jornada'];` e, ao final do arquivo, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 6 — Jornada
// ---------------------------------------------------------------------------
async function abrirJornada(page) {
  await gotoApp(page, '/registros');
  await abrirAba(page, 'Jornada');
  await page.locator('.jk-kanban').waitFor();
}

test.describe('Jornada', () => {
  test('linha "data · X de Y hábitos" com barra de progresso bate com a API', async ({ page, request }) => {
    const habitos = await apiJson(request, 'GET', '/registros/habitos');
    const hoje = habitos.filter((h) => h.status === 'ativo' && h.frequencia.includes('sex'));
    const feitos = hoje.filter((h) => h.registro_hoje?.concluido).length;
    await abrirJornada(page);
    await expect(page.locator('.reg-m-jornada-linha')).toHaveText(`Sexta-feira, 2 de out · ${feitos} de ${hoje.length} ${hoje.length === 1 ? 'hábito' : 'hábitos'}`);
    const barra = page.getByRole('progressbar', { name: 'Hábitos de hoje' });
    await expect(barra).toHaveAttribute('aria-valuenow', String(feitos));
    await expect(barra).toHaveAttribute('aria-valuemax', String(hoje.length));
  });

  test('check-in: círculo ≥ 44px alterna o registro do dia', async ({ page, request }) => {
    await criarHabito(request, { titulo: 'E2E check-in', horario: '10:00' });
    await abrirJornada(page);
    const circulo = page.locator('.jk-habit-row', { hasText: 'E2E check-in' }).locator('.jk-circle');
    const b = await circulo.boundingBox();
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    const checkin = (r) => r.url().includes('/checkin') && r.request().method() === 'PATCH';
    const [r1] = await Promise.all([page.waitForResponse(checkin), circulo.click()]);
    const v1 = (await r1.json()).concluido;
    const [r2] = await Promise.all([page.waitForResponse(checkin), circulo.click()]);
    expect((await r2.json()).concluido).toBe(!v1);
  });

  test('hábito: ⋯ visível com Editar / Pausar / Excluir', async ({ page, request }) => {
    await criarHabito(request, { titulo: 'E2E hábito menu', horario: '09:00' });
    await abrirJornada(page);
    const linha = page.locator('.jk-habit-row', { hasText: 'E2E hábito menu' });
    await expect(linha.locator('.jk-habit-actions')).toHaveCount(0);
    await linha.getByRole('button', { name: 'Ações de E2E hábito menu' }).click();
    const acoes = page.locator('.action-sheet');
    await expect(acoes.locator('.action-sheet-item')).toHaveText(['Editar', 'Pausar', 'Excluir', 'Cancelar']);
    await acoes.getByRole('button', { name: 'Pausar' }).click();
    await expect(linha.locator('.jk-badge-pausado')).toBeVisible();
    await linha.getByRole('button', { name: /^Ações de/ }).click();
    await expect(page.locator('.action-sheet').getByRole('button', { name: 'Retomar' })).toBeVisible();
    await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('.modal-overlay.is-sheet').getByRole('heading', { name: 'Editar Hábito' })).toBeVisible();
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Cancelar' }).click();
    await linha.getByRole('button', { name: /^Ações de/ }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir' }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'Sim, excluir' }).click();
    await expect.poll(() => habitoPorTitulo(request, 'E2E hábito menu')).toBeNull();
  });

  test('"Lista" vai para a topbar só na Jornada e abre a lista em sheet', async ({ page }) => {
    await gotoApp(page, '/registros');
    const slot = page.locator('.m-topbar-slot');
    await expect(slot.getByRole('button', { name: 'Lista de hábitos' })).toHaveCount(0);
    await abrirAba(page, 'Jornada');
    await slot.getByRole('button', { name: 'Lista de hábitos' }).click();
    const ov = page.locator('.modal-overlay.is-sheet');
    await expect(ov.getByRole('heading', { name: 'Todos os Hábitos' })).toBeVisible();
    await expect(ov.getByRole('button', { name: 'Fechar' })).toBeInViewport();
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    await ov.getByRole('button', { name: 'Fechar' }).click();
    await abrirAba(page, 'Caderno');
    await expect(slot.getByRole('button', { name: 'Lista de hábitos' })).toHaveCount(0);
  });

  test('Novo hábito: sheet rola, rodapé fixo e Criar alcançável com teclado', async ({ page }) => {
    await abrirJornada(page);
    await teclado(page);
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet');
    const criar = ov.getByRole('button', { name: 'Criar Hábito' });
    await expect.poll(async () => { const b = await criar.boundingBox(); return b && Math.round(b.y + b.height); }).toBeLessThanOrEqual(420);
    expect(await focoEmCampo(page)).toBe(false);
    const corpo = ov.locator('.modal-body');
    expect(await corpo.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
    await corpo.evaluate((e) => e.scrollTo(0, e.scrollHeight));
    await expect(ov.locator('.habito-cores-wrapper')).toBeInViewport();
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
  });

  test('criar hábito pelo form do celular (Dias úteis)', async ({ page, request }) => {
    await abrirJornada(page);
    await page.locator('.app-fab').click();
    const ov = page.locator('.modal-overlay.is-sheet');
    await ov.getByPlaceholder('Ex: Meditação matinal').fill('E2E hábito celular');
    await ov.getByRole('button', { name: 'Dias úteis' }).click();
    await ov.getByRole('button', { name: 'Criar Hábito' }).click();
    await expect.poll(async () => (await habitoPorTitulo(request, 'E2E hábito celular'))?.frequencia.join(',')).toBe('seg,ter,qua,qui,sex');
    await expect(page.locator('.jk-habit-row', { hasText: 'E2E hábito celular' })).toBeVisible();
  });

  test('Jornada: conteúdo ≥ 14px, secundário ≥ 12px, badges ≥ 11px', async ({ page }) => {
    await abrirJornada(page);
    const t = await page.evaluate(() => {
      const fs = (sel) => [...document.querySelectorAll(sel)].map((e) => parseFloat(getComputedStyle(e).fontSize));
      return { principal: [...fs('.jk-titulo'), ...fs('.reg-m-jornada-linha')], secundario: [...fs('.jk-meta'), ...fs('.jk-time')], badges: [...fs('.jk-streak'), ...fs('.jk-badge-atrasado'), ...fs('.jk-col-label')] };
    });
    expect(Math.min(...t.principal)).toBeGreaterThanOrEqual(14);
    expect(Math.min(...t.secundario)).toBeGreaterThanOrEqual(12);
    expect(Math.min(...t.badges)).toBeGreaterThanOrEqual(11);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs`
Expected: os testes de "Jornada" e os de overflow/alvos (agora com a aba Jornada) FAIL; os demais passam.

- [ ] **Step 2: Resumo do dia**

Criar `bussola_web/src/pages/Registros/mobile/JornadaResumo.jsx`:

```jsx
import { contarHabitosHoje, formatarDataJornada } from '../jornadaUtils';

/** Linha da Jornada no celular: "data · X de Y hábitos" com barra de progresso. */
export function JornadaResumo({ habitos }) {
    const { feitos, total, pct } = contarHabitosHoje(habitos);
    return (
        <div className="reg-m-jornada">
            <p className="reg-m-jornada-linha">
                {formatarDataJornada()} · {feitos} de {total} {total === 1 ? 'hábito' : 'hábitos'}
            </p>
            <div
                className="reg-m-jornada-barra"
                role="progressbar"
                aria-label="Hábitos de hoje"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={feitos}
            >
                <div className="reg-m-jornada-fill" style={{ width: `${pct}%` }}></div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Página: resumo e "Lista" na topbar**

Em `bussola_web/src/pages/Registros/index.jsx`:

1. Trocar `import { GruposSheet } from './mobile/GruposSheet';` por:

```js
import { GruposSheet } from './mobile/GruposSheet';
import { JornadaResumo } from './mobile/JornadaResumo';
import { TopbarActions } from '../../components/mobile/MobileChrome';
```

2. Trocar

```jsx
                        onOpenGrupos={() => setGruposSheetOpen(true)}
                    />
                )}
```

por

```jsx
                        onOpenGrupos={() => setGruposSheetOpen(true)}
                    />
                )}

                {isMobile && activeTab === 'jornada' && !loading && (data?.habitos?.length ?? 0) > 0 && (
                    <JornadaResumo habitos={data.habitos} />
                )}
```

3. Trocar `            {isMobile && activeTab === 'jornada' && <Fab label="Novo hábito" onClick={handleNewHabito} />}` por:

```jsx
            {isMobile && activeTab === 'jornada' && <Fab label="Novo hábito" onClick={handleNewHabito} />}
            {isMobile && activeTab === 'jornada' && (
                <TopbarActions>
                    <button type="button" aria-label="Lista de hábitos" onClick={() => setHabitoListaModalOpen(true)}>
                        <i className="fa-solid fa-list-ul"></i>
                    </button>
                </TopbarActions>
            )}
```

- [ ] **Step 4: "⋯" no HabitoCard (só no celular)**

Em `bussola_web/src/pages/Registros/components/JornadaTimeline.jsx`:

1. Trocar `import { Fragment } from 'react';` por:

```js
import { Fragment, useState } from 'react';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { ActionSheet } from '../../../components/mobile/ActionSheet';
```

2. Trocar

```jsx
function HabitoCard({ habito, isLast, onCheckin, onEdit, onTogglePause, onDelete }) {
    const hoje = getTodayKey();
```

por

```jsx
function HabitoCard({ habito, isLast, onCheckin, onEdit, onTogglePause, onDelete }) {
    const isMobile = useIsMobile();
    const [menuAberto, setMenuAberto] = useState(false);
    const hoje = getTodayKey();
```

3. Trocar

```jsx
    return (
        <div className="jk-habit-row">
```

por

```jsx
    return (
        <>
        <div className="jk-habit-row">
```

4. Trocar o bloco

```jsx
                    {/* Ações no hover */}
                    <div className="jk-habit-actions">
                        <button
                            className="btn-action-icon btn-edit"
                            onClick={e => { e.stopPropagation(); onEdit(habito); }}
                            title="Editar"
                        >
                            <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                            className="btn-action-icon btn-pause"
                            onClick={e => { e.stopPropagation(); onTogglePause(habito); }}
                            title={pausado ? 'Retomar' : 'Pausar'}
                        >
                            <i className={`fa-solid ${pausado ? 'fa-play' : 'fa-pause'}`}></i>
                        </button>
                        <button
                            className="btn-action-icon btn-delete"
                            onClick={e => { e.stopPropagation(); onDelete(habito); }}
                            title="Excluir"
                        >
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
```

por

```jsx
                    {/* Ações: no hover (desktop) ou no "⋯" (celular) */}
                    {isMobile ? (
                        <button
                            type="button"
                            className="jk-habit-more"
                            aria-label={`Ações de ${habito.titulo}`}
                            onClick={() => setMenuAberto(true)}
                        >
                            <i className="fa-solid fa-ellipsis"></i>
                        </button>
                    ) : (
                    <div className="jk-habit-actions">
                        <button
                            className="btn-action-icon btn-edit"
                            onClick={e => { e.stopPropagation(); onEdit(habito); }}
                            title="Editar"
                        >
                            <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                            className="btn-action-icon btn-pause"
                            onClick={e => { e.stopPropagation(); onTogglePause(habito); }}
                            title={pausado ? 'Retomar' : 'Pausar'}
                        >
                            <i className={`fa-solid ${pausado ? 'fa-play' : 'fa-pause'}`}></i>
                        </button>
                        <button
                            className="btn-action-icon btn-delete"
                            onClick={e => { e.stopPropagation(); onDelete(habito); }}
                            title="Excluir"
                        >
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                    )}
```

5. Trocar o fim do `HabitoCard`

```jsx
                <div className="jk-meta">
                    <span className="jk-duracao-badge"><i className="fa-regular fa-clock"></i> {habito.duracao_min}min</span>
                    {habito.descricao && <span className="jk-descricao-inline" title={habito.descricao}>{habito.descricao}</span>}
                </div>
            </div>
        </div>
    );
}
```

por

```jsx
                <div className="jk-meta">
                    <span className="jk-duracao-badge"><i className="fa-regular fa-clock"></i> {habito.duracao_min}min</span>
                    {habito.descricao && <span className="jk-descricao-inline" title={habito.descricao}>{habito.descricao}</span>}
                </div>
            </div>
        </div>
        {isMobile && (
            <ActionSheet
                open={menuAberto}
                onClose={() => setMenuAberto(false)}
                title={habito.titulo}
                subtitle={`${habito.horario} · ${habito.duracao_min}min`}
                icon="fa-solid fa-route"
                actions={[
                    { key: 'editar', icon: 'fa-solid fa-pen-to-square', label: 'Editar', onClick: () => onEdit(habito) },
                    { key: 'pausar', icon: `fa-solid ${pausado ? 'fa-play' : 'fa-pause'}`, label: pausado ? 'Retomar' : 'Pausar', onClick: () => onTogglePause(habito) },
                    { key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: () => onDelete(habito) },
                ]}
            />
        )}
        </>
    );
}
```

- [ ] **Step 5: HabitoModal (sem autofocus no celular e ganchos para o CSS)**

Em `bussola_web/src/pages/Registros/components/HabitoModal.jsx`:

1. Trocar `import { TimePicker } from '../../../components/Pickers';` por:

```js
import { TimePicker } from '../../../components/Pickers';
import { useIsMobile } from '../../../hooks/useIsMobile';
```

2. Trocar `    const { addToast } = useToast();` por:

```js
    const { addToast } = useToast();
    const isMobile = useIsMobile();
```

3. Trocar

```jsx
                                maxLength={200}
                                autoFocus
```

por

```jsx
                                maxLength={200}
                                autoFocus={!isMobile}
```

4. Trocar `                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>` por:

```jsx
                            <div className="habito-freq-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
```

5. Trocar `                                <div style={{ display: 'flex', gap: '6px' }}>` por:

```jsx
                                <div className="habito-freq-presets" style={{ display: 'flex', gap: '6px' }}>
```

- [ ] **Step 6: Gates de hover e `dvh` da Jornada no `styles.css`**

Em `bussola_web/src/pages/Registros/styles.css`:

1. Trocar

```css
.registros-scope .jk-circle:hover:not(:disabled) {
    transform: scale(1.14);
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--hcor, var(--cor-azul-primario)) 18%, transparent);
}
```

por

```css
@media (hover: hover) and (pointer: fine) {
    .registros-scope .jk-circle:hover:not(:disabled) {
        transform: scale(1.14);
        box-shadow: 0 0 0 6px color-mix(in srgb, var(--hcor, var(--cor-azul-primario)) 18%, transparent);
    }
}
```

2. Trocar `.registros-scope .habito-cor-btn:hover   { transform: scale(1.15); }` por:

```css
@media (hover: hover) and (pointer: fine) {
    .registros-scope .habito-cor-btn:hover   { transform: scale(1.15); }
}
```

3. Trocar

```css
.registros-scope .habito-cor-custom-wrapper:hover {
    border-color: var(--cor-texto-principal);
    color: var(--cor-texto-principal);
    transform: scale(1.15);
}
```

por

```css
@media (hover: hover) and (pointer: fine) {
    .registros-scope .habito-cor-custom-wrapper:hover {
        border-color: var(--cor-texto-principal);
        color: var(--cor-texto-principal);
        transform: scale(1.15);
    }
}
```

4. Trocar

```css
.registros-scope .hl-modal-content {
    width: 92vw;
    max-width: 900px;
    max-height: 90vh;
```

por

```css
.registros-scope .hl-modal-content {
    width: 92vw;
    max-width: 900px;
    max-height: 90vh;
    max-height: 90dvh;
```

- [ ] **Step 7: CSS da Jornada, do HabitoModal e da lista de hábitos**

Ao final de `bussola_web/src/pages/Registros/styles/registros-mobile.css`, adicionar:

```css
/* --- Jornada --- */
@media (max-width: 768px) {
    .registros-scope .reg-m-jornada {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
    }

    .registros-scope .reg-m-jornada-linha {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--cor-texto-principal);
    }

    .registros-scope .reg-m-jornada-barra {
        height: 8px;
        border-radius: 999px;
        background: var(--cor-borda);
        overflow: hidden;
    }

    .registros-scope .reg-m-jornada-fill {
        height: 100%;
        border-radius: 999px;
        background: var(--cor-azul-primario);
        transition: width 0.4s ease;
    }

    .registros-scope .jk-wrapper {
        gap: var(--sp-4);
        padding-bottom: 0;
    }

    .registros-scope .jk-col-header {
        padding: var(--sp-3) var(--sp-4);
    }

    .registros-scope .jk-connector {
        height: var(--sp-6);
    }

    .registros-scope .jk-habit-row {
        padding: 0 var(--sp-2);
    }

    .registros-scope .jk-habit-info {
        gap: var(--sp-1);
        padding: var(--sp-3) 0 var(--sp-3) var(--sp-3);
    }

    .registros-scope .jk-habit-header {
        gap: var(--sp-2);
    }

    .registros-scope .jk-time {
        font-size: 0.8125rem;
    }

    .registros-scope .jk-badge-pausado,
    .registros-scope .jk-badge-atrasado,
    .registros-scope .jk-streak {
        font-size: 0.6875rem;
    }

    /* Sem tooltip no toque: título e descrição quebram linha em vez de cortar */
    .registros-scope .jk-titulo {
        font-size: 0.9375rem;
        white-space: normal;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    .registros-scope .jk-meta {
        flex-wrap: wrap;
        row-gap: var(--sp-1);
        font-size: 0.75rem;
    }

    .registros-scope .jk-meta i {
        font-size: 0.6875rem;
    }

    .registros-scope .jk-descricao-inline {
        flex-basis: 100%;
        white-space: normal;
    }

    .registros-scope .jk-habit-more {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        margin: calc(-1 * var(--sp-2)) calc(-1 * var(--sp-2)) calc(-1 * var(--sp-2)) 0;
        display: grid;
        place-items: center;
        border: none;
        border-radius: 12px;
        background: transparent;
        color: var(--cor-texto-secundario);
        font-size: 1rem;
        cursor: pointer;
    }

    /* HabitoModal */
    .registros-scope .habito-freq-head {
        flex-direction: column;
        align-items: stretch !important;
        gap: var(--sp-2);
    }

    .registros-scope .habito-freq-presets {
        flex-wrap: wrap;
        gap: var(--sp-2) !important;
    }

    .registros-scope .habito-freq-preset {
        flex: 1 1 auto;
        min-height: var(--tap-min);
        padding: 0 var(--sp-3);
        font-size: 0.8125rem;
    }

    .registros-scope .habito-dias-selector {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: var(--sp-1);
    }

    .registros-scope .habito-dia-btn {
        width: auto;
        height: var(--tap-min);
        border-radius: 12px;
        font-size: 0.875rem;
    }

    .registros-scope .habito-cor-btn,
    .registros-scope .habito-cor-custom-wrapper {
        width: var(--tap-min);
        height: var(--tap-min);
    }

    .registros-scope .form-row-2col {
        gap: var(--sp-3);
    }

    /* Lista de hábitos: cabeçalho, filtro e rodapé fixos; só a lista rola */
    .registros-scope.modal-overlay.is-sheet > .hl-modal-content {
        overflow: hidden !important;
    }

    .registros-scope .hl-list-container {
        min-height: 0;
        padding: var(--sp-3) 0 var(--sp-1);
    }

    .registros-scope .hl-day-filter {
        gap: var(--sp-2);
        padding: var(--sp-3) var(--sp-4) 0;
    }

    .registros-scope .hl-day-btn {
        min-height: var(--tap-min);
        padding: 0 var(--sp-3);
        font-size: 0.8125rem;
    }

    .registros-scope .hl-day-count {
        font-size: 0.6875rem;
    }

    .registros-scope .hl-descricao {
        font-size: 0.75rem;
    }

    .registros-scope .hl-cell-actions {
        gap: var(--sp-1);
    }
}
```

- [ ] **Step 8: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/registros.mobile.spec.mjs` → Expected: todos passam.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (`registros-jornada.png`, `modal-habito.png`, `modal-habito-lista.png` idênticos).
Run: `npm run build` → OK. Run: `npx eslint src/pages/Registros` → 4 errors, nenhum novo.

- [ ] **Step 9: Conferência visual (390px)**

No DevTools, aba Jornada: abas → 16px → linha "Sexta-feira, 2 de out · X de 3 hábitos" → 8px → barra → 16px → Manhã/Tarde/Noite empilhados (layout atual); "⋯" de 44px à direita do horário sem empurrar o título; o ícone de lista na topbar ao lado do robô. Novo hábito: dias da semana em 7 colunas de 44px de altura, presets em uma linha de 44px, rodapé Cancelar · Criar Hábito fixo.

- [ ] **Step 10: Commit**

```bash
git add bussola_web/src/pages/Registros bussola_web/e2e/registros.mobile.spec.mjs
git commit -m "feat(web): Jornada no celular - resumo do dia, menu no habito, Lista na topbar e HabitoModal rolavel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tablet (769–1024), toque e verificação final

**Files:**
- Create: `bussola_web/e2e/registros.tablet.spec.mjs`
- Modify: `bussola_web/src/pages/Registros/styles/registros-mobile.css`, `bussola_web/e2e/registros.mobile.spec.mjs`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: cabeçalho de abas que quebra linha no tablet, notas em 2 colunas, menu de grupos alinhado à direita, controles de 44px com ponteiro grosso; capturas de conferência (`REG_SHOTS=1`).

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/registros.tablet.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';
import { comApi, limparRegistrosE2E } from './registros-data.mjs';

test.beforeAll(async ({ playwright }) => comApi(playwright, limparRegistrosE2E));

const aba = (page, nome) => page.locator('.tab-btn-pill', { hasText: nome }).click();

for (const w of [769, 900, 1024]) {
  test(`tablet ${w}px: cabeçalho do desktop, sem overflow nas 3 abas`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/registros');
    await expect(page.locator('.registros-main-header')).toBeVisible();
    await expect(page.locator('.m-segmented')).toHaveCount(0);
    for (const nome of ['Caderno', 'Tarefas', 'Jornada']) {
      await aba(page, nome);
      await page.waitForLoadState('networkidle');
      expect(await overflowOffenders(page), `${nome} @ ${w}px`).toEqual([]);
    }
  });
}

test('tablet: ações de nota, grupo e hábito visíveis sem hover', async ({ page }) => {
  await gotoApp(page, '/registros');
  if (!(await page.locator('.accordion-wrapper.open .anotacao-card').count())) {
    await page.locator('.accordion-header:not(.active)').first().click();
  }
  const card = page.locator('.accordion-wrapper.open .anotacao-card').first();
  await expect(card.locator('.anotacao-actions')).toHaveCSS('opacity', '1');
  await page.locator('.dropdown-trigger-btn').click();
  const menu = page.locator('.custom-dropdown-menu');
  await expect(menu.locator('.dropdown-item-actions').first()).toHaveCSS('opacity', '1');
  const m = await menu.boundingBox();
  expect(m.x).toBeGreaterThanOrEqual(0);
  expect(m.x + m.width).toBeLessThanOrEqual(900);
  await page.locator('.dropdown-backdrop').click();
  await aba(page, 'Jornada');
  await expect(page.locator('.jk-habit-actions').first()).toHaveCSS('opacity', '1');
});

test('tablet: alvos ≥ 44px no cabeçalho e no quadro', async ({ page }) => {
  await gotoApp(page, '/registros');
  expect(await smallTargets(page, '.registros-main-header')).toEqual([]);
  await aba(page, 'Tarefas');
  await page.locator('.kb-board').waitFor();
  expect(await smallTargets(page, '.kb-board-scope')).toEqual([]);
});
```

Ao final de `bussola_web/e2e/registros.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 7 — capturas para a conferência visual (só com REG_SHOTS=1)
// ---------------------------------------------------------------------------
test.describe('capturas para conferência visual', () => {
  test.skip(!process.env.REG_SHOTS, 'rode com REG_SHOTS=1');
  for (const w of [360, 390, 430]) {
    test(`capturas ${w}px`, async ({ page }) => {
      const dir = 'test-results/registros-visual';
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/registros');
      await page.screenshot({ path: `${dir}/caderno-${w}.png`, fullPage: true });
      await page.locator('.reg-m-chips').getByRole('button', { name: 'Grupos', exact: true }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/grupos-${w}.png` });
      await page.keyboard.press('Escape');
      await page.locator('.app-fab').click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/editor-${w}.png` });
      await page.keyboard.press('Escape');
      await abrirAba(page, 'Tarefas');
      await page.locator('.kb-board').waitFor();
      await page.screenshot({ path: `${dir}/tarefas-${w}.png` });
      await page.locator('.kb-card').first().click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/tarefa-detalhe-${w}.png` });
      await page.keyboard.press('Escape');
      await abrirAba(page, 'Jornada');
      await page.locator('.jk-kanban').waitFor();
      await page.screenshot({ path: `${dir}/jornada-${w}.png`, fullPage: true });
      await page.locator('.app-fab').click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/habito-${w}.png` });
    });
  }
});
```

Run: `npm run e2e -- --project=tablet e2e/registros.tablet.spec.mjs`
Expected: FAIL (cabeçalho com altura fixa de 60px e `nowrap` vaza em 769/900; botões de 36px; menu de grupos de 280px sai pela direita).

- [ ] **Step 2: CSS do tablet e do ponteiro grosso**

Ao final de `bussola_web/src/pages/Registros/styles/registros-mobile.css`, adicionar:

```css
/* --- Tablet (769–1024): mantém o layout do desktop, sem vazar --- */
@media (min-width: 769px) and (max-width: 1024px) {
    .registros-scope .registros-wrapper {
        max-width: 100%;
    }

    .registros-scope .column-header-flex {
        height: auto;
        min-height: 60px;
        flex-wrap: wrap;
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-4);
    }

    .registros-scope .header-actions-group {
        flex-wrap: wrap;
        justify-content: flex-end;
        min-width: 0;
    }

    .registros-scope .header-search-wrapper,
    .registros-scope .custom-dropdown-wrapper {
        margin-right: 0;
    }

    .registros-scope .header-search-input {
        width: 160px;
    }

    .registros-scope .dropdown-trigger-btn {
        min-width: 0;
    }

    /* O gatilho fica à direita: o menu abre para a esquerda e nunca passa da tela */
    .registros-scope .custom-dropdown-menu {
        left: auto;
        right: 0;
        width: min(280px, calc(100vw - 2 * var(--sp-4)));
    }

    .registros-scope .notes-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .registros-scope .jk-header-date-msg {
        display: none;
    }
}

/* --- Ponteiro grosso (tablet e notebooks de toque): controles de 44px --- */
@media (pointer: coarse) {
    .registros-scope .tab-btn-pill,
    .registros-scope .small-btn,
    .registros-scope .dropdown-trigger-btn,
    .registros-scope .kb-toolbar-select,
    .registros-scope .kb-toolbar-search input,
    .registros-scope .kb-column-addfoot {
        min-height: var(--tap-min);
    }

    .registros-scope .small-btn,
    .registros-scope .dropdown-trigger-btn,
    .registros-scope .header-search-input {
        height: var(--tap-min) !important;
    }

    .registros-scope .close-btn,
    .registros-scope .footer-pin-btn,
    .registros-scope .kb-column-add,
    .registros-scope .kb-icon-btn,
    .registros-scope .kb-mini {
        min-width: var(--tap-min);
        min-height: var(--tap-min);
    }

    .registros-scope .footer-pin-btn,
    .registros-scope .kb-column-add,
    .registros-scope .kb-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
}
```

- [ ] **Step 3: Rodar os testes do tablet**

Run: `npm run e2e -- --project=tablet` → Expected: `registros.tablet.spec.mjs` (5) e os demais specs de tablet passam. Se `overflowOffenders` listar algo, corrija o CSS do elemento listado (sem esconder com `overflow: hidden`).

- [ ] **Step 4: Suíte completa, build e lint**

Run: `npm run e2e` → Expected: tudo passa nos 3 projetos.
Run: `npm run e2e -- --project=desktop` mais uma vez, depois do `afterAll` do mobile → Expected: tudo passa (prova que os dados `E2E ` foram limpos e que `registros.png` não mudou).
Run: `npm run build` → Expected: OK.
Run: `npx eslint src/pages/Registros` → Expected: 4 errors e nenhum novo (registre os números na mensagem do commit).
Run: `npm run lint 2>&1 | Select-String " error " | Measure-Object` → Expected: contagem ≤ à de antes do plano.

- [ ] **Step 5: Conferência visual (360, 390 e 430px), com screenshots**

Run (PowerShell, em `bussola_web/`): `$env:REG_SHOTS='1'; npx playwright test --project=mobile e2e/registros.mobile.spec.mjs -g "capturas"; Remove-Item Env:REG_SHOTS`
Expected: 3 passed; 21 PNGs em `test-results/registros-visual/`. **Abra cada PNG** (ferramenta Read) e confira contra a tela 3 aprovada e a escala da §4.1:
- topbar "Registros"; abas Caderno · Tarefas · Jornada de borda a borda do gutter (16px);
- Caderno: busca de largura total; 8px até os chips; 16px até "Fixados"; 24px entre acordeões; 12px entre cards; selo inteiro (sem corte) e sem encostar no card de cima; "⋯" visível em todos os cards; nada cortado à direita em 360;
- Grupos: linhas de 56px com editar/excluir de 44px, "Novo grupo" no rodapé;
- editor: ✕ · título · fixar · preview · Salvar numa linha; barra de formatação no rodapé, de borda a borda;
- Tarefas: chips com contagem, uma coluna na largura útil, "+ Nova tarefa" no topo, 12px entre cards, "⋯" no canto do card; o card igual ao do desktop;
- detalhe: chips de status/prioridade, subtarefas, rodapé fixo;
- Jornada: linha "data · X de Y hábitos" + barra, períodos empilhados, "⋯" e círculos de 48px;
- Novo hábito: dias em 7 colunas, presets e cores de 44px, rodapé fixo.
Corrija qualquer desvio de espaçamento (valor fora da escala, gutter diferente de 16px, texto principal < 14px) antes do commit e rode de novo o Step 4.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Registros bussola_web/e2e/registros.tablet.spec.mjs bussola_web/e2e/registros.mobile.spec.mjs
git commit -m "feat(web): Registros no tablet (cabecalho que quebra, acoes sem hover, alvos de 44px) e verificacao final" -m "lint Registros: 4 erros (linha de base) -> 4 erros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Decisões e suposições registradas neste plano

- **Conteúdo compartilhado em vez de árvore mobile separada.** Diferente de Provisões, o celular reaproveita os acordeões, o `TarefaBoard` e a `JornadaTimeline`; só o cabeçalho de abas é trocado e o resto é CSS + "⋯" condicionado a `isMobile`.
- **Círculos de check-in continuam com 48px** (já ≥ 44); o teste exige ≥ 44. Não reduzimos para 44 para não mexer no trilho/streak do card.
- **Chip "Grupos" no fim da faixa** (na ordem listada: Todos, grupos, Grupos). O chip "Indefinido" só aparece quando existe nota sem grupo.
- **Contagem dos chips de status reflete os filtros ativos** (o que se vê na coluna); o desktop continua mostrando o total no cabeçalho da coluna.
- **"Mover para…" coloca a tarefa no fim da coluna de destino** (mesmo padrão do soltar numa coluna, via `reordenarTarefas`), mostra um toast e mantém o usuário na coluna atual.
- **Quadro no celular com altura fixa até a barra inferior** e rolagem vertical dentro de cada coluna (cada coluna guarda sua posição; a página não rola na aba Tarefas). A altura usa `--kb-top`, medido em JS no topo do quadro.
- **No celular o cabeçalho da coluna do board some** (os chips o substituem) e o vazio diz "Nenhuma tarefa aqui" em vez de "Solte aqui".
- **O Fab "Nova tarefa" cria em "A Fazer"** (igual ao botão do desktop), independentemente da coluna visível.
- **Sem foco automático em nenhum modal de Registros no celular** (editor de nota, tarefa, hábito, grupo); a spec exigia só no detalhe da tarefa.
- **Editor de nota no celular:** a barra de status (palavras/rascunho), o rótulo "Conteúdo" e as abas Escrever/Preview (com a dica de atalhos) ficam escondidos; a barra superior mostra um título curto "Nova nota/Editar nota". A barra de formatação é reordenada por CSS para o rodapé do sheet cheio (sem mover o JSX).
- **Botões de 40px na barra de formatação** são a única exceção aos 44px (aprovada pelo usuário); o teste de alvos do editor ignora `.md-toolbar-btn`.
- **Cópia na visualização confirma por toast no celular** (o ActionSheet já fechou); no desktop segue o "Copiado!" no botão.
- **GrupoModal no celular mostra as cores à vista** (grade de 44px) em vez do popover, que seria cortado dentro do sheet. O "Grupos" sheet fecha antes de abrir o GrupoModal (que é `BaseModal` na árvore e ficaria atrás do sheet em portal).
- **Dias da semana do HabitoModal** viram uma grade de 7 colunas com 44px de altura e cantos de 12px; em 390px cada botão tem ~47px de largura, mas **em 360px fica com ~43px de largura** (o teste de alvos roda em 390). Alternativa, se o controlador preferir: `gap` 2px (fora da escala) para chegar a 44px em 360.
- **HabitoListaModal**: mantido o layout ≤760 existente; só alvos (filtro de dia e ✕ de 44px), fontes mínimas e lista rolando com cabeçalho/rodapé fixos.
- **Levantada do selo no hover** (`.selo-card:hover .selo-badge`, em `global.css`) é neutralizada só dentro de Registros com `hover: none`; `global.css` não é tocado.
- **Tablet:** notas em 2 colunas, cabeçalho que quebra linha, menu de grupos alinhado à direita e a data/mensagem da Jornada escondida no cabeçalho (já era assim < 900px).
- **Ícones:** "⋯" = `fa-solid fa-ellipsis` (o do "Mais" da barra inferior), "Mover para…" = `fa-solid fa-arrow-right` (usado em Estudos), filtros = `fa-solid fa-sliders` (Provisões).
- **A base visual nova da Jornada (desktop)** mascara `.jk-streak`, cujo valor depende da data real do servidor (o relógio fixo só vale no navegador).
- **Conferência visual automatizada** por capturas (`REG_SHOTS=1`) em vez do DevTools manual, para o agente poder abrir os PNGs.

## Rulings do controlador (vinculantes)

- Círculos de check-in em 48px; chip "Grupos" no fim da linha; "Indefinido" só quando houver nota sem grupo; contadores dos chips de status refletem os filtros ativos; "Mover para…" anexa ao fim da coluna destino e mantém a coluna atual; quadro com altura fixa medida em JS e rolagem por coluna (sem rolar a página na aba Tarefas), cabeçalho da coluna oculto: **aceitos**.
- Fab cria tarefa em "A Fazer"; nenhum modal de Registros com autofocus no celular: **aceito**.
- Editor no celular sem barra de contagem, rótulo "Conteúdo" e abas Escrever/Preview (preview pelo botão da barra superior); botões de formatação de 40px como única exceção aos 44px (spec §5.2 pede 40px): **aceito**.
- Botões de dia da semana do form de hábito (~43px em 360px): **usar gap de 2px** como exceção documentada de tamanho de controle, para garantir ≥44px de alvo.
- Neutralizar o "lift" do selo só dentro de Registros: **aceito**.
- Ícones `fa-ellipsis`, `fa-arrow-right`, `fa-sliders` (já existem no código): **aceito**.
- Pré-requisito: plano 02 concluído (Segmented, apiJson, smallTargets).
