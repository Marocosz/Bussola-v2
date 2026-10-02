# Mobile 06: Ritmo (página, builders de Treino/Dieta e BioModal), plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a página Ritmo (`/ritmo`) para o celular no layout aprovado "Grade 2×4": os 7 chips de bio + "Ajustar Perfil" numa grade 2×4, os painéis Volume semanal e Macros empilhados em largura total (rótulo de 76px, blocos com teto), abas Plano de Treino | Plano de Dieta com as pílulas atuais, biblioteca de planos numa faixa com scroll-snap e ações de 44px, Fab para "Novo treino"/"Nova dieta", cards de treino/refeição com o mesmo design e tabelas mais justas, builders (`TreinoModal`, `DietaModal`) em sheet de tela cheia com cada exercício/alimento como bloco empilhado, e `BioModal` em coluna única com a regra do "Sugerido" como texto visível. Tablet ganha os ajustes da spec §6. Desktop (≥1025) fica idêntico.

**Architecture:**
- `Ritmo/index.jsx` continua dono de todo o estado e dos handlers. Não há componente mobile separado: o markup é o mesmo, o celular muda só por CSS (`@media (max-width: 768px)`) e por 4 decisões de render com `useIsMobile()`: não renderiza o `.page-header`, não renderiza o botão "Novo Treino/Nova Dieta" do cabeçalho das abas, renderiza o `<Fab>`, e corta os blocos de volume acima de 12 sets numa barra contínua.
- Os builders trocam os `style={{ gridTemplateColumns }}` inline por classes (`.rb-ex-row`, `.rb-food-row` e companhia) com **os mesmos valores computados no desktop** e grid-areas empilhadas no celular. Passam a `BaseModal sheet="full"`. Nenhuma lógica de estado muda.
- `BioModal` ganha `inputMode`, um texto auxiliar `.meta-hint` (oculto com mouse, visível no toque/≤768) e o "Sugerido" como `role="button"` de 44px no toque. Continua `sheet="auto"`.
- Proteção do desktop: screenshots base de 5 estados novos (aba Dieta, editar treino, editar dieta, busca de alimento, perfil) tirados **antes** de mexer no código (Task 1), além dos já existentes `ritmo.png` e `modal-treino.png`.
- Testes: Playwright (`ritmo.mobile.spec.mjs`, `ritmo.tablet.spec.mjs`, `ritmo.desktop.spec.mjs`). Planos/dietas criados pelos testes começam com `E2E ` e são removidos pela API; a limpeza também devolve o plano/dieta originais como ativos.

**Tech Stack:** React 19, Vite 7, CSS puro, Font Awesome (npm), `@playwright/test` 1.63.

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-responsivo-design.md` (§2 restrições, §4 fundação, §5.5 Ritmo, §6 tablet, §8 verificação). Este plano é a etapa 8 da §7.
**Planos anteriores:** `2026-10-02-mobile-01-fundacao-shell.md` (harness, tokens, `Sheet`/`ActionSheet`/`Fab`, `BaseModal sheet`, shell; já implementado) e `2026-10-02-mobile-02-provisoes.md` (cria `e2e/helpers.mjs › authHeaders/apiJson/smallTargets` e `components/mobile/Segmented.jsx`; executa antes deste). Este plano **reusa** os helpers do plano 02 e **não** usa o `Segmented` (ver Decisões).

## Global Constraints

- **Branch:** `feat/mobile-responsivo` (worktree `.claude/worktrees/mobile-responsivo`). Um commit por task. **Nunca** fazer push nem merge em `main`. Nunca usar `git stash`.
- **Commits** terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use um segundo `-m`).
- **Não redesenhar cards existentes:** chips de bio (`.bio-stat-chip`: ícone azul, rótulo em caixa alta, valor + unidade), painéis (`.bio-panel`), mini-card de plano (`.plan-mini-card`, borda azul no ativo), card de treino/refeição (`.refeicao-card-pro`: cabeçalho com nome + badge, tabela, rodapé com a pílula de macros nas cores `.m-p/.m-c/.m-g`). Só espaçamento, tamanho, quebra, alvo de toque e ações visíveis.
- **Ícones:** só classes Font Awesome que já existem no código. Usadas neste plano: `fa-weight-scale`, `fa-ruler-vertical`, `fa-percent`, `fa-fire-flame-curved`, `fa-brain`, `fa-droplet`, `fa-person-running`, `fa-sliders`, `fa-dumbbell`, `fa-utensils`, `fa-play`, `fa-pen-to-square`, `fa-trash`, `fa-trash-can`, `fa-xmark`, `fa-plus` (Fab), `fa-calendar-plus`, `fa-carrot`, `fa-circle-notch`, `fa-wand-magic-sparkles`.
- **Espaçamento (tokens `--sp-1..6` = 4/8/12/16/24/32):** 8 entre elementos dentro de um card/bloco, 12 entre cards, 16 entre blocos da página e gutter lateral, 24 entre seções (visão bio ↔ planos). Nenhum valor solto fora da escala no CSS novo, exceto tamanhos de controle (36/44/48/52/56px) e larguras de coluna aprovadas (rótulo do volume 76px, card da faixa ≤ 320px). Os valores **copiados** de `style={{}}` inline para classe (desktop) mantêm o valor original (é o que garante o pixel idêntico).
- **Toque:** alvo ≥ 44×44 em tudo que é interativo; inputs com 16px (já garantido por `tokens.css`); nenhuma ação ou informação só no hover (o tooltip do "Sugerido" vira texto visível).
- **Tipografia mobile:** conteúdo principal ≥ 14px (valor do chip, nome do plano, nome da refeição, células da tabela), secundário ≥ 12px, mínimo 11px só em rótulos em caixa alta (rótulo do chip, cabeçalho da tabela, título do painel).
- **Desktop (≥1025):** visualmente idêntico. Os PNGs de `e2e/desktop-visual.desktop.spec.mjs-snapshots/` (em especial `ritmo.png` e `modal-treino.png`) e os 5 novos de `ritmo.desktop.spec.mjs-snapshots/` (Task 1) têm que continuar passando em toda task. Tablet (769–1024) pode mudar conforme a spec §6.
- **Sem mudança de API/backend.** Reusar `services/api.ts` e os handlers existentes da página; nenhuma regra de negócio nova.
- **Dados de teste:** tudo que os testes criam começa com `E2E ` e é removido via API (`limparE2E`) no `beforeAll` e no `afterAll` do arquivo. Criar um plano com `ativo: true` desativa o "Hipertrofia ABC 2025" do banco demo; a limpeza reativa o primeiro plano/dieta não-E2E se o ativo for E2E ou se não houver ativo. Os testes **não** salvam o `BioModal` (o `POST /ritmo/bio` cria um registro novo e o backend recalcula TMB/metas: mudaria os chips da base do desktop).
- **Lint:** `npx eslint src/pages/Ritmo` sem **novos** erros. Linha de base medida: **5 erros, 2 warnings** (4× `no-unused-vars` em `catch (error)` de `index.jsx`, 1× em `BioModal.jsx`; 2× `exhaustive-deps`). Este plano troca os 5 por `catch {` (meta: 0 erros, 2 warnings). Regras v7: sem `setState` síncrono em `useEffect` novo, sem mutar acumuladores no render, `catch {` sem variável.
- **Build:** `npm run build` passa.

## API real dos primitivos (lida do código, use exatamente isto)

- `useIsMobile()` / `useIsTablet()` de `src/hooks/useIsMobile.js` (≤768 / 769–1024), via `useSyncExternalStore`.
- `BaseModal({ children, onClose, className, sheet = 'auto' })`: **não é portal** (renderiza no lugar, aqui dentro de `.ritmo-scope`). No mobile põe `is-sheet` (e `is-sheet-full` com `sheet="full"`) no `.modal-overlay`. ESC e clique no overlay chamam `onClose`. Os builders passam `className="ritmo-scope"`.
- `components.css` (≤768) faz o sheet: `.modal-overlay.is-sheet > .modal-content` com `!important` (largura 100%, `max-height` por `--vvh`, `margin-bottom: var(--kb-inset)`); quando há `> form > .modal-body`, o conteúdo fica `overflow: hidden`, o corpo rola e `> form > .modal-header/.modal-footer` não encolhem; o rodapé recebe `padding-bottom: calc(var(--sp-3) + var(--safe-bottom)) !important`. `.is-sheet-full > .modal-content` tem `height: var(--vvh, 100dvh)`. Ou seja, **o rodapé do builder já fica fixo** se o markup for `.modal-content > form > (.modal-body + .modal-footer)` — o que os 3 modais do Ritmo já são.
- `Sheet({ open, onClose, title, ariaLabel, children, footer, full, className })`: **é portal** no `body` (não herda `.ritmo-scope`). O `CustomSelect` usa `Sheet` no mobile e ignora "clique fora" quando `isMobile` (coberto por `modais-reais.mobile.spec.mjs › "Ritmo: sheet do CustomSelect (portal) nao herda .ritmo-scope"`, que clica `getByRole('button', { name: 'Novo Treino' })` — o Fab `aria-label="Novo treino"` casa, pois o `name` do Playwright é substring sem caixa — e `'+ Add Exercício'`, texto que este plano mantém).
- `Fab({ icon = 'fa-plus', label, onClick })`: portal no `body`, `button.app-fab[aria-label]`, visível só ≤768.
- `TopbarActions` não é usado aqui. O título da topbar vem de `NAV_ITEMS` (`/ritmo` → "Ritmo", `aiContext: 'ritmo'`, então o robô aparece na topbar). `AiAssistant` já retorna `null` no mobile.
- **Ordem do CSS** (`main.jsx`): `tokens.css` → CSS das páginas (o `Ritmo/styles.css` entra pelo `App`) → `mobile.css` → `components.css` → `global.css`. Consequências no Ritmo:
  - `.ritmo-scope .form-input`, `.ritmo-scope input[type="text"|"number"]` têm `height: 48px !important` — por isso os `height: '35px'` inline dos builders **não valem hoje** (o `!important` vence o inline). Ao mover o inline para classe, **não** declarar altura.
  - `.ritmo-scope input[type="text"]` é (0,2,1): a classe nova que substitui `padding`/`font-size` inline precisa de (0,3,0), ex.: `.ritmo-scope .rb-ex-row .form-input`.
  - `.ritmo-scope label` e `.form-group label` são (0,1,1): a classe do rótulo pequeno precisa de (0,2,0) (`.ritmo-scope .rb-label`) e **não** pode pegar o `label.custom-select-label` do `CustomSelect` (senão o "Grupo" muda no desktop).
  - `.ritmo-scope .modal-overlay` (z-index 2000, `padding: 2rem 0`, `overflow-y: auto`) perde para o `!important` do sheet; `.ritmo-scope .modal-body { padding: 1.5rem }` e `.ritmo-scope .modal-footer` não são `!important`, então `.ritmo-scope .modal-overlay.is-sheet .modal-body` (0,3,0) os ajusta.
- `TooltipHost` (global) só registra listeners com `(hover: hover)`; ele também lê `data-tooltip` (o "Sugerido" do `BioModal` tem). No desktop, `click()` num botão com `title` faz o balão aparecer até o clique; nas bases visuais use `dispatchEvent('click')` em botões com `title` para não haver balão no screenshot.
- `overflowOffenders(page)` ignora elementos dentro de `[data-offscreen-ok]` (a faixa de planos precisa do atributo: cards fora da tela dentro do scroller contariam). Helpers do plano 02: `apiJson(request, method, path, data?)` (lança em status ≠ 2xx; resposta vazia → `null`), `smallTargets(page, rootSelector)` (controles visíveis `< 44×44`: `button, a[href], select, [role="button"], [role="tab"], input`). **Se `apiJson`/`smallTargets` não existirem em `e2e/helpers.mjs`, pare: o plano 02 não foi executado.**
- Projetos Playwright por sufixo: `*.mobile.spec.mjs` (390×844, touch, `pointer: coarse`, `hover: none`), `*.tablet.spec.mjs` (900×1200, touch), `*.desktop.spec.mjs` (1280×900, mouse). Relógio fixo `2026-10-02 12:00 -03:00`. Teclado virtual simulado: `--vvh: 420px` e `--kb-inset: 424px` no `documentElement` (padrão de `ui-lab.mobile.spec.mjs`).
- Banco demo (`populate_db.py › create_ritmo`): bio (peso 80.5, altura 178, idade 28, M, moderado, ganho_massa, TMB 1800, meta 2600 kcal, P160/C300/G70, água 3.5, BF 18.5); plano ativo **"Hipertrofia ABC 2025"** (dias "Treino A - Peito/Tríceps", "Treino B - Costas/Bíceps", "Treino C - Pernas/Ombro", 4 exercícios cada → volume Peito 7, Tríceps 7, Costas 7, Bíceps 7, Quadríceps 7, Posterior 4, Ombros 4); dieta ativa **"Bulking Limpo"** (Café da Manhã, Almoço, Lanche Tarde, Jantar). A busca de alimentos (`GET /ritmo/local/foods?q=`) lê um JSON TACO local que pode não existir no banco demo: **os testes mockam essa rota** com `FOODS`.

## Review Focus

1. **Regressão no desktop ao trocar `style={{}}` por classe nos builders** (especificidade contra `.ritmo-scope input[type=…]`, `!important` da altura, rótulo do `CustomSelect` pego por engano). Teste na Task 1 › `ritmo.desktop.spec.mjs` (`modal-treino-editar.png`, `modal-dieta-editar.png`, `modal-dieta-busca.png`) + `desktop-visual › modal-treino.png`, rodados nas Tasks 4 e 5.
2. **Salvar do builder escondido pelo teclado** (rodapé que rola junto, sheet que não encolhe com `--vvh`). Teste na Task 4 › "builder de treino: Salvar visível com o teclado aberto" e Task 5 › "builder de dieta: Salvar visível com o teclado aberto" (e Task 6 › "perfil: Confirmar visível com o teclado aberto").
3. **Busca de alimento quebrada no layout empilhado** (dropdown ancorado na linha inteira em vez do campo de nome, cortado, toque que não seleciona, macros não recalculados). Teste na Task 5 › "Nova dieta pelo Fab: busca abaixo do nome, item travado, macros recalculados, salva e exclui".
4. **Corte/overflow em 360px** (faixa de chips com `nowrap`, pílulas das abas, tabela de dieta de 6 colunas, pílula de macros, grade do volume com largura negativa). Teste na Task 2 › "dados de bio em grade 2×4…" e "volume: rótulo de 76px…", Task 3 › "sem overflow horizontal em {360,390,430,768}px nas duas abas" e "cards: tabelas cabem em 360px e a pílula de macros quebra centralizada".
5. **Informação só no hover** (regra do "Sugerido" em tooltip `::after`; com toque não aparece e o balão sai da tela). Teste na Task 6 › "perfil: coluna única, regra do Sugerido visível…" e Task 7 › "tablet: regra do Sugerido visível sem hover" (e o desktop continua com o tooltip: Task 6 › `ritmo.desktop.spec` "Sugerido: regra só no hover").

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `bussola_web/e2e/ritmo.desktop.spec.mjs` | criar | bases visuais (aba Dieta, editar treino/dieta, busca, perfil) + "nada do mobile" + tooltip só no hover |
| `bussola_web/e2e/ritmo.mobile.spec.mjs` | criar | limpeza E2E, visão bio, abas/biblioteca/cards, builders, BioModal, capturas |
| `bussola_web/e2e/ritmo.tablet.spec.mjs` | criar | faixa 4×2, sem overflow, alvos de 44px, regra visível sem hover |
| `bussola_web/src/pages/Ritmo/index.jsx` | modificar | `useIsMobile`, sem `.page-header`/botão do cabeçalho no mobile, Fab, volume com teto, abas `role="tab"`, ações com `aria-label`, `<main>` → `<section>`, `catch {` |
| `bussola_web/src/pages/Ritmo/styles.css` | modificar | blocos novos ao final: §11 visão bio (≤768), §12 abas/biblioteca/cards (≤768 + toque), §13 builders (classes + ≤768), §14 BioModal, §15 tablet |
| `bussola_web/src/pages/Ritmo/components/TreinoModal.jsx` | modificar | `sheet="full"`, grid inline → classes, `inputMode`, remover com 44px |
| `bussola_web/src/pages/Ritmo/components/DietaModal.jsx` | modificar | `sheet="full"`, grid inline → classes, `inputMode`, busca ancorada no nome |
| `bussola_web/src/pages/Ritmo/components/BioModal.jsx` | modificar | `inputMode`, `.meta-hint`, "Sugerido" `role="button"`, `catch {` |

---

### Task 1: Base visual do desktop e infraestrutura dos testes (antes de qualquer código)

**Files:**
- Create: `bussola_web/e2e/ritmo.desktop.spec.mjs`, `bussola_web/e2e/ritmo.mobile.spec.mjs`

**Interfaces:**
- Consumes: `gotoApp`, `overflowOffenders`, `apiJson`, `smallTargets` (`e2e/helpers.mjs`).
- Produces (no `ritmo.mobile.spec.mjs`, usados pelas Tasks 2–7): `FOODS`, `abrirAba(page, nome)`, `teclado(page)`, `limparE2E(request)`, `vazamentos(page, sel)`, `cortados(page, sel)`, `textosPequenos(page, sel)`.

- [ ] **Step 1: Spec de base visual do desktop**

Criar `bussola_web/e2e/ritmo.desktop.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

// Busca de alimentos fixa: a tabela TACO local pode não existir no banco demo.
const FOODS = [
  { nome: 'Arroz, tipo 1, cozido', calorias_100g: 128, proteina_100g: 2.5, carbo_100g: 28.1, gordura_100g: 0.2 },
  { nome: 'Arroz, integral, cozido', calorias_100g: 124, proteina_100g: 2.6, carbo_100g: 25.8, gordura_100g: 1 },
];

// Seletores estáveis ao longo do plano (as abas viram role="tab" na Task 3).
const abaDieta = (p) => p.locator('.tab-btn-pill', { hasText: 'Plano de Dieta' }).click();
// Botões com `title`: dispatchEvent não passa o mouse por cima (sem balão do TooltipHost no screenshot).
const editarPlano = (p, nome) => p.locator('.plan-mini-card', { hasText: nome }).locator('button[title="Editar"]').dispatchEvent('click');

// Estados que os refactors deste plano tocam. Base gerada ANTES de mexer no código.
const CASOS = [
  ['ritmo-dieta', async (p) => {
    await abaDieta(p);
    await p.locator('.refeicao-card-pro').first().waitFor();
  }, { fullPage: true }],
  ['modal-treino-editar', async (p) => {
    await editarPlano(p, 'Hipertrofia ABC 2025');
    await p.locator('.modal-content .day-block').first().waitFor();
  }],
  ['modal-dieta-editar', async (p) => {
    await abaDieta(p);
    await editarPlano(p, 'Bulking Limpo');
    await p.locator('.modal-content .day-block').first().waitFor();
  }],
  ['modal-dieta-busca', async (p) => {
    await p.route('**/ritmo/local/foods**', (r) => r.fulfill({ json: FOODS }));
    await abaDieta(p);
    await p.getByRole('button', { name: 'Nova Dieta' }).click();
    await p.getByRole('button', { name: '+ Add Alimento' }).click();
    await p.locator('.modal-content input[autocomplete="off"]').first().fill('arroz');
    await expect(p.locator('.search-results-dropdown')).toContainText('Arroz, tipo 1, cozido');
  }],
  ['modal-bio', async (p) => {
    await p.getByRole('button', { name: 'Ajustar Perfil' }).click();
    await p.locator('.bio-modal-grid').waitFor();
  }],
];

for (const [nome, abrir, opts] of CASOS) {
  test(`desktop ritmo: ${nome} inalterado`, async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await abrir(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`${nome}.png`, opts);
  });
}

test('desktop ritmo: nada do layout mobile aparece', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  await expect(page.locator('.ritmo-scope .page-header')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo Treino' })).toBeVisible();
  await expect(page.locator('.app-fab')).toHaveCount(0);
  expect(await page.locator('.bio-stat-strip').evaluate((e) => getComputedStyle(e).display)).toBe('flex');
  expect(await page.locator('.bio-panels-row').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
});
```

- [ ] **Step 2: Gerar a base ANTES de qualquer mudança de código**

Run (em `bussola_web/`): `npm run e2e:update -- --project=desktop e2e/ritmo.desktop.spec.mjs`
Expected: 6 passed; criados 5 PNGs em `e2e/ritmo.desktop.spec.mjs-snapshots/`. Abra os 5 (ferramenta Read) e confira: aba Dieta com os 4 cards de refeição; editar treino com "Editar: Hipertrofia ABC 2025" e os exercícios do Treino A; editar dieta com "Editar: Bulking Limpo"; nova dieta com o dropdown mostrando "Usar "arroz" como personalizado" + os 2 arrozes; o perfil com as duas colunas. Rode `npm run e2e -- --project=desktop e2e/ritmo.desktop.spec.mjs e2e/desktop-visual.desktop.spec.mjs` **duas vezes** e confirme que tudo passa estável; se algo variar entre execuções, adicione `mask` no elemento dinâmico e regenere.

- [ ] **Step 3: Infra do spec mobile (limpeza E2E e helpers) com o teste da própria limpeza**

Criar `bussola_web/e2e/ritmo.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, apiJson, smallTargets } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Infra do arquivo
// ---------------------------------------------------------------------------
// Busca de alimentos fixa: a tabela TACO local pode não existir no banco demo.
const FOODS = [
  { nome: 'Arroz, tipo 1, cozido', calorias_100g: 128, proteina_100g: 2.5, carbo_100g: 28.1, gordura_100g: 0.2 },
  { nome: 'Arroz, integral, cozido', calorias_100g: 124, proteina_100g: 2.6, carbo_100g: 25.8, gordura_100g: 1 },
];

const abrirAba = (page, nome) => page.getByRole('tab', { name: nome, exact: true }).click();

// Teclado virtual de 424px: a área visível fica com 420px e o layout segue com 844.
const teclado = (page) => page.evaluate(() => {
  document.documentElement.style.setProperty('--vvh', '420px');
  document.documentElement.style.setProperty('--kb-inset', '424px');
});

// Remove planos/dietas "E2E " e devolve o original como ativo (criar com ativo=true desativa o
// "Hipertrofia ABC 2025"/"Bulking Limpo"; sem isso a base visual do desktop quebra).
async function limparE2E(request) {
  for (const base of ['/ritmo/treinos', '/ritmo/nutricao']) {
    const itens = await apiJson(request, 'GET', base);
    const e2e = (x) => String(x.nome).startsWith('E2E ');
    const ativo = itens.find((x) => x.ativo);
    if (!ativo || e2e(ativo)) {
      const alvo = itens.find((x) => !e2e(x));
      if (alvo) await apiJson(request, 'PATCH', `${base}/${alvo.id}/ativar`);
    }
    for (const x of itens.filter(e2e)) await apiJson(request, 'DELETE', `${base}/${x.id}`);
  }
}

// Elementos de `sel` (ele e descendentes) que passam das bordas da viewport.
async function vazamentos(page, sel) {
  return page.evaluate((s) => {
    const vw = window.innerWidth;
    const out = [];
    for (const el of document.querySelectorAll(`${s}, ${s} *`)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right > vw + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    }
    return out;
  }, sel);
}

// Elementos que cortam o próprio texto (scrollWidth > clientWidth).
async function cortados(page, sel) {
  return page.locator(sel).evaluateAll((els) => els
    .filter((e) => e.getBoundingClientRect().width && e.scrollWidth > e.clientWidth + 1)
    .map((e) => `${e.className} "${e.textContent.trim().slice(0, 24)}" ${e.scrollWidth}>${e.clientWidth}`));
}

// Textos visíveis abaixo do mínimo: 12px (11px só em caixa alta).
async function textosPequenos(page, sel) {
  return page.evaluate((s) => {
    const out = [];
    for (const root of document.querySelectorAll(s)) {
      for (const el of root.querySelectorAll('*')) {
        const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!temTexto) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const fs = parseFloat(cs.fontSize);
        const min = cs.textTransform === 'uppercase' ? 11 : 12;
        if (fs < min - 0.01) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 20)}" ${fs}px`);
      }
    }
    return out;
  }, sel);
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
// Task 1 — infraestrutura
// ---------------------------------------------------------------------------
test('infra: limparE2E remove planos/dietas E2E e devolve os originais como ativos', async ({ request }) => {
  await apiJson(request, 'POST', '/ritmo/treinos', { nome: 'E2E Infra', ativo: true, dias: [] });
  await apiJson(request, 'POST', '/ritmo/nutricao', { nome: 'E2E Infra', ativo: true, refeicoes: [] });
  expect((await apiJson(request, 'GET', '/ritmo/treinos/ativo')).nome).toBe('E2E Infra');
  await limparE2E(request);
  expect((await apiJson(request, 'GET', '/ritmo/treinos/ativo')).nome).toBe('Hipertrofia ABC 2025');
  expect((await apiJson(request, 'GET', '/ritmo/nutricao/ativo')).nome).toBe('Bulking Limpo');
  const todos = [...await apiJson(request, 'GET', '/ritmo/treinos'), ...await apiJson(request, 'GET', '/ritmo/nutricao')];
  expect(todos.filter((x) => x.nome.startsWith('E2E '))).toEqual([]);
});
```

(`overflowOffenders`, `smallTargets`, `FOODS`, `abrirAba`, `teclado`, `vazamentos`, `cortados` e `textosPequenos` passam a ser usados a partir da Task 2; o ESLint do projeto não varre `e2e/`.)

- [ ] **Step 4: Rodar**

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs` → Expected: 1 passed.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (inclui os 6 de `ritmo.desktop.spec.mjs`; `ritmo.png` idêntico, prova de que a limpeza devolveu os ativos).

- [ ] **Step 5: Commit**

```bash
git add bussola_web/e2e/ritmo.desktop.spec.mjs bussola_web/e2e/ritmo.desktop.spec.mjs-snapshots bussola_web/e2e/ritmo.mobile.spec.mjs
git commit -m "test(e2e): base visual do Ritmo no desktop e limpeza E2E de planos/dietas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Visão bio no celular (grade 2×4, painéis empilhados, volume com teto)

**Files:**
- Modify: `bussola_web/src/pages/Ritmo/index.jsx`, `bussola_web/src/pages/Ritmo/styles.css`, `bussola_web/e2e/ritmo.mobile.spec.mjs`

**Interfaces:**
- Consumes: `useIsMobile` (plano 01); helpers da Task 1.
- Produces: `VOL_MAX_BLOCOS = 12` (módulo de `index.jsx`); `.vol-blocks-track.is-continuous` (uma única `.vol-block`) quando `isMobile && sets > 12`; `isMobile` disponível no componente `Ritmo` (usado pela Task 3). No mobile o `.page-header` não é renderizado.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/ritmo.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 2 — visão bio
// ---------------------------------------------------------------------------
test.describe('visão bio', () => {
  test('topbar "Ritmo" e sem page-header no celular', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await expect(page.locator('.m-topbar-title')).toHaveText('Ritmo');
    await expect(page.locator('.ritmo-scope .page-header')).toHaveCount(0);
  });

  test('dados de bio em grade 2×4: 7 chips com os ícones atuais + Ajustar Perfil, sem cortar texto em 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const strip = page.locator('.bio-stat-strip');
    expect(await strip.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
    const icones = await strip.locator('.bio-stat-chip > i').evaluateAll((els) => els.map((e) => [...e.classList].find((c) => c.startsWith('fa-') && c !== 'fa-solid')));
    expect(icones).toEqual(['fa-weight-scale', 'fa-ruler-vertical', 'fa-percent', 'fa-fire-flame-curved', 'fa-brain', 'fa-droplet', 'fa-person-running']);
    const celulas = strip.locator(':scope > *');
    await expect(celulas).toHaveCount(8);
    const caixas = await celulas.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), h: r.height }; }));
    expect(new Set(caixas.map((c) => c.y)).size).toBe(4); // 4 linhas
    expect(caixas[7].x).toBeGreaterThan(caixas[6].x); // Ajustar Perfil na 2ª coluna da última linha
    for (const c of caixas) expect(c.h).toBeGreaterThanOrEqual(44);
    await expect(celulas.nth(7)).toHaveText(/Ajustar Perfil/);
    await expect(celulas.nth(7).locator('i')).toHaveClass(/fa-sliders/);
    expect(await cortados(page, '.chip-label, .chip-value')).toEqual([]);
    for (const fs of await strip.locator('.chip-value').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)))) {
      expect(fs).toBeGreaterThanOrEqual(14);
    }
  });

  test('painéis Volume e Macros empilhados em largura total', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const strip = await page.locator('.bio-stat-strip').boundingBox();
    const [vol, mac] = await page.locator('.bio-panel').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { y: r.y, h: r.height, w: r.width }; }));
    expect(mac.y).toBeGreaterThanOrEqual(vol.y + vol.h + 15); // 16px entre os painéis
    for (const p of [vol, mac]) expect(Math.abs(p.w - strip.width)).toBeLessThan(2);
    expect(Math.round(strip.width)).toBe(360 - 32); // gutter de 16px
  });

  test('volume: rótulo de 76px; muitos sets viram uma barra contínua; poucos seguem em blocos', async ({ page }) => {
    await page.route('**/ritmo/bio/latest', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.volume_semanal = { ...json.volume_semanal, Peito: 40 };
      await route.fulfill({ response: res, json });
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const linhas = page.locator('.vol-bar-row');
    const peito = linhas.filter({ hasText: 'Peito' });
    expect(await peito.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ')[0])).toBe('76px');
    await expect(peito.locator('.vol-blocks-track')).toHaveClass(/is-continuous/);
    await expect(peito.locator('.vol-block')).toHaveCount(1);
    const costas = linhas.filter({ hasText: 'Costas' });
    await expect(costas.locator('.vol-blocks-track')).not.toHaveClass(/is-continuous/);
    await expect(costas.locator('.vol-block')).toHaveCount(7);
    const trilha = await peito.locator('.vol-blocks-track').boundingBox();
    const contador = await peito.locator('.vol-bar-count').boundingBox();
    expect(trilha.width).toBeGreaterThan(100);
    expect(trilha.x + trilha.width).toBeLessThanOrEqual(contador.x);
  });

  for (const w of [360, 390, 430, 768]) {
    test(`visão bio sem vazar da tela em ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/ritmo');
      expect(await vazamentos(page, '.bio-overview-section')).toEqual([]);
    });
  }

  test('visão bio: textos legíveis e "Ajustar Perfil" abre o perfil em sheet', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    expect(await textosPequenos(page, '.bio-overview-section')).toEqual([]);
    await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet.locator('.modal-title')).toHaveText('Perfil Biológico & Metas');
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs -g "visão bio"`
Expected: FAIL — `.page-header` presente, faixa em `flex` (1 linha, rótulos cortados), painéis lado a lado (~150px), coluna de rótulo de 110px e 40 blocos no Peito, `chip-label` de 9,9px e `bio-panel-sub` de 10,9px.

- [ ] **Step 2: `useIsMobile`, teto do volume e `catch {` em `index.jsx`**

Em `bussola_web/src/pages/Ritmo/index.jsx`:

1. Trocar `import { AiAssistant } from '../../components/AiAssistant';` por:

```js
import { AiAssistant } from '../../components/AiAssistant';
import { useIsMobile } from '../../hooks/useIsMobile';
```

2. Trocar `import './styles.css';` por:

```js
import './styles.css';

// No celular, acima disto a linha de volume vira uma barra contínua (blocos de 3px não cabem).
const VOL_MAX_BLOCOS = 12;
```

3. Trocar:

```js
    const confirm = useConfirm();
```

por:

```js
    const confirm = useConfirm();
    const isMobile = useIsMobile();
```

4. Trocar cada um dos 4 `catch (error)` sem uso (o do `loadData` usa `error` e fica):

```js
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível ativar este treino.' });
```

por:

```js
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível ativar este treino.' });
```

```js
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Erro ao excluir plano de treino.' });
```

por:

```js
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Erro ao excluir plano de treino.' });
```

```js
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível ativar esta dieta.' });
```

por:

```js
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível ativar esta dieta.' });
```

```js
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Erro ao excluir dieta.' });
```

por:

```js
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Erro ao excluir dieta.' });
```

5. Trocar o cabeçalho da página:

```jsx
            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-dumbbell"></i> Ritmo</h1>
                </div>
                <div className="page-header-kpis">
                    <span className="ph-kpi"><i className="fa-solid fa-dumbbell"></i> {treinoAtivo ? treinoAtivo.nome : 'Sem plano ativo'}</span>
                    <span className="ph-kpi"><i className="fa-solid fa-utensils"></i> {dietaAtiva ? dietaAtiva.nome : 'Sem dieta ativa'}</span>
                    {bio?.peso && <span className="ph-kpi"><i className="fa-solid fa-weight-scale"></i> {bio.peso} kg</span>}
                </div>
            </div>
```

por:

```jsx
            {/* No celular o título vai para a topbar; os KPIs repetem o peso (chip) e o plano ativo (biblioteca). */}
            {!isMobile && (
                <div className="page-header">
                    <div className="page-header-main">
                        <h1><i className="fa-solid fa-dumbbell"></i> Ritmo</h1>
                    </div>
                    <div className="page-header-kpis">
                        <span className="ph-kpi"><i className="fa-solid fa-dumbbell"></i> {treinoAtivo ? treinoAtivo.nome : 'Sem plano ativo'}</span>
                        <span className="ph-kpi"><i className="fa-solid fa-utensils"></i> {dietaAtiva ? dietaAtiva.nome : 'Sem dieta ativa'}</span>
                        {bio?.peso && <span className="ph-kpi"><i className="fa-solid fa-weight-scale"></i> {bio.peso} kg</span>}
                    </div>
                </div>
            )}
```

6. Trocar as linhas de volume:

```jsx
                                    {Object.entries(volumeSemanal).map(([grupo, sets]) => (
                                        <div key={grupo} className="vol-bar-row">
                                            <span className="vol-bar-label">{grupo}</span>
                                            {/* Largura proporcional ao maior grupo: o maior ocupa a linha inteira */}
                                            <div className="vol-blocks-track" style={{ width: `${(sets / maxSetsSemana) * 100}%` }}>
                                                {Array.from({ length: sets }).map((_, i) => (
                                                    <div key={i} className="vol-block"></div>
                                                ))}
                                            </div>
                                            <span className="vol-bar-count">{sets}</span>
                                        </div>
                                    ))}
```

por:

```jsx
                                    {Object.entries(volumeSemanal).map(([grupo, sets]) => {
                                        // Celular: com muitos sets os blocos não cabem e viram uma barra contínua.
                                        const continuo = isMobile && sets > VOL_MAX_BLOCOS;
                                        return (
                                            <div key={grupo} className="vol-bar-row">
                                                <span className="vol-bar-label">{grupo}</span>
                                                {/* Largura proporcional ao maior grupo: o maior ocupa a linha inteira */}
                                                <div className={`vol-blocks-track${continuo ? ' is-continuous' : ''}`} style={{ width: `${(sets / maxSetsSemana) * 100}%` }}>
                                                    {Array.from({ length: continuo ? 1 : sets }).map((_, i) => (
                                                        <div key={i} className="vol-block"></div>
                                                    ))}
                                                </div>
                                                <span className="vol-bar-count">{sets}</span>
                                            </div>
                                        );
                                    })}
```

- [ ] **Step 3: CSS da visão bio (≤768)**

Ao final de `bussola_web/src/pages/Ritmo/styles.css`, adicionar:

```css
/* ============================================= */
/* 11. CELULAR (≤768): VISÃO BIO "GRADE 2×4"     */
/* Escala: 8 dentro do card, 12 entre cards,     */
/* 16 entre blocos e gutter, 24 entre seções.    */
/* ============================================= */
@media (max-width: 768px) {
    .ritmo-scope.main-container {
        padding-top: var(--sp-4) !important;
    }

    .ritmo-scope .ritmo-content-wrapper {
        max-width: 100%;
        gap: var(--sp-4);
    }

    .ritmo-scope .bio-overview-section {
        gap: var(--sp-4);
        margin-bottom: var(--sp-2); /* + 16 do gap do wrapper = 24 até as abas */
    }

    /* 7 chips + "Ajustar Perfil" numa grade 2×4 (o chip mantém o visual) */
    .ritmo-scope .bio-stat-strip {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ritmo-scope .bio-stat-chip {
        gap: var(--sp-2);
        padding: var(--sp-3);
        border-bottom: 1px solid var(--cor-borda);
    }

    .ritmo-scope .bio-stat-chip:nth-child(2n) {
        border-right: none;
    }

    .ritmo-scope .bio-stat-chip:nth-child(7) {
        border-bottom: none;
    }

    .ritmo-scope .chip-label {
        font-size: 0.6875rem;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .ritmo-scope .chip-value em {
        font-size: 0.75rem;
    }

    .ritmo-scope .btn-adjust-profile-chip {
        justify-content: center;
        gap: var(--sp-2);
        padding: var(--sp-3);
        min-height: var(--tap-min);
        font-size: 0.875rem;
    }

    /* Painéis empilhados em largura total */
    .ritmo-scope .bio-panels-row {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--sp-4);
    }

    .ritmo-scope .bio-panel {
        padding: var(--sp-4);
        gap: var(--sp-3);
    }

    .ritmo-scope .bio-panel-header {
        flex-wrap: wrap;
        row-gap: var(--sp-1);
    }

    .ritmo-scope .bio-panel-sub {
        flex-basis: 100%;
        margin-left: 0;
        font-size: 0.75rem;
    }

    /* Volume: rótulo de 76px; a trilha nunca fica com largura negativa */
    .ritmo-scope .vol-bars-list {
        gap: var(--sp-2);
    }

    .ritmo-scope .vol-bar-row {
        grid-template-columns: 76px minmax(0, 1fr) 28px;
        gap: var(--sp-2);
    }

    .ritmo-scope .vol-bar-label,
    .ritmo-scope .vol-bar-count {
        font-size: 0.8125rem;
    }

    .ritmo-scope .vol-blocks-track.is-continuous .vol-block {
        flex: 1 1 auto;
    }

    /* Macros */
    .ritmo-scope .macro-bars-list {
        gap: var(--sp-3);
    }

    .ritmo-scope .macro-kcal-row {
        flex-wrap: wrap;
        row-gap: var(--sp-1);
        padding-top: var(--sp-3);
    }

    .ritmo-scope .kcal-diff {
        font-size: 0.75rem;
    }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs` → Expected: 10 passed (infra + visão bio).
Run: `npm run e2e -- --project=desktop e2e/ritmo.desktop.spec.mjs e2e/desktop-visual.desktop.spec.mjs` → Expected: tudo passa (`ritmo.png` idêntico).
Run: `npx eslint src/pages/Ritmo` → Expected: 1 erro (o `catch (error)` do `BioModal.jsx`, removido na Task 6) e 2 warnings.
Run: `npm run build` → OK.

- [ ] **Step 5: Commit**

```bash
git add bussola_web/src/pages/Ritmo bussola_web/e2e/ritmo.mobile.spec.mjs
git commit -m "feat(web): Ritmo no celular - dados de bio em grade 2x4, paineis empilhados e volume com teto" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Abas, biblioteca de planos, cards e Fab no celular

**Files:**
- Modify: `bussola_web/src/pages/Ritmo/index.jsx`, `bussola_web/src/pages/Ritmo/styles.css`, `bussola_web/e2e/ritmo.mobile.spec.mjs`

**Interfaces:**
- Consumes: `isMobile` (Task 2), `Fab` (plano 01), `apiJson`, `smallTargets`, `overflowOffenders`.
- Produces: `.tab-selector-wrapper[role="tablist"]` com `button.tab-btn-pill[role="tab"][aria-selected]`; ações do mini-card com `aria-label` "Ativar"/"Editar"/"Excluir" (o `title` continua); `.plans-horizontal-selector[data-offscreen-ok]` com scroll-snap; `section.ritmo-content-area` (antes `<main>`); grupo muscular da tabela de treino em `.alim-sub.alim-grupo`; Fab `aria-label` "Novo treino"/"Nova dieta" (só no mobile, quando o cabeçalho das abas não mostra o botão).

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/ritmo.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 3 — abas, biblioteca, cards, Fab
// ---------------------------------------------------------------------------
test.describe('abas, biblioteca e cards', () => {
  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px nas duas abas`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/ritmo');
      for (const aba of ['Plano de Treino', 'Plano de Dieta']) {
        await abrirAba(page, aba);
        await expect(page.locator('.refeicao-card-pro').first()).toBeVisible();
        expect(await overflowOffenders(page), `${aba} @ ${w}px`).toEqual([]);
      }
    });
  }

  test('alvos de toque ≥ 44px e textos legíveis nas duas abas', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    for (const aba of ['Plano de Treino', 'Plano de Dieta']) {
      await abrirAba(page, aba);
      await expect(page.locator('.refeicao-card-pro').first()).toBeVisible();
      expect(await smallTargets(page, '.ritmo-scope'), aba).toEqual([]);
      expect(await textosPequenos(page, '.ritmo-scope'), aba).toEqual([]);
    }
  });

  test('abas: as pílulas atuais em largura total, 44px, texto inteiro em 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const abas = page.getByRole('tab');
    await expect(abas).toHaveText(['Plano de Treino', 'Plano de Dieta']);
    await expect(abas.first()).toHaveAttribute('aria-selected', 'true');
    await expect(abas.first()).toHaveClass(/tab-btn-pill/);
    for (const t of await abas.all()) {
      expect((await t.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    expect(await cortados(page, '.tab-btn-pill')).toEqual([]);
    await abrirAba(page, 'Plano de Dieta');
    await expect(abas.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.section-subtitle')).toHaveText('Meus Planos de Dieta');
    await expect(page.locator('.ritmo-scope main')).toHaveCount(0);
    await expect(page.locator('section.ritmo-content-area')).toHaveCount(1);
  });

  test('Fab: "Novo treino" na aba Treino e "Nova dieta" na aba Dieta (um por vez, sem botão no cabeçalho)', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await expect(page.locator('.ritmo-scope .header-actions-group')).toHaveCount(0);
    await expect(page.locator('.app-fab')).toHaveCount(1);
    await page.getByRole('button', { name: 'Novo treino' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet.locator('h2')).toHaveText('Configurar Treino');
    await sheet.getByRole('button', { name: 'Cancelar' }).click();
    await abrirAba(page, 'Plano de Dieta');
    await expect(page.locator('.app-fab')).toHaveCount(1);
    await page.getByRole('button', { name: 'Nova dieta' }).click();
    await expect(sheet.locator('h2')).toHaveText('Configurar Dieta');
  });

  test('biblioteca: faixa com scroll-snap; ativar, excluir e estado vazio pelas ações de 44px', async ({ page, request }) => {
    await apiJson(request, 'POST', '/ritmo/treinos', {
      nome: 'E2E Treino biblioteca',
      ativo: false,
      dias: [{ nome: 'E2E Dia', ordem: 0, exercicios: [{ nome_exercicio: 'E2E Supino', grupo_muscular: 'Peito', series: 3, repeticoes_min: 8, repeticoes_max: 12 }] }],
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const faixa = page.locator('.plans-horizontal-selector');
    expect(await faixa.evaluate((e) => getComputedStyle(e).scrollSnapType)).toContain('x');
    expect(await faixa.locator('.plan-mini-card').first().evaluate((e) => getComputedStyle(e).scrollSnapAlign)).toContain('start');
    await expect(faixa).toHaveAttribute('data-offscreen-ok', '');
    expect(await smallTargets(page, '.plans-horizontal-selector')).toEqual([]);

    const original = page.locator('.plan-mini-card', { hasText: 'Hipertrofia ABC 2025' });
    const e2e = page.locator('.plan-mini-card', { hasText: 'E2E Treino biblioteca' });
    await e2e.getByRole('button', { name: 'Ativar' }).click();
    await expect(e2e).toHaveClass(/active/);
    await expect(page.locator('.refeicao-card-pro', { hasText: 'E2E Dia' })).toBeVisible();

    await e2e.getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Sim, Excluir' }).click();
    await expect(e2e).toHaveCount(0);

    // Sem plano ativo: estado vazio compacto
    const vazio = page.locator('.empty-state');
    await expect(vazio).toBeVisible();
    expect(await vazio.evaluate((e) => parseFloat(getComputedStyle(e).paddingLeft))).toBeLessThanOrEqual(16);
    expect(await overflowOffenders(page)).toEqual([]);

    await original.getByRole('button', { name: 'Ativar' }).click();
    await expect(original).toHaveClass(/active/);
  });

  test('cards: mesmas tabelas, cabem em 360px e a pílula de macros quebra centralizada', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/ritmo');
    const treino = page.locator('.refeicao-card-pro').first();
    await expect(treino.locator('thead th')).toHaveText(['Exercício', 'Sets', 'Rep.']);
    const grupoFs = await treino.locator('.alim-grupo').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(grupoFs).toBeGreaterThanOrEqual(12);

    await abrirAba(page, 'Plano de Dieta');
    const refeicao = page.locator('.refeicao-card-pro', { hasText: 'Almoço' });
    await expect(refeicao.locator('thead th')).toHaveText(['Item', 'Qtd', 'P', 'C', 'G', 'Kcal']);
    const sobra = await page.locator('.alimentos-table-wrapper').evaluateAll((els) => els.map((e) => e.scrollWidth - e.clientWidth));
    for (const s of sobra) expect(s).toBeLessThanOrEqual(0);
    expect((await refeicao.locator('td.alim-name-td').first().boundingBox()).width).toBeGreaterThan(90);
    for (const fs of await refeicao.locator('td').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)))) {
      expect(fs).toBeGreaterThanOrEqual(12);
    }

    const pilula = refeicao.locator('.macro-summary-pill');
    expect(await pilula.evaluate((e) => getComputedStyle(e).flexWrap)).toBe('wrap');
    const pb = await pilula.boundingBox();
    const fb = await refeicao.locator('.refeicao-pro-footer').boundingBox();
    expect(Math.abs((pb.x + pb.width / 2) - (fb.x + fb.width / 2))).toBeLessThan(2);
    expect(pb.x + pb.width).toBeLessThanOrEqual(fb.x + fb.width + 0.5);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs -g "abas, biblioteca e cards"`
Expected: FAIL — não há `role="tab"` (os `abrirAba` não acham), botão "Novo Treino" no cabeçalho, ações do mini-card com 28px, sem scroll-snap, tabela de dieta com scroll, `th` de 10,4px, pílula sem `wrap`, `<main>` aninhado.

- [ ] **Step 2: JSX das abas, da biblioteca, dos cards e do Fab**

Em `bussola_web/src/pages/Ritmo/index.jsx`:

1. Trocar:

```js
import { useIsMobile } from '../../hooks/useIsMobile';
```

por:

```js
import { useIsMobile } from '../../hooks/useIsMobile';
import { Fab } from '../../components/mobile/Fab';
```

2. Trocar o cabeçalho das abas:

```jsx
                <div className="column-header-flex plans-header-container">
                    <div className="tab-selector-wrapper">
                        <button
                            className={`tab-btn-pill ${activeTab === 'treino' ? 'active' : ''}`}
                            onClick={() => setActiveTab('treino')}
                        >
                            Plano de Treino
                        </button>
                        <button
                            className={`tab-btn-pill ${activeTab === 'nutricao' ? 'active' : ''}`}
                            onClick={() => setActiveTab('nutricao')}
                        >
                            Plano de Dieta
                        </button>
                    </div>

                    <div className="header-actions-group">
                        <button className="btn-primary" onClick={() => activeTab === 'treino' ? setShowTreinoModal(true) : setShowDietaModal(true)}>
                            <i className="fa-solid fa-plus"></i>
                            <span>{activeTab === 'treino' ? 'Novo Treino' : 'Nova Dieta'}</span>
                        </button>
                    </div>
                </div>
```

por:

```jsx
                <div className="column-header-flex plans-header-container">
                    <div className="tab-selector-wrapper" role="tablist" aria-label="Planos">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'treino'}
                            className={`tab-btn-pill ${activeTab === 'treino' ? 'active' : ''}`}
                            onClick={() => setActiveTab('treino')}
                        >
                            Plano de Treino
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'nutricao'}
                            className={`tab-btn-pill ${activeTab === 'nutricao' ? 'active' : ''}`}
                            onClick={() => setActiveTab('nutricao')}
                        >
                            Plano de Dieta
                        </button>
                    </div>

                    {/* No celular a criação vai para o Fab */}
                    {!isMobile && (
                        <div className="header-actions-group">
                            <button className="btn-primary" onClick={() => activeTab === 'treino' ? setShowTreinoModal(true) : setShowDietaModal(true)}>
                                <i className="fa-solid fa-plus"></i>
                                <span>{activeTab === 'treino' ? 'Novo Treino' : 'Nova Dieta'}</span>
                            </button>
                        </div>
                    )}
                </div>
```

3. Trocar a abertura `<main className="ritmo-content-area" style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>` por:

```jsx
                <section className="ritmo-content-area" style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
```

e o fechamento `                </main>` por:

```jsx
                </section>
```

4. Trocar (as duas ocorrências; use `replace_all`) `<div className="plans-horizontal-selector">` por:

```jsx
<div className="plans-horizontal-selector" data-offscreen-ok>
```

5. Trocar as ações do mini-card de treino:

```jsx
                                                {!t.ativo && (
                                                    <button title="Ativar" onClick={() => handleAtivarTreino(t.id)}><i className="fa-solid fa-play"></i></button>
                                                )}
                                                <button title="Editar" onClick={() => handleEditarTreino(t)}><i className="fa-solid fa-pen-to-square"></i></button>
                                                <button title="Excluir" onClick={() => handleExcluirTreino(t.id)} className="btn-del"><i className="fa-solid fa-trash"></i></button>
```

por:

```jsx
                                                {!t.ativo && (
                                                    <button type="button" title="Ativar" aria-label="Ativar" onClick={() => handleAtivarTreino(t.id)}><i className="fa-solid fa-play"></i></button>
                                                )}
                                                <button type="button" title="Editar" aria-label="Editar" onClick={() => handleEditarTreino(t)}><i className="fa-solid fa-pen-to-square"></i></button>
                                                <button type="button" title="Excluir" aria-label="Excluir" onClick={() => handleExcluirTreino(t.id)} className="btn-del"><i className="fa-solid fa-trash"></i></button>
```

6. Trocar as ações do mini-card de dieta:

```jsx
                                                {!dieta.ativo && (
                                                    <button title="Ativar" onClick={() => handleAtivarDieta(dieta.id)}><i className="fa-solid fa-play"></i></button>
                                                )}
                                                <button title="Editar" onClick={() => handleEditarDieta(dieta)}><i className="fa-solid fa-pen-to-square"></i></button>
                                                <button title="Excluir" onClick={() => handleExcluirDieta(dieta.id)} className="btn-del"><i className="fa-solid fa-trash"></i></button>
```

por:

```jsx
                                                {!dieta.ativo && (
                                                    <button type="button" title="Ativar" aria-label="Ativar" onClick={() => handleAtivarDieta(dieta.id)}><i className="fa-solid fa-play"></i></button>
                                                )}
                                                <button type="button" title="Editar" aria-label="Editar" onClick={() => handleEditarDieta(dieta)}><i className="fa-solid fa-pen-to-square"></i></button>
                                                <button type="button" title="Excluir" aria-label="Excluir" onClick={() => handleExcluirDieta(dieta.id)} className="btn-del"><i className="fa-solid fa-trash"></i></button>
```

7. Trocar o grupo muscular inline da tabela de treino:

```jsx
                                                                    <div className="alim-sub" style={{ fontSize: '0.65rem' }}>{ex.grupo_muscular}</div>
```

por:

```jsx
                                                                    <div className="alim-sub alim-grupo">{ex.grupo_muscular}</div>
```

8. Trocar `            <AiAssistant context="ritmo" />` por:

```jsx
            {isMobile && (
                <Fab
                    label={activeTab === 'treino' ? 'Novo treino' : 'Nova dieta'}
                    onClick={() => (activeTab === 'treino' ? setShowTreinoModal(true) : setShowDietaModal(true))}
                />
            )}
            <AiAssistant context="ritmo" />
```

- [ ] **Step 3: CSS das abas, biblioteca, cards e estado vazio**

Ao final de `bussola_web/src/pages/Ritmo/styles.css`, adicionar:

```css
/* Grupo muscular na tabela do treino (antes style inline; mesmo valor no desktop) */
.ritmo-scope .alim-sub.alim-grupo {
    font-size: 0.65rem;
}

/* ============================================= */
/* 12. CELULAR (≤768): ABAS, BIBLIOTECA E CARDS  */
/* ============================================= */
@media (max-width: 768px) {
    /* Abas: as pílulas atuais em largura total (o botão de criar vai para o Fab) */
    .ritmo-scope .plans-header-container {
        height: auto;
        flex-direction: row;
        padding: var(--sp-1);
    }

    .ritmo-scope .tab-selector-wrapper {
        width: 100%;
        margin-bottom: 0;
    }

    .ritmo-scope .tab-btn-pill {
        flex: 1 1 0;
        width: auto;
        min-width: 0;
        min-height: var(--tap-min);
        padding: 0 var(--sp-2);
        font-size: 0.75rem;
        letter-spacing: 0.02em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Biblioteca: faixa com scroll-snap dos mini-cards atuais */
    .ritmo-scope .diet-selection-section {
        margin-bottom: var(--sp-4);
        padding: var(--sp-3);
    }

    .ritmo-scope .section-subtitle {
        margin-bottom: var(--sp-2);
    }

    .ritmo-scope .plans-horizontal-selector {
        gap: var(--sp-3);
        padding: var(--sp-1) 0 var(--sp-2);
        scroll-snap-type: x mandatory;
        overscroll-behavior-x: contain;
    }

    .ritmo-scope .plan-mini-card {
        flex: 0 0 min(320px, calc(100% - var(--sp-6)));
        min-width: 0;
        gap: var(--sp-2);
        scroll-snap-align: start;
    }

    .ritmo-scope .plan-mini-card:only-child {
        flex-basis: 100%;
    }

    .ritmo-scope .plan-info {
        flex: 1 1 auto;
        min-width: 0;
    }

    .ritmo-scope .plan-name {
        font-size: 0.9375rem;
        overflow-wrap: anywhere;
    }

    .ritmo-scope .plan-cal {
        font-size: 0.8125rem;
    }

    .ritmo-scope .plan-actions {
        gap: var(--sp-1);
        flex-shrink: 0;
    }

    .ritmo-scope .plan-actions button {
        width: var(--tap-min);
        height: var(--tap-min);
        border-radius: 10px;
        font-size: 0.875rem;
    }

    /* Cards de treino/refeição: mesmo design, células mais justas */
    .ritmo-scope .dieta-grid-custom {
        gap: var(--sp-3);
    }

    .ritmo-scope .refeicao-pro-header {
        padding: var(--sp-3) var(--sp-4);
        gap: var(--sp-2);
    }

    .ritmo-scope .alimentos-table-wrapper {
        padding: var(--sp-1) 0;
    }

    .ritmo-scope .alimentos-table th {
        font-size: 0.6875rem;
        padding: var(--sp-2) var(--sp-1);
    }

    .ritmo-scope .alimentos-table td {
        font-size: 0.875rem;
        padding: var(--sp-2) var(--sp-1);
    }

    .ritmo-scope .alimentos-table th:first-child,
    .ritmo-scope .alimentos-table td:first-child {
        padding-left: var(--sp-3);
    }

    .ritmo-scope .alimentos-table th:last-child,
    .ritmo-scope .alimentos-table td:last-child {
        padding-right: var(--sp-3);
    }

    .ritmo-scope .alim-name-td {
        overflow-wrap: anywhere;
    }

    .ritmo-scope .alim-sub.alim-grupo {
        font-size: 0.75rem;
    }

    .ritmo-scope .refeicao-pro-footer {
        justify-content: center;
        padding: var(--sp-3) var(--sp-4);
    }

    .ritmo-scope .macro-summary-pill {
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--sp-1) var(--sp-3);
        padding: var(--sp-1) var(--sp-3);
    }

    /* Estado vazio: sem os 5rem de padding */
    .ritmo-scope .empty-state {
        padding: var(--sp-6) var(--sp-4);
        border-radius: 16px;
    }

    .ritmo-scope .empty-state p {
        margin: var(--sp-3) 0 0;
        font-size: 0.875rem;
    }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs` → Expected: tudo passa (Tasks 1–3).
Run: `npm run e2e -- --project=mobile e2e/modais-reais.mobile.spec.mjs` → Expected: passa (o Fab "Novo treino" casa com `name: 'Novo Treino'`).
Run: `npm run e2e -- --project=desktop e2e/ritmo.desktop.spec.mjs e2e/desktop-visual.desktop.spec.mjs` → Expected: tudo passa (`ritmo.png`, `ritmo-dieta.png` e `modal-treino.png` idênticos: `role`/`aria-*`/`type`/`data-*` e `<section>` não mudam pixels).
Run: `npx eslint src/pages/Ritmo` → Expected: 1 erro (pré-existente, `BioModal.jsx`), 2 warnings. Run: `npm run build` → OK.

- [ ] **Step 5: Commit**

```bash
git add bussola_web/src/pages/Ritmo bussola_web/e2e/ritmo.mobile.spec.mjs
git commit -m "feat(web): Ritmo no celular - abas, biblioteca com scroll-snap, cards compactos e Fab" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Builder de treino em tela cheia com exercício em bloco empilhado

**Files:**
- Modify: `bussola_web/src/pages/Ritmo/components/TreinoModal.jsx`, `bussola_web/src/pages/Ritmo/styles.css`, `bussola_web/e2e/ritmo.mobile.spec.mjs`

**Interfaces:**
- Consumes: `BaseModal sheet="full"`, `CustomSelect` (sheet no mobile), `teclado`, `limparE2E`.
- Produces (classes compartilhadas com a Task 5): `.rb-head`, `.rb-title`, `.rb-name-group`, `.day-block`, `.rb-day-head`, `.rb-day-name`, `.rb-icon-btn`, `.rb-ex-row` (`.rb-f-nome`, `.rb-f-grupo`, `.rb-f-sets`, `.rb-f-min`, `.rb-f-max`), `.rb-label`, `.rb-remove`, `.rb-add-btn`, `.rb-add-day`, `.rb-cancel`; regras ≤768 de cabeçalho/corpo/rodapé dos sheets do Ritmo (`.ritmo-scope .modal-overlay.is-sheet …`) usadas também pelo `BioModal` (Task 6).

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/ritmo.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 4 — builder de treino
// ---------------------------------------------------------------------------
test.describe('builder de treino', () => {
  for (const w of [360, 430]) {
    test(`sheet cheio em ${w}px: exercício em bloco empilhado, sem overflow, alvos de 44px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      await gotoApp(page, '/ritmo');
      await page.getByRole('button', { name: 'Novo treino' }).click();
      const sheet = page.locator('.modal-overlay.is-sheet-full');
      await expect(sheet).toBeVisible();
      await sheet.getByRole('button', { name: '+ Add Exercício' }).click();
      const row = sheet.locator('.rb-ex-row').first();
      const r = await row.boundingBox();
      const [nome, grupo, sets, min, max, rm] = await Promise.all(
        ['.rb-f-nome', '.rb-f-grupo', '.rb-f-sets', '.rb-f-min', '.rb-f-max', '.rb-remove'].map((s) => row.locator(s).boundingBox()));
      expect(Math.abs(nome.width - r.width)).toBeLessThan(2);   // nome em largura total
      expect(Math.abs(grupo.width - r.width)).toBeLessThan(2);  // grupo em largura total
      expect(grupo.y).toBeGreaterThanOrEqual(nome.y + nome.height - 1);
      expect(sets.y).toBeGreaterThanOrEqual(grupo.y + grupo.height - 1);
      for (const b of [min, max]) expect(Math.abs(b.y - sets.y)).toBeLessThan(2); // linha numérica
      expect(rm.width).toBeGreaterThanOrEqual(44);
      expect(rm.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs((rm.y + rm.height) - (sets.y + sets.height))).toBeLessThan(2);
      for (const f of ['.rb-f-sets', '.rb-f-min', '.rb-f-max']) {
        await expect(row.locator(`${f} input`)).toHaveAttribute('inputmode', 'numeric');
      }
      expect(await overflowOffenders(page)).toEqual([]);
      expect(await smallTargets(page, '.modal-overlay.is-sheet-full')).toEqual([]);
      expect(await textosPequenos(page, '.modal-overlay.is-sheet-full')).toEqual([]);
    });
  }

  test('builder de treino: Salvar visível com o teclado aberto e corpo rolando', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await teclado(page);
    await page.getByRole('button', { name: 'Novo treino' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet-full');
    for (let i = 0; i < 3; i += 1) await sheet.getByRole('button', { name: '+ Add Exercício' }).click();
    const salvar = sheet.getByRole('button', { name: 'Salvar Plano' });
    await expect(salvar).toBeVisible();
    await expect.poll(async () => { const b = await salvar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
    await sheet.locator('.modal-body').evaluate((b) => b.scrollTo(0, 99999));
    const addDia = await sheet.getByRole('button', { name: 'Adicionar Dia' }).boundingBox();
    expect(addDia.y + addDia.height).toBeLessThanOrEqual((await salvar.boundingBox()).y);
  });

  test('Novo treino pelo Fab: cria com grupo no sheet, ativa e exclui', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoApp(page, '/ritmo');
    await page.getByRole('button', { name: 'Novo treino' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet-full');
    await expect(sheet.locator('h2')).toHaveText('Configurar Treino');
    await sheet.locator('input[placeholder="Ex: Push Pull Legs"]').fill('E2E Treino');
    await sheet.getByRole('button', { name: '+ Add Exercício' }).click();
    const row = sheet.locator('.rb-ex-row').first();
    await row.locator('.rb-f-nome input').fill('E2E Supino');
    await row.locator('.rb-f-grupo .custom-select-trigger').click();
    await page.locator('.cs-sheet-list .custom-option', { hasText: /^Peito$/ }).click();
    await expect(row.locator('.rb-f-grupo .custom-select-trigger')).toContainText('Peito');
    await row.locator('.rb-f-sets input').fill('4');
    await sheet.getByRole('button', { name: 'Salvar Plano' }).click();
    await expect(page.getByText('Plano salvo.')).toBeVisible();

    const card = page.locator('.plan-mini-card', { hasText: 'E2E Treino' });
    await expect(card).toHaveClass(/active/);
    const dia = page.locator('.refeicao-card-pro', { hasText: 'E2E Supino' });
    await expect(dia).toContainText('Peito');
    await expect(dia.locator('.ref-total-badge')).toHaveText('4 séries');

    const original = page.locator('.plan-mini-card', { hasText: 'Hipertrofia ABC 2025' });
    await original.getByRole('button', { name: 'Ativar' }).click();
    await expect(original).toHaveClass(/active/);
    await card.getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Sim, Excluir' }).click();
    await expect(card).toHaveCount(0);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs -g "builder de treino"`
Expected: FAIL — o sheet não é `is-sheet-full`, não há `.rb-ex-row` (grid inline de 6 colunas), `inputmode` ausente, remover de ~30px, fechar de ~24px, rótulos de 9,6px.

- [ ] **Step 2: Reescrever `TreinoModal.jsx` (mesma lógica; grid e estilos de linha em classes)**

Substituir o conteúdo de `bussola_web/src/pages/Ritmo/components/TreinoModal.jsx` por:

```jsx
import React, { useState, useEffect } from 'react';
import { createPlanoTreino, updatePlanoTreino } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { CustomSelect } from '../../../components/CustomSelect';
import { BaseModal } from '../../../components/BaseModal';

const GRUPOS_MUSCULARES = ["Peito", "Costas", "Quadríceps", "Posterior", "Glúteos", "Panturrilhas", "Ombros", "Bíceps", "Tríceps", "Antebraço", "Abdominais", "Outros"];

export function TreinoModal({ onClose, onSuccess, initialData }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [nomePlano, setNomePlano] = useState('');
    const [dias, setDias] = useState([{ nome: 'Treino A', exercicios: [] }]);
    const groupOptions = GRUPOS_MUSCULARES.map(g => ({ value: g, label: g }));

    useEffect(() => {
        if (initialData) {
            setNomePlano(initialData.nome);
            if (initialData.dias && initialData.dias.length > 0) {
                setDias(JSON.parse(JSON.stringify(initialData.dias)));
            } else { setDias([{ nome: 'Treino A', exercicios: [] }]); }
        } else { setNomePlano(''); setDias([{ nome: 'Treino A', exercicios: [] }]); }
    }, [initialData]);

    const addDia = () => setDias(prev => [...prev, { nome: `Treino ${String.fromCharCode(65 + prev.length)}`, exercicios: [] }]);
    const removeDia = (index) => setDias(prev => prev.filter((_, i) => i !== index));
    const handleDiaChange = (index, value) => setDias(prevDias => prevDias.map((dia, i) => i === index ? { ...dia, nome: value } : dia));
    const addExercicio = (diaIndex) => setDias(prevDias => prevDias.map((dia, i) => i !== diaIndex ? dia : { ...dia, exercicios: [...dia.exercicios, { nome_exercicio: '', series: 3, repeticoes_min: 8, repeticoes_max: 12, grupo_muscular: 'Outros' }] }));
    const removeExercicio = (diaIndex, exIndex) => setDias(prevDias => prevDias.map((dia, i) => i !== diaIndex ? dia : { ...dia, exercicios: dia.exercicios.filter((_, j) => j !== exIndex) }));

    const handleExercicioChange = (diaIndex, exIndex, field, value) => {
        setDias(prevDias => prevDias.map((dia, i) => {
            if (i !== diaIndex) return dia;
            const newExercicios = dia.exercicios.map((ex, j) => j !== exIndex ? ex : { ...ex, [field]: value });
            return { ...dia, exercicios: newExercicios };
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = {
                nome: nomePlano, ativo: initialData ? initialData.ativo : true,
                dias: dias.map((dia, idx) => ({
                    nome: dia.nome, ordem: idx,
                    exercicios: dia.exercicios.map(ex => ({
                        nome_exercicio: ex.nome_exercicio, api_id: ex.api_id, grupo_muscular: ex.grupo_muscular,
                        series: parseInt(ex.series) || 0, repeticoes_min: parseInt(ex.repeticoes_min) || 0,
                        repeticoes_max: parseInt(ex.repeticoes_max) || 0, descanso_segundos: ex.descanso_segundos, observacao: ex.observacao
                    }))
                }))
            };
            if (initialData && initialData.id) await updatePlanoTreino(initialData.id, payload); else await createPlanoTreino(payload);
            addToast({ type: 'success', title: 'Sucesso', description: 'Plano salvo.' });
            onSuccess(); onClose();
        } catch { addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar.' }); } finally { setLoading(false); }
    };

    return (
        <BaseModal onClose={onClose} className="ritmo-scope" sheet="full">
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '95%' }}>
                <div className="modal-header">
                    <div className="rb-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <h2 className="rb-title" style={{ margin: 0, fontSize: '1.2rem' }}>{initialData ? `Editar: ${initialData.nome}` : 'Configurar Treino'}</h2>
                        <button type="button" className="close-btn" aria-label="Fechar" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-secundario)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group rb-name-group">
                            <label>Nome do Plano</label>
                            <input className="form-input" type="text" value={nomePlano} onChange={e => setNomePlano(e.target.value)} placeholder="Ex: Push Pull Legs" required />
                        </div>
                        <div className="days-container">
                            {dias.map((dia, dIndex) => (
                                <div key={dIndex} className="day-block">
                                    <div className="rb-day-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <input className="form-input rb-day-name" style={{ fontWeight: 'bold', color: 'var(--cor-azul-primario)', background: 'transparent', border: 'none', fontSize: '1rem', width: 'auto' }} type="text" value={dia.nome} onChange={(e) => handleDiaChange(dIndex, e.target.value)} />
                                        {dias.length > 1 && (<button type="button" className="rb-icon-btn" aria-label="Remover dia" onClick={() => removeDia(dIndex)} style={{ background: 'none', border: 'none', color: 'var(--cor-vermelho-delete)', cursor: 'pointer' }}><i className="fa-solid fa-trash-can"></i></button>)}
                                    </div>
                                    {dia.exercicios.map((ex, eIndex) => (
                                        // Desktop: 6 colunas (mesmos valores do antigo style inline). Celular: nome, grupo e linha numérica.
                                        <div key={eIndex} className="rb-ex-row">
                                            <div className="form-group rb-f-nome"><label className="rb-label">Exercício</label><input className="form-input" type="text" value={ex.nome_exercicio} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'nome_exercicio', e.target.value)} required autoComplete="off" placeholder="Nome do exercício" /></div>
                                            <div className="form-group rb-f-grupo"><CustomSelect label="Grupo" name="grupo_muscular" value={ex.grupo_muscular} options={groupOptions} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'grupo_muscular', e.target.value)} placeholder="Selecione..." /></div>
                                            <div className="form-group rb-f-sets"><label className="rb-label">Sets</label><input className="form-input" type="number" inputMode="numeric" value={ex.series} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'series', e.target.value)} /></div>
                                            <div className="form-group rb-f-min"><label className="rb-label">Min</label><input className="form-input" type="number" inputMode="numeric" value={ex.repeticoes_min} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'repeticoes_min', e.target.value)} /></div>
                                            <div className="form-group rb-f-max"><label className="rb-label">Max</label><input className="form-input" type="number" inputMode="numeric" value={ex.repeticoes_max} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'repeticoes_max', e.target.value)} /></div>
                                            <button type="button" className="rb-remove" aria-label="Remover exercício" onClick={() => removeExercicio(dIndex, eIndex)}><i className="fa-solid fa-xmark"></i></button>
                                        </div>
                                    ))}
                                    <button type="button" className="rb-add-btn" onClick={() => addExercicio(dIndex)}>+ Add Exercício</button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="btn-secondary rb-add-day" onClick={addDia} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--cor-borda)', background: 'var(--cor-card-secundario)', cursor: 'pointer', color: 'var(--cor-texto-principal)' }}><i className="fa-solid fa-calendar-plus"></i> Adicionar Dia</button>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="rb-cancel" onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-secundario)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Plano'}</button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
}
```

O que mudou (e por que o desktop fica idêntico):
- `style` do `.day-block`, do nome do plano (`marginBottom`), da linha (`gridTemplateColumns`…), dos rótulos (`fontSize: 0.6rem`), dos inputs da linha (`padding: 0 5px`; o `height: 35px` saiu porque o `height: 48px !important` de `.ritmo-scope .form-input` já vencia o inline), do remover (`paddingBottom: 10px`) e do "+ Add Exercício" viraram classes com os mesmos valores (Step 3).
- Ficaram inline (o celular não precisa mudar e o CSS só **acrescenta** propriedades que o inline não declara): `modal-content` (o sheet sobrescreve com `!important`), cabeçalho, fechar, nome do dia, remover dia, "Adicionar Dia", "Cancelar".
- `type="button"` e `aria-label` nos botões de ícone; `inputMode="numeric"` em Sets/Min/Max; `sheet="full"`.

- [ ] **Step 3: CSS dos builders (classes do desktop + celular)**

Ao final de `bussola_web/src/pages/Ritmo/styles.css`, adicionar:

```css
/* ============================================= */
/* 13. BUILDERS (TreinoModal / DietaModal)       */
/* Desktop: os mesmos valores dos antigos        */
/* style={{}} inline (especificidade (0,3,0)     */
/* para vencer .ritmo-scope input[type=…]).      */
/* ============================================= */
.ritmo-scope .rb-name-group {
    margin-bottom: 1.5rem;
}

.ritmo-scope .day-block {
    margin-bottom: 1.5rem;
    background: var(--cor-card-secundario);
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid var(--cor-borda);
}

.ritmo-scope .rb-ex-row,
.ritmo-scope .rb-food-row {
    display: grid;
    gap: 8px;
    align-items: end;
    margin-bottom: 8px;
    position: relative;
}

.ritmo-scope .rb-ex-row {
    grid-template-columns: 1.5fr 1fr 0.6fr 0.6fr 0.6fr 30px;
}

.ritmo-scope .rb-food-row {
    grid-template-columns: 2fr 0.8fr 0.6fr 0.7fr 0.7fr 0.7fr 0.7fr 30px;
}

/* Só os rótulos próprios da linha (o label do CustomSelect não leva .rb-label) */
.ritmo-scope .rb-label {
    font-size: 0.6rem;
}

.ritmo-scope .rb-ex-row .form-input {
    padding: 0 5px;
}

.ritmo-scope .rb-food-row .form-input {
    font-size: 0.85rem;
}

.ritmo-scope .rb-remove {
    background: none;
    border: none;
    color: var(--cor-texto-secundario);
    cursor: pointer;
    padding-bottom: 10px;
}

.ritmo-scope .rb-food-row .rb-remove {
    padding-bottom: 8px;
}

.ritmo-scope .rb-add-btn {
    margin-top: 10px;
    font-size: 0.75rem;
    background: transparent;
    border: 1px dashed var(--cor-borda);
    color: var(--cor-texto-secundario);
    padding: 4px 12px;
    border-radius: 6px;
    cursor: pointer;
}

.ritmo-scope .rb-add-btn.is-food {
    font-size: 0.7rem;
    padding: 5px 12px;
}

@media (max-width: 768px) {
    /* Cabeçalho, corpo e rodapé dos sheets do Ritmo (builders e perfil) */
    .ritmo-scope .modal-overlay.is-sheet .modal-header,
    .ritmo-scope .modal-overlay.is-sheet .modal-header-flex {
        flex-shrink: 0;
        padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-4);
        border-radius: 0;
    }

    .ritmo-scope .modal-overlay.is-sheet .rb-head {
        gap: var(--sp-2);
    }

    .ritmo-scope .modal-overlay.is-sheet .rb-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .ritmo-scope .modal-overlay.is-sheet .close-btn,
    .ritmo-scope .modal-overlay.is-sheet .close-btn-styled {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }

    .ritmo-scope .modal-overlay.is-sheet .modal-body {
        padding: var(--sp-4);
        gap: var(--sp-4);
    }

    .ritmo-scope .modal-overlay.is-sheet .modal-footer {
        padding: var(--sp-3) var(--sp-4); /* o padding-bottom com safe-area vem do components.css */
        gap: var(--sp-2);
        border-radius: 0;
    }

    .ritmo-scope .modal-overlay.is-sheet .modal-footer > button {
        flex: 1 1 0;
        min-height: 48px;
    }

    .ritmo-scope .modal-overlay.is-sheet .form-group label {
        margin-bottom: 0; /* o gap de 8px do .form-group separa rótulo e campo */
    }

    /* Builders: blocos */
    .ritmo-scope .rb-name-group {
        margin-bottom: 0;
    }

    .ritmo-scope .day-block {
        padding: var(--sp-3);
        margin-bottom: var(--sp-3);
    }

    .ritmo-scope .day-block:last-child {
        margin-bottom: 0;
    }

    .ritmo-scope .rb-day-head {
        align-items: center;
        gap: var(--sp-2);
    }

    .ritmo-scope .rb-day-name {
        flex: 1 1 auto;
        min-width: 0;
    }

    .ritmo-scope .rb-icon-btn {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    /* Cada exercício/alimento vira um bloco: nome em cima, linha numérica embaixo */
    .ritmo-scope .rb-ex-row,
    .ritmo-scope .rb-food-row {
        gap: var(--sp-2);
        margin: 0;
        padding: var(--sp-3) 0;
        border-top: 1px solid var(--cor-borda);
    }

    .ritmo-scope .rb-ex-row {
        grid-template-columns: repeat(3, minmax(0, 1fr)) var(--tap-min);
        grid-template-areas:
            "nome nome nome nome"
            "grupo grupo grupo grupo"
            "sets min max rm";
    }

    .ritmo-scope .rb-f-nome { grid-area: nome; }
    .ritmo-scope .rb-f-grupo { grid-area: grupo; }
    .ritmo-scope .rb-f-sets { grid-area: sets; }
    .ritmo-scope .rb-f-min { grid-area: min; }
    .ritmo-scope .rb-f-max { grid-area: max; }

    .ritmo-scope .rb-label,
    .ritmo-scope .rb-ex-row .custom-select-label {
        font-size: 0.75rem;
    }

    .ritmo-scope .rb-ex-row .form-input,
    .ritmo-scope .rb-food-row .form-input {
        padding: 0 var(--sp-2);
    }

    .ritmo-scope .rb-remove,
    .ritmo-scope .rb-food-row .rb-remove {
        grid-area: rm;
        align-self: end;
        width: var(--tap-min);
        height: var(--tap-min);
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        font-size: 1rem;
    }

    .ritmo-scope .rb-add-btn,
    .ritmo-scope .rb-add-btn.is-food {
        width: 100%;
        min-height: var(--tap-min);
        margin-top: var(--sp-2);
        padding: 0 var(--sp-3);
        font-size: 0.875rem;
        border-radius: 10px;
    }

    .ritmo-scope .rb-add-day {
        min-height: var(--tap-min);
    }
}
```

(`.rb-food-row` e as áreas dela entram na Task 5; aqui só a base compartilhada.)

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs` → Expected: tudo passa (Tasks 1–4).
Run: `npm run e2e -- --project=mobile e2e/modais-reais.mobile.spec.mjs e2e/ui-lab.mobile.spec.mjs` → Expected: passam.
Run: `npm run e2e -- --project=desktop e2e/ritmo.desktop.spec.mjs e2e/desktop-visual.desktop.spec.mjs` → Expected: tudo passa, **em especial `modal-treino.png` e `modal-treino-editar.png`**. Se algum diferir, abra o diff em `test-results/` e compare o elemento: quase sempre é uma propriedade que o inline declarava e a classe perdeu por especificidade (confira com DevTools › Computed no desktop antes/depois); corrija a classe, nunca regenere a base.
Run: `npx eslint src/pages/Ritmo` → Expected: sem erro novo. Run: `npm run build` → OK.

- [ ] **Step 5: Commit**

```bash
git add bussola_web/src/pages/Ritmo bussola_web/e2e/ritmo.mobile.spec.mjs
git commit -m "feat(web): builder de treino em tela cheia no celular, exercicio em bloco empilhado" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Builder de dieta em tela cheia com alimento em bloco e busca ancorada no nome

**Files:**
- Modify: `bussola_web/src/pages/Ritmo/components/DietaModal.jsx`, `bussola_web/src/pages/Ritmo/styles.css`, `bussola_web/e2e/ritmo.mobile.spec.mjs`

**Interfaces:**
- Consumes: classes da Task 4 (`.day-block`, `.rb-*`, `.rb-food-row` base), `FOODS`, `teclado`.
- Produces: `.rb-food-row` com `.rb-f-nome`, `.rb-f-qtd`, `.rb-f-un`, `.rb-f-kcal`, `.rb-f-p`, `.rb-f-c`, `.rb-f-g`, `.rb-remove`; `.rb-add-btn.is-food`. No celular o dropdown `.search-results-dropdown` ancora em `.rb-f-nome` (`position: relative` só ≤768); no desktop continua ancorado na linha.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/ritmo.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 5 — builder de dieta
// ---------------------------------------------------------------------------
test.describe('builder de dieta', () => {
  const abrirNovaDieta = async (page) => {
    await gotoApp(page, '/ritmo');
    await abrirAba(page, 'Plano de Dieta');
    await page.getByRole('button', { name: 'Nova dieta' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet-full');
    await expect(sheet).toBeVisible();
    return sheet;
  };

  for (const w of [360, 430]) {
    test(`sheet cheio em ${w}px: alimento em bloco (nome / Qtd+Un / Kcal P C G), sem overflow, alvos de 44px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      const sheet = await abrirNovaDieta(page);
      await sheet.getByRole('button', { name: '+ Add Alimento' }).click();
      const row = sheet.locator('.rb-food-row').first();
      const r = await row.boundingBox();
      const [nome, qtd, un, kcal, p, c, g, rm] = await Promise.all(
        ['.rb-f-nome', '.rb-f-qtd', '.rb-f-un', '.rb-f-kcal', '.rb-f-p', '.rb-f-c', '.rb-f-g', '.rb-remove'].map((s) => row.locator(s).boundingBox()));
      expect(Math.abs(nome.width - r.width)).toBeLessThan(2);
      expect(qtd.y).toBeGreaterThanOrEqual(nome.y + nome.height - 1);
      expect(Math.abs(un.y - qtd.y)).toBeLessThan(2);
      expect(kcal.y).toBeGreaterThanOrEqual(qtd.y + qtd.height - 1);
      for (const b of [p, c, g]) expect(Math.abs(b.y - kcal.y)).toBeLessThan(2);
      expect(rm.width).toBeGreaterThanOrEqual(44);
      expect(rm.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs((rm.y + rm.height) - (kcal.y + kcal.height))).toBeLessThan(2);
      await expect(row.locator('.rb-f-qtd input')).toHaveAttribute('inputmode', 'decimal');
      for (const f of ['.rb-f-kcal', '.rb-f-p', '.rb-f-c', '.rb-f-g']) {
        await expect(row.locator(`${f} input`)).toHaveAttribute('inputmode', 'numeric');
        expect((await row.locator(`${f} input`).boundingBox()).width).toBeGreaterThanOrEqual(48);
      }
      expect(await overflowOffenders(page)).toEqual([]);
      expect(await smallTargets(page, '.modal-overlay.is-sheet-full')).toEqual([]);
      expect(await textosPequenos(page, '.modal-overlay.is-sheet-full')).toEqual([]);
    });
  }

  test('builder de dieta: Salvar visível com o teclado aberto', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await abrirAba(page, 'Plano de Dieta');
    await teclado(page);
    await page.getByRole('button', { name: 'Nova dieta' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet-full');
    for (let i = 0; i < 3; i += 1) await sheet.getByRole('button', { name: '+ Add Alimento' }).click();
    const salvar = sheet.getByRole('button', { name: 'Salvar Dieta' });
    await expect(salvar).toBeVisible();
    await expect.poll(async () => { const b = await salvar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
  });

  test('Nova dieta pelo Fab: busca abaixo do nome, item travado, macros recalculados, salva e exclui', async ({ page }) => {
    await page.route('**/ritmo/local/foods**', (r) => r.fulfill({ json: FOODS }));
    await page.setViewportSize({ width: 360, height: 780 });
    const sheet = await abrirNovaDieta(page);
    await expect(sheet.locator('h2')).toHaveText('Configurar Dieta');
    await sheet.locator('input[placeholder="Ex: Cutting 2025"]').fill('E2E Dieta');
    await sheet.getByRole('button', { name: '+ Add Alimento' }).click();
    const row = sheet.locator('.rb-food-row').first();
    const nomeInput = row.locator('.rb-f-nome input');
    await nomeInput.fill('arroz');

    const dropdown = row.locator('.search-results-dropdown');
    await expect(dropdown).toContainText('Arroz, tipo 1, cozido');
    const nb = await nomeInput.boundingBox();
    const db = await dropdown.boundingBox();
    expect(Math.abs(db.y - (nb.y + nb.height))).toBeLessThan(2); // logo abaixo do campo de nome
    expect(Math.abs(db.width - nb.width)).toBeLessThan(2);       // na largura dele
    expect(await textosPequenos(page, '.search-results-dropdown')).toEqual([]);

    await dropdown.getByText('Arroz, tipo 1, cozido').click();
    await expect(dropdown).toHaveCount(0);
    await expect(nomeInput).toHaveValue('Arroz, tipo 1, cozido');
    const kcal = row.locator('.rb-f-kcal input');
    await expect(kcal).toHaveValue('128');
    await expect(kcal).toHaveJSProperty('readOnly', true);
    await expect(row.locator('.rb-f-un input')).toHaveValue('g');
    await row.locator('.rb-f-qtd input').fill('150');
    await expect(kcal).toHaveValue('192');
    await expect(row.locator('.rb-f-p input')).toHaveValue('4');
    await expect(row.locator('.rb-f-c input')).toHaveValue('42');
    expect(await overflowOffenders(page)).toEqual([]);

    await sheet.getByRole('button', { name: 'Salvar Dieta' }).click();
    await expect(page.getByText('Plano salvo.')).toBeVisible();
    const card = page.locator('.plan-mini-card', { hasText: 'E2E Dieta' });
    await expect(card).toHaveClass(/active/);
    const refeicao = page.locator('.refeicao-card-pro', { hasText: 'Arroz, tipo 1, cozido' });
    await expect(refeicao.locator('.ref-total-badge')).toHaveText('192 kcal');

    const original = page.locator('.plan-mini-card', { hasText: 'Bulking Limpo' });
    await original.getByRole('button', { name: 'Ativar' }).click();
    await expect(original).toHaveClass(/active/);
    await card.getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Sim, Excluir' }).click();
    await expect(card).toHaveCount(0);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs -g "builder de dieta"`
Expected: FAIL — sheet não cheio, grid inline de 8 colunas (inputs de ~30px, overflow), sem `inputmode`, dropdown ancorado na linha, textos de 11,5px no dropdown.

- [ ] **Step 2: Reescrever `DietaModal.jsx` (mesma lógica; grid e estilos de linha em classes)**

Substituir o conteúdo de `bussola_web/src/pages/Ritmo/components/DietaModal.jsx` por:

```jsx
import React, { useState, useEffect } from 'react';
import { createDieta, updateDieta, searchLocalFoods } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { logger } from '../../../utils/logger';
import { CustomSelect } from '../../../components/CustomSelect';
import { BaseModal } from '../../../components/BaseModal';

export function DietaModal({ onClose, onSuccess, initialData }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [nomeDieta, setNomeDieta] = useState('');
    const [refeicoes, setRefeicoes] = useState([{ nome: 'Café da Manhã', alimentos: [] }]);
    const unitOptions = [{ value: 'g', label: 'g' }, { value: 'ml', label: 'ml' }, { value: 'un', label: 'un' }];
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [activeSearch, setActiveSearch] = useState(null);

    useEffect(() => {
        if (initialData) {
            setNomeDieta(initialData.nome);
            const refeicoesEdit = initialData.refeicoes.map(ref => ({
                ...ref,
                alimentos: ref.alimentos.map(ali => ({
                    ...ali,
                    base_kcal: 0, base_prot: 0, base_carb: 0, base_gord: 0,
                    isTacoItem: false,
                }))
            }));
            setRefeicoes(refeicoesEdit);
        }
    }, [initialData]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setSearching(true);
                try {
                    const data = await searchLocalFoods(searchQuery);
                    setSearchResults(data);
                } catch { logger.error("Erro na busca de alimentos"); } finally { setSearching(false); }
            } else { setSearchResults([]); setSearching(false); }
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const arredondar = (valor) => Math.round(valor || 0);
    const calcularMacro = (valorBase100, qtd) => (!valorBase100 ? 0 : arredondar((valorBase100 / 100) * qtd));

    const handleSelectFood = (food, rIndex, aIndex) => {
        const newRef = [...refeicoes];
        newRef[rIndex].alimentos[aIndex] = {
            ...newRef[rIndex].alimentos[aIndex],
            nome: food.nome,
            unidade: 'g',
            base_kcal: food.calorias_100g, base_prot: food.proteina_100g, base_carb: food.carbo_100g, base_gord: food.gordura_100g,
            quantidade: 100, calorias: arredondar(food.calorias_100g), proteina: arredondar(food.proteina_100g),
            carbo: arredondar(food.carbo_100g), gordura: arredondar(food.gordura_100g),
            isTacoItem: true,
        };
        setRefeicoes(newRef); setSearchResults([]); setActiveSearch(null);
    };

    const handleSelectCustom = (rIndex, aIndex) => {
        const newRef = [...refeicoes];
        newRef[rIndex].alimentos[aIndex] = {
            ...newRef[rIndex].alimentos[aIndex],
            nome: searchQuery,
            base_kcal: 0, base_prot: 0, base_carb: 0, base_gord: 0,
            calorias: 0, proteina: 0, carbo: 0, gordura: 0,
            isTacoItem: false,
        };
        setRefeicoes(newRef); setSearchResults([]); setActiveSearch(null);
    };

    const addRefeicao = () => setRefeicoes([...refeicoes, { nome: `Refeição ${refeicoes.length + 1}`, alimentos: [] }]);
    const removeRefeicao = (index) => { const newRef = [...refeicoes]; newRef.splice(index, 1); setRefeicoes(newRef); };
    const handleRefeicaoChange = (index, field, value) => { const newRef = [...refeicoes]; newRef[index][field] = value; setRefeicoes(newRef); };
    const addAlimento = (refIndex) => { const newRef = [...refeicoes]; newRef[refIndex].alimentos.push({ nome: '', quantidade: 100, unidade: 'g', calorias: 0, proteina: 0, carbo: 0, gordura: 0, base_kcal: 0, base_prot: 0, base_carb: 0, base_gord: 0, isTacoItem: false }); setRefeicoes(newRef); };
    const removeAlimento = (refIndex, aliIndex) => { const newRef = [...refeicoes]; newRef[refIndex].alimentos.splice(aliIndex, 1); setRefeicoes(newRef); };

    const handleAlimentoChange = (refIndex, aliIndex, field, value) => {
        const newRef = [...refeicoes];
        const alimento = newRef[refIndex].alimentos[aliIndex];
        alimento[field] = value;
        if (field === 'quantidade' && alimento.isTacoItem) {
            const qtd = parseFloat(value) || 0;
            alimento.calorias = calcularMacro(alimento.base_kcal, qtd);
            alimento.proteina = calcularMacro(alimento.base_prot, qtd);
            alimento.carbo = calcularMacro(alimento.base_carb, qtd);
            alimento.gordura = calcularMacro(alimento.base_gord, qtd);
        }
        setRefeicoes(newRef);
        if (field === 'nome') { setSearchQuery(value); setActiveSearch({ rIndex: refIndex, aIndex: aliIndex }); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = {
                nome: nomeDieta, ativo: initialData ? initialData.ativo : true,
                refeicoes: refeicoes.map((ref, idx) => ({
                    nome: ref.nome, ordem: idx,
                    alimentos: ref.alimentos.map(ali => ({
                        nome: ali.nome, quantidade: parseFloat(ali.quantidade), unidade: ali.unidade,
                        calorias: arredondar(ali.calorias), proteina: arredondar(ali.proteina),
                        carbo: arredondar(ali.carbo), gordura: arredondar(ali.gordura)
                    }))
                }))
            };
            if (initialData && initialData.id) await updateDieta(initialData.id, payload); else await createDieta(payload);
            addToast({ type: 'success', title: 'Sucesso', description: 'Plano salvo.' });
            onSuccess(); onClose();
        } catch { addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar.' }); } finally { setLoading(false); }
    };

    return (
        <BaseModal onClose={onClose} className="ritmo-scope" sheet="full">
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%' }}>
                <div className="modal-header">
                    <div className="rb-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <h2 className="rb-title" style={{ margin: 0, fontSize: '1.2rem' }}>{initialData ? `Editar: ${initialData.nome}` : 'Configurar Dieta'}</h2>
                        <button type="button" className="close-btn" aria-label="Fechar" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-secundario)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group rb-name-group">
                            <label>Nome da Dieta</label>
                            <input className="form-input" type="text" value={nomeDieta} onChange={e => setNomeDieta(e.target.value)} placeholder="Ex: Cutting 2025" required />
                        </div>
                        <div className="refeicoes-container">
                            {refeicoes.map((ref, rIndex) => (
                                <div key={rIndex} className="day-block">
                                    <div className="rb-day-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', marginBottom: '1.2rem' }}>
                                        <input className="form-input rb-day-name" style={{ fontWeight: 'bold', color: 'var(--cor-azul-primario)', background: 'transparent', border: 'none', fontSize: '1.1rem', flex: 1, padding: 0 }} type="text" value={ref.nome} onChange={(e) => handleRefeicaoChange(rIndex, 'nome', e.target.value)} placeholder="Nome da Refeição" />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {refeicoes.length > 1 && (<button type="button" className="rb-icon-btn" aria-label="Remover refeição" onClick={() => removeRefeicao(rIndex)} style={{ background: 'none', border: 'none', color: 'var(--cor-vermelho-delete)', cursor: 'pointer', fontSize: '1.1rem' }}><i className="fa-solid fa-trash-can"></i></button>)}
                                        </div>
                                    </div>
                                    {ref.alimentos.map((ali, aIndex) => {
                                        const isLocked = ali.isTacoItem;
                                        const lockStyle = { opacity: isLocked ? 0.7 : 1 };
                                        return (
                                            // Desktop: 8 colunas (mesmos valores do antigo style inline). Celular: nome / Qtd+Un / Kcal P C G.
                                            <div key={aIndex} className="rb-food-row">
                                                <div className="form-group rb-f-nome">
                                                    <label className="rb-label">Alimento</label>
                                                    <input className="form-input" type="text" value={ali.nome} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'nome', e.target.value)} required autoComplete="off" />
                                                    {activeSearch?.rIndex === rIndex && activeSearch?.aIndex === aIndex && (searchQuery.length >= 2) && (
                                                        <div className="search-results-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--cor-card-principal)', border: '1px solid var(--cor-borda)', zIndex: 10, borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                                                            <div onClick={() => handleSelectCustom(rIndex, aIndex)} className="search-item-hover custom-option" style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '2px solid var(--cor-borda)', fontSize: '0.8rem', background: 'rgba(74, 109, 255, 0.05)' }}>
                                                                <div style={{ fontWeight: '700', color: 'var(--cor-azul-primario)' }}><i className="fa-solid fa-pen-to-square" style={{marginRight: '6px'}}></i> Usar "{searchQuery}" como personalizado</div>
                                                            </div>
                                                            {!searching && searchResults.map((food, fIdx) => (
                                                                <div key={fIdx} onClick={() => handleSelectFood(food, rIndex, aIndex)} className="search-item-hover" style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--cor-borda)', fontSize: '0.8rem', transition: 'background 0.2s' }}>
                                                                    <div style={{ fontWeight: '600', marginBottom: '2px' }}>{food.nome}</div>
                                                                    <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-secundario)', display: 'flex', gap: '10px' }}>
                                                                        <span>{arredondar(food.calorias_100g)} kcal</span>
                                                                        <span>P: {arredondar(food.proteina_100g)}g</span>
                                                                        <span>C: {arredondar(food.carbo_100g)}g</span>
                                                                        <span>G: {arredondar(food.gordura_100g)}g</span>
                                                                        <span style={{ color: 'var(--cor-borda)' }}>por 100g</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="form-group rb-f-qtd"><label className="rb-label">Qtd</label><input className="form-input" type="number" inputMode="decimal" value={ali.quantidade} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'quantidade', e.target.value)} /></div>
                                                <div className="form-group rb-f-un"><label className="rb-label">Un</label><div style={{ minWidth: 0 }}>{isLocked ? (<input className="form-input" style={{ opacity: 0.7 }} value="g" readOnly />) : (<CustomSelect name="unidade" value={ali.unidade} options={unitOptions} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'unidade', e.target.value)} placeholder="un" />)}</div></div>
                                                <div className="form-group rb-f-kcal"><label className="rb-label">Kcal</label><input className="form-input" style={lockStyle} type="number" inputMode="numeric" value={arredondar(ali.calorias)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'calorias', e.target.value)} readOnly={isLocked}/></div>
                                                <div className="form-group rb-f-p"><label className="rb-label">P</label><input className="form-input" style={lockStyle} type="number" inputMode="numeric" value={arredondar(ali.proteina)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'proteina', e.target.value)} readOnly={isLocked}/></div>
                                                <div className="form-group rb-f-c"><label className="rb-label">C</label><input className="form-input" style={lockStyle} type="number" inputMode="numeric" value={arredondar(ali.carbo)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'carbo', e.target.value)} readOnly={isLocked}/></div>
                                                <div className="form-group rb-f-g"><label className="rb-label">G</label><input className="form-input" style={lockStyle} type="number" inputMode="numeric" value={arredondar(ali.gordura)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'gordura', e.target.value)} readOnly={isLocked}/></div>
                                                <button type="button" className="rb-remove" aria-label="Remover alimento" onClick={() => removeAlimento(rIndex, aIndex)}><i className="fa-solid fa-xmark"></i></button>
                                            </div>
                                        );
                                    })}
                                    <button type="button" className="rb-add-btn is-food" onClick={() => addAlimento(rIndex)}>+ Add Alimento</button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="btn-secondary rb-add-day" onClick={addRefeicao} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--cor-borda)', background: 'var(--cor-card-secundario)', cursor: 'pointer', color: 'var(--cor-texto-principal)' }}><i className="fa-solid fa-utensils"></i> Add Refeição</button>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="rb-cancel" onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-secundario)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Dieta'}</button>
                    </div>
                </form>
            </div>
            <style>{`.search-item-hover:hover { background-color: var(--cor-fundo-hover) !important; } .custom-option:hover { background-color: rgba(74, 109, 255, 0.15) !important; }`}</style>
        </BaseModal>
    );
}
```

O que mudou: grid da linha, `position: relative` da linha, `.day-block`, `marginBottom` do nome, rótulos, `height`/`fontSize` dos inputs da linha (o `height: 35px` não valia; o `fontSize: 0.85rem` vai para `.ritmo-scope .rb-food-row .form-input`), `paddingBottom: 8px` do remover e o "+ Add Alimento" → classes da Task 4. A `opacity` dos campos travados continua inline. O dropdown da busca **continua inline** (desktop intocado); o celular só ajusta tamanho de texto/toque (Step 3).

- [ ] **Step 3: CSS do alimento empilhado e da busca no celular**

Ao final de `bussola_web/src/pages/Ritmo/styles.css`, adicionar:

```css
@media (max-width: 768px) {
    /* Alimento: nome / Qtd + Un / Kcal P C G + remover */
    .ritmo-scope .rb-food-row {
        grid-template-columns: repeat(4, minmax(0, 1fr)) var(--tap-min);
        grid-template-areas:
            "nome nome nome nome nome"
            "qtd qtd un un un"
            "kcal p c g rm";
    }

    .ritmo-scope .rb-f-qtd { grid-area: qtd; }
    .ritmo-scope .rb-f-un { grid-area: un; }
    .ritmo-scope .rb-f-kcal { grid-area: kcal; }
    .ritmo-scope .rb-f-p { grid-area: p; }
    .ritmo-scope .rb-f-c { grid-area: c; }
    .ritmo-scope .rb-f-g { grid-area: g; }

    /* A busca abre logo abaixo do campo de nome (no desktop ancora na linha) */
    .ritmo-scope .rb-food-row .rb-f-nome {
        position: relative;
    }

    /* Resultados da busca: estilos inline no desktop; aqui só texto ≥ 12px e toque.
       !important porque o inline é mantido para não mexer no desktop. */
    .ritmo-scope .rb-food-row .search-item-hover {
        padding: var(--sp-3) !important;
        font-size: 0.875rem !important;
    }

    .ritmo-scope .rb-food-row .search-item-hover > div + div {
        font-size: 0.75rem !important;
        flex-wrap: wrap;
        row-gap: var(--sp-1);
    }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs` → Expected: tudo passa (Tasks 1–5).
Run: `npm run e2e -- --project=desktop e2e/ritmo.desktop.spec.mjs e2e/desktop-visual.desktop.spec.mjs` → Expected: tudo passa, **em especial `modal-dieta-editar.png` e `modal-dieta-busca.png`** (mesma regra da Task 4 se algo diferir: corrigir a classe, nunca regenerar).
Run: `npx eslint src/pages/Ritmo` → Expected: sem erro novo. Run: `npm run build` → OK.

- [ ] **Step 5: Commit**

```bash
git add bussola_web/src/pages/Ritmo bussola_web/e2e/ritmo.mobile.spec.mjs
git commit -m "feat(web): builder de dieta em tela cheia no celular, alimento em bloco e busca ancorada no nome" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: BioModal em coluna única, regra do "Sugerido" visível e `inputMode`

**Files:**
- Modify: `bussola_web/src/pages/Ritmo/components/BioModal.jsx`, `bussola_web/src/pages/Ritmo/styles.css`, `bussola_web/e2e/ritmo.mobile.spec.mjs`, `bussola_web/e2e/ritmo.desktop.spec.mjs`

**Interfaces:**
- Consumes: regras de sheet do Ritmo (Task 4: cabeçalho/fechar 44px, rodapé 48px, `label` sem margem), `teclado`.
- Produces: `small.meta-hint` ("Regra: …") por campo de meta, oculto com mouse (`hover: hover` e >768) e visível em `(hover: none), (max-width: 768px)`; `.suggestion-badge[role="button"][tabindex="0"]` (Enter/Espaço aplicam a sugestão); `inputMode="decimal"` em peso, altura, BF e metas, `numeric` em idade; tooltip `::after/::before` desligado no toque.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/ritmo.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 6 — perfil (BioModal). Nunca salvar: o POST /bio muda a base do desktop.
// ---------------------------------------------------------------------------
test.describe('perfil', () => {
  test('perfil: coluna única, regra do Sugerido visível, toque aplica a sugestão, inputMode', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoApp(page, '/ritmo');
    await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet').first();
    await expect(sheet.locator('.modal-title')).toHaveText('Perfil Biológico & Metas');
    const colunas = (loc) => loc.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    expect(await colunas(sheet.locator('.bio-modal-grid'))).toBe(1);
    for (const g of await sheet.locator('.form-grid.two-cols').all()) expect(await colunas(g)).toBe(1);

    for (const n of ['peso', 'altura', 'bf_estimado', 'gasto_calorico_total', 'meta_proteina', 'meta_carbo', 'meta_gordura', 'meta_agua']) {
      await expect(sheet.locator(`input[name="${n}"]`)).toHaveAttribute('inputmode', 'decimal');
    }
    await expect(sheet.locator('input[name="idade"]')).toHaveAttribute('inputmode', 'numeric');

    const regras = sheet.locator('.meta-hint');
    await expect(regras).toHaveCount(5);
    await expect(regras.first()).toBeVisible();
    await expect(regras.first()).toHaveText('Regra: TMB x Fator Ativ. +/- Objetivo');
    await expect(regras.nth(1)).toHaveText('Regra: 2.0g por kg corporal');
    const badge0 = sheet.locator('.suggestion-badge').first();
    expect(await badge0.evaluate((e) => getComputedStyle(e, '::after').display)).toBe('none');

    const prot = sheet.locator('input[name="meta_proteina"]');
    await prot.fill('');
    const badge = sheet.locator('.meta-input-group', { has: prot }).locator('.suggestion-badge');
    const sugerido = (await badge.innerText()).match(/[\d.]+/)[0];
    await badge.click();
    await expect(prot).toHaveValue(sugerido);

    expect(await overflowOffenders(page)).toEqual([]);
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    expect(await textosPequenos(page, '.modal-overlay.is-sheet')).toEqual([]);
    await sheet.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
  });

  test('perfil: Confirmar visível com o teclado aberto', async ({ page }) => {
    await gotoApp(page, '/ritmo');
    await teclado(page);
    await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
    const confirmar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Confirmar' });
    await expect(confirmar).toBeVisible();
    await expect.poll(async () => { const b = await confirmar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
  });
});
```

Ao final de `bussola_web/e2e/ritmo.desktop.spec.mjs`, adicionar:

```js
test('desktop ritmo: regra do Sugerido continua só no tooltip (texto auxiliar oculto)', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
  await page.locator('.bio-modal-grid').waitFor();
  const regras = page.locator('.meta-hint');
  await expect(regras).toHaveCount(5);
  await expect(regras.first()).toBeHidden();
  const badge = page.locator('.suggestion-badge').first();
  expect(await badge.evaluate((e) => getComputedStyle(e, '::after').display)).not.toBe('none');
});
```

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs -g "perfil"` → Expected: FAIL — sem `inputmode`, sem `.meta-hint`, badge com `::after` ativo e ~20px de altura, "Usar Sugestões" de 11,2px e ~26px.
Run: `npm run e2e -- --project=desktop e2e/ritmo.desktop.spec.mjs -g "Sugerido"` → Expected: FAIL (`.meta-hint` não existe).

- [ ] **Step 2: Reescrever `BioModal.jsx`**

Substituir o conteúdo de `bussola_web/src/pages/Ritmo/components/BioModal.jsx` por:

```jsx
import React, { useState, useEffect } from 'react';
import { createBioData } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { CustomSelect } from '../../../components/CustomSelect';
import { BaseModal } from '../../../components/BaseModal';

export function BioModal({ onClose, onSuccess, initialData }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);

    // Dados Cadastrais
    const [formData, setFormData] = useState({
        peso: '', altura: '', idade: '', genero: 'M',
        nivel_atividade: 'moderado', objetivo: 'manutencao', bf_estimado: ''
    });

    // Dados de Metas (Editáveis)
    const [customMetas, setCustomMetas] = useState({
        gasto_calorico_total: '',
        meta_proteina: '',
        meta_carbo: '',
        meta_gordura: '',
        meta_agua: ''
    });

    // Sugestões Calculadas (Com explicação)
    const [suggestions, setSuggestions] = useState({
        tmb: 0, gasto_total: 0, proteina: 0, carbo: 0, gordura: 0, agua: 0
    });

    const genderOptions = [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }];
    const activityOptions = [{ value: 'sedentario', label: 'Sedentário' }, { value: 'leve', label: 'Leve' }, { value: 'moderado', label: 'Moderado' }, { value: 'alto', label: 'Alto' }, { value: 'atleta', label: 'Atleta' }];
    const objectiveOptions = [{ value: 'perda_peso', label: 'Perda de Peso (-500kcal)' }, { value: 'manutencao', label: 'Manutenção' }, { value: 'ganho_massa', label: 'Ganho de Massa (+300kcal)' }];

    useEffect(() => {
        if (initialData) {
            setFormData({
                peso: initialData.peso || '', altura: initialData.altura || '', idade: initialData.idade || '',
                genero: initialData.genero || 'M', nivel_atividade: initialData.nivel_atividade || 'moderado',
                objetivo: initialData.objetivo || 'manutencao', bf_estimado: initialData.bf_estimado || ''
            });
            setCustomMetas({
                gasto_calorico_total: initialData.gasto_calorico_total || '',
                meta_proteina: initialData.meta_proteina || '',
                meta_carbo: initialData.meta_carbo || '',
                meta_gordura: initialData.meta_gordura || '',
                meta_agua: initialData.meta_agua || ''
            });
        }
    }, [initialData]);

    useEffect(() => {
        calculateSuggestions();
    }, [formData.peso, formData.altura, formData.idade, formData.genero, formData.nivel_atividade, formData.objetivo]);

    const calculateSuggestions = () => {
        const p = parseFloat(formData.peso);
        const a = parseFloat(formData.altura);
        const i = parseInt(formData.idade);

        if (!p || !a || !i) return;

        // Harris-Benedict
        let tmb = 0;
        if (formData.genero === 'M') tmb = 88.36 + (13.4 * p) + (4.8 * a) - (5.7 * i);
        else tmb = 447.6 + (9.2 * p) + (3.1 * a) - (4.3 * i);

        const fatores = { 'sedentario': 1.2, 'leve': 1.375, 'moderado': 1.55, 'alto': 1.725, 'atleta': 1.9 };
        const get = tmb * (fatores[formData.nivel_atividade] || 1.2);

        let alvo = get;
        if (formData.objetivo === 'perda_peso') alvo -= 500;
        else if (formData.objetivo === 'ganho_massa') alvo += 300;

        // Macros Padrão
        const prot = p * 2.0;
        const gord = p * 1.0;
        const cal_restante = alvo - ((prot * 4) + (gord * 9));
        const carb = Math.max(0, cal_restante / 4);
        const agua = p * 0.045;

        setSuggestions({
            tmb: Math.round(tmb),
            gasto_total: Math.round(alvo),
            proteina: Math.round(prot),
            gordura: Math.round(gord),
            carbo: Math.round(carb),
            agua: parseFloat(agua.toFixed(1))
        });
    };

    const handleFormChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleMetaChange = (e) => { const { name, value } = e.target; setCustomMetas(prev => ({ ...prev, [name]: value })); };

    const useSuggestedValues = () => {
        setCustomMetas({
            gasto_calorico_total: suggestions.gasto_total,
            meta_proteina: suggestions.proteina,
            meta_carbo: suggestions.carbo,
            meta_gordura: suggestions.gordura,
            meta_agua: suggestions.agua
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = {
                ...formData,
                peso: parseFloat(formData.peso),
                altura: parseFloat(formData.altura),
                idade: parseInt(formData.idade),
                bf_estimado: formData.bf_estimado ? parseFloat(formData.bf_estimado) : null,
                gasto_calorico_total: customMetas.gasto_calorico_total ? parseFloat(customMetas.gasto_calorico_total) : null,
                meta_proteina: customMetas.meta_proteina ? parseFloat(customMetas.meta_proteina) : null,
                meta_carbo: customMetas.meta_carbo ? parseFloat(customMetas.meta_carbo) : null,
                meta_gordura: customMetas.meta_gordura ? parseFloat(customMetas.meta_gordura) : null,
                meta_agua: customMetas.meta_agua ? parseFloat(customMetas.meta_agua) : null
            };

            await createBioData(payload);
            addToast({ type: 'success', title: 'Perfil Atualizado!', description: 'Metas salvas com sucesso.' });
            onSuccess(); onClose();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar dados.' });
        } finally { setLoading(false); }
    };

    // Campo de meta com sugestão. Com mouse a regra aparece no tooltip (hover);
    // no toque (ou ≤768) ela aparece como texto auxiliar abaixo do campo.
    const renderMetaInput = (label, name, suggestionVal, unit, hintText, isCalories = false) => {
        const aplicarSugestao = () => setCustomMetas(prev => ({ ...prev, [name]: suggestionVal }));
        return (
            <div className="meta-input-group">
                <div className={`meta-label-row ${isCalories ? 'row-calorias' : ''}`}>
                    <span className="meta-label-text">{label}</span>
                    <span
                        className="suggestion-badge"
                        role="button"
                        tabIndex={0}
                        data-tooltip={`Cálculo Automático: ${suggestionVal}${unit}\nRegra: ${hintText}`}
                        onClick={aplicarSugestao}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aplicarSugestao(); } }}
                    >
                        Sugerido: {suggestionVal}{unit}
                    </span>
                </div>
                <input
                    className="form-input"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    name={name}
                    value={customMetas[name] || ''}
                    onChange={handleMetaChange}
                    placeholder={suggestionVal}
                />
                <small className="meta-hint">Regra: {hintText}</small>
            </div>
        );
    };

    return (
        <BaseModal onClose={onClose} className="ritmo-scope">
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '900px', width: '95%'}}>
                <div className="modal-header-flex">
                    <h2 className="modal-title">Perfil Biológico & Metas</h2>
                    <button type="button" className="close-btn-styled" aria-label="Fechar" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="bio-modal-grid">

                            {/* COLUNA 1: DADOS CADASTRAIS */}
                            <div className="bio-data-column">
                                <div className="bio-section-title">Dados Corporais</div>
                                <div className="form-grid two-cols">
                                    <div className="form-group"><label>Peso (kg)</label><input className="form-input" type="number" inputMode="decimal" step="0.1" name="peso" required value={formData.peso} onChange={handleFormChange} /></div>
                                    <div className="form-group"><label>Altura (cm)</label><input className="form-input" type="number" inputMode="decimal" name="altura" required value={formData.altura} onChange={handleFormChange} /></div>
                                </div>
                                <div className="form-grid two-cols">
                                    <div className="form-group"><label>Idade</label><input className="form-input" type="number" inputMode="numeric" name="idade" required value={formData.idade} onChange={handleFormChange} /></div>
                                    <div className="form-group"><CustomSelect className="form-input" label="Gênero" name="genero" value={formData.genero} options={genderOptions} onChange={handleFormChange} /></div>
                                </div>
                                <div className="form-grid"><div className="form-group"><CustomSelect className="form-input" label="Nível de Atividade" name="nivel_atividade" value={formData.nivel_atividade} options={activityOptions} onChange={handleFormChange} /></div></div>
                                <div className="form-grid"><div className="form-group"><CustomSelect className="form-input" label="Objetivo Atual" name="objetivo" value={formData.objetivo} options={objectiveOptions} onChange={handleFormChange} /></div></div>
                                <div className="form-grid"><div className="form-group"><label>BF% (Estimado/Opcional)</label><input className="form-input" type="number" inputMode="decimal" step="0.1" name="bf_estimado" value={formData.bf_estimado} onChange={handleFormChange} /></div></div>
                            </div>

                            {/* COLUNA 2: METAS (DARK CARD) */}
                            <div className="bio-metas-card">
                                <div className="bio-section-title">
                                    <span>Metas Nutricionais</span>
                                    <button type="button" onClick={useSuggestedValues} className="btn-use-suggested">
                                        <i className="fa-solid fa-wand-magic-sparkles"></i> Usar Sugestões
                                    </button>
                                </div>

                                <div className="calc-explanation">
                                    Valores calculados via <strong>Harris-Benedict</strong> com base no seu nível de atividade e objetivo ({formData.objetivo.replace('_', ' ')}).
                                </div>

                                {/* Passa true para isCalories para manter o layout lateral */}
                                {renderMetaInput('Meta Calórica (Kcal)', 'gasto_calorico_total', suggestions.gasto_total, '', 'TMB x Fator Ativ. +/- Objetivo', true)}

                                <div className="form-grid two-cols" style={{marginBottom: 0}}>
                                    {renderMetaInput('Proteína (g)', 'meta_proteina', suggestions.proteina, 'g', '2.0g por kg corporal')}
                                    {renderMetaInput('Carboidratos (g)', 'meta_carbo', suggestions.carbo, 'g', 'Restante das calorias')}
                                </div>
                                <div className="form-grid two-cols">
                                    {renderMetaInput('Gorduras (g)', 'meta_gordura', suggestions.gordura, 'g', '1.0g por kg corporal')}
                                    {renderMetaInput('Água (L)', 'meta_agua', suggestions.agua, 'L', '45ml por kg corporal')}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-modal-cancel" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-modal-save" disabled={loading}>{loading ? 'Salvando...' : 'Confirmar'}</button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
}
```

(Lógica idêntica; mudou só: `catch {`, `type`/`aria-label` no fechar, `inputMode`, `role`/`tabIndex`/`onKeyDown` no badge e o `<small className="meta-hint">`.)

- [ ] **Step 3: CSS do texto auxiliar e do perfil no celular**

Ao final de `bussola_web/src/pages/Ritmo/styles.css`, adicionar:

```css
/* ============================================= */
/* 14. BIO MODAL: REGRA DO "SUGERIDO" SEM HOVER  */
/* ============================================= */
/* Com mouse a regra fica no tooltip (inalterado); no toque ou ≤768 vira texto visível. */
.ritmo-scope .meta-hint {
    display: none;
}

@media (hover: none), (max-width: 768px) {
    .ritmo-scope .meta-hint {
        display: block;
        font-size: 0.75rem;
        line-height: 1.4;
        color: var(--cor-texto-secundario);
    }

    .ritmo-scope .suggestion-badge::after,
    .ritmo-scope .suggestion-badge::before {
        display: none;
    }

    .ritmo-scope .suggestion-badge {
        cursor: pointer;
    }
}

@media (max-width: 768px) {
    .ritmo-scope .bio-modal-grid {
        gap: var(--sp-5);
    }

    .ritmo-scope .bio-section-title {
        margin-bottom: var(--sp-3);
        gap: var(--sp-2);
        flex-wrap: wrap;
    }

    .ritmo-scope .btn-use-suggested {
        min-height: var(--tap-min);
        padding: 0 var(--sp-3);
        font-size: 0.8125rem;
    }

    .ritmo-scope .bio-data-column .form-grid {
        gap: var(--sp-3);
        margin-bottom: var(--sp-3);
    }

    .ritmo-scope .bio-metas-card {
        padding: var(--sp-4);
    }

    .ritmo-scope .calc-explanation {
        margin-bottom: var(--sp-4);
        padding: var(--sp-2) var(--sp-3);
    }

    /* Metas em coluna única: 12px entre cada campo, sem somar gap + margem */
    .ritmo-scope .bio-metas-card .form-grid {
        gap: 0;
        margin-bottom: 0;
    }

    .ritmo-scope .meta-input-group {
        margin-bottom: var(--sp-3);
    }

    .ritmo-scope .bio-metas-card .form-grid:last-child .meta-input-group:last-child {
        margin-bottom: 0;
    }

    /* Rótulo à esquerda, "Sugerido" (44px, tocável) à direita, regra abaixo do campo */
    .ritmo-scope .meta-label-row,
    .ritmo-scope .meta-label-row.row-calorias {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: var(--sp-2);
        margin-bottom: 0;
    }

    .ritmo-scope .suggestion-badge {
        min-height: var(--tap-min);
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
    }

    .ritmo-scope .row-calorias .suggestion-badge {
        padding: 0 var(--sp-3);
    }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs` → Expected: tudo passa (Tasks 1–6).
Run: `npm run e2e -- --project=desktop e2e/ritmo.desktop.spec.mjs e2e/desktop-visual.desktop.spec.mjs` → Expected: tudo passa, incluindo `modal-bio.png` idêntico e "regra do Sugerido continua só no tooltip".
Run: `npx eslint src/pages/Ritmo` → Expected: **0 erros**, 2 warnings (`exhaustive-deps` pré-existentes). Run: `npm run build` → OK.

- [ ] **Step 5: Commit**

```bash
git add bussola_web/src/pages/Ritmo bussola_web/e2e/ritmo.mobile.spec.mjs bussola_web/e2e/ritmo.desktop.spec.mjs
git commit -m "feat(web): perfil do Ritmo em coluna unica no celular, regra do Sugerido visivel e inputMode" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tablet (769–1024), alvos de toque e verificação final

**Files:**
- Create: `bussola_web/e2e/ritmo.tablet.spec.mjs`
- Modify: `bussola_web/src/pages/Ritmo/styles.css`, `bussola_web/e2e/ritmo.mobile.spec.mjs`

**Interfaces:**
- Consumes: classes das Tasks 2–6, `smallTargets`, `overflowOffenders`.
- Produces: no tablet, faixa de bio em grade 4×2 (mesmo chip), painéis seguem lado a lado; com toque (`pointer: coarse`) e ≥769: pílulas, "Novo Treino", ações dos builders, fechar, rodapés, "Sugerido" e "Usar Sugestões" com 44px; builders mantêm o grid do desktop com a coluna do remover em 44px.

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/ritmo.tablet.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';

const abaDieta = (p) => p.getByRole('tab', { name: 'Plano de Dieta', exact: true }).click();

for (const w of [900, 1024]) {
  test(`tablet ${w}px: sem overflow nas duas abas e faixa bio em 4×2`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/ritmo');
    expect(await overflowOffenders(page), `treino @ ${w}`).toEqual([]);
    const strip = page.locator('.bio-stat-strip');
    expect(await strip.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(4);
    const cortes = await page.locator('.chip-label, .chip-value').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    expect(cortes).toEqual([]);
    expect(await page.locator('.bio-panels-row').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
    await expect(page.locator('.app-fab')).toHaveCount(0);
    await abaDieta(page);
    await expect(page.getByRole('button', { name: 'Nova Dieta' })).toBeVisible();
    expect(await overflowOffenders(page), `dieta @ ${w}`).toEqual([]);
  });
}

test('tablet: controles da página e dos builders com 44px', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  expect(await smallTargets(page, '.ritmo-scope .ritmo-content-wrapper')).toEqual([]);
  await page.getByRole('button', { name: 'Novo Treino' }).click();
  await page.getByRole('button', { name: '+ Add Exercício' }).click();
  await page.getByRole('button', { name: 'Adicionar Dia' }).click();
  expect(await smallTargets(page, '.ritmo-scope .modal-overlay')).toEqual([]);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await abaDieta(page);
  await page.getByRole('button', { name: 'Nova Dieta' }).click();
  await page.getByRole('button', { name: '+ Add Alimento' }).click();
  expect(await smallTargets(page, '.ritmo-scope .modal-overlay')).toEqual([]);
});

test('tablet: regra do Sugerido visível sem hover e alvos do perfil com 44px', async ({ page }) => {
  await gotoApp(page, '/ritmo');
  await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
  const regras = page.locator('.meta-hint');
  await expect(regras.first()).toBeVisible();
  expect(await page.locator('.suggestion-badge').first().evaluate((e) => getComputedStyle(e, '::after').display)).toBe('none');
  expect(await smallTargets(page, '.ritmo-scope .modal-overlay')).toEqual([]);
});
```

Run: `npm run e2e -- --project=tablet e2e/ritmo.tablet.spec.mjs`
Expected: FAIL — faixa em `flex` (rótulos cortados com 7 chips em ~700px), pílulas/"Novo Treino" com ~37px, ações do mini-card com 28px (a regra `pointer: coarse` das ações só existe ≤768), remover de 30px, fechar de ~24px, rodapé de 40px, "Sugerido" de ~20px. (`.meta-hint` já aparece com `hover: none` desde a Task 6.)

- [ ] **Step 2: CSS do tablet e do toque ≥769**

Ao final de `bussola_web/src/pages/Ritmo/styles.css`, adicionar:

```css
/* ============================================= */
/* 15. TABLET (769–1024) E TOQUE ≥769            */
/* ============================================= */
@media (min-width: 769px) and (max-width: 1024px) {
    /* 7 chips + Ajustar Perfil em 4×2 (o chip mantém o visual) */
    .ritmo-scope .bio-stat-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .ritmo-scope .bio-stat-chip:nth-child(4n) {
        border-right: none;
    }

    .ritmo-scope .bio-stat-chip:nth-child(-n + 4) {
        border-bottom: 1px solid var(--cor-borda);
    }

    .ritmo-scope .chip-label {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .ritmo-scope .btn-adjust-profile-chip {
        justify-content: center;
    }
}

@media (pointer: coarse) and (min-width: 769px) {
    .ritmo-scope .tab-btn-pill,
    .ritmo-scope .header-actions-group .btn-primary,
    .ritmo-scope .rb-add-btn,
    .ritmo-scope .rb-add-btn.is-food,
    .ritmo-scope .rb-add-day,
    .ritmo-scope .btn-use-suggested,
    .ritmo-scope .modal-footer > button {
        min-height: var(--tap-min);
    }

    .ritmo-scope .plan-actions button {
        width: var(--tap-min);
        height: var(--tap-min);
    }

    /* Builders: mesmo grid do desktop, com a coluna do remover em 44px */
    .ritmo-scope .rb-ex-row {
        grid-template-columns: 1.5fr 1fr 0.6fr 0.6fr 0.6fr var(--tap-min);
    }

    .ritmo-scope .rb-food-row {
        grid-template-columns: 2fr 0.8fr 0.6fr 0.7fr 0.7fr 0.7fr 0.7fr var(--tap-min);
    }

    .ritmo-scope .rb-remove,
    .ritmo-scope .rb-food-row .rb-remove,
    .ritmo-scope .rb-icon-btn,
    .ritmo-scope .close-btn,
    .ritmo-scope .close-btn-styled {
        width: var(--tap-min);
        height: var(--tap-min);
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .ritmo-scope .suggestion-badge {
        min-height: var(--tap-min);
        display: inline-flex;
        align-items: center;
    }
}
```

- [ ] **Step 3: Capturas para a conferência visual**

Ao final de `bussola_web/e2e/ritmo.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 7 — capturas (abrir os PNGs e conferir espaçamento contra o mockup)
// ---------------------------------------------------------------------------
test('capturas para a conferência visual (360/390/430)', async ({ page }, testInfo) => {
  for (const w of [360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 844 });
    await gotoApp(page, '/ritmo');
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-treino.png`), fullPage: true });
    await abrirAba(page, 'Plano de Dieta');
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-dieta.png`), fullPage: true });
    await page.getByRole('button', { name: 'Nova dieta' }).click();
    await page.getByRole('button', { name: '+ Add Alimento' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-builder-dieta.png`) });
    await page.locator('.modal-overlay.is-sheet-full').getByRole('button', { name: 'Cancelar' }).click();
    await abrirAba(page, 'Plano de Treino');
    await page.getByRole('button', { name: 'Novo treino' }).click();
    await page.getByRole('button', { name: '+ Add Exercício' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-builder-treino.png`) });
    await page.locator('.modal-overlay.is-sheet-full').getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Ajustar Perfil' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: testInfo.outputPath(`ritmo-${w}-perfil.png`) });
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Cancelar' }).click();
  }
});
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=tablet` → Expected: `ritmo.tablet.spec.mjs` (4) e os demais tablet passam. Se `overflowOffenders` listar algo, corrija o CSS do elemento listado (sem esconder com `overflow: hidden` no pai).
Run: `npm run e2e -- --project=mobile` → Expected: tudo passa (inclui `modais-reais`, `ui-lab`, `shell`).
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (`ritmo.png`, `modal-treino.png` e os 5 de `ritmo.desktop.spec.mjs` idênticos).

- [ ] **Step 5: Suíte completa, build e lint**

Run: `npm run e2e` → Expected: tudo passa nos 3 projetos.
Run: `npm run build` → Expected: OK.
Run: `npx eslint src/pages/Ritmo` → Expected: 0 erros, 2 warnings.
Run: `npm run lint 2>&1 | Select-String " error " | Measure-Object` → Expected: contagem = (a de antes do plano) − 5; registre os dois números na mensagem do commit.
Run: `npm run e2e -- --project=desktop` mais uma vez, depois do `afterAll` do mobile → Expected: tudo passa (prova de que os dados `E2E ` foram limpos e os planos originais voltaram a ser os ativos).

- [ ] **Step 6: Conferência visual (360, 390 e 430px)**

Run: `npm run e2e -- --project=mobile e2e/ritmo.mobile.spec.mjs -g "capturas"`. Abra **cada** PNG gerado em `test-results/ritmo.mobile-capturas-*/` (ferramenta Read: `ritmo-{360,390,430}-{treino,dieta,builder-treino,builder-dieta,perfil}.png`) e confira contra o mockup aprovado (spec §5.5, opção "Grade 2×4"):
- topbar "Ritmo" com robô e avatar; sem `.page-header`; 16px de gutter e 16px entre a topbar e a grade;
- grade 2×4: os 7 chips na ordem Peso · Altura · % Gordura · Meta Calórica · TMB · Hidratação · Atividade, "Ajustar Perfil" (azul) na 8ª célula; divisórias de 1px alinhadas; nenhum rótulo/valor cortado;
- 16px entre a grade e o Volume, 16px entre Volume e Macros; dentro do painel 12px entre linhas e 16px de padding; volume com rótulo de 76px e contador alinhado à direita;
- 24px entre a visão bio e as abas; pílulas de largura igual com o texto inteiro; 16px até a biblioteca;
- biblioteca: card ativo com borda azul, ações de 44px, o próximo card "espiando" quando há mais de um;
- 12px entre cards de treino/refeição; tabelas sem rolagem lateral; pílula de macros centralizada (quebra em 2 linhas em 360);
- builders: cabeçalho com título (reticências) e ✕ de 44px; 16px entre o nome do plano e o 1º bloco; dentro do bloco 8px entre campos e 12px de padding; Cancelar/Salvar 50/50 no rodapé;
- perfil: coluna única; "Sugerido" à direita do rótulo; "Regra: …" logo abaixo de cada campo; 12px entre campos;
- nenhum texto principal abaixo de 14px; Fab no canto inferior direito sem cobrir o último card (role até o fim).
Qualquer desvio da escala 4/8/12/16/24/32: ajuste o CSS da Task correspondente, rode de novo os testes dela e capture de novo.

- [ ] **Step 7: Commit**

```bash
git add bussola_web/src/pages/Ritmo bussola_web/e2e
git commit -m "feat(web): Ritmo no tablet (faixa 4x2, alvos de 44px no toque) e verificacao final" -m "lint: <antes> -> <depois> erros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Decisões e suposições registradas neste plano

- **`.page-header` (KPIs plano ativo · dieta ativa · peso) não aparece no celular.** Repete o chip de Peso e o card ativo da biblioteca, e os nomes longos com `nowrap` vazariam. Tablet e desktop mantêm.
- **Abas com as pílulas atuais (`.tab-btn-pill`), não com o `Segmented` do plano 02.** O usuário pediu "manter o visual atual"; ganharam `role="tab"`/`aria-selected` (sem mudar pixels). No celular, 12px em caixa alta (0,02em de espaçamento) para "PLANO DE TREINO" caber inteiro em 360px.
- **Teto do volume: 12 sets por linha, só no celular.** Acima disso a linha vira uma barra contínua (uma `.vol-block` esticada); as outras linhas seguem em blocos. O desktop não muda (o problema de largura só existe no celular).
- **Mini-card da faixa:** `min(320px, 100% − 32px)` (o próximo card "espia"); se houver um só plano, largura total. Nome do plano pode quebrar em 2 linhas (3 ações de 44px ocupam ~140px).
- **Linha numérica do treino:** Sets · Min · Max + remover (44px) na mesma linha; nome e grupo em largura total acima. **Dieta:** nome em largura total; Qtd (2/4) + Un (resto) na 2ª linha; Kcal · P · C · G + remover na 3ª (6 campos numa linha não cabem em 360).
- **`inputMode`:** treino `numeric`; dieta Qtd `decimal`, Kcal/P/C/G `numeric` (os valores são arredondados); perfil `decimal` em peso, altura, BF e metas, `numeric` em idade.
- **Estilos inline mantidos onde o celular não precisa mudar** (cabeçalho, fechar, nome do dia/refeição, "Adicionar Dia", "Cancelar", `modal-content`): o CSS só acrescenta propriedades que o inline não declara. O dropdown da busca segue inline e o celular usa `!important` só em `padding`/`font-size` (preço para o desktop ficar pixel-idêntico).
- **`BioModal` continua `sheet="auto"`** (não tela cheia): é um formulário, não um builder; rola dentro de 92dvh com o rodapé fixo.
- **"Sugerido" vira `role="button"` de 44px no toque** (rótulo à esquerda, sugestão à direita) e a regra aparece como "Regra: …" abaixo do campo. A regra aparece com `(hover: none)` **ou** `≤768` (cobre tablet e janela estreita com mouse).
- **Tablet:** builders mantêm o grid do desktop (cabe em ~850px) com a coluna do remover em 44px e alvos de 44px via `pointer: coarse`; a faixa bio vira 4×2.
- **Testes não salvam o perfil** (`POST /ritmo/bio` cria registro novo e o backend recalcula TMB/metas → mudaria `ritmo.png`). O fluxo coberto é abrir, tocar no Sugerido, conferir layout e cancelar.
- **Limpeza:** se o ativo for E2E ou não houver ativo, reativa o **primeiro** plano/dieta não-E2E (no banco demo, "Hipertrofia ABC 2025" e "Bulking Limpo"). Os testes de fluxo também reativam o original pela UI (cobre o botão Ativar).
- **Busca de alimentos mockada** nos testes (`FOODS`): o JSON TACO local pode não existir no banco demo.
- **`padding-bottom: 5rem` do `.main-container` mantido** no celular: com o `padding-bottom` do `.app-content` (barra inferior + 16), o último card termina acima do Fab.
- **Texto "Ajustar Perfil"** mantido como está no código (o mockup escreve "Ajustar perfil").
- **`treinoAtivo.dias.sort(...)`/`dietaAtiva.refeicoes.sort(...)` (mutação no render) e o `useEffect` com `setState` dos modais** são pré-existentes e não são tocados (o lint atual não os acusa).

## Rulings do controlador (vinculantes)

- KPIs do page-header ocultos no celular (repetem o chip de peso e a biblioteca): **aceito** — o mockup aprovado (tela 6) não os mostra.
- Manter as pílulas atuais (12px caixa alta no celular) em vez do `Segmented`: **aceito** (preserva o visual atual).
- Teto de 12 sets por linha só no celular; bloco da dieta em 3 linhas; `inputMode` numeric/decimal como descrito; dropdown de busca com overrides `!important` só no mobile; BioModal como bottom sheet comum (sem salvar nos testes); builders do tablet com o grid desktop e remover 44px no toque; limpeza reativando "Hipertrofia ABC 2025" / "Bulking Limpo": **todos aceitos**.
- `.sort()` que muta estado no render e `setState` em effects pré-existentes: **fora do escopo** deste plano (não introduzir novos); registrar como dívida.
- Pré-requisito: executar depois do plano 02 (usa `apiJson`/`smallTargets`).
