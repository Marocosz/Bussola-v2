# Mobile 07: Cofre, plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a página Cofre (`/cofre`) para o celular no layout aprovado "Lista compacta" (estilo gerenciador de senhas): busca no topo, uma linha por segredo (ícone, título + serviço, validade em cor de alerta), botão `fa-eye` primário de 44px e "⋯" com ActionSheet (Editar / Ver notas / Excluir), Fab "Guardar segredo", `SegredoModal` em sheet com atributos de teclado corretos e `ViewSecretModal` com valor monoespaçado grande e área de transferência limpa **ao fechar e pelo timer**, verificando o resultado da escrita. A tabela continua no desktop, que fica idêntico.

**Architecture:**
- `Cofre/index.jsx` continua dono do estado e dos handlers (`handleViewSecret`, `handleEdit`, `handleDelete`, `handleNew`). No mobile (`useIsMobile()`), troca o cabeçalho de seção + tabela por `<CofreLista>` (novo, em `Cofre/components/`) e mostra o `<Fab>`. Nada muda no desktop.
- Lógica pura nova, testada pelo próprio Vite (`page.evaluate(() => import(...))`): `Cofre/cofreLista.js` (busca sem acento e validade com data **local**) e `src/utils/clipboard.js` (`escreverClipboard` → `boolean`).
- Os modais já viram sheet pelo `BaseModal` (plano 01; ele **não** é portal, então os modais continuam dentro de `.cofre-scope`). Aqui: o "×" vira `<button aria-label="Fechar">` real (visual idêntico no desktop, 44px no toque), o `SegredoModal` ganha atributos de teclado e perde o autofocus no toque, e o `ViewSecretModal` é reescrito para controlar o timer por handler (sem `setState` em efeito) e limpar a área de transferência ao fechar/desmontar.
- Testes: Playwright `cofre.desktop.spec.mjs` (bases visuais dos modais **antes** de mexer, hover), `cofre.mobile.spec.mjs` (lógica pura, lista, ações, formulário, clipboard), `cofre.tablet.spec.mjs`. Dados de teste com prefixo `E2E ` criados e removidos pela API.

**Tech Stack:** React 19, Vite 7, CSS puro, Font Awesome (npm), `@playwright/test` 1.63.

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-responsivo-design.md` (§2 restrições, §4 fundação, §5.6 Cofre, §6 tablet, §8 verificação). Este plano é a etapa 9 da §7.
**Planos anteriores:** `2026-10-02-mobile-01-fundacao-shell.md` (harness, tokens, primitivos, shell — implementado) e `2026-10-02-mobile-02-provisoes.md` (cria `e2e/helpers.mjs` → `authHeaders`, `apiJson`, `smallTargets` e `src/components/mobile/Segmented.jsx`; já existirão quando este plano for executado — **reusar, não recriar**).

## Global Constraints

- **Branch:** `feat/mobile-responsivo` (worktree `.claude/worktrees/mobile-responsivo`). Um commit por task. **Nunca** fazer push nem merge em `main`. Nunca usar `git stash`.
- **Commits** terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use um segundo `-m`).
- **Não redesenhar cards/elementos existentes:** a `.service-tag` (pílula azul do serviço), o `.secret-display-box`, o `.locked-input-wrapper` e as cores ficam como estão. Só layout da página, tamanho, espaçamento, quebra, alvo de toque e ações visíveis.
- **Ícones:** só classes Font Awesome que já existem no código. Usadas neste plano: `fa-vault` (página), `fa-key` (ícone da linha; já usado em `Panorama/index.jsx` no card "Cofre de senhas"), `fa-eye`, `fa-eye-slash`, `fa-ellipsis` (o "⋯", já usado na `BottomNav`), `fa-pencil` (Editar, o mesmo da tabela), `fa-note-sticky` (Ver notas), `fa-trash-can`, `fa-plus` (Fab), `fa-magnifying-glass`, `fa-shield-cat` (vazio), `fa-lock`, `fa-copy` (`fa-regular`), `fa-shield-halved`, `fa-circle-notch`.
- **Espaçamento (tokens `--sp-1..6` = 4/8/12/16/24/32):** 8 dentro da linha/card, 12 entre itens, 16 de gutter lateral e entre blocos (busca ↔ lista), 24 entre seções. Nenhum valor solto fora da escala no CSS novo, exceto tamanhos de controle (36/44/48/52/56px) e raios.
- **Toque:** alvo ≥ 44×44 em tudo que é interativo; inputs com 16px (já garantido por `tokens.css`); nenhuma ação ou informação só no hover (`tr:hover`, `.notes-preview:hover` e afins passam para `@media (hover: hover) and (pointer: fine)`).
- **Tipografia mobile:** conteúdo principal ≥ 14px (título da linha 15px), secundário ≥ 12px, 11px só em rótulos em caixa alta.
- **Desktop (≥1025):** visualmente idêntico. Os 13 PNGs de `e2e/desktop-visual.desktop.spec.mjs-snapshots/` (inclui `cofre.png` e `modal-segredo.png`) e os 3 novos de `cofre.desktop.spec.mjs-snapshots/` (Task 1) têm que continuar passando em toda task. Tablet (769–1024) segue a spec §6.
- **Sem mudança de API/backend.** Reusar `getSegredos`, `createSegredo`, `updateSegredo`, `deleteSegredo`, `getSegredoValor` de `services/api.ts` e os handlers da página.
- **Dados de teste:** tudo que os testes criam começa com `E2E ` e é removido via API (`limparE2E`) no `beforeAll` e no `afterAll` do arquivo. Sobrar lixo quebra `cofre.png` e as bases da Task 1 (que usam a primeira linha da tabela).
- **Lint:** `npx eslint <arquivos tocados>` sem **novos** erros. Linha de base medida em `src/pages/Cofre`: **1 erro** (`SegredoModal.jsx:26`, `react-hooks/set-state-in-effect`) e 3 warnings (`ViewSecretModal.jsx:18`, `:33`, `index.jsx:37`, `exhaustive-deps`). Este plano zera o erro (reset do form vira ajuste no render) e os 2 warnings do `ViewSecretModal`. Regras v7: sem `setState` síncrono em `useEffect`, sem mutar acumuladores no render, `catch {` sem variável.
- **Build:** `npm run build` passa.

## API real dos primitivos (lida do código, use exatamente isto)

- `useIsMobile()` / `useIsTablet()` / `useMediaQuery(query)` de `src/hooks/useIsMobile.js` (≤768 / 769–1024 / qualquer query), via `useSyncExternalStore`.
- `BaseModal({ children, onClose, className, sheet = 'auto' })`: **não é portal** (renderiza no lugar, então os modais do Cofre ficam dentro de `.cofre-scope`). No mobile põe `is-sheet` no `.modal-overlay`. ESC e clique no overlay chamam `onClose`. Trava de scroll com contador.
- `Sheet({ open, onClose, title, ariaLabel, children, footer, full, className })`: **portal** para o `body`; retorna `null` se `!open`; cabeçalho (h3 + `button.app-sheet-close[aria-label="Fechar"]`) só se houver `title`.
- `ActionSheet({ open, onClose, title, subtitle, icon, actions })`: `actions: [{ key, icon /* classe FA completa */, label, onClick, variant?: 'primary'|'danger' }]`; chama `onClose()` e depois `onClick()`; acrescenta a linha "Cancelar". Sem botão Fechar (fecha com ESC/overlay/Cancelar). Itens: `button.action-sheet-item(.is-danger)`.
- `Fab({ icon = 'fa-plus', label, onClick })`: portal no `body`, `button.app-fab[aria-label]`, visível só ≤768. Renderize **só quando `isMobile`** para o DOM do desktop não mudar.
- Eventos React sobem pela árvore React mesmo através de portais: nunca renderize um sheet dentro de um elemento clicável; a linha do Cofre **não** é clicável (só os botões dela).
- **Ordem do CSS** (`main.jsx`): `tokens.css` → CSS das páginas (inclui `Cofre/styles.css`) → `mobile.css` → `components.css` → `global.css`. `.close-btn` e `.modal-*` vivem em `components.css`; `.form-input` e `.btn-*` em `global.css` (último). Para vencer `global.css` use especificidade maior (ex.: `.cofre-scope .x .form-input`).
- `tokens.css` já faz, em `@media (pointer: coarse)`, `.btn-action-icon { min-width/min-height: 44px }`.
- `e2e/helpers.mjs`: `gotoApp(page, path)` (relógio fixo `2026-10-02 12:00 -03:00` via `page.clock.setFixedTime`, **não** congela timers), `FIXED_NOW`, `overflowOffenders(page)` (ignora `[data-offscreen-ok]`) e, do plano 02, `authHeaders()`, `apiJson(request, method, path, data?)`, `smallTargets(page, rootSelector)`.
- Projetos Playwright por sufixo: `*.mobile.spec.mjs` (390×844, touch, `pointer: coarse`, `hover: none`), `*.tablet.spec.mjs` (900×1200, touch), `*.desktop.spec.mjs` (1280×900, mouse).
- Banco demo (`populate_db.py`): 8 segredos (Netflix, Spotify, Gov.br, AWS Console, Instagram, Banco Inter, Steam, Notion), serviço preenchido, notas `Login: … | Criado em …`, ~20% com `data_expiracao`. A ordem da lista é estável.
- API do Cofre: `GET /cofre/` (lista sem valor), `POST /cofre/` (`{ titulo, servico?, notas?, data_expiracao?, valor }`), `PUT /cofre/{id}`, `DELETE /cofre/{id}`, `GET /cofre/{id}/valor` → `{ valor }`.

## Review Focus

1. **Toast mente sobre a área de transferência** (diz "limpa" quando a escrita falhou, ou a senha fica copiada depois de fechar o sheet). Teste na Task 4 › "fechar pelo X limpa…", "falha ao limpar: avisa sem dizer que limpou" e "o timer de 60s limpa e avisa".
2. **Ação aplicada ao segredo errado pelo ActionSheet** (closure do item; Excluir apagando outro). Teste na Task 2 › "Excluir pelo ⋯ pede confirmação e remove só aquele".
3. **Salvar escondido pelo teclado ou teclado abrindo sozinho** (autofocus no toque). Teste na Task 3 › "teclado virtual: Salvar fica acima do teclado" e "… sem autofocus".
4. **Validade no dia errado** (`new Date('AAAA-MM-DD')` é meia-noite UTC = dia anterior no Brasil) ou sem cor de alerta. Teste na Task 1 › "validadeInfo e filtrarSegredos" e Task 2 › "linha: título, serviço e validade em alerta".
5. **Regressão no desktop** (`<span>` → `<button>` no fechar, reset do formulário movido do efeito para o render, gate de hover). Teste na Task 1 › `cofre.desktop.spec.mjs` (3 bases + hover) e em toda task via `--project=desktop`.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `bussola_web/e2e/cofre.desktop.spec.mjs` | criar | base visual dos modais do Cofre + hover da tabela |
| `bussola_web/e2e/cofre.mobile.spec.mjs` | criar | lógica pura, lista, ações, formulário, clipboard |
| `bussola_web/e2e/cofre.tablet.spec.mjs` | criar | tabela sem overflow, 44px, sem hover no toque |
| `bussola_web/src/pages/Cofre/cofreLista.js` | criar | `normalizar`, `filtrarSegredos`, `validadeInfo`, `DIAS_ALERTA` |
| `bussola_web/src/utils/clipboard.js` | criar | `escreverClipboard(texto) → Promise<boolean>` |
| `bussola_web/src/pages/Cofre/components/CofreLista.jsx` | criar | busca + lista compacta + ActionSheet |
| `bussola_web/src/pages/Cofre/index.jsx` | modificar | no mobile renderiza `CofreLista` + `Fab` |
| `bussola_web/src/pages/Cofre/components/SegredoModal.jsx` | modificar | `<button>` Fechar, atributos de teclado, sem autofocus no toque, reset no render |
| `bussola_web/src/pages/Cofre/components/ViewNotesModal.jsx` | modificar | `<button>` Fechar |
| `bussola_web/src/pages/Cofre/components/ViewSecretModal.jsx` | modificar | timer por handler, limpar ao fechar/desmontar, escrita verificada |
| `bussola_web/src/pages/Cofre/styles.css` | modificar | gate de hover, lista mobile, sheets, tablet |
| `bussola_web/src/assets/styles/components.css` | modificar | `button.close-btn` (reset visual + 44px no toque) |

---

### Task 1: Base visual do desktop + lógica pura (busca, validade, clipboard)

**Files:**
- Create: `bussola_web/e2e/cofre.desktop.spec.mjs`, `bussola_web/e2e/cofre.mobile.spec.mjs`, `bussola_web/src/pages/Cofre/cofreLista.js`, `bussola_web/src/utils/clipboard.js`

**Interfaces:**
- Consumes: `gotoApp`, `apiJson` (helpers).
- Produces:
  - `normalizar(texto): string` (sem acento, minúsculo, aparado).
  - `filtrarSegredos(segredos, busca): Segredo[]` (procura em `titulo` + `servico`; busca vazia devolve a mesma lista).
  - `validadeInfo(iso: string|null, agora?: Date): { nivel: 'nenhuma'|'expirado'|'perto'|'ok', texto: string }` — data **local**; `perto` = 0 a `DIAS_ALERTA` (30) dias.
  - `escreverClipboard(texto): Promise<boolean>` — `true` só se `navigator.clipboard.writeText` resolveu.

- [ ] **Step 1: Spec de base visual dos modais do Cofre (desktop)**

Criar `bussola_web/e2e/cofre.desktop.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

// Modais do Cofre que este plano toca. Base gerada ANTES de mexer no código.
const MODAIS = [
  ['cofre-editar', async (p) => {
    await p.locator('.btn-edit-segredo').first().click();
    await p.locator('.locked-input-wrapper').waitFor();
  }],
  ['cofre-ver-segredo', async (p) => {
    await p.locator('.btn-view-secret').first().click();
    await p.getByRole('button', { name: 'Visualizar', exact: true }).click();
    await p.locator('.secret-display-box').waitFor();
  }],
  ['cofre-notas', async (p) => {
    await p.locator('.notes-preview').first().click();
    await p.locator('.notes-full-view').waitFor();
  }],
];

for (const [nome, abrir] of MODAIS) {
  test(`desktop cofre: ${nome} inalterado`, async ({ page }) => {
    await gotoApp(page, '/cofre');
    await abrir(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`${nome}.png`);
  });
}

test('desktop cofre: linha da tabela destaca no hover', async ({ page }) => {
  await gotoApp(page, '/cofre');
  const row = page.locator('.data-table tbody tr').first();
  const bg = () => row.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await bg()).toBe('rgba(0, 0, 0, 0)');
  await row.hover();
  await expect.poll(bg).not.toBe('rgba(0, 0, 0, 0)');
});

test('desktop cofre: nada do layout mobile aparece', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await expect(page.locator('.data-table')).toBeVisible();
  await expect(page.locator('.section-header-flex')).toBeVisible();
  await expect(page.locator('.cofre-m')).toHaveCount(0);
  await expect(page.locator('.app-fab')).toHaveCount(0);
});
```

- [ ] **Step 2: Gerar a base ANTES de qualquer mudança de código**

Run (em `bussola_web/`): `npm run e2e:update -- --project=desktop e2e/cofre.desktop.spec.mjs`
Expected: 5 passed; criados 3 PNGs em `e2e/cofre.desktop.spec.mjs-snapshots/`. Abra os 3 e confira: o form "Editar Segredo" com a senha travada (`fa-lock`), o "Visualizar: …" com os 24 pontos e os botões Revelar/Copiar, e "Notas: …" com o texto `Login: …`. Rode `npm run e2e -- --project=desktop` e confirme **18 passed** (13 + 5) com a base estável; se algo variar entre execuções, adicione `mask` no elemento dinâmico e regenere.

- [ ] **Step 3: Testes da lógica pura (falham: os módulos não existem)**

Criar `bussola_web/e2e/cofre.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, apiJson, smallTargets, FIXED_NOW } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Infra do arquivo
// ---------------------------------------------------------------------------
// "Perto" = 5 dias depois do relógio fixo (02/10/2026); "Expirado" = antes dele.
const SEGREDOS = [
  { titulo: 'E2E Banco Zeta', servico: 'E2E Financeiro', notas: 'E2E nota do banco\nsegunda linha', valor: 'E2E-senha-123', data_expiracao: '2026-10-07' },
  { titulo: 'E2E Expirado', servico: null, notas: null, valor: 'E2E-velha', data_expiracao: '2026-09-30' },
];

// Remove tudo que os testes criam (prefixo "E2E "): sem isso as bases do desktop quebram.
async function limparE2E(request) {
  for (const s of (await apiJson(request, 'GET', '/cofre/')).filter((x) => x.titulo.startsWith('E2E '))) {
    await apiJson(request, 'DELETE', `/cofre/${s.id}`);
  }
}

test.beforeAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  for (const s of SEGREDOS) await apiJson(r, 'POST', '/cofre/', s);
  await r.dispose();
});

test.afterAll(async ({ playwright }) => {
  const r = await playwright.request.newContext();
  await limparE2E(r);
  await r.dispose();
});

// Área de transferência falsa: registra as escritas e pode falhar (como o Safari fora de um gesto).
async function stubClipboard(page) {
  await page.addInitScript(() => {
    window.__clip = [];
    window.__clipFalha = false;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => ({
        writeText: (t) => {
          if (window.__clipFalha) return Promise.reject(new DOMException('negado', 'NotAllowedError'));
          window.__clip.push(t);
          return Promise.resolve();
        },
      }),
    });
  });
}

const linha = (page, titulo) => page.locator('.cofre-m-item', { hasText: titulo });

// ---------------------------------------------------------------------------
// Task 1 — lógica pura (importada pelo próprio Vite dev server)
// ---------------------------------------------------------------------------
test.describe('lógica pura', () => {
  test('validadeInfo e filtrarSegredos', async ({ page }) => {
    await gotoApp(page, '/cofre');
    const r = await page.evaluate(async () => {
      const m = await import('/src/pages/Cofre/cofreLista.js');
      const agora = new Date(2026, 9, 2, 12);
      const v = (d) => m.validadeInfo(d, agora);
      const lista = [
        { id: 1, titulo: 'Conta Itaú', servico: 'Banco' },
        { id: 2, titulo: 'Netflix', servico: 'Entretenimento' },
        { id: 3, titulo: 'AWS', servico: null },
      ];
      return {
        nenhuma: v(null),
        ontem: v('2026-10-01'),
        hoje: v('2026-10-02'),
        amanha: v('2026-10-03'),
        cinco: v('2026-10-07'),
        trinta: v('2026-11-01'),
        longe: v('2026-12-25'),
        busca: m.filtrarSegredos(lista, 'itau').map((s) => s.id),
        servico: m.filtrarSegredos(lista, 'ENTRET').map((s) => s.id),
        vazia: m.filtrarSegredos(lista, '   ').length,
      };
    });
    expect(r).toEqual({
      nenhuma: { nivel: 'nenhuma', texto: 'Não expira' },
      ontem: { nivel: 'expirado', texto: 'Expirou em 01/10/2026' },
      hoje: { nivel: 'perto', texto: 'Expira hoje' },
      amanha: { nivel: 'perto', texto: 'Expira amanhã' },
      cinco: { nivel: 'perto', texto: 'Expira em 5 dias' },
      trinta: { nivel: 'perto', texto: 'Expira em 30 dias' },
      longe: { nivel: 'ok', texto: 'Expira em 25/12/2026' },
      busca: [1],
      servico: [2],
      vazia: 3,
    });
  });

  test('escreverClipboard informa sucesso e falha', async ({ page }) => {
    await stubClipboard(page);
    await gotoApp(page, '/cofre');
    const r = await page.evaluate(async () => {
      const { escreverClipboard } = await import('/src/utils/clipboard.js');
      const ok = await escreverClipboard('abc');
      window.__clipFalha = true;
      const falha = await escreverClipboard('def');
      return { ok, falha, gravados: window.__clip };
    });
    expect(r).toEqual({ ok: true, falha: false, gravados: ['abc'] });
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/cofre.mobile.spec.mjs`
Expected: FAIL — `Failed to fetch dynamically imported module` (os dois módulos ainda não existem).

- [ ] **Step 4: Lógica pura da lista**

Criar `bussola_web/src/pages/Cofre/cofreLista.js`:

```js
// Lógica pura da lista do Cofre no celular: busca e validade. Sem React.
const DIA_MS = 86_400_000;

/** Dias até a expiração em que a validade aparece em cor de alerta. */
export const DIAS_ALERTA = 30;

export function normalizar(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

/** Filtra por título e serviço, sem acento e sem diferenciar maiúsculas. */
export function filtrarSegredos(segredos, busca) {
    const termo = normalizar(busca);
    if (!termo) return segredos;
    return segredos.filter((s) => normalizar(`${s.titulo} ${s.servico || ''}`).includes(termo));
}

// 'AAAA-MM-DD' como data LOCAL. new Date('AAAA-MM-DD') seria meia-noite UTC, ou seja,
// o dia anterior no Brasil.
function dataLocal(iso) {
    const [ano, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(ano, mes - 1, dia);
}

/** Texto e nível (cor) da validade de um segredo, relativo a `agora`. */
export function validadeInfo(iso, agora = new Date()) {
    if (!iso) return { nivel: 'nenhuma', texto: 'Não expira' };
    const alvo = dataLocal(iso);
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const dias = Math.round((alvo - hoje) / DIA_MS);
    const data = alvo.toLocaleDateString('pt-BR');
    if (dias < 0) return { nivel: 'expirado', texto: `Expirou em ${data}` };
    if (dias === 0) return { nivel: 'perto', texto: 'Expira hoje' };
    if (dias === 1) return { nivel: 'perto', texto: 'Expira amanhã' };
    if (dias <= DIAS_ALERTA) return { nivel: 'perto', texto: `Expira em ${dias} dias` };
    return { nivel: 'ok', texto: `Expira em ${data}` };
}
```

- [ ] **Step 5: Escrita verificada na área de transferência**

Criar `bussola_web/src/utils/clipboard.js`:

```js
// Escreve na área de transferência e diz se deu certo. O Safari/iOS rejeita a escrita fora de
// um gesto do usuário (ex.: num timer), então quem chama precisa olhar o resultado antes de
// afirmar qualquer coisa ao usuário.
export async function escreverClipboard(texto) {
    try {
        if (!navigator.clipboard?.writeText) return false;
        await navigator.clipboard.writeText(texto);
        return true;
    } catch {
        return false;
    }
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/cofre.mobile.spec.mjs` → Expected: 2 passed.
Run: `npm run e2e -- --project=desktop` → Expected: 18 passed (nenhum código de tela mudou).
Run: `npx eslint src/pages/Cofre/cofreLista.js src/utils/clipboard.js` → Expected: sem problemas.

- [ ] **Step 7: Commit**

```bash
git add bussola_web/e2e/cofre.desktop.spec.mjs bussola_web/e2e/cofre.desktop.spec.mjs-snapshots bussola_web/e2e/cofre.mobile.spec.mjs bussola_web/src/pages/Cofre/cofreLista.js bussola_web/src/utils/clipboard.js
git commit -m "test(web): base visual dos modais do Cofre e logica pura (busca, validade, clipboard)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Lista compacta no celular (busca, linha, ActionSheet, Fab)

**Files:**
- Create: `bussola_web/src/pages/Cofre/components/CofreLista.jsx`
- Modify: `bussola_web/src/pages/Cofre/index.jsx`, `bussola_web/src/pages/Cofre/styles.css`, `bussola_web/e2e/cofre.mobile.spec.mjs`

**Interfaces:**
- Consumes: `filtrarSegredos`, `validadeInfo` (Task 1); `ActionSheet`, `Fab` (plano 01); handlers da página.
- Produces: `CofreLista({ segredos, onVer(segredo), onEditar(segredo), onNotas(segredo), onExcluir(id) })` → `div.cofre-m` com `input[type=search][aria-label="Buscar segredos"]`, `ul.cofre-m-lista > li.cofre-m-item` (ícone `fa-key`, `.cofre-m-titulo`, `.service-tag`, `.cofre-m-validade.is-{nivel}`, `button.cofre-m-ver[aria-label="Ver senha de <título>"]`, `button.cofre-m-mais[aria-label="Mais ações de <título>"]`).

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/cofre.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 2 — lista compacta
// ---------------------------------------------------------------------------
test.describe('lista compacta', () => {
  test('topbar "Cofre", sem tabela nem cabeçalho de seção; Fab "Guardar segredo"', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await expect(page.locator('.m-topbar-title')).toHaveText('Cofre');
    await expect(page.locator('.data-table')).toHaveCount(0);
    await expect(page.locator('.section-header-flex')).toHaveCount(0);
    await expect(page.locator('.cofre-m-item').first()).toBeVisible();
    const fab = page.locator('.app-fab');
    await expect(fab).toHaveCount(1);
    await expect(fab).toHaveAttribute('aria-label', 'Guardar segredo');
  });

  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/cofre');
      await expect(page.locator('.cofre-m-item').first()).toBeVisible();
      expect(await overflowOffenders(page), `${w}px`).toEqual([]);
    });
  }

  test('alvos de toque ≥ 44px', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await expect(page.locator('.cofre-m-item').first()).toBeVisible();
    expect(await smallTargets(page, '.cofre-scope')).toEqual([]);
  });

  test('espaçamento: gutter de 16px, 16px entre busca e lista, linhas com 64px+', async ({ page }) => {
    await gotoApp(page, '/cofre');
    const busca = await page.getByRole('searchbox', { name: 'Buscar segredos' }).boundingBox();
    const lista = await page.locator('.cofre-m-lista').boundingBox();
    expect(Math.round(lista.x)).toBe(16);
    expect(Math.round(lista.width)).toBe(390 - 32);
    expect(Math.round(busca.x)).toBe(16);
    expect(Math.round(lista.y - (busca.y + busca.height))).toBe(16);
    for (const b of await page.locator('.cofre-m-item').all()) {
      expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(64);
    }
  });

  test('linha: título, serviço e validade em alerta', async ({ page }) => {
    await gotoApp(page, '/cofre');
    const zeta = linha(page, 'E2E Banco Zeta');
    await expect(zeta.locator('.cofre-m-icone i')).toHaveClass(/fa-key/);
    await expect(zeta.locator('.cofre-m-titulo')).toHaveText('E2E Banco Zeta');
    await expect(zeta.locator('.service-tag')).toHaveText('E2E Financeiro');
    const perto = zeta.locator('.cofre-m-validade');
    await expect(perto).toHaveText('Expira em 5 dias');
    await expect(perto).toHaveClass(/is-perto/);
    expect(await perto.evaluate((e) => getComputedStyle(e).color)).toBe('rgb(243, 156, 18)');
    const exp = linha(page, 'E2E Expirado').locator('.cofre-m-validade');
    await expect(exp).toHaveText('Expirou em 30/09/2026');
    await expect(exp).toHaveClass(/is-expirado/);
    const titulo = await zeta.locator('.cofre-m-titulo').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(titulo).toBeGreaterThanOrEqual(15);
  });

  test('busca sem acento por título e por serviço', async ({ page }) => {
    await gotoApp(page, '/cofre');
    const busca = page.getByRole('searchbox', { name: 'Buscar segredos' });
    await busca.fill('zeta');
    await expect(page.locator('.cofre-m-item')).toHaveCount(1);
    await busca.fill('FINANCÉIRO');
    await expect(page.locator('.cofre-m-item')).toHaveCount(1);
    await busca.fill('nada-que-exista');
    await expect(page.locator('.cofre-m-item')).toHaveCount(0);
    await expect(page.locator('.cofre-m-nada')).toContainText('Nenhum segredo encontrado');
    await busca.fill('');
    expect(await page.locator('.cofre-m-item').count()).toBeGreaterThan(2);
  });

  test('⋯ abre Editar / Ver notas / Excluir; sem notas não mostra "Ver notas"', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.getByRole('button', { name: 'Mais ações de E2E Banco Zeta' }).click();
    const sheet = page.locator('.action-sheet');
    await expect(sheet.locator('.action-sheet-titles strong')).toHaveText('E2E Banco Zeta');
    await expect(sheet.locator('.action-sheet-item')).toHaveText(['Editar', 'Ver notas', 'Excluir', 'Cancelar']);
    await expect(sheet.locator('.action-sheet-item.is-danger')).toHaveText('Excluir');
    await sheet.getByRole('button', { name: 'Cancelar' }).click();
    await expect(sheet).toHaveCount(0);
    await page.getByRole('button', { name: 'Mais ações de E2E Expirado' }).click();
    await expect(page.locator('.action-sheet .action-sheet-item')).toHaveText(['Editar', 'Excluir', 'Cancelar']);
  });

  test('Ver notas abre o texto completo em sheet', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.getByRole('button', { name: 'Mais ações de E2E Banco Zeta' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Ver notas' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet.locator('.notes-full-view')).toContainText('E2E nota do banco');
    await expect(sheet.locator('h3')).toContainText('E2E Banco Zeta');
  });

  test('Excluir pelo ⋯ pede confirmação e remove só aquele', async ({ page, request }) => {
    await apiJson(request, 'POST', '/cofre/', { titulo: 'E2E Apagar', servico: 'E2E', valor: 'x' });
    await gotoApp(page, '/cofre');
    const antes = await page.locator('.cofre-m-item').count();
    await page.getByRole('button', { name: 'Mais ações de E2E Apagar' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Sim, Excluir' }).click();
    await expect(linha(page, 'E2E Apagar')).toHaveCount(0);
    await expect(page.locator('.cofre-m-item')).toHaveCount(antes - 1);
    await expect(linha(page, 'E2E Banco Zeta')).toHaveCount(1);
  });

  test('olho pede confirmação e abre o segredo em sheet', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.getByRole('button', { name: 'Ver senha de E2E Banco Zeta' }).click();
    await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
    await expect(page.locator('.modal-overlay.is-sheet .secret-display-box')).toBeVisible();
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/cofre.mobile.spec.mjs`
Expected: FAIL — a página ainda renderiza a tabela (`.data-table` com 1 elemento; `.cofre-m-item` não existe).

- [ ] **Step 2: Componente da lista**

Criar `bussola_web/src/pages/Cofre/components/CofreLista.jsx`:

```jsx
import { useMemo, useState } from 'react';
import { ActionSheet } from '../../../components/mobile/ActionSheet';
import { filtrarSegredos, validadeInfo } from '../cofreLista';

/**
 * Lista compacta do Cofre no celular (estilo gerenciador de senhas): uma linha por segredo,
 * o olho como ação primária e o "⋯" com as demais. A linha em si não é clicável, para
 * nenhum toque acidental revelar uma senha.
 */
export function CofreLista({ segredos, onVer, onEditar, onNotas, onExcluir }) {
    const [busca, setBusca] = useState('');
    const [acoesDe, setAcoesDe] = useState(null);
    const visiveis = useMemo(() => filtrarSegredos(segredos, busca), [segredos, busca]);

    const acoes = acoesDe ? [
        { key: 'editar', icon: 'fa-solid fa-pencil', label: 'Editar', onClick: () => onEditar(acoesDe) },
        ...(acoesDe.notas
            ? [{ key: 'notas', icon: 'fa-solid fa-note-sticky', label: 'Ver notas', onClick: () => onNotas(acoesDe) }]
            : []),
        { key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: () => onExcluir(acoesDe.id) },
    ] : [];

    return (
        <div className="cofre-m">
            <label className="cofre-m-busca">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input
                    type="search"
                    className="form-input"
                    placeholder="Buscar por título ou serviço"
                    aria-label="Buscar segredos"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                />
            </label>

            {segredos.length === 0 ? (
                <div className="cofre-m-vazio">
                    <i className="fa-solid fa-shield-cat"></i>
                    <p>Nenhum segredo guardado no momento.</p>
                </div>
            ) : visiveis.length === 0 ? (
                <p className="cofre-m-nada">Nenhum segredo encontrado para “{busca.trim()}”.</p>
            ) : (
                <ul className="cofre-m-lista">
                    {visiveis.map((s) => {
                        const validade = validadeInfo(s.data_expiracao);
                        return (
                            <li key={s.id} className="cofre-m-item">
                                <span className="cofre-m-icone" aria-hidden="true">
                                    <i className="fa-solid fa-key"></i>
                                </span>
                                <div className="cofre-m-textos">
                                    <strong className="cofre-m-titulo">{s.titulo}</strong>
                                    <span className="cofre-m-sub">
                                        {s.servico && <span className="service-tag">{s.servico}</span>}
                                        {s.data_expiracao && (
                                            <span className={`cofre-m-validade is-${validade.nivel}`}>{validade.texto}</span>
                                        )}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="cofre-m-ver"
                                    aria-label={`Ver senha de ${s.titulo}`}
                                    onClick={() => onVer(s)}
                                >
                                    <i className="fa-solid fa-eye"></i>
                                </button>
                                <button
                                    type="button"
                                    className="cofre-m-mais"
                                    aria-label={`Mais ações de ${s.titulo}`}
                                    aria-haspopup="dialog"
                                    onClick={() => setAcoesDe(s)}
                                >
                                    <i className="fa-solid fa-ellipsis"></i>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <ActionSheet
                open={Boolean(acoesDe)}
                onClose={() => setAcoesDe(null)}
                title={acoesDe?.titulo}
                subtitle={acoesDe?.servico || undefined}
                icon="fa-solid fa-key"
                actions={acoes}
            />
        </div>
    );
}
```

- [ ] **Step 3: A página usa a lista no celular**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Cofre/index.jsx` por (a parte do desktop é a mesma marcação de antes, byte a byte):

```jsx
import React, { useEffect, useState } from 'react';
import { getSegredos, deleteSegredo } from '../../services/api'; // Removemos getSegredoValor daqui
import { logger } from '../../utils/logger';
import { SegredoModal } from './components/SegredoModal';
import { ViewSecretModal } from './components/ViewSecretModal'; // Novo Import
import { ViewNotesModal } from './components/ViewNotesModal';   // Novo Import
import { CofreLista } from './components/CofreLista';
import { Fab } from '../../components/mobile/Fab';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import './styles.css';

export function Cofre() {
    const [segredos, setSegredos] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estados dos Modais
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    
    const [viewSecretItem, setViewSecretItem] = useState(null); // Para modal de ver senha
    const [viewNotesItem, setViewNotesItem] = useState(null);   // Para modal de ver notas
    
    const { addToast } = useToast();
    const dialogConfirm = useConfirm();
    const isMobile = useIsMobile();

    const fetchData = async () => {
        try {
            const data = await getSegredos();
            setSegredos(data);
        } catch(err) {
            logger.error("Erro inesperado", { error: String(err) });
            addToast({type:'error', title:'Erro', description:'Falha ao carregar segredos.'});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Handler para abrir visualização de senha (com confirmação de segurança)
    const handleViewSecret = async (segredo) => {
        // Camada de Segurança Extra: Confirmação antes de chamar API
        const isConfirmed = await dialogConfirm({
            title: 'Visualizar Credencial?',
            description: 'Você está prestes a acessar uma informação sensível. Certifique-se de que ninguém está olhando.',
            confirmLabel: 'Visualizar',
            variant: 'info' // Azul para informação/acesso
        });

        if (isConfirmed) {
            setViewSecretItem(segredo);
        }
    };

    const handleDelete = async (id) => {
        const isConfirmed = await dialogConfirm({
            title: 'Excluir Segredo?',
            description: 'Esta ação removerá permanentemente a chave. Deseja continuar?',
            confirmLabel: 'Sim, Excluir',
            variant: 'danger'
        });

        if (!isConfirmed) return;

        try {
            await deleteSegredo(id);
            addToast({type:'success', title:'Excluído', description:'Segredo removido.'});
            fetchData();
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao excluir.'});
        }
    };

    const handleNew = () => { setEditingItem(null); setCreateModalOpen(true); };
    const handleEdit = (item) => { setEditingItem(item); setCreateModalOpen(true); };

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : 'Não expira';

    const LoadingState = () => (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--cor-texto-secundario)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginBottom: '15px', color: 'var(--cor-azul-primario)' }}></i>
            <p>Decifrando cofre...</p>
        </div>
    );

    return (
        <div className="container main-container cofre-scope">
            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-vault"></i> Meu Cofre</h1>
                </div>
            </div>
            <div className="cofre-content-wrapper">
                {isMobile ? (
                    loading ? (
                        <LoadingState />
                    ) : (
                        <CofreLista
                            segredos={segredos}
                            onVer={handleViewSecret}
                            onEditar={handleEdit}
                            onNotas={setViewNotesItem}
                            onExcluir={handleDelete}
                        />
                    )
                ) : (
                <>
                <div className="section-header-flex">
                    <h2>Lista de Segredos</h2>
                    <button className="btn-primary" onClick={handleNew}>
                        <i className="fa-solid fa-plus"></i> Guardar Segredo
                    </button>
                </div>

                <div className="table-container">
                    {loading ? (
                        <LoadingState />
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Título</th>
                                    <th>Serviço</th>
                                    <th className="column-notas">Notas</th>
                                    <th>Data de Expiração</th>
                                    <th style={{width: '150px', textAlign: 'right'}}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {segredos.length > 0 ? (
                                    segredos.map(segredo => (
                                        <tr key={segredo.id}>
                                            <td style={{fontWeight: '500'}}>{segredo.titulo}</td>
                                            <td>
                                                {segredo.servico ? <span className="service-tag">{segredo.servico}</span> : '-'}
                                            </td>
                                            
                                            {/* Coluna Notas Clicável */}
                                            <td className="column-notas" onClick={() => { if(segredo.notas) setViewNotesItem(segredo); }}>
                                                {segredo.notas ? (
                                                    <div className="notes-preview">
                                                        {segredo.notas}
                                                        <i className="fa-solid fa-expand notes-expand-icon"></i>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            
                                            <td style={{ color: segredo.data_expiracao ? 'var(--cor-laranja-aviso)' : 'inherit' }}>
                                                {fmtDate(segredo.data_expiracao)}
                                            </td>
                                            <td>
                                                <div className="action-buttons" style={{justifyContent: 'flex-end'}}>
                                                    {/* Botão Ver Senha (Eye) substitui Copiar */}
                                                    <button className="btn-action-icon btn-view-secret" onClick={() => handleViewSecret(segredo)} title="Ver/Copiar Senha">
                                                        <i className="fa-solid fa-eye"></i>
                                                    </button>
                                                    
                                                    <button className="btn-action-icon btn-edit-segredo" onClick={() => handleEdit(segredo)} title="Editar">
                                                        <i className="fa-solid fa-pencil"></i>
                                                    </button>
                                                    <button className="btn-action-icon btn-delete" onClick={() => handleDelete(segredo.id)} title="Excluir">
                                                        <i className="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="empty-state-cell">
                                            <i className="fa-solid fa-shield-cat" style={{fontSize: '2rem', marginBottom: '1rem', opacity: 0.5}}></i>
                                            <p>Nenhum segredo guardado no momento.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                </>
                )}
            </div>

            {isMobile && <Fab icon="fa-plus" label="Guardar segredo" onClick={handleNew} />}

            {/* Modais */}
            <SegredoModal 
                active={createModalOpen} 
                closeModal={() => setCreateModalOpen(false)} 
                onUpdate={fetchData} 
                editingData={editingItem} 
            />

            {viewSecretItem && (
                <ViewSecretModal 
                    segredoId={viewSecretItem.id} 
                    titulo={viewSecretItem.titulo} 
                    onClose={() => setViewSecretItem(null)} 
                />
            )}

            {viewNotesItem && (
                <ViewNotesModal 
                    notas={viewNotesItem.notas} 
                    titulo={viewNotesItem.titulo}
                    onClose={() => setViewNotesItem(null)} 
                />
            )}
        </div>
    );
}
```

Nota: o teste antigo `ui-lab.mobile.spec.mjs` › "modal real (Cofre, Guardar Segredo)" passa a clicar no Fab (o `getByRole` com `name: 'Guardar Segredo'` casa por substring sem diferenciar maiúsculas com o `aria-label="Guardar segredo"`). Não altere esse teste.

- [ ] **Step 4: CSS da lista (substitui o bloco mobile antigo)**

Em `bussola_web/src/pages/Cofre/styles.css`, substituir o trecho que começa em `/* Responsividade */` e vai até o **fim do arquivo** (o `@media (max-width: 768px)` antigo, com regras da tabela e o `.internal-hero` morto) por:

```css
/* ============================================= */
/* 7. CELULAR (≤768): LISTA COMPACTA             */
/* ============================================= */
@media (max-width: 768px) {
    .cofre-scope.main-container {
        padding-bottom: 0;
        min-height: 0;
    }

    .cofre-scope .cofre-content-wrapper {
        padding: 0;
    }

    .cofre-m {
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
        padding-top: var(--sp-4);
    }

    .cofre-m-busca {
        position: relative;
        display: block;
    }

    .cofre-m-busca > i {
        position: absolute;
        left: var(--sp-4);
        top: 50%;
        transform: translateY(-50%);
        color: var(--cor-texto-secundario);
        pointer-events: none;
    }

    .cofre-scope .cofre-m-busca .form-input {
        display: block;
        height: 48px;
        padding: 0 var(--sp-4) 0 calc(var(--sp-6) + var(--sp-3));
        border-radius: 12px;
        background-color: var(--cor-card-principal);
    }

    .cofre-m-lista {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        background: var(--cor-card-principal);
        border: 1px solid var(--cor-borda);
        border-radius: 16px;
        overflow: hidden;
    }

    .cofre-m-item {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        min-height: 64px;
        padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
    }

    .cofre-m-item + .cofre-m-item {
        border-top: 1px solid var(--cor-borda);
    }

    .cofre-m-icone {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: var(--cor-card-secundario);
        color: var(--cor-azul-primario);
        font-size: 0.95rem;
    }

    .cofre-m-textos {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--sp-1);
    }

    .cofre-m-titulo {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--cor-texto-principal);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .cofre-m-sub {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--sp-2);
        font-size: 0.75rem;
        color: var(--cor-texto-secundario);
        min-width: 0;
    }

    .cofre-m-sub:empty {
        display: none;
    }

    .cofre-m-validade.is-perto {
        color: var(--cor-laranja-aviso);
        font-weight: 600;
    }

    .cofre-m-validade.is-expirado {
        color: var(--cor-vermelho-delete);
        font-weight: 600;
    }

    .cofre-m-ver,
    .cofre-m-mais {
        width: var(--tap-min);
        height: var(--tap-min);
        flex-shrink: 0;
        border: none;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-size: 1rem;
        cursor: pointer;
    }

    .cofre-m-ver {
        background: rgba(var(--cor-tema-rgb), 0.15);
        color: var(--cor-azul-primario);
    }

    .cofre-m-mais {
        background: transparent;
        color: var(--cor-texto-secundario);
    }

    .cofre-m-nada {
        margin: 0;
        padding: var(--sp-5) var(--sp-4);
        text-align: center;
        font-size: 0.875rem;
        color: var(--cor-texto-secundario);
    }

    .cofre-m-vazio {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-6) var(--sp-4);
        text-align: center;
        font-size: 0.875rem;
        color: var(--cor-texto-secundario);
        background: var(--cor-card-principal);
        border: 1px solid var(--cor-borda);
        border-radius: 16px;
    }

    .cofre-m-vazio i {
        font-size: 2rem;
        opacity: 0.4;
        color: var(--cor-texto-principal);
    }
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/cofre.mobile.spec.mjs` → Expected: 2 + 13 passed. Se "alvos de toque" listar a `.service-tag` não (não é interativa); se listar algo, aumente o elemento listado (sem esconder).
Run: `npm run e2e -- --project=mobile e2e/ui-lab.mobile.spec.mjs` → Expected: tudo passa (o teste do Cofre abre pelo Fab).
Run: `npm run e2e -- --project=desktop` → Expected: 18 passed (`cofre.png` idêntico).

- [ ] **Step 6: Lint e commit**

Run: `npx eslint src/pages/Cofre` → Expected: o mesmo 1 erro pré-existente (`SegredoModal.jsx`) e nenhum novo.

```bash
git add bussola_web/src/pages/Cofre bussola_web/e2e/cofre.mobile.spec.mjs
git commit -m "feat(web): Cofre no celular em lista compacta (busca, olho primario, acoes no ⋯, Fab)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Formulário e notas em sheet (fechar real de 44px, teclado, sem autofocus)

**Files:**
- Modify: `bussola_web/src/pages/Cofre/components/SegredoModal.jsx`, `bussola_web/src/pages/Cofre/components/ViewNotesModal.jsx`, `bussola_web/src/assets/styles/components.css`, `bussola_web/src/pages/Cofre/styles.css`, `bussola_web/e2e/cofre.mobile.spec.mjs`

**Interfaces:**
- Consumes: `useMediaQuery` (`src/hooks/useIsMobile.js`).
- Produces: `button.close-btn[aria-label="Fechar"]` (reset visual igual ao antigo `<span>`; 44×44 em `pointer: coarse`); campos do `SegredoModal` com ids `segredo-titulo`, `segredo-servico`, `segredo-valor`, `segredo-dias`, `segredo-notas`.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/cofre.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 3 — formulário e notas em sheet
// ---------------------------------------------------------------------------
test.describe('formulário em sheet', () => {
  test('Fab abre o form: campos empilhados, atributos de teclado e sem autofocus', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.locator('.app-fab').click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    await expect(sheet.locator('h3')).toHaveText('Guardar Novo Segredo');
    await expect(page.locator('#segredo-titulo')).not.toBeFocused();
    const valor = page.locator('#segredo-valor');
    await expect(valor).toHaveAttribute('autocomplete', 'new-password');
    await expect(valor).toHaveAttribute('autocapitalize', 'off');
    await expect(valor).toHaveAttribute('autocorrect', 'off');
    await expect(valor).toHaveAttribute('spellcheck', 'false');
    await expect(page.locator('#segredo-servico')).toHaveAttribute('autocapitalize', 'off');
    await expect(page.locator('#segredo-dias')).toHaveAttribute('inputmode', 'numeric');
    const t = await page.locator('#segredo-titulo').boundingBox();
    const s = await page.locator('#segredo-servico').boundingBox();
    expect(Math.round(s.x)).toBe(Math.round(t.x));
    expect(s.y).toBeGreaterThan(t.y + t.height);
    expect(Math.round(s.width)).toBe(Math.round(t.width));
  });

  test('fechar é um <button> de 44px com rótulo "Fechar"', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.locator('.app-fab').click();
    const fechar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' });
    expect(await fechar.evaluate((e) => e.tagName)).toBe('BUTTON');
    const b = await fechar.boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    await fechar.click();
    await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  });

  test('alvos ≥ 44px no form novo e no de edição (senha travada)', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.locator('.app-fab').click();
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).click();
    await page.getByRole('button', { name: 'Mais ações de E2E Banco Zeta' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('.locked-input-wrapper')).toBeVisible();
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
  });

  test('teclado virtual: Salvar fica acima do teclado', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--vvh', '420px');
      document.documentElement.style.setProperty('--kb-inset', '424px');
    });
    await page.locator('.app-fab').click();
    const salvar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Salvar' });
    await expect(salvar).toBeVisible();
    await expect.poll(async () => { const b = await salvar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
  });

  test('criar pelo Fab e editar pelo ⋯', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.locator('.app-fab').click();
    await page.locator('#segredo-titulo').fill('E2E Criado no celular');
    await page.locator('#segredo-servico').fill('E2E Teste');
    await page.locator('#segredo-valor').fill('E2E-123');
    await page.locator('#segredo-dias').fill('10');
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Salvar' }).click();
    const novo = linha(page, 'E2E Criado no celular');
    await expect(novo).toHaveCount(1);
    await expect(novo.locator('.cofre-m-validade')).toHaveText('Expira em 10 dias');

    await page.getByRole('button', { name: 'Mais ações de E2E Criado no celular' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('#segredo-titulo')).toHaveValue('E2E Criado no celular');
    await page.locator('#segredo-titulo').fill('E2E Criado editado');
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Salvar' }).click();
    await expect(linha(page, 'E2E Criado editado')).toHaveCount(1);
    await expect(linha(page, 'E2E Criado no celular')).toHaveCount(0);
  });

  test('notas: fechar de 44px e texto sem rolagem interna dupla', async ({ page }) => {
    await gotoApp(page, '/cofre');
    await page.getByRole('button', { name: 'Mais ações de E2E Banco Zeta' }).click();
    await page.locator('.action-sheet').getByRole('button', { name: 'Ver notas' }).click();
    const sheet = page.locator('.modal-overlay.is-sheet');
    expect(await sheet.locator('.notes-full-view').evaluate((e) => getComputedStyle(e).maxHeight)).toBe('none');
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    await sheet.getByRole('button', { name: 'Fechar' }).first().click();
    await expect(sheet).toHaveCount(0);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/cofre.mobile.spec.mjs`
Expected: FAIL — `#segredo-titulo` não existe; o "×" é um `<span>` de ~24px; `.notes-full-view` tem `max-height: 60vh`.

- [ ] **Step 2: `button.close-btn` com o mesmo visual do `<span>`**

Em `bussola_web/src/assets/styles/components.css`, logo **depois** do bloco:

```css
.close-btn:hover {
    color: var(--cor-texto-principal);
}
```

inserir:

```css
/* Fechar como <button> real (acessível): o mesmo visual do antigo <span>.
   No toque, alvo de 44px sem aumentar o cabeçalho além do necessário. */
button.close-btn {
    background: none;
    border: 0;
    padding: 0;
    font-family: inherit;
    line-height: inherit;
}

@media (pointer: coarse) {
    button.close-btn {
        min-width: var(--tap-min);
        min-height: var(--tap-min);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: calc(-1 * var(--sp-2));
        flex-shrink: 0;
    }
}
```

- [ ] **Step 3: `SegredoModal` (fechar real, teclado, sem autofocus no toque, reset no render)**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Cofre/components/SegredoModal.jsx` por:

```jsx
import React, { useState } from 'react';
import { createSegredo, updateSegredo } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext'; // Importar Confirm
import { BaseModal } from '../../../components/BaseModal';
import { useMediaQuery } from '../../../hooks/useIsMobile';

// Campos que o teclado do celular não deve corrigir nem capitalizar.
const SEM_CORRECAO = { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false };

export function SegredoModal({ active, closeModal, onUpdate, editingData }) {
    const { addToast } = useToast();
    const confirm = useConfirm(); // Hook de segurança
    // No toque o autofocus abriria o teclado sozinho e cobriria metade do sheet.
    const isTouch = useMediaQuery('(pointer: coarse)');
    
    const [titulo, setTitulo] = useState('');
    const [servico, setServico] = useState('');
    const [valor, setValor] = useState('');
    const [diasExpirar, setDiasExpirar] = useState('');
    const [notas, setNotas] = useState('');
    
    const [showPassword, setShowPassword] = useState(false);
    
    // Controle de Edição de Senha
    // Se for criar (editingData null), é editável (true). Se for editar, começa travado (false).
    const [isPasswordEditable, setIsPasswordEditable] = useState(false);

    // Reinicia o formulário ao abrir (ou ao trocar o item em edição): ajuste no render, sem efeito.
    const chave = active ? (editingData ? `editar-${editingData.id}` : 'novo') : null;
    const [chaveAnterior, setChaveAnterior] = useState(null);
    if (chave !== chaveAnterior) {
        setChaveAnterior(chave);
        if (chave) {
            setTitulo(editingData ? editingData.titulo : '');
            setServico(editingData?.servico || '');
            setNotas(editingData?.notas || '');
            setValor('');
            setDiasExpirar('');
            setIsPasswordEditable(!editingData); // Trava a senha na edição, destrava na criação
            setShowPassword(false);
        }
    }

    if (!active) return null;

    // Função de Segurança para Destravar a Senha
    const handleUnlockPassword = async () => {
        const isConfirmed = await confirm({
            title: 'Alterar Senha?',
            description: 'Você está prestes a redefinir a credencial deste segredo. Deseja continuar?',
            confirmLabel: 'Sim, permitir edição',
            variant: 'warning'
        });

        if (isConfirmed) {
            setIsPasswordEditable(true);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let data_expiracao = null;
        if (diasExpirar && parseInt(diasExpirar) > 0) {
            const date = new Date();
            date.setDate(date.getDate() + parseInt(diasExpirar));
            data_expiracao = date.toISOString().split('T')[0];
        }

        const payload = { titulo, servico, notas, data_expiracao };
        
        // Só envia o valor se estiver editável e preenchido
        if (isPasswordEditable && valor) {
            payload.valor = valor;
        }

        try {
            if (editingData) {
                await updateSegredo(editingData.id, payload);
                addToast({type:'success', title:'Atualizado', description:'Segredo atualizado.'});
            } else {
                if (!valor) return addToast({type:'warning', title:'Atenção', description:'A senha é obrigatória.'});
                await createSegredo(payload);
                addToast({type:'success', title:'Guardado', description:'Novo segredo salvo.'});
            }
            onUpdate();
            closeModal();
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao salvar.'});
        }
    };

    return (
        <BaseModal onClose={closeModal} className="modal">
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{editingData ? 'Editar Segredo' : 'Guardar Novo Segredo'}</h3>
                    <button type="button" className="close-btn" onClick={closeModal} aria-label="Fechar">&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="segredo-titulo">Título</label>
                                <input id="segredo-titulo" className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} required autoFocus={!isTouch} autoComplete="off" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="segredo-servico">Serviço (Opcional)</label>
                                <input id="segredo-servico" className="form-input" value={servico} onChange={e => setServico(e.target.value)} autoComplete="off" {...SEM_CORRECAO} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="segredo-valor">Valor da Chave / Senha</label>
                            
                            {!isPasswordEditable ? (
                                // Estado Travado (Edição)
                                <div className="locked-input-wrapper" onClick={handleUnlockPassword}>
                                    <div className="fake-input-locked">
                                        <i className="fa-solid fa-lock"></i>
                                        <span>Senha oculta. Clique para redefinir.</span>
                                    </div>
                                    <button type="button" className="btn-secondary small">
                                        Alterar
                                    </button>
                                </div>
                            ) : (
                                // Estado Editável (Criação ou Destravado)
                                <div className="secret-input-wrapper" style={{display:'flex', gap:'10px'}}>
                                    <input 
                                        id="segredo-valor"
                                        type={showPassword ? "text" : "password"} 
                                        className="form-input" 
                                        value={valor} 
                                        onChange={e => setValor(e.target.value)} 
                                        placeholder={editingData ? "Digite a nova senha..." : "Cole a chave aqui..."}
                                        required={!editingData} // Obrigatório apenas na criação
                                        autoComplete="new-password"
                                        {...SEM_CORRECAO}
                                    />
                                    <button type="button" className="btn-action-icon" onClick={() => setShowPassword(!showPassword)} title={showPassword ? "Ocultar" : "Mostrar"} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                                        <i className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="segredo-dias">Expira em (dias) - Opcional</label>
                                <input id="segredo-dias" type="number" inputMode="numeric" pattern="[0-9]*" className="form-input" placeholder="Ex: 30" value={diasExpirar} onChange={e => setDiasExpirar(e.target.value)} min="0" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="segredo-notas">Notas (Opcional)</label>
                            <textarea id="segredo-notas" className="form-input" rows="2" value={notas} onChange={e => setNotas(e.target.value)}></textarea>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button type="submit" className="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
}
```

- [ ] **Step 4: `ViewNotesModal` com fechar real**

Em `bussola_web/src/pages/Cofre/components/ViewNotesModal.jsx`, substituir:

```jsx
                    <span className="close-btn" onClick={onClose}>&times;</span>
```

por:

```jsx
                    <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar">&times;</button>
```

E substituir:

```jsx
                    <button className="btn-secondary" onClick={onClose}>Fechar</button>
```

por:

```jsx
                    <button type="button" className="btn-secondary" onClick={onClose}>Fechar</button>
```

- [ ] **Step 5: CSS dos sheets do Cofre**

Em `bussola_web/src/pages/Cofre/styles.css`, ao **final** do arquivo, adicionar:

```css
/* ============================================= */
/* 8. MODAIS DA PÁGINA EM SHEET (≤768)           */
/* ============================================= */
@media (max-width: 768px) {
    .cofre-scope .modal-overlay.is-sheet .modal-header {
        padding: var(--sp-3) var(--sp-4);
        gap: var(--sp-3);
    }

    .cofre-scope .modal-overlay.is-sheet .modal-header h3 {
        margin: 0;
        min-width: 0;
        font-size: 1.05rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .cofre-scope .modal-overlay.is-sheet .modal-body {
        padding: var(--sp-4);
        gap: var(--sp-4);
    }

    /* Campos empilhados: título e serviço um embaixo do outro */
    .cofre-scope .modal-overlay.is-sheet .form-row {
        flex-direction: column;
        gap: var(--sp-4);
    }

    .cofre-scope .modal-overlay.is-sheet .secret-input-wrapper {
        align-items: center;
        gap: var(--sp-2) !important;
    }

    .cofre-scope .modal-overlay.is-sheet .locked-input-wrapper {
        min-height: 52px;
        height: auto;
        gap: var(--sp-2);
        padding: var(--sp-1) var(--sp-1) var(--sp-1) var(--sp-3);
    }

    .cofre-scope .modal-overlay.is-sheet .locked-input-wrapper .btn-secondary {
        min-height: var(--tap-min);
        flex-shrink: 0;
    }

    .cofre-scope .modal-overlay.is-sheet .modal-footer {
        padding-left: var(--sp-4);
        padding-right: var(--sp-4);
        gap: var(--sp-2);
    }

    .cofre-scope .modal-overlay.is-sheet .modal-footer > button {
        flex: 1;
        min-height: 48px;
    }

    /* Notas: só o corpo do sheet rola (sem rolagem dentro da rolagem) */
    .cofre-scope .notes-full-view {
        max-height: none;
    }
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/cofre.mobile.spec.mjs` → Expected: 2 + 13 + 6 passed.
Run: `npm run e2e -- --project=desktop` → Expected: 18 passed. **Atenção:** `modal-segredo.png`, `cofre-editar.png` e `cofre-notas.png` cobrem o `<span>` → `<button>`. Se algum diferir, ajuste só o reset de `button.close-btn` (ex.: `font-weight: inherit`, `color: inherit` antes do `.close-btn`) até ficar idêntico — **não** regenere a base.
Run: `npm run e2e -- --project=mobile` → Expected: tudo passa (outras páginas com `.close-btn` ainda são `<span>`, sem efeito).

- [ ] **Step 7: Lint e commit**

Run: `npx eslint src/pages/Cofre` → Expected: **0 erros** (o `set-state-in-effect` do `SegredoModal` sumiu).

```bash
git add bussola_web/src/pages/Cofre bussola_web/src/assets/styles/components.css bussola_web/e2e/cofre.mobile.spec.mjs
git commit -m "feat(web): form e notas do Cofre em sheet (fechar real de 44px, teclado sem correcao, sem autofocus no toque)" -m "lint Cofre: 1 -> 0 erros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ver segredo (valor grande, Revelar/Copiar de 48px, área de transferência limpa de verdade)

**Files:**
- Modify: `bussola_web/src/pages/Cofre/components/ViewSecretModal.jsx`, `bussola_web/src/pages/Cofre/styles.css`, `bussola_web/e2e/cofre.mobile.spec.mjs`

**Interfaces:**
- Consumes: `escreverClipboard` (Task 1), `getSegredoValor`.
- Produces: `ViewSecretModal({ segredoId, titulo, onClose })` — mesmas props. Comportamento: copiar só inicia o timer de 60s se a escrita deu certo; fechar (X, overlay, ESC, Voltar do Android → `onClose`) ou desmontar com cópia pendente escreve `''` e avisa "Área de transferência limpa." **só** se a escrita deu certo; senão avisa "Não foi possível limpar".

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/cofre.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 4 — ver segredo e área de transferência
// ---------------------------------------------------------------------------
async function abrirSegredo(page, titulo) {
  await page.getByRole('button', { name: `Ver senha de ${titulo}` }).click();
  await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
  await expect(page.locator('.modal-overlay.is-sheet .secret-display-box')).toBeVisible();
}
const toast = (page, texto) => page.locator('.toast-notification', { hasText: texto });
const clip = (page) => page.evaluate(() => window.__clip);

test.describe('ver segredo e área de transferência', () => {
  test('valor monoespaçado grande; Revelar e Copiar com 48px', async ({ page }) => {
    await stubClipboard(page);
    await gotoApp(page, '/cofre');
    await abrirSegredo(page, 'E2E Banco Zeta');
    const campo = page.locator('.modal-overlay.is-sheet .secret-field');
    expect(await campo.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/monospace|Courier/i);
    expect(await campo.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(20);
    const revelar = page.getByRole('button', { name: 'Revelar' });
    const copiar = page.getByRole('button', { name: 'Copiar', exact: true });
    expect((await revelar.boundingBox()).height).toBeGreaterThanOrEqual(48);
    expect((await copiar.boundingBox()).height).toBeGreaterThanOrEqual(48);
    await revelar.click();
    await expect(campo).toHaveText('E2E-senha-123');
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
  });

  test('fechar pelo X limpa a área de transferência e avisa', async ({ page }) => {
    await stubClipboard(page);
    await gotoApp(page, '/cofre');
    await abrirSegredo(page, 'E2E Banco Zeta');
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await expect(page.getByRole('button', { name: /Copiado \(60s\)/ })).toBeVisible();
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).click();
    await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
    await expect.poll(() => clip(page)).toEqual(['E2E-senha-123', '']);
    await expect(toast(page, 'Área de transferência limpa')).toBeVisible();
  });

  test('ESC também limpa', async ({ page }) => {
    await stubClipboard(page);
    await gotoApp(page, '/cofre');
    await abrirSegredo(page, 'E2E Banco Zeta');
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => clip(page)).toEqual(['E2E-senha-123', '']);
  });

  test('fechar sem ter copiado não mexe na área de transferência', async ({ page }) => {
    await stubClipboard(page);
    await gotoApp(page, '/cofre');
    await abrirSegredo(page, 'E2E Banco Zeta');
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).click();
    await page.waitForTimeout(300);
    expect(await clip(page)).toEqual([]);
    await expect(toast(page, 'Área de transferência limpa')).toHaveCount(0);
  });

  test('falha ao copiar: avisa e não inicia o timer', async ({ page }) => {
    await stubClipboard(page);
    await gotoApp(page, '/cofre');
    await abrirSegredo(page, 'E2E Banco Zeta');
    await page.evaluate(() => { window.__clipFalha = true; });
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await expect(toast(page, 'Não foi possível copiar')).toBeVisible();
    await expect(page.getByRole('button', { name: /Copiado/ })).toHaveCount(0);
  });

  test('falha ao limpar: avisa sem dizer que limpou', async ({ page }) => {
    await stubClipboard(page);
    await gotoApp(page, '/cofre');
    await abrirSegredo(page, 'E2E Banco Zeta');
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await page.evaluate(() => { window.__clipFalha = true; });
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).click();
    await expect(toast(page, 'Não foi possível limpar')).toBeVisible();
    await expect(toast(page, 'Área de transferência limpa')).toHaveCount(0);
  });

  test('o timer de 60s limpa e avisa', async ({ page }) => {
    await stubClipboard(page);
    // Timers falsos (o gotoApp só fixa a data e deixa os timers reais).
    await page.clock.install({ time: FIXED_NOW });
    await page.goto('/cofre');
    await page.waitForLoadState('networkidle');
    await abrirSegredo(page, 'E2E Banco Zeta');
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await expect(page.getByRole('button', { name: /Copiado \(60s\)/ })).toBeVisible();
    await page.clock.runFor(30_000);
    await expect(page.getByRole('button', { name: /Copiado \(30s\)/ })).toBeVisible();
    await page.clock.runFor(31_000);
    await expect.poll(() => clip(page)).toEqual(['E2E-senha-123', '']);
    await expect(toast(page, 'Área de transferência limpa')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copiar', exact: true })).toBeVisible();
    // Fechar depois do timer não limpa de novo
    await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).click();
    expect(await clip(page)).toEqual(['E2E-senha-123', '']);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/cofre.mobile.spec.mjs`
Expected: FAIL — fechar pelo X não escreve `''`; a falha ao copiar gera exceção não tratada (sem toast); o "×" ainda é `<span>` (sem botão "Fechar"); botões com 40px.

- [ ] **Step 2: Reescrever o `ViewSecretModal`**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Cofre/components/ViewSecretModal.jsx` por:

```jsx
import { useEffect, useRef, useState } from 'react';
import { getSegredoValor } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { BaseModal } from '../../../components/BaseModal';
import { escreverClipboard } from '../../../utils/clipboard';

const SEGUNDOS_LIMPEZA = 60;

const TOAST_LIMPO = { type: 'info', title: 'Segurança', description: 'Área de transferência limpa.' };
const TOAST_NAO_LIMPOU = {
    type: 'warning',
    title: 'Não foi possível limpar',
    description: 'Copie qualquer outro texto para tirar a senha da área de transferência.',
};

export function ViewSecretModal({ segredoId, onClose, titulo }) {
    const { addToast } = useToast();
    // `id` = segredo carregado; trocar o segredo mostra "carregando" sem setState no efeito.
    const [estado, setEstado] = useState({ id: null, valor: '' });
    const [isVisible, setIsVisible] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);
    // Cópia pendente de limpeza e o intervalo do contador (lidos também ao desmontar).
    const sessao = useRef({ pendente: false, intervalo: null });
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });
    const loading = estado.id !== segredoId;

    // Busca a senha ao abrir o modal
    useEffect(() => {
        let ativo = true;
        getSegredoValor(segredoId)
            .then((res) => { if (ativo) setEstado({ id: segredoId, valor: res.valor || '' }); })
            .catch(() => {
                if (!ativo) return;
                addToast({ type: 'error', title: 'Erro', description: 'Não foi possível decifrar o segredo.' });
                onCloseRef.current();
            });
        return () => { ativo = false; };
    }, [segredoId, addToast]);

    // Desmontou com cópia pendente (troca de rota, Voltar): limpa mesmo assim.
    useEffect(() => {
        const s = sessao.current;
        return () => {
            clearInterval(s.intervalo);
            if (!s.pendente) return;
            s.pendente = false;
            escreverClipboard('').then((ok) => addToast(ok ? TOAST_LIMPO : TOAST_NAO_LIMPOU));
        };
    }, [addToast]);

    // Chamada dentro do gesto (fechar) ou pelo timer. A escrita é feita antes do primeiro await,
    // então no gesto o Safari a aceita; só avisa "limpa" se ela realmente deu certo.
    const limparAgora = async () => {
        const s = sessao.current;
        clearInterval(s.intervalo);
        s.intervalo = null;
        if (!s.pendente) return;
        s.pendente = false;
        setTimeLeft(null);
        const ok = await escreverClipboard('');
        addToast(ok ? TOAST_LIMPO : TOAST_NAO_LIMPOU);
    };

    const handleCopy = async () => {
        if (!estado.valor) return;
        const ok = await escreverClipboard(estado.valor);
        if (!ok) {
            addToast({ type: 'error', title: 'Não foi possível copiar', description: 'Toque em Revelar e copie manualmente.' });
            return;
        }
        const s = sessao.current;
        s.pendente = true;
        clearInterval(s.intervalo);
        let restante = SEGUNDOS_LIMPEZA;
        setTimeLeft(restante);
        s.intervalo = setInterval(() => {
            restante -= 1;
            if (restante > 0) setTimeLeft(restante);
            else limparAgora();
        }, 1000);
        addToast({ type: 'success', title: 'Copiado', description: `Limpeza automática em ${SEGUNDOS_LIMPEZA}s ou ao fechar.` });
    };

    const fechar = () => {
        limparAgora();
        onClose();
    };

    return (
        <BaseModal onClose={fechar} className="modal view-secret-modal">
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <h3>Visualizar: {titulo}</h3>
                    <button type="button" className="close-btn" onClick={fechar} aria-label="Fechar">&times;</button>
                </div>
                
                <div className="modal-body view-secret-body">
                    {loading ? (
                        <div className="view-secret-loading">
                            <i className="fa-solid fa-circle-notch fa-spin"></i> Descriptografando...
                        </div>
                    ) : (
                        <div className="secret-display-box">
                            <div className="secret-field">
                                <span className={isVisible ? 'text-visible' : 'text-masked'}>
                                    {isVisible ? estado.valor : '•'.repeat(24)}
                                </span>
                            </div>
                            
                            <div className="secret-actions">
                                <button type="button" className="btn-secondary" onClick={() => setIsVisible(!isVisible)}>
                                    <i className={`fa-solid ${isVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    {isVisible ? 'Ocultar' : 'Revelar'}
                                </button>
                                
                                <button type="button" className="btn-primary" onClick={handleCopy}>
                                    <i className="fa-regular fa-copy"></i>
                                    {timeLeft ? `Copiado (${timeLeft}s)` : 'Copiar'}
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <p className="view-secret-aviso">
                        <i className="fa-solid fa-shield-halved"></i> Esta janela deve ser fechada após o uso.
                    </p>
                </div>
            </div>
        </BaseModal>
    );
}
```

- [ ] **Step 3: CSS (estilos inline viram classes; sheet com valor grande e botões de 48px)**

Em `bussola_web/src/pages/Cofre/styles.css`, logo **antes** do comentário `/* Modal de Notas Completas */`, inserir (mesmos valores dos antigos `style={{...}}`, para o desktop não mudar):

```css
/* Corpo do "Visualizar" (antes inline) */
.cofre-scope .view-secret-body {
    text-align: center;
    padding: 2rem 1.5rem;
}

.cofre-scope .view-secret-loading {
    color: var(--cor-texto-secundario);
}

.cofre-scope .view-secret-aviso {
    margin-top: 1.5rem;
    font-size: 0.8rem;
    color: var(--cor-texto-secundario);
}
```

E dentro do bloco `@media (max-width: 768px)` da seção **8. MODAIS DA PÁGINA EM SHEET** (Task 3), logo antes da chave final `}` do bloco, adicionar:

```css
    /* Visualizar segredo: valor grande e monoespaçado, ações de 48px */
    .cofre-scope .modal-overlay.is-sheet .view-secret-body {
        padding: var(--sp-5) var(--sp-4);
    }

    .cofre-scope .secret-display-box {
        padding: var(--sp-4);
        gap: var(--sp-4);
        margin-bottom: 0;
    }

    .cofre-scope .secret-field {
        font-size: 1.25rem;
        min-height: 72px;
        padding: var(--sp-4);
        user-select: all;
    }

    .cofre-scope .secret-actions {
        gap: var(--sp-2);
    }

    .cofre-scope .secret-actions button {
        height: 48px;
    }

    .cofre-scope .view-secret-aviso {
        margin-top: var(--sp-4);
    }
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/cofre.mobile.spec.mjs` → Expected: 2 + 13 + 6 + 7 passed.
Run: `npm run e2e -- --project=desktop` → Expected: 18 passed (`cofre-ver-segredo.png` idêntico: os inline viraram classes com os mesmos valores). Se diferir, compare as propriedades do antigo `style={{...}}` com a classe (não regenere).

- [ ] **Step 5: Lint e commit**

Run: `npx eslint src/pages/Cofre src/utils/clipboard.js` → Expected: 0 erros; os 2 warnings do `ViewSecretModal` sumiram (resta 1 warning pré-existente em `index.jsx`).

```bash
git add bussola_web/src/pages/Cofre bussola_web/e2e/cofre.mobile.spec.mjs
git commit -m "fix(web): Cofre limpa a area de transferencia ao fechar e pelo timer, verificando a escrita (Safari)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tablet, hover só com mouse e verificação final

**Files:**
- Create: `bussola_web/e2e/cofre.tablet.spec.mjs`
- Modify: `bussola_web/src/pages/Cofre/styles.css`

**Interfaces:**
- Consumes: `overflowOffenders`, `smallTargets`.
- Produces: no tablet, tabela sem overflow com células compactas e controles de 44px; destaque de hover (linha, notas, botões, senha travada) só com mouse (`hover: hover` e `pointer: fine`).

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/cofre.tablet.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';

for (const w of [900, 1024]) {
  test(`tablet ${w}px: tabela sem overflow e sem a lista do celular`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await gotoApp(page, '/cofre');
    await expect(page.locator('.data-table')).toBeVisible();
    await expect(page.locator('.cofre-m')).toHaveCount(0);
    await expect(page.locator('.app-fab')).toHaveCount(0);
    expect(await overflowOffenders(page)).toEqual([]);
  });
}

test('tablet: controles da página com 44px', async ({ page }) => {
  await gotoApp(page, '/cofre');
  expect(await smallTargets(page, '.cofre-scope .cofre-content-wrapper')).toEqual([]);
});

test('tablet: sem destaque de hover na linha (toque)', async ({ page }) => {
  await gotoApp(page, '/cofre');
  const row = page.locator('.data-table tbody tr').first();
  await row.hover();
  await page.waitForTimeout(250);
  expect(await row.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
});
```

Run: `npm run e2e -- --project=tablet e2e/cofre.tablet.spec.mjs`
Expected: FAIL — "Guardar Segredo" com 36px e destaque de hover aplicado no toque.

- [ ] **Step 2: Hover só com mouse**

Em `bussola_web/src/pages/Cofre/styles.css`, **remover** estas regras (cada uma com seu bloco `{ … }`): `.cofre-scope .data-table tr:hover`, `.cofre-scope .notes-preview:hover`, `.cofre-scope .btn-action-icon:hover`, `.cofre-scope .btn-view-secret:hover`, `.cofre-scope .btn-edit-segredo:hover`, `.cofre-scope .btn-delete:hover` e `.cofre-scope .locked-input-wrapper:hover`. Depois, logo **antes** do comentário `/* ============================================= */` + `/* 7. CELULAR (≤768): LISTA COMPACTA             */`, inserir o mesmo conteúdo dentro do gate:

```css
/* ============================================= */
/* 6b. HOVER SÓ COM MOUSE                        */
/* ============================================= */
@media (hover: hover) and (pointer: fine) {
    .cofre-scope .data-table tr:hover {
        background-color: var(--cor-fundo-hover);
    }

    .cofre-scope .notes-preview:hover {
        background-color: rgba(255, 255, 255, 0.05);
        color: var(--cor-texto-principal);
    }

    .cofre-scope .btn-action-icon:hover {
        background: var(--cor-fundo-hover);
        color: var(--cor-texto-principal);
        border-color: var(--cor-texto-secundario);
    }

    /* Botão Olho (Ver) */
    .cofre-scope .btn-view-secret:hover {
        color: var(--cor-azul-primario);
        background: rgba(59, 130, 246, 0.1);
        border-color: var(--cor-azul-primario);
    }

    .cofre-scope .btn-edit-segredo:hover {
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.1);
        border-color: #f59e0b;
    }

    .cofre-scope .btn-delete:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
        border-color: #ef4444;
    }

    .cofre-scope .locked-input-wrapper:hover {
        border-color: var(--cor-texto-secundario);
        background-color: rgba(255,255,255,0.05);
    }
}

/* ============================================= */
/* 6c. TABLET (769–1024) E TOQUE                 */
/* ============================================= */
@media (min-width: 769px) and (max-width: 1024px) {
    .cofre-scope .data-table th,
    .cofre-scope .data-table td {
        padding: var(--sp-3) var(--sp-4);
    }

    .cofre-scope .column-notas {
        max-width: 200px;
    }
}

@media (pointer: coarse) {
    .cofre-scope .section-header-flex .btn-primary {
        height: var(--tap-min);
    }
}
```

- [ ] **Step 3: Rodar os testes**

Run: `npm run e2e -- --project=tablet` → Expected: `cofre.tablet.spec.mjs` (4) e os demais `*.tablet.spec.mjs` passam.
Run: `npm run e2e -- --project=desktop` → Expected: 18 passed, incluindo "linha da tabela destaca no hover" e `cofre.png` idêntico.
Run: `npm run e2e -- --project=mobile` → Expected: tudo passa.

- [ ] **Step 4: Suíte completa, build e lint**

Run: `npm run e2e` → Expected: tudo passa nos 3 projetos.
Run: `npm run build` → Expected: OK.
Run: `npm run lint 2>&1 | Select-String " error " | Measure-Object` → Expected: contagem **1 menor** que a de antes do plano (o erro do `SegredoModal`); registre os dois números na mensagem do commit.
Run: `npm run e2e -- --project=desktop` mais uma vez, depois do `afterAll` do mobile → Expected: 18 passed (prova que os dados `E2E ` foram limpos).

- [ ] **Step 5: Conferência visual (360, 390, 430 e 900px)**

Com o app rodando, tire screenshots de `/cofre` em 360, 390 e 430 (`page.screenshot({ fullPage: true })` num script rápido em `test-results/`, ou DevTools) e **abra as imagens**. Confira contra o mockup aprovado (tela 6, opção "Lista compacta"):
- topbar "Cofre" com robô ausente e avatar; busca de largura total com 16px de gutter; 16px entre a busca e a lista;
- cada linha: ícone `fa-key` 36px, título 15px com reticências, serviço (pílula azul de sempre) e validade na mesma linha com 8px entre eles; "Expira em N dias" em laranja, "Expirou em …" em vermelho; olho azul de 44px e "⋯" de 44px à direita, 12px entre os elementos; linhas com 64px+ separadas por 1px;
- Fab no canto inferior direito acima da barra, sem cobrir o olho da última linha (role até o fim e confira; o `padding-bottom` do `.app-content` reserva o espaço);
- sheet "Guardar Novo Segredo": campos empilhados com 16px entre eles, Cancelar/Salvar 50/50 com 48px; com o teclado (Chrome DevTools → Sensors não simula; use `--vvh` como no teste) o Salvar fica visível;
- sheet "Visualizar": valor monoespaçado grande dentro do bloco de sempre, Revelar/Copiar de 48px lado a lado com 8px;
- 900px: tabela de sempre, sem estourar, botões de ação com 44px.
Qualquer valor fora da escala ou desalinhado: corrija o CSS e repita.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Cofre bussola_web/e2e/cofre.tablet.spec.mjs
git commit -m "feat(web): Cofre no tablet (44px) e hover so com mouse; verificacao final" -m "lint: <antes> -> <depois> erros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Decisões e suposições registradas neste plano

- **Ícone da linha = `fa-key`.** O controlador achou que não existia, mas ele já é usado em `Panorama/index.jsx` (card "Cofre de senhas"). Alternativa sem `fa-key`: `fa-lock` (usado no `SegredoModal`). `fa-vault` ficou para a página/navegação.
- **Topbar mostra "Cofre"** (rótulo do `NAV_ITEMS`), não "Meu Cofre" como diz a spec §5.6; o `h1` "Meu Cofre" continua no desktop. Mudar exigiria mudar o rótulo da navegação (afeta sidebar e "Mais").
- **"Perto" = de 0 a 30 dias** (`DIAS_ALERTA`), em laranja (`--cor-laranja-aviso`); expirado em vermelho (`--cor-vermelho-delete`); mais de 30 dias em cinza com a data. Sem validade, a linha não mostra nada (o desktop mostra "Não expira").
- **Data local no celular:** `validadeInfo` lê `AAAA-MM-DD` como data local. O desktop continua com `new Date(d)` (meia-noite UTC → mostra o **dia anterior** no Brasil). Não corrigi no desktop para não mudar `cofre.png`; é um bug real — o controlador decide se entra (exigiria regenerar `cofre.png` de propósito).
- **A linha não é tocável**: só o olho (ver) e o "⋯" agem, para nenhum toque acidental revelar senha. A confirmação "Visualizar Credencial?" continua também no celular.
- **Sem fallback `execCommand` no Cofre**: se `navigator.clipboard.writeText` falhar, o toast manda revelar e copiar à mão (o fallback por `<textarea>` deixaria a senha num elemento do DOM e não serve para limpar).
- **Atributos de teclado**: `autocomplete="new-password"` + `autoCapitalize/autoCorrect=off` + `spellCheck=false` no campo da senha; o serviço também sem correção/capitalização; o título só `autoComplete="off"` (é texto livre). Dias com `inputMode="numeric"` e `pattern="[0-9]*"`.
- **`button.close-btn` em `components.css`** (primitivo compartilhado): reset visual idêntico ao `<span>` e 44px em `pointer: coarse`. Só o Cofre troca o `<span>` por `<button>` neste plano; as outras páginas podem migrar depois sem CSS novo.
- **Reset do `SegredoModal`** saiu do `useEffect` (erro `set-state-in-effect`) para um ajuste no render com "chave anterior" (`editar-<id>` / `novo`); mesmo comportamento: reinicia ao abrir ou ao trocar o item.
- **Limpeza ao desmontar** (troca de rota, Voltar do Android): também avisa com toast, porque o `ToastProvider` vive acima da página.

## Rulings do controlador (vinculantes)

- Ícone da linha `fa-key` (já existe no código, Panorama): **aceito**. Título da topbar "Cofre" (rótulo da navegação): **aceito**.
- **Validade exibida um dia antes (parse UTC):** é bug real visível ao usuário → **corrigir também no desktop** (mesma função de data para as duas visões). Regenerar **somente** a base `cofre` (e qualquer modal do Cofre afetado) com `e2e:update` filtrado, no mesmo commit da correção, explicando no corpo do commit que a mudança é a data correta.
