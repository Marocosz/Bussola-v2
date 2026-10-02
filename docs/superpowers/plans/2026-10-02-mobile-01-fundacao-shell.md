# Mobile 01: Fundação + Shell, plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a base mobile do Bússola: harness de testes, limpeza de CSS, tokens, primitivos (`Sheet`, `ActionSheet`, `Fab`) e o shell mobile (topbar + barra inferior + "Mais" + IA em sheet). Ao fim, os planos por página só reorganizam layouts usando essas peças.

**Architecture:**
- Um hook `useIsMobile` (≤768px) decide o modo.
- O `BaseModal` vira bottom sheet no mobile via a classe `is-sheet` e CSS global, então todos os modais existentes passam a ser sheets sem mexer em cada chamada.
- O `Navbar` passa a ser o "shell": sidebar no desktop, recolhida no tablet, e `MobileTopbar` + `BottomNav` + `MoreSheet` no mobile.
- A segurança vem de testes Playwright: asserções de comportamento mobile e regressão visual do desktop (screenshots base antes de qualquer mudança).

**Tech Stack:** React 19, Vite 7, CSS puro, Font Awesome (npm), `@playwright/test` 1.63 (navegadores já instalados em `%LOCALAPPDATA%\ms-playwright`).

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-responsivo-design.md`. Este plano cobre as etapas 1–3 da seção 7 da spec. As etapas 4–10 (páginas, Auth/Início, PWA) ficam nos planos `mobile-02…` em diante, escritos depois deste, sobre a API real destes primitivos.

## Global Constraints

- **Não redesenhar cards existentes** (nota, compromisso, meta, categoria, plano/treino/refeição, widgets do Panorama). Só espaçamento, quebra, toque e ações visíveis.
- **Ícones:** usar exatamente as classes Font Awesome já usadas no código. Navegação: `fa-chart-pie` Panorama, `fa-wallet` Provisões, `fa-calendar-days` Roteiro, `fa-book` Registros, `fa-dumbbell` Ritmo, `fa-vault` Cofre, `fa-house` Início; IA = `fa-robot`; Mais = `fa-ellipsis`.
- **Rótulos:** Panorama, Provisões, Roteiro, Registros, Mais, Ritmo, Cofre, Início, Estudos (`fa-graduation-cap`; módulo vindo de `feat/estudos`, mesclada nesta branch em `dd7c546`). Estudos fica no "Mais".
- **Breakpoints (valores literais nos `@media`):** `≤480`, `≤768` (mobile), `769–1024` (tablet), `≥1025` (desktop).
- **Espaçamento:** `--sp-1:4px --sp-2:8px --sp-3:12px --sp-4:16px --sp-5:24px --sp-6:32px`. Usar 8 dentro de card, 12 entre cards, 24 entre seções e gutter mobile de 16px.
- **Toque:** alvo ≥ 44×44 (`pointer: coarse`); inputs, selects e textareas com 16px no mobile.
- **Hover:** efeitos só em `@media (hover: hover) and (pointer: fine)`.
- **z-index (mobile/novos componentes):** `--z-nav:100 --z-fab:110 --z-drawer:200 --z-sheet:300 --z-popover:400 --z-toast:500`. O desktop mantém os valores atuais.
- **Desktop (≥1025):** visualmente igual ao atual. Os screenshots base da Task 1 são o critério.
- **Lint:** `npm run lint` sem **novos** erros nos arquivos tocados (react-hooks v7: proibido `setState` síncrono em `useEffect` e mutar acumuladores; `catch {` sem variável não usada). **Build:** `npm run build` passa.
- **Commits:** terminar a mensagem com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch: `feat/mobile-responsivo`. Nunca fazer push nem merge em `main` neste plano.

## Review Focus

1. **Modais aninhados** (sheet → ConfirmDialog; UserDrawer → modal MCP): fechar o de cima não pode destravar o scroll do body nem perder a posição de rolagem. Teste na Task 5 (`ui-lab.mobile.spec.mjs` › "scroll lock aninhado").
2. **Cruzar 768px com sheet aberto** (girar o tablet, redimensionar): o modal continua aberto e só troca de apresentação, sem crash. Teste na Task 5 › "resize com modal aberto".
3. **Teclado aberto (viewport baixa, 390×420):** o rodapé com a ação principal do sheet continua visível. Teste na Task 5 › "rodapé visível com viewport baixa".
4. **Tema claro:** BottomNav, topbar e sheets usam as variáveis de tema (nada de cor dark fixa). Teste na Task 7 › "tema claro".
5. **Rota fora da navegação** (`/discord/link`): a topbar mostra "Bússola", sem robô e sem item ativo na barra, e nada quebra. Teste na Task 7 › "rota fora do menu".

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `bussola_web/playwright.config.mjs` | criar | projetos desktop/mobile/tablet + webServers |
| `bussola_web/e2e/demo-backend.ps1` | criar | sobe a API com um banco demo descartável (sem segredos reais) |
| `bussola_web/e2e/global-setup.mjs` | criar | login via API → `e2e/.auth/state.json` |
| `bussola_web/e2e/helpers.mjs` | criar | relógio fixo, navegação, medição de overflow |
| `bussola_web/e2e/*.spec.mjs` | criar | specs (desktop visual, ui-lab, shell) |
| `bussola_web/scripts/find-unused-css.mjs` | criar | lista regras CSS cujas classes não aparecem no código |
| `bussola_web/src/assets/styles/tokens.css` | criar | tokens de espaçamento, z-index, safe area e regras globais de toque |
| `bussola_web/src/assets/styles/components.css` | criar | primitivos de modal/form antes soltos no Agenda + CSS do sheet mobile |
| `bussola_web/src/hooks/useIsMobile.js` | criar | `useMediaQuery`, `useIsMobile`, `useIsTablet` |
| `bussola_web/src/utils/scrollLock.js` | criar | trava de scroll com contador (funciona no iOS e com aninhamento) |
| `bussola_web/src/components/BaseModal.jsx` | modificar | modo sheet + scrollLock |
| `bussola_web/src/components/mobile/Sheet.jsx` | criar | bottom sheet genérico |
| `bussola_web/src/components/mobile/ActionSheet.jsx` | criar | lista de ações |
| `bussola_web/src/components/mobile/Fab.jsx` | criar | botão "+" da página |
| `bussola_web/src/components/mobile/MobileChrome.jsx` | criar | contexto do slot da topbar + `TopbarActions` |
| `bussola_web/src/components/mobile/mobile.css` | criar | estilos de sheet, action sheet, fab, topbar, bottom nav e mais |
| `bussola_web/src/components/Navbar/navItems.js` | criar | fonte única dos itens de navegação |
| `bussola_web/src/components/Navbar/MobileTopbar.jsx` | criar | topbar mobile |
| `bussola_web/src/components/Navbar/BottomNav.jsx` | criar | barra inferior |
| `bussola_web/src/components/Navbar/MoreSheet.jsx` | criar | sheet "Mais" |
| `bussola_web/src/components/Navbar/index.jsx` | modificar | shell: desktop/tablet/mobile |
| `bussola_web/src/assets/styles/layout.css` | modificar | remove o drawer mobile antigo; gutter e padding inferior mobile |
| `bussola_web/src/components/AiAssistant/useAiInsight.js` | criar | estado/fetch do insight |
| `bussola_web/src/components/AiAssistant/AiInsightPanel.jsx` | criar | conteúdo do card de IA (desktop e sheet) |
| `bussola_web/src/components/AiAssistant/index.jsx` | modificar | usa hook + painel; não renderiza no mobile |
| `bussola_web/src/components/Pickers/DatePicker.jsx`, `TimePicker.jsx`, `pickers.css` | modificar | painel em modo sheet no mobile |
| `bussola_web/src/components/CustomSelect/index.jsx`, `styles.css` | modificar | opções em Sheet no mobile |
| `bussola_web/src/components/DateRangeFilter.jsx` | modificar | menu em Sheet no mobile |
| `bussola_web/src/components/Tooltip.jsx` | modificar | só ativa com `hover: hover` |
| `bussola_web/src/pages/UiLab/index.jsx` | criar | página DEV-only (`/__ui`) para testar os primitivos isoladamente |
| `bussola_web/src/routes/index.jsx` | modificar | `MobileChromeProvider`, rota `/__ui` (DEV) |

---

### Task 1: Harness de testes E2E + screenshots base do desktop

**Files:**
- Create: `bussola_web/playwright.config.mjs`, `bussola_web/e2e/demo-backend.ps1`, `bussola_web/e2e/global-setup.mjs`, `bussola_web/e2e/helpers.mjs`, `bussola_web/e2e/desktop-visual.desktop.spec.mjs`
- Modify: `bussola_web/package.json` (devDependency + scripts), `bussola_web/.gitignore`

**Interfaces:**
- Produces: `gotoApp(page, path)`, `overflowOffenders(page)`, `FIXED_NOW` em `e2e/helpers.mjs`. Convenção de projetos: arquivos `*.desktop.spec.mjs` (1280×900), `*.mobile.spec.mjs` (390×844, touch) e `*.tablet.spec.mjs` (900×1200, touch). Usuário demo: `demo@bussola.dev` / `Demo12345!`.

- [ ] **Step 1: Instalar o runner**

Run (em `bussola_web/`): `npm i -D @playwright/test@1.63.0`
Expected: `package.json` com `"@playwright/test": "1.63.0"` em devDependencies. Não rode `npx playwright install`: os navegadores da 1.63 já estão em `%LOCALAPPDATA%\ms-playwright\chromium-1243`.

- [ ] **Step 2: Scripts e gitignore**

Em `bussola_web/package.json`, dentro de `"scripts"`, adicionar:

```json
"e2e": "playwright test",
"e2e:update": "playwright test --update-snapshots"
```

Ao final de `bussola_web/.gitignore`, adicionar:

```
# E2E
e2e/.auth/
test-results/
playwright-report/
```

(Os screenshots base em `e2e/*-snapshots/` **são versionados**.)

- [ ] **Step 3: Backend demo descartável**

Criar `bussola_web/e2e/demo-backend.ps1`:

```powershell
# Sobe a API do Bussola com um banco demo descartavel para os testes E2E.
# Usa variaveis de ambiente (tem precedencia sobre .env): nenhum segredo real.
# Python: $env:BUSSOLA_PY ou ..\bussola_api\venvbussola\Scripts\python.exe
$ErrorActionPreference = 'Stop'
$api = Resolve-Path (Join-Path $PSScriptRoot '..\..\bussola_api')
$py = if ($env:BUSSOLA_PY) { $env:BUSSOLA_PY } else { Join-Path $api 'venvbussola\Scripts\python.exe' }
if (-not (Test-Path $py)) { throw "Python nao encontrado em '$py'. Defina `$env:BUSSOLA_PY." }

$env:PROJECT_NAME = 'Bussola E2E'
$env:API_V1_STR = '/api/v1'
$env:DEPLOYMENT_MODE = 'SELF_HOSTED'
$env:ENABLE_PUBLIC_REGISTRATION = 'False'
$env:SECRET_KEY = 'e2e-only-secret-key-not-for-production-0000000000'
$env:ENCRYPTION_KEY = 'Yo8EA350JXTXrOlBcXiRufoPG6nRGnetlC6-FYqwaMw='   # chave Fernet so de teste
$env:ACCESS_TOKEN_EXPIRE_MINUTES = '1440'
$env:ALGORITHM = 'HS256'
$env:DATABASE_URL = 'sqlite:///./data/e2e_demo.db'
$env:REDIS_URL = 'redis://127.0.0.1:6399/0'   # inexistente de proposito: o app degrada sem Redis
foreach ($k in 'GROQ_API_KEY','GEMINI_API_KEY','OPENAI_API_KEY','OPENWEATHER_API_KEY','NEWS_API_KEY',
               'GOOGLE_CLIENT_ID','VITE_GOOGLE_CLIENT_ID','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET',
               'DISCORD_BOT_TOKEN','DISCORD_CLIENT_ID') { Set-Item "env:$k" 'dummy' }
$env:MAIL_USERNAME = 'e2e@example.com'; $env:MAIL_PASSWORD = 'dummy'; $env:MAIL_FROM = 'e2e@example.com'
$env:MAIL_PORT = '587'; $env:MAIL_SERVER = 'localhost'; $env:MAIL_FROM_NAME = 'E2E'
$env:MAIL_STARTTLS = 'False'; $env:MAIL_SSL_TLS = 'False'
$env:FRONTEND_URL = 'http://127.0.0.1:5173'
$env:BACKEND_CORS_ORIGINS = '["http://127.0.0.1:5173","http://localhost:5173"]'

Set-Location $api
New-Item -ItemType Directory -Force data | Out-Null
if (-not (Test-Path 'data\e2e_demo.db')) {
    & $py -c "import app.main" | Out-Null      # create_all das tabelas
    & $py scripts/create_user.py --email demo@bussola.dev --password 'Demo12345!'
    & $py scripts/populate_db.py
}
& $py -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- [ ] **Step 4: Config do Playwright**

Criar `bussola_web/playwright.config.mjs`:

```js
import { defineConfig, devices } from '@playwright/test';

const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.mjs',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    storageState: 'e2e/.auth/state.json',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    { name: 'desktop', testMatch: /.*\.desktop\.spec\.mjs/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', testMatch: /.*\.mobile\.spec\.mjs/, use: { ...devices['Desktop Chrome'], ...mobile } },
    { name: 'tablet', testMatch: /.*\.tablet\.spec\.mjs/, use: { ...devices['Desktop Chrome'], viewport: { width: 900, height: 1200 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    {
      command: 'powershell -NoProfile -ExecutionPolicy Bypass -File e2e/demo-backend.ps1',
      url: 'http://127.0.0.1:8000/docs',
      reuseExistingServer: true,
      timeout: 240_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
```

- [ ] **Step 5: Login global**

Criar `bussola_web/e2e/global-setup.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';

export default async function globalSetup() {
  const body = new URLSearchParams({ username: 'demo@bussola.dev', password: 'Demo12345!' });
  const res = await fetch('http://127.0.0.1:8000/api/v1/auth/access-token', { method: 'POST', body });
  if (!res.ok) throw new Error(`login demo falhou: ${res.status} ${await res.text()}`);
  const { access_token, refresh_token } = await res.json();
  const state = {
    cookies: [],
    origins: [{
      origin: 'http://127.0.0.1:5173',
      localStorage: [
        { name: '@Bussola:token', value: access_token },
        { name: '@Bussola:refresh_token', value: refresh_token },
      ],
    }],
  };
  const file = path.resolve('e2e/.auth/state.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state));
}
```

- [ ] **Step 6: Helpers**

Criar `bussola_web/e2e/helpers.mjs`:

```js
// Relógio fixo: datas exibidas estáveis entre execuções (os dados demo ficam no banco).
export const FIXED_NOW = new Date('2026-10-02T12:00:00-03:00');

export async function gotoApp(page, path) {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

// Elementos visíveis que ultrapassam a largura da viewport (só o mais externo de cada ramo).
export async function overflowOffenders(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const out = [];
    const isOut = (r) => r.right > vw + 1 || r.left < -1;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || !isOut(r)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[data-offscreen-ok]')) continue;
      const p = el.parentElement;
      if (p && isOut(p.getBoundingClientRect())) continue;
      out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    }
    return out;
  });
}
```

- [ ] **Step 7: Spec de regressão visual do desktop**

Criar `bussola_web/e2e/desktop-visual.desktop.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

const ROUTES = [
  ['home', '/home'], ['panorama', '/panorama'], ['financas', '/financas'],
  ['agenda', '/agenda'], ['registros', '/registros'], ['estudos', '/estudos'], ['ritmo', '/ritmo'], ['cofre', '/cofre'],
];

for (const [name, path] of ROUTES) {
  test(`desktop ${name} inalterado`, async ({ page }) => {
    await gotoApp(page, path);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}

// Modais: cobrem os primitivos de modal/form que serão movidos na Task 3.
const MODALS = [
  ['modal-transacao', '/financas', async (p) => {
    await p.getByRole('button', { name: 'Adicionar' }).first().click();
    await p.getByText('Pontual', { exact: true }).last().click();
  }],
  ['modal-compromisso', '/agenda', async (p) => { await p.getByRole('button', { name: 'Adicionar' }).click(); }],
  ['modal-segredo', '/cofre', async (p) => { await p.getByRole('button', { name: 'Guardar Segredo' }).click(); }],
  ['modal-nota', '/registros', async (p) => { await p.getByRole('button', { name: 'Nota' }).click(); }],
  ['modal-treino', '/ritmo', async (p) => { await p.getByRole('button', { name: 'Novo Treino' }).click(); }],
];

for (const [name, path, open] of MODALS) {
  test(`desktop ${name} inalterado`, async ({ page }) => {
    await gotoApp(page, path);
    await open(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`${name}.png`);
  });
}
```

- [ ] **Step 8: Gerar as screenshots base (antes de qualquer mudança de código)**

Run (em `bussola_web/`, PowerShell): `$env:BUSSOLA_PY='<caminho do python do venv do bussola_api>'; npm run e2e:update -- --project=desktop`
Expected: 13 testes passam e são criados os arquivos `e2e/desktop-visual.desktop.spec.mjs-snapshots/*.png`. Abra 2 ou 3 PNGs e confirme que mostram a página logada (não o login nem o "Algo deu errado"). Se um seletor de modal não encontrar o botão, ajuste o seletor (não o app) até o screenshot mostrar o modal aberto.

- [ ] **Step 9: Confirmar que a base é estável**

Run: `npm run e2e -- --project=desktop`
Expected: 13 passed. Se algum teste falhar por diferença entre duas execuções sem mudança de código (algo dinâmico), adicione `mask: [page.locator('<seletor do elemento dinâmico>')]` naquele `toHaveScreenshot`, rode `e2e:update` de novo e repita até ficar estável.

- [ ] **Step 10: Commit**

```bash
git add bussola_web/package.json bussola_web/package-lock.json bussola_web/.gitignore bussola_web/playwright.config.mjs bussola_web/e2e
git commit -m "test(e2e): harness Playwright + base visual do desktop"
```

---

### Task 2: Limpeza de código morto e cargas duplicadas

**Files:**
- Create: `bussola_web/scripts/find-unused-css.mjs`
- Modify: `bussola_web/index.html`, `bussola_web/src/App.jsx`, `bussola_web/src/pages/Registros/styles.css`, `bussola_web/src/pages/Panorama/styles.css`, `bussola_web/src/pages/Financas/styles.css`, `bussola_web/src/pages/Auth/styles.css`, `bussola_web/src/assets/styles/global.css`
- Delete: `bussola_web/src/pages/Panorama/components/PanoramaModals.jsx`, `bussola_web/src/pages/Panorama/components/KpiCard.jsx` (somente se a busca do Step 3 confirmar que não são importados)

**Interfaces:**
- Produces: `node scripts/find-unused-css.mjs <arquivo.css>` lista as regras mortas (usado também pelos planos de página).

- [ ] **Step 1: Script detector de CSS não usado**

Criar `bussola_web/scripts/find-unused-css.mjs`:

```js
// Lista regras de um CSS cujas classes NÃO aparecem em nenhum .js/.jsx/.ts/.tsx de src/.
// Uso: node scripts/find-unused-css.mjs src/pages/Registros/styles.css
// Conservador: uma classe conta como usada se aparecer como palavra no código, ou se
// algum prefixo "xxx-" dela aparecer seguido de "${" (classe montada dinamicamente).
import fs from 'node:fs';
import path from 'node:path';

const cssFile = process.argv[2];
if (!cssFile) { console.error('uso: node scripts/find-unused-css.mjs <arquivo.css>'); process.exit(1); }

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
});
const source = walk('src').map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const used = (cls) => {
  if (new RegExp(`(^|[^\\w-])${cls.replace(/[-]/g, '\\-')}($|[^\\w-])`).test(source)) return true;
  for (let i = cls.indexOf('-'); i !== -1; i = cls.indexOf('-', i + 1)) {
    if (source.includes(cls.slice(0, i + 1) + '${')) return true;
  }
  return false;
};

const css = fs.readFileSync(cssFile, 'utf8');
const lines = css.split('\n');
const re = /([^{}]+)\{/g;
let m;
const dead = [];
while ((m = re.exec(css))) {
  const selector = m[1].trim();
  if (selector.startsWith('@') || /^(from|to|\d+%)$/.test(selector)) continue;
  const classes = [...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((x) => x[1]);
  if (!classes.length) continue;
  // morta se cada seletor da lista (separada por vírgula) tem ao menos uma classe não usada
  const parts = selector.split(',');
  const allPartsDead = parts.every((part) => [...part.matchAll(/\.([a-zA-Z_][\w-]*)/g)].some((x) => !used(x[1])));
  if (allPartsDead) {
    const line = css.slice(0, m.index).split('\n').length;
    dead.push(`${String(line).padStart(5)}  ${selector.replace(/\s+/g, ' ').slice(0, 110)}`);
  }
}
console.log(dead.length ? dead.join('\n') : '(nenhuma regra morta)');
console.log(`\n${dead.length} regra(s) candidata(s) em ${cssFile} (${lines.length} linhas)`);
```

- [ ] **Step 2: Rodar o detector nos 3 arquivos suspeitos**

Run (em `bussola_web/`):
```
node scripts/find-unused-css.mjs src/pages/Registros/styles.css
node scripts/find-unused-css.mjs src/pages/Panorama/styles.css
node scripts/find-unused-css.mjs src/pages/Financas/styles.css
```
Expected: listas de candidatas. A auditoria indicou como mortos, entre outros:
- **Registros:** `.tarefas-grid`, `.tarefa-card*`, `.concluidas-*`, `.subtarefas-*`, `.tree-*`, `.ql-*`, `.quill`, `.custom-quill-editor`, `.editor-container`, `.links-*`, `.registros-layout`, `.registros-column`.
- **Panorama:** `.kpi-grid-horizontal`, `.charts-grid-layout`, `.action-buttons-panel`, `.large-table-modal`. Nesse arquivo ficam vivos só `.panorama-scope.main-container`, `.btn-privacy-toggle` e `.chart-subtitle`.
- **Financas:** `.categoria-card*`, `.category-grid`.

- [ ] **Step 3: Remover componentes do Panorama não usados**

Run: `git grep -n "PanoramaModals\|KpiCard" -- bussola_web/src`
Expected: só as próprias definições (nenhum `import`). Se for o caso, apague `src/pages/Panorama/components/PanoramaModals.jsx` e `src/pages/Panorama/components/KpiCard.jsx` e rode o detector do Panorama de novo (classes só usadas por eles passam a aparecer como mortas).

- [ ] **Step 4: Apagar as regras mortas**

Para cada regra listada pelo detector nos 3 arquivos: apague o bloco inteiro (seletor + `{…}`). Dentro de `@media`, apague a regra; se o `@media` ficar vazio, apague-o também. **Não apague** regras cuja classe você encontre em uso ao abrir o JSX (falso positivo de classe dinâmica). Na dúvida, mantenha. `@keyframes` só usados por regras apagadas também saem (`git grep -n "<nome-do-keyframe>"`).

- [ ] **Step 5: Cargas duplicadas e variáveis inexistentes**

Em `bussola_web/index.html`, apagar estas duas linhas (o npm já fornece os mesmos CSS via `main.jsx`):

```html
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/weather-icons/2.0.10/css/weather-icons.min.css">
```

Em `bussola_web/src/App.jsx`, apagar a linha `import './assets/styles/global.css'; `. **Não** reordene `main.jsx`. Lá o `global.css` já é importado depois de `App` (portanto depois de todo o CSS das páginas), seguido de weather-icons e Font Awesome, que é exatamente a ordem efetiva de hoje.

Variáveis CSS inexistentes, trocar pela existente equivalente:
- `src/pages/Auth/styles.css`: `var(--cor-fundo-principal)` → `var(--cor-fundo)`; `var(--cor-fundo-card)` → `var(--cor-card-principal)`; `var(--cor-borda-suave)` → `var(--cor-borda)`.
- `src/assets/styles/global.css` (regra `.page-header-main h1`): `var(--cor-texto-primario)` → `var(--cor-texto-principal)`.

Run: `git grep -n "cor-fundo-principal\|cor-fundo-card\|cor-borda-suave\|cor-texto-primario" -- bussola_web/src`
Expected: nenhuma ocorrência.

- [ ] **Step 6: Verificar**

Run: `npm run build` → Expected: build OK.
Run: `npm run e2e -- --project=desktop` → Expected: 13 passed. Se um screenshot mudou, a regra apagada estava viva: restaure-a (`git diff` mostra o bloco) e rode de novo. Exceção esperada: a troca de `--cor-texto-primario` pode mudar a cor do título do `page-header` (a variável inexistente fazia o título herdar a cor). Se só isso mudou, confira no PNG de diff (`test-results/`) que a diferença é a cor do h1 e regenere a base com `npm run e2e:update -- --project=desktop`.
Run: `npm run lint 2>&1 | Select-String "error" | Measure-Object` antes e depois → Expected: contagem igual ou menor.

- [ ] **Step 7: Commit**

```bash
git add -A bussola_web/src bussola_web/index.html bussola_web/scripts
git commit -m "chore(web): remove CSS/componentes mortos e cargas duplicadas"
```

---

### Task 3: Primitivos de modal/form compartilhados e escopos

**Files:**
- Create: `bussola_web/src/assets/styles/components.css`
- Modify: `bussola_web/src/pages/Agenda/styles.css`, `bussola_web/src/components/UserDrawer/styles.css`, `bussola_web/src/pages/Auth/styles.css` + JSX das páginas Auth, `bussola_web/src/main.jsx`

**Interfaces:**
- Produces: `components.css` (importado em `main.jsx` imediatamente antes de `global.css`), onde as próximas tasks adicionam o CSS mobile dos modais.

- [ ] **Step 1: Mover os primitivos soltos do Agenda**

Em `src/pages/Agenda/styles.css`, localize as regras **sem escopo** (que não começam por `.agenda-scope`) para os seletores `.modal`, `.modal-content`, `.modal-header`, `.modal-header h3`, `.close-btn`, `.modal-body`, `.modal-footer`, `.form-row`, `.form-group`, `.form-input` e afins (bloco que começa por volta da linha 609 e vai até ~747), mais o `@media (max-width: 768px)` que ajusta `.modal-content` (~linha 939). **Recorte** essas regras, sem alterar nenhuma declaração, e cole em um novo `src/assets/styles/components.css`, com o cabeçalho:

```css
/* ========================================================= */
/* PRIMITIVOS COMPARTILHADOS DE MODAL E FORMULÁRIO            */
/* Antes viviam sem escopo em pages/Agenda/styles.css e       */
/* vazavam para todas as páginas. Fonte única a partir daqui. */
/* ========================================================= */
```

Regras do Agenda **com** escopo `.agenda-scope …` ficam onde estão.

- [ ] **Step 2: Importar na posição que preserva a cascata**

Em `src/main.jsx`, logo antes de `import './assets/styles/global.css'`, adicionar:

```js
import './assets/styles/components.css'
```

Observação: antes, essas regras carregavam no meio do CSS das páginas (entre Financas e Registros). Agora carregam depois de todas as páginas e antes do `global.css`. As regras de páginas que as sobrescrevem têm escopo (`.financas-scope .modal-content` etc.), portanto maior especificidade, e continuam vencendo.

- [ ] **Step 3: Escopar o UserDrawer**

Em `src/components/UserDrawer/styles.css`, prefixar com `.drawer-content ` toda regra que hoje começa por `.form-group` ou `.form-input` (por volta das linhas 151–164). Ex.: `.form-group label {` → `.drawer-content .form-group label {`.

- [ ] **Step 4: Separar `.auth-container`/`.auth-card` do Auth e do Login**

Run: `git grep -n "auth-container\|auth-card" -- bussola_web/src`
Em `src/pages/Auth/styles.css`, renomear `.auth-container` → `.auth-simple-container` e `.auth-card` → `.auth-simple-card` (todas as ocorrências do arquivo). Nos JSX de `src/pages/Auth/*.jsx` (ForgotPassword, ResetPassword, VerifyEmail, RegisterSuccess, DiscordLink, AutorizarConexao, os que usarem as classes), trocar as mesmas classes. **Não** mexer em `src/pages/Login` nem `src/pages/Register`, que continuam com `.auth-container`/`.auth-card` de `Login/styles.css`.

- [ ] **Step 5: Verificar**

Run: `npm run build` → OK.
Run: `npm run e2e -- --project=desktop` → Expected: 13 passed, inclusive os 5 `modal-*`. Se um modal mudou, compare o diff: alguma regra de página sem escopo dependia da ordem antiga. Mova essa regra específica para `components.css` (ou dê a ela o escopo da página) até o screenshot voltar a ser igual.
Abra `http://127.0.0.1:5173/forgot-password` no navegador desktop e confirme visualmente que não mudou. A página não tem screenshot base; compare com `main` se tiver dúvida.

- [ ] **Step 6: Commit**

```bash
git add -A bussola_web/src
git commit -m "refactor(web): primitivos de modal/form em components.css e escopos de Auth/Drawer"
```

---

### Task 4: Tokens, regras globais de toque e Tooltip só com hover

**Files:**
- Create: `bussola_web/src/assets/styles/tokens.css`, `bussola_web/e2e/foundation.mobile.spec.mjs`
- Modify: `bussola_web/src/main.jsx`, `bussola_web/index.html`, `bussola_web/src/assets/styles/global.css`, `bussola_web/src/assets/styles/layout.css`, `bussola_web/src/components/Tooltip.jsx`, `bussola_web/src/components/UserDrawer/styles.css`

**Interfaces:**
- Produces: variáveis CSS `--sp-1…--sp-6`, `--z-nav/--z-fab/--z-drawer/--z-sheet/--z-popover/--z-toast`, `--safe-top`, `--safe-bottom`, `--bottom-nav-h` (64px), `--topbar-h` (56px).

- [ ] **Step 1: Teste que falha**

Criar `bussola_web/e2e/foundation.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test('tokens existem e viewport cobre a safe area', async ({ page }) => {
  await gotoApp(page, '/cofre');
  const t = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return { sp3: s.getPropertyValue('--sp-3').trim(), zSheet: s.getPropertyValue('--z-sheet').trim(), nav: s.getPropertyValue('--bottom-nav-h').trim() };
  });
  expect(t).toEqual({ sp3: '12px', zSheet: '300', nav: '64px' });
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
});

test('inputs têm 16px no mobile (sem zoom do iOS)', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await page.getByRole('button', { name: 'Guardar Segredo' }).click();
  const sizes = await page.locator('.modal-content input, .modal-content textarea').evaluateAll(
    (els) => els.map((e) => getComputedStyle(e).fontSize));
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) expect(s).toBe('16px');
});

test('tooltip global não aparece em dispositivo de toque', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.locator('[title]').first().hover();
  await expect(page.locator('.app-tooltip')).toHaveCount(0);
});
```

Run: `npm run e2e -- --project=mobile e2e/foundation.mobile.spec.mjs`
Expected: os 3 FAIL (tokens vazios, viewport sem `viewport-fit`, inputs com 15.2px e tooltip presente).

- [ ] **Step 2: `tokens.css`**

Criar `bussola_web/src/assets/styles/tokens.css`:

```css
/* ========================================================= */
/* TOKENS DE LAYOUT (mobile-first)                            */
/* Breakpoints (literais nos @media): ≤480 celular pequeno,   */
/* ≤768 mobile, 769–1024 tablet, ≥1025 desktop.               */
/* Espaçamento: 8 dentro do card, 12 entre cards, 24 entre    */
/* seções, gutter mobile 16.                                   */
/* ========================================================= */
:root {
    --sp-1: 4px;
    --sp-2: 8px;
    --sp-3: 12px;
    --sp-4: 16px;
    --sp-5: 24px;
    --sp-6: 32px;

    --z-nav: 100;
    --z-fab: 110;
    --z-drawer: 200;
    --z-sheet: 300;
    --z-popover: 400;
    --z-toast: 500;

    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --bottom-nav-h: 64px;
    --topbar-h: 56px;
    --tap-min: 44px;
}

/* --- Toque: alvos mínimos de 44px em dispositivos de ponteiro grosso --- */
@media (pointer: coarse) {
    .btn-action-icon {
        min-width: var(--tap-min);
        min-height: var(--tap-min);
    }
}

/* --- Mobile: inputs de 16px (o iOS não dá zoom) --- */
@media (max-width: 768px) {
    input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
    select,
    textarea {
        font-size: 16px !important;
    }
}

/* --- Movimento reduzido: pausa animações infinitas --- */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-iteration-count: 1 !important;
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}
```

Em `src/main.jsx`, adicionar `import './assets/styles/tokens.css'` logo depois do import do `GoogleOAuthProvider` e **antes** de `import App from './App.jsx'`, para que as variáveis existam antes de qualquer CSS de página.

- [ ] **Step 3: Viewport**

Em `bussola_web/index.html`, trocar a meta viewport por:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 4: Hover só onde existe hover (botões globais)**

Em `src/assets/styles/global.css`, os efeitos `:hover` com `transform: translateY(...)` de `.btn-primary`, `.btn-secondary` e `.btn-delete` (seção de botões, ~linhas 141–171) devem ficar dentro de:

```css
@media (hover: hover) and (pointer: fine) {
    /* mover para cá as regras .btn-primary:hover, .btn-secondary:hover, .btn-delete:hover existentes, sem alterá-las */
}
```

O desktop (mouse) não muda, porque a media query casa.

- [ ] **Step 5: `dvh` nos alturas de viewport do shell**

- `src/components/UserDrawer/styles.css`, em `.drawer-content`: depois de `height: 100vh;`, adicionar a linha `height: 100dvh;` (o fallback fica antes).
- Mesmo padrão (`vh` seguido de `dvh`) em qualquer `min-height: 100vh` de `src/assets/styles/global.css` e `layout.css`.

- [ ] **Step 6: Tooltip só com hover**

Em `src/components/Tooltip.jsx`, no início do `useEffect` de registro de eventos (antes de `let current = null;`), adicionar:

```js
    // Toque não tem hover: o balão apareceria no "mouseover" sintético do tap e
    // forçaria dois toques no iOS. Informação crítica não pode depender de tooltip.
    if (!window.matchMedia('(hover: hover)').matches) return undefined;
```

- [ ] **Step 7: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/foundation.mobile.spec.mjs` → Expected: 3 passed.
Run: `npm run e2e -- --project=desktop` → Expected: 13 passed.

- [ ] **Step 8: Commit**

```bash
git add -A bussola_web/src bussola_web/index.html bussola_web/e2e
git commit -m "feat(web): tokens mobile, regras de toque, viewport-fit e tooltip so com hover"
```

---

### Task 5: `useIsMobile`, scroll lock, BaseModal em sheet e primitivos `Sheet`/`ActionSheet`/`Fab`

**Files:**
- Create: `bussola_web/src/hooks/useIsMobile.js`, `bussola_web/src/utils/scrollLock.js`, `bussola_web/src/components/mobile/Sheet.jsx`, `bussola_web/src/components/mobile/ActionSheet.jsx`, `bussola_web/src/components/mobile/Fab.jsx`, `bussola_web/src/components/mobile/mobile.css`, `bussola_web/src/pages/UiLab/index.jsx`, `bussola_web/e2e/ui-lab.mobile.spec.mjs`
- Modify: `bussola_web/src/components/BaseModal.jsx`, `bussola_web/src/assets/styles/components.css`, `bussola_web/src/routes/index.jsx`, `bussola_web/src/main.jsx`

**Interfaces:**
- Produces:
  - `useMediaQuery(query: string): boolean`, `useIsMobile(): boolean` (≤768), `useIsTablet(): boolean` (769–1024), `MOBILE_QUERY`, `TABLET_QUERY`, de `src/hooks/useIsMobile.js`.
  - `lockScroll(): void`, `unlockScroll(): void`, de `src/utils/scrollLock.js` (com contador).
  - `BaseModal({ children, onClose, className = '', sheet = 'auto' })`: `sheet` é `'auto' | 'full' | false`. No mobile, adiciona `is-sheet` e, com `'full'`, também `is-sheet-full`.
  - `Sheet({ open, onClose, title, children, footer, full = false, className = '' })`: renderiza `.modal-content.app-sheet` com `.sheet-grab`, `.modal-header` (h3 + `button.app-sheet-close[aria-label="Fechar"]`), `.modal-body` e `.modal-footer` opcional.
  - `ActionSheet({ open, onClose, title, subtitle, icon, actions })`: `actions: Array<{ key: string, icon?: string /* classe FA completa */, label: string, onClick: () => void, variant?: 'primary' | 'danger' }>`. Fecha antes de chamar `onClick`.
  - `Fab({ icon = 'fa-plus', label, onClick })`: portal no `body`, `button.app-fab[aria-label]`, visível só ≤768.

- [ ] **Step 1: Teste que falha (UI Lab)**

Criar `bussola_web/e2e/ui-lab.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test.beforeEach(async ({ page }) => { await gotoApp(page, '/__ui'); });

test('modal existente vira bottom sheet ancorado no rodapé', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  const overlay = page.locator('.modal-overlay.is-sheet');
  await expect(overlay).toBeVisible();
  const box = await page.locator('.modal-overlay.is-sheet > .modal-content').boundingBox();
  expect(Math.round(box.y + box.height)).toBe(844);
  expect(Math.round(box.width)).toBe(390);
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeInViewport();
});

test('rodapé visível com viewport baixa (teclado aberto)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeInViewport();
  await page.locator('.modal-overlay.is-sheet .modal-body').evaluate((b) => b.scrollTo(0, 99999));
  await expect(page.getByText('Fim do conteúdo')).toBeInViewport();
});

test('scroll lock aninhado: fechar o de cima mantém a trava', async ({ page }) => {
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  await page.getByRole('button', { name: 'Abrir confirmação' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
  await page.getByRole('button', { name: 'Fechar' }).first().click();
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(300);
});

test('resize com modal aberto troca sheet ↔ modal sem fechar', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.modal-overlay')).toBeVisible();
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.modal-overlay.is-sheet')).toBeVisible();
});

test('action sheet executa a ação e fecha', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir ações' }).click();
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.locator('.action-sheet')).toHaveCount(0);
  await expect(page.getByTestId('ultima-acao')).toHaveText('editar');
});

test('sheet full ocupa a tela inteira', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir sheet cheio' }).click();
  const box = await page.locator('.modal-overlay.is-sheet-full > .modal-content').boundingBox();
  expect(Math.round(box.height)).toBe(844);
});

test('fab tem 56px e fica acima da área da barra inferior', async ({ page }) => {
  const box = await page.locator('.app-fab').boundingBox();
  expect(Math.round(box.width)).toBe(56);
  expect(box.y + box.height).toBeLessThanOrEqual(844 - 64);
});
```

Run: `npm run e2e -- --project=mobile e2e/ui-lab.mobile.spec.mjs`
Expected: FAIL (a rota `/__ui` não existe).

- [ ] **Step 2: Hook de media query**

Criar `bussola_web/src/hooks/useIsMobile.js`:

```js
import { useSyncExternalStore } from 'react';

export const MOBILE_QUERY = '(max-width: 768px)';
export const TABLET_QUERY = '(min-width: 769px) and (max-width: 1024px)';

const subscribers = {};

function subscribeFor(query) {
    if (!subscribers[query]) {
        subscribers[query] = (callback) => {
            const mql = window.matchMedia(query);
            mql.addEventListener('change', callback);
            return () => mql.removeEventListener('change', callback);
        };
    }
    return subscribers[query];
}

export function useMediaQuery(query) {
    return useSyncExternalStore(
        subscribeFor(query),
        () => window.matchMedia(query).matches,
        () => false,
    );
}

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
export const useIsTablet = () => useMediaQuery(TABLET_QUERY);
```

- [ ] **Step 3: Scroll lock com contador**

Criar `bussola_web/src/utils/scrollLock.js`:

```js
// Trava o scroll do body enquanto houver ao menos um modal/sheet aberto.
// `overflow: hidden` sozinho não segura o iOS Safari; `position: fixed` com o
// deslocamento atual segura e, ao destravar, restauramos a posição.
let locks = 0;
let savedY = 0;

export function lockScroll() {
    locks += 1;
    if (locks > 1) return;
    savedY = window.scrollY;
    const s = document.body.style;
    s.position = 'fixed';
    s.top = `-${savedY}px`;
    s.left = '0';
    s.right = '0';
    s.width = '100%';
    s.overflow = 'hidden';
}

export function unlockScroll() {
    if (locks === 0) return;
    locks -= 1;
    if (locks > 0) return;
    const s = document.body.style;
    s.position = '';
    s.top = '';
    s.left = '';
    s.right = '';
    s.width = '';
    s.overflow = '';
    window.scrollTo(0, savedY);
}
```

- [ ] **Step 4: BaseModal em modo sheet**

Substituir `bussola_web/src/components/BaseModal.jsx` por:

```jsx
import { useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { lockScroll, unlockScroll } from '../utils/scrollLock';

/**
 * Overlay base de todos os modais. No mobile (≤768) vira bottom sheet:
 * `sheet="auto"` (padrão) ancora no rodapé; `sheet="full"` ocupa a tela;
 * `sheet={false}` mantém o modal centralizado também no celular.
 */
export function BaseModal({ children, onClose, className = '', sheet = 'auto' }) {
    const mouseDownTarget = useRef(null);
    const isMobile = useIsMobile();

    useEffect(() => {
        lockScroll();
        return unlockScroll;
    }, []);

    // Fecha com ESC
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleOverlayClick = useCallback((e) => {
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose();
    }, [onClose]);

    const handleMouseDown = useCallback((e) => {
        mouseDownTarget.current = e.target;
    }, []);

    const sheetClass = isMobile && sheet ? `is-sheet${sheet === 'full' ? ' is-sheet-full' : ''}` : '';

    return (
        <div
            className={`modal-overlay ${className} ${sheetClass}`}
            onMouseDown={handleMouseDown}
            onClick={handleOverlayClick}
            style={{ display: 'flex' }}
        >
            {children}
        </div>
    );
}
```

- [ ] **Step 5: CSS global do sheet**

Ao final de `bussola_web/src/assets/styles/components.css`, adicionar:

```css
/* ========================================================= */
/* MODAL → BOTTOM SHEET NO MOBILE (classe posta pelo BaseModal) */
/* !important vence os estilos de modal com escopo de página   */
/* e os style={{maxWidth}} inline dos componentes.             */
/* ========================================================= */
@media (max-width: 768px) {
    .modal-overlay.is-sheet {
        position: fixed !important;
        inset: 0 !important;
        display: flex !important;
        align-items: flex-end !important;
        justify-content: center !important;
        padding: 0 !important;
        z-index: var(--z-sheet) !important;
        background: rgba(0, 0, 0, 0.55);
    }

    .modal-overlay.is-sheet > .modal-content {
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        margin: 0 !important;
        height: auto !important;
        max-height: 92dvh !important;
        border-radius: 20px 20px 0 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow-y: auto !important;
        overscroll-behavior: contain;
        padding-bottom: var(--safe-bottom);
        animation: sheetUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* Com .modal-body: o corpo rola e cabeçalho/rodapé ficam fixos */
    .modal-overlay.is-sheet > .modal-content:has(> .modal-body) {
        overflow: hidden !important;
    }

    .modal-overlay.is-sheet > .modal-content > .modal-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto !important;
        overscroll-behavior: contain;
    }

    .modal-overlay.is-sheet > .modal-content > .modal-header,
    .modal-overlay.is-sheet > .modal-content > .modal-footer {
        flex-shrink: 0;
    }

    .modal-overlay.is-sheet > .modal-content > .modal-footer {
        padding-bottom: calc(var(--sp-3) + var(--safe-bottom)) !important;
    }

    .modal-overlay.is-sheet-full > .modal-content {
        height: 100dvh !important;
        max-height: 100dvh !important;
        border-radius: 0 !important;
        padding-top: var(--safe-top);
    }
}

@keyframes sheetUp {
    from { transform: translateY(24px); opacity: 0.6; }
    to { transform: none; opacity: 1; }
}
```

- [ ] **Step 6: Componentes `Sheet`, `ActionSheet` e `Fab`**

Criar `bussola_web/src/components/mobile/Sheet.jsx`:

```jsx
import { BaseModal } from '../BaseModal';

/** Bottom sheet genérico. No desktop renderiza como diálogo centralizado. */
export function Sheet({ open, onClose, title, children, footer, full = false, className = '' }) {
    if (!open) return null;
    return (
        <BaseModal onClose={onClose} sheet={full ? 'full' : 'auto'} className="app-sheet-overlay">
            <div
                className={`modal-content app-sheet ${className}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sheet-grab" aria-hidden="true" />
                {title && (
                    <div className="modal-header app-sheet-header">
                        <h3>{title}</h3>
                        <button type="button" className="app-sheet-close" onClick={onClose} aria-label="Fechar">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                )}
                <div className="modal-body app-sheet-body">{children}</div>
                {footer && <div className="modal-footer app-sheet-footer">{footer}</div>}
            </div>
        </BaseModal>
    );
}
```

Criar `bussola_web/src/components/mobile/ActionSheet.jsx`:

```jsx
import { Sheet } from './Sheet';

/** Lista de ações de um item (tocar na linha → ações). Fecha antes de executar. */
export function ActionSheet({ open, onClose, title, subtitle, icon, actions = [] }) {
    return (
        <Sheet open={open} onClose={onClose} className="action-sheet">
            {(title || icon) && (
                <div className="action-sheet-head">
                    {icon && <span className="action-sheet-icon"><i className={icon}></i></span>}
                    <div className="action-sheet-titles">
                        {title && <strong>{title}</strong>}
                        {subtitle && <span>{subtitle}</span>}
                    </div>
                </div>
            )}
            <div className="action-sheet-list">
                {actions.map((a) => (
                    <button
                        key={a.key}
                        type="button"
                        className={`action-sheet-item ${a.variant ? `is-${a.variant}` : ''}`}
                        onClick={() => { onClose(); a.onClick(); }}
                    >
                        {a.icon && <i className={a.icon}></i>}
                        <span>{a.label}</span>
                    </button>
                ))}
            </div>
        </Sheet>
    );
}
```

Criar `bussola_web/src/components/mobile/Fab.jsx`:

```jsx
import { createPortal } from 'react-dom';

/** Botão "+" da página (só aparece ≤768; no desktop as páginas mantêm seus botões). */
export function Fab({ icon = 'fa-plus', label, onClick }) {
    return createPortal(
        <button type="button" className="app-fab" onClick={onClick} aria-label={label}>
            <i className={`fa-solid ${icon}`}></i>
        </button>,
        document.body,
    );
}
```

- [ ] **Step 7: CSS dos primitivos**

Criar `bussola_web/src/components/mobile/mobile.css`:

```css
/* ===== Sheet (base desktop: diálogo centralizado) ===== */
.app-sheet-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-4);
    background: rgba(0, 0, 0, 0.6);
    z-index: var(--z-sheet);
}

.app-sheet {
    background: var(--cor-card-principal);
    border: 1px solid var(--cor-borda);
    border-radius: 16px;
    width: min(480px, 100%);
    max-height: 85dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: var(--cor-texto-principal);
}

.sheet-grab {
    display: none;
    width: 38px;
    height: 5px;
    border-radius: 3px;
    background: var(--cor-cinza-botao-hover);
    margin: var(--sp-2) auto 0;
    flex-shrink: 0;
}

.app-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
}

.app-sheet-header h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
}

.app-sheet-close {
    width: var(--tap-min);
    height: var(--tap-min);
    flex-shrink: 0;
    border: none;
    border-radius: 50%;
    background: var(--cor-card-secundario);
    color: var(--cor-texto-secundario);
    font-size: 1rem;
    cursor: pointer;
}

.app-sheet-body {
    padding: 0 var(--sp-4) var(--sp-4);
    overflow-y: auto;
}

.app-sheet-footer {
    display: flex;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-4);
    border-top: 1px solid var(--cor-borda);
}

.app-sheet-footer > * {
    flex: 1;
    min-height: 48px;
}

@media (max-width: 768px) {
    .sheet-grab { display: block; }
}

/* ===== ActionSheet ===== */
.action-sheet-head {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) 0 var(--sp-3);
}

.action-sheet-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--cor-card-secundario);
    flex-shrink: 0;
}

.action-sheet-titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.action-sheet-titles strong {
    font-size: 0.95rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.action-sheet-titles span {
    font-size: 0.8rem;
    color: var(--cor-texto-secundario);
}

.action-sheet-list {
    display: flex;
    flex-direction: column;
}

.action-sheet-item {
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
    font-size: 0.95rem;
    text-align: left;
    cursor: pointer;
}

.action-sheet-item i {
    width: 24px;
    text-align: center;
    color: var(--cor-texto-secundario);
}

.action-sheet-item.is-primary {
    justify-content: center;
    min-height: 48px;
    margin-bottom: var(--sp-2);
    border: none;
    border-radius: 14px;
    background: var(--cor-azul-primario);
    color: #fff;
    font-weight: 600;
}

.action-sheet-item.is-primary i { color: #fff; }

.action-sheet-item.is-danger,
.action-sheet-item.is-danger i {
    color: var(--cor-vermelho-delete);
}

/* ===== FAB ===== */
.app-fab {
    display: none;
}

@media (max-width: 768px) {
    .app-fab {
        position: fixed;
        right: var(--sp-4);
        bottom: calc(var(--bottom-nav-h) + var(--safe-bottom) + var(--sp-4));
        z-index: var(--z-fab);
        width: 56px;
        height: 56px;
        border: none;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: var(--cor-azul-primario);
        color: #fff;
        font-size: 1.35rem;
        box-shadow: 0 8px 20px rgba(var(--cor-tema-rgb), 0.45);
        cursor: pointer;
    }
}
```

Em `src/main.jsx`, adicionar `import './components/mobile/mobile.css'` logo antes de `import './assets/styles/components.css'`.

- [ ] **Step 8: Página UI Lab (somente DEV)**

Criar `bussola_web/src/pages/UiLab/index.jsx`:

```jsx
import { useState } from 'react';
import { BaseModal } from '../../components/BaseModal';
import { Sheet } from '../../components/mobile/Sheet';
import { ActionSheet } from '../../components/mobile/ActionSheet';
import { Fab } from '../../components/mobile/Fab';
import { useConfirm } from '../../context/ConfirmDialogContext';

/** Bancada DEV-only (/__ui) para testar os primitivos mobile isoladamente. */
export function UiLab() {
    const [modal, setModal] = useState(false);
    const [full, setFull] = useState(false);
    const [actions, setActions] = useState(false);
    const [ultima, setUltima] = useState('');
    const confirm = useConfirm();

    return (
        <div className="container" style={{ paddingTop: 24, paddingBottom: 1200 }}>
            <h2>UI Lab</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className="btn-primary" onClick={() => setModal(true)}>Abrir modal longo</button>
                <button className="btn-primary" onClick={() => setFull(true)}>Abrir sheet cheio</button>
                <button className="btn-primary" onClick={() => setActions(true)}>Abrir ações</button>
            </div>
            <p data-testid="ultima-acao">{ultima}</p>

            {modal && (
                <BaseModal onClose={() => setModal(false)} className="modal">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Modal longo</h3>
                            <button type="button" className="app-sheet-close" aria-label="Fechar" onClick={() => setModal(false)}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            {Array.from({ length: 14 }, (_, i) => (
                                <div className="form-group" key={i}>
                                    <label>Campo {i + 1}</label>
                                    <input className="form-input" />
                                </div>
                            ))}
                            <p>Fim do conteúdo</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => confirm({ title: 'Confirmar?', message: 'Teste aninhado' })}>
                                Abrir confirmação
                            </button>
                            <button className="btn-primary">Salvar</button>
                        </div>
                    </div>
                </BaseModal>
            )}

            <Sheet open={full} onClose={() => setFull(false)} full title="Sheet cheio">
                <p>Conteúdo em tela cheia.</p>
            </Sheet>

            <ActionSheet
                open={actions}
                onClose={() => setActions(false)}
                title="Aluguel · parcela 10/12"
                subtitle="05/10 · Casa · pendente"
                icon="fa-solid fa-house"
                actions={[
                    { key: 'efetivar', icon: 'fa-solid fa-check', label: 'Efetivar pagamento', variant: 'primary', onClick: () => setUltima('efetivar') },
                    { key: 'editar', icon: 'fa-solid fa-pen-to-square', label: 'Editar', onClick: () => setUltima('editar') },
                    { key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: () => setUltima('excluir') },
                ]}
            />

            <Fab label="Novo item" onClick={() => setUltima('fab')} />
        </div>
    );
}
```

Antes de salvar, confira a assinatura real do confirm: `git grep -n "export function useConfirm\|export const useConfirm\|confirm(" -- bussola_web/src/context/ConfirmDialogContext.jsx`. Se o hook tiver outro nome ou outros parâmetros, use os reais na chamada do botão "Abrir confirmação". Se o botão de cancelar do ConfirmDialog não se chamar "Cancelar", ajuste o teste "scroll lock aninhado" para o rótulo real.

Em `bussola_web/src/routes/index.jsx`:
- adicionar `import { lazy, Suspense } from 'react';` (mantendo `React`);
- depois dos imports de páginas, adicionar:

```jsx
// Bancada de componentes (somente em desenvolvimento; removida do build de produção).
const UiLab = import.meta.env.DEV ? lazy(() => import('../pages/UiLab').then((m) => ({ default: m.UiLab }))) : null;
```

- dentro de `<Routes>`, depois da rota `/cofre`:

```jsx
            {UiLab && (
                <Route path="/__ui" element={<PrivateRoute><Suspense fallback={null}><UiLab /></Suspense></PrivateRoute>} />
            )}
```

- [ ] **Step 9: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/ui-lab.mobile.spec.mjs` → Expected: 7 passed.
Run: `npm run e2e -- --project=desktop` → Expected: 13 passed (no desktop o BaseModal não ganha classe nova).
Run: `npm run build`, depois `git grep -n "UiLab" -- bussola_web/dist` → Expected: o build passa e não há nenhuma ocorrência no dist (a rota não vai para produção).

- [ ] **Step 10: Commit**

```bash
git add -A bussola_web/src bussola_web/e2e
git commit -m "feat(web): BaseModal vira bottom sheet no mobile + primitivos Sheet/ActionSheet/Fab"
```

---

### Task 6: Pickers, CustomSelect e DateRangeFilter em sheet no mobile

**Files:**
- Modify: `bussola_web/src/components/Pickers/DatePicker.jsx`, `bussola_web/src/components/Pickers/TimePicker.jsx`, `bussola_web/src/components/Pickers/pickers.css`, `bussola_web/src/components/CustomSelect/index.jsx`, `bussola_web/src/components/CustomSelect/styles.css`, `bussola_web/src/components/DateRangeFilter.jsx`, `bussola_web/src/pages/UiLab/index.jsx`
- Test: `bussola_web/e2e/pickers.mobile.spec.mjs`

**Interfaces:**
- Consumes: `useIsMobile()` (Task 5), `Sheet` (Task 5).
- Produces: a mesma API pública de hoje dos três componentes (nenhuma prop nova).

- [ ] **Step 1: Teste que falha**

No UI Lab (`src/pages/UiLab/index.jsx`), adicionar os imports e o estado:

```jsx
import { DatePicker, TimePicker } from '../../components/Pickers';
import { CustomSelect } from '../../components/CustomSelect';
import { DateRangeFilter } from '../../components/DateRangeFilter';
// dentro do componente:
const [data, setData] = useState('');
const [hora, setHora] = useState('');
const [cat, setCat] = useState('');
const [periodo, setPeriodo] = useState('');
```

E, logo abaixo do `<p data-testid="ultima-acao">`, adicionar:

```jsx
            <div style={{ display: 'grid', gap: 12, maxWidth: 360, marginTop: 16 }}>
                <DatePicker label="Data" value={data} onChange={(e) => setData(e.target.value)} />
                <TimePicker label="Hora" value={hora} onChange={(e) => setHora(e.target.value)} />
                <CustomSelect label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}
                    options={[{ value: '1', label: 'Alimentação' }, { value: '2', label: 'Casa' }, { value: '3', label: 'Lazer' }]} />
                <DateRangeFilter onChange={(r) => setPeriodo(`${r.start}|${r.end}`)} />
                <p data-testid="valores">{`${data}|${hora}|${cat}|${periodo}`}</p>
            </div>
```

Confira o caminho de export dos pickers em `src/components/Pickers/index.js` e do CustomSelect (`export const CustomSelect`), e ajuste os imports se forem diferentes.

Criar `bussola_web/e2e/pickers.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test.beforeEach(async ({ page }) => { await gotoApp(page, '/__ui'); });

const sheetBottom = async (loc) => { const b = await loc.boundingBox(); return Math.round(b.y + b.height); };

test('DatePicker abre como sheet de largura total e seleciona', async ({ page }) => {
  await page.getByText('Data', { exact: true }).locator('..').locator('.pk-trigger, button, [role="button"]').first().click();
  const panel = page.locator('.pk-date-panel');
  await expect(panel).toHaveClass(/pk-panel--sheet/);
  expect(Math.round((await panel.boundingBox()).width)).toBe(390);
  expect(await sheetBottom(panel)).toBe(844);
  await panel.getByRole('button', { name: 'Hoje' }).click();
  await expect(page.getByTestId('valores')).toHaveText(/^2026-10-02\|/);
});

test('TimePicker abre como sheet', async ({ page }) => {
  await page.getByText('Hora', { exact: true }).locator('..').locator('.pk-trigger, button, [role="button"]').first().click();
  const panel = page.locator('.pk-panel.pk-panel--sheet');
  await expect(panel).toBeVisible();
  expect(await sheetBottom(panel)).toBe(844);
});

test('CustomSelect lista opções em sheet e seleciona', async ({ page }) => {
  await page.locator('.custom-select-trigger').click();
  await expect(page.locator('.modal-overlay.is-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Casa' }).click();
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  await expect(page.getByTestId('valores')).toHaveText(/\|2\|/);
});

test('DateRangeFilter abre presets em sheet', async ({ page }) => {
  await page.locator('.drf-trigger').click();
  await expect(page.locator('.modal-overlay.is-sheet')).toBeVisible();
  await expect(page.locator('.drf-menu')).toHaveCount(0);
});
```

Antes de rodar, abra `DatePicker.jsx`/`TimePicker.jsx` e confirme a classe real do gatilho (o elemento com `onClick={openPanel}`) e o rótulo real do botão "Hoje". Ajuste os seletores do teste se forem diferentes.

Run: `npm run e2e -- --project=mobile e2e/pickers.mobile.spec.mjs`
Expected: 4 FAIL (painéis em popover).

- [ ] **Step 2: DatePicker e TimePicker em modo sheet**

Em **cada** um (`DatePicker.jsx` e `TimePicker.jsx`):
1. Importar: `import { useIsMobile } from '../../hooks/useIsMobile';` e, no topo do componente, `const isMobile = useIsMobile();`.
2. No `useEffect` de "Fechar ao clicar fora / scroll / ESC", dentro de `onScroll`, adicionar como primeira linha `if (isMobile) return;` (no sheet, rolar a página por trás não fecha), e trocar o array de dependências `[open]` por `[open, isMobile]`.
3. No JSX do painel (`<div ref={panelRef} className="pk-panel …" style={{ position: 'fixed', top…, left…, width…, zIndex: 9999 }}`), trocar `className` e `style` por:

```jsx
            className={`pk-panel pk-date-panel${isMobile ? ' pk-panel--sheet' : ''}`}
            style={isMobile
                ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 'var(--z-popover)' }
                : { position: 'fixed', top: panelPos.top, left: panelPos.left, width: panelPos.width, zIndex: 9999 }}
```

(No `TimePicker` a classe base é a que já existe lá; mantenha-a e só acrescente `pk-panel--sheet` no mobile.)
4. Onde o painel vai para o portal (`createPortal(panel, document.body)`), trocar por:

```jsx
{open && createPortal(
    <>
        {isMobile && <div className="pk-backdrop" />}
        {panel}
    </>,
    document.body,
)}
```

(O `mousedown` no backdrop cai fora do wrapper e do painel, então o handler existente já fecha.)

Ao final de `src/components/Pickers/pickers.css`:

```css
/* ===== Mobile: painel vira bottom sheet ===== */
.pk-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-popover);
    background: rgba(0, 0, 0, 0.45);
}

.pk-panel.pk-panel--sheet {
    width: auto !important;
    border-radius: 20px 20px 0 0;
    padding-bottom: calc(var(--sp-4) + var(--safe-bottom));
    animation: sheetUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (pointer: coarse) {
    .pk-cal-nav-btn { min-width: var(--tap-min); min-height: var(--tap-min); }
    .pk-panel--sheet .pk-cal-day { min-height: 44px; }
}
```

Confira os nomes reais das classes de dia e de navegação em `pickers.css` (`.pk-cal-day`, `.pk-cal-nav-btn`) e use os existentes.

- [ ] **Step 3: CustomSelect em sheet**

Em `src/components/CustomSelect/index.jsx`:
1. Importar `useIsMobile` e `Sheet` (`import { Sheet } from '../mobile/Sheet';`).
2. `const isMobile = useIsMobile();` no topo.
3. No `useEffect` do clique fora: primeira linha do `handleClickOutside` passa a ser `if (isMobile) return;`, e as dependências passam de `[]` para `[isMobile]` (no mobile as opções vivem num portal fora do wrapper; o sheet cuida de fechar).
4. Trocar o bloco `{isOpen && ( <div className="custom-select-options"> … </div> )}` por:

```jsx
            {isOpen && !isMobile && (
                <div className="custom-select-options">
                    {options.map(opt => renderOption(opt))}
                </div>
            )}

            {isMobile && (
                <Sheet open={isOpen} onClose={() => setIsOpen(false)} title={label || placeholder}>
                    <div className="cs-sheet-list">
                        {options.map(opt => renderOption(opt, true))}
                    </div>
                </Sheet>
            )}
```

5. Antes do `return`, extrair a renderização de uma opção (o mesmo JSX de hoje), sem mudar o visual no desktop:

```jsx
    const renderOption = (opt, asButton = false) => {
        const Tag = asButton ? 'button' : 'div';
        return (
            <Tag
                key={opt.value}
                type={asButton ? 'button' : undefined}
                className={`custom-option ${String(value) === String(opt.value) ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
            >
                {opt.color && (
                    <span className="cs-opt-icon-wrap" style={{ backgroundColor: opt.color }}>
                        {opt.icon && <i className={opt.icon}></i>}
                    </span>
                )}
                <span className="cs-opt-label">{opt.label}</span>
                {opt.type && <span className={`cs-opt-type cs-opt-type-${String(opt.type).toLowerCase()}`}>{opt.type}</span>}
            </Tag>
        );
    };
```

Ao final de `src/components/CustomSelect/styles.css`:

```css
/* ===== Mobile: opções em bottom sheet ===== */
.cs-sheet-list {
    display: flex;
    flex-direction: column;
}

.cs-sheet-list .custom-option {
    width: 100%;
    min-height: 48px;
    border: none;
    border-top: 1px solid var(--cor-borda);
    background: transparent;
    color: var(--cor-texto-principal);
    font: inherit;
    text-align: left;
}

@media (pointer: coarse) {
    .custom-select-trigger { min-height: var(--tap-min); }
}
```

- [ ] **Step 4: DateRangeFilter em sheet**

Em `src/components/DateRangeFilter.jsx`:
1. Importar `useIsMobile` (`'../hooks/useIsMobile'`) e `Sheet` (`'./mobile/Sheet'`); `const isMobile = useIsMobile();`.
2. Extrair o conteúdo do menu para uma constante (mesmo JSX de hoje):

```jsx
  const menuItems = (
    <>
      {DATE_PRESETS.map((p) => (
        <div
          key={p.key}
          className={`drf-item ${preset === p.key ? 'selected' : ''}`}
          onClick={() => selectPreset(p.key)}
        >
          {p.label}
        </div>
      ))}
      {preset === 'custom' && (
        <div className="drf-range">
          <DatePicker size="sm" value={start} onChange={onCustomStart} placeholder="Início" />
          <span className="drf-range-sep">—</span>
          <DatePicker size="sm" value={end} onChange={onCustomEnd} placeholder="Fim" />
        </div>
      )}
    </>
  );
```

3. Trocar o bloco `{open && (<> backdrop + .drf-menu </>)}` por:

```jsx
      {open && !isMobile && (
        <>
          <div className="drf-backdrop" onClick={() => setOpen(false)}></div>
          <div className="drf-menu">{menuItems}</div>
        </>
      )}
      {isMobile && (
        <Sheet open={open} onClose={() => setOpen(false)} title="Período">
          <div className="drf-sheet">{menuItems}</div>
        </Sheet>
      )}
```

Em `src/assets/styles/global.css`, logo após as regras `.drf-*`:

```css
.drf-sheet .drf-item { min-height: 48px; display: flex; align-items: center; }
@media (pointer: coarse) { .drf-trigger { height: var(--tap-min); } }
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/pickers.mobile.spec.mjs e2e/ui-lab.mobile.spec.mjs` → Expected: 11 passed.
Run: `npm run e2e -- --project=desktop` → Expected: 13 passed.
Run: `npm run lint` → Expected: sem novos erros em `Pickers/`, `CustomSelect/` e `DateRangeFilter.jsx`.

- [ ] **Step 6: Commit**

```bash
git add -A bussola_web/src bussola_web/e2e
git commit -m "feat(web): pickers, CustomSelect e filtro de periodo em bottom sheet no mobile"
```

---

### Task 7: Shell mobile (topbar, barra inferior, "Mais") e tablet com sidebar recolhida

**Files:**
- Create: `bussola_web/src/components/Navbar/navItems.js`, `bussola_web/src/components/Navbar/MobileTopbar.jsx`, `bussola_web/src/components/Navbar/BottomNav.jsx`, `bussola_web/src/components/Navbar/MoreSheet.jsx`, `bussola_web/src/components/mobile/MobileChrome.jsx`, `bussola_web/e2e/shell.mobile.spec.mjs`, `bussola_web/e2e/shell.tablet.spec.mjs`
- Modify: `bussola_web/src/components/Navbar/index.jsx`, `bussola_web/src/routes/index.jsx`, `bussola_web/src/assets/styles/layout.css`, `bussola_web/src/assets/styles/global.css`, `bussola_web/src/components/UserDrawer/styles.css`, `bussola_web/src/components/mobile/mobile.css`

**Interfaces:**
- Consumes: `useIsMobile`, `useIsTablet`, `Sheet` (Task 5).
- Produces:
  - `NAV_ITEMS: Array<{ to, icone, rotulo, bottom?: boolean, aiContext?: 'financas'|'roteiro'|'registros'|'ritmo' }>` e `findNavItem(pathname) → item | null`, de `navItems.js`.
  - `MobileChromeProvider`, `useMobileChrome() → { slotEl, setSlotEl }` e `TopbarActions({ children })` (portal no slot à direita do título da topbar mobile), de `src/components/mobile/MobileChrome.jsx`. Os planos de página usam `TopbarActions` para ícones extras (ex.: `fa-calendar-days` no Roteiro).
  - `MobileTopbar({ title, aiContext, user, onOpenAccount, onOpenAi, slotRef })`. O robô só aparece quando `aiContext` existe; a Task 8 liga o `onOpenAi` ao sheet de IA.

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/shell.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test('barra inferior com 5 itens, rótulos e item ativo da rota', async ({ page }) => {
  await gotoApp(page, '/financas');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toBeVisible();
  for (const r of ['Panorama', 'Provisões', 'Roteiro', 'Registros', 'Mais']) await expect(nav.getByText(r, { exact: true })).toBeVisible();
  await expect(nav.locator('.bottom-nav-item.active')).toHaveText(/Provisões/);
  for (const b of await nav.locator('.bottom-nav-item').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('aside.sidebar')).toHaveCount(0);
});

test('topbar mostra o título do módulo e é sticky', async ({ page }) => {
  await gotoApp(page, '/agenda');
  const bar = page.locator('.m-topbar');
  await expect(bar.locator('.m-topbar-title')).toHaveText('Roteiro');
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect(bar).toBeInViewport();
});

test('navegar pela barra inferior', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Registros', { exact: true }).click();
  await expect(page).toHaveURL(/\/registros$/);
  await expect(page.locator('.m-topbar-title')).toHaveText('Registros');
});

test('"Mais" abre o sheet com módulos e conta; Ritmo ativa o "Mais"', async ({ page }) => {
  await gotoApp(page, '/panorama');
  await page.getByRole('button', { name: 'Mais' }).click();
  const sheet = page.locator('.modal-overlay.is-sheet');
  for (const r of ['Ritmo', 'Cofre', 'Início', 'Estudos', 'Minha Conta', 'Sair']) await expect(sheet.getByText(r, { exact: true })).toBeVisible();
  await sheet.getByText('Ritmo', { exact: true }).click();
  await expect(page).toHaveURL(/\/ritmo$/);
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.bottom-nav-item.active')).toHaveText(/Mais/);
});

test('avatar abre Minha Conta em tela cheia', async ({ page }) => {
  await gotoApp(page, '/panorama');
  await page.getByRole('button', { name: 'Minha conta' }).click();
  const drawer = page.locator('.drawer-content.open');
  await expect(drawer).toBeVisible();
  expect(Math.round((await drawer.boundingBox()).width)).toBe(390);
});

test('conteúdo não fica atrás da barra inferior', async ({ page }) => {
  await gotoApp(page, '/cofre');
  const pad = await page.locator('.app-content').evaluate((e) => parseFloat(getComputedStyle(e).paddingBottom));
  expect(pad).toBeGreaterThanOrEqual(64 + 16);
});

test('toasts aparecem acima da barra inferior', async ({ page }) => {
  await gotoApp(page, '/cofre');
  const bottom = await page.locator('.toast-container').evaluate((e) => getComputedStyle(e).bottom);
  expect(parseFloat(bottom)).toBeGreaterThanOrEqual(64);
});

test('rota fora do menu: título padrão, sem robô, nada ativo', async ({ page }) => {
  await gotoApp(page, '/discord/link');
  await expect(page.locator('.m-topbar-title')).toHaveText('Bússola');
  await expect(page.locator('.m-topbar-btn.is-ai')).toHaveCount(0);
  await expect(page.locator('.bottom-nav-item.active')).toHaveCount(0);
});

test('tema claro: barra inferior usa as variáveis do tema', async ({ page }) => {
  await gotoApp(page, '/panorama');
  const dark = await page.locator('.bottom-nav').evaluate((e) => getComputedStyle(e).backgroundColor);
  await page.evaluate(() => document.body.classList.add('light-theme'));
  const light = await page.locator('.bottom-nav').evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(light).not.toBe(dark);
});

test('topbar e barra inferior não estouram a largura', async ({ page }) => {
  await gotoApp(page, '/registros');
  for (const sel of ['.m-topbar', '.bottom-nav']) {
    const b = await page.locator(sel).boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
  }
});
```

Criar `bussola_web/e2e/shell.tablet.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test('tablet: sidebar recolhida (só ícones), sem barra inferior', async ({ page }) => {
  await gotoApp(page, '/financas');
  const side = page.locator('aside.sidebar');
  await expect(side).toHaveClass(/collapsed/);
  expect(Math.round((await side.boundingBox()).width)).toBe(72);
  await expect(page.locator('.bottom-nav')).toHaveCount(0);
  await expect(page.locator('.sidebar-collapse')).toHaveCount(0);
});
```

Run: `npm run e2e -- --project=mobile e2e/shell.mobile.spec.mjs; npm run e2e -- --project=tablet`
Expected: FAIL (nada disso existe).

Antes de continuar, confira na `AuthContext` o rótulo real da opção de logout (`logout`) e na `UserDrawer` que a classe aberta é `drawer-content open` (já confirmado em `UserDrawer/styles.css`).

- [ ] **Step 2: Itens de navegação**

Criar `bussola_web/src/components/Navbar/navItems.js`:

```js
// Fonte única dos módulos da navegação (sidebar, barra inferior, "Mais" e topbar).
// `bottom`: aparece direto na barra inferior do celular; os demais vão no "Mais".
// `aiContext`: contexto do AiAssistant da página (habilita o robô na topbar).
export const NAV_ITEMS = [
    { to: '/home', icone: 'fa-house', rotulo: 'Início' },
    { to: '/panorama', icone: 'fa-chart-pie', rotulo: 'Panorama', bottom: true },
    { to: '/financas', icone: 'fa-wallet', rotulo: 'Provisões', bottom: true, aiContext: 'financas' },
    { to: '/agenda', icone: 'fa-calendar-days', rotulo: 'Roteiro', bottom: true, aiContext: 'roteiro' },
    { to: '/registros', icone: 'fa-book', rotulo: 'Registros', bottom: true, aiContext: 'registros' },
    { to: '/estudos', icone: 'fa-graduation-cap', rotulo: 'Estudos' },
    { to: '/ritmo', icone: 'fa-dumbbell', rotulo: 'Ritmo', aiContext: 'ritmo' },
    { to: '/cofre', icone: 'fa-vault', rotulo: 'Cofre' },
];

export function findNavItem(pathname) {
    if (pathname === '/') return NAV_ITEMS[0];
    return NAV_ITEMS.find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)) ?? null;
}
```

- [ ] **Step 3: Contexto do slot da topbar**

Criar `bussola_web/src/components/mobile/MobileChrome.jsx`:

```jsx
import { createContext, useContext, useState } from 'react';
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

export function useMobileChrome() {
    return useContext(MobileChromeContext);
}

/** Ícones extras da página na topbar mobile (ex.: calendário no Roteiro). */
export function TopbarActions({ children }) {
    const { slotEl } = useMobileChrome();
    return slotEl ? createPortal(children, slotEl) : null;
}
```

Em `src/routes/index.jsx`, importar `import { MobileChromeProvider } from '../components/mobile/MobileChrome';` e trocar o corpo de `PrivateRoute` por:

```jsx
function PrivateRoute({ children }) {
    return (
        <RequireAuth>
            <MobileChromeProvider>
                <div className="app-layout">
                    <Navbar />
                    <div className="app-content">
                        {children}
                    </div>
                </div>
            </MobileChromeProvider>
        </RequireAuth>
    );
}
```

- [ ] **Step 4: Topbar, barra inferior e "Mais"**

Criar `bussola_web/src/components/Navbar/MobileTopbar.jsx`:

```jsx
/** Topbar fina do celular: título do módulo, ações da página, IA e conta. */
export function MobileTopbar({ title, aiContext, user, onOpenAccount, slotRef, onOpenAi }) {
    return (
        <header className="m-topbar">
            <h1 className="m-topbar-title">{title}</h1>
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

Criar `bussola_web/src/components/Navbar/BottomNav.jsx`:

```jsx
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_ITEMS, findNavItem } from './navItems';

/** Barra inferior fixa (estilo clássico: ícone + rótulo, pílula no item ativo). */
export function BottomNav({ onOpenMore, moreOpen }) {
    const { pathname } = useLocation();
    const current = findNavItem(pathname);
    const maisAtivo = moreOpen || Boolean(current && !current.bottom);

    return (
        <nav className="bottom-nav" aria-label="Navegação principal">
            {NAV_ITEMS.filter((i) => i.bottom).map((i) => (
                <NavLink
                    key={i.to}
                    to={i.to}
                    className={({ isActive }) => `bottom-nav-item ${isActive && !moreOpen ? 'active' : ''}`}
                >
                    <span className="bottom-nav-icon"><i className={`fa-solid ${i.icone}`}></i></span>
                    <span className="bottom-nav-label">{i.rotulo}</span>
                </NavLink>
            ))}
            <button
                type="button"
                className={`bottom-nav-item ${maisAtivo ? 'active' : ''}`}
                onClick={onOpenMore}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                aria-label="Mais"
            >
                <span className="bottom-nav-icon"><i className="fa-solid fa-ellipsis"></i></span>
                <span className="bottom-nav-label">Mais</span>
            </button>
        </nav>
    );
}
```

Criar `bussola_web/src/components/Navbar/MoreSheet.jsx`:

```jsx
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../mobile/Sheet';
import { NAV_ITEMS } from './navItems';

/** Sheet "Mais": módulos fora da barra inferior + conta, tema, admin e sair. */
export function MoreSheet({ open, onClose, theme, onToggleTheme, onOpenAccount, showAdmin, onOpenAdmin, onLogout }) {
    const navigate = useNavigate();
    const go = (to) => { onClose(); navigate(to); };

    return (
        <Sheet open={open} onClose={onClose} title="Mais">
            <div className="more-grid">
                {NAV_ITEMS.filter((i) => !i.bottom).map((i) => (
                    <button key={i.to} type="button" className="more-tile" onClick={() => go(i.to)}>
                        <i className={`fa-solid ${i.icone}`}></i>
                        <span>{i.rotulo}</span>
                    </button>
                ))}
            </div>
            <div className="more-list">
                <button type="button" className="more-row" onClick={() => { onClose(); onOpenAccount(); }}>
                    <i className="fa-solid fa-user"></i><span>Minha Conta</span>
                    <i className="fa-solid fa-chevron-right more-row-chevron"></i>
                </button>
                <button type="button" className="more-row" onClick={onToggleTheme}>
                    <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                    <span>{theme === 'light' ? 'Tema escuro' : 'Tema claro'}</span>
                </button>
                {showAdmin && (
                    <button type="button" className="more-row" onClick={() => { onClose(); onOpenAdmin(); }}>
                        <i className="fa-solid fa-user-plus"></i><span>Novo Usuário</span>
                    </button>
                )}
                <button type="button" className="more-row is-danger" onClick={() => { onClose(); onLogout(); }}>
                    <i className="fa-solid fa-arrow-right-from-bracket"></i><span>Sair</span>
                </button>
            </div>
        </Sheet>
    );
}
```

- [ ] **Step 5: Navbar vira o shell**

Em `src/components/Navbar/index.jsx`:
1. Trocar o array local `LINKS` por `import { NAV_ITEMS, findNavItem } from './navItems';` e usar `NAV_ITEMS` no lugar de `LINKS` no `map` da sidebar.
2. Importar `useNavigate` do react-router, `useIsMobile, useIsTablet` de `'../../hooks/useIsMobile'`, `useMobileChrome` de `'../mobile/MobileChrome'`, além de `MobileTopbar`, `BottomNav` e `MoreSheet`.
3. Remover o estado `isMobileMenuOpen`, a função `closeMobileMenu` e **todos** os usos (`onClick={closeMobileMenu}`, `${isMobileMenuOpen ? 'mobile-open' : ''}`), o `<header className="mobile-topbar">…</header>` e o `{isMobileMenuOpen && <div className="mobile-menu-overlay" …/>}`.
4. Adicionar no componente:

```jsx
    const isMobile = useIsMobile();
    const isTablet = useIsTablet();
    const navigate = useNavigate();
    const { setSlotEl } = useMobileChrome();
    const [moreOpen, setMoreOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const current = findNavItem(pathname);
    const sairMobile = () => { logout(); navigate('/login'); };
```

5. O `return` passa a ser:

```jsx
    return (
        <>
            {isMobile ? (
                <>
                    <MobileTopbar
                        title={current?.rotulo ?? 'Bússola'}
                        aiContext={current?.aiContext}
                        user={user}
                        onOpenAccount={() => setIsAccountOpen(true)}
                        onOpenAi={() => setAiOpen(true)}
                        slotRef={setSlotEl}
                    />
                    <BottomNav moreOpen={moreOpen} onOpenMore={() => setMoreOpen(true)} />
                    <MoreSheet
                        open={moreOpen}
                        onClose={() => setMoreOpen(false)}
                        theme={theme}
                        onToggleTheme={toggleTheme}
                        onOpenAccount={() => setIsAccountOpen(true)}
                        showAdmin={Boolean(authenticated && isSelfHosted && user?.is_superuser)}
                        onOpenAdmin={() => setShowAdminModal(true)}
                        onLogout={sairMobile}
                    />
                </>
            ) : (
                <aside className={`sidebar ${recolhida || isTablet ? 'collapsed' : ''}`}>
                    {/* … conteúdo atual da sidebar, sem closeMobileMenu … */}
                    {/* no .sidebar-tools, renderizar o botão .sidebar-collapse só quando !isTablet */}
                </aside>
            )}

            <UserDrawer
                isOpen={isAccountOpen}
                onClose={() => setIsAccountOpen(false)}
                user={user}
                updateUserData={updateUserData}
            />

            <AdminUserModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} />
        </>
    );
```

O estado `aiOpen`/`setAiOpen` é consumido na Task 8. Para o lint não reclamar de variável sem uso, já passe `aiOpen` adiante ou deixe o `useState` e o `onOpenAi` assim. Como `aiOpen` ainda não é lido, nomeie o estado como `const [, setAiOpen] = useState(false);` nesta task; a Task 8 troca para `[aiOpen, setAiOpen]`. Ao trocar de rota, o "Mais" já fecha (o `go()` chama `onClose`).

- [ ] **Step 6: CSS do shell**

Em `src/assets/styles/layout.css`:
1. **Apagar** as regras `.mobile-topbar`, `.btn-hamburger` (todas, incluindo `span` e `.open`), `.mobile-menu-overlay` e, dentro do `@media (max-width: 768px)`, tudo o que trata `.mobile-topbar`, `.btn-hamburger`, `.mobile-menu-overlay`, `.sidebar` (gaveta), `.sidebar.mobile-open`, `.sidebar.collapsed .sidebar-label`, `.sidebar.collapsed .sidebar-link`, `.sidebar.collapsed .btn-nav-account` e `.sidebar-collapse`. A sidebar não renderiza mais no mobile.
2. Esse `@media (max-width: 768px)` passa a conter só:

```css
@media (max-width: 768px) {
    .app-content,
    .app-layout:has(.sidebar.collapsed) .app-content {
        margin-left: 0;
        padding-bottom: calc(var(--bottom-nav-h) + var(--safe-bottom) + var(--sp-4));
    }

    .container {
        padding-left: var(--sp-4);
        padding-right: var(--sp-4);
    }
}
```

Em `src/assets/styles/global.css`:
1. Dentro do `@media (max-width: 768px)` existente da "RESPONSIVIDADE MOBILE GLOBAL", trocar a regra `.toast-container` por:

```css
    .toast-container {
        top: auto;
        bottom: calc(var(--bottom-nav-h) + var(--safe-bottom) + var(--sp-2));
        right: var(--sp-3);
        left: var(--sp-3);
        align-items: stretch;
        z-index: var(--z-toast);
    }
```

E, nesse mesmo bloco, trocar `padding-left: 12px; padding-right: 12px;` de `main.container` por `var(--sp-4)`.
2. Após as regras `.page-header*`, adicionar:

```css
@media (max-width: 768px) {
    /* O título vai para a topbar mobile; o header fica só com os KPIs. */
    .page-header-main h1 { display: none; }
    .page-header {
        max-width: 100%;
        margin-bottom: var(--sp-4);
        padding: 0 0 var(--sp-3);
    }
    .page-header:not(:has(.page-header-kpis)) { display: none; }

    /* Confirmação ancorada no rodapé, alcançável com o polegar */
    .confirm-overlay { align-items: flex-end; z-index: var(--z-toast); }
    .confirm-modal {
        width: 100%;
        max-width: none;
        border-radius: 20px 20px 0 0;
        padding-bottom: calc(1.5rem + var(--safe-bottom));
    }
    .confirm-footer button { min-height: 48px; flex: 1; }
}
```

Em `src/components/UserDrawer/styles.css`, trocar `@media (max-width: 480px)` (bloco "Responsividade Mobile") por `@media (max-width: 768px)` e, dentro dele, na regra `.drawer-content`, adicionar `height: 100dvh;` e `z-index: var(--z-drawer);`. Na regra `.drawer-footer` desse bloco, adicionar `padding-bottom: calc(1.25rem + var(--safe-bottom));`. Ainda nesse bloco, adicionar `.drawer-overlay { z-index: var(--z-drawer); }`. Na grade de cores do drawer (a regra com `grid-template-columns: repeat(6, 1fr);`, ~linha 303), adicionar dentro desse mesmo `@media` um override com o mesmo seletor e `grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));`.

Ao final de `src/components/mobile/mobile.css`:

```css
/* ===== Topbar mobile ===== */
.m-topbar {
    position: sticky;
    top: 0;
    z-index: var(--z-nav);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    min-height: var(--topbar-h);
    padding: calc(var(--safe-top) + var(--sp-2)) var(--sp-4) var(--sp-2);
    background: var(--cor-fundo);
    border-bottom: 1px solid var(--cor-borda);
}

.m-topbar-title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.m-topbar-actions,
.m-topbar-slot {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-shrink: 0;
}

.m-topbar-slot:empty { display: none; }

.m-topbar-btn,
.m-topbar-avatar,
.m-topbar-slot > button {
    width: var(--tap-min);
    height: var(--tap-min);
    border: none;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: var(--cor-card-principal);
    color: var(--cor-texto-principal);
    font-size: 1rem;
    cursor: pointer;
}

.m-topbar-btn.is-ai {
    background: linear-gradient(135deg, var(--cor-azul-primario), var(--cor-acento));
    color: #fff;
}

.m-topbar-avatar {
    border-radius: 50%;
    overflow: hidden;
    background: var(--cor-card-secundario);
}

.m-topbar-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* ===== Barra inferior ===== */
.bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-nav);
    display: flex;
    justify-content: space-around;
    align-items: stretch;
    height: calc(var(--bottom-nav-h) + var(--safe-bottom));
    padding: 0 var(--sp-1) var(--safe-bottom);
    background: var(--cor-card-principal);
    border-top: 1px solid var(--cor-borda);
}

.bottom-nav-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: none;
    background: transparent;
    color: var(--cor-texto-secundario);
    font: inherit;
    font-size: 0.68rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
}

.bottom-nav-icon {
    width: 56px;
    height: 30px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    font-size: 1.05rem;
    transition: background-color 0.2s ease;
}

.bottom-nav-label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bottom-nav-item.active {
    color: var(--cor-texto-principal);
    font-weight: 600;
}

.bottom-nav-item.active .bottom-nav-icon {
    background: rgba(var(--cor-tema-rgb), 0.2);
    color: var(--cor-azul-primario);
}

/* ===== Sheet "Mais" ===== */
.more-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr); /* Início, Estudos, Ritmo, Cofre */
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
}

.more-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-4) var(--sp-2);
    border: 1px solid var(--cor-borda);
    border-radius: 16px;
    background: var(--cor-card-secundario);
    color: var(--cor-texto-principal);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
}

.more-tile i {
    font-size: 1.35rem;
    color: var(--cor-azul-primario);
}

.more-list {
    display: flex;
    flex-direction: column;
}

.more-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 52px;
    border: none;
    border-top: 1px solid var(--cor-borda);
    background: transparent;
    color: var(--cor-texto-principal);
    font: inherit;
    font-size: 0.95rem;
    text-align: left;
    cursor: pointer;
}

.more-row > i:first-child {
    width: 24px;
    text-align: center;
    color: var(--cor-texto-secundario);
}

.more-row-chevron {
    margin-left: auto;
    color: var(--cor-texto-secundario);
    font-size: 0.8rem;
}

.more-row.is-danger,
.more-row.is-danger > i:first-child {
    color: var(--cor-vermelho-delete);
}
```

- [ ] **Step 7: Rodar os testes**

Run: `npm run e2e -- --project=mobile` → Expected: todos passam (shell + foundation + ui-lab + pickers).
Run: `npm run e2e -- --project=tablet` → Expected: 1 passed.
Run: `npm run e2e -- --project=desktop` → Expected: 13 passed (no desktop a sidebar é a mesma).
Tire screenshots manuais do shell (`npx playwright test --project=mobile e2e/shell.mobile.spec.mjs --headed` ou um script) em `/financas` e no "Mais" aberto, e confira o espaçamento contra os mockups aprovados (tela 1 do companion): barra clássica, pílula no ativo, topbar com título grande.

- [ ] **Step 8: Commit**

```bash
git add -A bussola_web/src bussola_web/e2e
git commit -m "feat(web): shell mobile com topbar, barra inferior e sheet Mais; tablet com sidebar recolhida"
```

---

### Task 8: Assistente de IA na topbar (sheet) e fora do canto da tela no mobile

**Files:**
- Create: `bussola_web/src/components/AiAssistant/useAiInsight.js`, `bussola_web/src/components/AiAssistant/AiInsightPanel.jsx`, `bussola_web/e2e/ai.mobile.spec.mjs`
- Modify: `bussola_web/src/components/AiAssistant/index.jsx`, `bussola_web/src/components/AiAssistant/styles.css`, `bussola_web/src/components/Navbar/index.jsx`

**Interfaces:**
- Consumes: `Sheet` (Task 5), `MobileTopbar.onOpenAi` e o estado `aiOpen` do Navbar (Task 7).
- Produces:
  - `useAiInsight(context) → { insight, loading, timeLeft, lastUpdateDisplay, hasSuggestions, fetchInsight(force?: boolean) }`.
  - `AiInsightPanel({ ai })`: renderiza o `.ai-glass-card` (cabeçalho + corpo) a partir do objeto do hook.
  - `AiMobilePanel({ context })`: hook + painel, para o sheet.

- [ ] **Step 1: Teste que falha**

Criar `bussola_web/e2e/ai.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test('no celular o robô flutuante some e vira botão da topbar', async ({ page }) => {
  await gotoApp(page, '/financas');
  await expect(page.locator('.ai-floating-container')).toHaveCount(0);
  await page.getByRole('button', { name: 'Assistente de IA' }).click();
  const sheet = page.locator('.modal-overlay.is-sheet-full');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.ai-glass-card')).toBeVisible();
  await sheet.getByRole('button', { name: 'Fechar' }).click();
  await expect(sheet).toHaveCount(0);
});

test('Panorama e Cofre não têm robô', async ({ page }) => {
  await gotoApp(page, '/panorama');
  await expect(page.getByRole('button', { name: 'Assistente de IA' })).toHaveCount(0);
});
```

Run: `npm run e2e -- --project=mobile e2e/ai.mobile.spec.mjs`
Expected: o primeiro FAIL (o flutuante ainda existe, e o botão não abre nada).

- [ ] **Step 2: Hook `useAiInsight`**

Criar `bussola_web/src/components/AiAssistant/useAiInsight.js` com a lógica de estado/fetch movida de `index.jsx`. O estado inicial vem do localStorage via inicialização preguiçosa, no lugar do `useEffect` de hoje (evita `set-state-in-effect`):

```js
import { useState, useEffect, useCallback } from 'react';
import { aiService } from '../../services/api';
import { logger } from '../../utils/logger';

const COOLDOWN_MS = 3 * 60 * 60 * 1000;
// Em produção, isso deve ser false para evitar spam na API LLM
export const DISABLE_COOLDOWN = true;

const formatTimestamp = (ts) => {
    if (!ts) return null;
    const d = new Date(parseInt(ts, 10));
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function lerCache(context) {
    try {
        const raw = localStorage.getItem(`ai_insight_${context}`);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        logger.error('Erro ao ler cache local da IA', { error: String(e) });
        return null;
    }
}

function restanteCooldown(context) {
    if (DISABLE_COOLDOWN) return 0;
    const last = localStorage.getItem(`ai_last_update_${context}`);
    if (!last) return 0;
    return Math.max(0, COOLDOWN_MS - (Date.now() - parseInt(last, 10)));
}

/** Estado do insight de IA de um contexto (financas, roteiro, registros, ritmo). */
export function useAiInsight(context) {
    const [insight, setInsight] = useState(() => lerCache(context));
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(() => restanteCooldown(context));
    const [lastUpdateDisplay, setLastUpdateDisplay] = useState(
        () => formatTimestamp(localStorage.getItem(`ai_last_update_${context}`)),
    );

    useEffect(() => {
        if (timeLeft <= 0) return undefined;
        const timer = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1000)), 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const fetchInsight = useCallback(async (force = false) => {
        if (!force && timeLeft > 0 && insight && !DISABLE_COOLDOWN) return;
        setLoading(true);
        try {
            const data = await aiService.getInsight(context);
            setInsight(data);
            const now = Date.now();
            localStorage.setItem(`ai_insight_${context}`, JSON.stringify(data));
            localStorage.setItem(`ai_last_update_${context}`, now.toString());
            setLastUpdateDisplay(formatTimestamp(now));
            setTimeLeft(DISABLE_COOLDOWN ? 0 : COOLDOWN_MS);
        } catch (error) {
            logger.error('Erro inesperado', { error: String(error) });
        } finally {
            setLoading(false);
        }
    }, [context, insight, timeLeft]);

    const hasSuggestions = Boolean(insight?.suggestions?.length);
    return { insight, loading, timeLeft, lastUpdateDisplay, hasSuggestions, fetchInsight };
}
```

- [ ] **Step 3: Painel reutilizável**

Criar `bussola_web/src/components/AiAssistant/AiInsightPanel.jsx`. Mova de `index.jsx`, **sem alterar o JSX**:
- as funções `getDomainIcon`, `getDomainLabel`, `getTypeIcon`, `getAgentLabel`, `renderFormattedText` e `formatTime`, como funções de módulo;
- todo o bloco `<div className="ai-glass-card"> … </div>`, cabeçalho e corpo inteiros.

O resultado tem esta forma:

```jsx
import { DISABLE_COOLDOWN, useAiInsight } from './useAiInsight';

// (funções getDomainIcon, getDomainLabel, getTypeIcon, getAgentLabel,
//  renderFormattedText e formatTime movidas de index.jsx, inalteradas)

/** Card de insights de IA (usado no balão do desktop e no sheet do celular). */
export function AiInsightPanel({ ai }) {
    const { insight, loading, timeLeft, lastUpdateDisplay, hasSuggestions, fetchInsight } = ai;
    return (
        <div className="ai-glass-card">
            {/* JSX atual do .ai-glass-header e .ai-glass-body, inalterado */}
        </div>
    );
}

/** Versão autocontida para o sheet da topbar mobile. */
export function AiMobilePanel({ context }) {
    const ai = useAiInsight(context);
    return <AiInsightPanel ai={ai} />;
}
```

- [ ] **Step 4: AiAssistant usa hook + painel e não renderiza no mobile**

Em `src/components/AiAssistant/index.jsx`:
- remover os estados `insight`, `loading`, `timeLeft` e `lastUpdateDisplay`, o `useEffect` de leitura do cache (mantendo só a chamada `updateSmartPosition(position.x, position.y)` num `useEffect` com deps `[]`), o `useEffect` do timer e `fetchInsight`;
- remover as funções movidas para o painel;
- adicionar:

```jsx
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAiInsight } from './useAiInsight';
import { AiInsightPanel } from './AiInsightPanel';
// no componente, logo no início:
  const isMobile = useIsMobile();
  const ai = useAiInsight(context);
  const { hasSuggestions } = ai;
```

- no JSX, trocar o bloco `<div className="ai-glass-card">…</div>` por `<AiInsightPanel ai={ai} />`;
- imediatamente antes do `return (` final (depois de **todos** os hooks), adicionar:

```jsx
  // No celular o assistente abre pelo botão da topbar (sheet de tela cheia).
  if (isMobile) return null;
```

Ao final de `src/components/AiAssistant/styles.css`:

```css
/* ===== Painel dentro do sheet mobile ===== */
.ai-sheet .ai-glass-card {
    width: auto;
    max-width: none;
    max-height: none;
    border: none;
    box-shadow: none;
    background: transparent;
}
```

- [ ] **Step 5: Ligar o sheet de IA ao Navbar**

Em `src/components/Navbar/index.jsx`:
- trocar `const [, setAiOpen] = useState(false);` por `const [aiOpen, setAiOpen] = useState(false);`;
- importar `import { Sheet } from '../mobile/Sheet';` e `import { AiMobilePanel } from '../AiAssistant/AiInsightPanel';`;
- dentro do ramo `isMobile`, depois do `<MoreSheet … />`, adicionar:

```jsx
                    {current?.aiContext && (
                        <Sheet open={aiOpen} onClose={() => setAiOpen(false)} full title="Assistente" className="ai-sheet">
                            <AiMobilePanel key={current.aiContext} context={current.aiContext} />
                        </Sheet>
                    )}
```

- ao trocar de rota, fechar o sheet: no `go()` do MoreSheet já fecha; para a barra inferior, adicionar no Navbar, **logo depois** das declarações de `moreOpen` e `aiOpen`, um ajuste durante a renderização (padrão "prev key" do projeto, sem `useEffect`):

```jsx
    const [prevPath, setPrevPath] = useState(pathname);
    if (prevPath !== pathname) {
        setPrevPath(pathname);
        setAiOpen(false);
        setMoreOpen(false);
    }
```

- [ ] **Step 6: Rodar os testes**

Run: `npm run e2e -- --project=mobile` → Expected: todos passam.
Run: `npm run e2e -- --project=desktop` → Expected: 13 passed. O robô flutuante do desktop continua igual nos screenshots de Financas, Agenda, Registros e Ritmo.
Run: `npm run lint` → Expected: sem novos erros em `AiAssistant/` e `Navbar/`.

- [ ] **Step 7: Commit**

```bash
git add -A bussola_web/src bussola_web/e2e
git commit -m "feat(web): assistente de IA no botao da topbar mobile (sheet) via hook/painel compartilhados"
```

---

### Task 9: Verificação final do plano 01

**Files:**
- Create: `bussola_web/e2e/README.md`

- [ ] **Step 1: Documentar como rodar os testes**

Criar `bussola_web/e2e/README.md`:

```markdown
# E2E (Playwright)

Requer o venv do `bussola_api` (sobe a API com um banco demo descartável em `bussola_api/data/e2e_demo.db`, sem segredos reais).

    $env:BUSSOLA_PY = 'C:\...\bussola_api\venvbussola\Scripts\python.exe'   # se o venv não estiver em ../bussola_api/venvbussola
    npm run e2e                       # todos os projetos (desktop, mobile, tablet)
    npm run e2e -- --project=mobile   # só mobile
    npm run e2e:update -- --project=desktop   # regenerar a base visual (somente quando a mudança no desktop for intencional)

- `*.desktop.spec.mjs` = 1280×900 · `*.mobile.spec.mjs` = 390×844 (touch) · `*.tablet.spec.mjs` = 900×1200 (touch)
- Relógio fixo em 2026-10-02 12:00 (helpers.mjs) para as datas ficarem estáveis.
- Para recriar os dados demo: pare a API e apague `bussola_api/data/e2e_demo.db` (e regenere a base visual).
- `/__ui` é uma bancada DEV-only dos primitivos mobile (não vai para o build de produção).
```

- [ ] **Step 2: Suíte completa + build + lint**

Run: `npm run e2e` → Expected: tudo passa (desktop 13, mobile ≥ 25, tablet 1).
Run: `npm run build` → Expected: OK.
Run: `npm run lint 2>&1 | Select-String " error " | Measure-Object` → Expected: contagem ≤ à do início do plano (registre os dois números no commit).

- [ ] **Step 3: Conferência visual do shell**

Em 360, 390 e 430px, abra `/panorama`, `/financas` e `/ritmo` e o "Mais", e confira contra os mockups aprovados (`.superpowers/brainstorm/*/content/01-shell.html`):
- a barra clássica com pílula no ativo;
- a topbar com título grande, robô (só onde há IA) e avatar;
- 12px entre os itens do "Mais" e 16px de gutter.

As páginas em si ainda estão com o layout antigo; isso é esperado e é o escopo dos planos 02+.

- [ ] **Step 4: Commit**

```bash
git add bussola_web/e2e/README.md
git commit -m "docs(e2e): como rodar a suite mobile/desktop"
```

---

## Próximos planos (escritos após este estar concluído)

`mobile-02-provisoes` (inclui Metas, Categorias, Caixa), `mobile-03-registros`, `mobile-04-roteiro`, `mobile-05-panorama`, `mobile-06-ritmo`, `mobile-07-cofre`, `mobile-08-estudos`, `mobile-09-auth-inicio-pwa`. Cada um segue a seção 5 da spec e acrescenta, para as suas rotas, o teste `overflowOffenders(page)` vazio em 360/390/430/768 mais as asserções de layout da página.

Ficam para os planos de página, de propósito:
- os vazamentos restantes de CSS do Agenda (`.main-container` com `padding !important` e `.btn-action-icon` com `!important`), que mexem no layout de várias páginas e entram no `mobile-04-roteiro` com regressão visual;
- a remoção dos `overflow: visible !important` dos modais com escopo de página (Financas, Registros), que entra no plano de cada página;
- a migração completa de z-index do desktop. A spec pedia tokens em tudo; este plano aplica os tokens no mobile e nos componentes novos e mantém os valores atuais no desktop, para não arriscar regressões.
