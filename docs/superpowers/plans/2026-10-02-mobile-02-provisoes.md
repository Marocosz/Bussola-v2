# Mobile 02: Provisões (Finanças + Metas + Categorias + Caixa), plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a página Provisões (`/financas`) para o celular no layout aprovado "Abas": faixa de KPIs rolável, abas Transações · Metas · Categorias, lista de transações agrupada por dia com ações por toque (ActionSheet), sheet de filtros, Fab "+", Metas e Categorias reaproveitando os cards atuais, e Caixa/forms/pickers em sheet. Tablet ganha os ajustes da spec §6. Desktop (≥1025) fica idêntico.

**Architecture:**
- `Financas/index.jsx` continua dono de todo o estado e dos handlers. No mobile (`useIsMobile()`), ele não renderiza o `.page-header` nem o grid de 2 colunas; renderiza `<ProvisoesMobile>` (novo, em `Financas/mobile/`), que recebe dados e handlers por props.
- A lógica que hoje vive dentro de componentes é extraída **sem mudar comportamento** para ser usada pelo desktop e pelo celular: a consulta da lista (`transactionsQuery.js`), as ações da linha (`useTransactionActions.js`), a lista de parcelas (`ParcelaSubList.jsx`) e o controlador de Metas (`useMetasController.js` + `MetasParts.jsx`). O desktop passa a usar as mesmas peças e é protegido por screenshots base tirados **antes** da extração.
- Os modais existentes já viram sheet pelo `BaseModal` (plano 01). Aqui só se ajusta o que briga com o sheet (popovers de ícone/cor → `<Sheet>`, `overflow: visible !important` restrito a ≥769) e o tamanho/espaçamento no mobile.
- Testes: Playwright (`provisoes.mobile.spec.mjs`, `provisoes.tablet.spec.mjs`, `provisoes.desktop.spec.mjs`). Funções puras são testadas pelo próprio Vite (`page.evaluate(() => import('/src/...'))`). Dados de teste usam o prefixo `E2E ` e são removidos pela API antes e depois de cada arquivo.

**Tech Stack:** React 19, Vite 7, CSS puro, Font Awesome (npm), Chart.js 4, `@playwright/test` 1.63.

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-responsivo-design.md` (§2 restrições, §4 fundação, §5.1 Provisões, §6 tablet, §8 verificação). Este plano é a etapa 4 da §7.
**Plano anterior:** `docs/superpowers/plans/2026-10-02-mobile-01-fundacao-shell.md` (harness, tokens, `Sheet`/`ActionSheet`/`Fab`, shell; já implementado nesta branch). Este plano usa a **API real** dos primitivos (seção abaixo), que difere em detalhes do texto do plano 01.

## Global Constraints

- **Branch:** `feat/mobile-responsivo` (worktree `.claude/worktrees/mobile-responsivo`). Um commit por task. **Nunca** fazer push nem merge em `main`.
- **Commits** terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use um segundo `-m`).
- **Não redesenhar cards existentes:** `CategoryCard` (selo flutuante, chip, valor herói, barra), `MetaCard`, badges de ícone da transação (`.row-cat-icon`), tags (`.tag-*`), cores. Só espaçamento, tamanho, quebra, alvo de toque e ações visíveis.
- **Ícones:** só classes Font Awesome que já existem no código. Usadas neste plano: `fa-wallet`, `fa-scale-balanced`, `fa-arrow-trend-up`, `fa-arrow-trend-down`, `fa-piggy-bank`, `fa-vault`, `fa-sliders`, `fa-magnifying-glass`, `fa-xmark`, `fa-plus`, `fa-circle-dot`, `fa-layer-group`, `fa-rotate`, `fa-check`, `fa-rotate-left`, `fa-pen-to-square`, `fa-clock-rotate-left`, `fa-ban`, `fa-trash-can`, `fa-box-archive`, `fa-circle-info`, `fa-circle-notch`, `fa-tags`.
- **Espaçamento (tokens `--sp-1..6` = 4/8/12/16/24/32):** 8 entre elementos dentro de um card/linha, 12 entre cards, 16 entre blocos da página e gutter lateral, 24 entre seções (grupos de dia). Nenhum valor solto fora da escala no CSS novo (exceto tamanhos de controle: 36/44/48/52/56px).
- **Toque:** alvo ≥ 44×44 em tudo que é interativo; inputs com 16px (já garantido por `tokens.css`); nenhuma ação só no hover.
- **Tipografia mobile:** conteúdo principal ≥ 14px (título de linha e valor em 15px), secundário ≥ 12px, mínimo 11px só em rótulos em caixa alta.
- **Desktop (≥1025):** visualmente idêntico. Os 13 PNGs de `e2e/desktop-visual.desktop.spec.mjs-snapshots/` e os 4 novos de `provisoes.desktop.spec.mjs-snapshots/` (Task 1) têm que continuar passando em toda task. Tablet (769–1024) pode mudar conforme a spec §6.
- **Sem mudança de API/backend.** Reusar `services/api.ts` e os handlers existentes da página; nenhuma regra de negócio nova.
- **Dados de teste:** tudo que os testes criam começa com `E2E ` e é removido via API (`limparE2E`) no `beforeAll` e no `afterAll` do arquivo. Se sobrar lixo, a base visual do desktop quebra (a lista do `/financas` muda).
- **Lint:** `npx eslint <arquivos tocados>` sem **novos** erros. Linha de base medida: `src/pages/Financas` + `src/pages/Metas` = 1 erro (`FinancasModals.jsx`, `set-state-in-effect`, pré-existente) e 1 warning. Regras v7: sem `setState` síncrono em `useEffect` (use "prev key" no render), sem mutar acumuladores no render (funções puras fora do componente), `catch {` sem variável.
- **Build:** `npm run build` passa.

## API real dos primitivos (lida do código, use exatamente isto)

- `useIsMobile()` / `useIsTablet()` de `src/hooks/useIsMobile.js` (≤768 / 769–1024), via `useSyncExternalStore`.
- `BaseModal({ children, onClose, className, sheet = 'auto' })`: **não é portal** (renderiza no lugar). No mobile põe `is-sheet` (e `is-sheet-full` com `sheet="full"`) no `.modal-overlay`. ESC e clique no overlay chamam `onClose`. Trava de scroll com contador (aninhamento ok).
- `Sheet({ open, onClose, title, children, footer, full, className })`: retorna `null` se `!open`. Só renderiza cabeçalho (h3 + `button.app-sheet-close[aria-label="Fechar"]`) **se houver `title`**. Corpo `.modal-body.app-sheet-body`, rodapé `.modal-footer.app-sheet-footer` (filhos com `flex:1; min-height:48px`).
- `ActionSheet({ open, onClose, title, subtitle, icon, actions })`: `actions: [{ key, icon /* classe FA completa */, label, onClick, variant?: 'primary'|'danger' }]`; chama `onClose()` e depois `onClick()`. Não passa `title` ao `Sheet` → **não tem botão Fechar**; fecha com ESC/overlay. Itens: `button.action-sheet-item(.is-primary|.is-danger)`.
- `Fab({ icon = 'fa-plus', label, onClick })`: portal no `body`, `button.app-fab[aria-label]`, visível só ≤768.
- Como o `BaseModal` não é portal, um sheet renderizado **dentro** de um elemento clicável recebe o bubbling do clique do overlay. Sempre renderize sheets como irmãos (fragment), nunca dentro da linha clicável.
- **Ordem do CSS** (`main.jsx`): `tokens.css` → CSS das páginas (Financas `styles.css`, Metas `styles.css`, e o novo `provisoes-mobile.css`) → `mobile.css` → `components.css` → `global.css`. Consequência: para sobrescrever regras de `mobile.css` como `.app-sheet > .app-sheet-body` (0,2,0), o CSS novo precisa de **3 classes**; para vencer `.financas-scope .X` basta a mesma especificidade (o `provisoes-mobile.css` vem depois).
- `CustomSelect`/`DatePicker` já abrem em sheet no mobile e ignoram "clique fora" quando `isMobile` (padrão a copiar nos pickers de ícone/cor).
- `overflowOffenders(page)` ignora elementos dentro de `[data-offscreen-ok]`. Projetos Playwright por sufixo: `*.mobile.spec.mjs` (390×844, touch, `pointer: coarse`, `hover: none`), `*.tablet.spec.mjs` (900×1200, touch), `*.desktop.spec.mjs` (1280×900, mouse). Relógio fixo `2026-10-02 12:00 -03:00` (sexta-feira).
- Banco demo (`populate_db.py`): ~120 pontuais (sem forma de pagamento), recorrentes ativas (`Netflix Premium`, `Academia Smart`, `Aluguel`, `Salário Mensal`, com efetivadas + pendentes), canceladas (`… (Cancelado)`, encerradas), parceladas ativas (`Macbook Air` 10x, `Viagem Férias` 12x) e finalizadas. **Sem metas, sem ajustes de caixa.** Categorias: Salário, Freelance, Investimentos, Alimentação, Mercado, Moradia, Transporte, Lazer, Assinaturas, Saúde, Eletrônicos, Educação (+ "Indefinida" de cada tipo).

## Review Focus

1. **Ação errada no ActionSheet da transação** (oferecer "Excluir" numa série com histórico efetivado, ou não oferecer "Encerrar recorrência"; "Efetivar" fora do lugar). O mapa de ações é derivado do mesmo `seriesDeleteMode` que o desktop usa. Teste na Task 3 › "pontual: Editar/Excluir" e "recorrente com histórico: Efetivar primário, Ver histórico, Encerrar (sem Excluir)".
2. **"Ver N transações" divergir da lista aplicada** (rascunho do sheet vs. estado aplicado; "Carregar mais" não resetar ao filtrar). Teste na Task 4 › "Tipo=Parcelada: Ver N bate com a lista e o chip remove".
3. **Ação principal escondida pelo teclado/dobra** (Salvar do form de transação; "Guardar R$ …" do cofre). Teste na Task 3 › "Fab → Pontual … Salvar visível com teclado" e Task 5 › "Guardar → cena em tela cheia … confirmar alcançável".
4. **Picker de ícone/cor aninhado** (o "clique fora" do `mousedown` fechar o picker antes do toque selecionar; grid fora da tela). Teste na Task 6 › "categoria: Fab → form com ícone em sheet de 6 colunas; cria e exclui" (e Task 5 › "Nova meta pelo Fab").
5. **Regressão no desktop pelos refactors compartilhados** (consulta extraída, hook do `TransactionCard`, `MetasModal` dividido, gate de hover das ações). Teste na Task 1 › `provisoes.desktop.spec.mjs` (screenshots base + "ações só no hover") e em toda task via `--project=desktop`.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `bussola_web/e2e/helpers.mjs` | modificar | + `authHeaders`, `apiJson`, `smallTargets` |
| `bussola_web/e2e/provisoes.desktop.spec.mjs` | criar | base visual dos modais de Provisões + hover |
| `bussola_web/e2e/provisoes.mobile.spec.mjs` | criar | lógica pura, layout, ações, filtros, Metas, Categorias, Caixa |
| `bussola_web/e2e/provisoes.tablet.spec.mjs` | criar | 2 colunas, ações visíveis sem hover, alvos |
| `bussola_web/src/pages/Financas/transactionsQuery.js` | criar | `filterAndSortTransactions`, `groupByDay`, `dayLabel`, `activeFilterChips`, opções e defaults |
| `bussola_web/src/pages/Financas/components/pagamento.js` | criar | `PAG_LABEL`, `PAG_ICONE` |
| `bussola_web/src/pages/Financas/components/useTransactionActions.js` | criar | `seriesDeleteMode`, `useTransactionActions` (efetivar/excluir/encerrar) |
| `bussola_web/src/pages/Financas/components/ParcelaSubList.jsx` | criar | sub-linhas de parcelas/histórico (desktop expandido e sheet) |
| `bussola_web/src/pages/Financas/components/TransactionCard.jsx` | modificar | usa hook + `ParcelaSubList` (markup idêntico) |
| `bussola_web/src/pages/Financas/index.jsx` | modificar | usa a consulta extraída; no mobile renderiza `ProvisoesMobile` |
| `bussola_web/src/pages/Financas/mobile/ProvisoesMobile.jsx` | criar | KPIs + abas + Fab de nova transação |
| `bussola_web/src/pages/Financas/mobile/KpiStrip.jsx` | criar | faixa de KPIs rolável com explicação ao tocar |
| `bussola_web/src/pages/Financas/mobile/TransacoesTab.jsx` | criar | busca, filtros, chips, grupos por dia, "Carregar mais" |
| `bussola_web/src/pages/Financas/mobile/TransactionRowMobile.jsx` | criar | linha de 2 níveis + ActionSheet + sheet de histórico |
| `bussola_web/src/pages/Financas/mobile/FiltersSheet.jsx` | criar | sheet de filtros com rascunho e "Ver N" |
| `bussola_web/src/pages/Financas/mobile/CategoriasTab.jsx` | criar | segmentado Despesas/Receitas + `CategoryCard` + Fab |
| `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css` | criar | todo o CSS mobile/touch da página (Financas, Metas, Caixa) |
| `bussola_web/src/pages/Financas/components/FinancasModals.jsx` | modificar | `inputMode`; ícone/cor em `<Sheet>` no mobile |
| `bussola_web/src/pages/Financas/styles.css` | modificar | `overflow: visible` só ≥769; gate de hover; tablet; toque |
| `bussola_web/src/pages/Metas/useMetasController.js` | criar | estado/ações de Metas (antes no `MetasModal`) |
| `bussola_web/src/pages/Metas/MetasParts.jsx` | criar | `MetasHeader`, `MetasResumo`, `MetasDetailView` |
| `bussola_web/src/pages/Metas/MetasModal.jsx` | modificar | usa controlador + partes (markup idêntico) |
| `bussola_web/src/pages/Metas/MetasTab.jsx` | criar | aba Metas do celular (cards em 1 coluna + sheet cheio) |
| `bussola_web/src/pages/Metas/chartFormat.js` | criar | `tickDiaMes`, `tickBRLCompacto` |
| `bussola_web/src/pages/Metas/components/MetaHistorico.jsx` | modificar | eixos `dd/mm` e BRL compacto no mobile |
| `bussola_web/src/pages/Metas/components/MetaForm.jsx` | modificar | `inputMode`; ícone/cor em `<Sheet>` no mobile |
| `bussola_web/src/components/mobile/Segmented.jsx` | criar | controle segmentado (`role="tablist"`) |
| `bussola_web/src/components/mobile/mobile.css` | modificar | CSS do segmentado |

---

### Task 1: Base visual do desktop + extração sem mudança de comportamento

**Files:**
- Create: `bussola_web/e2e/provisoes.desktop.spec.mjs`, `bussola_web/e2e/provisoes.mobile.spec.mjs`, `bussola_web/src/pages/Financas/transactionsQuery.js`, `bussola_web/src/pages/Financas/components/pagamento.js`, `bussola_web/src/pages/Financas/components/useTransactionActions.js`, `bussola_web/src/pages/Financas/components/ParcelaSubList.jsx`, `bussola_web/src/pages/Metas/useMetasController.js`, `bussola_web/src/pages/Metas/MetasParts.jsx`
- Modify: `bussola_web/e2e/helpers.mjs`, `bussola_web/src/pages/Financas/components/TransactionCard.jsx`, `bussola_web/src/pages/Financas/index.jsx`, `bussola_web/src/pages/Metas/MetasModal.jsx`

**Interfaces:**
- Produces:
  - `filterAndSortTransactions(data, filters, sortConfig): Transacao[]` — mesma saída do antigo `getAllTransactions`, + filtro `search` (sem acento, em descrição e nome da categoria). `filters = { tipo, status, categoria, pagamento, datePreset, dateStart, dateEnd, search }`; `FILTER_DEFAULTS` com os valores neutros.
  - `TIPO_OPTIONS`, `STATUS_OPTIONS`, `PAGAMENTO_OPTIONS`, `PERIODO_OPTIONS`: `Array<[valor, rótulo]>`; `SORT_OPTIONS: Array<{ key, label, column, dir }>`.
  - `dayLabel(date, now?): string` ("Hoje · 02/10", "Ontem · 01/10", "Amanhã · 03/10", "Sex · 25/09", "Qua · 31/12/25"); `groupByDay(list, now?): Array<{ key, label, items }>` (agrupa itens **consecutivos** do mesmo dia local).
  - `activeFilterChips(filters, data): Array<{ key, label }>` (ordem: tipo, status, pagamento, categoria, datePreset).
  - `seriesDeleteMode(t): 'pontual' | 'serie' | 'encerrar' | 'bloqueado'`; `useTransactionActions(t, onUpdate) → { isDeleting, deleteMode, handleToggleStatus, handleDelete }`.
  - `ParcelaSubList({ transacao })`.
  - `useMetasController({ onUpdate }) → { data, loading, view, selectedMeta, editingData, resumo, metas, title, fetchData, openGrid, openNew, openEdit, openCofre, openHistorico, goBack, handleSaved, handleDelete }`; `fmtBRL(v)`.
  - `MetasHeader({ ctl, onClose })`, `MetasResumo({ resumo, explainVisible })`, `MetasDetailView({ ctl })`.
  - Helpers E2E: `authHeaders()`, `apiJson(request, method, path, data?)`, `smallTargets(page, rootSelector)`.

- [ ] **Step 1: Spec de base visual dos modais de Provisões (desktop)**

Criar `bussola_web/e2e/provisoes.desktop.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

// Modais da página que os refactors deste plano tocam. Base gerada ANTES de mexer no código.
const MODAIS = [
  ['metas-modal', async (p) => {
    await p.locator('.metas-entry:not(.cat-entry)').click();
    await p.locator('.metas-modal').waitFor();
    await p.locator('.metas-grid, .metas-empty').first().waitFor();
  }],
  ['categorias-modal', async (p) => {
    await p.locator('.cat-entry').click();
    await p.locator('.categorias-modal').waitFor();
  }],
  ['categoria-form', async (p) => {
    await p.locator('.cat-entry').click();
    await p.getByRole('button', { name: 'Nova Categoria' }).click();
    await p.locator('input[name="nome"]').waitFor();
  }],
  ['caixa-modal', async (p) => {
    await p.locator('.ph-kpi-btn').click();
    await p.locator('.caixa-empty, .caixa-item').first().waitFor();
  }],
];

for (const [nome, abrir] of MODAIS) {
  test(`desktop provisões: ${nome} inalterado`, async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrir(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`${nome}.png`);
  });
}

test('desktop provisões: ações da linha só aparecem no hover', async ({ page }) => {
  await gotoApp(page, '/financas');
  const row = page.locator('.transacao-row').first();
  const opacity = () => row.locator('.row-actions').evaluate((e) => getComputedStyle(e).opacity);
  expect(await opacity()).toBe('0');
  await row.hover();
  await expect.poll(opacity).toBe('1');
});

test('desktop provisões: nada do layout mobile aparece', async ({ page }) => {
  await gotoApp(page, '/financas');
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.layout-grid-custom')).toBeVisible();
  await expect(page.locator('.m-prov')).toHaveCount(0);
  await expect(page.locator('.app-fab')).toHaveCount(0);
});
```

- [ ] **Step 2: Gerar a base ANTES de qualquer mudança de código**

Run (em `bussola_web/`): `npm run e2e:update -- --project=desktop e2e/provisoes.desktop.spec.mjs`
Expected: 6 passed; criados 4 PNGs em `e2e/provisoes.desktop.spec.mjs-snapshots/`. Abra os 4 e confira que mostram o modal certo aberto (Metas com "Nenhum cofrinho ainda.", Categorias com a lista, o form "Nova Categoria", Ajustes de Caixa). Rode `npm run e2e -- --project=desktop` e confirme **19 passed** (13 + 6) com a base estável; se algo variar entre execuções, adicione `mask` no elemento dinâmico e regenere.

- [ ] **Step 3: Helpers de API e de alvo de toque**

Em `bussola_web/e2e/helpers.mjs`, adicionar no **topo** do arquivo:

```js
import fs from 'node:fs';

const API = 'http://127.0.0.1:8000/api/v1';

// Token do usuário demo gravado pelo global-setup (cwd = bussola_web/).
export function authHeaders() {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/state.json', 'utf8'));
  const token = state.origins[0].localStorage.find((i) => i.name === '@Bussola:token').value;
  return { Authorization: `Bearer ${token}` };
}

// Chamada direta à API (setup/limpeza de dados de teste). Lança em status != 2xx.
export async function apiJson(request, method, path, data) {
  const res = await request.fetch(`${API}${path}`, { method, headers: authHeaders(), data });
  if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
```

E ao **final** do arquivo:

```js
// Controles interativos visíveis menores que 44×44 dentro de `rootSelector` (todas as ocorrências).
export async function smallTargets(page, rootSelector) {
  return page.evaluate((sel) => {
    const out = [];
    const alvo = 'button, a[href], select, [role="button"], [role="tab"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])';
    for (const root of document.querySelectorAll(sel)) {
      for (const el of root.querySelectorAll(alvo)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (r.width < 43.5 || r.height < 43.5) {
          const nome = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
          out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${nome}" ${Math.round(r.width)}×${Math.round(r.height)}`);
        }
      }
    }
    return out;
  }, rootSelector);
}
```

- [ ] **Step 4: Testes da lógica pura (falham: os módulos não existem)**

Criar `bussola_web/e2e/provisoes.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, apiJson, smallTargets } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Infra do arquivo
// ---------------------------------------------------------------------------
const abrirAba = (page, nome) => page.getByRole('tab', { name: nome, exact: true }).click();
const buscar = (page, texto) => page.getByRole('searchbox', { name: 'Buscar transações' }).fill(texto);

// Remove tudo que os testes criam (prefixo "E2E "): sem isso a base visual do desktop quebra.
async function limparE2E(request) {
  const dash = await apiJson(request, 'GET', '/financas/');
  const transacoes = [
    ...Object.values(dash.transacoes_pontuais || {}).flat(),
    ...Object.values(dash.transacoes_recorrentes || {}).flat(),
  ];
  for (const t of transacoes.filter((x) => String(x.descricao).startsWith('E2E '))) {
    await apiJson(request, 'DELETE', `/financas/transacoes/${t.id}`);
  }
  for (const g of (dash.transacoes_cofre || []).filter((x) => String(x.nome).startsWith('E2E '))) {
    for (const mv of g.movimentacoes || []) await apiJson(request, 'DELETE', `/financas/metas/${g.meta_id}/movimentacoes/${mv.id}`);
  }
  const metas = await apiJson(request, 'GET', '/financas/metas');
  for (const m of metas.metas.filter((x) => x.nome.startsWith('E2E '))) {
    for (const mv of await apiJson(request, 'GET', `/financas/metas/${m.id}/movimentacoes`)) {
      await apiJson(request, 'DELETE', `/financas/metas/${m.id}/movimentacoes/${mv.id}`);
    }
    await apiJson(request, 'DELETE', `/financas/metas/${m.id}`);
  }
  const cats = await apiJson(request, 'GET', '/financas/');
  for (const c of [...cats.categorias_despesa, ...cats.categorias_receita].filter((x) => x.nome.startsWith('E2E '))) {
    await apiJson(request, 'DELETE', `/financas/categorias/${c.id}`);
  }
  for (const a of (await apiJson(request, 'GET', '/financas/caixa/ajustes')).filter((x) => String(x.observacao || '').startsWith('E2E '))) {
    await apiJson(request, 'DELETE', `/financas/caixa/ajustes/${a.id}`);
  }
}

test.beforeAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  await r.dispose();
});

test.afterAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  await r.dispose();
});

// ---------------------------------------------------------------------------
// Task 1 — lógica pura (importada pelo próprio Vite dev server)
// ---------------------------------------------------------------------------
test.describe('lógica pura', () => {
  test('filterAndSortTransactions: busca sem acento, tipo, ordenação e histórico do grupo', async ({ page }) => {
    await gotoApp(page, '/financas');
    const r = await page.evaluate(async () => {
      const q = await import('/src/pages/Financas/transactionsQuery.js');
      const cat = (id, nome) => ({ id, nome, tipo: 'despesa' });
      const data = {
        transacoes_pontuais: { 'Outubro/2026': [
          { id: 1, descricao: 'Café da manhã', valor: 12, data: '2026-10-02T00:00:00', tipo_recorrencia: 'pontual', status: 'Efetivada', categoria: cat(9, 'Alimentação') },
          { id: 2, descricao: 'Mercado', valor: 300, data: '2026-10-01T00:00:00', tipo_recorrencia: 'pontual', status: 'Efetivada', categoria: cat(8, 'Mercado') },
        ] },
        transacoes_recorrentes: { 'Outubro/2026': [
          { id: 3, descricao: 'Netflix', valor: 55.9, data: '2026-10-05T00:00:00', tipo_recorrencia: 'recorrente', status: 'Pendente', id_grupo_recorrencia: 'g1', categoria: cat(7, 'Assinaturas') },
          { id: 4, descricao: 'Netflix', valor: 55.9, data: '2026-09-05T00:00:00', tipo_recorrencia: 'recorrente', status: 'Efetivada', id_grupo_recorrencia: 'g1', categoria: cat(7, 'Assinaturas') },
        ] },
        transacoes_cofre: [],
      };
      const f = { ...q.FILTER_DEFAULTS };
      const desc = { column: 'data', dir: 'desc' };
      const ids = (list) => list.map((t) => t.id);
      return {
        todas: ids(q.filterAndSortTransactions(data, f, desc)),
        busca: ids(q.filterAndSortTransactions(data, { ...f, search: 'cafe' }, desc)),
        buscaCategoria: ids(q.filterAndSortTransactions(data, { ...f, search: 'ASSINAT' }, desc)),
        recorrentes: ids(q.filterAndSortTransactions(data, { ...f, tipo: 'recorrente' }, desc)),
        porValor: ids(q.filterAndSortTransactions(data, f, { column: 'valor', dir: 'asc' })),
        grupo: q.filterAndSortTransactions(data, f, desc).find((t) => t.id === 3)._allParcelas.length,
        semDados: q.filterAndSortTransactions(null, f, desc).length,
      };
    });
    expect(r).toEqual({
      todas: [3, 1, 2, 4],
      busca: [1],
      buscaCategoria: [3, 4],
      recorrentes: [3, 4],
      porValor: [1, 4, 3, 2], // empate em 55,90 desempata pela data (asc)
      grupo: 2,
      semDados: 0,
    });
  });

  test('groupByDay: Hoje/Ontem/Amanhã, dia da semana e ano diferente', async ({ page }) => {
    await gotoApp(page, '/financas');
    const labels = await page.evaluate(async () => {
      const q = await import('/src/pages/Financas/transactionsQuery.js');
      const now = new Date(2026, 9, 2, 12);
      const list = ['2026-10-03T00:00:00', '2026-10-02T09:00:00', '2026-10-02T00:00:00', '2026-10-01T00:00:00', '2026-09-25T00:00:00', '2025-12-31T00:00:00']
        .map((data, i) => ({ id: i, data }));
      return q.groupByDay(list, now).map((g) => `${g.label}#${g.items.length}`);
    });
    expect(labels).toEqual(['Amanhã · 03/10#1', 'Hoje · 02/10#2', 'Ontem · 01/10#1', 'Sex · 25/09#1', 'Qua · 31/12/25#1']);
  });

  test('activeFilterChips: rótulos e ordem', async ({ page }) => {
    await gotoApp(page, '/financas');
    const chips = await page.evaluate(async () => {
      const q = await import('/src/pages/Financas/transactionsQuery.js');
      return q.activeFilterChips(
        { ...q.FILTER_DEFAULTS, tipo: 'parcelada', pagamento: 'pix', categoria: 9, datePreset: 'custom', dateStart: '2026-09-01', dateEnd: '2026-09-30' },
        { categorias_despesa: [{ id: 9, nome: 'Alimentação' }], categorias_receita: [] },
      );
    });
    expect(chips).toEqual([
      { key: 'tipo', label: 'Parcelada' },
      { key: 'pagamento', label: 'Pix' },
      { key: 'categoria', label: 'Alimentação' },
      { key: 'datePreset', label: '01/09–30/09' },
    ]);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs`
Expected: os 3 FAIL (import de `/src/pages/Financas/transactionsQuery.js` dá 404).

- [ ] **Step 5: `transactionsQuery.js`**

Criar `bussola_web/src/pages/Financas/transactionsQuery.js`:

```js
// Consulta da lista de transações de Provisões: achata, filtra, liga o histórico das
// séries e ordena. Funções puras (sem React), usadas pelo desktop e pelo celular.

export const FILTER_DEFAULTS = {
    tipo: 'todos',
    status: 'todos',
    categoria: null,
    pagamento: 'todos',
    datePreset: 'todos',
    dateStart: '',
    dateEnd: '',
    search: '',
};

// Mesmos valores/rótulos dos dropdowns do desktop.
export const TIPO_OPTIONS = [['todos', 'Todos'], ['pontual', 'Pontual'], ['parcelada', 'Parcelada'], ['recorrente', 'Recorrente'], ['cofre', 'Cofre']];
export const STATUS_OPTIONS = [['todos', 'Todos'], ['Efetivada', 'Efetivada'], ['Pendente', 'Pendente'], ['Encerrada', 'Encerrada'], ['Arquivado', 'Arquivado'], ['Automatico', 'Automático'], ['Manual', 'Manual']];
export const PAGAMENTO_OPTIONS = [['todos', 'Todos'], ['pix', 'Pix'], ['credito', 'Crédito'], ['debito', 'Débito'], ['transferencia', 'Transferência']];
export const PERIODO_OPTIONS = [['todos', 'Tudo'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['custom', 'Personalizado']];
export const SORT_OPTIONS = [
    { key: 'data-desc', label: 'Mais recentes', column: 'data', dir: 'desc' },
    { key: 'data-asc', label: 'Mais antigas', column: 'data', dir: 'asc' },
    { key: 'valor-desc', label: 'Maior valor', column: 'valor', dir: 'desc' },
    { key: 'valor-asc', label: 'Menor valor', column: 'valor', dir: 'asc' },
    { key: 'descricao-asc', label: 'Título A–Z', column: 'descricao', dir: 'asc' },
    { key: 'categoria-asc', label: 'Categoria A–Z', column: 'categoria', dir: 'asc' },
];

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterAndSortTransactions(data, f, sortConfig) {
    if (!data) return [];
    const pontuais = Object.values(data.transacoes_pontuais || {}).flat();
    const recorrentes = Object.values(data.transacoes_recorrentes || {}).flat();

    // Cofre: CADA movimentação vira uma linha própria (transferência neutra — não
    // conta em receita/despesa). Guarda o grupo inteiro para o expand ver o histórico.
    const cofreRows = (data.transacoes_cofre || []).flatMap(g =>
        (g.movimentacoes || []).map(mv => ({
            _isCofre: true,
            id: `cofremov-${mv.id}`,
            _movId: mv.id,
            id_grupo_recorrencia: g.id_grupo,
            tipo_recorrencia: 'cofre',
            descricao: `${mv.tipo === 'aporte' ? 'Aporte' : 'Retirada'} · ${g.nome}`,
            data: mv.data,
            valor: mv.valor,
            status: mv.status,
            tipo_mov: mv.tipo,
            origem: mv.origem,
            categoria: { nome: g.nome, icone: g.icone, cor: g.cor },
            meta_id: g.meta_id,
            _cofreArquivada: !!g.arquivada,
            _cofreMovs: (g.movimentacoes || []).length > 1 ? g.movimentacoes : undefined,
        }))
    );

    let all = [...pontuais, ...recorrentes, ...cofreRows];

    if (f.tipo !== 'todos') {
        all = all.filter(t => (t.tipo_recorrencia || 'pontual') === f.tipo);
    }
    if (f.status !== 'todos') {
        all = all.filter(t => {
            switch (f.status) {
                case 'Efetivada':
                    return (t.tipo_recorrencia || 'pontual') === 'pontual' || t.status === 'Efetivada';
                case 'Pendente':
                    return t.status === 'Pendente';
                case 'Encerrada':
                    return t.recorrencia_encerrada === true;
                case 'Arquivado':
                    return t._cofreArquivada === true;
                case 'Automatico':
                    return t._isCofre && t.tipo_mov && t.origem === 'agendado';
                case 'Manual':
                    return t._isCofre && t.origem === 'manual';
                default:
                    return true;
            }
        });
    }
    if (f.categoria) {
        all = all.filter(t => t.categoria?.id === f.categoria);
    }
    if (f.pagamento !== 'todos') {
        all = all.filter(t => t.tipo_pagamento === f.pagamento);
    }

    // Busca (só o celular tem o campo): descrição ou nome da categoria, sem acento.
    const busca = semAcento((f.search || '').trim());
    if (busca) {
        all = all.filter(t => semAcento(t.descricao).includes(busca) || semAcento(t.categoria?.nome).includes(busca));
    }

    // Filtro de data
    if (f.datePreset !== 'todos') {
        const today = new Date();
        let start = null, end = null;
        if (f.datePreset === 'semana') {
            start = new Date(today); start.setDate(today.getDate() - 6); start.setHours(0, 0, 0, 0);
            end = new Date(today); end.setHours(23, 59, 59, 999);
        } else if (f.datePreset === 'mes') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (f.datePreset === 'custom') {
            start = f.dateStart ? new Date(f.dateStart + 'T00:00:00') : null;
            end = f.dateEnd ? new Date(f.dateEnd + 'T23:59:59') : null;
        }
        if (start || end) {
            all = all.filter(t => {
                const d = new Date(t.data);
                if (start && d < start) return false;
                if (end && d > end) return false;
                return true;
            });
        }
    }

    // NÃO colapsa grupos: toda ocorrência é uma linha própria (30/07, 30/06, 30/05…).
    // Cada linha de parcelada/recorrente carrega o histórico COMPLETO do grupo
    // (todas as ocorrências) apenas para o expand — sem esconder nenhuma linha.
    const groupHistory = {};
    for (const t of recorrentes) {
        if (t.id_grupo_recorrencia) {
            if (!groupHistory[t.id_grupo_recorrencia]) groupHistory[t.id_grupo_recorrencia] = [];
            groupHistory[t.id_grupo_recorrencia].push(t);
        }
    }
    Object.values(groupHistory).forEach(list =>
        list.sort((a, b) => new Date(b.data) - new Date(a.data))  // histórico: mais recente primeiro
    );

    all = all.map(t => {
        if ((t.tipo_recorrencia === 'parcelada' || t.tipo_recorrencia === 'recorrente') && t.id_grupo_recorrencia) {
            const grupo = groupHistory[t.id_grupo_recorrencia];
            if (grupo && grupo.length > 1) return { ...t, _allParcelas: grupo };
        }
        return t;
    });

    const { column, dir } = sortConfig;
    const mult = dir === 'asc' ? 1 : -1;
    return all.sort((a, b) => {
        let cmp = 0;
        if (column === 'valor') {
            cmp = Number(a.valor || 0) - Number(b.valor || 0);
        } else if (column === 'descricao') {
            cmp = String(a.descricao || '').localeCompare(String(b.descricao || ''), 'pt-BR');
        } else if (column === 'categoria') {
            cmp = String(a.categoria?.nome || '').localeCompare(String(b.categoria?.nome || ''), 'pt-BR');
        } else { // data (default)
            cmp = new Date(a.data) - new Date(b.data);
        }
        if (cmp === 0) cmp = new Date(a.data) - new Date(b.data); // desempate por data
        return cmp * mult;
    });
}

// ---------------------------------------------------------------------------
// Agrupamento por dia (lista do celular)
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function shiftedKey(now, days) {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return dayKey(d);
}

export function dayLabel(date, now = new Date()) {
    const key = dayKey(date);
    const ddmm = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
    if (key === shiftedKey(now, 0)) return `Hoje · ${ddmm}`;
    if (key === shiftedKey(now, -1)) return `Ontem · ${ddmm}`;
    if (key === shiftedKey(now, 1)) return `Amanhã · ${ddmm}`;
    const semana = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const ano = date.getFullYear() === now.getFullYear() ? '' : `/${String(date.getFullYear()).slice(2)}`;
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} · ${ddmm}${ano}`;
}

export function groupByDay(list, now = new Date()) {
    const groups = [];
    for (const t of list) {
        const d = new Date(t.data);
        const key = dayKey(d);
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.items.push(t);
        else groups.push({ key, label: dayLabel(d, now), items: [t] });
    }
    return groups;
}

// ---------------------------------------------------------------------------
// Chips dos filtros ativos (celular)
// ---------------------------------------------------------------------------
const rotulo = (opts, v) => (opts.find(([val]) => val === v) || [])[1];
const ddmm = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '…');

export function activeFilterChips(f, data) {
    const cats = [...(data?.categorias_despesa || []), ...(data?.categorias_receita || [])];
    const chips = [];
    if (f.tipo !== 'todos') chips.push({ key: 'tipo', label: rotulo(TIPO_OPTIONS, f.tipo) });
    if (f.status !== 'todos') chips.push({ key: 'status', label: rotulo(STATUS_OPTIONS, f.status) });
    if (f.pagamento !== 'todos') chips.push({ key: 'pagamento', label: rotulo(PAGAMENTO_OPTIONS, f.pagamento) });
    if (f.categoria != null) chips.push({ key: 'categoria', label: cats.find((c) => c.id === f.categoria)?.nome || 'Categoria' });
    if (f.datePreset !== 'todos') {
        chips.push({
            key: 'datePreset',
            label: f.datePreset === 'custom' ? `${ddmm(f.dateStart)}–${ddmm(f.dateEnd)}` : rotulo(PERIODO_OPTIONS, f.datePreset),
        });
    }
    return chips;
}
```

- [ ] **Step 6: Página usa a consulta extraída**

Em `bussola_web/src/pages/Financas/index.jsx`:

1. Logo depois de `import { CustomSelect } from '../../components/CustomSelect';`, adicionar:

```js
import { filterAndSortTransactions } from './transactionsQuery';
```

2. Apagar o bloco inteiro que começa em `    // Achata, filtra, agrupa parceladas e ordena todas as transações` e termina no `    };` que fecha `getAllTransactions` (logo antes de `    const handleEditTransaction = (transacao) => {`). No lugar, colar:

```js
    // Filtros aplicados (desktop: dropdowns; celular: sheet de filtros + busca).
    const filters = {
        tipo: filterTipo,
        status: filterStatus,
        categoria: filterCategoria,
        pagamento: filterPagamento,
        datePreset: filterDatePreset,
        dateStart: filterDateStart,
        dateEnd: filterDateEnd,
        search: '',
    };
```

3. Trocar `    const allTransactions = getAllTransactions();` por:

```js
    const allTransactions = filterAndSortTransactions(data, filters, sortConfig);
```

- [ ] **Step 7: Rótulos de pagamento, hook das ações e sub-lista**

Criar `bussola_web/src/pages/Financas/components/pagamento.js`:

```js
// Forma de pagamento → rótulo e ícone para o badge no card.
export const PAG_LABEL = { pix: 'Pix', credito: 'Crédito', debito: 'Débito', transferencia: 'Transferência' };
export const PAG_ICONE = {
    pix: 'fa-solid fa-bolt',
    credito: 'fa-solid fa-credit-card',
    debito: 'fa-solid fa-money-check-dollar',
    transferencia: 'fa-solid fa-right-left',
};
```

Criar `bussola_web/src/pages/Financas/components/useTransactionActions.js`:

```js
import { useState } from 'react';
import { toggleStatusTransacao, deleteTransacao, stopRecorrencia } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext';

/**
 * O que "excluir" significa para esta transação (mesma regra de sempre do desktop):
 * - 'pontual'   → exclusão direta;
 * - 'serie'     → série nunca efetivada: remove por completo;
 * - 'encerrar'  → tem efetivadas E pendentes: cancela as pendentes, mantém o histórico;
 * - 'bloqueado' → encerrada ou toda efetivada: nada a excluir.
 */
export function seriesDeleteMode(transacao) {
    const tipo = transacao.tipo_recorrencia || 'pontual';
    if (tipo === 'pontual') return 'pontual';
    const grupoRows = (transacao._allParcelas && transacao._allParcelas.length)
        ? transacao._allParcelas : [transacao];
    const hasEfetivada = grupoRows.some(t => t.status === 'Efetivada');
    const hasPendentes = grupoRows.some(t => t.status === 'Pendente');
    if (transacao.recorrencia_encerrada === true || (hasEfetivada && !hasPendentes)) return 'bloqueado';
    if (!hasEfetivada) return 'serie';
    return 'encerrar';
}

/** Efetivar/desmarcar e excluir/encerrar de uma linha (antes dentro do TransactionCard). */
export function useTransactionActions(transacao, onUpdate) {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const [isDeleting, setIsDeleting] = useState(false);
    const deleteMode = seriesDeleteMode(transacao);

    const handleToggleStatus = async () => {
        try {
            await toggleStatusTransacao(transacao.id);
            onUpdate();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível alterar o status.' });
        }
    };

    const runDelete = async (fn, successDesc, successTitle = 'Concluído') => {
        try {
            await fn();
            addToast({ type: 'success', title: successTitle, description: successDesc });
            setIsDeleting(true);
            setTimeout(() => onUpdate(), 450);
        } catch (error) {
            const msg = error.response?.data?.detail || 'Erro ao processar a solicitação.';
            addToast({ type: 'error', title: 'Erro', description: msg });
        }
    };

    const handleDelete = async () => {
        // Pontual: exclusão direta (lançamento manual avulso).
        if (deleteMode === 'pontual') {
            const ok = await confirm({
                title: 'Excluir transação?',
                description: 'Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.',
                confirmLabel: 'Sim, excluir', variant: 'danger',
            });
            if (!ok) return;
            await runDelete(() => deleteTransacao(transacao.id), 'Transação removida.');
            return;
        }

        // Já encerrada ou totalmente efetivada (sem pendentes): nada a fazer.
        if (deleteMode === 'bloqueado') {
            addToast({
                type: 'info', title: 'Não é possível excluir',
                description: 'Lançamentos já efetivados são histórico e não podem ser excluídos. Não há cobranças pendentes para cancelar.',
            });
            return;
        }

        // Série nunca efetivada → pode ser removida por completo.
        if (deleteMode === 'serie') {
            const ok = await confirm({
                title: 'Excluir série?',
                description: 'Nenhum lançamento desta série foi efetivado ainda — ela será removida por completo.',
                confirmLabel: 'Sim, excluir', variant: 'danger',
            });
            if (!ok) return;
            await runDelete(() => deleteTransacao(transacao.id), 'Série removida.');
            return;
        }

        // Tem efetivadas E pendentes → encerrar (cancela pendentes, mantém histórico).
        const ok = await confirm({
            title: 'Encerrar recorrência?',
            description: 'As próximas cobranças (pendentes) serão canceladas e o histórico já efetivado será mantido como "Encerrado". Os lançamentos efetivados não podem ser excluídos.',
            confirmLabel: 'Sim, encerrar', variant: 'warning',
        });
        if (!ok) return;
        await runDelete(() => stopRecorrencia(transacao.id), 'Cobranças futuras canceladas. Histórico mantido.', 'Série encerrada');
    };

    return { isDeleting, deleteMode, handleToggleStatus, handleDelete };
}
```

Criar `bussola_web/src/pages/Financas/components/ParcelaSubList.jsx`:

```jsx
const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Sub-linhas do histórico de um grupo (parcelas, recorrência ou movimentações do cofre). */
export function ParcelaSubList({ transacao }) {
    if (transacao._isCofre) {
        const movs = transacao._cofreMovs || [];
        return (
            <div className="parcela-expanded-list">
                {movs.map(mv => {
                    const d = new Date(mv.data);
                    const isSelf = mv.id === transacao._movId;
                    return (
                        <div key={mv.id} className={`parcela-sub-row ${isSelf ? 'parcela-sub-current' : ''}`}>
                            <span className="parcela-sub-badge">{mv.tipo === 'aporte' ? 'Aporte' : 'Retirada'}</span>
                            <span className="parcela-sub-data">{d.toLocaleDateString('pt-BR')}</span>
                            <span className={`tag tag-status tag-${mv.status.toLowerCase()}`}>{mv.status}</span>
                            <span className="parcela-sub-valor row-valor-cofre">
                                {mv.tipo === 'aporte' ? '+' : '−'} {fmtBRL(mv.valor || 0)}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }

    const tipo = transacao.tipo_recorrencia || 'pontual';
    return (
        <div className="parcela-expanded-list">
            {(transacao._allParcelas || []).map(p => {
                const d = new Date(p.data);
                const isSelf = p.id === transacao.id;  // destaca a linha que foi clicada
                return (
                    <div key={p.id} className={`parcela-sub-row ${isSelf ? 'parcela-sub-current' : ''}`}>
                        {tipo === 'parcelada' ? (
                            <span className="parcela-sub-badge">{p.parcela_atual}/{p.total_parcelas}</span>
                        ) : (
                            <span className="parcela-sub-badge parcela-sub-badge-month">
                                {d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                            </span>
                        )}
                        <span className="parcela-sub-data">{d.toLocaleDateString('pt-BR')}</span>
                        <span className={`tag tag-status tag-${p.status.toLowerCase()}`}>{p.status}</span>
                        <span className={`parcela-sub-valor ${p.categoria?.tipo}`}>
                            {p.categoria?.tipo === 'despesa' ? '−' : '+'} {fmtBRL(p.valor)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 8: `TransactionCard` usa as peças extraídas (markup idêntico)**

Substituir `bussola_web/src/pages/Financas/components/TransactionCard.jsx` inteiro por:

```jsx
import { useTransactionActions } from './useTransactionActions';
import { ParcelaSubList } from './ParcelaSubList';
import { PAG_LABEL, PAG_ICONE } from './pagamento';

export function TransactionCard({ transacao, onUpdate, onEdit, onEditCofre, onToggleCofre, onDeleteCofre, isExpanded, onToggleExpand }) {
    const { isDeleting, handleToggleStatus, handleDelete } = useTransactionActions(transacao, onUpdate);

    const isEncerrada = transacao.recorrencia_encerrada === true;
    const tipo = transacao.tipo_recorrencia || 'pontual';
    const isExpandableGroup = transacao._allParcelas && transacao._allParcelas.length > 1;

    const dateObj = new Date(transacao.data);
    const dateStr = dateObj.toLocaleDateString('pt-BR');
    const valorStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transacao.valor);
    const rawTotal = transacao.valor_total_parcelamento || (transacao.valor * transacao.total_parcelas);
    const valorTotalStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rawTotal);

    // ── Linha de COFRE (transferência neutra — só exibição) ──────────────────
    if (transacao._isCofre) {
        const movs = transacao._cofreMovs || [];
        const cofreExpandable = movs.length > 1;
        const isAporte = transacao.tipo_mov === 'aporte';
        const isArquivada = transacao._cofreArquivada === true;
        const isAgendado = transacao.origem === 'agendado';
        const isPendente = transacao.status === 'Pendente';
        return (
            <div className={`transacao-row-wrapper ${isExpanded && cofreExpandable ? 'row-wrapper-expanded' : ''}`}>
                <div className={`transacao-row transacao-row-cofre ${isArquivada ? 'row-encerrado' : ''}`}>
                    <div className="row-cells">
                        <div className="row-cat-icon">
                            <i className={transacao.categoria?.icone || 'fa-solid fa-piggy-bank'}
                               style={{ color: isArquivada ? '#9ca3af' : (transacao.categoria?.cor || 'var(--cor-azul-primario)') }} />
                        </div>
                        <div className="row-main">
                            <span className={`row-descricao ${isArquivada ? 'row-descricao-encerrada' : ''}`}>{transacao.descricao}</span>
                        </div>
                        <span className="row-categoria-nome">{transacao.categoria?.nome || '—'}</span>
                        <span className="row-data">{dateStr}</span>
                        <div className="row-tags">
                            <span className="tag tag-cofre"><i className="fa-solid fa-piggy-bank"></i> Cofre</span>
                            <span className={`tag tag-origem ${isAgendado ? 'tag-origem-auto' : ''}`}>
                                <i className={`fa-solid ${isAgendado ? 'fa-robot' : 'fa-hand'}`}></i> {isAgendado ? 'Automático' : 'Manual'}
                            </span>
                            {isArquivada && (
                                <span className="tag tag-arquivada"><i className="fa-solid fa-box-archive"></i> Arquivado</span>
                            )}
                            {isPendente && (
                                <span className="tag tag-status tag-pendente">Pendente</span>
                            )}
                        </div>
                        <div className="row-valor-cell">
                            <span className={`row-valor row-valor-cofre ${isArquivada ? 'row-valor-encerrado' : ''}`}>{isAporte ? '+' : '−'} {valorStr}</span>
                        </div>
                    </div>
                    <div className="row-actions">
                        <div className="row-actions-inner">
                            {!isArquivada && (
                                <button
                                    onClick={() => onToggleCofre && onToggleCofre(transacao)}
                                    className={isPendente ? 'btn-sm-pagar' : 'btn-sm-desmarcar'}
                                >
                                    {isPendente ? 'Efetivar' : 'Desmarcar'}
                                </button>
                            )}
                            {!isArquivada && (
                                <button
                                    onClick={() => onEditCofre && onEditCofre(transacao)}
                                    className="btn-action-icon btn-edit-transacao"
                                    title="Editar movimentação"
                                >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                </button>
                            )}
                            {/* Aporte automático já efetivado é histórico — sem excluir.
                                Manual (qualquer) e automático pendente podem ser removidos. */}
                            {!isArquivada && !(isAgendado && !isPendente) && (
                                <button
                                    onClick={() => onDeleteCofre && onDeleteCofre(transacao)}
                                    className="btn-action-icon btn-delete-transacao"
                                    title="Excluir movimentação"
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                </button>
                            )}
                            {cofreExpandable && (
                                <button
                                    onClick={() => onToggleExpand && onToggleExpand(transacao.id)}
                                    className="btn-action-icon btn-expand-parcelas"
                                >
                                    <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {isExpanded && cofreExpandable && <ParcelaSubList transacao={transacao} />}
            </div>
        );
    }

    return (
        <div className={`transacao-row-wrapper ${isDeleting ? 'row-wrapper-deleting' : ''} ${isExpanded && isExpandableGroup ? 'row-wrapper-expanded' : ''}`}>
            <div className={`transacao-row ${transacao.status.toLowerCase()} ${isEncerrada ? 'row-encerrado' : ''}`}>

                {/* Células principais */}
                <div className="row-cells">

                    {/* Col 1: Ícone */}
                    <div className="row-cat-icon">
                        <i
                            className={transacao.categoria?.icone || 'fa-solid fa-question'}
                            style={{ color: isEncerrada ? '#9ca3af' : (transacao.categoria?.cor || '#aaa') }}
                        />
                    </div>

                    {/* Col 2: Título */}
                    <div className="row-main">
                        <span className={`row-descricao ${isEncerrada ? 'row-descricao-encerrada' : ''}`}>
                            {transacao.descricao}
                        </span>
                    </div>

                    {/* Col 3: Categoria */}
                    <span className="row-categoria-nome">{transacao.categoria?.nome || '—'}</span>

                    {/* Col 4: Data */}
                    <span className="row-data">{dateStr}</span>

                    {/* Col 5: Tags */}
                    <div className="row-tags">
                        {/* Tag de TIPO — permanece mesmo quando encerrada (igual Cofre+Arquivado) */}
                        {tipo === 'pontual' ? (
                            <span className="tag tag-tipo tag-pontual">Pontual</span>
                        ) : (
                            <span className={`tag tag-tipo tag-${tipo}`}>
                                {tipo === 'parcelada' ? 'Parcelada' : 'Recorrente'}
                            </span>
                        )}
                        {/* Tag de ESTADO — encerrada, ou status normal quando é série ativa */}
                        {isEncerrada ? (
                            <span className="tag tag-encerrada">
                                <i className="fa-solid fa-ban"></i> Encerrada
                            </span>
                        ) : tipo !== 'pontual' ? (
                            <span className={`tag tag-status tag-${transacao.status.toLowerCase()}`}>
                                {transacao.status}
                            </span>
                        ) : null}
                        {/* Forma de pagamento (quando informada) */}
                        {transacao.tipo_pagamento && (
                            <span className={`tag tag-pagamento tag-pag-${transacao.tipo_pagamento}`}>
                                <i className={PAG_ICONE[transacao.tipo_pagamento]}></i> {PAG_LABEL[transacao.tipo_pagamento]}
                            </span>
                        )}
                    </div>

                    {/* Col 6: Valor */}
                    <div className="row-valor-cell">
                        {tipo === 'parcelada' && transacao._allParcelas && (
                            <span className="parcela-indicator" title={`Total: ${valorTotalStr}`}>
                                {transacao.parcela_atual}/{transacao.total_parcelas}
                            </span>
                        )}
                        <span className={`row-valor ${transacao.categoria?.tipo} ${isEncerrada ? 'row-valor-encerrado' : ''}`}>
                            {transacao.categoria?.tipo === 'despesa' ? '−' : '+'} {valorStr}
                        </span>
                    </div>
                </div>

                {/* Ações — com mouse: sobrepostas no fim da linha, no hover; com toque: sempre visíveis */}
                <div className="row-actions">
                  <div className="row-actions-inner">
                    {tipo !== 'pontual' && !isEncerrada && (
                        <button
                            onClick={handleToggleStatus}
                            className={transacao.status === 'Pendente' ? 'btn-sm-pagar' : 'btn-sm-desmarcar'}
                        >
                            {transacao.status === 'Pendente' ? 'Efetivar' : 'Desmarcar'}
                        </button>
                    )}
                    <button onClick={() => onEdit && onEdit(transacao)} className="btn-action-icon btn-edit-transacao">
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    {/* Encerrada = histórico; não pode ser excluída (botão oculto). */}
                    {!isEncerrada && (
                        <button onClick={handleDelete} className="btn-action-icon btn-delete-transacao">
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                    )}
                    {isExpandableGroup && (
                        <button
                            onClick={() => onToggleExpand && onToggleExpand(transacao.id)}
                            className="btn-action-icon btn-expand-parcelas"
                        >
                            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                        </button>
                    )}
                  </div>
                </div>
            </div>

            {/* Sub-linhas expandidas (parcelas ou histórico recorrente) */}
            {isExpanded && transacao._allParcelas && <ParcelaSubList transacao={transacao} />}
        </div>
    );
}
```

- [ ] **Step 9: Controlador de Metas e partes compartilhadas**

Criar `bussola_web/src/pages/Metas/useMetasController.js`:

```js
import { useEffect, useState } from 'react';
import { getMetasDashboard, deleteMeta } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';

export const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/**
 * Estado e ações de Metas & Cofrinhos (antes dentro do MetasModal).
 * Views internas: grid | form | cofre | historico. Usado pelo MetasModal (desktop)
 * e pela aba Metas de Provisões (celular). `onUpdate` propaga saldo para a página.
 */
export function useMetasController({ onUpdate } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');       // grid | form | cofre | historico
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const { addToast } = useToast();
  const dialogConfirm = useConfirm();

  const fetchData = async ({ silent } = {}) => {
    try {
      const d = await getMetasDashboard();
      setData(d);
      // Mantém a meta selecionada sincronizada (progresso/saldo) após aportes.
      setSelectedMeta((prev) => (prev ? d.metas.find((m) => m.id === prev.id) || prev : prev));
      onUpdate?.();
      return d;
    } catch {
      if (!silent) addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar metas.' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData({ silent: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resumo = data?.resumo || { disponivel: 0, guardado: 0, total: 0 };
  const metas = data?.metas || [];

  const openGrid = () => { setView('grid'); setSelectedMeta(null); setEditingData(null); };
  const openNew = () => { setEditingData(null); setView('form'); };
  const openEdit = (meta) => { setEditingData(meta); setView('form'); };
  const openCofre = (meta) => { setSelectedMeta(meta); setView('cofre'); };
  const openHistorico = () => setView('historico');

  // Back contextual: da timeline volta pro cofre (mantém a meta); senão volta pra grade.
  const goBack = () => {
    if (view === 'historico') { setView('cofre'); return; }
    openGrid();
  };

  const handleSaved = async () => { await fetchData(); openGrid(); };

  const handleDelete = async (meta) => {
    const ok = await dialogConfirm({
      title: 'Arquivar cofre?',
      description: `Os ${fmtBRL(meta.saldo_atual)} guardados em "${meta.nome}" voltam para o seu Disponível. O histórico de aportes fica salvo (arquivado) nas transações. O cofre sai da sua lista de metas.`,
      confirmLabel: 'Sim, arquivar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMeta(meta.id);
      addToast({ type: 'success', title: 'Arquivado', description: 'Cofre arquivado.' });
      await fetchData();
    } catch (err) {
      addToast({ type: 'error', title: 'Erro', description: err.response?.data?.detail || 'Falha ao arquivar.' });
    }
  };

  const title =
    view === 'form' ? (editingData ? 'Editar meta' : 'Nova meta')
    : view === 'historico' ? (selectedMeta?.nome ? `${selectedMeta.nome} · Movimentações` : 'Movimentações')
    : view === 'cofre' ? (selectedMeta?.nome || 'Cofrinho')
    : 'Metas & Cofrinhos';

  return {
    data, loading, view, selectedMeta, editingData, resumo, metas, title,
    fetchData, openGrid, openNew, openEdit, openCofre, openHistorico, goBack, handleSaved, handleDelete,
  };
}
```

Criar `bussola_web/src/pages/Metas/MetasParts.jsx`:

```jsx
import { MetaForm } from './components/MetaForm';
import { CofreScene } from './CofreScene';
import { MetaHistorico } from './components/MetaHistorico';
import { fmtBRL } from './useMetasController';

const EXPLICACAO = 'Guardar em metas é uma transferência: sai do Disponível e vai pro Guardado, mas o Total (patrimônio) não muda e não conta como gasto. O patrimônio só diminui quando você realmente gastar o objetivo.';

/** Cabeçalho do modal/sheet de Metas: voltar (fora da grade), título e fechar. */
export function MetasHeader({ ctl, onClose }) {
  return (
    <div className="modal-header metas-modal-header">
      {ctl.view !== 'grid' && (
        <button type="button" className="metas-back-btn" onClick={ctl.goBack} title="Voltar" aria-label="Voltar">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
      )}
      <h3>
        {ctl.view === 'grid' && <i className="fa-solid fa-piggy-bank" style={{ marginRight: 8, color: 'var(--cor-azul-primario)' }}></i>}
        {ctl.title}
      </h3>
      <span className="close-btn" role="button" aria-label="Fechar" onClick={onClose}>&times;</span>
    </div>
  );
}

/** Disponível / Guardado / Total. No celular a explicação fica visível (sem tooltip). */
export function MetasResumo({ resumo, explainVisible = false }) {
  return (
    <>
      <div className="metas-kpis">
        <span className="ph-kpi positivo" title="Dinheiro livre pra gastar (Total − Guardado). Guardar numa meta reduz o disponível, mas não é gasto.">
          <i className="fa-solid fa-wallet"></i> Disponível {fmtBRL(resumo.disponivel)}
        </span>
        <span className="ph-kpi guardado" title="Reservado nas suas metas/cofrinhos. Continua sendo seu — só saiu do disponível.">
          <i className="fa-solid fa-piggy-bank"></i> Guardado {fmtBRL(resumo.guardado)}
        </span>
        <span className="ph-kpi" title="Seu patrimônio (receitas − despesas). Guardar NÃO muda o total; só move do disponível pro guardado.">
          <i className="fa-solid fa-scale-balanced"></i> Total {fmtBRL(resumo.total)}
        </span>
        {!explainVisible && (
          <span className="metas-kpis-info" title={EXPLICACAO}>
            <i className="fa-solid fa-circle-info"></i>
          </span>
        )}
      </div>
      {explainVisible && (
        <p className="metas-explain">
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
          <span>{EXPLICACAO}</span>
        </p>
      )}
    </>
  );
}

/** Views fora da grade: formulário, cena do cofre e histórico. */
export function MetasDetailView({ ctl }) {
  return (
    <>
      {ctl.view === 'form' && (
        <MetaForm
          editingData={ctl.editingData}
          iconesDisponiveis={ctl.data?.icones_disponiveis || []}
          coresDisponiveis={ctl.data?.cores_disponiveis || []}
          onSaved={ctl.handleSaved}
          onCancel={ctl.openGrid}
        />
      )}

      {ctl.view === 'cofre' && ctl.selectedMeta && (
        <CofreScene
          meta={ctl.selectedMeta}
          onUpdate={ctl.fetchData}
          onOpenHistorico={ctl.openHistorico}
        />
      )}

      {ctl.view === 'historico' && ctl.selectedMeta && (
        <div className="modal-body metas-historico-body">
          <MetaHistorico meta={ctl.selectedMeta} onChange={ctl.fetchData} />
        </div>
      )}
    </>
  );
}
```

Substituir `bussola_web/src/pages/Metas/MetasModal.jsx` inteiro por:

```jsx
import { BaseModal } from '../../components/BaseModal';
import { MetaCard } from './components/MetaCard';
import { useMetasController } from './useMetasController';
import { MetasHeader, MetasResumo, MetasDetailView } from './MetasParts';
import './styles.css';

/**
 * Modal grande de Metas & Cofrinhos, aberto a partir da página de Provisões (desktop/tablet).
 * Navega por "views" internas (grade / cofre / form / histórico) — sem modais aninhados.
 * No celular a mesma lógica vive na aba Metas (MetasTab).
 */
export function MetasModal({ onClose, onUpdate }) {
  const ctl = useMetasController({ onUpdate });

  return (
    <BaseModal onClose={onClose} className="modal metas-modal-overlay">
      <div className="modal-content metas-modal metas-scope" onClick={(e) => e.stopPropagation()}>
        <MetasHeader ctl={ctl} onClose={onClose} />

        {ctl.view === 'grid' && (
          <div className="modal-body metas-grid-body">
            <MetasResumo resumo={ctl.resumo} />

            <div className="metas-toolbar">
              <button className="btn-primary" onClick={ctl.openNew}><i className="fa-solid fa-plus"></i> Nova meta</button>
            </div>

            {ctl.loading ? (
              <p className="empty-list-msg">Carregando metas…</p>
            ) : ctl.metas.length ? (
              <div className="metas-grid">
                {ctl.metas.map((m) => (
                  <MetaCard key={m.id} meta={m} onOpen={ctl.openCofre} onEdit={ctl.openEdit} onDelete={ctl.handleDelete} />
                ))}
              </div>
            ) : (
              <div className="metas-empty">
                <i className="fa-solid fa-piggy-bank"></i>
                <p>Nenhum cofrinho ainda.</p>
                <button className="btn-primary" onClick={ctl.openNew}><i className="fa-solid fa-plus"></i> Criar primeira meta</button>
              </div>
            )}
          </div>
        )}

        <MetasDetailView ctl={ctl} />
      </div>
    </BaseModal>
  );
}
```

- [ ] **Step 10: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs` → Expected: 3 passed.
Run: `npm run e2e -- --project=desktop` → Expected: 19 passed (inclui `financas.png`, `modal-transacao.png` e os 4 novos). Se um PNG mudou, o markup extraído diverge do original: compare o diff do JSX com o original (`git diff`) e corrija até ficar idêntico.
Run: `npm run build` → OK.
Run: `npx eslint src/pages/Financas src/pages/Metas` → Expected: 1 error (o mesmo pré-existente de `FinancasModals.jsx`) e nenhum novo. Se `useMetasController.js` acusar `set-state-in-effect` na linha do `useEffect`, troque o efeito pelo padrão já usado em `MetaHistorico.jsx` (função `async function loadOnMount()` declarada dentro do efeito, que chama `getMetasDashboard()`, `setData` e `setLoading(false)`).

- [ ] **Step 11: Commit**

```bash
git add bussola_web/e2e bussola_web/src/pages/Financas bussola_web/src/pages/Metas
git commit -m "refactor(web): extrai consulta, acoes da linha e controlador de Metas (desktop inalterado)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Layout mobile de Provisões (KPIs, abas, lista por dia, abas Metas e Categorias)

**Files:**
- Create: `bussola_web/src/components/mobile/Segmented.jsx`, `bussola_web/src/pages/Financas/mobile/ProvisoesMobile.jsx`, `bussola_web/src/pages/Financas/mobile/KpiStrip.jsx`, `bussola_web/src/pages/Financas/mobile/TransacoesTab.jsx`, `bussola_web/src/pages/Financas/mobile/TransactionRowMobile.jsx`, `bussola_web/src/pages/Financas/mobile/CategoriasTab.jsx`, `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css`, `bussola_web/src/pages/Metas/MetasTab.jsx`
- Modify: `bussola_web/src/components/mobile/mobile.css`, `bussola_web/src/pages/Financas/index.jsx`, `bussola_web/e2e/provisoes.mobile.spec.mjs`

**Interfaces:**
- Consumes: `filterAndSortTransactions`, `groupByDay`, `FILTER_DEFAULTS` (Task 1); `useMetasController`, `MetasHeader`, `MetasResumo`, `MetasDetailView` (Task 1); `Fab`, `ActionSheet`, `BaseModal` (plano 01).
- Produces:
  - `Segmented({ options: Array<{ value, label, icon? }>, value, onChange, label, className })` → `div.m-segmented[role="tablist"]` com `button.m-segmented-item[role="tab"][aria-selected]`.
  - `ProvisoesMobile(props)` (props listadas no Step 7), `KpiStrip`, `TransacoesTab`, `TransactionRowMobile({ transacao, onUpdate, onEdit, onEditCofre, onToggleCofre, onDeleteCofre })` (`div.m-tx-row[role="button"][data-tipo]`), `CategoriasTab`, `MetasTab({ onUpdate })`.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/provisoes.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 2 — layout mobile
// ---------------------------------------------------------------------------
test.describe('layout mobile', () => {
  test('topbar "Provisões", sem page-header, KPIs na ordem e aba Transações ativa', async ({ page }) => {
    await gotoApp(page, '/financas');
    await expect(page.locator('.m-topbar-title')).toHaveText('Provisões');
    await expect(page.locator('.page-header')).toHaveCount(0);
    const kpis = page.locator('.m-kpi .m-kpi-label');
    await expect(kpis.first()).toHaveText('Disponível');
    await expect(kpis.nth(1)).toHaveText('Receitas');
    await expect(kpis.nth(2)).toHaveText('Despesas');
    await expect(kpis.last()).toHaveText('Caixa');
    await expect(page.getByRole('tab', { name: 'Transações', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px nas 3 abas`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/financas');
      for (const aba of ['Transações', 'Metas', 'Categorias']) {
        await abrirAba(page, aba);
        await page.waitForLoadState('networkidle');
        expect(await overflowOffenders(page), `${aba} @ ${w}px`).toEqual([]);
      }
    });
  }

  test('alvos de toque ≥ 44px nas 3 abas', async ({ page }) => {
    await gotoApp(page, '/financas');
    for (const aba of ['Transações', 'Metas', 'Categorias']) {
      await abrirAba(page, aba);
      await page.waitForLoadState('networkidle');
      expect(await smallTargets(page, '.financas-scope'), aba).toEqual([]);
    }
  });

  test('trocar de aba troca o conteúdo e o Fab (um por vez)', async ({ page }) => {
    await gotoApp(page, '/financas');
    await expect(page.getByRole('button', { name: 'Nova transação' })).toBeVisible();
    await abrirAba(page, 'Metas');
    await expect(page.locator('.m-metas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova meta' })).toBeVisible();
    await abrirAba(page, 'Categorias');
    await expect(page.locator('.m-cats .categoria-list')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova categoria' })).toBeVisible();
    await expect(page.locator('.app-fab')).toHaveCount(1);
    await abrirAba(page, 'Transações');
    await expect(page.locator('.m-tx')).toBeVisible();
    await expect(page.locator('.app-fab')).toHaveCount(1);
  });

  test('tocar no KPI mostra a explicação; Caixa abre os ajustes em sheet', async ({ page }) => {
    await gotoApp(page, '/financas');
    const disponivel = page.locator('.m-kpi', { hasText: 'Disponível' });
    await disponivel.click();
    await expect(page.locator('.m-kpi-explain')).toContainText('Caixa − Guardado');
    await expect(disponivel).toHaveAttribute('aria-expanded', 'true');
    await disponivel.click();
    await expect(page.locator('.m-kpi-explain')).toHaveCount(0);
    await page.locator('.m-kpi', { hasText: 'Caixa' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('h3')).toContainText('Ajustes de Caixa');
  });

  test('lista agrupada por dia (cabeçalhos sem repetir) e "Carregar mais"', async ({ page }) => {
    await gotoApp(page, '/financas');
    const heads = await page.locator('.m-tx-day-head').allTextContents();
    expect(heads.length).toBeGreaterThan(1);
    for (const h of heads) expect(h).toMatch(/^(Hoje|Ontem|Amanhã|[A-Z][a-zá]{2}) · \d{2}\/\d{2}(\/\d{2})?$/);
    for (let i = 1; i < heads.length; i += 1) expect(heads[i]).not.toBe(heads[i - 1]);
    const rows = page.locator('.m-tx-row');
    await expect(rows).toHaveCount(30);
    await page.getByRole('button', { name: /^Carregar mais/ }).click();
    expect(await rows.count()).toBeGreaterThan(30);
  });

  test('linha em 2 níveis: título com reticências, valor à direita, textos ≥ 14px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/financas');
    const row = page.locator('.m-tx-row').first();
    const title = await row.locator('.m-tx-title').boundingBox();
    const valor = await row.locator('.m-tx-valor').boundingBox();
    const meta = await row.locator('.m-tx-meta').boundingBox();
    expect(title.width).toBeGreaterThan(80);
    expect(title.x + title.width).toBeLessThanOrEqual(valor.x + 1);
    expect(meta.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
    expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(56);
    for (const sel of ['.m-tx-title', '.m-tx-valor']) {
      const fs = await row.locator(sel).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(fs).toBeGreaterThanOrEqual(14);
    }
  });

  test('busca filtra a lista sem acento', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'netflix');
    const titles = await page.locator('.m-tx-row .m-tx-title').allTextContents();
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) expect(t).toMatch(/Netflix/);
  });

  test('Fab abre Pontual / Parcelada / Recorrente e leva ao form em sheet', async ({ page }) => {
    await gotoApp(page, '/financas');
    await page.getByRole('button', { name: 'Nova transação' }).click();
    await expect(page.locator('.action-sheet .action-sheet-item')).toHaveText(['Pontual', 'Parcelada', 'Recorrente']);
    await page.locator('.action-sheet').getByRole('button', { name: 'Parcelada' }).click();
    const form = page.locator('.modal-overlay.is-sheet').first();
    await expect(form.locator('h3')).toHaveText('Nova Transação Parcelada');
    await form.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs`
Expected: os testes de "layout mobile" FAIL (não há `.m-kpi`, abas nem `.m-tx-row`); os 3 de "lógica pura" passam.

- [ ] **Step 2: Controle segmentado**

Criar `bussola_web/src/components/mobile/Segmented.jsx`:

```jsx
/** Controle segmentado (abas de página ou alternância). Cada opção é um `role="tab"`. */
export function Segmented({ options, value, onChange, label, className = '' }) {
    return (
        <div className={`m-segmented ${className}`} role="tablist" aria-label={label}>
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    role="tab"
                    aria-selected={value === o.value}
                    className={`m-segmented-item ${value === o.value ? 'active' : ''}`}
                    onClick={() => onChange(o.value)}
                >
                    {o.icon && <i className={o.icon} aria-hidden="true"></i>}
                    <span>{o.label}</span>
                </button>
            ))}
        </div>
    );
}
```

Ao final de `bussola_web/src/components/mobile/mobile.css`, adicionar:

```css
/* ===== Controle segmentado (abas de página / alternâncias) ===== */
.m-segmented {
    display: flex;
    gap: var(--sp-1);
    padding: var(--sp-1);
    border-radius: 14px;
    background: var(--cor-card-secundario);
    border: 1px solid var(--cor-borda);
}

.m-segmented-item {
    flex: 1 1 0;
    min-width: 0;
    min-height: var(--tap-min);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    padding: 0 var(--sp-2);
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--cor-texto-secundario);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
}

.m-segmented-item.active {
    background: var(--cor-azul-primario);
    color: #fff;
}
```

- [ ] **Step 3: Faixa de KPIs**

Criar `bussola_web/src/pages/Financas/mobile/KpiStrip.jsx`:

```jsx
import { useState } from 'react';

const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/**
 * KPIs do mês numa faixa rolável. A explicação (antes só no `title`) aparece ao tocar
 * no chip; tocar de novo esconde. O Caixa abre o CaixaModal (que já tem a explicação).
 */
export function KpiStrip({ totalReceita, totalDespesa, disponivel, guardado, caixa, onOpenCaixa }) {
    const [aberto, setAberto] = useState(null);

    const chips = [
        {
            key: 'disponivel', label: 'Disponível', valor: disponivel, icon: 'fa-solid fa-scale-balanced',
            cls: disponivel >= 0 ? 'positivo' : 'negativo',
            explica: 'Disponível: dinheiro livre pra gastar (Caixa − Guardado). Guardar numa meta reduz isto, mas não é gasto.',
        },
        { key: 'receitas', label: 'Receitas', valor: totalReceita, icon: 'fa-solid fa-arrow-trend-up', cls: 'receita', explica: 'Receitas efetivadas deste mês.' },
        { key: 'despesas', label: 'Despesas', valor: totalDespesa, icon: 'fa-solid fa-arrow-trend-down', cls: 'despesa', explica: 'Despesas efetivadas deste mês.' },
        guardado > 0 && {
            key: 'guardado', label: 'Guardado', valor: guardado, icon: 'fa-solid fa-piggy-bank', cls: 'm-kpi-guardado',
            explica: 'Guardado nas metas/cofrinhos. Continua sendo seu — só saiu do disponível (não é gasto). O caixa não muda ao guardar.',
        },
        { key: 'caixa', label: 'Caixa', valor: caixa, icon: 'fa-solid fa-vault', cls: 'ph-kpi-btn', abreCaixa: true },
    ].filter(Boolean);

    const atual = chips.find((c) => c.key === aberto);

    return (
        <section className="m-kpis" aria-label="Resumo do mês">
            <div className="m-kpi-strip" data-offscreen-ok>
                {chips.map((c) => (
                    <button
                        key={c.key}
                        type="button"
                        className={`ph-kpi m-kpi ${c.cls} ${aberto === c.key ? 'is-open' : ''}`}
                        aria-expanded={c.abreCaixa ? undefined : aberto === c.key}
                        onClick={() => (c.abreCaixa ? onOpenCaixa() : setAberto(aberto === c.key ? null : c.key))}
                    >
                        <i className={c.icon} aria-hidden="true"></i>
                        <span className="m-kpi-text">
                            <span className="m-kpi-label">{c.label}</span>
                            <strong>{fmtBRL(c.valor)}</strong>
                        </span>
                        {c.abreCaixa && <i className="fa-solid fa-sliders ph-kpi-btn-hint" aria-hidden="true"></i>}
                    </button>
                ))}
            </div>
            {atual && (
                <p className="m-kpi-explain" role="status">
                    <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                    <span>{atual.explica}</span>
                </p>
            )}
        </section>
    );
}
```

- [ ] **Step 4: Linha de transação (exibição) e aba Transações**

Criar `bussola_web/src/pages/Financas/mobile/TransactionRowMobile.jsx` (versão de exibição; o toque ganha ações na Task 3):

```jsx
import { PAG_LABEL } from '../components/pagamento';

const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/** Linha de 2 níveis: [ícone] título · valor / categoria · pagamento · estado. */
export function TransactionRowMobile({ transacao: t }) {
    const isCofre = !!t._isCofre;
    const tipo = t.tipo_recorrencia || 'pontual';
    const isEncerrada = t.recorrencia_encerrada === true;
    const isArquivada = t._cofreArquivada === true;
    const apagada = isEncerrada || isArquivada;

    const sinal = isCofre ? (t.tipo_mov === 'aporte' ? '+' : '−') : (t.categoria?.tipo === 'despesa' ? '−' : '+');
    const valorCls = isCofre ? 'row-valor-cofre' : (t.categoria?.tipo || '');
    const meta = isCofre
        ? ['Cofre', t.origem === 'agendado' ? 'Automático' : 'Manual']
        : [
            t.categoria?.nome || '—',
            PAG_LABEL[t.tipo_pagamento],
            tipo === 'parcelada' && t.total_parcelas ? `${t.parcela_atual}/${t.total_parcelas}` : null,
            tipo === 'recorrente' ? 'Recorrente' : null,
        ].filter(Boolean);
    const icone = t.categoria?.icone || (isCofre ? 'fa-solid fa-piggy-bank' : 'fa-solid fa-question');
    const cor = apagada ? '#9ca3af' : (t.categoria?.cor || (isCofre ? 'var(--cor-azul-primario)' : '#aaa'));

    return (
        <div className={`m-tx-row ${apagada ? 'is-muted' : ''}`} role="button" tabIndex={0} data-tipo={isCofre ? 'cofre' : tipo}>
            <span className="row-cat-icon m-tx-icon"><i className={icone} style={{ color: cor }} /></span>
            <span className={`m-tx-title ${apagada ? 'row-descricao-encerrada' : ''}`}>{t.descricao}</span>
            <span className={`row-valor m-tx-valor ${valorCls} ${apagada ? 'row-valor-encerrado' : ''}`}>{sinal} {fmtBRL(t.valor)}</span>
            <span className="m-tx-meta">{meta.join(' · ')}</span>
            <span className="m-tx-side">
                {isEncerrada && <span className="tag tag-encerrada"><i className="fa-solid fa-ban"></i> Encerrada</span>}
                {isArquivada && <span className="tag tag-arquivada"><i className="fa-solid fa-box-archive"></i> Arquivado</span>}
            </span>
        </div>
    );
}
```

Criar `bussola_web/src/pages/Financas/mobile/TransacoesTab.jsx` (versão sem filtros; a Task 4 a substitui):

```jsx
import { useState } from 'react';
import { groupByDay } from '../transactionsQuery';
import { TransactionRowMobile } from './TransactionRowMobile';

const PAGINA = 30;

/** Aba Transações: busca, grupos por dia e "Carregar mais". */
export function TransacoesTab({ loading, transactions, filters, sortConfig, onSearch, rowProps }) {
    // "Carregar mais" volta ao início quando filtros/ordem mudam (ajuste no render, sem efeito).
    const chave = JSON.stringify([filters, sortConfig]);
    const [visiveis, setVisiveis] = useState(PAGINA);
    const [chaveAnterior, setChaveAnterior] = useState(chave);
    if (chaveAnterior !== chave) {
        setChaveAnterior(chave);
        setVisiveis(PAGINA);
    }

    const mostradas = transactions.slice(0, visiveis);
    const restantes = transactions.length - mostradas.length;
    // Cabeçalho por dia só faz sentido ordenando por data; em outra ordem, lista corrida.
    const grupos = sortConfig.column === 'data'
        ? groupByDay(mostradas)
        : [{ key: 'todas', label: null, items: mostradas }];

    return (
        <div className="m-tx">
            <div className="m-tx-head">
                <div className="m-tx-toolbar">
                    <label className="m-search">
                        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                        <input
                            type="search"
                            aria-label="Buscar transações"
                            placeholder="Buscar transações"
                            value={filters.search}
                            onChange={(e) => onSearch(e.target.value)}
                        />
                    </label>
                </div>
            </div>

            {loading ? (
                <p className="m-tx-loading"><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Carregando…</p>
            ) : transactions.length === 0 ? (
                <p className="empty-list-msg">Nenhuma transação encontrada.</p>
            ) : (
                <>
                    {grupos.map((g) => (
                        <section key={g.key} className="m-tx-day">
                            {g.label && <h3 className="m-tx-day-head">{g.label}</h3>}
                            <div className="m-tx-list">
                                {g.items.map((t) => <TransactionRowMobile key={t.id} transacao={t} {...rowProps} />)}
                            </div>
                        </section>
                    ))}
                    {restantes > 0 && (
                        <button type="button" className="btn-secondary m-load-more" onClick={() => setVisiveis((v) => v + PAGINA)}>
                            Carregar mais ({restantes})
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 5: Aba Categorias**

Criar `bussola_web/src/pages/Financas/mobile/CategoriasTab.jsx`:

```jsx
import { Segmented } from '../../../components/mobile/Segmented';
import { Fab } from '../../../components/mobile/Fab';
import { CategoryCard } from '../components/CategoryCard';

const VISOES = [
    { value: 'despesa', label: 'Despesas', icon: 'fa-solid fa-arrow-trend-down' },
    { value: 'receita', label: 'Receitas', icon: 'fa-solid fa-arrow-trend-up' },
];

/** Aba Categorias: os CategoryCard atuais em lista + alternância Despesas/Receitas. */
export function CategoriasTab({ data, catView, onCatView, onNew, onEdit, onDelete }) {
    const lista = catView === 'receita' ? (data?.categorias_receita || []) : (data?.categorias_despesa || []);
    return (
        <div className="m-cats">
            <Segmented label="Tipo de categoria" options={VISOES} value={catView} onChange={onCatView} className="m-cats-switch" />
            <div className="categoria-list">
                {lista.map((cat) => (
                    <CategoryCard key={cat.id} categoria={cat} onEdit={onEdit} onDelete={onDelete} />
                ))}
                {!lista.length && (
                    <p className="empty-list-msg">Nenhuma categoria de {catView === 'receita' ? 'receita' : 'despesa'}.</p>
                )}
            </div>
            <Fab label="Nova categoria" onClick={onNew} />
        </div>
    );
}
```

- [ ] **Step 6: Aba Metas**

Criar `bussola_web/src/pages/Metas/MetasTab.jsx`:

```jsx
import { BaseModal } from '../../components/BaseModal';
import { Fab } from '../../components/mobile/Fab';
import { MetaCard } from './components/MetaCard';
import { useMetasController } from './useMetasController';
import { MetasHeader, MetasResumo, MetasDetailView } from './MetasParts';
import './styles.css';

/**
 * Aba Metas de Provisões no celular: resumo com explicação visível e os MetaCard atuais
 * em 1 coluna. Form, cofre (Guardar/Retirar) e histórico abrem num sheet de tela cheia
 * com as mesmas views do MetasModal.
 */
export function MetasTab({ onUpdate }) {
  const ctl = useMetasController({ onUpdate });

  return (
    <div className="metas-scope m-metas">
      <div className="m-metas-resumo">
        <MetasResumo resumo={ctl.resumo} explainVisible />
      </div>

      {ctl.loading ? (
        <p className="empty-list-msg">Carregando metas…</p>
      ) : ctl.metas.length ? (
        <div className="metas-grid">
          {ctl.metas.map((m) => (
            <MetaCard key={m.id} meta={m} onOpen={ctl.openCofre} onEdit={ctl.openEdit} onDelete={ctl.handleDelete} />
          ))}
        </div>
      ) : (
        <div className="metas-empty">
          <i className="fa-solid fa-piggy-bank"></i>
          <p>Nenhum cofrinho ainda.</p>
          <button className="btn-primary" onClick={ctl.openNew}><i className="fa-solid fa-plus"></i> Criar primeira meta</button>
        </div>
      )}

      {ctl.view === 'grid' && <Fab label="Nova meta" onClick={ctl.openNew} />}

      {ctl.view !== 'grid' && (
        <BaseModal onClose={ctl.openGrid} className="modal metas-modal-overlay" sheet="full">
          <div className="modal-content metas-modal metas-scope" onClick={(e) => e.stopPropagation()}>
            <MetasHeader ctl={ctl} onClose={ctl.openGrid} />
            <MetasDetailView ctl={ctl} />
          </div>
        </BaseModal>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Contêiner mobile da página**

Criar `bussola_web/src/pages/Financas/mobile/ProvisoesMobile.jsx`:

```jsx
import { useState } from 'react';
import { Segmented } from '../../../components/mobile/Segmented';
import { Fab } from '../../../components/mobile/Fab';
import { ActionSheet } from '../../../components/mobile/ActionSheet';
import { MetasTab } from '../../Metas/MetasTab';
import { KpiStrip } from './KpiStrip';
import { TransacoesTab } from './TransacoesTab';
import { CategoriasTab } from './CategoriasTab';

const ABAS = [
    { value: 'transacoes', label: 'Transações' },
    { value: 'metas', label: 'Metas' },
    { value: 'categorias', label: 'Categorias' },
];

const NOVA_TRANSACAO = [
    { key: 'pontual', icon: 'fa-solid fa-circle-dot', label: 'Pontual' },
    { key: 'parcelada', icon: 'fa-solid fa-layer-group', label: 'Parcelada' },
    { key: 'recorrente', icon: 'fa-solid fa-rotate', label: 'Recorrente' },
];

/** Provisões no celular (≤768): KPIs, abas e o Fab da aba ativa. Estado e handlers vêm da página. */
export function ProvisoesMobile({
    data, loading, transactions, filters, sortConfig, onSearch, onApplyFilters, onClearFilter,
    kpis, onOpenCaixa, onNewTransaction, onUpdate, onEdit, onEditCofre, onToggleCofre, onDeleteCofre,
    catView, onCatView, onNewCategory, onEditCategory, onDeleteCategory,
}) {
    const [aba, setAba] = useState('transacoes');
    const [novaAberta, setNovaAberta] = useState(false);
    const rowProps = { onUpdate, onEdit, onEditCofre, onToggleCofre, onDeleteCofre };

    return (
        <div className="m-prov">
            <KpiStrip {...kpis} onOpenCaixa={onOpenCaixa} />

            <Segmented label="Seções de Provisões" options={ABAS} value={aba} onChange={setAba} className="m-prov-tabs" />

            <div className="m-prov-panel" role="tabpanel" aria-label={ABAS.find((a) => a.value === aba).label}>
                {aba === 'transacoes' && (
                    <>
                        <TransacoesTab
                            data={data}
                            loading={loading}
                            transactions={transactions}
                            filters={filters}
                            sortConfig={sortConfig}
                            onSearch={onSearch}
                            onApplyFilters={onApplyFilters}
                            onClearFilter={onClearFilter}
                            rowProps={rowProps}
                        />
                        <Fab label="Nova transação" onClick={() => setNovaAberta(true)} />
                    </>
                )}
                {aba === 'metas' && <MetasTab onUpdate={onUpdate} />}
                {aba === 'categorias' && (
                    <CategoriasTab
                        data={data}
                        catView={catView}
                        onCatView={onCatView}
                        onNew={onNewCategory}
                        onEdit={onEditCategory}
                        onDelete={onDeleteCategory}
                    />
                )}
            </div>

            <ActionSheet
                open={novaAberta}
                onClose={() => setNovaAberta(false)}
                title="Nova transação"
                icon="fa-solid fa-plus"
                actions={NOVA_TRANSACAO.map((o) => ({ ...o, onClick: () => onNewTransaction(o.key) }))}
            />
        </div>
    );
}
```

- [ ] **Step 8: CSS mobile da página**

Criar `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css`:

```css
/* ========================================================= */
/* PROVISÕES NO CELULAR (≤768) E TOQUE                        */
/* Os componentes de mobile/ só renderizam no celular; regras */
/* que tocam classes existentes ficam dentro de @media.       */
/* Escala: 8 dentro do card/linha, 12 entre cards, 16 entre   */
/* blocos e gutter, 24 entre seções (grupos de dia).          */
/* Ordem de carga: depois de Financas/styles.css e            */
/* Metas/styles.css (mesma especificidade vence), antes de    */
/* mobile.css/components.css/global.css (para vencer          */
/* `.app-sheet > …` use 3 classes).                           */
/* ========================================================= */

/* --- Estrutura --- */
.financas-scope .m-prov {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
}

/* --- KPIs (faixa rolável de borda a borda, respeitando o gutter) --- */
.financas-scope .m-kpi-strip {
    display: flex;
    gap: var(--sp-2);
    overflow-x: auto;
    margin: 0 calc(-1 * var(--sp-4));
    padding: 0 var(--sp-4);
    scroll-snap-type: x proximity;
    scroll-padding: 0 var(--sp-4);
    scrollbar-width: none;
}

.financas-scope .m-kpi-strip::-webkit-scrollbar {
    display: none;
}

.financas-scope .m-kpi {
    flex: 0 0 auto;
    scroll-snap-align: start;
    min-height: 52px;
    padding: var(--sp-2) var(--sp-3);
    gap: var(--sp-2);
    border-radius: 14px;
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.financas-scope .m-kpi i {
    font-size: 0.875rem;
}

.financas-scope .m-kpi-text {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    line-height: 1.15;
}

.financas-scope .m-kpi-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--cor-texto-secundario);
}

.financas-scope .m-kpi strong {
    font-size: 0.9375rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

.financas-scope .m-kpi.is-open {
    border-color: currentColor;
}

.financas-scope .m-kpi-guardado {
    color: var(--cor-azul-primario);
}

.financas-scope .m-kpi-explain {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-2);
    margin: var(--sp-2) 0 0;
    padding: var(--sp-3);
    border-radius: 12px;
    background: var(--cor-card-secundario);
    border: 1px solid var(--cor-borda);
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--cor-texto-secundario);
}

.financas-scope .m-kpi-explain i {
    color: var(--cor-azul-primario);
    margin-top: var(--sp-1);
}

/* --- Aba Transações --- */
.financas-scope .m-tx-head {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
}

.financas-scope .m-tx-toolbar {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
}

.financas-scope .m-search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    height: var(--tap-min);
    padding: 0 var(--sp-3);
    border-radius: 12px;
    background: var(--cor-card-secundario);
    box-shadow: inset 0 0 0 1px var(--cor-borda);
    color: var(--cor-texto-secundario);
}

.financas-scope .m-search:focus-within {
    box-shadow: inset 0 0 0 1px var(--cor-azul-primario);
}

.financas-scope .m-search input {
    flex: 1;
    min-width: 0;
    height: var(--tap-min);
    border: none;
    outline: none;
    background: transparent;
    color: var(--cor-texto-principal);
    font: inherit;
}

.financas-scope .m-tx-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    padding: var(--sp-6) 0;
    color: var(--cor-texto-secundario);
}

.financas-scope .m-tx-day + .m-tx-day {
    margin-top: var(--sp-5);
}

.financas-scope .m-tx-day-head {
    margin: 0;
    padding-bottom: var(--sp-2);
    border-bottom: 1px solid var(--cor-borda);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--cor-texto-secundario);
}

.financas-scope .m-tx-list {
    display: flex;
    flex-direction: column;
}

.financas-scope .m-tx-row {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    column-gap: var(--sp-3);
    row-gap: var(--sp-1);
    align-items: center;
    min-height: 64px;
    padding: var(--sp-3) 0;
    border-bottom: 1px solid var(--cor-borda);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}

.financas-scope .m-tx-row:last-child {
    border-bottom: none;
}

.financas-scope .m-tx-row:active {
    background: var(--cor-fundo-hover);
}

.financas-scope .m-tx-row.is-muted {
    opacity: 0.8;
}

.financas-scope .m-tx-row.is-deleting {
    animation: rowFadeOut 0.4s ease forwards;
    pointer-events: none;
}

.financas-scope .m-tx-icon {
    grid-row: 1 / span 2;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 0.9rem;
}

.financas-scope .m-tx-title {
    grid-column: 2;
    min-width: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--cor-texto-principal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.financas-scope .m-tx-valor {
    grid-column: 3;
    justify-self: end;
    font-size: 0.9375rem;
}

.financas-scope .m-tx-meta {
    grid-column: 2;
    min-width: 0;
    font-size: 0.8125rem;
    color: var(--cor-texto-secundario);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.financas-scope .m-tx-side {
    grid-column: 3;
    justify-self: end;
    display: flex;
    align-items: center;
}

.financas-scope .m-load-more {
    width: 100%;
    min-height: 48px;
    justify-content: center;
    margin-top: var(--sp-4);
}

/* --- Aba Metas --- */
.financas-scope .m-metas {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
}

.financas-scope .m-metas-resumo {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
}

.financas-scope .m-metas .metas-kpis {
    margin-bottom: 0;
}

.financas-scope .metas-scope .metas-explain {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-2);
    margin: 0;
    padding: var(--sp-3);
    border-radius: 12px;
    background: var(--cor-card-secundario);
    border: 1px solid var(--cor-borda);
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--cor-texto-secundario);
}

.financas-scope .metas-scope .metas-explain i {
    color: var(--cor-azul-primario);
    margin-top: var(--sp-1);
}

.financas-scope .m-metas .metas-grid {
    grid-template-columns: 1fr;
    gap: var(--sp-3);
}

/* --- Aba Categorias --- */
.financas-scope .m-cats {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
}

.financas-scope .m-cats .categoria-list {
    gap: var(--sp-3);
}

/* --- Toque: alvos de 44px nos cards reaproveitados (celular e tablet) --- */
@media (pointer: coarse) {
    .financas-scope .catcard-expand {
        min-width: var(--tap-min);
        min-height: var(--tap-min);
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .financas-scope .metas-scope .meta-card-actions .btn-primary,
    .financas-scope .metas-scope .metas-empty .btn-primary {
        min-height: var(--tap-min);
    }
}
```

- [ ] **Step 9: A página renderiza o layout mobile**

Em `bussola_web/src/pages/Financas/index.jsx`:

1. Trocar `import { filterAndSortTransactions } from './transactionsQuery';` por:

```js
import { FILTER_DEFAULTS, filterAndSortTransactions } from './transactionsQuery';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ProvisoesMobile } from './mobile/ProvisoesMobile';
```

2. Trocar `import './styles.css';` por:

```js
import './styles.css';
import './mobile/provisoes-mobile.css';
```

3. Trocar `    const dialogConfirm = useConfirm();` por:

```js
    const dialogConfirm = useConfirm();
    const isMobile = useIsMobile();
```

4. Trocar `    const [filterDateEnd, setFilterDateEnd] = useState('');` por:

```js
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterSearch, setFilterSearch] = useState('');
```

5. No objeto `filters` (Task 1), trocar `        search: '',` por `        search: filterSearch,`.

6. Trocar `    const allTransactions = filterAndSortTransactions(data, filters, sortConfig);` por:

```js
    // --- Celular: filtros aplicados pelo sheet, busca e atalhos de criação ---
    const handleApplyFilters = (next, nextSort) => {
        setFilterTipo(next.tipo);
        setFilterStatus(next.status);
        setFilterCategoria(next.categoria);
        setFilterPagamento(next.pagamento);
        setFilterDatePreset(next.datePreset);
        setFilterDateStart(next.dateStart);
        setFilterDateEnd(next.dateEnd);
        if (nextSort) setSortConfig(nextSort);
        setCurrentPage(1);
    };

    const handleClearFilter = (key) => {
        handleApplyFilters({
            ...filters,
            [key]: FILTER_DEFAULTS[key],
            ...(key === 'datePreset' ? { dateStart: '', dateEnd: '' } : {}),
        });
    };

    const handleSearch = (q) => {
        setFilterSearch(q);
        setCurrentPage(1);
    };

    const handleNewTransaction = (tipo) => {
        setEditingData(null);
        setActiveModal(tipo);
    };

    const handleNewCategory = () => {
        setEditingData(null);
        setActiveModal('category');
    };

    const allTransactions = filterAndSortTransactions(data, filters, sortConfig);
```

7. Trocar `            <div className="page-header">` por:

```jsx
            {!isMobile && (
            <div className="page-header">
```

8. Trocar o trecho (fim do `.page-header` e início do grid):

```jsx
            </div>

            <div className="layout-grid-custom">
```

por:

```jsx
            </div>
            )}

            {isMobile ? (
                <ProvisoesMobile
                    data={data}
                    loading={loading}
                    transactions={allTransactions}
                    filters={filters}
                    sortConfig={sortConfig}
                    onSearch={handleSearch}
                    onApplyFilters={handleApplyFilters}
                    onClearFilter={handleClearFilter}
                    kpis={{ totalReceita, totalDespesa, disponivel, guardado, caixa }}
                    onOpenCaixa={() => setShowCaixa(true)}
                    onNewTransaction={handleNewTransaction}
                    onUpdate={fetchData}
                    onEdit={handleEditTransaction}
                    onEditCofre={handleEditCofre}
                    onToggleCofre={handleToggleCofre}
                    onDeleteCofre={handleDeleteCofre}
                    catView={catView}
                    onCatView={setCatView}
                    onNewCategory={handleNewCategory}
                    onEditCategory={handleEditCategory}
                    onDeleteCategory={handleDeleteCategory}
                />
            ) : (
            <div className="layout-grid-custom">
```

9. Trocar o trecho (fim do grid e início do `MetasModal`):

```jsx
            </div>

            {showMetas && (
```

por:

```jsx
            </div>
            )}

            {showMetas && (
```

- [ ] **Step 10: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs` → Expected: todos os testes de "lógica pura" e "layout mobile" passam. Se `overflowOffenders` listar algo, o item listado diz o elemento e as coordenadas: corrija o CSS (sem `overflow: hidden` para esconder) e rode de novo.
Run: `npm run e2e -- --project=mobile` → Expected: as specs do plano 01 continuam passando (`shell`, `ai`, `foundation`, `ui-lab`, `pickers`).
Run: `npm run e2e -- --project=desktop` → Expected: 19 passed.
Run: `npm run build` → OK. Run: `npx eslint src/pages/Financas src/pages/Metas src/components/mobile` → sem novos erros.

- [ ] **Step 11: Conferência visual de espaçamento (390px)**

Abra `/financas` no DevTools em 390×844 e confira: gutter de 16px; 16px entre KPIs, abas e lista; 8px entre busca e chips; 12px de padding vertical na linha; 24px entre grupos de dia; 12px entre `MetaCard`s e entre `CategoryCard`s. Corrija só valores da escala.

- [ ] **Step 12: Commit**

```bash
git add bussola_web/src bussola_web/e2e
git commit -m "feat(web): Provisoes no celular com KPIs, abas, lista por dia e abas Metas/Categorias" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ações da transação por toque (ActionSheet), histórico em sheet e valor decimal

**Files:**
- Modify: `bussola_web/src/pages/Financas/mobile/TransactionRowMobile.jsx`, `bussola_web/src/pages/Financas/components/FinancasModals.jsx`, `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css`, `bussola_web/e2e/provisoes.mobile.spec.mjs`

**Interfaces:**
- Consumes: `useTransactionActions`, `seriesDeleteMode` (via `deleteMode`), `ParcelaSubList` (Task 1); `ActionSheet`, `Sheet`.
- Produces: tocar em `.m-tx-row` abre `ActionSheet` (`title` = descrição). Ações (em ordem): Efetivar (primária, pendente) **ou** Desmarcar / Editar / Ver parcelas · Ver histórico / Encerrar recorrência **ou** Excluir. `button.m-tx-efetivar` na linha 2 para pendentes que o desktop permite efetivar. Sheet `.m-parcelas` com `ParcelaSubList`.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/provisoes.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 3 — ações por toque
// ---------------------------------------------------------------------------
test.describe('ações da linha', () => {
  test.describe.configure({ mode: 'serial' });
  const DESC = 'E2E Café mobile';

  test('Fab → Pontual: valor decimal, Salvar visível com teclado, cria a transação de hoje', async ({ page }) => {
    await gotoApp(page, '/financas');
    await page.getByRole('button', { name: 'Nova transação' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Pontual' }).click();
    const form = page.locator('.modal-overlay.is-sheet').first();
    await expect(form.locator('h3')).toHaveText('Nova Transação Única');
    await expect(form.locator('input[name="valor"]')).toHaveAttribute('inputmode', 'decimal');

    await page.setViewportSize({ width: 390, height: 480 }); // teclado aberto
    await expect(form.getByRole('button', { name: 'Salvar' })).toBeInViewport();

    await form.locator('input[name="descricao"]').fill(DESC);
    await form.locator('input[name="valor"]').fill('12.5');
    await form.locator('.pk-trigger').click();
    await page.locator('.pk-date-panel').getByRole('button', { name: 'Hoje' }).click();
    await form.locator('.custom-select-trigger').nth(0).click();
    await page.locator('.cs-sheet-list').getByRole('button', { name: /Alimentação/ }).click();
    await form.locator('.custom-select-trigger').nth(1).click();
    await page.locator('.cs-sheet-list').getByRole('button', { name: 'Pix' }).click();
    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Salvo com sucesso.')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await buscar(page, 'E2E Café');
    const row = page.locator('.m-tx-row');
    await expect(row).toHaveCount(1);
    await expect(page.locator('.m-tx-day-head')).toHaveText(['Hoje · 02/10']);
    await expect(row.locator('.m-tx-meta')).toHaveText('Alimentação · Pix');
    await expect(row.locator('.m-tx-valor')).toHaveText(/−\sR\$\s12,50/);
  });

  test('pontual: ActionSheet com Editar e Excluir; Editar abre o form preenchido', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'E2E Café');
    await page.locator('.m-tx-row .m-tx-title').click();
    const sheet = page.locator('.action-sheet');
    await expect(sheet.locator('.action-sheet-titles strong')).toHaveText(DESC);
    await expect(sheet.locator('.action-sheet-item')).toHaveText(['Editar', 'Excluir']);
    await sheet.getByRole('button', { name: 'Editar' }).click();
    const form = page.locator('.modal-overlay.is-sheet').first();
    await expect(form.locator('h3')).toHaveText('Editar Transação');
    await expect(form.locator('input[name="descricao"]')).toHaveValue(DESC);
    await form.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
  });

  test('recorrente com histórico: Efetivar primário, Ver histórico e Encerrar (sem Excluir)', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'Netflix');
    const pendente = page.locator('.m-tx-row').filter({ has: page.locator('.m-tx-efetivar') }).first();
    const chip = await pendente.locator('.m-tx-efetivar').boundingBox();
    expect(chip.height).toBeGreaterThanOrEqual(44);
    expect(chip.width).toBeGreaterThanOrEqual(44);
    await pendente.locator('.m-tx-title').click();
    const items = page.locator('.action-sheet .action-sheet-item');
    await expect(items).toHaveText(['Efetivar', 'Editar', 'Ver histórico', 'Encerrar recorrência']);
    await expect(items.first()).toHaveClass(/is-primary/);
    await expect(items.last()).toHaveClass(/is-danger/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.action-sheet')).toHaveCount(0);
  });

  test('parcelada: Ver parcelas abre o sheet com todas as parcelas do grupo', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'Macbook');
    await page.locator('.m-tx-row .m-tx-title').first().click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Ver parcelas' }).click();
    const sheet = page.locator('.m-parcelas');
    await expect(sheet.locator('.parcela-sub-row')).toHaveCount(10);
    await expect(sheet.locator('.parcela-sub-current')).toHaveCount(1);
    expect(await overflowOffenders(page)).toEqual([]);
    for (const r of await sheet.locator('.parcela-sub-row').all()) expect((await r.boundingBox()).height).toBeGreaterThanOrEqual(44);
  });

  test('Excluir pelo ActionSheet remove a transação', async ({ page }) => {
    await gotoApp(page, '/financas');
    await buscar(page, 'E2E Café');
    await page.locator('.m-tx-row .m-tx-title').click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(page.getByText('Transação removida.')).toBeVisible();
    await expect(page.locator('.m-tx-row')).toHaveCount(0);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs -g "ações da linha"`
Expected: FAIL no 1º teste (`inputmode` ausente) e nos demais (tocar na linha não abre nada; não há `.m-tx-efetivar`).

- [ ] **Step 2: Linha com ActionSheet, chip Efetivar e sheet de histórico**

Substituir `bussola_web/src/pages/Financas/mobile/TransactionRowMobile.jsx` inteiro por:

```jsx
import { useState } from 'react';
import { ActionSheet } from '../../../components/mobile/ActionSheet';
import { Sheet } from '../../../components/mobile/Sheet';
import { useTransactionActions } from '../components/useTransactionActions';
import { ParcelaSubList } from '../components/ParcelaSubList';
import { PAG_LABEL } from '../components/pagamento';

const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/**
 * Ações do ActionSheet, na ordem: status (Efetivar primária / Desmarcar), Editar,
 * Ver parcelas/histórico, destrutiva. Espelha exatamente o que o desktop permite
 * (TransactionCard), usando o mesmo `deleteMode` para decidir Excluir × Encerrar.
 */
function acoesDaLinha(t, h) {
    const tipo = t.tipo_recorrencia || 'pontual';
    const isPendente = t.status === 'Pendente';
    const historico = t._isCofre ? (t._cofreMovs || []) : (t._allParcelas || []);
    const verHistorico = historico.length > 1
        ? [{
            key: 'historico',
            icon: tipo === 'parcelada' ? 'fa-solid fa-layer-group' : 'fa-solid fa-clock-rotate-left',
            label: tipo === 'parcelada' ? 'Ver parcelas' : 'Ver histórico',
            onClick: h.verHistorico,
        }]
        : [];
    const status = (onClick) => (isPendente
        ? { key: 'efetivar', icon: 'fa-solid fa-check', label: 'Efetivar', variant: 'primary', onClick }
        : { key: 'desmarcar', icon: 'fa-solid fa-rotate-left', label: 'Desmarcar', onClick });

    if (t._isCofre) {
        if (t._cofreArquivada) return verHistorico;
        // Aporte automático já efetivado é histórico — sem excluir (regra do desktop).
        const automaticoEfetivado = t.origem === 'agendado' && !isPendente;
        return [
            status(h.toggleCofre),
            { key: 'editar', icon: 'fa-solid fa-pen-to-square', label: 'Editar movimentação', onClick: h.editCofre },
            ...verHistorico,
            ...(automaticoEfetivado ? [] : [{ key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: h.deleteCofre }]),
        ];
    }

    const isEncerrada = t.recorrencia_encerrada === true;
    let destrutiva = [];
    if (!isEncerrada && h.deleteMode === 'encerrar') {
        destrutiva = [{ key: 'encerrar', icon: 'fa-solid fa-ban', label: 'Encerrar recorrência', variant: 'danger', onClick: h.excluir }];
    } else if (!isEncerrada && h.deleteMode !== 'bloqueado') {
        destrutiva = [{ key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: h.excluir }];
    }
    return [
        ...(tipo !== 'pontual' && !isEncerrada ? [status(h.toggle)] : []),
        { key: 'editar', icon: 'fa-solid fa-pen-to-square', label: 'Editar', onClick: h.editar },
        ...verHistorico,
        ...destrutiva,
    ];
}

/** Linha de 2 níveis. Tocar abre o ActionSheet; o chip "Efetivar" efetiva direto. */
export function TransactionRowMobile({ transacao: t, onUpdate, onEdit, onEditCofre, onToggleCofre, onDeleteCofre }) {
    const [sheet, setSheet] = useState(null); // null | 'acoes' | 'historico'
    const { isDeleting, deleteMode, handleToggleStatus, handleDelete } = useTransactionActions(t, onUpdate);

    const isCofre = !!t._isCofre;
    const tipo = t.tipo_recorrencia || 'pontual';
    const isPendente = t.status === 'Pendente';
    const isEncerrada = t.recorrencia_encerrada === true;
    const isArquivada = t._cofreArquivada === true;
    const apagada = isEncerrada || isArquivada;
    const podeEfetivar = isPendente && (isCofre ? !isArquivada : (tipo !== 'pontual' && !isEncerrada));

    const actions = acoesDaLinha(t, {
        deleteMode,
        toggle: handleToggleStatus,
        excluir: handleDelete,
        editar: () => onEdit(t),
        toggleCofre: () => onToggleCofre(t),
        editCofre: () => onEditCofre(t),
        deleteCofre: () => onDeleteCofre(t),
        verHistorico: () => setSheet('historico'),
    });

    const sinal = isCofre ? (t.tipo_mov === 'aporte' ? '+' : '−') : (t.categoria?.tipo === 'despesa' ? '−' : '+');
    const valorCls = isCofre ? 'row-valor-cofre' : (t.categoria?.tipo || '');
    const meta = isCofre
        ? ['Cofre', t.origem === 'agendado' ? 'Automático' : 'Manual']
        : [
            t.categoria?.nome || '—',
            PAG_LABEL[t.tipo_pagamento],
            tipo === 'parcelada' && t.total_parcelas ? `${t.parcela_atual}/${t.total_parcelas}` : null,
            tipo === 'recorrente' ? 'Recorrente' : null,
        ].filter(Boolean);
    const icone = t.categoria?.icone || (isCofre ? 'fa-solid fa-piggy-bank' : 'fa-solid fa-question');
    const cor = apagada ? '#9ca3af' : (t.categoria?.cor || (isCofre ? 'var(--cor-azul-primario)' : '#aaa'));
    const abrir = () => { if (actions.length) setSheet('acoes'); };

    return (
        <>
            <div
                className={`m-tx-row ${apagada ? 'is-muted' : ''} ${isDeleting ? 'is-deleting' : ''}`}
                role="button"
                tabIndex={0}
                data-tipo={isCofre ? 'cofre' : tipo}
                onClick={abrir}
                onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
                }}
            >
                <span className="row-cat-icon m-tx-icon"><i className={icone} style={{ color: cor }} /></span>
                <span className={`m-tx-title ${apagada ? 'row-descricao-encerrada' : ''}`}>{t.descricao}</span>
                <span className={`row-valor m-tx-valor ${valorCls} ${apagada ? 'row-valor-encerrado' : ''}`}>{sinal} {fmtBRL(t.valor)}</span>
                <span className="m-tx-meta">{meta.join(' · ')}</span>
                <span className="m-tx-side">
                    {podeEfetivar && (
                        <button
                            type="button"
                            className="m-tx-efetivar"
                            onClick={(e) => { e.stopPropagation(); if (isCofre) onToggleCofre(t); else handleToggleStatus(); }}
                        >
                            <span className="btn-sm-pagar">Efetivar</span>
                        </button>
                    )}
                    {isEncerrada && <span className="tag tag-encerrada"><i className="fa-solid fa-ban"></i> Encerrada</span>}
                    {isArquivada && <span className="tag tag-arquivada"><i className="fa-solid fa-box-archive"></i> Arquivado</span>}
                </span>
            </div>

            {/* Sheets como irmãos da linha: o BaseModal não é portal e o clique no overlay subiria até a linha. */}
            <ActionSheet
                open={sheet === 'acoes'}
                onClose={() => setSheet(null)}
                title={t.descricao}
                subtitle={`${new Date(t.data).toLocaleDateString('pt-BR')} · ${sinal} ${fmtBRL(t.valor)}`}
                icon={icone}
                actions={actions}
            />
            <Sheet
                open={sheet === 'historico'}
                onClose={() => setSheet(null)}
                title={tipo === 'parcelada' ? 'Parcelas' : 'Histórico'}
                className="m-parcelas"
            >
                <ParcelaSubList transacao={t} />
            </Sheet>
        </>
    );
}
```

- [ ] **Step 3: CSS do chip e do sheet de histórico**

Ao final de `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css`, adicionar:

```css
/* --- Chip "Efetivar" (alvo de 44px sem engordar a linha: margem negativa vertical) --- */
.financas-scope .m-tx-efetivar {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    min-width: var(--tap-min);
    min-height: var(--tap-min);
    margin: calc(-1 * var(--sp-2)) 0;
    padding: 0 0 0 var(--sp-2);
    border: none;
    background: transparent;
    cursor: pointer;
}

.financas-scope .m-tx-efetivar .btn-sm-pagar {
    display: inline-block;
    padding: var(--sp-1) var(--sp-3);
    font-size: 0.8125rem;
    font-weight: 600;
}

/* --- Sheet de parcelas/histórico --- */
.financas-scope .m-parcelas .parcela-expanded-list {
    border-top: none;
    background: transparent;
}

.financas-scope .m-parcelas .parcela-sub-row {
    min-height: var(--tap-min);
    gap: var(--sp-3);
    padding: var(--sp-2) 0;
    font-size: 0.875rem;
}

.financas-scope .m-parcelas .parcela-sub-row:first-child {
    border-top: none;
}

.financas-scope .m-parcelas .parcela-sub-badge {
    min-width: 56px;
    font-size: 0.8125rem;
}
```

- [ ] **Step 4: `inputMode` nos campos de valor do form de transação/categoria**

Em `bussola_web/src/pages/Financas/components/FinancasModals.jsx`, cinco trocas exatas:

1. `<input type="number" step="0.01" name="valor" value={formData.valor || ''} className="form-input" required onChange={handleChange} />`
→ `<input type="number" step="0.01" inputMode="decimal" name="valor" value={formData.valor || ''} className="form-input" required onChange={handleChange} />`

2. `<input type="number" step="0.01" name="valor" value={formData.valor || ''} className="form-input" required onChange={handleChange} placeholder="Ex: 1000.00" />`
→ `<input type="number" step="0.01" inputMode="decimal" name="valor" value={formData.valor || ''} className="form-input" required onChange={handleChange} placeholder="Ex: 1000.00" />`

3. `<input type="number" step="0.01" name="valor" value={formData.valor || ''} className="form-input" required onChange={handleChange} placeholder="Ex: 39.90" />`
→ `<input type="number" step="0.01" inputMode="decimal" name="valor" value={formData.valor || ''} className="form-input" required onChange={handleChange} placeholder="Ex: 39.90" />`

4. `<input type="number" step="0.01" name="meta_limite" value={formData.meta_limite || ''} className="form-input" placeholder="0.00" onChange={handleChange} />`
→ `<input type="number" step="0.01" inputMode="decimal" name="meta_limite" value={formData.meta_limite || ''} className="form-input" placeholder="0.00" onChange={handleChange} />`

5. A linha `                                            name="total_parcelas"` →

```jsx
                                            name="total_parcelas"
                                            inputMode="numeric"
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs` → Expected: tudo passa (Tasks 1–3).
Run: `npm run e2e -- --project=desktop` → Expected: 19 passed (`modal-transacao.png` não muda com `inputMode`).
Run: `npm run build` → OK. Run: `npx eslint src/pages/Financas` → só o erro pré-existente.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src bussola_web/e2e
git commit -m "feat(web): acoes da transacao em ActionSheet, historico em sheet e valor decimal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sheet de filtros, contador e chips removíveis

**Files:**
- Create: `bussola_web/src/pages/Financas/mobile/FiltersSheet.jsx`
- Modify: `bussola_web/src/pages/Financas/mobile/TransacoesTab.jsx`, `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css`, `bussola_web/e2e/provisoes.mobile.spec.mjs`

**Interfaces:**
- Consumes: `filterAndSortTransactions`, `activeFilterChips`, `*_OPTIONS`, `SORT_OPTIONS`, `FILTER_DEFAULTS` (Task 1); `onApplyFilters(next, nextSort)` e `onClearFilter(key)` da página (Task 2).
- Produces: `FiltersSheet({ data, filters, sortConfig, onApply, onClose })` com rascunho próprio (montado só quando aberto). Botão `button.m-filter-btn[aria-label="Filtros" | "Filtros (1 ativo)" | "Filtros (N ativos)"]` com `.m-filter-badge`; chips `button.m-active-chip[aria-label="Remover filtro <rótulo>"]`. Grupos do sheet são `fieldset` com `legend` (role `group` com nome).

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/provisoes.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 4 — filtros
// ---------------------------------------------------------------------------
test.describe('filtros', () => {
  const carregarTudo = async (page) => {
    const mais = page.getByRole('button', { name: /^Carregar mais/ });
    while (await mais.count()) await mais.click();
  };

  test('Tipo=Parcelada: "Ver N" bate com a lista e o chip remove', async ({ page }) => {
    await gotoApp(page, '/financas');
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    const sheet = page.locator('.m-filters');
    await sheet.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Parcelada' }).click();
    await expect(sheet.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Parcelada' })).toHaveAttribute('aria-pressed', 'true');
    const ver = sheet.getByRole('button', { name: /^Ver \d+ transaç/ });
    const n = Number((await ver.textContent()).match(/\d+/)[0]);
    expect(n).toBeGreaterThan(0);
    await ver.click();
    await expect(sheet).toHaveCount(0);

    await expect(page.getByRole('button', { name: 'Filtros (1 ativo)' })).toBeVisible();
    await expect(page.locator('.m-filter-badge')).toHaveText('1');
    await carregarTudo(page);
    const rows = page.locator('.m-tx-row');
    await expect(rows).toHaveCount(n);
    expect([...new Set(await rows.evaluateAll((els) => els.map((e) => e.dataset.tipo)))]).toEqual(['parcelada']);

    await page.getByRole('button', { name: 'Remover filtro Parcelada' }).click();
    await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible();
    await expect(page.locator('.m-filter-badge')).toHaveCount(0);
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('o contador do sheet acompanha o rascunho e só aplica no "Ver"', async ({ page }) => {
    await gotoApp(page, '/financas');
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    const sheet = page.locator('.m-filters');
    const ver = sheet.getByRole('button', { name: /^Ver \d+ transaç/ });
    const total = Number((await ver.textContent()).match(/\d+/)[0]);
    await sheet.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Pendente' }).click();
    const pendentes = Number((await ver.textContent()).match(/\d+/)[0]);
    expect(pendentes).toBeLessThan(total);
    await page.keyboard.press('Escape'); // descarta o rascunho
    await expect(page.locator('.m-filter-badge')).toHaveCount(0);
  });

  test('Ordenar por maior valor desliga os cabeçalhos de dia e ordena', async ({ page }) => {
    await gotoApp(page, '/financas');
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    const sheet = page.locator('.m-filters');
    await sheet.getByRole('group', { name: 'Ordenar' }).getByRole('button', { name: 'Maior valor' }).click();
    await sheet.getByRole('button', { name: /^Ver \d+ transaç/ }).click();
    await expect(page.locator('.m-tx-day-head')).toHaveCount(0);
    const valores = (await page.locator('.m-tx-valor').allTextContents())
      .slice(0, 6)
      .map((s) => Number(s.replace(/[^\d,]/g, '').replace(',', '.')));
    for (let i = 1; i < valores.length; i += 1) expect(valores[i]).toBeLessThanOrEqual(valores[i - 1]);
  });

  test('Período personalizado usa DatePicker em sheet e vira chip', async ({ page }) => {
    await gotoApp(page, '/financas');
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    const sheet = page.locator('.m-filters');
    await sheet.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Personalizado' }).click();
    await expect(sheet.locator('.m-filter-range .pk-trigger')).toHaveCount(2);
    await sheet.locator('.m-filter-range .pk-trigger').first().click();
    await page.locator('.pk-date-panel').getByRole('button', { name: 'Hoje' }).click();
    await sheet.getByRole('button', { name: /^Ver \d+ transaç/ }).click();
    await expect(page.locator('.m-active-chip')).toHaveText(['02/10–…']);
  });

  test('sheet de filtros sem overflow em 360px e com alvos de 44px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoApp(page, '/financas');
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    await expect(page.locator('.m-filters')).toBeVisible();
    expect(await overflowOffenders(page)).toEqual([]);
    expect(await smallTargets(page, '.m-filters')).toEqual([]);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs -g "filtros"` → Expected: FAIL (não há botão "Filtros").

- [ ] **Step 2: Sheet de filtros**

Criar `bussola_web/src/pages/Financas/mobile/FiltersSheet.jsx`:

```jsx
import { useState } from 'react';
import { Sheet } from '../../../components/mobile/Sheet';
import { DatePicker } from '../../../components/Pickers';
import {
    FILTER_DEFAULTS, filterAndSortTransactions,
    TIPO_OPTIONS, STATUS_OPTIONS, PAGAMENTO_OPTIONS, PERIODO_OPTIONS, SORT_OPTIONS,
} from '../transactionsQuery';

function ChipGroup({ label, options, value, onChange, children }) {
    return (
        <fieldset className="m-filter-group">
            <legend className="m-filter-label">{label}</legend>
            <div className="m-chip-row">
                {options.map(([val, rotulo]) => (
                    <button
                        key={String(val)}
                        type="button"
                        className={`m-chip ${value === val ? 'active' : ''}`}
                        aria-pressed={value === val}
                        onClick={() => onChange(val)}
                    >
                        {rotulo}
                    </button>
                ))}
            </div>
            {children}
        </fieldset>
    );
}

/**
 * Filtros do celular. Edita um RASCUNHO (montado a cada abertura) e só aplica no
 * "Ver N transações"; o N é calculado pela mesma consulta da lista.
 */
export function FiltersSheet({ data, filters, sortConfig, onApply, onClose }) {
    const [draft, setDraft] = useState(filters);
    const [sort, setSort] = useState(sortConfig);
    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

    const total = filterAndSortTransactions(data, draft, sort).length;
    const categorias = [...(data?.categorias_despesa || []), ...(data?.categorias_receita || [])];

    const footer = (
        <>
            <button
                type="button"
                className="btn-secondary"
                onClick={() => { setDraft({ ...FILTER_DEFAULTS, search: draft.search }); setSort({ column: 'data', dir: 'desc' }); }}
            >
                Limpar
            </button>
            <button type="button" className="btn-primary" onClick={() => { onApply(draft, sort); onClose(); }}>
                Ver {total} {total === 1 ? 'transação' : 'transações'}
            </button>
        </>
    );

    return (
        <Sheet open onClose={onClose} title="Filtros" footer={footer} className="m-filters">
            <ChipGroup label="Tipo" options={TIPO_OPTIONS} value={draft.tipo} onChange={(tipo) => set({ tipo })} />
            <ChipGroup label="Status" options={STATUS_OPTIONS} value={draft.status} onChange={(status) => set({ status })} />
            <ChipGroup label="Pagamento" options={PAGAMENTO_OPTIONS} value={draft.pagamento} onChange={(pagamento) => set({ pagamento })} />

            <fieldset className="m-filter-group">
                <legend className="m-filter-label">Categoria</legend>
                <div className="m-chip-row">
                    <button
                        type="button"
                        className={`m-chip ${draft.categoria == null ? 'active' : ''}`}
                        aria-pressed={draft.categoria == null}
                        onClick={() => set({ categoria: null })}
                    >
                        Todas
                    </button>
                    {categorias.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            className={`m-chip ${draft.categoria === c.id ? 'active' : ''}`}
                            aria-pressed={draft.categoria === c.id}
                            onClick={() => set({ categoria: draft.categoria === c.id ? null : c.id })}
                        >
                            <span className="cs-opt-icon-wrap" style={{ backgroundColor: c.cor }}>
                                <i className={c.icone} aria-hidden="true"></i>
                            </span>
                            {c.nome}
                        </button>
                    ))}
                </div>
            </fieldset>

            <ChipGroup label="Período" options={PERIODO_OPTIONS} value={draft.datePreset} onChange={(datePreset) => set({ datePreset })}>
                {draft.datePreset === 'custom' && (
                    <div className="m-filter-range">
                        <DatePicker label="Início" value={draft.dateStart} onChange={(e) => set({ dateStart: e.target.value })} placeholder="Início" />
                        <DatePicker label="Fim" value={draft.dateEnd} onChange={(e) => set({ dateEnd: e.target.value })} placeholder="Fim" />
                    </div>
                )}
            </ChipGroup>

            <ChipGroup
                label="Ordenar"
                options={SORT_OPTIONS.map((o) => [o.key, o.label])}
                value={`${sort.column}-${sort.dir}`}
                onChange={(key) => {
                    const o = SORT_OPTIONS.find((x) => x.key === key);
                    setSort({ column: o.column, dir: o.dir });
                }}
            />
        </Sheet>
    );
}
```

- [ ] **Step 3: Aba Transações com botão de filtros e chips**

Substituir `bussola_web/src/pages/Financas/mobile/TransacoesTab.jsx` inteiro por:

```jsx
import { useState } from 'react';
import { activeFilterChips, groupByDay } from '../transactionsQuery';
import { TransactionRowMobile } from './TransactionRowMobile';
import { FiltersSheet } from './FiltersSheet';

const PAGINA = 30;

/** Aba Transações: busca, filtros (sheet + chips), grupos por dia e "Carregar mais". */
export function TransacoesTab({ data, loading, transactions, filters, sortConfig, onSearch, onApplyFilters, onClearFilter, rowProps }) {
    // "Carregar mais" volta ao início quando filtros/ordem mudam (ajuste no render, sem efeito).
    const chave = JSON.stringify([filters, sortConfig]);
    const [visiveis, setVisiveis] = useState(PAGINA);
    const [chaveAnterior, setChaveAnterior] = useState(chave);
    const [filtrosAbertos, setFiltrosAbertos] = useState(false);
    if (chaveAnterior !== chave) {
        setChaveAnterior(chave);
        setVisiveis(PAGINA);
    }

    const chips = activeFilterChips(filters, data);
    const n = chips.length;
    const mostradas = transactions.slice(0, visiveis);
    const restantes = transactions.length - mostradas.length;
    // Cabeçalho por dia só faz sentido ordenando por data; em outra ordem, lista corrida.
    const grupos = sortConfig.column === 'data'
        ? groupByDay(mostradas)
        : [{ key: 'todas', label: null, items: mostradas }];

    return (
        <div className="m-tx">
            <div className="m-tx-head">
                <div className="m-tx-toolbar">
                    <label className="m-search">
                        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                        <input
                            type="search"
                            aria-label="Buscar transações"
                            placeholder="Buscar transações"
                            value={filters.search}
                            onChange={(e) => onSearch(e.target.value)}
                        />
                    </label>
                    <button
                        type="button"
                        className={`m-filter-btn ${n ? 'active' : ''}`}
                        aria-label={n === 0 ? 'Filtros' : n === 1 ? 'Filtros (1 ativo)' : `Filtros (${n} ativos)`}
                        onClick={() => setFiltrosAbertos(true)}
                    >
                        <i className="fa-solid fa-sliders" aria-hidden="true"></i>
                        {n > 0 && <span className="m-filter-badge">{n}</span>}
                    </button>
                </div>

                {n > 0 && (
                    <div className="m-active-filters">
                        {chips.map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                className="m-active-chip"
                                aria-label={`Remover filtro ${c.label}`}
                                onClick={() => onClearFilter(c.key)}
                            >
                                <span>{c.label}</span>
                                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {loading ? (
                <p className="m-tx-loading"><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Carregando…</p>
            ) : transactions.length === 0 ? (
                <p className="empty-list-msg">Nenhuma transação encontrada.</p>
            ) : (
                <>
                    {grupos.map((g) => (
                        <section key={g.key} className="m-tx-day">
                            {g.label && <h3 className="m-tx-day-head">{g.label}</h3>}
                            <div className="m-tx-list">
                                {g.items.map((t) => <TransactionRowMobile key={t.id} transacao={t} {...rowProps} />)}
                            </div>
                        </section>
                    ))}
                    {restantes > 0 && (
                        <button type="button" className="btn-secondary m-load-more" onClick={() => setVisiveis((v) => v + PAGINA)}>
                            Carregar mais ({restantes})
                        </button>
                    )}
                </>
            )}

            {filtrosAbertos && (
                <FiltersSheet
                    data={data}
                    filters={filters}
                    sortConfig={sortConfig}
                    onApply={onApplyFilters}
                    onClose={() => setFiltrosAbertos(false)}
                />
            )}
        </div>
    );
}
```

- [ ] **Step 4: CSS dos filtros**

Ao final de `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css`, adicionar:

```css
/* --- Botão de filtros + contador --- */
.financas-scope .m-filter-btn {
    position: relative;
    flex-shrink: 0;
    width: var(--tap-min);
    height: var(--tap-min);
    display: grid;
    place-items: center;
    border: none;
    border-radius: 12px;
    background: var(--cor-card-secundario);
    box-shadow: inset 0 0 0 1px var(--cor-borda);
    color: var(--cor-texto-principal);
    font-size: 1rem;
    cursor: pointer;
}

.financas-scope .m-filter-btn.active {
    color: var(--cor-azul-primario);
    box-shadow: inset 0 0 0 1px var(--cor-azul-primario);
}

.financas-scope .m-filter-badge {
    position: absolute;
    top: calc(-1 * var(--sp-1));
    right: calc(-1 * var(--sp-1));
    min-width: 18px;
    height: 18px;
    padding: 0 var(--sp-1);
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: var(--cor-azul-primario);
    color: #fff;
    font-size: 0.6875rem;
    font-weight: 700;
}

/* --- Chips dos filtros ativos --- */
.financas-scope .m-active-filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
}

.financas-scope .m-active-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--tap-min);
    padding: 0 var(--sp-3);
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--cor-azul-primario) 40%, var(--cor-borda));
    background: color-mix(in srgb, var(--cor-azul-primario) 12%, transparent);
    color: var(--cor-azul-primario);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
}

/* --- Sheet de filtros (3 classes: vence `.app-sheet > .app-sheet-body` do mobile.css) --- */
.financas-scope .m-filters .app-sheet-body {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    padding-top: var(--sp-2);
}

.financas-scope .m-filter-group {
    min-width: 0; /* fieldset tem min-width: min-content por padrão (causaria overflow) */
    margin: 0;
    padding: 0;
    border: none;
}

.financas-scope .m-filter-label {
    margin-bottom: var(--sp-2);
    padding: 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--cor-texto-secundario);
}

.financas-scope .m-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
}

.financas-scope .m-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--tap-min);
    max-width: 100%;
    padding: 0 var(--sp-3);
    border-radius: 999px;
    border: 1px solid var(--cor-borda);
    background: var(--cor-card-secundario);
    color: var(--cor-texto-principal);
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
}

.financas-scope .m-chip.active {
    border-color: var(--cor-azul-primario);
    background: color-mix(in srgb, var(--cor-azul-primario) 16%, transparent);
    color: var(--cor-azul-primario);
    font-weight: 600;
}

.financas-scope .m-filter-range {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-3);
    margin-top: var(--sp-3);
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs` → Expected: tudo passa (Tasks 1–4).
Run: `npm run e2e -- --project=desktop` → Expected: 19 passed (os dropdowns do desktop continuam usando os mesmos estados).
Run: `npm run build` → OK. Run: `npx eslint src/pages/Financas` → só o erro pré-existente.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src bussola_web/e2e
git commit -m "feat(web): sheet de filtros com contador e chips removiveis em Provisoes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Metas no celular (cofre, histórico, formulário)

**Files:**
- Create: `bussola_web/src/pages/Metas/chartFormat.js`
- Modify: `bussola_web/src/pages/Metas/components/MetaHistorico.jsx`, `bussola_web/src/pages/Metas/components/MetaForm.jsx`, `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css`, `bussola_web/e2e/provisoes.mobile.spec.mjs`

**Interfaces:**
- Consumes: `MetasTab` (Task 2), `Sheet`, `useIsMobile`.
- Produces: `tickDiaMes(label: 'dd/mm/aaaa'): 'dd/mm'`, `tickBRLCompacto(v): string` ("R$ 1,2 mil"). `MetaForm` abre ícone/cor em `Sheet.picker-sheet` (grid `.picker-sheet-grid`, 6 colunas, `button.icon-option[aria-label=<classe>]` / `button.color-swatch[aria-label=<cor>]`) no mobile. CSS de `.picker-sheet-grid` é reaproveitado na Task 6.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/provisoes.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 5 — Metas
// ---------------------------------------------------------------------------
test.describe('metas', () => {
  test.describe.configure({ mode: 'serial' });
  const META = 'E2E Viagem';

  test.beforeAll(async ({ playwright }) => {
    const r = await playwright.request.newContext();
    await apiJson(r, 'POST', '/financas/metas', { nome: META, valor_alvo: 1000, icone: 'fa-solid fa-piggy-bank', cor: '#4A6DFF' });
    await r.dispose();
  });

  test('aba Metas: cards em 1 coluna e explicação visível', async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrirAba(page, 'Metas');
    await expect(page.locator('.metas-explain')).toContainText('transferência');
    await expect(page.locator('.m-metas .metas-kpis-info')).toHaveCount(0);
    const card = page.locator('.m-metas .meta-card').filter({ hasText: META });
    await expect(card).toBeVisible();
    const painel = await page.locator('.m-metas').boundingBox();
    expect(Math.round((await card.boundingBox()).width)).toBe(Math.round(painel.width));
    expect(await smallTargets(page, '.m-metas')).toEqual([]);
  });

  test('Guardar → cena em tela cheia, pote ao lado do saldo, confirmar alcançável, histórico em scroll único', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 480 });
    await gotoApp(page, '/financas');
    await abrirAba(page, 'Metas');
    await page.locator('.m-metas .meta-card').filter({ hasText: META }).getByRole('button', { name: 'Guardar' }).click();

    const sheet = page.locator('.modal-overlay.is-sheet-full');
    await expect(sheet.locator('.cofre-body')).toBeVisible();
    const jar = await sheet.locator('.jar').boundingBox();
    const saldo = await sheet.locator('.cofre-progress-num').boundingBox();
    expect(jar.width).toBeLessThanOrEqual(100);
    expect(jar.x).toBeGreaterThanOrEqual(saldo.x + saldo.width - 1);           // ao lado
    expect(Math.abs((jar.y + jar.height / 2) - (saldo.y + saldo.height / 2))).toBeLessThan(60); // mesma linha
    for (const b of await sheet.locator('.cofre-chips button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await overflowOffenders(page)).toEqual([]);

    await sheet.getByRole('button', { name: '+50', exact: true }).click();
    const confirmar = sheet.getByRole('button', { name: /^Guardar R\$/ });
    await expect(confirmar).toBeInViewport();
    await confirmar.click();
    await expect(page.getByText('Guardado!')).toBeVisible();
    await expect(sheet.locator('.cofre-progress-num strong')).toContainText('50,00');

    await sheet.getByRole('button', { name: /Ver movimentações/ }).click();
    await expect(sheet.locator('h3')).toContainText('Movimentações');
    await expect(sheet.locator('.meta-timeline li')).toHaveCount(1);
    expect(await sheet.locator('.meta-timeline-scroll').evaluate((e) => getComputedStyle(e).maxHeight)).toBe('none');
    for (const b of await sheet.locator('.meta-timeline .btn-action-icon').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await smallTargets(page, '.modal-overlay.is-sheet-full .modal-header')).toEqual([]);

    await sheet.getByRole('button', { name: 'Voltar' }).click();
    await expect(sheet.locator('.cofre-body')).toBeVisible();
    await sheet.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.locator('.modal-overlay.is-sheet-full')).toHaveCount(0);
  });

  test('Nova meta pelo Fab: form em tela cheia, valor decimal, ícone em sheet de 6 colunas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 480 });
    await gotoApp(page, '/financas');
    await abrirAba(page, 'Metas');
    await page.getByRole('button', { name: 'Nova meta' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet-full').first();
    await expect(sheet.locator('h3')).toHaveText('Nova meta');
    await expect(sheet.locator('input[type="number"]').first()).toHaveAttribute('inputmode', 'decimal');
    await expect(sheet.getByRole('button', { name: 'Salvar meta' })).toBeInViewport();

    await sheet.locator('.picker-preview').first().click();
    const grid = page.locator('.picker-sheet .picker-sheet-grid');
    await expect(grid).toBeVisible();
    expect(await grid.evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length)).toBe(6);
    const opcao = grid.locator('.icon-option').nth(3);
    const icone = await opcao.getAttribute('aria-label');
    await opcao.click();
    await expect(page.locator('.picker-sheet')).toHaveCount(0);
    await expect(sheet.locator('.picker-preview i').first()).toHaveAttribute('class', icone);

    await sheet.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.modal-overlay.is-sheet-full')).toHaveCount(0);
  });

  test('eixos do gráfico do histórico: dd/mm e BRL compacto', async ({ page }) => {
    await gotoApp(page, '/financas');
    const r = await page.evaluate(async () => {
      const m = await import('/src/pages/Metas/chartFormat.js');
      return [m.tickDiaMes('05/09/2026'), m.tickBRLCompacto(1234), m.tickBRLCompacto(15000), m.tickBRLCompacto('500')];
    });
    expect(r[0]).toBe('05/09');
    expect(r[1]).toMatch(/^R\$\s1,2\smil$/);
    expect(r[2]).toMatch(/^R\$\s15\smil$/);
    expect(r[3]).toMatch(/^R\$\s500$/);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs -g "metas"`
Expected: FAIL — pote de 158px abaixo do saldo, chips de ~28px, `max-height: 320px`, sem `inputmode`, picker em popover e `chartFormat.js` 404. (O 1º teste pode já passar; tudo bem.)

- [ ] **Step 2: Formatadores do gráfico**

Criar `bussola_web/src/pages/Metas/chartFormat.js`:

```js
// Rótulos curtos dos eixos do gráfico do histórico (celular).
const compacto = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
});

/** "05/09/2026" → "05/09" */
export const tickDiaMes = (label) => String(label).slice(0, 5);

/** 1234 → "R$ 1,2 mil" */
export const tickBRLCompacto = (v) => compacto.format(Number(v) || 0);
```

- [ ] **Step 3: `MetaHistorico` com eixos curtos no mobile**

Em `bussola_web/src/pages/Metas/components/MetaHistorico.jsx`:

1. Trocar `import { MovimentacaoEditForm } from './MovimentacaoEditForm';` por:

```js
import { MovimentacaoEditForm } from './MovimentacaoEditForm';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { tickDiaMes, tickBRLCompacto } from '../chartFormat';
```

2. Trocar `  const { addToast } = useToast();` por:

```js
  const { addToast } = useToast();
  const isMobile = useIsMobile();
```

3. Trocar o bloco:

```jsx
              scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
                y: { grid: { color: 'rgba(128,128,128,.12)' }, ticks: { maxTicksLimit: 4 } },
              },
```

por:

```jsx
              scales: {
                x: {
                  grid: { display: false },
                  ticks: isMobile
                    ? { maxRotation: 0, autoSkip: true, maxTicksLimit: 4, callback(value) { return tickDiaMes(this.getLabelForValue(value)); } }
                    : { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
                },
                y: {
                  grid: { color: 'rgba(128,128,128,.12)' },
                  ticks: isMobile ? { maxTicksLimit: 4, callback: (v) => tickBRLCompacto(v) } : { maxTicksLimit: 4 },
                },
              },
```

- [ ] **Step 4: `MetaForm` com `inputMode` e pickers em sheet no mobile**

Em `bussola_web/src/pages/Metas/components/MetaForm.jsx`:

1. Trocar `import { DatePicker } from '../../../components/Pickers';` por:

```js
import { DatePicker } from '../../../components/Pickers';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { Sheet } from '../../../components/mobile/Sheet';
```

2. Trocar o bloco:

```js
  const { addToast } = useToast();

  useEffect(() => {
    const handler = (e) => {
      if (iconRef.current && !iconRef.current.contains(e.target)) setShowIconPicker(false);
      if (colorRef.current && !colorRef.current.contains(e.target)) setShowColorPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
```

por:

```js
  const { addToast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = (e) => {
      // No celular o picker é um sheet: o "clique fora" fecharia antes do toque selecionar.
      if (isMobile) return;
      if (iconRef.current && !iconRef.current.contains(e.target)) setShowIconPicker(false);
      if (colorRef.current && !colorRef.current.contains(e.target)) setShowColorPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMobile]);
```

3. Trocar `<input className="form-input" type="number" step="0.01" min="0.01" value={form.valor_alvo}` por `<input className="form-input" type="number" step="0.01" min="0.01" inputMode="decimal" value={form.valor_alvo}`.

4. Trocar `<input className="form-input" type="number" step="0.01" min="0" value={form.aporte_mensal_valor}` por `<input className="form-input" type="number" step="0.01" min="0" inputMode="decimal" value={form.aporte_mensal_valor}`.

5. Trocar `<input className="form-input" type="number" min="1" max="28" value={form.aporte_mensal_dia}` por `<input className="form-input" type="number" min="1" max="28" inputMode="numeric" value={form.aporte_mensal_dia}`.

6. Trocar o bloco do popover de ícone:

```jsx
              {showIconPicker && (
                <div className="picker-popover icon-grid visible">
                  {iconesDisponiveis.map((icon) => (
                    <div key={icon} className="icon-option" onClick={() => { set({ icone: icon }); setShowIconPicker(false); }}>
                      <i className={icon}></i>
                    </div>
                  ))}
                </div>
              )}
```

por:

```jsx
              {showIconPicker && !isMobile && (
                <div className="picker-popover icon-grid visible">
                  {iconesDisponiveis.map((icon) => (
                    <div key={icon} className="icon-option" onClick={() => { set({ icone: icon }); setShowIconPicker(false); }}>
                      <i className={icon}></i>
                    </div>
                  ))}
                </div>
              )}
              {isMobile && (
                <Sheet open={showIconPicker} onClose={() => setShowIconPicker(false)} title="Ícone" className="picker-sheet">
                  <div className="picker-sheet-grid">
                    {iconesDisponiveis.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        aria-label={icon}
                        className={`icon-option ${form.icone === icon ? 'selected' : ''}`}
                        onClick={() => { set({ icone: icon }); setShowIconPicker(false); }}
                      >
                        <i className={icon} style={{ color: form.cor }}></i>
                      </button>
                    ))}
                  </div>
                </Sheet>
              )}
```

7. Trocar o bloco do popover de cor:

```jsx
              {showColorPicker && (
                <div className="picker-popover color-grid visible">
                  {coresDisponiveis.map((cor) => (
                    <div key={cor} className="color-swatch" style={{ backgroundColor: cor }} onClick={() => { set({ cor }); setShowColorPicker(false); }}></div>
                  ))}
                </div>
              )}
```

por:

```jsx
              {showColorPicker && !isMobile && (
                <div className="picker-popover color-grid visible">
                  {coresDisponiveis.map((cor) => (
                    <div key={cor} className="color-swatch" style={{ backgroundColor: cor }} onClick={() => { set({ cor }); setShowColorPicker(false); }}></div>
                  ))}
                </div>
              )}
              {isMobile && (
                <Sheet open={showColorPicker} onClose={() => setShowColorPicker(false)} title="Cor" className="picker-sheet">
                  <div className="picker-sheet-grid">
                    {coresDisponiveis.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        aria-label={cor}
                        className={`color-swatch ${form.cor === cor ? 'selected' : ''}`}
                        style={{ backgroundColor: cor }}
                        onClick={() => { set({ cor }); setShowColorPicker(false); }}
                      ></button>
                    ))}
                  </div>
                </Sheet>
              )}
```

- [ ] **Step 5: CSS de Metas no celular**

Ao final de `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css`, adicionar:

```css
/* ===== Seletor de ícone/cor em sheet (MetaForm e form de categoria) ===== */
.financas-scope .picker-sheet .picker-sheet-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--sp-2);
    padding-top: var(--sp-1);
}

.financas-scope .picker-sheet-grid > .icon-option,
.financas-scope .picker-sheet-grid > .color-swatch {
    width: auto;
    height: auto;
    min-height: var(--tap-min);
    aspect-ratio: 1 / 1;
    padding: 0;
    border-radius: 12px;
    font: inherit;
    font-size: 1.15rem;
    cursor: pointer;
}

.financas-scope .picker-sheet-grid > .icon-option {
    border: 1px solid var(--cor-borda);
    background: var(--cor-card-secundario);
    color: var(--cor-texto-principal);
}

.financas-scope .picker-sheet-grid > .selected {
    border-color: var(--cor-azul-primario);
    box-shadow: 0 0 0 2px rgba(var(--cor-tema-rgb), 0.35);
}

/* ===== Metas no sheet de tela cheia (≤768) ===== */
@media (max-width: 768px) {
    /* Cabeçalho: voltar e fechar com 44px, título com reticências */
    .financas-scope .metas-back-btn {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        margin-right: var(--sp-2);
    }

    .financas-scope .metas-modal-header h3 {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 1.05rem;
    }

    .financas-scope .metas-modal-header .close-btn {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    /* Cena do cofre: saldo e pote pequeno lado a lado; controles abaixo; confirmar fixo */
    .financas-scope .metas-scope .modal-body.cofre-body {
        padding: var(--sp-4);
    }

    .financas-scope .metas-scope .cofre-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        column-gap: var(--sp-4);
        row-gap: var(--sp-3);
        align-items: center;
        padding: 0;
    }

    .financas-scope .metas-scope .cofre-controls {
        display: contents;
    }

    .financas-scope .metas-scope .cofre-progress-num {
        grid-column: 1;
        grid-row: 1;
    }

    .financas-scope .metas-scope .cofre-jar-side {
        grid-column: 2;
        grid-row: 1;
        gap: var(--sp-1);
    }

    .financas-scope .metas-scope .cofre-controls > *:not(.cofre-progress-num) {
        grid-column: 1 / -1;
    }

    .financas-scope .metas-scope .jar {
        width: 88px;
        height: 132px;
        border-radius: 14px 14px 26px 26px;
    }

    .financas-scope .metas-scope .cofre-drag-hint {
        font-size: 0.75rem;
    }

    .financas-scope .metas-scope .mov-toggle button {
        min-height: var(--tap-min);
    }

    .financas-scope .metas-scope input.cofre-amount {
        font-size: 1.25rem !important; /* valor em destaque (≥16px: sem zoom no iOS) */
    }

    .financas-scope .metas-scope .cofre-chips {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--sp-2);
    }

    .financas-scope .metas-scope .cofre-chips button {
        min-height: var(--tap-min);
        font-size: 0.875rem;
    }

    .financas-scope .metas-scope .cofre-action {
        position: sticky;
        bottom: 0;
        z-index: 2;
        min-height: 48px;
        box-shadow: 0 calc(-1 * var(--sp-3)) var(--sp-4) var(--cor-card-principal);
    }

    .financas-scope .metas-scope .cofre-action.is-retirar {
        background: var(--cor-card-principal) !important;
    }

    .financas-scope .metas-scope .cofre-hist-btn {
        min-height: var(--tap-min);
    }

    /* Histórico: um único scroll (o do sheet), linhas com respiro e ações abaixo */
    .financas-scope .metas-scope .meta-historico {
        gap: var(--sp-4);
    }

    .financas-scope .metas-scope .meta-chart {
        height: 160px;
    }

    .financas-scope .metas-scope .meta-timeline-scroll {
        max-height: none;
        overflow: visible;
        padding-right: 0;
    }

    .financas-scope .metas-scope .meta-timeline {
        gap: var(--sp-2);
    }

    .financas-scope .metas-scope .meta-timeline li {
        flex-wrap: wrap;
        row-gap: var(--sp-2);
        padding: var(--sp-3);
        font-size: 0.875rem;
    }

    .financas-scope .metas-scope .meta-timeline .mov-info {
        flex: 1 1 0;
    }

    .financas-scope .metas-scope .meta-timeline .mov-actions {
        flex-basis: 100%;
        justify-content: flex-end;
        gap: var(--sp-2);
    }

    .financas-scope .metas-scope .meta-timeline li.mov-editing {
        display: block;
    }

    /* MetaCard: só tamanho de texto */
    .financas-scope .metas-scope .meta-progress-labels {
        font-size: 0.875rem;
    }

    .financas-scope .metas-scope .meta-proj,
    .financas-scope .metas-scope .meta-mensal {
        font-size: 0.8125rem;
    }
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs` → Expected: tudo passa (Tasks 1–5). Confira no fim que o `afterAll` limpou: `npm run e2e -- --project=desktop` → 19 passed (sem linha "Aporte · E2E Viagem" no `financas.png`).
Run: `npm run build` → OK. Run: `npx eslint src/pages/Metas` → sem erros novos.

- [ ] **Step 7: Commit**

```bash
git add bussola_web/src bussola_web/e2e
git commit -m "feat(web): cofre, historico e form de Metas ajustados ao celular" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Categorias, Caixa e modais da página no celular

**Files:**
- Modify: `bussola_web/src/pages/Financas/components/FinancasModals.jsx`, `bussola_web/src/pages/Financas/styles.css`, `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css`, `bussola_web/e2e/provisoes.mobile.spec.mjs`, `bussola_web/e2e/provisoes.desktop.spec.mjs`

**Interfaces:**
- Consumes: `.picker-sheet-grid` (Task 5), `Sheet`, `useIsMobile`.
- Produces: form de categoria com ícone/cor em `Sheet.picker-sheet` no mobile; `.financas-scope .modal-content { overflow: visible !important }` e `.financas-scope .modal-body { overflow: visible }` passam a valer **só ≥769px**.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/provisoes.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 6 — Categorias, Caixa e modais
// ---------------------------------------------------------------------------
test.describe('categorias e caixa', () => {
  test('alternância Despesas/Receitas troca a lista', async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrirAba(page, 'Categorias');
    await expect(page.getByRole('tab', { name: 'Despesas' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.catcard', { hasText: 'Alimentação' })).toBeVisible();
    await page.getByRole('tab', { name: 'Receitas' }).click();
    await expect(page.locator('.catcard', { hasText: 'Salário' }).first()).toBeVisible();
    await expect(page.locator('.catcard', { hasText: 'Alimentação' })).toHaveCount(0);
  });

  test('categoria: Fab → form com ícone em sheet de 6 colunas; cria e exclui', async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrirAba(page, 'Categorias');
    await page.getByRole('button', { name: 'Nova categoria' }).click();
    const form = page.locator('.modal-overlay.is-sheet').first();
    await expect(form.locator('h3')).toHaveText('Nova Categoria');
    await expect(form.locator('input[name="meta_limite"]')).toHaveAttribute('inputmode', 'decimal');
    await form.locator('input[name="nome"]').fill('E2E Categoria');

    await form.locator('.picker-preview').first().click();
    const grid = page.locator('.picker-sheet .picker-sheet-grid');
    await expect(grid).toBeVisible();
    expect(await grid.evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length)).toBe(6);
    expect(await overflowOffenders(page)).toEqual([]);
    const opcao = grid.locator('.icon-option').nth(4);
    const icone = await opcao.getAttribute('aria-label');
    await opcao.click();
    await expect(page.locator('.picker-sheet')).toHaveCount(0);
    await expect(form.locator('.picker-preview i').first()).toHaveAttribute('class', icone);

    await form.locator('.picker-preview').nth(1).click();
    await page.locator('.picker-sheet .color-swatch').nth(2).click();
    await expect(page.locator('.picker-sheet')).toHaveCount(0);

    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Salvo com sucesso.')).toBeVisible();
    const card = page.locator('.catcard', { hasText: 'E2E Categoria' });
    await expect(card).toBeVisible();
    await card.locator('.btn-delete-transacao').click();
    await page.getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(card).toHaveCount(0);
  });

  test('form de categoria: Salvar visível com teclado e fechar com 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 480 });
    await gotoApp(page, '/financas');
    await abrirAba(page, 'Categorias');
    await page.getByRole('button', { name: 'Nova categoria' }).click();
    const form = page.locator('.modal-overlay.is-sheet').first();
    await expect(form.getByRole('button', { name: 'Salvar' })).toBeInViewport();
    const fechar = await form.locator('.close-btn').boundingBox();
    expect(fechar.width).toBeGreaterThanOrEqual(44);
    expect(fechar.height).toBeGreaterThanOrEqual(44);
    expect(await form.locator('.modal-content').evaluate((e) => getComputedStyle(e).overflow)).toBe('hidden');
    expect(await form.locator('.modal-body').evaluate((e) => getComputedStyle(e).overflowY)).toBe('auto');
  });

  test('cards de categoria: textos secundários ≥ 12px', async ({ page }) => {
    await gotoApp(page, '/financas');
    await abrirAba(page, 'Categorias');
    const tamanhos = await page.locator('.catcard-progress-label, .catcard-nometa, .catcard-progress-pct').evaluateAll(
      (els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
    expect(tamanhos.length).toBeGreaterThan(0);
    for (const s of tamanhos) expect(s).toBeGreaterThanOrEqual(12);
  });

  test('Caixa: ajuste em sheet, linha sem sobreposição em 360px, e exclusão', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoApp(page, '/financas');
    await page.locator('.m-kpi', { hasText: 'Caixa' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet').first();
    await sheet.getByRole('button', { name: 'Novo ajuste' }).click();
    await sheet.locator('.caixa-form input[type="number"]').fill('10');
    await sheet.locator('.caixa-form input:not([type="number"])').last().fill('E2E ajuste');
    await sheet.locator('.caixa-form').getByRole('button', { name: 'Salvar' }).click();
    const item = sheet.locator('.caixa-item', { hasText: 'E2E ajuste' });
    await expect(item).toBeVisible();
    expect(await overflowOffenders(page)).toEqual([]);
    expect(await smallTargets(page, '.modal-overlay.is-sheet .caixa-item')).toEqual([]);
    const valor = await item.locator('.caixa-item-valor').boundingBox();
    const acoes = await item.locator('.caixa-item-actions').boundingBox();
    expect(acoes.y).toBeGreaterThanOrEqual(valor.y + valor.height - 1); // ações numa linha própria
    await item.locator('.btn-delete').click();
    await page.getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(item).toHaveCount(0);
  });
});
```

Ao final de `bussola_web/e2e/provisoes.desktop.spec.mjs`, adicionar:

```js
test('desktop provisões: modal de transação mantém overflow visível (popovers não cortam)', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.getByRole('button', { name: 'Adicionar' }).first().click();
  await page.locator('.dropdown-menu a', { hasText: 'Pontual' }).click();
  expect(await page.locator('.modal-content').evaluate((e) => getComputedStyle(e).overflow)).toBe('visible');
});
```

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs -g "categorias e caixa"`
Expected: FAIL — picker em popover (sem `.picker-sheet`), fechar de ~24px, textos de 11,5px, ações do caixa na mesma linha.
Run: `npm run e2e -- --project=desktop e2e/provisoes.desktop.spec.mjs` → Expected: passa (garante que o comportamento do desktop já é este antes da mudança).

- [ ] **Step 2: Pickers de ícone/cor em sheet no form de categoria**

Em `bussola_web/src/pages/Financas/components/FinancasModals.jsx`:

1. Trocar `import { DatePicker } from '../../../components/Pickers';` por:

```js
import { DatePicker } from '../../../components/Pickers';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { Sheet } from '../../../components/mobile/Sheet';
```

2. Trocar `    const [showColorPicker, setShowColorPicker] = useState(false);` por:

```js
    const [showColorPicker, setShowColorPicker] = useState(false);
    const isMobile = useIsMobile();
```

3. Trocar o efeito de clique fora:

```js
    useEffect(() => {
        function handleClickOutside(event) {
            if (showIconPicker && iconWrapperRef.current && !iconWrapperRef.current.contains(event.target)) {
                setShowIconPicker(false);
            }
            if (showColorPicker && colorWrapperRef.current && !colorWrapperRef.current.contains(event.target)) {
                setShowColorPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showIconPicker, showColorPicker]);
```

por:

```js
    useEffect(() => {
        function handleClickOutside(event) {
            // No celular o picker é um sheet: o "clique fora" fecharia antes do toque selecionar.
            if (isMobile) return;
            if (showIconPicker && iconWrapperRef.current && !iconWrapperRef.current.contains(event.target)) {
                setShowIconPicker(false);
            }
            if (showColorPicker && colorWrapperRef.current && !colorWrapperRef.current.contains(event.target)) {
                setShowColorPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showIconPicker, showColorPicker, isMobile]);
```

4. Trocar o popover de ícone:

```jsx
                                            {showIconPicker && (
                                                <div className="picker-popover icon-grid visible">
                                                    {safeIcones.map(icon => (
                                                        <div key={icon} className="icon-option" onClick={() => { setFormData(prev => ({...prev, icone: icon})); setShowIconPicker(false); }}><i className={icon}></i></div>
                                                    ))}
                                                </div>
                                            )}
```

por:

```jsx
                                            {showIconPicker && !isMobile && (
                                                <div className="picker-popover icon-grid visible">
                                                    {safeIcones.map(icon => (
                                                        <div key={icon} className="icon-option" onClick={() => { setFormData(prev => ({...prev, icone: icon})); setShowIconPicker(false); }}><i className={icon}></i></div>
                                                    ))}
                                                </div>
                                            )}
                                            {isMobile && (
                                                <Sheet open={showIconPicker} onClose={() => setShowIconPicker(false)} title="Ícone" className="picker-sheet">
                                                    <div className="picker-sheet-grid">
                                                        {safeIcones.map(icon => (
                                                            <button
                                                                key={icon}
                                                                type="button"
                                                                aria-label={icon}
                                                                className={`icon-option ${formData.icone === icon ? 'selected' : ''}`}
                                                                onClick={() => { setFormData(prev => ({ ...prev, icone: icon })); setShowIconPicker(false); }}
                                                            >
                                                                <i className={icon} style={{ color: formData.cor }}></i>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </Sheet>
                                            )}
```

5. Trocar o popover de cor:

```jsx
                                            {showColorPicker && (
                                                <div className="picker-popover color-grid visible">
                                                    {safeCores.map(cor => (
                                                        <div key={cor} className="color-swatch" style={{backgroundColor: cor}} onClick={() => { setFormData(prev => ({...prev, cor: cor})); setShowColorPicker(false); }}></div>
                                                    ))}
                                                </div>
                                            )}
```

por:

```jsx
                                            {showColorPicker && !isMobile && (
                                                <div className="picker-popover color-grid visible">
                                                    {safeCores.map(cor => (
                                                        <div key={cor} className="color-swatch" style={{backgroundColor: cor}} onClick={() => { setFormData(prev => ({...prev, cor: cor})); setShowColorPicker(false); }}></div>
                                                    ))}
                                                </div>
                                            )}
                                            {isMobile && (
                                                <Sheet open={showColorPicker} onClose={() => setShowColorPicker(false)} title="Cor" className="picker-sheet">
                                                    <div className="picker-sheet-grid">
                                                        {safeCores.map(cor => (
                                                            <button
                                                                key={cor}
                                                                type="button"
                                                                aria-label={cor}
                                                                className={`color-swatch ${formData.cor === cor ? 'selected' : ''}`}
                                                                style={{ backgroundColor: cor }}
                                                                onClick={() => { setFormData(prev => ({ ...prev, cor })); setShowColorPicker(false); }}
                                                            ></button>
                                                        ))}
                                                    </div>
                                                </Sheet>
                                            )}
```

(`useIsMobile()` fica antes do `if (!activeModal) return null;`: a ordem dos hooks não muda entre renders.)

- [ ] **Step 3: `overflow: visible` dos modais só no desktop/tablet**

Em `bussola_web/src/pages/Financas/styles.css`:

1. Trocar:

```css
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    overflow: visible !important;
}
```

por:

```css
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

2. Trocar:

```css
.financas-scope .modal-body {
    padding: 1.5rem;
    overflow: visible;
    display: flex;
```

por:

```css
.financas-scope .modal-body {
    padding: 1.5rem;
    display: flex;
```

3. Logo depois do bloco `.financas-scope .modal-body { … }` (o que termina em `gap: 1.2rem;\n}`), inserir:

```css
/* Desktop/tablet: o modal não corta os popovers de DatePicker/CustomSelect/ícone.
   No celular eles abrem em sheet próprio, então o sheet volta a rolar normalmente. */
@media (min-width: 769px) {
    .financas-scope .modal-content {
        overflow: visible !important;
    }

    .financas-scope .modal-body {
        overflow: visible;
    }
}
```

- [ ] **Step 4: CSS de Caixa, cabeçalho dos sheets e textos dos cards**

Ao final de `bussola_web/src/pages/Financas/mobile/provisoes-mobile.css`, adicionar:

```css
/* ===== Modais da página em sheet (≤768) ===== */
@media (max-width: 768px) {
    .financas-scope .modal-overlay.is-sheet .modal-header {
        padding: var(--sp-3) var(--sp-4);
    }

    .financas-scope .modal-overlay.is-sheet .close-btn {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: calc(-1 * var(--sp-2)) calc(-1 * var(--sp-2)) calc(-1 * var(--sp-2)) 0;
    }

    /* Caixa: valor à direita do título; editar/excluir numa linha própria */
    .financas-scope .caixa-hint {
        font-size: 0.875rem;
        margin-bottom: var(--sp-3);
    }

    .financas-scope .caixa-topbar {
        gap: var(--sp-3);
        padding: var(--sp-3);
        margin-bottom: var(--sp-4);
    }

    .financas-scope .caixa-topbar .btn-primary,
    .financas-scope .caixa-form-actions > button {
        min-height: var(--tap-min);
    }

    .financas-scope .caixa-form-actions > button {
        flex: 1;
    }

    .financas-scope .caixa-list {
        gap: var(--sp-2);
    }

    .financas-scope .caixa-item {
        flex-wrap: wrap;
        gap: var(--sp-2) var(--sp-3);
        padding: var(--sp-3);
    }

    .financas-scope .caixa-item-info {
        flex: 1 1 0;
    }

    .financas-scope .caixa-item-title {
        font-size: 0.9375rem;
    }

    .financas-scope .caixa-item-sub {
        font-size: 0.8125rem;
    }

    .financas-scope .caixa-item-actions {
        flex-basis: 100%;
        justify-content: flex-end;
        gap: var(--sp-2);
    }

    /* CategoryCard: só tamanho de texto (o card não muda) */
    .financas-scope .catcard-progress-label,
    .financas-scope .catcard-progress-pct,
    .financas-scope .catcard-nometa {
        font-size: 0.75rem;
    }

    .financas-scope .catcard-chip,
    .financas-scope .catcard-stat-label {
        font-size: 0.6875rem;
    }
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/provisoes.mobile.spec.mjs` → Expected: tudo passa (Tasks 1–6).
Run: `npm run e2e -- --project=mobile e2e/pickers.mobile.spec.mjs e2e/ui-lab.mobile.spec.mjs` → Expected: passam (o sheet dos pickers continua igual).
Run: `npm run e2e -- --project=desktop` → Expected: 20 passed (13 + 7), incluindo `modal-transacao.png`, `categoria-form.png` e o teste de `overflow: visible`.
Run: `npm run build` → OK. Run: `npx eslint src/pages/Financas` → só o erro pré-existente (o `set-state-in-effect` do primeiro efeito de `FinancasModals.jsx`).

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src bussola_web/e2e
git commit -m "feat(web): seletor de icone/cor em sheet, Caixa e cards legiveis no celular" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tablet (769–1024), ações sem hover e verificação final

**Files:**
- Create: `bussola_web/e2e/provisoes.tablet.spec.mjs`
- Modify: `bussola_web/src/pages/Financas/styles.css`

**Interfaces:**
- Consumes: `smallTargets`, `overflowOffenders`.
- Produces: no tablet, grid `minmax(0,1fr) 320px` a 100% de largura, tabela compacta (sem as colunas Categoria/Tag), cabeçalho que quebra linha; com toque (`hover: none` ou `pointer: coarse`) as ações da linha ficam sempre visíveis numa linha própria; com mouse (`hover: hover` e `pointer: fine`) o overlay no hover continua igual.

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/provisoes.tablet.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';

for (const w of [900, 1024]) {
  test(`tablet ${w}px: 2 colunas (direita 320px) sem overflow`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/financas');
    expect(await overflowOffenders(page)).toEqual([]);
    const cols = await page.locator('.layout-grid-custom').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' '));
    expect(cols).toHaveLength(2);
    expect(Math.round(parseFloat(cols[1]))).toBe(320);
    await expect(page.locator('.metas-entry')).toHaveCount(2);
    await expect(page.locator('.m-prov')).toHaveCount(0);
  });
}

test('tablet: ações da linha visíveis sem hover, com 44px e abaixo do valor', async ({ page }) => {
  await gotoApp(page, '/financas');
  const row = page.locator('.transacao-row').first();
  const actions = row.locator('.row-actions');
  expect(await actions.evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  const editar = actions.locator('.btn-edit-transacao');
  await expect(editar).toBeVisible();
  const b = await editar.boundingBox();
  expect(b.height).toBeGreaterThanOrEqual(44);
  const valor = await row.locator('.row-valor').boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(valor.y + valor.height - 1);
});

test('tablet: título da linha não some (largura útil) e cabeçalho alinhado', async ({ page }) => {
  await gotoApp(page, '/financas');
  const row = page.locator('.transacao-row').first();
  expect((await row.locator('.row-descricao').boundingBox()).width).toBeGreaterThan(100);
  const headerValor = await page.locator('.table-header span').nth(5).boundingBox();
  const rowValor = await row.locator('.row-valor-cell').boundingBox();
  expect(Math.abs((headerValor.x + headerValor.width) - (rowValor.x + rowValor.width))).toBeLessThan(4);
});

test('tablet: controles da página com 44px', async ({ page }) => {
  await gotoApp(page, '/financas');
  expect(await smallTargets(page, '.financas-scope .layout-grid-custom')).toEqual([]);
  expect(await smallTargets(page, '.financas-scope .page-header')).toEqual([]);
});
```

Run: `npm run e2e -- --project=tablet e2e/provisoes.tablet.spec.mjs`
Expected: FAIL — coluna direita de 480px e tabela de ~770px (overflow), ações com `opacity: 0`, filtros/paginação/Caixa com 30px.

- [ ] **Step 2: Gate de hover nas ações da linha**

Em `bussola_web/src/pages/Financas/styles.css`, substituir o trecho que começa no comentário `/* Ações da linha — sobrepostas à ponta direita da própria linha, no hover.` e vai até a linha imediatamente antes de `/* Botão de expansão de parcelas (dentro do row-actions-inner) */` (inclui o antigo `@media (max-width: 768px)` de `.row-actions`) por:

```css
/* Ações da linha. Com mouse: sobrepostas à ponta direita da própria linha, no hover
   (nada se desloca, sem elemento flutuante fora da linha). Com toque (tablet): sempre
   visíveis, numa linha própria abaixo das células. O celular (≤768) usa outra lista. */
.financas-scope .transacao-row {
    position: relative;
}

.financas-scope .row-actions {
    display: flex;
    align-items: center;
}

@media (hover: hover) and (pointer: fine) {
    .financas-scope .row-actions {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        padding-left: 56px; /* área do degradê, antes dos botões */
        /* Mesmas camadas do fundo da linha em hover (tinta de hover sobre o fundo da página),
           esmaecendo para a esquerda para não cortar o texto de forma seca. */
        background:
            linear-gradient(to right, transparent, var(--cor-fundo-hover) 56px),
            linear-gradient(to right, transparent, var(--cor-fundo) 56px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease;
    }

    /* Grupo expandido tem uma camada de tinta a mais no fundo */
    .financas-scope .row-wrapper-expanded .row-actions {
        background:
            linear-gradient(to right, transparent, var(--cor-fundo-hover) 56px),
            linear-gradient(to right, transparent, var(--cor-fundo-hover) 56px),
            linear-gradient(to right, transparent, var(--cor-fundo) 56px);
    }

    .financas-scope .transacao-row:hover .row-actions,
    /* Só foco de teclado: depois de um clique de mouse o botão fica focado,
       e :focus-within deixava as ações presas na tela. */
    .financas-scope .transacao-row:has(:focus-visible) .row-actions {
        opacity: 1;
        pointer-events: auto;
    }
}

.financas-scope .row-actions-inner {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-right: 14px;
    white-space: nowrap;
}

/* Toque sem mouse (tablet): ações sempre visíveis, numa linha própria. */
@media (hover: none), (pointer: coarse) {
    .financas-scope .transacao-row {
        flex-wrap: wrap;
    }

    .financas-scope .row-actions {
        width: 100%;
        justify-content: flex-end;
        padding-bottom: var(--sp-2);
    }

    .financas-scope .row-actions-inner {
        gap: var(--sp-2);
    }
}

```

- [ ] **Step 3: Responsividade (formulários no celular, tablet e toque)**

Em `bussola_web/src/pages/Financas/styles.css`, substituir tudo do cabeçalho

```css
/* ============================================= */
/* 8. RESPONSIVIDADE (SCOPED)                    */
/* ============================================= */
```

até o fim do arquivo (os dois `@media (max-width: 768px)` antigos: tabela, layout e formulários; a tabela e o grid não renderizam mais no celular) por:

```css
/* ============================================= */
/* 8. RESPONSIVIDADE (SCOPED)                    */
/* ============================================= */

/* Celular (≤768): a página usa o layout de abas (mobile/). Aqui ficam só os
   formulários dos modais, que viram sheet. */
@media (max-width: 768px) {
    .financas-scope .form-row,
    .financas-scope .grid-65-35,
    .financas-scope .grid-50-50,
    .financas-scope .grid-33,
    .financas-scope .grid-60-40 {
        grid-template-columns: 1fr;
    }

    .financas-scope .grid-meta-icon-color {
        grid-template-columns: 1fr auto auto;
    }
}

/* Tablet (769–1024): mantém 2 colunas, coluna direita de 320px, tabela compacta
   (sem Categoria e Tag) e cabeçalho que quebra linha. */
@media (min-width: 769px) and (max-width: 1024px) {
    .financas-scope .page-header {
        max-width: 100%;
    }

    .financas-scope .layout-grid-custom {
        grid-template-columns: minmax(0, 1fr) 320px;
        max-width: 100%;
    }

    .financas-scope .header-actions-group {
        flex-wrap: wrap;
        justify-content: flex-end;
    }

    .financas-scope .table-header,
    .financas-scope .row-cells {
        grid-template-columns: 28px minmax(0, 1fr) 80px auto;
        gap: var(--sp-3);
    }

    .financas-scope .table-header span:nth-child(3),
    .financas-scope .table-header span:nth-child(5),
    .financas-scope .row-cells .row-categoria-nome,
    .financas-scope .row-cells .row-tags {
        display: none;
    }

    .financas-scope .metas-cat-row {
        width: auto;
        align-self: stretch;
        margin: 0.25rem 0 1.25rem var(--sp-4);
    }
}

/* Toque (tablet): alvos de 44px nos controles da página. */
@media (pointer: coarse) {
    .financas-scope .filter-trigger-btn,
    .financas-scope .filter-categoria-cs .custom-select-trigger,
    .financas-scope .column-header-flex .btn-primary,
    .financas-scope .page-header .ph-kpi-btn { /* só o do desktop/tablet: o chip Caixa do celular tem 52px */
        min-height: var(--tap-min);
        height: var(--tap-min);
    }

    .financas-scope .btn-page {
        width: var(--tap-min);
        height: var(--tap-min);
    }

    .financas-scope .row-actions .btn-sm-pagar,
    .financas-scope .row-actions .btn-sm-desmarcar {
        min-height: var(--tap-min);
        padding: 0 var(--sp-3);
    }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=tablet` → Expected: `provisoes.tablet.spec.mjs` (5) e `shell.tablet.spec.mjs` (1) passam. Se `overflowOffenders` listar algo do `AiAssistant` ou de dropdown fechado, corrija o CSS do elemento listado (sem esconder com `overflow: hidden`).
Run: `npm run e2e -- --project=desktop` → Expected: 20 passed, incluindo "ações da linha só aparecem no hover" e `financas.png` idêntico.
Run: `npm run e2e -- --project=mobile` → Expected: tudo passa.

- [ ] **Step 5: Suíte completa, build e lint**

Run: `npm run e2e` → Expected: tudo passa nos 3 projetos.
Run: `npm run build` → Expected: OK.
Run: `npm run lint 2>&1 | Select-String " error " | Measure-Object` → Expected: contagem ≤ à de antes do plano (registre os dois números na mensagem do commit).
Run: `npm run e2e -- --project=desktop` mais uma vez, depois do `afterAll` do mobile → Expected: 20 passed (prova que os dados `E2E ` foram limpos).

- [ ] **Step 6: Conferência visual (360, 390, 430 e 900px)**

No DevTools, abra `/financas` em cada largura e confira contra o mockup aprovado (tela 2, opção "Abas"):
- topbar "Provisões"; KPIs na ordem Disponível · Receitas · Despesas · (Guardado) · Caixa, rolando de borda a borda;
- 16px de gutter e entre blocos; 8px entre busca e chips; 24px entre grupos de dia; 12px entre cards de Metas/Categorias; 8px dentro da linha (título ↔ categoria);
- nenhum texto principal abaixo de 14px; selos e tags dos cards iguais aos do desktop;
- cofre: pote pequeno ao lado do saldo, chips de 44px, "Guardar R$ …" fixo no rodapé com o teclado aberto;
- 900px: duas colunas, ações da linha visíveis numa linha abaixo das células.

- [ ] **Step 7: Commit**

```bash
git add bussola_web/src bussola_web/e2e
git commit -m "feat(web): Provisoes no tablet (2 colunas, acoes visiveis sem hover) e verificacao final" -m "lint: <antes> -> <depois> erros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Decisões e suposições registradas neste plano

- **Cabeçalho por dia só com ordenação por data.** Ordenando por valor/título/categoria a lista fica corrida (grupos de dia fragmentados não fazem sentido).
- **Chip "Efetivar" só onde o desktop permite efetivar** (parcelada/recorrente não encerrada e movimentação de cofre não arquivada). Pontuais pendentes não ganham chip, igual ao desktop.
- **Série "bloqueada"** (encerrada ou toda efetivada): o ActionSheet não mostra ação destrutiva. No desktop o botão existe mas só mostra o toast "Não é possível excluir"; o resultado para o usuário é o mesmo.
- **"Tipo em controle segmentado" dentro do form** (spec §5.1 item 5) não entra: a lista aprovada pelo usuário manteve os forms atuais (só `inputMode` e Salvar visível).
- **Busca** existe só no celular; o estado `filterSearch` é da página (se a janela crescer para desktop com uma busca ativa, a lista continua filtrada até recarregar).
- **KPIs no celular** começam por Disponível (ordem aprovada), enquanto o desktop mantém Receitas · Despesas · Disponível.
