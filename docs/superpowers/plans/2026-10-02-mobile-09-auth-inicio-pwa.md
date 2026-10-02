# Mobile 09: Login, Registro, Auth, Início, PWA e Voltar do Android, plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o redesign mobile: Login/Registro com o formulário primeiro e sem ilustração no celular; telas de Auth (Esqueci, Nova senha, Verificação, Cadastro enviado, Discord, Autorizar conexão) com cards de largura total; CSS de Auth escopado sem mudar o desktop; Início empilhado com h1 fluido; `AdminUserModal` como sheet de verdade (sem fundo duplo); PWA básico (manifest + ícones gerados do `bussola.svg`, sem service worker); e o **Voltar do Android fechando o sheet de cima** sem brigar com o react-router. Desktop (≥1025) idêntico.

**Architecture:**
- **Ambiente de teste do Login:** o `Login` chama `useGoogleLogin` sempre; quando o script do Google (GSI) carrega e `VITE_GOOGLE_CLIENT_ID` está vazio, o `initTokenClient` lança dentro de um efeito e o `ErrorBoundary` troca a tela por "Algo deu errado.". O teste ganha um client id falso pelo `webServer.env` do Playwright e as specs de Auth bloqueiam `accounts.google.com`. Além disso (decisão D1), o botão do Google vira um componente próprio, montado só com SaaS **e** client id — o app deixa de cair sem a variável.
- **CSS de Auth:** `Auth/styles.css` é carregado no boot (via `ForgotPassword`) e vazava `.form-group`, `.form-input`, `.btn-primary` etc. para o app inteiro. As regras genéricas saem; as **poucas que realmente tinham efeito** fora do Auth (medidas na cascata: `label { margin-left: 2px }`, borda vermelha de input inválido preenchido, `filter`/`translateY(-1px)` no hover do `.btn-primary`, `:active`, `.btn-primary.full-width`) vão explícitas para `components.css` com o mesmo efeito. As telas de status trocam os `style={{…}}` do wrapper/card (com variáveis inexistentes) por classes `.auth-status-page` / `.auth-status-card`.
- **Login, Registro e Início:** só CSS (blocos `@media (max-width: 768px)` e gate de hover), mais o botão do Google isolado.
- **`AdminUserModal`:** no celular renderiza um `<Sheet>` (formulário com `id`, botões no rodapé com `form=`); o desktop continua com o wrapper `.admin-modal-*`.
- **PWA:** `public/manifest.webmanifest`, ícones em `public/icons/` gerados por `scripts/gerar-icones-pwa.mjs` (Chromium do `@playwright/test`), `<link>`/`<meta>` no `index.html`. Sem service worker.
- **Voltar do Android:** `src/utils/sheetHistory.js` + `src/hooks/useSheetHistory.js`, ligados no `BaseModal` (todo modal/sheet passa por ele) só no celular. Cada sheet aberto empilha uma entrada de histórico **na mesma URL** com uma marca em `history.state`; o Voltar fecha o sheet de cima; fechar pelo app remove a entrada com `history.back()` **só se ela ainda estiver no topo um tick depois**; entradas "órfãs" (o app navegou no mesmo tick) são puladas; e `navegarFechandoSheet(navigate, to)` faz a nova rota **substituir** a entrada do sheet (usado no "Mais" e no Sair). Desenho completo e corridas tratadas na Task 6.

**Tech Stack:** React 19, react-router-dom 7 (`BrowserRouter`, sem data router → sem `useBlocker`), Vite 7, CSS puro, `@react-oauth/google` 0.13, `@playwright/test` 1.63 (também para rasterizar os ícones).

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-responsivo-design.md` (§2, §4.3 higiene, §4.6 PWA, §5.7 Login/Registro/Auth/Início, §6, §8). Este plano é a etapa 10 da §7, mais o Voltar do Android (pedido do controlador).
**Planos anteriores:** `mobile-01` (implementado), `mobile-02` (cria `authHeaders`, `apiJson`, `smallTargets` em `e2e/helpers.mjs` — **reusar**), `mobile-07` (Cofre: lista com "⋯" e `SegredoModal` em sheet; usados num teste da Task 6) e `mobile-08` (Estudos: `TopbarTitle`; o `Navbar` já tem `topbar`/`voltarTopbar`). Rodam antes deste.

## Global Constraints

- **Branch:** `feat/mobile-responsivo` (worktree `.claude/worktrees/mobile-responsivo`). Um commit por task. **Nunca** fazer push nem merge em `main`. Nunca usar `git stash`.
- **Commits** terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use um segundo `-m`).
- **Coolify:** nada aqui muda compose, Dockerfile, healthcheck, rede, service name ou domínio (o PWA são arquivos estáticos servidos pelo nginx com `try_files`). O checklist `~/.claude/COOLIFY-DEPLOY-CHECKLIST.md` não se aplica.
- **Não redesenhar cards existentes:** card do Login/Registro (`.auth-card`: logo, título, gradiente do botão), `.auth-simple-card`, cards de status, widgets do Início (relógio, clima, feature rows, card de notícia). Só espaçamento, ordem, largura, quebra, alvo de toque e ações visíveis.
- **Ícones:** só classes Font Awesome que já existem no código. Usadas neste plano: `fa-brands fa-google`, `fa-arrow-left` (`fas`, Voltar para Login), `fa-paper-plane`, `fa-info-circle`, `fa-check-circle`, `fa-times-circle`, `fa-circle-notch`, `fa-lock`, `fa-arrow-right-long`, `fa-arrow-left-long`, `fa-user-plus`, `fa-xmark` (fechar do `Sheet`).
- **Espaçamento (tokens `--sp-1..6` = 4/8/12/16/24/32):** 8 dentro de um card, 12 entre cards, 16 de gutter e entre blocos, 24 entre seções. Nenhum valor solto fora da escala no CSS novo, exceto tamanhos de controle (36/44/48/52/56px) e raios. (Os `style={{…}}` internos das telas de status, pré-existentes, ficam como estão.)
- **Toque:** alvo ≥ 44×44 em tudo que é interativo; inputs com 16px (`tokens.css`); hover (lift, translate, `letter-spacing`, `scale`) só em `@media (hover: hover) and (pointer: fine)`.
- **Tipografia mobile:** conteúdo principal ≥ 14px, secundário ≥ 12px, 11px só em rótulos em caixa alta.
- **Desktop (≥1025):** visualmente idêntico. Os 13 PNGs de `e2e/desktop-visual.desktop.spec.mjs-snapshots/` e os novos de `auth.desktop.spec.mjs-snapshots/` (Task 1: `login`, `register`, `forgot-password`, `admin-modal`) passam em toda task. Exceção intencional (correção de bug): as telas de status (`/verify-email`, `/register-success`, `/discord/link`) passam a ter o fundo de card que as variáveis inexistentes apagavam; ganham base **depois** da correção (Task 2).
- **Sem mudança de API/backend.**
- **Dados de teste:** nenhum dado criado no banco (o `AdminUserModal` não é submetido; a configuração de cadastro aberto é interceptada com `page.route`). Os testes de login real usam o usuário demo.
- **Lint:** `npx eslint <arquivos tocados>` sem **novos** erros. Linha de base medida: `Login/index.jsx` 1 erro (`no-unused-vars`, `catch (error)` linha 80 — este plano zera), `Auth/DiscordLink.jsx` 1 e `Auth/VerifyEmail.jsx` 1 (`set-state-in-effect`, pré-existentes, não mexidos), `Home/index.jsx` 1 erro + 3 warnings (pré-existentes, não mexidos), `Navbar/index.jsx` 1 erro (`:62`, pré-existente), `BaseModal.jsx`/`AdminUserModal.jsx`/`MoreSheet.jsx` 0.
- **Build:** `npm run build` passa.

## API real dos primitivos (lida do código, use exatamente isto)

- `useIsMobile()` / `useMediaQuery()` de `src/hooks/useIsMobile.js`.
- `BaseModal({ children, onClose, className, sheet = 'auto' })` (`src/components/BaseModal.jsx`): **não é portal**; no mobile põe `is-sheet`; ESC e clique no overlay chamam `onClose`; `lockScroll()` no mount / `unlockScroll()` no unmount (contador; o `unlock` final faz `scrollTo(0, savedY)`). **Todo** modal e sheet do app passa por ele (o `Sheet` o usa por dentro). O `ConfirmDialog` e o `UserDrawer` **não** usam `BaseModal`.
- `Sheet({ open, onClose, title, ariaLabel, children, footer, full, className })`: portal no `body`, `null` se `!open`, cabeçalho com `button.app-sheet-close[aria-label="Fechar"]` se houver `title`, rodapé `.modal-footer.app-sheet-footer` (filhos `flex:1; min-height:48px`).
- `MoreSheet({ open, onClose, theme, onToggleTheme, onOpenAccount, showAdmin, onOpenAdmin, onLogout })`: tiles chamam `go(to)` = `onClose(); navigate(to);`; "Novo Usuário" = `onClose(); onOpenAdmin();`; "Sair" = `onClose(); onLogout();`. O `Navbar` passa `onLogout={sairMobile}` com `const sairMobile = () => { logout(); navigate('/login'); };` e fecha o "Mais"/IA quando o `pathname` muda (ajuste no render).
- `react-router-dom` 7 `BrowserRouter` (`createBrowserHistory` interno): `history.state = { usr, key, idx }`; no `popstate` ele relê `history.state.idx` e re-renderiza com `history.location` (lido de `window.location` + `state`). `push` usa `getIndex() + 1` do **state atual**. `pushState` feito por fora não avisa o router (é o que queremos: mesma URL).
- `main.jsx`: `<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>` envolve o app; o provider injeta `https://accounts.google.com/gsi/client`. `useGoogleLogin` chama `window.google.accounts.oauth2.initTokenClient({ client_id, … })` num efeito quando o script carrega.
- `SystemContext`: `GET /api/v1/system/config` → `{ deployment_mode, public_registration, … }`; `canRegister = public_registration`. O backend E2E sobe com `DEPLOYMENT_MODE=SELF_HOSTED` e `ENABLE_PUBLIC_REGISTRATION=False` → `/register` redireciona para `/login` (os testes interceptam a config para abrir o cadastro). O usuário demo é superusuário (o "Novo Usuário" aparece).
- **Ordem do CSS** (`main.jsx`): `tokens.css` → CSS das páginas, na ordem de import das rotas (`Login/styles.css` antes de `Auth/styles.css`) → `mobile.css` → `components.css` → `global.css`.
- `e2e/helpers.mjs`: `gotoApp`, `FIXED_NOW`, `overflowOffenders`, e do plano 02 `apiJson`, `smallTargets`. Projetos: `*.mobile` 390×844 touch, `*.tablet` 900×1200 touch, `*.desktop` 1280×900 mouse. `playwright.config.mjs` sobe o Vite com `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` e `reuseExistingServer: true`.

## Review Focus

1. **Voltar do Android leva para a página errada, exige dois toques ou deixa sheet aberto** (corrida entre `history.back()` e `navigate()` no mesmo handler; StrictMode montando duas vezes; rolagem pulando para o topo). Teste na Task 6 › "tile do Mais navega para a rota certa, sem entrada órfã", "sheets aninhados: um Voltar fecha só o de cima", "ação do ActionSheet que abre outro sheet…", "Voltar fecha o sheet e mantém a rolagem".
2. **Login cai ("Algo deu errado.") ou o formulário fica atrás do teclado / depois da ilustração.** Teste na Task 1 › "Login com o script do Google liberado não cai" e Task 3 › "Login: card primeiro…", "viewport baixa: a página rola até o Entrar".
3. **Escopar o `Auth/styles.css` muda o desktop do app inteiro** (margem dos labels, borda de input inválido, hover dos botões primários). Teste na Task 2 › `auth.desktop.spec.mjs` "efeitos globais preservados" + todas as bases do desktop.
4. **`AdminUserModal` com fundo duplo ou "Criar Usuário" inalcançável.** Teste na Task 4 › "Novo Usuário pelo Mais abre um sheet só" e "teclado virtual: Criar Usuário acima do teclado".
5. **PWA não instala** (manifest com campo errado, ícone com tamanho errado, arquivo fora do build). Teste na Task 5 › `pwa.desktop.spec.mjs` + `dist/` conferido no Step de build.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `bussola_web/playwright.config.mjs` | modificar | `VITE_GOOGLE_CLIENT_ID` falso no `webServer` do Vite |
| `bussola_web/e2e/README.md` | modificar | documenta o client id falso e o bloqueio do GSI |
| `bussola_web/e2e/fixtures/auth.mjs` | criar | `semGoogle(page)`, `cadastroAberto(page)`, `DESLOGADO` |
| `bussola_web/e2e/auth.desktop.spec.mjs` | criar | bases de Login/Registro/Esqueci/Admin, status pós-correção, efeitos globais |
| `bussola_web/e2e/auth.mobile.spec.mjs` | criar | Login/Registro/Auth no celular |
| `bussola_web/e2e/home.mobile.spec.mjs` | criar | Início no celular |
| `bussola_web/e2e/admin.mobile.spec.mjs` | criar | `AdminUserModal` em sheet |
| `bussola_web/e2e/pwa.desktop.spec.mjs` | criar | manifest, ícones, links, sem service worker |
| `bussola_web/e2e/voltar.mobile.spec.mjs` | criar | Voltar do Android |
| `bussola_web/e2e/voltar.desktop.spec.mjs` | criar | desktop sem entradas de sheet |
| `bussola_web/src/pages/Login/index.jsx` | modificar | botão do Google isolado (`GoogleLoginButton`); `catch {` |
| `bussola_web/src/pages/Login/styles.css` | modificar | celular: card primeiro, sem ilustração/parágrafo, 16px |
| `bussola_web/src/pages/Auth/styles.css` | modificar | tudo escopado; `.auth-status-*`; celular |
| `bussola_web/src/pages/Auth/AutorizarConexao.css` | modificar | celular |
| `bussola_web/src/pages/Auth/RegisterSuccess.jsx` | modificar | classes no lugar dos inline com variáveis inexistentes |
| `bussola_web/src/pages/Auth/VerifyEmail.jsx` | modificar | idem |
| `bussola_web/src/pages/Auth/DiscordLink.jsx` | modificar | idem |
| `bussola_web/src/pages/Auth/ResetPassword.jsx` | modificar | importa o próprio `styles.css` |
| `bussola_web/src/assets/styles/components.css` | modificar | efeitos globais que vinham do vazamento do Auth |
| `bussola_web/src/pages/Home/styles.css` | modificar | gate de hover; celular |
| `bussola_web/src/components/AdminUserModal.jsx` | modificar | `<Sheet>` no celular |
| `bussola_web/src/components/AdminUserModal.css` | modificar | form do sheet |
| `bussola_web/scripts/gerar-icones-pwa.mjs` | criar | rasteriza os ícones |
| `bussola_web/public/icons/*.png` | criar | 192, 512, maskable 512, apple-touch 180 |
| `bussola_web/public/manifest.webmanifest` | criar | manifest |
| `bussola_web/index.html` | modificar | manifest, theme-color, apple-touch-icon, capable |
| `bussola_web/src/utils/sheetHistory.js` | criar | pilha de entradas de sheet no histórico |
| `bussola_web/src/hooks/useSheetHistory.js` | criar | hook ligado ao `BaseModal` |
| `bussola_web/src/components/BaseModal.jsx` | modificar | `useSheetHistory(isMobile, onClose)` |
| `bussola_web/src/components/Navbar/MoreSheet.jsx` | modificar | tiles com `navegarFechandoSheet` |
| `bussola_web/src/components/Navbar/index.jsx` | modificar | Sair com `navegarFechandoSheet` |

---

### Task 1: Ambiente de teste do Login (client id falso, GSI bloqueado), bases do desktop e botão do Google isolado

**Files:**
- Create: `bussola_web/e2e/fixtures/auth.mjs`, `bussola_web/e2e/auth.desktop.spec.mjs`
- Modify: `bussola_web/playwright.config.mjs`, `bussola_web/e2e/README.md`, `bussola_web/src/pages/Login/index.jsx`

**Interfaces:**
- Produces:
  - `DESLOGADO = { cookies: [], origins: [] }` (para `test.use({ storageState: DESLOGADO })`).
  - `semGoogle(page)`: aborta `accounts.google.com` (sem rede externa e sem o GSI nos testes).
  - `cadastroAberto(page)`: intercepta `GET /system/config` → `SELF_HOSTED` com `public_registration: true`.
  - `GoogleLoginButton({ disabled, onToken(accessToken), onCancelado })` (interno ao `Login`), montado só com `isSaaS && VITE_GOOGLE_CLIENT_ID`.

- [ ] **Step 1: Diagnóstico (antes de mudar qualquer coisa)**

Criar `bussola_web/e2e/fixtures/auth.mjs`:

```js
// Utilidades das specs de Login/Registro/Auth.
export const DESLOGADO = { cookies: [], origins: [] };

// O script do Google (GSI) vem da rede. Nos testes ele fica bloqueado: sem dependência externa
// e sem o initTokenClient (que, sem client id, derruba o Login).
export async function semGoogle(page) {
  await page.route(/^https:\/\/accounts\.google\.com\//, (r) => r.abort());
}

// O backend E2E sobe com cadastro fechado; para ver /register a config é interceptada.
export async function cadastroAberto(page) {
  await page.route(/\/api\/v1\/system\/config$/, (r) => r.fulfill({
    json: { deployment_mode: 'SELF_HOSTED', public_registration: true, google_login_enabled: false, stripe_enabled: false },
  }));
}
```

Criar `bussola_web/e2e/auth.desktop.spec.mjs` só com o diagnóstico:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { DESLOGADO, semGoogle, cadastroAberto } from './fixtures/auth.mjs';

test.describe('deslogado', () => {
  test.use({ storageState: DESLOGADO });

  // Diagnóstico manual (usa a rede): DIAG_GSI=1. Ver o plano mobile-09, Task 1.
  test('diagnóstico: Login com o script do Google carregado', async ({ page }) => {
    test.skip(!process.env.DIAG_GSI, 'só com DIAG_GSI=1');
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await gotoApp(page, '/login');
    await page.waitForTimeout(4000);
    const caiu = await page.getByText('Algo deu errado.').isVisible();
    console.log(JSON.stringify({ caiu, erros }));
  });
});
```

Run (em `bussola_web/`, PowerShell), com **nenhum** Vite rodando e **antes** de mudar o `playwright.config.mjs`:
```powershell
$env:DIAG_GSI = '1'; npx playwright test e2e/auth.desktop.spec.mjs --project=desktop -g "diagnóstico" --reporter=line; Remove-Item Env:DIAG_GSI
```
Expected (registrar no commit): com rede, `{"caiu":true, …, "erros":["Missing required parameter client_id." …]}` — confirma que **o próprio app** cai sem `VITE_GOOGLE_CLIENT_ID` quando o GSI carrega. Sem rede para o Google, `caiu:false` (o script não carrega). Se o resultado for diferente de ambos, pare e reporte ao controlador antes de seguir.

- [ ] **Step 2: Client id falso no servidor do teste**

Em `bussola_web/playwright.config.mjs`, substituir:

```js
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
```

por:

```js
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 120_000,
      // Client id falso (o Playwright soma este env ao process.env): sem ele o GSI do Google
      // lança no Login assim que o script carrega. As specs de Auth ainda bloqueiam o GSI.
      env: { VITE_GOOGLE_CLIENT_ID: 'e2e-dummy.apps.googleusercontent.com' },
    },
```

Em `bussola_web/e2e/README.md`, ao final da lista, adicionar:

```markdown
- O Vite do teste sobe com `VITE_GOOGLE_CLIENT_ID` falso (`playwright.config.mjs` → `webServer.env`). Com `reuseExistingServer`, um `npm run dev` já aberto **sem** essa variável é reaproveitado: feche-o antes de rodar a suíte. As specs de Login/Auth também bloqueiam `accounts.google.com` (`e2e/fixtures/auth.mjs` → `semGoogle`).
```

- [ ] **Step 3: Bases do desktop ANTES de mexer em Login/Auth/Admin**

Substituir **todo** o conteúdo de `bussola_web/e2e/auth.desktop.spec.mjs` por:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';
import { DESLOGADO, semGoogle, cadastroAberto } from './fixtures/auth.mjs';

const PUBLICAS = [
  ['login', '/login', '.auth-card'],
  ['register', '/register', '.auth-card'],
  ['forgot-password', '/forgot-password', '.auth-simple-card'],
];

test.describe('deslogado', () => {
  test.use({ storageState: DESLOGADO });

  // Diagnóstico manual (usa a rede): DIAG_GSI=1. Ver o plano mobile-09, Task 1.
  test('diagnóstico: Login com o script do Google carregado', async ({ page }) => {
    test.skip(!process.env.DIAG_GSI, 'só com DIAG_GSI=1');
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await gotoApp(page, '/login');
    await page.waitForTimeout(4000);
    const caiu = await page.getByText('Algo deu errado.').isVisible();
    console.log(JSON.stringify({ caiu, erros }));
  });

  for (const [nome, rota, pronto] of PUBLICAS) {
    test(`desktop ${nome} inalterado`, async ({ page }) => {
      await semGoogle(page);
      await cadastroAberto(page);
      await gotoApp(page, rota);
      await page.locator(pronto).waitFor();
      await page.waitForTimeout(600); // animação de entrada do card (slideUpFade 0.5s)
      await expect(page).toHaveScreenshot(`${nome}.png`, { fullPage: true });
    });
  }

  test('Login com o script do Google liberado não cai', async ({ page }) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await gotoApp(page, '/login');
    await page.waitForTimeout(3000);
    await expect(page.getByText('Algo deu errado.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    expect(erros).toEqual([]);
  });
});

test('desktop admin-modal inalterado', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await page.locator('aside.sidebar').getByRole('button', { name: /Novo Usuário/ }).click();
  await page.locator('.admin-modal-content').waitFor();
  await page.waitForTimeout(400);
  await expect(page).toHaveScreenshot('admin-modal.png');
});
```

Run: `npm run e2e:update -- --project=desktop e2e/auth.desktop.spec.mjs -g "inalterado"`
Expected: 4 passed; criados `login.png`, `register.png`, `forgot-password.png`, `admin-modal.png` em `e2e/auth.desktop.spec.mjs-snapshots/`. Abra os 4: Login com ilustração à esquerda e card "Entrar no Bússola"; Registro "Crie sua Conta" com a dica de segurança; "Recuperar Senha"; o modal "Novo Usuário (Admin)" sobre o Cofre. Rode `npm run e2e -- --project=desktop` → confirme as bases estáveis.

- [ ] **Step 4: O teste "não cai" falha sem o botão isolado (com rede)**

Run: `npm run e2e -- --project=desktop e2e/auth.desktop.spec.mjs -g "não cai"`
Expected: com o client id falso do Step 2 o GSI aceita a inicialização → **passa**. Para provar a correção do Step 5, rode uma vez com um Vite aberto à mão **sem** a variável (`npx vite --host 127.0.0.1 --port 5173 --strictPort` em outro terminal; o `reuseExistingServer` o reaproveita): Expected FAIL ("Algo deu errado." visível) quando há rede para o Google. Feche esse Vite depois.

- [ ] **Step 5: Botão do Google isolado (decisão D1)**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Login/index.jsx` por:

```jsx
import { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google'; // Importando Hook Google

import './styles.css';
import { logger } from '../../utils/logger';

import loginImageLight from '../../assets/images/loginimage1.svg';
import loginImageDark from '../../assets/images/loginimage1-dark.svg';
import logoBussola from '../../assets/images/bussola.svg';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Botão "Entrar com Google" isolado: o hook do Google só roda quando o botão existe.
// Sem client id, o initTokenClient do GSI lança assim que o script carrega e o
// ErrorBoundary troca a tela inteira por "Algo deu errado." (mesmo em SELF_HOSTED,
// onde o botão nem aparece).
function GoogleLoginButton({ disabled, onToken, onCancelado }) {
    const entrar = useGoogleLogin({
        onSuccess: (tokenResponse) => onToken(tokenResponse.access_token),
        onError: onCancelado,
    });
    return (
        <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => entrar()}
            disabled={disabled}
        >
            <i className="fa-brands fa-google"></i>
            Entrar com Google
        </button>
    );
}

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Contexto de Autenticação
    const { login, loginGoogle } = useContext(AuthContext); 
    const { addToast } = useToast();

    // Contexto de Sistema (Flags de configuração)
    const { canRegister, isSaaS, loading: systemLoading } = useSystem();

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // searchParams.get já decodifica; decodificar de novo corromperia a query do
    // fluxo OAuth (redirect_uri, state) que volta por aqui.
    const nextUrl = searchParams.get('next') || '/home';

    // --- LÓGICA DO LOGIN GOOGLE ---
    const entrarComGoogle = async (accessToken) => {
        setLoading(true);
        try {
            // Chama a função do Contexto que chama a API
            const result = await loginGoogle(accessToken);

            if (result.success) {
                addToast({ type: 'success', title: 'Login com Google', description: 'Bem-vindo de volta!' });
                navigate(nextUrl);
            } else {
                addToast({ type: 'error', title: 'Falha', description: 'Não foi possível autenticar com o Google.' });
            }
        } catch (error) {
            logger.error("Erro inesperado", { error: String(error) });
            addToast({ type: 'error', title: 'Erro', description: 'Erro na comunicação com o Google.' });
        } finally {
            setLoading(false);
        }
    };

    // --- LÓGICA DO LOGIN LOCAL ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await login(email, password);

            if (result.success) {
                addToast({ type: 'success', title: 'Bem-vindo!', description: 'Login realizado com sucesso.' });
                navigate(nextUrl);
            } else {
                // Tratamento específico para conta não verificada (Backend retorna 401 com mensagem)
                const errorMsg = result.message || 'Credenciais inválidas.';
                
                if (errorMsg.includes("verificado") || errorMsg.includes("e-mail")) {
                    addToast({ type: 'warning', title: 'E-mail não verificado', description: errorMsg });
                } else {
                    addToast({ type: 'error', title: 'Falha no Login', description: errorMsg });
                }
            }
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Servidor indisponível no momento.' });
        } finally {
            setLoading(false);
        }
    };

    if (systemLoading) {
        return <div className="loading-screen">Iniciando Bússola...</div>;
    }

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-intro">
                    <div className="auth-intro-header">
                        <h1>Encontre o seu Norte</h1>
                    </div>
                    <p>
                        Em um mundo de informações e distrações, o Bússola é o seu ponto de referência.
                        Centralize sua vida financeira, seus planos e seus pensamentos em um só lugar.
                    </p>
                    <img src={loginImageLight} alt="Ilustração Light" className="auth-intro-image theme-image image-light-mode" />
                    <img src={loginImageDark} alt="Ilustração Dark" className="auth-intro-image theme-image image-dark-mode" />
                </div>

                <div className="auth-card">
                    <div className="auth-card-header">
                        <img src={logoBussola} alt="Logo Bússola" className="auth-logo-card" />
                        <h2>Entrar no Bússola</h2>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="username">E-mail</label>
                            <input
                                type="text"
                                id="username"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="username"
                                placeholder="seu@email.com"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Senha</label>
                            <input
                                type="password"
                                id="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="forgot-password-link" style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                            <Link to="/forgot-password" style={{ fontSize: '0.9rem', color: '#aaa', textDecoration: 'none' }}>
                                Esqueceu a senha?
                            </Link>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>

                        <div className="auth-actions" style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            
                            {/* BOTÃO GOOGLE (só em SaaS e com client id configurado) */}
                            {isSaaS && GOOGLE_CLIENT_ID && (
                                <GoogleLoginButton
                                    disabled={loading}
                                    onToken={entrarComGoogle}
                                    onCancelado={() => addToast({ type: 'error', title: 'Erro', description: 'O login com Google foi cancelado.' })}
                                />
                            )}

                            {/* LINK CADASTRO */}
                            {(isSaaS || canRegister) ? (
                                <div style={{ fontSize: '0.9rem', color: 'var(--cor-texto-secundario)' }}>
                                    Não tem uma conta?{' '}
                                    <Link to="/register" style={{ color: 'var(--cor-azul-primario)', fontWeight: 'bold', textDecoration: 'none' }}>
                                        Crie agora
                                    </Link>
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.8rem', color: 'var(--cor-texto-terciario)', fontStyle: 'italic' }}>
                                    Cadastro fechado para novos usuários.
                                </div>
                            )}

                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npm run e2e -- --project=desktop e2e/auth.desktop.spec.mjs` → Expected: 5 passed, 1 skipped (diagnóstico); `login.png` idêntico (SELF_HOSTED: o botão do Google não aparece antes nem depois).
Run (prova da correção): repita o Step 4 com o Vite **sem** a variável → Expected: agora **passa** (o hook do Google não monta). Feche esse Vite.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa.

- [ ] **Step 7: Lint e commit**

Run: `npx eslint src/pages/Login` → Expected: **0 erros** (o `catch (error)` sem uso virou `catch {`).

```bash
git add bussola_web/playwright.config.mjs bussola_web/e2e/README.md bussola_web/e2e/fixtures/auth.mjs bussola_web/e2e/auth.desktop.spec.mjs bussola_web/e2e/auth.desktop.spec.mjs-snapshots bussola_web/src/pages/Login/index.jsx
git commit -m "fix(web): Login nao cai sem VITE_GOOGLE_CLIENT_ID (botao do Google isolado); client id falso e GSI bloqueado nos testes; bases do desktop" -m "diagnostico: <colar a linha JSON do Step 1>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: CSS de Auth escopado, variáveis inexistentes e telas de Auth no celular

**Files:**
- Create: `bussola_web/e2e/auth.mobile.spec.mjs`
- Modify: `bussola_web/src/pages/Auth/styles.css`, `bussola_web/src/assets/styles/components.css`, `bussola_web/src/pages/Auth/RegisterSuccess.jsx`, `bussola_web/src/pages/Auth/VerifyEmail.jsx`, `bussola_web/src/pages/Auth/DiscordLink.jsx`, `bussola_web/src/pages/Auth/ResetPassword.jsx`, `bussola_web/src/pages/Auth/AutorizarConexao.css`, `bussola_web/e2e/auth.desktop.spec.mjs`

**Interfaces:**
- Produces: `.auth-status-page` / `.auth-status-card` (`.is-largo` no Cadastro enviado) com `--cor-fundo` / `--cor-card-principal` / `--cor-borda`; `Auth/styles.css` sem nenhum seletor genérico (`.form-group`, `.form-input`, `.btn-primary`, `.link-secondary`, `.text-muted` só sob `.auth-simple-card`); bloco "efeitos globais preservados" em `components.css`.

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/auth.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';
import { DESLOGADO, semGoogle, cadastroAberto } from './fixtures/auth.mjs';

// [nome, rota, seletor do card]
const PUBLICAS = [
  ['login', '/login', '.auth-card'],
  ['register', '/register', '.auth-card'],
  ['forgot', '/forgot-password', '.auth-simple-card'],
  ['reset', '/reset-password?token=e2e', '.auth-simple-card'],
  ['verify', '/verify-email', '.auth-status-card'],
  ['register-success', '/register-success', '.auth-status-card'],
];

async function abrir(page, rota, card) {
  await semGoogle(page);
  await cadastroAberto(page);
  await gotoApp(page, rota);
  await page.locator(card).waitFor();
  await page.waitForTimeout(600); // animação de entrada
}

// ---------------------------------------------------------------------------
// Task 2 — telas de Auth
// ---------------------------------------------------------------------------
test.describe('auth deslogado', () => {
  test.use({ storageState: DESLOGADO });

  for (const w of [360, 390, 430, 768]) {
    test(`sem overflow horizontal em ${w}px nas telas públicas`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      for (const [nome, rota, card] of PUBLICAS) {
        await abrir(page, rota, card);
        expect(await overflowOffenders(page), `${nome} @ ${w}px`).toEqual([]);
      }
    });
  }

  test('Esqueci/Nova senha/Status: card de largura total (16px) e alvos ≥ 44px', async ({ page }) => {
    for (const [nome, rota, card] of PUBLICAS.slice(2)) {
      await abrir(page, rota, card);
      const b = await page.locator(card).boundingBox();
      expect(Math.round(b.x), nome).toBe(16);
      expect(Math.round(b.width), nome).toBe(390 - 32);
      expect(await smallTargets(page, card), nome).toEqual([]);
    }
  });

  test('telas de status com fundo de card (variáveis corrigidas)', async ({ page }) => {
    for (const rota of ['/verify-email', '/register-success']) {
      await abrir(page, rota, '.auth-status-card');
      const card = page.locator('.auth-status-card');
      expect(await card.evaluate((e) => getComputedStyle(e).backgroundColor), rota).toBe('rgb(46, 47, 51)');
      expect(await card.evaluate((e) => getComputedStyle(e).borderTopColor), rota).not.toBe('rgb(229, 231, 235)');
    }
  });
});

test.describe('auth logado', () => {
  test('Discord e Autorizar conexão: sem overflow e card de largura total', async ({ page }) => {
    await page.route(/\/api\/v1\/oauth\/clientes\/[^/]+$/, (r) => r.fulfill({ json: { client_id: 'e2e', client_name: 'Claude' } }));
    for (const w of [360, 390, 430, 768]) {
      await page.setViewportSize({ width: w, height: 844 });
      await gotoApp(page, '/discord/link');
      await page.locator('.auth-status-card').waitFor();
      expect(await overflowOffenders(page), `discord @ ${w}`).toEqual([]);
      await gotoApp(page, '/conexoes/autorizar?client_id=e2e&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fcallback');
      await page.locator('.autorizar-acoes').waitFor();
      expect(await overflowOffenders(page), `autorizar @ ${w}`).toEqual([]);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, '/discord/link');
    const d = await page.locator('.auth-status-card').boundingBox();
    expect(Math.round(d.x)).toBe(16);
    expect(Math.round(d.width)).toBe(390 - 32);
    expect(await smallTargets(page, '.auth-status-card')).toEqual([]);
    await gotoApp(page, '/conexoes/autorizar?client_id=e2e&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fcallback');
    await page.locator('.autorizar-acoes').waitFor();
    expect(Math.round((await page.locator('.autorizar-card').boundingBox()).width)).toBe(390 - 32);
    expect(await smallTargets(page, '.autorizar-card')).toEqual([]);
  });
});
```

Ao final de `bussola_web/e2e/auth.desktop.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 2 — escopo do Auth sem mudar o desktop
// ---------------------------------------------------------------------------
test('efeitos globais preservados ao escopar o Auth (labels, input inválido, hover do primário)', async ({ page }) => {
  await gotoApp(page, '/cofre');
  await page.getByRole('button', { name: 'Guardar Segredo' }).click();
  const label = page.locator('.modal-content .form-group label').first();
  expect(await label.evaluate((e) => getComputedStyle(e).marginLeft)).toBe('2px');
  const dias = page.locator('.modal-content input[type="number"]');
  await dias.fill('-5'); // min="0": inválido e preenchido
  await page.locator('.modal-content h3').click();
  expect(await dias.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe('rgb(239, 68, 68)');
  const salvar = page.locator('.modal-content .btn-primary');
  await salvar.hover();
  await expect.poll(() => salvar.evaluate((e) => getComputedStyle(e).filter)).toBe('brightness(1.1)');
});

test.describe('status (base depois da correção das variáveis)', () => {
  test.use({ storageState: DESLOGADO });
  for (const [nome, rota] of [['verify-email', '/verify-email'], ['register-success', '/register-success']]) {
    test(`desktop ${nome} com card visível`, async ({ page }) => {
      await gotoApp(page, rota);
      await page.locator('.auth-status-card').waitFor();
      await page.waitForTimeout(600);
      await expect(page).toHaveScreenshot(`${nome}.png`);
    });
  }
});
```

Run: `npm run e2e -- --project=mobile e2e/auth.mobile.spec.mjs` e `npm run e2e -- --project=desktop e2e/auth.desktop.spec.mjs -g "preservados"`
Expected: mobile FAIL — `.auth-status-card` não existe; o `.auth-simple-card` fica transparente e sem borda ≤600px (fundo `rgba(0,0,0,0)`); "Voltar para Login" com ~22px. Desktop "preservados" **passa** já agora (prova de que hoje esses efeitos existem — é o que a Step 3 precisa manter).

- [ ] **Step 2: Efeitos globais explícitos em `components.css`**

Ao **final** de `bussola_web/src/assets/styles/components.css`, adicionar:

```css
/* ========================================================= */
/* EFEITOS GLOBAIS QUE VINHAM DE Auth/styles.css             */
/* Aquele arquivo é carregado no boot (via ForgotPassword) e  */
/* tinha regras sem escopo. Medido na cascata: só estes       */
/* efeitos chegavam ao app (o resto era sobrescrito por       */
/* components.css/global.css). Mantidos aqui, iguais, para o  */
/* desktop não mudar ao escopar o Auth.                       */
/* ========================================================= */
.form-group label {
    margin-left: 2px;
}

.form-input:invalid:not(:placeholder-shown) {
    border-color: #ef4444;
}

.btn-primary.full-width {
    width: 100%;
}

@media (hover: hover) and (pointer: fine) {
    .btn-primary:hover:not(:disabled) {
        filter: brightness(1.1);
        transform: translateY(-1px);
    }
}

.btn-primary:active:not(:disabled) {
    transform: translateY(0);
}
```

- [ ] **Step 3: `Auth/styles.css` escopado**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Auth/styles.css` por:

```css
/* ==========================================================
   AUTH — Esqueci a senha, Nova senha e telas de status
   (verificação de e-mail, cadastro enviado, vínculo do Discord).
   Tudo escopado: este arquivo é carregado no boot (via ForgotPassword)
   e antes vazava .form-group/.form-input/.btn-primary para o app todo.
   Os efeitos globais que vinham desse vazamento estão em components.css.
   ========================================================== */

/* CONTAINER GERAL (Centraliza tudo na tela) */
.auth-simple-container {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    justify-items: center;
    max-width: 1100px;
    gap: 4rem;
    margin: 0 auto;
    background-color: var(--cor-fundo);
    padding: 1.5rem;
    transition: background-color 0.3s ease;
}

/* CARTÃO DE AUTH */
.auth-simple-card {
    background-color: var(--cor-card-principal);
    width: 100%;
    max-width: 440px; /* Largura ideal para leitura */
    padding: 2.5rem;
    border-radius: 16px;
    border: 1px solid var(--cor-borda);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 2rem;
    animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* CABEÇALHO DO CARD */
.auth-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.auth-header h2 {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--cor-texto-principal);
    margin: 0;
}

.auth-header p {
    font-size: 0.95rem;
    color: var(--cor-texto-secundario);
    line-height: 1.5;
    margin: 0;
}

/* FORMULÁRIO */
.auth-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.auth-simple-card .form-group {
    margin-bottom: 1.5rem;
}

.auth-simple-card .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--cor-texto-secundario);
}

.auth-simple-card .form-input {
    width: 100%;
    padding: 0.8rem 1rem;
    border: 1px solid var(--cor-borda);
    border-radius: 8px;
    background-color: var(--cor-fundo);
    color: var(--cor-texto-principal);
    font-size: 1rem;
    font-family: 'Poppins', sans-serif;
}

.auth-simple-card .form-input:focus {
    outline: none;
    border-color: var(--cor-azul-primario);
    box-shadow: 0 0 0 3px rgba(74, 109, 255, 0.3);
}

.auth-simple-card .btn-primary {
    width: 100%;
    padding: 0.8rem;
    font-size: 1rem;
    margin-top: 1rem;
    background: linear-gradient(90deg, var(--cor-azul-primario), #a855f7);
    border: none;
    transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

.auth-simple-card .btn-primary:hover {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

/* MENSAGEM DE SUCESSO */
.auth-success-message {
    text-align: center;
    padding: 1rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    animation: fadeIn 0.4s ease-out;
}

.auth-success-message h3 {
    color: var(--cor-texto-principal);
    font-size: 1.4rem;
    margin: 0;
}

.auth-success-message p {
    color: var(--cor-texto-secundario);
    margin: 0.2rem 0;
}

/* RODAPÉ DO CARD */
.auth-footer {
    text-align: center;
    margin-top: -0.5rem;
}

.auth-simple-card .link-secondary {
    color: var(--cor-texto-secundario);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 500;
    transition: color 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.auth-simple-card .link-secondary:hover {
    color: var(--cor-azul-primario);
}

.auth-simple-card .text-muted {
    font-size: 0.8rem !important;
    opacity: 0.8;
}

/* ==========================================================
   Força de senha (Registro e Nova senha) — classes próprias
   ========================================================== */
.password-strength-container {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.strength-bar-bg {
    width: 100%;
    height: 6px;
    background-color: var(--cor-borda);
    border-radius: 3px;
    overflow: hidden;
}

.strength-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-text {
    font-size: 0.75rem;
    font-weight: 600;
    text-align: right;
}

/* Box de Dica de Segurança (Register) */
.security-tip-box {
    background-color: rgba(59, 130, 246, 0.08);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 8px;
    padding: 12px;
    margin-top: 10px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 0.85rem;
    color: var(--cor-texto-secundario);
    line-height: 1.4;
    text-align: left;
}

.security-tip-box i {
    color: var(--cor-azul-primario);
    margin-top: 3px;
}

/* ==========================================================
   Telas de status (antes inline, com --cor-fundo-principal,
   --cor-fundo-card e --cor-borda-suave, que não existem)
   ========================================================== */
.auth-status-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: var(--cor-fundo);
    color: var(--cor-texto-principal);
    padding: 20px;
    text-align: center;
}

.auth-status-card {
    background: var(--cor-card-principal);
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    max-width: 450px;
    width: 100%;
    border: 1px solid var(--cor-borda);
}

.auth-status-card.is-largo {
    padding: 50px 40px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
    max-width: 500px;
}

/* ANIMAÇÕES (fadeIn vem de components.css) */
@keyframes slideUpFade {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 900px) {
    .auth-simple-container {
        text-align: center;
        gap: 3rem;
    }
}

/* ==========================================================
   CELULAR (≤768): cards de largura total, 16px de gutter
   ========================================================== */
@media (max-width: 768px) {
    .auth-simple-container {
        align-items: flex-start;
        padding: calc(var(--safe-top) + var(--sp-6)) var(--sp-4) var(--sp-6);
    }

    .auth-simple-card {
        max-width: none;
        padding: var(--sp-5) var(--sp-4);
        gap: var(--sp-5);
    }

    .auth-header h2 {
        font-size: 1.5rem;
    }

    .auth-simple-card .form-group {
        margin-bottom: var(--sp-4);
    }

    .auth-simple-card .btn-primary {
        min-height: 48px;
    }

    .auth-simple-card .link-secondary {
        min-height: var(--tap-min);
    }

    .auth-status-page {
        justify-content: flex-start;
        min-height: 0;
        padding: calc(var(--safe-top) + var(--sp-6)) var(--sp-4) var(--sp-6);
    }

    .auth-status-card,
    .auth-status-card.is-largo {
        max-width: none;
        padding: var(--sp-5) var(--sp-4);
        border-radius: 16px;
    }

    .auth-status-card button {
        min-height: 48px;
    }
}
```

- [ ] **Step 4: Telas de status usam as classes**

Substituir **todo** o conteúdo de `bussola_web/src/pages/Auth/RegisterSuccess.jsx` por:

```jsx
import { useNavigate } from 'react-router-dom';
import logoBussola from '../../assets/images/bussola.svg';
import './styles.css';

export function RegisterSuccess() {
    const navigate = useNavigate();

    return (
        <div className="auth-status-page">
            <div className="auth-status-card is-largo">
                <img src={logoBussola} alt="Logo" style={{ height: '70px', marginBottom: '30px' }} />
                
                <div style={{ marginBottom: '20px' }}>
                    <i className="fas fa-paper-plane" style={{ fontSize: '4rem', color: 'var(--cor-azul-primario)' }}></i>
                </div>

                <h1 style={{ fontSize: '1.8rem', marginBottom: '15px', color: 'var(--cor-texto-principal)' }}>
                    Falta pouco!
                </h1>
                
                <p style={{ fontSize: '1.1rem', color: 'var(--cor-texto-secundario)', lineHeight: '1.6' }}>
                    Enviamos um link de ativação para o seu e-mail. 
                    Por favor, verifique sua <strong>caixa de entrada</strong> (e a pasta de spam) para confirmar seu cadastro.
                </p>

                <div style={{ 
                    marginTop: '35px', 
                    padding: '20px', 
                    backgroundColor: 'rgba(59, 130, 246, 0.05)', 
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: 'var(--cor-texto-secundario)'
                }}>
                    <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
                    Você só conseguirá fazer login após clicar no link enviado.
                </div>

                <button 
                    onClick={() => navigate('/login')}
                    className="btn-primary"
                    style={{ 
                        marginTop: '30px', 
                        width: '100%',
                        padding: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Voltar para o Login
                </button>
            </div>
        </div>
    );
}
```

Em `bussola_web/src/pages/Auth/VerifyEmail.jsx`:

1. Substituir:
```jsx
import { logger } from '../../utils/logger';
```
por:
```jsx
import { logger } from '../../utils/logger';
import './styles.css';
```

2. Substituir:
```jsx
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: 'var(--cor-fundo-principal)', // Usa suas variáveis de tema
            color: 'var(--cor-texto-principal)',
            padding: '20px',
            textAlign: 'center'
        }}>
            <div style={{
                background: 'var(--cor-fundo-card)',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                maxWidth: '450px',
                width: '100%',
                border: '1px solid var(--cor-borda-suave, #e5e7eb)'
            }}>
```
por:
```jsx
        <div className="auth-status-page">
            <div className="auth-status-card">
```

Em `bussola_web/src/pages/Auth/DiscordLink.jsx`:

1. Substituir:
```jsx
import logoBussola from '../../assets/images/bussola.svg';
```
por:
```jsx
import logoBussola from '../../assets/images/bussola.svg';
import './styles.css';
```

2. Substituir:
```jsx
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: 'var(--cor-fundo-principal)',
            color: 'var(--cor-texto-principal)',
            padding: '20px',
            textAlign: 'center',
        }}>
            <div style={{
                background: 'var(--cor-fundo-card)',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                maxWidth: '450px',
                width: '100%',
                border: '1px solid var(--cor-borda-suave, #e5e7eb)',
            }}>
```
por:
```jsx
        <div className="auth-status-page">
            <div className="auth-status-card">
```

Em `bussola_web/src/pages/Auth/ResetPassword.jsx`, substituir:
```jsx
import '../Login/styles.css'; // Usando o mesmo CSS global de auth
```
por:
```jsx
import './styles.css'; // .auth-simple-* e força de senha
```

- [ ] **Step 5: Autorizar conexão no celular**

Ao **final** de `bussola_web/src/pages/Auth/AutorizarConexao.css`, adicionar:

```css
@media (max-width: 768px) {
    .autorizar-page {
        align-items: flex-start;
        padding: calc(var(--safe-top) + var(--sp-6)) var(--sp-4) var(--sp-6);
    }

    .autorizar-card {
        max-width: none;
        padding: var(--sp-5) var(--sp-4);
    }

    .autorizar-opcao {
        min-height: var(--tap-min);
    }

    .autorizar-acoes {
        gap: var(--sp-2);
    }

    .autorizar-btn {
        flex: 1;
        min-height: 48px;
    }
}
```

- [ ] **Step 6: Rodar os testes e gerar as bases das telas de status**

Run: `npm run e2e -- --project=mobile e2e/auth.mobile.spec.mjs` → Expected: 7 passed. Se "alvos" listar o link "Voltar para Login" com < 44px de **largura**, ele já tem texto longo; se listar altura, confira o `min-height` do `.link-secondary`.
Run: `npm run e2e:update -- --project=desktop e2e/auth.desktop.spec.mjs -g "card visível"` → Expected: 2 PNGs novos (`verify-email.png`, `register-success.png`). **Abra os dois**: card cinza-escuro (`#2E2F33`) com borda sutil sobre o fundo `#202124`; erro "Link de verificação inválido ou incompleto." no Verify. Esta é a mudança intencional (correção de bug) no desktop.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa — `login.png`, `register.png`, `forgot-password.png`, `admin-modal.png`, as 13 de `desktop-visual` (modais com labels/inputs/botões) e "efeitos globais preservados". Se alguma base mudar, compare as regras removidas do Auth com a lista da Step 2 (não regenere).

- [ ] **Step 7: Lint e commit**

Run: `npx eslint src/pages/Auth` → Expected: os mesmos 2 erros pré-existentes (`DiscordLink.jsx`, `VerifyEmail.jsx`), nenhum novo.

```bash
git add bussola_web/src/pages/Auth bussola_web/src/assets/styles/components.css bussola_web/e2e/auth.mobile.spec.mjs bussola_web/e2e/auth.desktop.spec.mjs bussola_web/e2e/auth.desktop.spec.mjs-snapshots
git commit -m "fix(web): CSS de Auth escopado (efeitos globais mantidos), variaveis inexistentes nas telas de status e cards de largura total no celular" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Login, Registro e Início no celular

**Files:**
- Create: `bussola_web/e2e/home.mobile.spec.mjs`
- Modify: `bussola_web/src/pages/Login/styles.css`, `bussola_web/src/pages/Home/styles.css`, `bussola_web/e2e/auth.mobile.spec.mjs`

**Interfaces:**
- Produces: Login/Registro ≤768 = card primeiro (ordem `-1`), parágrafo e ilustração ocultos, h1 da intro com `clamp`, gutter 16px, página rolável (`overflow: visible`); Início ≤768 = seções com 16px laterais, h1 `clamp(2.25rem, 10vw, 3rem)`, textos à esquerda, links de 44px, hover só com mouse.

- [ ] **Step 1: Testes que falham**

Ao final de `bussola_web/e2e/auth.mobile.spec.mjs`, adicionar:

```js
// ---------------------------------------------------------------------------
// Task 3 — Login e Registro
// ---------------------------------------------------------------------------
test.describe('login e registro no celular', () => {
  test.use({ storageState: DESLOGADO });

  for (const [nome, rota] of [['login', '/login'], ['register', '/register']]) {
    test(`${nome}: card primeiro, sem ilustração nem parágrafo, gutter de 16px`, async ({ page }) => {
      await abrir(page, rota, '.auth-card');
      const card = await page.locator('.auth-card').boundingBox();
      const h1 = await page.locator('.auth-intro h1').boundingBox();
      expect(card.y).toBeLessThan(h1.y);
      expect(Math.round(card.x)).toBe(16);
      expect(Math.round(card.width)).toBe(390 - 32);
      await expect(page.locator('.auth-intro p')).toBeHidden();
      for (const img of await page.locator('.auth-intro-image').all()) await expect(img).toBeHidden();
      const fonte = await page.locator('.auth-intro h1').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(fonte).toBeGreaterThanOrEqual(24);
      expect(fonte).toBeLessThanOrEqual(32);
      expect(await smallTargets(page, '.auth-card')).toEqual([]);
    });
  }

  test('viewport baixa (teclado): a página rola até o Entrar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 420 });
    await abrir(page, '/login', '.auth-card');
    expect(await page.locator('.auth-page').evaluate((e) => getComputedStyle(e).overflowY)).toBe('visible');
    const entrar = page.getByRole('button', { name: 'Entrar', exact: true });
    await entrar.scrollIntoViewIfNeeded();
    await expect(entrar).toBeInViewport();
  });

  test('login de verdade pelo celular leva ao Início', async ({ page }) => {
    await abrir(page, '/login', '.auth-card');
    await page.getByLabel('E-mail').fill('demo@bussola.dev');
    await page.getByLabel('Senha').fill('Demo12345!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('.m-topbar-title')).toHaveText('Início');
  });
});
```

Criar `bussola_web/e2e/home.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, overflowOffenders, smallTargets } from './helpers.mjs';

// Feed de notícias vem de fonte externa: resposta fixa (igual à base do desktop).
const NEWS = Array.from({ length: 4 }, (_, i) => ({
  title: `Noticia de exemplo numero ${i + 1} para o feed rapido`,
  url: 'https://example.com/noticia',
  source: { name: 'Fonte Demo' },
  topic: 'tech',
}));

async function abrirHome(page) {
  await page.route(/\/home\/news(\?.*)?$/, (route) => route.fulfill({ json: NEWS }));
  await gotoApp(page, '/home');
  await page.locator('.news-card').first().waitFor();
}

for (const w of [360, 390, 430, 768]) {
  test(`início sem overflow horizontal em ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 844 });
    await abrirHome(page);
    expect(await overflowOffenders(page), `${w}px`).toEqual([]);
  });
}

test('hero: 16px de gutter, h1 fluido e texto à esquerda', async ({ page }) => {
  await abrirHome(page);
  expect(Math.round((await page.locator('.hero-content').boundingBox()).x)).toBe(16);
  const h1 = page.locator('.hero-text h1');
  const px = await h1.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(px).toBeGreaterThanOrEqual(36);
  expect(px).toBeLessThanOrEqual(48);
  expect(await page.locator('.hero-content').evaluate((e) => getComputedStyle(e).textAlign)).toBe('left');
  expect(await page.locator('.hero-text .subtitle').evaluate((e) => getComputedStyle(e).textAlign)).toBe('left');
});

test('features: parágrafos à esquerda (inclusive a coluna "direita") e links de 44px', async ({ page }) => {
  await abrirHome(page);
  const direita = page.locator('.feature-content-stack.align-right');
  expect(await direita.evaluate((e) => getComputedStyle(e).textAlign)).toBe('left');
  const p = direita.locator('.feature-item p').first();
  expect(await p.evaluate((e) => getComputedStyle(e).borderLeftWidth)).toBe('3px');
  expect(await p.evaluate((e) => getComputedStyle(e).borderRightWidth)).toBe('0px');
  for (const sec of ['.features-presentation-area', '.panorama-highlight-section', '.news-footer-section']) {
    expect(await smallTargets(page, sec), sec).toEqual([]);
  }
  const secoes = ['.features-presentation-area', '.panorama-highlight-section', '.news-footer-section'];
  for (const sec of secoes) {
    expect(await page.locator(sec).evaluate((e) => getComputedStyle(e).paddingLeft), sec).toBe('16px');
  }
});

test('sem efeito de hover no toque (card de notícia e imagem)', async ({ page }) => {
  await abrirHome(page);
  const card = page.locator('.news-card').first();
  await card.hover();
  await page.waitForTimeout(350);
  expect(await card.evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  const img = page.locator('.feature-image-showcase img:visible').first();
  await img.hover();
  await page.waitForTimeout(450);
  expect(await img.evaluate((e) => getComputedStyle(e).transform)).toBe('none');
});
```

Run: `npm run e2e -- --project=mobile e2e/auth.mobile.spec.mjs e2e/home.mobile.spec.mjs`
Expected: FAIL — no Login o card vem depois da intro (≤900 empilha a intro primeiro) e a ilustração aparece; `.auth-page` com `overflow: hidden`; no Início h1 de 48px, texto centralizado, 24px laterais, coluna "direita" alinhada à direita e `translateY(-5px)` no hover.

- [ ] **Step 2: Login/Registro no celular**

Ao **final** de `bussola_web/src/pages/Login/styles.css`, adicionar:

```css
/* =================================================================== */
/* === CELULAR (≤768): formulário primeiro, sem ilustração e sem
/* === parágrafo, 16px de gutter e página rolável (teclado aberto)
/* =================================================================== */
@media (max-width: 768px) {
    .auth-page {
        align-items: flex-start;
        overflow: visible;
        min-height: 100dvh;
    }

    .auth-container {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--sp-5);
        padding: calc(var(--safe-top) + var(--sp-4)) var(--sp-4) var(--sp-6);
    }

    .auth-card {
        order: -1;
        max-width: none;
        padding: var(--sp-5) var(--sp-4);
        border-radius: 16px;
    }

    .auth-card-header {
        gap: var(--sp-3);
        margin-bottom: var(--sp-5);
    }

    .auth-logo-card {
        width: 56px;
    }

    .auth-card h2 {
        font-size: 1.35rem;
    }

    .auth-card .form-group {
        margin-bottom: var(--sp-4);
    }

    .auth-card .btn-primary,
    .auth-card .submit-button {
        min-height: 48px;
    }

    .auth-card .forgot-password-link a,
    .auth-card .auth-actions a {
        display: inline-flex;
        align-items: center;
        min-height: var(--tap-min);
    }

    /* Ilustração e parágrafo somem; o título da intro fica, pequeno, abaixo do card */
    .auth-page .auth-intro p,
    .auth-page .auth-intro .auth-intro-image {
        display: none;
    }

    .auth-intro {
        text-align: center;
    }

    .auth-intro-header {
        justify-content: center;
        margin-bottom: 0;
    }

    .auth-intro h1 {
        font-size: clamp(1.5rem, 7vw, 2rem);
    }
}
```

- [ ] **Step 3: Início — hover só com mouse (no mesmo lugar da cascata)**

Em `bussola_web/src/pages/Home/styles.css`, substituir cada bloco abaixo pela versão dentro do gate:

```css
.cta-link:hover {
    letter-spacing: 0.5px;
}

.cta-link:hover i {
    transform: translateX(5px);
}
```
por:
```css
@media (hover: hover) and (pointer: fine) {
    .cta-link:hover {
        letter-spacing: 0.5px;
    }

    .cta-link:hover i {
        transform: translateX(5px);
    }
}
```

```css
.feature-image-showcase:hover img {
    transform: scale(1.03);
}
```
por:
```css
@media (hover: hover) and (pointer: fine) {
    .feature-image-showcase:hover img {
        transform: scale(1.03);
    }
}
```

```css
.news-card:hover {
    transform: translateY(-5px);
    border-color: var(--cor-azul-primario);
    background: var(--cor-fundo-hover);
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}
```
por:
```css
@media (hover: hover) and (pointer: fine) {
    .news-card:hover {
        transform: translateY(-5px);
        border-color: var(--cor-azul-primario);
        background: var(--cor-fundo-hover);
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
}
```

```css
.feature-content-stack.align-right .cta-link:hover i {
    transform: translateX(-5px);
}
```
por:
```css
@media (hover: hover) and (pointer: fine) {
    .feature-content-stack.align-right .cta-link:hover i {
        transform: translateX(-5px);
    }
}
```

- [ ] **Step 4: Início no celular**

Ao **final** de `bussola_web/src/pages/Home/styles.css`, adicionar:

```css
/* ============================================= */
/* Celular (≤768): empilhado, h1 fluido, textos  */
/* à esquerda e 16px de gutter                    */
/* ============================================= */
@media (max-width: 768px) {
    .hero-container {
        padding: var(--sp-6) var(--sp-4) var(--sp-5);
    }

    .hero-content {
        text-align: left;
        gap: var(--sp-5);
    }

    .hero-text h1 {
        font-size: clamp(2.25rem, 10vw, 3rem);
        letter-spacing: -0.5px;
        margin-bottom: var(--sp-4);
    }

    .hero-text .subtitle {
        font-size: 1rem;
        max-width: none;
        margin: 0;
    }

    .hero-info {
        max-width: none;
        min-width: 0;
        margin: 0;
    }

    .datetime-widget {
        margin-bottom: var(--sp-4);
    }

    .datetime-widget .time-display {
        font-size: 3rem;
    }

    .features-presentation-area {
        padding: var(--sp-6) var(--sp-4);
    }

    .feature-row {
        gap: var(--sp-5);
        margin-bottom: var(--sp-6);
    }

    .feature-image-showcase {
        padding: 0;
    }

    .feature-content-stack {
        gap: var(--sp-5);
    }

    .feature-item h3.gradient-title {
        font-size: 1.5rem;
    }

    /* A coluna "direita" do desktop também lê da esquerda no celular */
    .feature-content-stack.align-right {
        text-align: left;
    }

    .feature-content-stack.align-right .feature-item h3 {
        flex-direction: row;
    }

    .feature-content-stack.align-right .feature-item p {
        border-right: none;
        border-left: 3px solid var(--cor-azul-primario);
        padding-right: 0;
        padding-left: var(--sp-4);
    }

    .feature-content-stack.align-right .cta-link {
        align-self: flex-start;
    }

    .cta-link {
        display: inline-flex;
        align-items: center;
        min-height: var(--tap-min);
    }

    .panorama-highlight-section {
        padding: var(--sp-6) var(--sp-4);
        text-align: left;
    }

    .panorama-content p {
        font-size: 1rem;
    }

    .panorama-content .btn-primary.large-button {
        width: 100%;
        min-height: 48px;
    }

    .sponsor-section {
        margin: var(--sp-5) var(--sp-4) 0 !important;
        padding: var(--sp-5) var(--sp-4) !important;
    }

    .news-footer-section {
        padding: var(--sp-6) var(--sp-4);
    }

    .section-header {
        margin-bottom: var(--sp-5);
    }

    .section-header h2 {
        font-size: 1.5rem;
        justify-content: flex-start;
    }

    .news-grid {
        gap: var(--sp-3);
    }

    .news-card {
        min-height: 0;
    }
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/auth.mobile.spec.mjs e2e/home.mobile.spec.mjs` → Expected: 7 + 4 em Auth e 7 no Início passam. Se "sponsor" aparecer em `smallTargets` (o botão "Torne-se um Sponsor" tem `padding: 10px 25px` inline ≈ 40px), adicione dentro do bloco ≤768 `.sponsor-section .btn-primary { min-height: 48px; }`.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (`home.png`, `login.png`, `register.png` idênticos; o hover continua com mouse).

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Login/styles.css bussola_web/src/pages/Home/styles.css bussola_web/e2e/auth.mobile.spec.mjs bussola_web/e2e/home.mobile.spec.mjs
git commit -m "feat(web): Login/Registro com o formulario primeiro e Inicio empilhado no celular (h1 fluido, textos a esquerda, hover so com mouse)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `AdminUserModal` como sheet de verdade

**Files:**
- Create: `bussola_web/e2e/admin.mobile.spec.mjs`
- Modify: `bussola_web/src/components/AdminUserModal.jsx`, `bussola_web/src/components/AdminUserModal.css`

**Interfaces:**
- Consumes: `Sheet`, `useIsMobile`.
- Produces: no celular, `Sheet[title="Novo Usuário (Admin)"].admin-user-sheet` com `form#admin-user-form.admin-sheet-form` e rodapé Cancelar / "Criar Usuário" (`type=submit form="admin-user-form"`); sem `.admin-modal-wrapper`. Desktop inalterado.

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/admin.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp, smallTargets } from './helpers.mjs';

async function abrirAdmin(page) {
  await gotoApp(page, '/panorama');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Mais' }).click();
  await page.locator('.more-sheet').getByText('Novo Usuário', { exact: true }).click();
}

// Overlays fixos de tela cheia com fundo escurecido (um sheet = um fundo).
const fundos = (page) => page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => {
  const cs = getComputedStyle(el);
  if (cs.position !== 'fixed') return false;
  const r = el.getBoundingClientRect();
  const cheio = r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1;
  const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
  const alpha = m ? Number(m[1].split(',')[3] ?? 1) : 0;
  return cheio && alpha > 0 && alpha < 1;
}).length);

test('Novo Usuário pelo "Mais" abre um sheet só (sem fundo duplo), ancorado no rodapé', async ({ page }) => {
  await abrirAdmin(page);
  const sheet = page.locator('.modal-overlay.is-sheet');
  await expect(sheet).toHaveCount(1);
  await expect(page.locator('.admin-modal-wrapper')).toHaveCount(0);
  await expect(sheet.locator('h3')).toHaveText('Novo Usuário (Admin)');
  const content = sheet.locator('.modal-content');
  await expect.poll(async () => { const b = await content.boundingBox(); return Math.round(b.y + b.height); }).toBe(844);
  expect(await fundos(page)).toBe(1);
});

test('alvos ≥ 44px e atributos de teclado', async ({ page }) => {
  await abrirAdmin(page);
  expect(await smallTargets(page, '.modal-overlay.is-sheet')).toEqual([]);
  const email = page.locator('.admin-sheet-form input[type="email"]');
  await expect(email).toHaveAttribute('autocapitalize', 'off');
  await expect(page.locator('.admin-sheet-form input[type="password"]')).toHaveAttribute('autocomplete', 'new-password');
});

test('teclado virtual: "Criar Usuário" fica acima do teclado', async ({ page }) => {
  await page.goto('/panorama'); // garante o documento antes de mexer nas variáveis
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--vvh', '420px');
    document.documentElement.style.setProperty('--kb-inset', '424px');
  });
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Mais' }).click();
  await page.locator('.more-sheet').getByText('Novo Usuário', { exact: true }).click();
  const criar = page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Criar Usuário' });
  await expect(criar).toBeVisible();
  await expect.poll(async () => { const b = await criar.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(420);
});

test('Cancelar e Fechar fecham o sheet', async ({ page }) => {
  await abrirAdmin(page);
  await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Mais' }).click();
  await page.locator('.more-sheet').getByText('Novo Usuário', { exact: true }).click();
  await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
});
```

Run: `npm run e2e -- --project=mobile e2e/admin.mobile.spec.mjs`
Expected: FAIL — existe `.admin-modal-wrapper` (fundo duplo: o overlay `is-sheet` + o wrapper fixo), sem `h3`, o card centralizado.

- [ ] **Step 2: Sheet no celular**

Substituir **todo** o conteúdo de `bussola_web/src/components/AdminUserModal.jsx` por (o ramo do desktop é a marcação de antes):

```jsx
import React, { useState, useRef } from 'react';
import { adminCreateUser } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { BaseModal } from './BaseModal';
import { Sheet } from './mobile/Sheet';
import './AdminUserModal.css';
import { logger } from '../utils/logger';

export function AdminUserModal({ isOpen, onClose }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    
    const { addToast } = useToast();
    const mouseDownTarget = useRef(null);
    const isMobile = useIsMobile();

    // 1. OBRIGATÓRIO: Se fechado, retorna null (para sumir da tela)
    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await adminCreateUser({ email, password, full_name: fullName });
            
            addToast({
                type: 'success',
                title: 'Usuário Criado!',
                description: `A conta para ${fullName} foi criada com sucesso.`
            });
            
            setEmail('');
            setPassword('');
            setFullName('');
            onClose();

        } catch (error) {
            logger.error("Erro inesperado", { error: String(error) });
            addToast({
                type: 'error',
                title: 'Erro ao criar',
                description: error.response?.data?.detail || 'Verifique os dados e tente novamente.'
            });
        } finally {
            setLoading(false);
        }
    };

    const campos = (
        <>
            <div className="admin-form-group">
                <label>Nome Completo</label>
                <input 
                    type="text" 
                    className="admin-form-input"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    placeholder="Ex: João Silva"
                />
            </div>

            <div className="admin-form-group">
                <label>E-mail de Acesso</label>
                <input 
                    type="email" 
                    className="admin-form-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="usuario@email.com"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
            </div>

            <div className="admin-form-group">
                <label>Senha Inicial</label>
                <input 
                    type="password" 
                    className="admin-form-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="******"
                    autoComplete="new-password"
                />
            </div>
        </>
    );

    // Celular: um sheet só (o wrapper fixo próprio somava um segundo fundo ao do BaseModal).
    if (isMobile) {
        return (
            <Sheet
                open
                onClose={onClose}
                title="Novo Usuário (Admin)"
                className="admin-user-sheet"
                footer={(
                    <>
                        <button type="button" onClick={onClose} className="btn-secondary">
                            Cancelar
                        </button>
                        <button type="submit" form="admin-user-form" disabled={loading} className="btn-primary">
                            {loading ? 'Criando...' : 'Criar Usuário'}
                        </button>
                    </>
                )}
            >
                <form id="admin-user-form" onSubmit={handleSubmit} className="admin-sheet-form">
                    {campos}
                </form>
            </Sheet>
        );
    }

    return (
        <BaseModal 
            isOpen={isOpen} 
            onClose={onClose}
        >
            {/* [CORREÇÃO] Adicionamos o Wrapper que tem 'position: fixed'
                Isso garante que ele sobreponha a página, independente de onde o BaseModal esteja.
            */}
            <div
                className="admin-modal-wrapper"
                onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
                onClick={(e) => { if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose(); }}
            >
                
                {/* O conteúdo (Cartão) */}
                <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
                    
                    <div className="admin-modal-header">
                        <h2>Novo Usuário (Admin)</h2>
                        <button className="admin-modal-close-btn" type="button" onClick={onClose}>&times;</button>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-modal-form">
                        
                        <div className="admin-modal-body">
                            {campos}
                        </div>
                        
                        <div className="admin-modal-footer">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="btn-secondary"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="btn-primary"
                            >
                                {loading ? 'Criando...' : 'Criar Usuário'}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </BaseModal>
    );
}
```

Nota: o e-mail/senha ganham `autoCapitalize/autoCorrect/spellCheck`/`autoComplete` também no desktop (atributos sem efeito visual).

- [ ] **Step 3: CSS do formulário no sheet**

Ao **final** de `bussola_web/src/components/AdminUserModal.css`, adicionar:

```css
/* ============================ */
/* CELULAR: formulário no Sheet */
/* ============================ */
.admin-sheet-form {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    padding-top: var(--sp-2);
}

.admin-sheet-form .admin-form-input {
    min-height: 48px;
    background: var(--cor-fundo);
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/admin.mobile.spec.mjs e2e/shell.mobile.spec.mjs` → Expected: 4 passed + shell inteiro.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa (`admin-modal.png` idêntico).

- [ ] **Step 5: Lint e commit**

Run: `npx eslint src/components/AdminUserModal.jsx` → Expected: sem problemas.

```bash
git add bussola_web/src/components/AdminUserModal.jsx bussola_web/src/components/AdminUserModal.css bussola_web/e2e/admin.mobile.spec.mjs
git commit -m "fix(web): AdminUserModal vira sheet no celular (sem fundo duplo, Criar Usuario no rodape)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: PWA básico (manifest, ícones gerados do `bussola.svg`, sem service worker)

**Files:**
- Create: `bussola_web/scripts/gerar-icones-pwa.mjs`, `bussola_web/public/icons/icon-192.png`, `bussola_web/public/icons/icon-512.png`, `bussola_web/public/icons/icon-maskable-512.png`, `bussola_web/public/icons/apple-touch-icon.png`, `bussola_web/public/manifest.webmanifest`, `bussola_web/e2e/pwa.desktop.spec.mjs`
- Modify: `bussola_web/index.html`

**Interfaces:**
- Produces: `/manifest.webmanifest` (`name`/`short_name` "Bússola", `display: standalone`, `theme_color`/`background_color` `#202124`, `start_url`/`scope` `/`, ícones 192 e 512 `any` + 512 `maskable`); `/icons/apple-touch-icon.png` (180); `index.html` com `<link rel="manifest">`, `<meta name="theme-color">`, `apple-touch-icon`, `apple-mobile-web-app-capable`.

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/pwa.desktop.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

const BASE = 'http://127.0.0.1:5173';

// Largura × altura do PNG (cabeçalho IHDR).
function tamanhoPng(buf) {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

test('manifest com nome, standalone, cores e ícones 192/512 + maskable', async ({ request }) => {
  const res = await request.get(`${BASE}/manifest.webmanifest`);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({
    name: 'Bússola',
    short_name: 'Bússola',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    theme_color: '#202124',
    background_color: '#202124',
  });
  const porTipo = (purpose, sizes) => m.icons.find((i) => i.purpose === purpose && i.sizes === sizes);
  for (const [purpose, sizes] of [['any', '192x192'], ['any', '512x512'], ['maskable', '512x512']]) {
    const icone = porTipo(purpose, sizes);
    expect(icone, `${purpose} ${sizes}`).toBeTruthy();
    expect(icone.type).toBe('image/png');
    const png = await request.get(`${BASE}${icone.src}`);
    expect(png.ok(), icone.src).toBe(true);
    const [w, h] = tamanhoPng(await png.body());
    expect(`${w}x${h}`).toBe(sizes);
  }
  const apple = await request.get(`${BASE}/icons/apple-touch-icon.png`);
  expect(tamanhoPng(await apple.body())).toEqual([180, 180]);
});

test('ícones: fundo #202124 nas bordas e o logo desenhado no centro', async ({ page }) => {
  await gotoApp(page, '/home');
  for (const src of ['/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/icon-192.png']) {
    const r = await page.evaluate(async (s) => {
      const img = new Image();
      img.src = s;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
      // procura um pixel claro (o logo é #eaeaea) numa faixa central
      let claro = false;
      for (let x = Math.round(img.width * 0.3); x < img.width * 0.7 && !claro; x += 2) {
        const [r0, g0, b0] = px(x, Math.round(img.height / 2));
        if (r0 > 150 && g0 > 150 && b0 > 150) claro = true;
      }
      return { canto: px(1, 1), claro };
    }, src);
    expect(r.canto, src).toEqual([32, 33, 36]);
    expect(r.claro, src).toBe(true);
  }
});

test('index.html: manifest, theme-color, apple-touch-icon e capable', async ({ page }) => {
  await gotoApp(page, '/home');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#202124');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test('sem service worker', async ({ page }) => {
  await gotoApp(page, '/home');
  await page.waitForTimeout(500);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});
```

Run: `npm run e2e -- --project=desktop e2e/pwa.desktop.spec.mjs`
Expected: FAIL — `/manifest.webmanifest` cai no fallback do SPA (HTML, `res.json()` falha) e não há `<link rel="manifest">`.

- [ ] **Step 2: Script dos ícones**

Criar `bussola_web/scripts/gerar-icones-pwa.mjs`:

```js
// Gera os ícones do PWA a partir de src/assets/images/bussola.svg (logo #eaeaea sobre #202124).
// Rodar em bussola_web/:  node scripts/gerar-icones-pwa.mjs
// Usa o Chromium do @playwright/test (já instalado para o E2E). Os PNGs vão para public/icons/
// e são commitados; rode de novo só se o logo mudar.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const FUNDO = '#202124';
const svg = fs.readFileSync('src/assets/images/bussola.svg');
const src = `data:image/svg+xml;base64,${svg.toString('base64')}`;

// escala = largura do logo / lado do ícone (o logo é 919×825).
// Maskable: o logo inteiro dentro do círculo seguro (raio 40% do lado) → 56%.
const ICONES = [
  { arquivo: 'icon-192.png', lado: 192, escala: 0.78 },
  { arquivo: 'icon-512.png', lado: 512, escala: 0.78 },
  { arquivo: 'icon-maskable-512.png', lado: 512, escala: 0.56 },
  { arquivo: 'apple-touch-icon.png', lado: 180, escala: 0.72 },
];

const destino = path.resolve('public/icons');
fs.mkdirSync(destino, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { arquivo, lado, escala } of ICONES) {
    await page.setViewportSize({ width: lado, height: lado });
    await page.setContent(`<!doctype html><html><body style="margin:0;width:${lado}px;height:${lado}px;background:${FUNDO};display:grid;place-items:center">
      <img src="${src}" alt="" style="display:block;width:${Math.round(lado * escala)}px;height:auto"></body></html>`);
    await page.locator('img').evaluate((img) => img.decode());
    await page.screenshot({ path: path.join(destino, arquivo), clip: { x: 0, y: 0, width: lado, height: lado } });
    console.log(`ok ${arquivo} (${lado}x${lado})`);
  }
} finally {
  await browser.close();
}
```

Run: `node scripts/gerar-icones-pwa.mjs`
Expected: 4 linhas `ok …`; os 4 PNGs em `public/icons/`. **Abra os 4**: logo claro centralizado sobre `#202124`; no maskable o logo fica menor (sobra margem para o recorte circular do Android).

- [ ] **Step 3: Manifest**

Criar `bussola_web/public/manifest.webmanifest`:

```json
{
  "name": "Bússola",
  "short_name": "Bússola",
  "description": "Sistema operacional pessoal: finanças, agenda, registros, saúde e cofre.",
  "lang": "pt-BR",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#202124",
  "background_color": "#202124",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Links no `index.html`**

Em `bussola_web/index.html`, substituir:

```html
    <title>Bússola Hub</title>
```

por:

```html
    <title>Bússola Hub</title>

    <!-- PWA básico (sem service worker) -->
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#202124" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Bússola" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

- [ ] **Step 5: Rodar os testes e conferir o build**

Run: `npm run e2e -- --project=desktop e2e/pwa.desktop.spec.mjs` → Expected: 4 passed.
Run: `npm run build` e depois `Get-ChildItem dist/manifest.webmanifest, dist/icons` → Expected: o manifest e os 4 PNGs copiados para `dist/` (o Vite copia `public/` como está). Em `dist/index.html`, confira os `<link>`/`<meta>` do Step 4.
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/scripts/gerar-icones-pwa.mjs bussola_web/public/icons bussola_web/public/manifest.webmanifest bussola_web/index.html bussola_web/e2e/pwa.desktop.spec.mjs
git commit -m "feat(web): PWA basico (manifest, icones 192/512/maskable/apple gerados do logo, sem service worker)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Voltar do Android fecha o sheet de cima + verificação final

**Files:**
- Create: `bussola_web/src/utils/sheetHistory.js`, `bussola_web/src/hooks/useSheetHistory.js`, `bussola_web/e2e/voltar.mobile.spec.mjs`, `bussola_web/e2e/voltar.desktop.spec.mjs`
- Modify: `bussola_web/src/components/BaseModal.jsx`, `bussola_web/src/components/Navbar/MoreSheet.jsx`, `bussola_web/src/components/Navbar/index.jsx`

**Interfaces:**
- Produces:
  - `registrarSheet(fechar: () => void): () => void` — empilha (numa microtarefa) uma entrada de histórico na mesma URL com `history.state.__sheet = "<sessão>:<n>"`; devolve a função de saída.
  - `navegarFechandoSheet(navigate, to)` — `navigate(to, { replace: <há entrada de sheet no topo> })`.
  - `useSheetHistory(ativo: boolean, onClose)` — usado pelo `BaseModal` com `ativo = isMobile`.

**Desenho (por que não o "push + popstate + back" ingênuo):**
- O ingênuo quebra quando o sheet fecha **e** navega no mesmo handler (tile do "Mais": `onClose(); navigate(to)`): o `history.back()` é assíncrono, o `navigate` empilha `/cofre` antes, e a volta atrasada desfaz o `/cofre` → a página errada.
- Aqui: (1) **fechar pelo app não faz `back()` na hora**: um `setTimeout(0)` confere se a entrada do sheet **ainda é o topo**; só então faz `back()`. Se o app navegou nesse meio-tempo, a entrada fica "órfã" embaixo da nova rota. (2) **Entradas órfãs são puladas**: quando o Voltar do usuário cai numa entrada marcada que não pertence a nenhum sheet aberto, o handler chama `back()` de novo. (3) **Nenhuma órfã nos caminhos conhecidos**: o "Mais" (tiles e Sair) usa `navegarFechandoSheet`, que **substitui** a entrada do sheet pela rota nova. (4) No `popstate`, fecha (de cima para baixo) os sheets empilhados **depois** da entrada em que o navegador parou — pelo número da entrada, não por contagem (funciona com aninhados e com as órfãs). (5) A entrada é empilhada numa **microtarefa** cancelável: o StrictMode (dev) monta → desmonta → remonta no mesmo tick, e só a montagem que sobrevive empilha. (6) Enquanto há entrada de sheet, `history.scrollRestoration = 'manual'`: o `pushState` acontece com o `body` travado (`position: fixed`, `scrollY = 0`) e a restauração automática levaria a página ao topo ao voltar; o `unlockScroll` já devolve a posição certa.
- Limites aceitos: o `ConfirmDialog` e o `UserDrawer` não usam `BaseModal` (o Voltar não os fecha; navega); avançar (Forward) por cima de uma órfã volta de novo (só acontece se algum fluxo fechar e navegar sem `navegarFechandoSheet`); um `navigate()` **assíncrono** disparado poucos ms depois de fechar um sheet pode correr com o `back()` atrasado (nenhum fluxo atual faz isso).

- [ ] **Step 1: Testes que falham**

Criar `bussola_web/e2e/voltar.mobile.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

// Voltar do Android/navegador (mesma traversal do botão físico).
const voltar = (page) => page.evaluate(() => window.history.back());
const marca = (page) => page.evaluate(() => window.history.state?.__sheet ?? null);
const nav = (page) => page.getByRole('navigation', { name: 'Navegação principal' });
const mais = (page) => page.locator('.more-sheet');

async function irParaPanorama(page) {
  await gotoApp(page, '/financas');
  await nav(page).getByText('Panorama', { exact: true }).click();
  await expect(page).toHaveURL(/\/panorama$/);
}

test('Voltar fecha o sheet "Mais" e fica na rota; o próximo Voltar navega', async ({ page }) => {
  await irParaPanorama(page);
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await expect(mais(page)).toBeVisible();
  await expect.poll(() => marca(page)).not.toBeNull();
  await voltar(page);
  await expect(mais(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/panorama$/);
  await expect.poll(() => marca(page)).toBeNull();
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('sheets aninhados: um Voltar fecha só o de cima', async ({ page }) => {
  await gotoApp(page, '/__ui');
  await page.getByRole('button', { name: 'Abrir modal longo' }).click();
  await page.getByRole('button', { name: 'Abrir sheet aninhado' }).click();
  const aninhado = page.locator('.app-sheet-overlay');
  await expect(aninhado).toBeVisible();
  await voltar(page);
  await expect(aninhado).toHaveCount(0);
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(1);
  await voltar(page);
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  await expect(page).toHaveURL(/\/__ui$/);
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
  await expect.poll(() => marca(page)).toBeNull();
});

test('tile do "Mais" navega para a rota certa, sem entrada órfã', async ({ page }) => {
  await irParaPanorama(page);
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await mais(page).getByText('Cofre', { exact: true }).click();
  await expect(page).toHaveURL(/\/cofre$/);
  await expect(mais(page)).toHaveCount(0);
  await page.waitForTimeout(200); // passa o tick da checagem do fechamento
  await expect(page).toHaveURL(/\/cofre$/);
  await voltar(page);
  await expect(page).toHaveURL(/\/panorama$/);
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('fechar pelo X remove a entrada do sheet (o Voltar seguinte navega)', async ({ page }) => {
  await irParaPanorama(page);
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await expect.poll(() => marca(page)).not.toBeNull();
  await mais(page).getByRole('button', { name: 'Fechar' }).click();
  await expect(mais(page)).toHaveCount(0);
  await expect.poll(() => marca(page)).toBeNull();
  await expect(page).toHaveURL(/\/panorama$/);
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('Voltar sem sheet navega normalmente', async ({ page }) => {
  await gotoApp(page, '/financas');
  await nav(page).getByText('Registros', { exact: true }).click();
  await expect(page).toHaveURL(/\/registros$/);
  expect(await marca(page)).toBeNull();
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('ação do ActionSheet que abre outro sheet: um Voltar fecha o segundo e o próximo navega', async ({ page }) => {
  await gotoApp(page, '/financas');
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await mais(page).getByText('Cofre', { exact: true }).click();
  await expect(page).toHaveURL(/\/cofre$/);
  await page.locator('.cofre-m-mais').first().click();
  await page.locator('.action-sheet').getByRole('button', { name: 'Editar' }).click();
  const form = page.locator('.modal-overlay.is-sheet', { has: page.locator('.locked-input-wrapper') });
  await expect(form).toBeVisible();
  await voltar(page);
  await expect(form).toHaveCount(0);
  await expect(page.locator('.action-sheet')).toHaveCount(0);
  await expect(page).toHaveURL(/\/cofre$/);
  await expect.poll(() => marca(page)).toBeNull();
  await voltar(page);
  await expect(page).toHaveURL(/\/financas$/);
});

test('Voltar (e o X) fecham o sheet mantendo a rolagem da página', async ({ page }) => {
  await gotoApp(page, '/__ui');
  await page.evaluate(() => window.scrollTo(0, 300));
  // dispatchEvent: um click() rolaria o botão (fora da tela) de volta ao topo
  await page.getByRole('button', { name: 'Abrir modal longo' }).dispatchEvent('click');
  await expect.poll(() => marca(page)).not.toBeNull();
  await voltar(page);
  await expect(page.locator('.modal-overlay.is-sheet')).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(300);
  await page.getByRole('button', { name: 'Abrir modal longo' }).dispatchEvent('click');
  await expect.poll(() => marca(page)).not.toBeNull();
  await page.locator('.modal-overlay.is-sheet').getByRole('button', { name: 'Fechar' }).first().click();
  await expect.poll(() => marca(page)).toBeNull();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(300);
});

test('nenhuma página deixa entrada de sheet ao carregar', async ({ page }) => {
  for (const rota of ['/home', '/panorama', '/financas', '/agenda', '/registros', '/estudos', '/ritmo', '/cofre']) {
    await gotoApp(page, rota);
    await page.waitForTimeout(150);
    expect(await marca(page), rota).toBeNull();
  }
});

test('Sair pelo "Mais" vai para o login sem deixar entrada de sheet', async ({ page }) => {
  // O logout de verdade põe o refresh token do demo na blacklist e quebraria os outros testes
  // (todos usam o mesmo e2e/.auth/state.json): a chamada é interceptada.
  await page.route(/\/api\/v1\/auth\/logout$/, (r) => r.fulfill({ status: 200, json: {} }));
  await irParaPanorama(page);
  await nav(page).getByRole('button', { name: 'Mais' }).click();
  await mais(page).getByText('Sair', { exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.waitForTimeout(200);
  expect(await marca(page)).toBeNull();
});
```

Criar `bussola_web/e2e/voltar.desktop.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.mjs';

test('desktop: modal não empilha histórico e o Voltar navega como antes', async ({ page }) => {
  await gotoApp(page, '/financas');
  await page.locator('aside.sidebar').getByRole('link', { name: 'Cofre' }).click();
  await expect(page).toHaveURL(/\/cofre$/);
  await page.getByRole('button', { name: 'Guardar Segredo' }).click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.history.state?.__sheet ?? null)).toBeNull();
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/financas$/);
});
```

Run: `npm run e2e -- --project=mobile e2e/voltar.mobile.spec.mjs` e `npm run e2e -- --project=desktop e2e/voltar.desktop.spec.mjs`
Expected: mobile FAIL — o Voltar navega para `/financas` com o "Mais" aberto e nunca há marca no `history.state`. Desktop passa (comportamento atual que deve ficar).

- [ ] **Step 2: Pilha de entradas de sheet**

Criar `bussola_web/src/utils/sheetHistory.js`:

```js
// Botão Voltar (Android / navegador) fecha o sheet de cima no celular, sem brigar com o
// react-router (BrowserRouter, sem useBlocker).
//
// Cada sheet aberto empilha uma entrada de histórico na MESMA URL, com uma marca em
// history.state (o resto do state do router é copiado, inclusive `idx`).
// - Voltar do usuário (popstate): fecha os sheets empilhados depois da entrada em que o
//   navegador parou (normalmente só o de cima).
// - Fechar pelo app (X, overlay, ESC, ação): a entrada sai com history.back(), mas só se ela
//   ainda estiver no topo um tick depois. Se o app navegou (push) no mesmo tick, a entrada fica
//   "órfã" embaixo da nova rota; quando o Voltar chegar nela, ela é pulada.
// - Para navegar a partir de um sheet sem deixar órfã, use navegarFechandoSheet: a rota nova
//   SUBSTITUI a entrada do sheet.
// - Enquanto houver entrada de sheet, a restauração de rolagem do navegador fica manual: o
//   pushState acontece com o body travado (scrollY 0) e o scrollLock já devolve a posição.

const MARCA = '__sheet';
// Distingue entradas desta carga da página das de uma carga anterior (recarregar com um sheet aberto).
const SESSAO = Math.random().toString(36).slice(2, 8);
let seq = 0;
const pilha = []; // [{ token, n, fechar }] na ordem em que as entradas foram empilhadas
let instalado = false;
let restauracaoAnterior = null;

function tokenAtual() {
    return window.history.state?.[MARCA] ?? null;
}

// Número da entrada nesta sessão; entradas de outra carga contam como as mais antigas.
function numero(token) {
    const [sessao, n] = String(token).split(':');
    return sessao === SESSAO ? Number(n) : -1;
}

function travarRestauracao() {
    if (restauracaoAnterior !== null || !('scrollRestoration' in window.history)) return;
    restauracaoAnterior = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
}

function liberarRestauracao() {
    if (restauracaoAnterior === null || pilha.length > 0 || tokenAtual() !== null) return;
    window.history.scrollRestoration = restauracaoAnterior;
    restauracaoAnterior = null;
}

function aoPopState() {
    const atual = tokenAtual();
    const limite = atual === null ? -1 : numero(atual);
    // Fecha, de cima para baixo, os sheets cujas entradas ficaram acima de onde o navegador parou.
    while (pilha.length > 0 && pilha[pilha.length - 1].n > limite) {
        pilha.pop().fechar();
    }
    if (atual !== null && !pilha.some((r) => r.token === atual)) {
        window.history.back(); // entrada órfã (o sheet dela já fechou): pula
        return;
    }
    liberarRestauracao();
}

function instalar() {
    if (instalado) return;
    instalado = true;
    window.addEventListener('popstate', aoPopState);
}

/** Registra um sheet aberto; devolve a função a chamar quando ele fechar/desmontar. */
export function registrarSheet(fechar) {
    instalar();
    const reg = { token: null, n: 0, fechar, empilhado: false, cancelado: false };
    // Microtarefa: no StrictMode (dev) o efeito monta, desmonta e remonta no mesmo tick;
    // só a montagem que sobrevive empilha a entrada.
    queueMicrotask(() => {
        if (reg.cancelado) return;
        seq += 1;
        reg.n = seq;
        reg.token = `${SESSAO}:${seq}`;
        travarRestauracao();
        window.history.pushState({ ...window.history.state, [MARCA]: reg.token }, '');
        reg.empilhado = true;
        pilha.push(reg);
    });
    return () => {
        reg.cancelado = true;
        if (!reg.empilhado) return;
        const i = pilha.indexOf(reg);
        if (i === -1) return; // já fechado pelo Voltar
        pilha.splice(i, 1);
        // Um tick depois: se a entrada ainda é o topo (ninguém navegou), sai com back().
        window.setTimeout(() => {
            if (tokenAtual() === reg.token) window.history.back();
            else liberarRestauracao();
        }, 0);
    };
}

/** Navega a partir de um sheet aberto sem deixar entrada órfã (a rota nova substitui a do sheet). */
export function navegarFechandoSheet(navigate, to) {
    navigate(to, { replace: tokenAtual() !== null });
}
```

- [ ] **Step 3: Hook e ligação no `BaseModal`**

Criar `bussola_web/src/hooks/useSheetHistory.js`:

```js
import { useEffect, useRef } from 'react';
import { registrarSheet } from '../utils/sheetHistory';

/** Enquanto `ativo`, o Voltar do navegador/Android fecha este modal/sheet (chama `onClose`). */
export function useSheetHistory(ativo, onClose) {
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });
    useEffect(() => {
        if (!ativo) return undefined;
        return registrarSheet(() => onCloseRef.current());
    }, [ativo]);
}
```

Em `bussola_web/src/components/BaseModal.jsx`:

1. Substituir:
```jsx
import { lockScroll, unlockScroll } from '../utils/scrollLock';
```
por:
```jsx
import { lockScroll, unlockScroll } from '../utils/scrollLock';
import { useSheetHistory } from '../hooks/useSheetHistory';
```

2. Substituir:
```jsx
    const isMobile = useIsMobile();
```
por:
```jsx
    const isMobile = useIsMobile();
    // Celular: o Voltar (Android/navegador) fecha o modal/sheet de cima.
    useSheetHistory(isMobile, onClose);
```

- [ ] **Step 4: "Mais" e Sair navegam substituindo a entrada do sheet**

Em `bussola_web/src/components/Navbar/MoreSheet.jsx`:

1. Substituir:
```jsx
import { NAV_ITEMS } from './navItems';
```
por:
```jsx
import { NAV_ITEMS } from './navItems';
import { navegarFechandoSheet } from '../../utils/sheetHistory';
```

2. Substituir:
```jsx
    const go = (to) => { onClose(); navigate(to); };
```
por:
```jsx
    // A rota nova substitui a entrada de histórico do sheet (sem corrida com o Voltar).
    const go = (to) => { onClose(); navegarFechandoSheet(navigate, to); };
```

Em `bussola_web/src/components/Navbar/index.jsx`:

1. Substituir:
```jsx
import { AiMobilePanel } from '../AiAssistant/AiInsightPanel';
```
por:
```jsx
import { AiMobilePanel } from '../AiAssistant/AiInsightPanel';
import { navegarFechandoSheet } from '../../utils/sheetHistory';
```

2. Substituir:
```jsx
    const sairMobile = () => { logout(); navigate('/login'); };
```
por:
```jsx
    const sairMobile = () => { logout(); navegarFechandoSheet(navigate, '/login'); };
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run e2e -- --project=mobile e2e/voltar.mobile.spec.mjs` → Expected: 9 passed. Se "nenhuma página deixa entrada de sheet ao carregar" falhar numa rota, há um `BaseModal` montado sempre (escondido por CSS) nessa página: faça a página só renderizá-lo quando aberto.
Run: `npm run e2e -- --project=mobile` → Expected: tudo passa (inclui `ui-lab` "scroll lock aninhado", `shell` "Mais" → Ritmo, Provisões/Registros/Cofre/Estudos com seus sheets).
Run: `npm run e2e -- --project=desktop` → Expected: tudo passa, inclui `voltar.desktop.spec.mjs`.
Run: `npm run e2e -- --project=tablet` → Expected: tudo passa (tablet não registra entradas: `isMobile` é falso).

- [ ] **Step 6: Suíte completa, build e lint**

Run: `npm run e2e` → Expected: tudo passa nos 3 projetos.
Run: `npm run build` → Expected: OK; `dist/manifest.webmanifest` e `dist/icons/` presentes.
Run: `npx eslint src/utils/sheetHistory.js src/hooks/useSheetHistory.js src/components/BaseModal.jsx src/components/Navbar src/components/AdminUserModal.jsx src/pages/Login src/pages/Auth src/pages/Home` → Expected: só os pré-existentes (`Navbar/index.jsx:62`, `DiscordLink.jsx`, `VerifyEmail.jsx`, `Home/index.jsx`).
Run: `npm run lint 2>&1 | Select-String " error " | Measure-Object` → Expected: contagem **1 menor** que a de antes do plano (o `catch (error)` do Login); registre os dois números na mensagem do commit.

- [ ] **Step 7: Conferência visual (360, 390, 430 e 900px)**

Tire screenshots (script rápido em `test-results/` com `page.screenshot({ fullPage: true })`, contexto deslogado para as públicas, `semGoogle` + `cadastroAberto`) de `/login`, `/register`, `/forgot-password`, `/verify-email`, `/register-success`, `/home` e do sheet "Novo Usuário" em 360, 390 e 430, e **abra as imagens**:
- Login/Registro: card no topo com 16px de gutter, logo de 56px + título na mesma linha com 12px, campos com 16px entre si, "Esqueceu a senha?" alinhado à direita com 44px de altura, botão gradiente de 48px; o título "Encontre o seu Norte" pequeno e centralizado abaixo do card, sem ilustração; nada de barra lateral colorida;
- Auth: card de largura total (16px), cinza de card sobre o fundo, botões de 48px, 24px entre cabeçalho e formulário;
- Início: hero com 16px laterais, h1 em ~39px (390) quebrando sem estourar, subtítulo e horário à esquerda; features com imagem acima do texto, parágrafos com a barra azul à esquerda (inclusive Registros/Cofre), links "Explorar…" com 44px; Panorama com botão de largura total; notícias em 1 coluna com 12px entre cards;
- Admin: um único fundo escuro, sheet do rodapé com cabeçalho "Novo Usuário (Admin)" e ✕ de 44px, campos de 48px com 16px entre si, Cancelar/Criar 50/50;
- 900px: Login com a ilustração empilhada acima (regra ≤900 existente) e páginas sem estourar.
Qualquer valor fora da escala ou desalinhado: corrija o CSS e repita.

- [ ] **Step 8: Commit**

```bash
git add bussola_web/src/utils/sheetHistory.js bussola_web/src/hooks/useSheetHistory.js bussola_web/src/components/BaseModal.jsx bussola_web/src/components/Navbar bussola_web/e2e/voltar.mobile.spec.mjs bussola_web/e2e/voltar.desktop.spec.mjs
git commit -m "feat(web): Voltar do Android fecha o sheet de cima (entradas na mesma URL, orfas puladas, Mais substitui a entrada)" -m "lint: <antes> -> <depois> erros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Decisões e suposições registradas neste plano

- **D1 — o app cai sem `VITE_GOOGLE_CLIENT_ID`** (a confirmar pelo diagnóstico da Task 1 Step 1): o `Login` chamava `useGoogleLogin` sempre; quando o GSI carrega, `initTokenClient` sem `client_id` lança e o `ErrorBoundary` derruba a página, mesmo em SELF_HOSTED (onde o botão nem aparece). Decidi **corrigir no app** (botão isolado, montado só com SaaS + client id), além de dar ao teste um client id falso. Sem efeito visual; produção (que tem a variável) não muda. Se o controlador preferir não mexer no app, basta pular a Step 5 da Task 1 (o resto do plano não depende dela).
- **Toggle de tema no Login:** não existe nenhum na tela pública (`.standalone-theme-toggle` está no CSS, mas nenhum componente o usa; o Navbar não renderiza nas rotas públicas). O item "o toggle não sobrepõe o conteúdo" da spec §5.7 não tem o que corrigir; o CSS morto fica (fora do escopo).
- **Escopo do `Auth/styles.css` preservando o desktop:** os efeitos que realmente vazavam (medidos na cascata) foram para `components.css` com o mesmo efeito; o hover do `.btn-primary` passou a valer só com mouse (antes ficava "preso" depois do toque). O teste "efeitos globais preservados" e as bases do desktop provam a igualdade.
- **Telas de status (Verify, Cadastro enviado, Discord) mudam no desktop de propósito:** as variáveis inexistentes deixavam o card transparente e sem borda; agora usam `--cor-card-principal`/`--cor-borda`/`--cor-fundo`. Ganham base nova (Task 2). `--cor-texto-terciario` (também inexistente) continua no Login ("Cadastro fechado…") para não mudar `login.png`; no Cadastro enviado virou `--cor-texto-secundario`.
- **Login no celular:** o título da intro fica (pequeno, abaixo do card); só parágrafo e ilustração somem (spec §5.7). Tablet 769–900 mantém o empilhamento atual (intro primeiro).
- **`apple-mobile-web-app-status-bar-style = black`** (barra preta com o conteúdo abaixo dela). `black-translucent` poria o conteúdo sob a barra e exigiria `safe-top` em todas as telas públicas.
- **`start_url = "/"`** (o `/` exige login e cai no Início). Sem `orientation` (tablet em paisagem continua).
- **MIME do `.webmanifest` em produção:** o `nginx:alpine` atual mapeia `webmanifest` → `application/manifest+json`; se uma imagem antiga não mapear, o Chrome aceita o manifest mesmo assim. Não mudei o `nginx.conf`.
- **Voltar do Android só no celular (≤768)**, via `BaseModal`; tablet/desktop não empilham entradas. `ConfirmDialog` e `UserDrawer` (que não usam `BaseModal`) não fecham com o Voltar — o Voltar navega como hoje. Avançar (Forward) por cima de uma entrada órfã volta de novo; o usuário só vê isso se um fluxo fechar um sheet e navegar sem `navegarFechandoSheet` (nenhum dos conhecidos).
- **Testes de Voltar usam `history.back()` via `page.evaluate`** (mesma traversal do botão físico do Android; o `page.goBack()` do Playwright espera navegação e é instável em entradas na mesma URL).
- **O teste "ActionSheet → outro sheet" usa o Cofre** do plano 07 (lista com "⋯" e `SegredoModal` em sheet), que já estará implementado.

## Rulings do controlador (vinculantes)

- **D1 (crash do Login sem client id):** **aceito** — mover o botão do Google para um componente próprio que não quebra a página sem `VITE_GOOGLE_CLIENT_ID`; produção (com client id) deve continuar idêntica.
- **Voltar do Android:** desenho proposto **aceito** (entrada no histórico com marcador por sheet, `back()` só se ainda no topo um tick depois, entradas órfãs puladas, tiles do "Mais"/Sair com `replace`, scroll restoration manual enquanto houver entrada de sheet). Executar como **última** task; se após os testes o fluxo de navegação real ficar instável (qualquer flake em 3 execuções), reverter a task e registrar — não bloquear o resto.
- Login sem toggle de tema (nada a corrigir); verify-email/register-success mudam no desktop de propósito (variáveis inexistentes deixavam o card invisível) com novas bases; teste do "Sair" interceptando o logout para não invalidar o token compartilhado: **aceitos**.
