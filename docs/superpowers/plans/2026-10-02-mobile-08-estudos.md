# Mobile 08: Estudos (biblioteca, leitura e kit), plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o módulo Estudos (`/estudos`, `/estudos/:id`, `/estudos/kit`) utilizável no celular com as mesmas regras das outras páginas (gutter de 16px, cards atuais em 1 coluna, ações visíveis e de 44px, sheets) e dar às sub-rotas (kit e leitura) **título próprio e botão Voltar na topbar mobile**, por uma API pequena e genérica em `MobileChrome.jsx` (`<TopbarTitle title backTo />`) implementada no shell (`MobileTopbar`). O renderer de blocos e a gramática inline **não mudam de lógica** (`node scripts/verificar-estudos.mjs` continua passando). Desktop (≥1025) idêntico.

**Architecture:**
- **Topbar das sub-rotas:** `MobileChrome.jsx` ganha um store mínimo fora do React (`TopbarTitle` escreve num `useLayoutEffect`; `useTopbarOverride()` lê com `useSyncExternalStore`) — sem `setState` em efeito. O `Navbar` passa `title` e `onBack` para o `MobileTopbar`, que desenha um `button[aria-label="Voltar"]` com `fa-arrow-left` antes do título. O Voltar usa o histórico do app (`navigate(-1)`) quando há página anterior e, num link direto, substitui a entrada por `backTo`.
- **Biblioteca, leitura e kit:** só CSS novo (blocos `@media (pointer: coarse)` para os alvos de 44px, que valem no celular e no tablet, e `@media (max-width: 768px)` para o layout), mais três mudanças de JSX: `aria-label`/`data-offscreen-ok` na faixa de temas, a classe `estudos-kit-voltar` no link "Biblioteca" do kit e o `<TopbarTitle>` no kit e na leitura.
- **"Pedir ao Claude"** (`PedirAoClaude.jsx`): no celular o menu vira um `<Sheet>` com as linhas do `ActionSheet` (`.action-sheet-item`) e, em "Tirar dúvida", o "Copiar comando" no rodapé do sheet (alcançável com o teclado). No desktop o popover continua igual.
- **Hover:** os `:hover` de Estudos (`styles.css` e `blocos/blocos.css`) passam a ficar **no mesmo lugar** dentro de `@media (hover: hover) and (pointer: fine)` (preserva a ordem da cascata; o desktop não muda).
- **Dados de teste:** a API REST de Estudos não cria materiais (quem cria é o Claude pelo MCP) e o banco demo não tem nenhum. Os testes **interceptam a API** com `page.route` (fixture `e2e/fixtures/estudos.mjs`): nada é gravado no banco, nada a limpar.

**Tech Stack:** React 19, react-router-dom 7 (`BrowserRouter`), Vite 7, CSS puro, Font Awesome (npm), highlight.js, `@playwright/test` 1.63.

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-responsivo-design.md` (§2 restrições, §4 fundação, §5.6b Estudos, §6 tablet, §8 verificação). Módulo: `docs/ESTUDOS.md`.
**Planos anteriores:** `2026-10-02-mobile-01-fundacao-shell.md` (implementado) e `2026-10-02-mobile-02-provisoes.md` (cria em `e2e/helpers.mjs` → `authHeaders`, `apiJson`, `smallTargets`, e `src/components/mobile/Segmented.jsx`; já existirão quando este plano for executado — **reusar, não recriar**). O plano 07 (Cofre) roda antes e não toca nos mesmos arquivos.

## Global Constraints

- **Branch:** `feat/mobile-responsivo` (worktree `.claude/worktrees/mobile-responsivo`). Um commit por task. **Nunca** fazer push nem merge em `main`. Nunca usar `git stash`.
- **Commits** terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use um segundo `-m`).
- **Não redesenhar cards existentes:** `estudo-card` (borda superior na cor do tema, etiqueta de tipo, check de estudado, rodapé de chips), `kit-card` e os blocos (conceito, definição, analogia, passos, código, comparação, decisão, lista, alerta, quiz, questão aberta). Só espaçamento, tamanho mínimo de texto, quebra de linha, alvo de toque e ações visíveis.
- **Não mudar a lógica** de `blocos/BlocoRenderer.jsx`, `blocos/inline.js`, `blocos/TextoInline.jsx`, dos componentes de bloco e de `comandos.js`. `node scripts/verificar-estudos.mjs` passa em toda task.
- **Ícones:** só classes Font Awesome que já existem no código. Usadas neste plano: `fa-arrow-left` (Voltar; já usado em `Kit.jsx`, `Leitura.jsx`, `MetasModal.jsx`), `fa-graduation-cap`, `fa-wand-magic-sparkles`, `fa-copy` (`fa-regular`), `fa-download`, e os já usados pelas páginas (`fa-chalkboard-user`, `fa-file-lines`, `fa-code-compare`, `fa-pen-to-square`, `fa-layer-group`, `fa-feather`, `fa-list-check`, `fa-book-bookmark`, `fa-circle-question`, `fa-check`, `fa-circle-check`, `fa-trash-can`).
- **Espaçamento (tokens `--sp-1..6` = 4/8/12/16/24/32):** 8 dentro de um card, 12 entre cards, 16 de gutter e entre blocos da página, 24 entre seções. Nenhum valor solto fora da escala no CSS novo, exceto tamanhos de controle (36/44/48/52/56px) e raios.
- **Toque:** alvo ≥ 44×44 em tudo que é interativo (exceção: citações `[n]` e a âncora `#` decorativa da seção, que são inline no texto); inputs com 16px (já garantido por `tokens.css`); nada só no hover.
- **Tipografia mobile:** conteúdo principal ≥ 14px (texto do material 16px), secundário ≥ 12px, 11px só em rótulos em caixa alta (`.bloco-rotulo`, `.pedir-claude-alvo`).
- **Desktop (≥1025):** visualmente idêntico. Os 13 PNGs de `e2e/desktop-visual.desktop.spec.mjs-snapshots/` (inclui `estudos.png`, biblioteca vazia) e os 3 novos de `estudos.desktop.spec.mjs-snapshots/` (Task 1) passam em toda task. Tablet (769–1024) segue a spec §6.
- **Sem mudança de API/backend.**
- **Dados de teste:** só `page.route` (fixture). Nenhum dado gravado; o `estudos.png` do desktop (biblioteca vazia, banco real) não é afetado.
- **Lint:** `npx eslint <arquivos tocados>` sem **novos** erros. Linha de base medida: `src/pages/Estudos` = 0 problemas; `src/components/mobile` = 0; `src/components/Navbar` = 1 erro pré-existente (`index.jsx:62`, `set-state-in-effect`, efeito do tema). Regras v7: sem `setState` síncrono em `useEffect`, sem mutar acumuladores no render, `catch {` sem variável.
- **Build:** `npm run build` passa.

## API real dos primitivos (lida do código, use exatamente isto)

- `useIsMobile()` / `useIsTablet()` / `useMediaQuery(query)` de `src/hooks/useIsMobile.js`.
- `Sheet({ open, onClose, title, ariaLabel, children, footer, full, className })`: **portal** para o `body` (fica fora de `.estudos-scope`); `null` se `!open`; cabeçalho com h3 + `button.app-sheet-close[aria-label="Fechar"]` só se houver `title`; corpo `.modal-body.app-sheet-body`; rodapé `.modal-footer.app-sheet-footer` (filhos `flex:1; min-height:48px`). Eventos React sobem pela árvore React mesmo pelo portal: não renderize dentro de elemento clicável.
- `ActionSheet`: linhas `button.action-sheet-item` (52px) dentro de `.action-sheet-list` — classes globais de `mobile.css`, reaproveitadas no sheet do "Pedir ao Claude".
- `MobileChrome.jsx` hoje: `MobileChromeProvider` (guarda `slotEl`), `useMobileChrome()`, `TopbarActions({ children })` (portal para o slot da topbar). O provider envolve `Navbar` + página em `PrivateRoute` (`routes/index.jsx`).
- `MobileTopbar({ title, aiContext, user, onOpenAccount, slotRef, onOpenAi })` (`components/Navbar/MobileTopbar.jsx`): `header.m-topbar > h1.m-topbar-title + .m-topbar-actions`. O `Navbar` passa `title={current?.rotulo ?? 'Bússola'}`, com `current = findNavItem(pathname)`; para `/estudos/kit` e `/estudos/:id` o `findNavItem` devolve o item Estudos (por `startsWith`), então hoje as três rotas mostram "Estudos".
- `global.css` no celular: `.page-header-main h1 { display: none }` e `.page-header:not(:has(.page-header-kpis)) { display: none }` — a biblioteca e o kit têm KPIs, então o cabeçalho aparece só com os chips; a leitura não usa `.page-header` (o `h1` dela é o título do material).
- `react-router-dom` 7 com `BrowserRouter`: `window.history.state` = `{ usr, key, idx }`; `idx > 0` = há página anterior do app nesta aba.
- **Ordem do CSS:** `Estudos/styles.css` e `blocos/blocos.css` (este último importado pela leitura, depois do `styles.css`) vêm antes de `mobile.css` → `components.css` → `global.css`. `.ph-kpi` e `.btn-*` vivem em `global.css` (último): para vencer use mais especificidade.
- `e2e/helpers.mjs`: `gotoApp`, `FIXED_NOW`, `overflowOffenders` (ignora `[data-offscreen-ok]`), e do plano 02 `apiJson`, `smallTargets(page, rootSelector)` (lista `tag.classes "nome" LxA`).
- API REST (`/api/v1/estudos`): `GET /temas`, `GET /materiais` (sem params no site), `GET /materiais/{id}`, `PATCH /materiais/{id}/estudado` `{ estudado }`, `POST /materiais/{id}/respostas`, `DELETE /materiais/{id}`, `GET /kit/versao` → `{ versao }`, `GET /kit/instrucoes-projeto` → `{ texto }`, `GET /kit/{alvo}.zip`. O site chama `http://127.0.0.1:8000/api/v1/...` em dev.
- Projetos Playwright: `*.mobile.spec.mjs` (390×844, touch, `pointer: coarse`, `hover: none`), `*.tablet.spec.mjs` (900×1200, touch), `*.desktop.spec.mjs` (1280×900, mouse).

## Auditoria (360/390/430, lendo JSX e CSS)

| Onde | Problema | Correção (task) |
|---|---|---|
| `.estudos-wrapper`, `.estudo-leitura` | `padding: 0 1rem` (≤860) **soma** com os 16px do `.container` → 32px de gutter | `padding: 0` ≤768 (T3/T4) |
| `.estudos-temas` (≤860) | botões em `flex-wrap` com ~34px de altura, h2 "Temas" ocupando uma linha | faixa horizontal rolável de pílulas de 44px, h2 oculto, `aria-label` (T3) |
| `.estudos-chip`, `.estudos-check`, Kit "Kit do Claude" | 30–34px | 44px no toque (T3) |
| `.estudo-card` | `:hover` com `translateY` (fica "preso" no toque); chips do rodapé com 11.5px | hover só com mouse; 12px (T3) |
| Topbar | as 3 rotas mostram "Estudos", sem Voltar; o kit esconde o próprio h1 e a leitura só tem breadcrumb | `TopbarTitle` + Voltar (T2); breadcrumb oculto ≤768 (T4) |
| `.estudo-acoes` | 4 controles em `flex-wrap` de alturas diferentes (36/40px), lixeira 34px, destino 32px | grade: Estudado + lixeira / Pedir ao Claude / destino, tudo 44px (T4) |
| `PedirAoClaude` | popover `position:absolute; min-width:260px` que vaza da tela; "Copiar comando" de 30px; textarea com `autoFocus` | `<Sheet>` no celular, rodapé com o botão, sem autofocus (T4) |
| Blocos | texto sem `overflow-wrap` (URL/identificador longo estoura); copiar código 24px; `btn-pequeno` 30px; gatilho por bloco 32px | `overflow-wrap:anywhere` na coluna (tabela fora), 44px no toque (T4) |
| `.kit-grade` | `minmax(320px, 1fr)` estoura abaixo de 352px úteis; botões de baixar com largura do texto; copiar comando ~22px | 1 coluna, botões de largura total 48px, copiar 44px (T5) |

## Review Focus

1. **Voltar da topbar leva ao lugar errado** (perde o filtro `?tema=`, empilha a biblioteca de novo, ou o título de uma rota fica "preso" na próxima). Teste na Task 2 › "leitura: topbar com o tema e Voltar preserva o filtro", "kit por link direto…" e "trocar de rota pela barra inferior limpa o título".
2. **Conteúdo do material estoura a largura** (palavra longa, código, tabela de comparação) ou fica cortado. Teste na Task 4 › "sem overflow fora dos blocos roláveis em …px" e "comparação e código rolam dentro do bloco".
3. **"Pedir ao Claude" no celular** copia o comando errado (material × bloco, destino) ou o "Copiar comando" fica atrás do teclado. Teste na Task 4 › "Pedir ao Claude do bloco copia o comando do bloco", "Tirar dúvida: sem autofocus e Copiar comando acima do teclado".
4. **Lógica do renderer/gramática alterada sem querer.** Teste: `node scripts/verificar-estudos.mjs` em toda task + base visual `estudos-leitura.png` (Task 1) no desktop.
5. **Regressão no desktop** pelo gate de hover (ordem da cascata: tema/chip ativo sob o mouse), pelo ramo mobile do `PedirAoClaude` e pelo `TopbarTitle`. Teste na Task 1 › `estudos.desktop.spec.mjs` (3 bases, popover, ações do bloco no hover) em toda task via `--project=desktop`.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `bussola_web/e2e/fixtures/estudos.mjs` | criar | dados falsos (temas, materiais, material completo), `mockEstudos(page)`, `stubClipboard(page)` |
| `bussola_web/e2e/helpers.mjs` | modificar | + `overflowOffendersOutsideScrollers(page)` |
| `bussola_web/e2e/estudos.desktop.spec.mjs` | criar | base visual de biblioteca/kit/leitura + popover + hover |
| `bussola_web/e2e/estudos.mobile.spec.mjs` | criar | helper, topbar, biblioteca, leitura, kit |
| `bussola_web/e2e/estudos.tablet.spec.mjs` | criar | 900/1024 sem overflow, 44px, ações visíveis sem hover |
| `bussola_web/src/components/mobile/MobileChrome.jsx` | modificar | + `TopbarTitle`, `useTopbarOverride` |
| `bussola_web/src/components/Navbar/MobileTopbar.jsx` | modificar | botão Voltar opcional (`onBack`) |
| `bussola_web/src/components/Navbar/index.jsx` | modificar | título/Voltar da sub-rota na topbar |
| `bussola_web/src/components/mobile/mobile.css` | modificar | `.m-topbar-lead`, `.m-topbar-back` |
| `bussola_web/src/pages/Estudos/index.jsx` | modificar | `aria-label` + `data-offscreen-ok` na faixa de temas |
| `bussola_web/src/pages/Estudos/Kit.jsx` | modificar | `TopbarTitle`; classe `estudos-kit-voltar` |
| `bussola_web/src/pages/Estudos/Leitura.jsx` | modificar | `TopbarTitle` (tema ou "Estudos") |
| `bussola_web/src/pages/Estudos/PedirAoClaude.jsx` | modificar | menu em `<Sheet>` no celular |
| `bussola_web/src/pages/Estudos/styles.css` | modificar | gate de hover, toque 44px, layout ≤768 |
| `bussola_web/src/pages/Estudos/blocos/blocos.css` | modificar | gate de hover, toque 44px, coluna ≤768 |

---

### Task 1: Base visual do desktop, fixture de dados e helper de overflow

**Files:**
- Create: `bussola_web/e2e/fixtures/estudos.mjs`, `bussola_web/e2e/estudos.desktop.spec.mjs`, `bussola_web/e2e/estudos.mobile.spec.mjs`
- Modify: `bussola_web/e2e/helpers.mjs`

**Interfaces:**
- Produces:
  - `TEMAS`, `MATERIAIS` (5 resumos: ids 9101–9105; 9102 estudado; 9105 sem tema), `BLOCOS` (13 blocos `b1..b13`), `FONTES`, `mockEstudos(page, { materiais = MATERIAIS } = {})` (intercepta temas, lista, detalhe por id — 404 para id desconhecido —, `PATCH estudado`, `POST respostas`, `DELETE`, kit `versao`/`instrucoes-projeto`/`*.zip`), `stubClipboard(page)` (`window.__clip`, `window.__clipFalha`).
  - `overflowOffendersOutsideScrollers(page)`: como `overflowOffenders`, mas aceita elementos dentro de um ancestral com `overflow-x: auto|scroll` que caiba na tela.

- [ ] **Step 1: Fixture de dados (API interceptada)**

Criar `bussola_web/e2e/fixtures/estudos.mjs`:

```js
// Dados falsos do módulo Estudos. A API REST não cria materiais (quem cria é o Claude pelo MCP)
// e o banco demo não tem nenhum: os testes interceptam a API e nada é gravado.
export const TEMAS = [
  { id: 901, nome: 'Banco de Dados', cor: '#4A6DFF', icone: null, descricao: null, total_materiais: 2 },
  { id: 902, nome: 'Redes de Computadores e Protocolos da Internet', cor: '#a855f7', icone: null, descricao: null, total_materiais: 1 },
  { id: 903, nome: 'Matemática', cor: '#10b981', icone: null, descricao: null, total_materiais: 1 },
];

const base = { tags: [], estudado: false, estudado_em: null, criado_em: '2026-09-30T10:00:00' };

export const MATERIAIS = [
  { ...base, id: 9101, tipo: 'aula', nivel: 'intermediario', tema_id: 901, tema_nome: 'Banco de Dados', tema_cor: '#4A6DFF',
    titulo: 'Índices B-tree e Hash: quando usar cada um em consultas reais',
    subtitulo: 'Estruturas, custos e armadilhas de escrita em tabelas grandes', tags: ['postgres', 'indices', 'desempenho', 'sql'] },
  { ...base, id: 9102, tipo: 'resumo', nivel: 'iniciante', tema_id: 901, tema_nome: 'Banco de Dados', tema_cor: '#4A6DFF',
    titulo: 'Resumo: normalização', subtitulo: null, tags: ['modelagem'], estudado: true, estudado_em: '2026-10-01T09:00:00' },
  { ...base, id: 9103, tipo: 'comparativo', nivel: 'avancado', tema_id: 902, tema_nome: 'Redes de Computadores e Protocolos da Internet', tema_cor: '#a855f7',
    titulo: 'TCP vs UDP', subtitulo: 'Confiabilidade, latência e quando cada um vence', tags: ['redes'] },
  { ...base, id: 9104, tipo: 'exercicios', nivel: 'intermediario', tema_id: 903, tema_nome: 'Matemática', tema_cor: '#10b981',
    titulo: 'Exercícios de limites', subtitulo: null, tags: [] },
  { ...base, id: 9105, tipo: 'aula', nivel: 'avancado', tema_id: null, tema_nome: null, tema_cor: null,
    titulo: 'Material sem tema com um título bem comprido para testar a quebra de linha no celular', subtitulo: null, tags: ['avulso'] },
];

export const BLOCOS = [
  { id: 'b1', tipo: 'secao', titulo: 'Formatação inline' },
  { id: 'b2', tipo: 'texto', conteudo: 'Texto com **negrito**, *itálico*, `código` e citações [1] e [2].\n\nSegundo parágrafo com um identificador_muito_longo_sem_espacos_para_testar_a_quebra_no_celular_0123456789.' },
  { id: 'b3', tipo: 'conceito', titulo: 'Índice', texto: 'Estrutura auxiliar que evita ler a tabela inteira [1].' },
  { id: 'b4', tipo: 'analogia', texto: 'Como o índice remissivo no fim de um livro.' },
  { id: 'b5', tipo: 'definicao', termo: 'B-tree', definicao: 'Árvore balanceada com nós de muitas chaves [2].' },
  { id: 'b6', tipo: 'passos', passos: [
    { titulo: 'Raiz', texto: 'Compara a chave com os separadores.' },
    { titulo: 'Folha', texto: 'Chega à página com o ponteiro para a linha [2].' },
  ] },
  { id: 'b7', tipo: 'codigo', linguagem: 'sql', legenda: 'Índice parcial composto',
    codigo: 'CREATE INDEX idx_usuario_email_criado_em ON usuario (email, criado_em) WHERE ativo = true;\n' },
  { id: 'b8', tipo: 'comparacao', colunas: ['B-tree (padrão)', 'Hash', 'GIN (texto)', 'BRIN (blocos)'], linhas: [
    { rotulo: 'Intervalos', valores: ['sim', 'não', 'não', 'sim, aproximado'], destaque: 0 },
    { rotulo: 'Igualdade', valores: ['O(log n)', 'O(1) médio', 'depende do operador', 'aproximado'], destaque: 1 },
  ] },
  { id: 'b9', tipo: 'decisao', regras: [
    { se: 'Consulta por intervalo', entao: 'use **B-tree**' },
    { se: 'Só igualdade em tabela enorme', entao: 'considere *hash*' },
  ] },
  { id: 'b10', tipo: 'lista', itens: ['Colunas do WHERE', 'Colunas do JOIN [1]'], estilo: 'checklist' },
  { id: 'b11', tipo: 'alerta', nivel: 'atencao', titulo: 'Armadilha', texto: 'Índice demais deixa INSERT lento [1].' },
  { id: 'b12', tipo: 'quiz', pergunta: 'Qual índice atende BETWEEN?', opcoes: ['Hash', 'B-tree', 'Nenhum'], correta: 1,
    explicacao: 'Hash só atende igualdade [1].' },
  { id: 'b13', tipo: 'questao_aberta', pergunta: 'Por que índices deixam escritas mais lentas?',
    resposta_modelo: 'Cada INSERT/UPDATE também atualiza a estrutura do índice [2].' },
];

export const FONTES = [
  { titulo: 'PostgreSQL Docs — Index Types', url: 'https://www.postgresql.org/docs/current/indexes-types.html' },
  { titulo: 'Use The Index, Luke — Anatomy of an Index', url: 'https://use-the-index-luke.com/sql/anatomy' },
];

const API = /^http:\/\/127\.0\.0\.1:8000\/api\/v1\/estudos/;
const rota = (sufixo) => new RegExp(`${API.source}${sufixo}`);

export async function mockEstudos(page, { materiais = MATERIAIS } = {}) {
  await page.route(rota('/temas(\\?.*)?$'), (r) => r.fulfill({ json: TEMAS }));
  await page.route(rota('/materiais(\\?.*)?$'), (r) => r.fulfill({ json: materiais }));
  await page.route(rota('/materiais/(\\d+)$'), (r) => {
    const id = Number(r.request().url().match(/materiais\/(\d+)$/)[1]);
    const resumo = materiais.find((m) => m.id === id);
    if (!resumo) return r.fulfill({ status: 404, json: { detail: 'Material não encontrado' } });
    if (r.request().method() === 'DELETE') return r.fulfill({ status: 204, body: '' });
    return r.fulfill({ json: { ...resumo, blocos: BLOCOS, fontes: FONTES } });
  });
  await page.route(rota('/materiais/(\\d+)/estudado$'), (r) => {
    const { estudado } = r.request().postDataJSON();
    return r.fulfill({ json: { estudado, estudado_em: estudado ? '2026-10-02T12:00:00' : null } });
  });
  await page.route(rota('/materiais/(\\d+)/respostas$'), (r) => r.fulfill({
    status: 201,
    json: { id: 1, material_id: 9101, bloco_id: 'b12', resposta: 1, acertou: true, respondido_em: '2026-10-02T12:00:00' },
  }));
  await page.route(rota('/kit/versao$'), (r) => r.fulfill({ json: { versao: '1.0.0' } }));
  await page.route(rota('/kit/instrucoes-projeto$'), (r) => r.fulfill({ json: { texto: 'Instruções de teste do Projeto Estudos.' } }));
  await page.route(rota('/kit/[a-z-]+\\.zip$'), (r) => r.fulfill({ status: 200, contentType: 'application/zip', body: Buffer.from('PK') }));
}

// Área de transferência falsa: registra as escritas e pode falhar.
export async function stubClipboard(page) {
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
```

- [ ] **Step 2: Helper de overflow que aceita rolagem horizontal interna**

Ao **final** de `bussola_web/e2e/helpers.mjs`, adicionar:

```js
// Como overflowOffenders, mas aceita o que está dentro de um contêiner com rolagem horizontal
// própria (tabela ou código que rola dentro do bloco), desde que o contêiner caiba na tela.
export async function overflowOffendersOutsideScrollers(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const out = [];
    const isOut = (r) => r.right > vw + 1 || r.left < -1;
    const dentroDeRolagem = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && !isOut(p.getBoundingClientRect())) return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || !isOut(r)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[data-offscreen-ok]')) continue;
      if (dentroDeRolagem(el)) continue;
      const p = el.parentElement;
      if (p && isOut(p.getBoundingClientRect())) continue;
      out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    }
    return out;
  });
}
```

- [ ] **Step 3: Spec de base visual (desktop)**

Criar `bussola_web/e2e/estudos.desktop.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { mockEstudos } from './fixtures/estudos.mjs';

// Base gerada ANTES de mexer no código, com dados interceptados (o banco demo não tem materiais).
const PAGINAS = [
  ['estudos-biblioteca', '/estudos', '.estudo-card'],
  ['estudos-kit', '/estudos/kit', '.kit-card'],
  ['estudos-leitura', '/estudos/9101', '.bloco-quiz'],
];

for (const [nome, rota, pronto] of PAGINAS) {
  test(`desktop ${nome} inalterado`, async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, rota);
    await page.locator(pronto).first().waitFor();
    await expect(page).toHaveScreenshot(`${nome}.png`, { fullPage: true });
  });
}

test('desktop estudos: "Pedir ao Claude" abre o popover (não um sheet)', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos/9101');
  await page.locator('.estudo-acoes .pedir-claude-gatilho').click();
  await expect(page.locator('.pedir-claude-menu')).toBeVisible();
  await expect(page.locator('.app-sheet')).toHaveCount(0);
});

test('desktop estudos: ações do bloco aparecem no hover', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos/9101');
  const bloco = page.locator('#bloco-b3');
  const opacity = () => bloco.locator('.estudo-bloco-acoes').evaluate((e) => getComputedStyle(e).opacity);
  expect(await opacity()).toBe('0');
  await bloco.hover();
  await expect.poll(opacity).toBe('1');
});

test('desktop estudos: tema ativo continua destacado sob o mouse', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos?tema=901');
  const ativo = page.locator('.estudos-tema.ativo');
  const antes = await ativo.evaluate((e) => getComputedStyle(e).backgroundColor);
  await ativo.hover();
  await page.waitForTimeout(200);
  expect(await ativo.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(antes);
});

test('desktop estudos: sem topbar mobile nem botão Voltar', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos/kit');
  await expect(page.locator('.m-topbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Voltar' })).toHaveCount(0);
});
```

- [ ] **Step 4: Gerar a base ANTES de qualquer mudança de código**

Run (em `bussola_web/`): `npm run e2e:update -- --project=desktop e2e/estudos.desktop.spec.mjs`
Expected: 7 passed; criados 3 PNGs em `e2e/estudos.desktop.spec.mjs-snapshots/`. Abra os 3: a biblioteca com a coluna de temas e 5 cards; o kit com os 2 cards; a leitura com breadcrumb, cabeçalho, os 13 blocos (código realçado, tabela, quiz) e as fontes. Rode `npm run e2e -- --project=desktop` e confirme **20 passed** (13 + 7) com a base estável; se algo variar, adicione `mask` no elemento dinâmico e regenere.

- [ ] **Step 5: Teste do helper (mobile)**

Criar `bussola_web/e2e/estudos.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, overflowOffendersOutsideScrollers, smallTargets } from './helpers.mjs';
import { mockEstudos, stubClipboard, MATERIAIS } from './fixtures/estudos.mjs';

// Citações [n] e a âncora "#" da seção são inline no texto: ficam fora da regra de 44px.
const semInline = (lista) => lista.filter((s) => !/^button\. "\[\d+\]"/.test(s) && !/bloco-secao-ancora/.test(s));
const voltar = (page) => page.locator('.m-topbar').getByRole('button', { name: 'Voltar' });
const tituloTopbar = (page) => page.locator('.m-topbar-title');

// ---------------------------------------------------------------------------
// Task 1 — helper
// ---------------------------------------------------------------------------
test('overflowOffendersOutsideScrollers aceita rolagem interna e acusa o resto', async ({ page }) => {
  await gotoApp(page, '/estudos');
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="t-rola" style="width:200px;overflow-x:auto"><div class="t-rola-filho" style="width:900px;height:10px"></div></div>
      <div class="t-estoura" style="width:900px;height:10px"></div>`);
  });
  const doTeste = (lista) => lista.filter((s) => /t-rola-filho|t-estoura/.test(s)).map((s) => s.split(' ')[0]);
  expect(doTeste(await overflowOffendersOutsideScrollers(page))).toEqual(['div.t-estoura']);
  expect(doTeste(await overflowOffenders(page))).toEqual(['div.t-rola-filho', 'div.t-estoura']);
});
```

Run: `npm run e2e -- --project=mobile e2e/estudos.mobile.spec.mjs` → Expected: 1 passed.
Run: `node scripts/verificar-estudos.mjs` → Expected: `inline ok` e `comandos ok`.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/e2e/fixtures/estudos.mjs bussola_web/e2e/helpers.mjs bussola_web/e2e/estudos.desktop.spec.mjs bussola_web/e2e/estudos.desktop.spec.mjs-snapshots bussola_web/e2e/estudos.mobile.spec.mjs
git commit -m "test(web): base visual de Estudos no desktop, fixture da API e helper de overflow com rolagem interna" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Topbar das sub-rotas (título próprio + Voltar)

**Files:**
- Modify: `bussola_web/src/components/mobile/MobileChrome.jsx`, `bussola_web/src/components/Navbar/MobileTopbar.jsx`, `bussola_web/src/components/Navbar/index.jsx`, `bussola_web/src/components/mobile/mobile.css`, `bussola_web/src/pages/Estudos/Kit.jsx`, `bussola_web/src/pages/Estudos/Leitura.jsx`, `bussola_web/e2e/estudos.mobile.spec.mjs`

**Interfaces:**
- Produces:
  - `TopbarTitle({ title: string, backTo: string })` — componente sem saída visual; enquanto montado, a topbar mobile mostra `title` e um Voltar. Genérico: qualquer sub-rota pode usar.
  - `useTopbarOverride(): { title, backTo } | null`.
  - `MobileTopbar({ title, onBack?, … })` → com `onBack`, `div.m-topbar-lead > button.m-topbar-btn.m-topbar-back[aria-label="Voltar"] + h1.m-topbar-title`.
  - Voltar: `idx > 0` → `navigate(-1)`; senão `navigate(backTo, { replace: true })`.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/estudos.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 2 — topbar das sub-rotas
// ---------------------------------------------------------------------------
test.describe('topbar das sub-rotas', () => {
  test('/estudos: topbar "Estudos" sem Voltar', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await expect(tituloTopbar(page)).toHaveText('Estudos');
    await expect(voltar(page)).toHaveCount(0);
  });

  test('kit por link direto: "Kit do Claude" com Voltar de 44px que vai para a biblioteca', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/kit');
    await expect(tituloTopbar(page)).toHaveText('Kit do Claude');
    const b = await voltar(page).boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(Math.round(b.x)).toBe(8);
    await expect(voltar(page).locator('i')).toHaveClass(/fa-arrow-left/);
    await voltar(page).click();
    await expect(page).toHaveURL(/\/estudos$/);
    await expect(tituloTopbar(page)).toHaveText('Estudos');
    await expect(voltar(page)).toHaveCount(0);
  });

  test('kit a partir da biblioteca: Voltar volta no histórico', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await page.locator('.page-header').getByRole('link', { name: /Kit do Claude/ }).click();
    await expect(page).toHaveURL(/\/estudos\/kit$/);
    const idx = await page.evaluate(() => window.history.state.idx);
    await voltar(page).click();
    await expect(page).toHaveURL(/\/estudos$/);
    expect(await page.evaluate(() => window.history.state.idx)).toBe(idx - 1);
  });

  test('leitura: topbar com o tema e Voltar preserva o filtro', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await page.locator('.estudos-tema', { hasText: 'Banco de Dados' }).click();
    await expect(page).toHaveURL(/\/estudos\?tema=901$/);
    await page.locator('.estudo-card', { hasText: 'Índices B-tree' }).click();
    await expect(page).toHaveURL(/\/estudos\/9101$/);
    await expect(tituloTopbar(page)).toHaveText('Banco de Dados');
    await voltar(page).click();
    await expect(page).toHaveURL(/\/estudos\?tema=901$/);
    await expect(tituloTopbar(page)).toHaveText('Estudos');
  });

  test('leitura sem tema e material inexistente: topbar "Estudos" com Voltar', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9105');
    await expect(page.locator('.estudo-cabecalho h1')).toContainText('Material sem tema');
    await expect(tituloTopbar(page)).toHaveText('Estudos');
    await expect(voltar(page)).toBeVisible();
    await gotoApp(page, '/estudos/999');
    await expect(page.locator('.estudos-vazio h2')).toHaveText('Material não encontrado');
    await expect(voltar(page)).toBeVisible();
  });

  test('trocar de rota pela barra inferior limpa o título', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/kit');
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Panorama', { exact: true }).click();
    await expect(page).toHaveURL(/\/panorama$/);
    await expect(tituloTopbar(page)).toHaveText('Panorama');
    await expect(voltar(page)).toHaveCount(0);
  });

  test('título longo não estoura a topbar', async ({ page }) => {
    await mockEstudos(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/estudos/9103');
    await expect(tituloTopbar(page)).toHaveText('Redes de Computadores e Protocolos da Internet');
    const bar = await page.locator('.m-topbar').boundingBox();
    expect(bar.x + bar.width).toBeLessThanOrEqual(360);
    expect(await overflowOffendersOutsideScrollers(page)).not.toContainEqual(expect.stringContaining('m-topbar'));
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/estudos.mobile.spec.mjs`
Expected: FAIL — a topbar mostra "Estudos" no kit e não há botão "Voltar".

- [ ] **Step 2: API `TopbarTitle` / `useTopbarOverride`**

Substituir **todo** o conteúdo de `bussola_web/src/components/mobile/MobileChrome.jsx` por:

```jsx
import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const MobileChromeContext = createContext({ slotEl: null, setSlotEl: () => {} });

/** Guarda o nó do slot de ações da topbar mobile (preenchido via callback ref). */
export function MobileChromeProvider({ children }) {
    const [slotEl, setSlotEl] = useState(null);
    return (
        <MobileChromeContext.Provider value={{ slotEl, setSlotEl }}>
            {children}
        </MobileChromeContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMobileChrome() {
    return useContext(MobileChromeContext);
}

/** Ícones extras da página na topbar mobile (ex.: calendário no Roteiro). */
export function TopbarActions({ children }) {
    const { slotEl } = useMobileChrome();
    return slotEl ? createPortal(children, slotEl) : null;
}

// ---- Título próprio + Voltar das sub-rotas (ex.: /estudos/kit, /estudos/:id) ----
// Store mínimo fora do React: a página declara <TopbarTitle/>, a topbar (no Navbar) lê com
// useTopbarOverride(). Sem setState dentro de efeito e sem re-render da árvore inteira.
let topbarAtual = null;
const ouvintesTopbar = new Set();

function definirTopbar(valor) {
    topbarAtual = valor;
    ouvintesTopbar.forEach((avisar) => avisar());
}

function assinarTopbar(avisar) {
    ouvintesTopbar.add(avisar);
    return () => { ouvintesTopbar.delete(avisar); };
}

const lerTopbar = () => topbarAtual;

/** `{ title, backTo }` declarado pela página atual, ou `null` (título do módulo, sem Voltar). */
// eslint-disable-next-line react-refresh/only-export-components
export function useTopbarOverride() {
    return useSyncExternalStore(assinarTopbar, lerTopbar, () => null);
}

/**
 * Sub-rota com título próprio e botão Voltar na topbar do celular. `backTo` é o destino do
 * Voltar quando não há página anterior do app no histórico (link direto). Não renderiza nada.
 * useLayoutEffect: o título certo já aparece no primeiro quadro (sem piscar "Estudos").
 */
export function TopbarTitle({ title, backTo }) {
    useLayoutEffect(() => {
        const entrada = { title, backTo };
        definirTopbar(entrada);
        return () => {
            if (topbarAtual === entrada) definirTopbar(null);
        };
    }, [title, backTo]);
    return null;
}
```

- [ ] **Step 3: Voltar no `MobileTopbar`**

Substituir **todo** o conteúdo de `bussola_web/src/components/Navbar/MobileTopbar.jsx` por:

```jsx
/** Topbar fina do celular: título do módulo (ou da sub-rota, com Voltar), ações da página, IA e conta. */
export function MobileTopbar({ title, onBack, aiContext, user, onOpenAccount, slotRef, onOpenAi }) {
    return (
        <header className="m-topbar">
            <div className="m-topbar-lead">
                {onBack && (
                    <button type="button" className="m-topbar-btn m-topbar-back" aria-label="Voltar" onClick={onBack}>
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                )}
                <h1 className="m-topbar-title">{title}</h1>
            </div>
            <div className="m-topbar-actions">
                <div className="m-topbar-slot" ref={slotRef} />
                {aiContext && (
                    <button type="button" className="m-topbar-btn is-ai" aria-label="Assistente de IA" onClick={onOpenAi}>
                        <i className="fa-solid fa-robot"></i>
                    </button>
                )}
                <button type="button" className="m-topbar-avatar" aria-label="Minha conta" onClick={onOpenAccount}>
                    {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : <i className="fa-solid fa-user"></i>}
                </button>
            </div>
        </header>
    );
}
```

Em `bussola_web/src/components/mobile/mobile.css`, logo **depois** do bloco `.m-topbar-title { … }`, inserir:

```css
.m-topbar-lead {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: 1;
    min-width: 0;
}

.m-topbar-btn.m-topbar-back {
    flex-shrink: 0;
    margin-left: calc(-1 * var(--sp-2));
    background: transparent;
}

/* Sub-rota: título um pouco menor, ao lado do Voltar */
.m-topbar-back + .m-topbar-title {
    font-size: 1.15rem;
}
```

- [ ] **Step 4: O `Navbar` passa título e Voltar**

Em `bussola_web/src/components/Navbar/index.jsx`:

1. Substituir:
```jsx
import { useMobileChrome } from '../mobile/MobileChrome';
```
por:
```jsx
import { useMobileChrome, useTopbarOverride } from '../mobile/MobileChrome';
```

2. Substituir:
```jsx
    const { setSlotEl } = useMobileChrome();
```
por:
```jsx
    const { setSlotEl } = useMobileChrome();
    const topbar = useTopbarOverride();
```

3. Logo **depois** da linha `const sairMobile = () => { logout(); navigate('/login'); };`, inserir:
```jsx
    // Voltar da sub-rota: volta no histórico do app; num link direto (sem página anterior),
    // troca a entrada pelo destino declarado pela página.
    const voltarTopbar = () => {
        if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
        else navigate(topbar.backTo, { replace: true });
    };
```

4. Substituir:
```jsx
                        title={current?.rotulo ?? 'Bússola'}
```
por:
```jsx
                        title={topbar?.title ?? current?.rotulo ?? 'Bússola'}
                        onBack={topbar ? voltarTopbar : undefined}
```

- [ ] **Step 5: Kit e leitura declaram o título**

Em `bussola_web/src/pages/Estudos/Kit.jsx`:

1. Substituir:
```jsx
import { copiarTexto } from './comandos';
```
por:
```jsx
import { copiarTexto } from './comandos';
import { TopbarTitle } from '../../components/mobile/MobileChrome';
```

2. Substituir:
```jsx
        <div className="container main-container estudos-scope">
            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-wand-magic-sparkles"></i> Kit do Claude</h1>
```
por:
```jsx
        <div className="container main-container estudos-scope">
            <TopbarTitle title="Kit do Claude" backTo="/estudos" />
            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-wand-magic-sparkles"></i> Kit do Claude</h1>
```

3. Substituir:
```jsx
                    <Link to="/estudos" className="ph-kpi ph-kpi-btn"><i className="fa-solid fa-arrow-left"></i> Biblioteca</Link>
```
por:
```jsx
                    <Link to="/estudos" className="ph-kpi ph-kpi-btn estudos-kit-voltar"><i className="fa-solid fa-arrow-left"></i> Biblioteca</Link>
```

Em `bussola_web/src/pages/Estudos/Leitura.jsx`:

1. Substituir:
```jsx
import { PedirAoClaude } from './PedirAoClaude';
```
por:
```jsx
import { PedirAoClaude } from './PedirAoClaude';
import { TopbarTitle } from '../../components/mobile/MobileChrome';
```

2. Substituir:
```jsx
            <div className="container main-container estudos-scope">
                <div className="estudos-carregando">
```
por:
```jsx
            <div className="container main-container estudos-scope">
                <TopbarTitle title="Estudos" backTo="/estudos" />
                <div className="estudos-carregando">
```

3. Substituir:
```jsx
            <div className="container main-container estudos-scope">
                <div className="estudos-vazio">
```
por:
```jsx
            <div className="container main-container estudos-scope">
                <TopbarTitle title="Estudos" backTo="/estudos" />
                <div className="estudos-vazio">
```

4. Substituir:
```jsx
        <div className="container main-container estudos-scope" style={{ '--estudo-cor': material.tema_cor || 'var(--cor-azul-primario)' }}>
            <div className="estudo-leitura">
```
por:
```jsx
        <div className="container main-container estudos-scope" style={{ '--estudo-cor': material.tema_cor || 'var(--cor-azul-primario)' }}>
            <TopbarTitle
                title={material.tema_nome || 'Estudos'}
                backTo={material.tema_id ? `/estudos?tema=${material.tema_id}` : '/estudos'}
            />
            <div className="estudo-leitura">
```

- [ ] **Step 6: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/estudos.mobile.spec.mjs e2e/shell.mobile.spec.mjs` → Expected: 1 + 7 passed em Estudos e o shell inteiro passa ("rota fora do menu: título padrão" continua "Bússola").
Run: `npm run e2e -- --project=desktop` → Expected: 20 passed.
Run: `node scripts/verificar-estudos.mjs` → Expected: `inline ok` / `comandos ok`.

- [ ] **Step 7: Lint e commit**

Run: `npx eslint src/components/mobile src/components/Navbar src/pages/Estudos` → Expected: só o erro pré-existente `Navbar/index.jsx:62`.

```bash
git add bussola_web/src/components bussola_web/src/pages/Estudos bussola_web/e2e/estudos.mobile.spec.mjs
git commit -m "feat(web): topbar mobile com titulo proprio e Voltar nas sub-rotas (TopbarTitle) no kit e na leitura de Estudos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Biblioteca no celular (faixa de temas, filtros de 44px, cards em 1 coluna)

**Files:**
- Modify: `bussola_web/src/pages/Estudos/index.jsx`, `bussola_web/src/pages/Estudos/styles.css`, `bussola_web/e2e/estudos.mobile.spec.mjs`

**Interfaces:**
- Produces: `aside.estudos-temas[aria-label="Temas"][data-offscreen-ok]` (faixa horizontal rolável no celular); blocos CSS `@media (pointer: coarse)` (alvos de 44px de toda a área de Estudos, celular e tablet) e `@media (max-width: 768px)` (layout).

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/estudos.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 3 — biblioteca
// ---------------------------------------------------------------------------
test.describe('biblioteca', () => {
  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px (com materiais)`, async ({ page }) => {
      await mockEstudos(page);
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/estudos');
      await page.locator('.estudo-card').first().waitFor();
      expect(await overflowOffenders(page), `${w}px`).toEqual([]);
      const temas = await page.locator('.estudos-temas').boundingBox();
      expect(temas.x).toBeGreaterThanOrEqual(0);
      expect(temas.x + temas.width).toBeLessThanOrEqual(w);
    });
  }

  test('biblioteca vazia (banco real) sem overflow em 360px e botão de 48px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/estudos');
    await expect(page.locator('.estudos-vazio h2')).toHaveText('Sua biblioteca está vazia');
    expect(await overflowOffenders(page)).toEqual([]);
    expect((await page.locator('.estudos-vazio .btn-primary').boundingBox()).height).toBeGreaterThanOrEqual(48);
  });

  test('alvos de toque ≥ 44px', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await page.locator('.estudo-card').first().waitFor();
    expect(await smallTargets(page, '.estudos-scope')).toEqual([]);
  });

  test('cards em 1 coluna: gutter de 16px e 12px entre eles; textos ≥ 12px', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    const cards = await page.locator('.estudo-card').all();
    expect(cards).toHaveLength(MATERIAIS.length);
    const caixas = await Promise.all(cards.map((c) => c.boundingBox()));
    for (const b of caixas) {
      expect(Math.round(b.x)).toBe(16);
      expect(Math.round(b.width)).toBe(390 - 32);
    }
    expect(Math.round(caixas[1].y - (caixas[0].y + caixas[0].height))).toBe(12);
    for (const sel of ['.estudo-card-tema', '.estudo-card-nivel', '.estudo-tag', '.estudo-etiqueta']) {
      const px = await page.locator(sel).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(px, sel).toBeGreaterThanOrEqual(12);
    }
  });

  test('faixa de temas rola na horizontal e filtra', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    const faixa = page.locator('.estudos-temas');
    await expect(faixa).toHaveAttribute('aria-label', 'Temas');
    await expect(faixa.locator('h2')).toBeHidden();
    expect(await faixa.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    await faixa.locator('.estudos-tema', { hasText: 'Banco de Dados' }).click();
    await expect(page.locator('.estudo-card')).toHaveCount(2);
    await faixa.locator('.estudos-tema', { hasText: 'Sem tema' }).click();
    await expect(page.locator('.estudo-card')).toHaveCount(1);
  });

  test('chips de tipo e "Só não estudados" filtram', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    await page.locator('.estudos-chips').getByRole('button', { name: 'Resumo' }).click();
    await expect(page.locator('.estudo-card')).toHaveCount(1);
    await page.locator('.estudos-chips').getByRole('button', { name: 'Todos' }).click();
    await page.locator('.estudos-check').click();
    await expect(page.locator('.estudo-card')).toHaveCount(MATERIAIS.length - 1);
  });

  test('sem efeito de hover no toque', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos');
    const card = page.locator('.estudo-card').first();
    await card.hover();
    await page.waitForTimeout(250);
    expect(await card.evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/estudos.mobile.spec.mjs`
Expected: FAIL — cards em x=32 (gutter dobrado), chips/temas com ~34px, `aria-label` ausente, chips do card com 11.5px, `translateY` no hover.

- [ ] **Step 2: Faixa de temas com nome acessível**

Em `bussola_web/src/pages/Estudos/index.jsx`, substituir:

```jsx
                        <aside className="estudos-temas">
```

por:

```jsx
                        <aside className="estudos-temas" aria-label="Temas" data-offscreen-ok>
```

(`data-offscreen-ok`: os temas além da borda da faixa rolável são esperados; o teste confere que a faixa em si cabe na tela.)

- [ ] **Step 3: Hover só com mouse (no mesmo lugar da cascata)**

Em `bussola_web/src/pages/Estudos/styles.css`, trocar **cada linha** abaixo pela versão dentro do gate (mesma posição no arquivo, para a ordem da cascata não mudar). Tema e chip ganham `:not(.ativo)`: antes, o `.ativo` (declarado logo depois) vencia o `:hover`; com o gate a regra continua antes, e o `:not(.ativo)` deixa explícito o mesmo resultado.

| Linha atual | Nova |
|---|---|
| `.estudos-tema:hover { background: var(--cor-fundo-hover); }` | `@media (hover: hover) and (pointer: fine) { .estudos-tema:not(.ativo):hover { background: var(--cor-fundo-hover); } }` |
| `.estudos-chip:hover { border-color: var(--tipo-cor, var(--cor-azul-primario)); }` | `@media (hover: hover) and (pointer: fine) { .estudos-chip:not(.ativo):hover { border-color: var(--tipo-cor, var(--cor-azul-primario)); } }` |
| `.estudo-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); }` | `@media (hover: hover) and (pointer: fine) { .estudo-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); } }` |
| `.estudo-breadcrumb a:hover { color: var(--cor-azul-primario); }` | `@media (hover: hover) and (pointer: fine) { .estudo-breadcrumb a:hover { color: var(--cor-azul-primario); } }` |
| `.estudo-btn-excluir:hover { color: var(--cor-vermelho-delete); border-color: var(--cor-vermelho-delete); }` | `@media (hover: hover) and (pointer: fine) { .estudo-btn-excluir:hover { color: var(--cor-vermelho-delete); border-color: var(--cor-vermelho-delete); } }` |
| `.pedir-claude-gatilho-bloco:hover { background: var(--cor-fundo-hover); }` | `@media (hover: hover) and (pointer: fine) { .pedir-claude-gatilho-bloco:hover { background: var(--cor-fundo-hover); } }` |
| `.pedir-claude-menu > button:hover { background: var(--cor-fundo-hover); }` | `@media (hover: hover) and (pointer: fine) { .pedir-claude-menu > button:hover { background: var(--cor-fundo-hover); } }` |
| `.kit-comando button:hover { color: var(--cor-azul-primario); }` | `@media (hover: hover) and (pointer: fine) { .kit-comando button:hover { color: var(--cor-azul-primario); } }` |

- [ ] **Step 4: CSS de toque e do celular**

Ao **final** de `bussola_web/src/pages/Estudos/styles.css`, adicionar:

```css
/* =========================================================
   ESTUDOS — toque (celular e tablet): alvos de 44px
   ========================================================= */
@media (pointer: coarse) {
    .estudos-scope .page-header .ph-kpi-btn { min-height: var(--tap-min); }
    .estudos-tema { min-height: var(--tap-min); }
    .estudos-chip { min-height: var(--tap-min); padding-top: 0; padding-bottom: 0; }
    .estudos-check { min-height: var(--tap-min); }
    .estudo-acoes .btn-secondary,
    .estudo-acoes .btn-primary { min-height: var(--tap-min); }
    .estudo-btn-excluir { min-width: var(--tap-min); min-height: var(--tap-min); }
    .estudo-destino button { min-height: var(--tap-min); }
    .pedir-claude-gatilho-bloco { width: var(--tap-min); height: var(--tap-min); }
    .kit-comando button { min-width: var(--tap-min); min-height: var(--tap-min); }
    .kit-baixar { min-height: var(--tap-min); }
}

/* =========================================================
   ESTUDOS — celular (≤768)
   ========================================================= */
@media (max-width: 768px) {
    /* O .container já dá 16px de gutter: os wrappers não somam outro */
    .estudos-wrapper,
    .estudo-leitura {
        max-width: 100%;
        padding: 0;
        margin-bottom: var(--sp-5);
    }

    .estudos-scope .page-header { margin-bottom: var(--sp-4); }
    .estudos-scope .page-header-kpis { gap: var(--sp-2); }
    .estudos-carregando { padding: var(--sp-6) var(--sp-4); }

    /* ---- biblioteca ---- */
    .estudos-layout { gap: var(--sp-4); }

    .estudos-temas {
        flex-direction: row;
        flex-wrap: nowrap;
        gap: var(--sp-2);
        padding: var(--sp-2);
        overflow-x: auto;
        scroll-snap-type: x proximity;
        scrollbar-width: none;
    }

    .estudos-temas::-webkit-scrollbar { display: none; }
    .estudos-temas h2 { display: none; }

    .estudos-tema {
        flex: 0 0 auto;
        width: auto;
        padding: 0 var(--sp-3);
        border-radius: 999px;
        scroll-snap-align: start;
    }

    .estudos-tema-nome { max-width: 60vw; }

    .estudos-filtros { gap: var(--sp-3); margin-bottom: var(--sp-4); }
    .estudos-chips { gap: var(--sp-2); }
    .estudos-chip { padding-left: var(--sp-3); padding-right: var(--sp-3); font-size: 0.875rem; }
    .estudos-check { font-size: 0.875rem; }

    .estudos-grade { grid-template-columns: 1fr; gap: var(--sp-3); }
    .estudo-card { padding: var(--sp-4); gap: var(--sp-2); }

    .estudo-card-tema,
    .estudo-card-nivel,
    .estudo-tag,
    .estudo-etiqueta { font-size: 0.75rem; }

    .estudos-vazio { margin: var(--sp-5) 0; padding: var(--sp-5) var(--sp-4); }
    .estudos-vazio .btn-primary { min-height: 48px; }
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/estudos.mobile.spec.mjs` → Expected: 1 + 7 + 10 passed.
Run: `npm run e2e -- --project=desktop` → Expected: 20 passed (inclui "tema ativo continua destacado sob o mouse" e `estudos-biblioteca.png`).
Run: `node scripts/verificar-estudos.mjs` → Expected: ok.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Estudos bussola_web/e2e/estudos.mobile.spec.mjs
git commit -m "feat(web): biblioteca de Estudos no celular (faixa de temas, filtros de 44px, cards em 1 coluna, hover so com mouse)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Leitura no celular (cabeçalho, ações, "Pedir ao Claude" em sheet, blocos)

**Files:**
- Modify: `bussola_web/src/pages/Estudos/PedirAoClaude.jsx`, `bussola_web/src/pages/Estudos/styles.css`, `bussola_web/src/pages/Estudos/blocos/blocos.css`, `bussola_web/e2e/estudos.mobile.spec.mjs`

**Interfaces:**
- Consumes: `Sheet` (plano 01), `useIsMobile`, `ACOES`/`montarComando`/`copiarTexto` (sem mudança).
- Produces: `PedirAoClaude` (mesmas props) — no celular, `Sheet[title="Pedir ao Claude"].pedir-claude-sheet` com `p.pedir-claude-alvo` ("Material inteiro" / "Bloco bN"), `button.action-sheet-item` por ação e, em "Tirar dúvida", `form#pedir-claude-<material>-<bloco|material>` com `textarea[aria-label="Sua dúvida"]` (sem autofocus) e o rodapé Voltar / "Copiar comando" (`type=submit form=…`). O gatilho por bloco ganha `aria-label="Pedir ao Claude sobre o bloco bN"`.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/estudos.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 4 — leitura
// ---------------------------------------------------------------------------
test.describe('leitura', () => {
  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow fora dos blocos roláveis em ${w}px`, async ({ page }) => {
      await mockEstudos(page);
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/estudos/9101');
      await page.locator('.bloco-quiz').waitFor();
      expect(await overflowOffendersOutsideScrollers(page), `${w}px`).toEqual([]);
    });
  }

  test('comparação e código rolam dentro do bloco (o bloco cabe na tela)', async ({ page }) => {
    await mockEstudos(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoApp(page, '/estudos/9101');
    for (const sel of ['.bloco-comparacao', '.bloco-codigo-corpo pre']) {
      const el = page.locator(sel).first();
      const b = await el.boundingBox();
      expect(b.x, sel).toBeGreaterThanOrEqual(16);
      expect(b.x + b.width, sel).toBeLessThanOrEqual(360 - 16 + 1);
      expect(await el.evaluate((e) => getComputedStyle(e).overflowX), sel).toBe('auto');
    }
    expect(await page.locator('.bloco-codigo-corpo pre').evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  });

  test('cabeçalho: sem breadcrumb, título visível, texto do material com 16px', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await expect(page.locator('.estudo-breadcrumb')).toBeHidden();
    await expect(page.locator('.estudo-cabecalho h1')).toBeVisible();
    expect(await page.locator('.estudo-coluna').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBe(16);
  });

  test('alvos ≥ 44px no cabeçalho e nos blocos (exceto citações inline)', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    expect(await smallTargets(page, '.estudo-cabecalho')).toEqual([]);
    expect(semInline(await smallTargets(page, '.estudo-coluna'))).toEqual([]);
  });

  test('ações: Estudado + lixeira na 1ª linha, Pedir ao Claude e destino em largura total', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    const estudado = await page.locator('.estudo-btn-estudado').boundingBox();
    const lixeira = await page.locator('.estudo-btn-excluir').boundingBox();
    const pedir = await page.locator('.estudo-acoes .pedir-claude-gatilho').boundingBox();
    const destino = await page.locator('.estudo-destino').boundingBox();
    expect(Math.round(lixeira.y)).toBe(Math.round(estudado.y));
    expect(Math.round(lixeira.x + lixeira.width)).toBe(390 - 16);
    expect(Math.round(lixeira.x - (estudado.x + estudado.width))).toBe(8);
    expect(Math.round(pedir.width)).toBe(390 - 32);
    expect(Math.round(destino.width)).toBe(390 - 32);
    expect(Math.round(pedir.y - (estudado.y + estudado.height))).toBe(8);
  });

  test('marcar como estudado e responder o quiz', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.locator('.estudo-btn-estudado').click();
    await expect(page.locator('.estudo-btn-estudado')).toHaveText(/Estudado/);
    await page.locator('.bloco-quiz-opcao', { hasText: 'B-tree' }).click();
    await expect(page.locator('.bloco-quiz-feedback strong')).toHaveText('Correto!');
  });

  test('Pedir ao Claude (material) abre um sheet e copia o comando', async ({ page }) => {
    await stubClipboard(page);
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.locator('.estudo-acoes .pedir-claude-gatilho').click();
    const sheet = page.locator('.modal-overlay.is-sheet .pedir-claude-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.locator('.pedir-claude-menu')).toHaveCount(0);
    await expect(sheet.locator('.pedir-claude-alvo')).toHaveText('Material inteiro');
    expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
    await sheet.getByRole('button', { name: 'Aprofundar' }).click();
    await expect(sheet).toHaveCount(0);
    expect(await page.evaluate(() => window.__clip)).toEqual(['/estudos aprofundar material:9101']);
    await expect(page.locator('.toast-notification', { hasText: 'Comando copiado' })).toBeVisible();
  });

  test('Pedir ao Claude do bloco copia o comando do bloco; destino claude.ai muda a frase', async ({ page }) => {
    await stubClipboard(page);
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.getByRole('button', { name: 'Pedir ao Claude sobre o bloco b3' }).click();
    const sheet = page.locator('.pedir-claude-sheet');
    await expect(sheet.locator('.pedir-claude-alvo')).toHaveText('Bloco b3');
    await sheet.getByRole('button', { name: 'Simplificar' }).click();
    await page.locator('.estudo-destino').getByRole('button', { name: 'claude.ai' }).click();
    await page.locator('.estudo-acoes .pedir-claude-gatilho').click();
    await page.locator('.pedir-claude-sheet').getByRole('button', { name: 'Criar exercícios' }).click();
    expect(await page.evaluate(() => window.__clip)).toEqual([
      '/estudos simplificar material:9101 bloco:b3',
      'Use a skill estudos para criar exercícios sobre o material 9101 no Bússola.',
    ]);
  });

  test('Tirar dúvida: sem autofocus e "Copiar comando" acima do teclado', async ({ page }) => {
    await stubClipboard(page);
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--vvh', '420px');
      document.documentElement.style.setProperty('--kb-inset', '424px');
    });
    await page.locator('.estudo-acoes .pedir-claude-gatilho').click();
    await page.locator('.pedir-claude-sheet').getByRole('button', { name: 'Tirar dúvida' }).click();
    const campo = page.getByRole('textbox', { name: 'Sua dúvida' });
    await expect(campo).toBeVisible();
    await expect(campo).not.toBeFocused();
    const copiar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Copiar comando' });
    await expect(copiar).toBeDisabled();
    await campo.fill('por que "B-tree"?');
    await expect.poll(async () => { const b = await copiar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
    await copiar.click();
    expect(await page.evaluate(() => window.__clip)).toEqual([`/estudos duvida material:9101 "por que 'B-tree'?"`]);
  });

  test('copiar código: botão de 44px copia o código do bloco', async ({ page }) => {
    await stubClipboard(page);
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    const copiar = page.locator('.bloco-codigo-copiar');
    expect((await copiar.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await copiar.click();
    expect((await page.evaluate(() => window.__clip))[0]).toContain('CREATE INDEX idx_usuario_email_criado_em');
  });

  test('excluir pede confirmação e volta para a biblioteca', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/9101');
    await page.locator('.estudo-btn-excluir').click();
    await page.getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(page).toHaveURL(/\/estudos$/);
  });
});
```

Run: `npm run e2e -- --project=mobile e2e/estudos.mobile.spec.mjs`
Expected: FAIL — o identificador longo estoura a coluna; breadcrumb visível; o "Pedir ao Claude" abre o popover (`.pedir-claude-menu`); gatilho por bloco sem nome acessível; botões de 30–36px.

- [ ] **Step 2: `PedirAoClaude` em sheet no celular**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Estudos/PedirAoClaude.jsx` por (o ramo do desktop é a marcação de antes):

```jsx
import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Sheet } from '../../components/mobile/Sheet';
import { ACOES, copiarTexto, montarComando } from './comandos';

// Menu "Pedir ao Claude": copia para a área de transferência um comando que o kit entende
// (Claude Code) ou uma frase equivalente (claude.ai). blocoId = ação sobre um bloco específico.
// No celular o menu abre num sheet (o popover vazaria da tela) e "Copiar comando" fica no rodapé.
export function PedirAoClaude({ materialId, blocoId = null, destino, compacto = false }) {
    const { addToast } = useToast();
    const isMobile = useIsMobile();
    const [aberto, setAberto] = useState(false);
    const [perguntando, setPerguntando] = useState(false);
    const [pergunta, setPergunta] = useState('');
    const alvo = blocoId ? `Bloco ${blocoId}` : 'Material inteiro';
    const formId = `pedir-claude-${materialId}-${blocoId || 'material'}`;

    const fechar = () => {
        setAberto(false);
        setPerguntando(false);
        setPergunta('');
    };

    const copiar = async (acao, textoPergunta = '') => {
        const comando = montarComando({ destino, acao, materialId, blocoId, pergunta: textoPergunta });
        const ok = await copiarTexto(comando);
        addToast(ok
            ? {
                type: 'success',
                title: 'Comando copiado',
                description: destino === 'claude-ai' ? 'Cole numa conversa do Projeto Estudos no claude.ai.' : 'Cole no Claude Code.',
            }
            : { type: 'error', title: 'Não foi possível copiar', description: comando });
        fechar();
    };

    const escolher = (acao) => {
        if (acao.pergunta) {
            setPerguntando(true);
            return;
        }
        copiar(acao.id);
    };

    const enviarPergunta = (e) => {
        e.preventDefault();
        if (pergunta.trim()) copiar('duvida', pergunta.trim());
    };

    return (
        <div className={`pedir-claude ${compacto ? 'compacto' : ''}`}>
            {compacto ? (
                <button
                    type="button"
                    className="pedir-claude-gatilho-bloco"
                    onClick={() => (aberto ? fechar() : setAberto(true))}
                    title={`Pedir ao Claude sobre o bloco ${blocoId}`}
                    aria-label={`Pedir ao Claude sobre o bloco ${blocoId}`}
                    aria-expanded={aberto}
                >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                </button>
            ) : (
                <button
                    type="button"
                    className="btn-secondary pedir-claude-gatilho"
                    onClick={() => (aberto ? fechar() : setAberto(true))}
                    aria-expanded={aberto}
                >
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Pedir ao Claude <i className="fa-solid fa-chevron-down"></i>
                </button>
            )}

            {aberto && !isMobile && (
                <>
                    <div className="pedir-claude-fundo" onClick={fechar} />
                    <div className="pedir-claude-menu" role="menu">
                        <div className="pedir-claude-alvo">{alvo}</div>
                        {!perguntando && ACOES.map((acao) => (
                            <button key={acao.id} type="button" role="menuitem" onClick={() => escolher(acao)}>
                                <i className={`fa-solid ${acao.icone}`}></i> {acao.rotulo}
                            </button>
                        ))}
                        {perguntando && (
                            <form className="pedir-claude-pergunta" onSubmit={enviarPergunta}>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    maxLength={500}
                                    autoFocus
                                    value={pergunta}
                                    onChange={(e) => setPergunta(e.target.value)}
                                    placeholder="Qual é a sua dúvida?"
                                />
                                <div>
                                    <button type="button" className="btn-secondary btn-pequeno" onClick={() => setPerguntando(false)}>
                                        Voltar
                                    </button>
                                    <button type="submit" className="btn-primary btn-pequeno" disabled={!pergunta.trim()}>
                                        <i className="fa-regular fa-copy"></i> Copiar comando
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </>
            )}

            {isMobile && (
                <Sheet
                    open={aberto}
                    onClose={fechar}
                    title="Pedir ao Claude"
                    className="pedir-claude-sheet"
                    footer={perguntando ? (
                        <>
                            <button type="button" className="btn-secondary" onClick={() => setPerguntando(false)}>
                                Voltar
                            </button>
                            <button type="submit" form={formId} className="btn-primary" disabled={!pergunta.trim()}>
                                <i className="fa-regular fa-copy"></i> Copiar comando
                            </button>
                        </>
                    ) : null}
                >
                    <p className="pedir-claude-alvo">{alvo}</p>
                    {!perguntando ? (
                        <div className="action-sheet-list">
                            {ACOES.map((acao) => (
                                <button key={acao.id} type="button" className="action-sheet-item" onClick={() => escolher(acao)}>
                                    <i className={`fa-solid ${acao.icone}`}></i>
                                    <span>{acao.rotulo}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <form id={formId} className="pedir-claude-pergunta" onSubmit={enviarPergunta}>
                            <textarea
                                className="form-input"
                                rows={4}
                                maxLength={500}
                                value={pergunta}
                                onChange={(e) => setPergunta(e.target.value)}
                                placeholder="Qual é a sua dúvida?"
                                aria-label="Sua dúvida"
                            />
                        </form>
                    )}
                </Sheet>
            )}
        </div>
    );
}
```

- [ ] **Step 3: CSS da leitura (cabeçalho, ações, sheet)**

Em `bussola_web/src/pages/Estudos/styles.css`, dentro do bloco `@media (max-width: 768px)` da seção **ESTUDOS — celular (≤768)** (Task 3), logo antes da chave final `}` do bloco, adicionar:

```css
    /* ---- leitura ---- */
    .estudo-breadcrumb { display: none; } /* a topbar mostra o tema e o Voltar */
    .estudo-cabecalho { margin-bottom: var(--sp-5); }
    .estudo-etiquetas { gap: var(--sp-2); margin-bottom: var(--sp-3); }
    .estudo-chip-info { font-size: 0.75rem; }
    .estudo-cabecalho h1 { font-size: clamp(1.375rem, 6vw, 1.75rem); margin-bottom: var(--sp-2); }
    .estudo-subtitulo { font-size: 1rem; margin-bottom: var(--sp-4); }

    /* Estudado + lixeira / Pedir ao Claude / destino */
    .estudo-acoes {
        display: grid;
        grid-template-columns: minmax(0, 1fr) var(--tap-min);
        gap: var(--sp-2);
    }

    .estudo-acoes > .estudo-btn-estudado { grid-row: 1; grid-column: 1; justify-content: center; }
    .estudo-acoes > .estudo-btn-excluir { grid-row: 1; grid-column: 2; width: var(--tap-min); padding: 0; }
    .estudo-acoes > .pedir-claude { grid-row: 2; grid-column: 1 / -1; display: block; }
    .estudo-acoes .pedir-claude-gatilho { width: 100%; justify-content: center; }
    .estudo-acoes > .estudo-destino { grid-row: 3; grid-column: 1 / -1; display: flex; margin-left: 0; }
    .estudo-destino button { flex: 1; font-size: 0.875rem; }

    .estudo-bloco { scroll-margin-top: calc(var(--topbar-h) + var(--safe-top) + var(--sp-4)); }
    .estudo-fontes { margin-top: var(--sp-6); padding-top: var(--sp-4); }
    .estudo-fontes ol { font-size: 0.875rem; gap: var(--sp-2); }
    .estudo-fontes li { overflow-wrap: anywhere; }
    .estudo-fonte-dominio { font-size: 0.75rem; }

    /* ---- Pedir ao Claude em sheet ---- */
    .pedir-claude-sheet .pedir-claude-alvo { padding: 0; margin: 0 0 var(--sp-2); }
    .pedir-claude-sheet .pedir-claude-pergunta { padding: 0; }
```

- [ ] **Step 4: CSS dos blocos (hover, toque, coluna)**

Em `bussola_web/src/pages/Estudos/blocos/blocos.css`, trocar **cada linha** abaixo pela versão dentro do gate, no mesmo lugar:

| Linha atual | Nova |
|---|---|
| `.estudo-citacao button:hover { text-decoration: underline; }` | `@media (hover: hover) and (pointer: fine) { .estudo-citacao button:hover { text-decoration: underline; } }` |
| `.bloco-secao:hover .bloco-secao-ancora { opacity: 0.7; }` | `@media (hover: hover) and (pointer: fine) { .bloco-secao:hover .bloco-secao-ancora { opacity: 0.7; } }` |
| `.bloco-codigo-copiar:hover { color: var(--cor-texto-principal); background: var(--cor-fundo-hover); }` | `@media (hover: hover) and (pointer: fine) { .bloco-codigo-copiar:hover { color: var(--cor-texto-principal); background: var(--cor-fundo-hover); } }` |
| `.bloco-quiz-opcao:hover:not(:disabled) { border-color: var(--cor-azul-primario); background: var(--cor-fundo-hover); }` | `@media (hover: hover) and (pointer: fine) { .bloco-quiz-opcao:hover:not(:disabled) { border-color: var(--cor-azul-primario); background: var(--cor-fundo-hover); } }` |
| `.btn-errei:hover { background: var(--cor-vermelho-delete); }` | `@media (hover: hover) and (pointer: fine) { .btn-errei:hover { background: var(--cor-vermelho-delete); } }` |

Depois, ao **final** de `blocos.css`, adicionar:

```css
/* ---- toque (celular e tablet): alvos de 44px ---- */
@media (pointer: coarse) {
    .bloco-codigo-copiar {
        min-height: var(--tap-min);
        padding: 0 var(--sp-3);
        display: inline-flex;
        align-items: center;
        gap: var(--sp-1);
    }

    .btn-pequeno { min-height: var(--tap-min); }
    .bloco-quiz-opcao { min-height: 48px; align-items: center; }
}

/* ---- celular (≤768) ---- */
@media (max-width: 768px) {
    /* Identificadores/URLs longos quebram em vez de estourar; a tabela rola dentro do bloco */
    .estudo-coluna { font-size: 1rem; gap: var(--sp-4); overflow-wrap: anywhere; }
    .bloco-comparacao { overflow-wrap: normal; }

    .bloco-secao { font-size: 1.2rem; margin: var(--sp-5) 0 0; }
    .bloco-conceito,
    .bloco-quiz,
    .bloco-questao { padding: var(--sp-4); }
    .bloco-definicao,
    .bloco-analogia,
    .bloco-alerta { padding: var(--sp-3) var(--sp-4); }
    .bloco-codigo-corpo pre code { padding: var(--sp-3); }
    .bloco-comparacao table { font-size: 0.875rem; }
    .bloco-comparacao th,
    .bloco-comparacao td { padding: var(--sp-2) var(--sp-3); }
    .bloco-quiz-opcoes { gap: var(--sp-2); }
    .bloco-acoes-linha .btn-pequeno { flex: 1 1 auto; justify-content: center; }
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/estudos.mobile.spec.mjs` → Expected: 1 + 7 + 10 + 14 passed.
Run: `npm run e2e -- --project=desktop` → Expected: 20 passed (`estudos-leitura.png` idêntico; popover no desktop; ações do bloco no hover).
Run: `node scripts/verificar-estudos.mjs` → Expected: `inline ok` / `comandos ok`.

- [ ] **Step 6: Lint e commit**

Run: `npx eslint src/pages/Estudos` → Expected: sem problemas.

```bash
git add bussola_web/src/pages/Estudos bussola_web/e2e/estudos.mobile.spec.mjs
git commit -m "feat(web): leitura de Estudos no celular (acoes em grade de 44px, Pedir ao Claude em sheet, blocos sem estourar)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Kit no celular, tablet e verificação final

**Files:**
- Create: `bussola_web/e2e/estudos.tablet.spec.mjs`
- Modify: `bussola_web/src/pages/Estudos/styles.css`, `bussola_web/e2e/estudos.mobile.spec.mjs`

**Interfaces:**
- Consumes: `mockEstudos`, `stubClipboard`, `overflowOffenders(OutsideScrollers)`, `smallTargets`.
- Produces: kit em 1 coluna no celular, botões de baixar/copiar instruções em largura total (48px), copiar comando MCP de 44px; o link "Biblioteca" do kit some no celular (a topbar tem o Voltar).

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/estudos.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 5 — kit
// ---------------------------------------------------------------------------
test.describe('kit', () => {
  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px`, async ({ page }) => {
      await mockEstudos(page);
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/estudos/kit');
      await page.locator('.kit-card').first().waitFor();
      expect(await overflowOffenders(page), `${w}px`).toEqual([]);
    });
  }

  test('cards em 1 coluna, botões em largura total, alvos ≥ 44px, sem o link "Biblioteca"', async ({ page }) => {
    await mockEstudos(page);
    await gotoApp(page, '/estudos/kit');
    const cards = await Promise.all((await page.locator('.kit-card').all()).map((c) => c.boundingBox()));
    expect(cards).toHaveLength(2);
    expect(Math.round(cards[0].x)).toBe(16);
    expect(Math.round(cards[1].x)).toBe(16);
    expect(Math.round(cards[1].y - (cards[0].y + cards[0].height))).toBe(12);
    for (const b of await page.locator('.kit-baixar').all()) {
      const box = await b.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(Math.round(box.width)).toBe(390 - 32 - 32);
    }
    await expect(page.locator('.estudos-kit-voltar')).toBeHidden();
    expect(await smallTargets(page, '.estudos-scope')).toEqual([]);
  });

  test('copiar o comando do MCP e baixar o kit', async ({ page }) => {
    await stubClipboard(page);
    await mockEstudos(page);
    await gotoApp(page, '/estudos/kit');
    await page.locator('.kit-comando button').click();
    expect((await page.evaluate(() => window.__clip))[0]).toContain('claude mcp add --transport http bussola');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Baixar kit para Claude Code/ }).click();
    expect((await download).suggestedFilename()).toBe('bussola-estudos-claude-code.zip');
  });
});
```

Criar `bussola_web/e2e/estudos.tablet.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffendersOutsideScrollers, smallTargets } from './helpers.mjs';
import { mockEstudos } from './fixtures/estudos.mjs';

const ROTAS = [['biblioteca', '/estudos', '.estudo-card'], ['kit', '/estudos/kit', '.kit-card'], ['leitura', '/estudos/9101', '.bloco-quiz']];

for (const w of [900, 1024]) {
  for (const [nome, rota, pronto] of ROTAS) {
    test(`tablet ${w}px ${nome}: sem overflow`, async ({ page }) => {
      await mockEstudos(page);
      await page.setViewportSize({ width: w, height: 1200 });
      await gotoApp(page, rota);
      await page.locator(pronto).first().waitFor();
      expect(await overflowOffendersOutsideScrollers(page)).toEqual([]);
    });
  }
}

test('tablet: filtros, ações e gatilhos por bloco com 44px e visíveis sem hover', async ({ page }) => {
  await mockEstudos(page);
  await gotoApp(page, '/estudos');
  await page.locator('.estudo-card').first().waitFor();
  expect(await smallTargets(page, '.estudos-temas')).toEqual([]);
  expect(await smallTargets(page, '.estudos-filtros')).toEqual([]);
  await gotoApp(page, '/estudos/9101');
  expect(await smallTargets(page, '.estudo-acoes')).toEqual([]);
  const acoesBloco = page.locator('#bloco-b3 .estudo-bloco-acoes');
  expect(await acoesBloco.evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  expect((await acoesBloco.locator('button').boundingBox()).height).toBeGreaterThanOrEqual(44);
});
```

Run: `npm run e2e -- --project=mobile e2e/estudos.mobile.spec.mjs` e `npm run e2e -- --project=tablet e2e/estudos.tablet.spec.mjs`
Expected: FAIL no kit (botões com a largura do texto, link "Biblioteca" visível, copiar comando ~22px; em 360px a grade `minmax(320px, …)` com o padding do card estoura). O tablet pode já passar parcialmente (os alvos de 44px vêm da Task 3).

- [ ] **Step 2: CSS do kit**

Em `bussola_web/src/pages/Estudos/styles.css`, dentro do bloco `@media (max-width: 768px)` da seção **ESTUDOS — celular (≤768)**, logo antes da chave final `}`, adicionar:

```css
    /* ---- kit ---- */
    .estudos-scope .page-header .estudos-kit-voltar { display: none; } /* a topbar tem o Voltar */
    .kit-intro,
    .kit-rodape { font-size: 0.9375rem; }
    .kit-grade { grid-template-columns: 1fr; gap: var(--sp-3); margin-top: var(--sp-4); }
    .kit-card { padding: var(--sp-4); gap: var(--sp-4); }
    .kit-card header { gap: var(--sp-3); }
    .kit-passos { gap: var(--sp-3); }
    .kit-comando { padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-3); align-items: center; }
    .kit-card > .kit-baixar { align-self: stretch; }
    .kit-botoes { flex-direction: column; gap: var(--sp-2); }
    .kit-baixar { width: 100%; min-height: 48px; }
```

- [ ] **Step 3: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/estudos.mobile.spec.mjs` → Expected: 1 + 7 + 10 + 14 + 6 passed.
Run: `npm run e2e -- --project=tablet` → Expected: `estudos.tablet.spec.mjs` (7) e os demais tablets passam. Se o tablet listar overflow na leitura em 900px (coluna de 760px + gatilho por bloco), confira que o `.estudo-bloco-acoes` está `position: static` (regra `@media (hover: none), (max-width: 1000px)` existente) e corrija só o elemento listado.
Run: `npm run e2e -- --project=desktop` → Expected: 20 passed (`estudos-kit.png` idêntico).

- [ ] **Step 4: Suíte completa, build, lint e verificador**

Run: `npm run e2e` → Expected: tudo passa nos 3 projetos.
Run: `npm run build` → Expected: OK.
Run: `node scripts/verificar-estudos.mjs` → Expected: `inline ok` / `comandos ok`.
Run: `npm run lint 2>&1 | Select-String " error " | Measure-Object` → Expected: contagem igual à de antes do plano (registre os dois números na mensagem do commit).

- [ ] **Step 5: Conferência visual (360, 390, 430 e 900px)**

Tire screenshots de `/estudos`, `/estudos/kit` e `/estudos/9101` (com `mockEstudos`, num script rápido em `test-results/` usando `page.screenshot({ fullPage: true })`) em 360, 390 e 430 e **abra as imagens**:
- topbar: "Estudos" na biblioteca; "← Kit do Claude" e "← Banco de Dados" nas sub-rotas, com o Voltar alinhado a 8px da borda e o título com reticências quando longo;
- biblioteca: chips de KPI com 8px entre si; faixa de temas em pílulas de 44px rolando de lado (o último tema cortado na borda indica a rolagem); chips de tipo em até 2 linhas com 8px; cards em 1 coluna com 16px de gutter e 12px entre eles, mesmos selos/etiquetas/borda colorida;
- leitura: etiquetas, título, subtítulo e ações com 8px internos e 24px até o primeiro bloco; Estudado + lixeira na mesma linha; Pedir ao Claude e destino em largura total; blocos com 16px entre si; tabela e código rolando dentro do próprio card; fontes com quebra;
- sheet "Pedir ao Claude": rótulo "MATERIAL INTEIRO"/"BLOCO B3", linhas de 52px, rodapé Voltar/Copiar comando 50/50;
- kit: 2 cards em coluna, botões de 48px de largura total, comando com o copiar de 44px à direita;
- 900px: biblioteca com a coluna de temas (≥ 861px) e cards em grade; leitura com os gatilhos por bloco visíveis.
Qualquer valor fora da escala ou desalinhado: corrija o CSS e repita.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Estudos bussola_web/e2e/estudos.mobile.spec.mjs bussola_web/e2e/estudos.tablet.spec.mjs
git commit -m "feat(web): kit de Estudos no celular, Estudos no tablet e verificacao final" -m "lint: <antes> -> <depois> erros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Decisões e suposições registradas neste plano

- **Título da leitura na topbar = nome do tema** (ou "Estudos" sem tema / carregando / erro), como o "pai" no iOS; o `h1` do material continua no conteúdo. Alternativa: o título do material com reticências (fica duplicado com o `h1` logo abaixo).
- **Breadcrumb da leitura some no celular** (a topbar faz o papel do Voltar e mostra o tema). O link para o tema continua acessível pelo Voltar quando se veio da biblioteca filtrada.
- **Voltar = histórico do app quando `history.state.idx > 0`**, senão substitui a entrada por `backTo`. Isso preserva o `?tema=` e não empilha a biblioteca; num link direto (idx 0) não sai do app. Se o usuário chegou à leitura por outro caminho (ex.: outra página do app), o Voltar volta para lá, não para a biblioteca.
- **API da topbar = store externo** (`useSyncExternalStore`) em vez de estado no `MobileChromeProvider`: evita `setState` dentro de efeito (regra v7) e não re-renderiza a árvore toda. `useLayoutEffect` para não piscar o título do módulo.
- **Dados de teste interceptados** (`page.route`): a REST não cria materiais e o banco demo não tem nenhum. Fórmula e diagrama (KaTeX/Mermaid, carregados sob demanda) **ficam fora** do material de teste; os contêineres deles já têm `overflow-x: auto`.
- **Helper novo `overflowOffendersOutsideScrollers`** em `e2e/helpers.mjs`: aceita conteúdo que rola dentro de um contêiner `overflow-x: auto|scroll` que caiba na tela (tabela, código). `overflowOffenders` continua como está.
- **Texto mínimo de 12px** nos chips do card (tema, nível, tags e etiqueta de tipo: eram 11.5–11.8px). Muda o tamanho de texto dentro do card (regra de tipografia do usuário vs. "não redesenhar") — o controlador confirma.
- **Faixa de temas em pílulas** (com borda arredondada de 999px) no celular: é um controle de filtro, não um card.
- **`overflow-wrap: anywhere` na coluna de leitura** (exceto a tabela de comparação, que rola): quebra identificadores e URLs longos.
- **Sem Fab em Estudos:** o site não cria materiais (quem cria é o Claude); a ação principal do celular é ler.
- **"Pedir ao Claude" no celular reaproveita as linhas do `ActionSheet`** (`.action-sheet-item`), mas não o componente (o `ActionSheet` fecha antes de agir e não tem o modo "pergunta" com rodapé).
- **A âncora `#` da seção e as citações `[n]`** ficam fora da regra de 44px (são inline no texto; a âncora é `aria-hidden`).

## Rulings do controlador (vinculantes)

- `TopbarTitle({ title, backTo })` genérico no shell, voltar usando o histórico do app quando houver, senão `replace` para `backTo`: **aceito**.
- Texto dos chips de estudo de ~11,5px para 12px (mínimo tipográfico): **aceito**.
- Dados de teste via `page.route` (sem criação pela API): **aceito**.
