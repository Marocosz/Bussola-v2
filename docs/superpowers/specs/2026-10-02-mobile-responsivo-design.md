# Bússola Mobile — Responsividade e redesign de layout (design)

- **Data:** 2026-10-02
- **Branch / worktree:** `feat/mobile-responsivo` em `.claude/worktrees/mobile-responsivo`
- **Escopo:** somente `bussola_web/` (frontend). Nenhuma mudança de API.
- **Entrega:** todas as etapas na branch, um commit por etapa, merge único em `main` no fim (main faz auto-deploy no Coolify).

## 1. Objetivo

Usar o Bússola no celular hoje é ruim: conteúdo cortado, botões principais inacessíveis, formulários que não rolam, textos e alvos de toque minúsculos. O objetivo não é só "fazer caber". É **redesenhar o layout de cada página para o celular** com padrões mobile atuais (barra inferior, bottom sheets, FAB, listas no lugar de tabelas, ações por toque), mantendo a identidade visual do app.

**Sucesso significa:**
- Zero overflow horizontal em 360, 390, 430 e 768px em todas as páginas.
- Toda ação primária alcançável com o polegar em até 2 toques.
- Nenhuma ação ou informação disponível só via hover.
- Todo formulário utilizável com o teclado aberto (o rodapé com Salvar sempre visível).
- Desktop (≥1025px) visualmente igual ao atual.

## 2. Restrições do usuário (não negociáveis)

1. **Manter a identidade visual:** tema dark/light, azul `#4A6DFF` e roxo `#a855f7`, Poppins, o "vidro" do Panorama.
2. **Não redesenhar os cards existentes:** card de nota (selo flutuante), compromisso (selo + tag de status), meta, categoria, plano/treino/refeição do Ritmo e widgets do Panorama. Dentro dos cards só se ajusta espaçamento, quebra de linha, alvos de toque e ações visíveis.
3. **Usar exatamente os ícones Font Awesome já usados no código.** Não trocar ícones. Navegação: `fa-chart-pie` Panorama, `fa-wallet` Provisões, `fa-calendar-days` Roteiro, `fa-book` Registros, `fa-dumbbell` Ritmo, `fa-vault` Cofre, `fa-house` Início; IA = `fa-robot`. Os rótulos seguem os do app (Provisões, Roteiro).
4. **Cuidado com o espaçamento** entre informações e entre cards. Usar uma escala fixa (seção 4.1), verificada em screenshot.

## 3. Diagnóstico (resumo da auditoria)

A auditoria juntou 5 revisões de código e screenshots reais em 390px, com o backend local e dados demo. Os problemas vêm de causas transversais:

| # | Causa | Exemplo medido |
|---|---|---|
| 1 | `.container` com 20px + `max-width: 90%` em `.page-header` e nos wrappers deixa ~300px úteis de 390 | todas as páginas |
| 2 | Toolbars e cabeçalhos com `nowrap` | toolbar de Finanças com 684px, Registros 511px, Agenda 366px: "Adicionar" fica fora da tela |
| 3 | `.app-content { overflow-x: clip }` esconde o overflow em vez de rolar | as ações somem sem aviso |
| 4 | Grids que não colapsam | spans inline no Panorama, `1fr 1fr` fixo no Ritmo, tabela de 630px no Cofre |
| 5 | Modais com `overflow: visible !important`, `90vh` e centralizados | os forms de recorrente/parcelada (~790px) e o HabitoModal não rolam |
| 6 | CSS global sem escopo, dependente da ordem de import | `.modal`, `.form-input` e `.form-row` vêm de `Agenda/styles.css`; `.auth-container` colide entre Login e Auth |
| 7 | Hover-only | editar/excluir de nota, hábito e grupo ficam invisíveis mas clicáveis; tooltips (`Tooltip.jsx`) não funcionam no toque; o donut do Panorama não tem legenda |
| 8 | Alvos de 22–32px, inputs abaixo de 16px (zoom do iOS), textos de 9–11px | `.btn-action-icon` 32px, `.close-btn` ~24px |
| 9 | Navegação: topbar não fixa + hambúrguer no canto superior direito, e o FAB do robô sobre o conteúdo | todas as páginas |
| 10 | Sem tokens de espaçamento, tipografia, breakpoint e z-index; sem `dvh` e safe-area | 13 breakpoints diferentes; z-index de 98 a 100000 |

**Piores casos por página:**
- **Finanças:** a linha de transação dá largura zero ao título, e o valor fica por baixo dos botões.
- **Ritmo:** a faixa de 7 chips é ilegível, os painéis ficam lado a lado com ~150px cada, e os builders de Treino (6 colunas) e Dieta (8 colunas inline) são inutilizáveis.
- **Registros:** abas e ações vazam da tela, o kanban não tem snap e o drag sequestra o scroll.
- **Agenda:** o calendário fica depois da lista inteira, e o tooltip do dia só existe no hover.
- **Panorama:** o grid vaza, o hero estoura e há ~500px de cards "Sem aviso aqui".
- **Cofre:** as ações ficam na última coluna da tabela, fora da tela.

**Bugs encontrados de passagem (corrigir junto):**
- O limpar-clipboard de 60s do Cofre falha no Safari, mas o toast diz que limpou.
- O Font Awesome é carregado 2 vezes (CDN em `index.html` + npm em `main.jsx`).
- `global.css` é importado 2 vezes.
- Há referências a variáveis CSS inexistentes (`--cor-fundo-principal`, `--cor-fundo-card`, `--cor-borda-suave`, `--cor-texto-primario`).

**CSS morto** a remover antes de mexer (~1000 linhas):
- Registros: lista antiga de tarefas, Quill, `.registros-layout`.
- Panorama: o `styles.css` v1 e os não usados `PanoramaModals.jsx` e `KpiCard.jsx`.
- Finanças: `.categoria-card` e `.category-grid`.

## 4. Fundação

### 4.1 Tokens (`src/assets/styles/tokens.css`, importado antes de `global.css`)

- **Breakpoints:**
  - `≤480`: celular pequeno.
  - `≤768`: **layout mobile**.
  - `769–1024`: tablet.
  - `≥1025`: desktop.
  
  São usados como valores literais nos `@media`, documentados no topo do arquivo.
- **Espaçamento:** `--sp-1:4px --sp-2:8px --sp-3:12px --sp-4:16px --sp-5:24px --sp-6:32px`.
  - 8 entre elementos relacionados dentro de um card.
  - 12 entre cards de uma lista.
  - 24 entre seções.
  - Gutter lateral mobile: 16px.
- **Tipografia mobile:** corpo 14px, secundário 12px, mínimo absoluto 11px (só rótulos em caixa alta). Inputs, selects e textareas com 16px.
- **z-index:** `--z-nav:100 --z-fab:110 --z-drawer:200 --z-sheet:300 --z-popover:400 --z-toast:500`. Todos os valores soltos atuais migram para esses tokens.
- **Safe area:** `--safe-bottom: env(safe-area-inset-bottom)` e `--bottom-nav-h: 64px`. O conteúdo das páginas recebe `padding-bottom: calc(var(--bottom-nav-h) + var(--safe-bottom) + 16px)` no mobile.
- `index.html`: viewport com `viewport-fit=cover`. Todo `100vh/90vh/85vh/75vh` vira `dvh`, com fallback em `vh`.

### 4.2 Regras globais de toque (`global.css`, bloco mobile)

- Em `@media (pointer: coarse)`, botões de ícone e controles têm no mínimo 44×44. Se o visual precisar ser menor, usa-se hit-area via `::after`.
- `@media (max-width: 768px) { input, select, textarea { font-size: 16px } }`.
- Efeitos de hover (lift, translate, reveal) só em `@media (hover: hover) and (pointer: fine)`. Fora disso, ações que hoje aparecem no hover ficam **sempre visíveis**.
- `Tooltip.jsx` só registra listeners quando `matchMedia('(hover: hover)')` casa. Informação que hoje só existe em tooltip ganha alternativa visível (legenda, texto auxiliar ou toque).
- `prefers-reduced-motion` pausa as animações infinitas (cubo, bolhas, pulses).

### 4.3 Higiene de CSS (pré-requisito)

- Remover o CSS e os componentes mortos listados na seção 3.
- Mover os primitivos compartilhados (`.modal*`, `.form-row`, `.form-group`, `.form-input`, `.btn-action-icon`, `.close-btn`) para `src/assets/styles/components.css`, com uma definição única. As páginas param de redefini-los sem escopo. `Agenda/styles.css`, `UserDrawer/styles.css` e `Auth/styles.css` passam a escopar o que é deles.
- Renomear e escopar `.auth-container` / `.auth-card` (Login vs Auth).
- Remover os `<link>` de CDN do Font Awesome e weather-icons do `index.html` (fica a versão npm) e o import duplicado de `global.css`.
- Corrigir as variáveis CSS inexistentes.

### 4.4 Primitivos novos (`src/components/mobile/`)

| Unidade | Responsabilidade | Interface |
|---|---|---|
| `useIsMobile()` (`src/hooks/useIsMobile.js`) | `matchMedia('(max-width: 768px)')` reativo | retorna `boolean` |
| `<MobileTopbar title actions?>` | topbar fina e sticky: título grande, ações da página, `fa-robot` (abre a IA), avatar (abre a conta) | slot `actions` para ícones extras (ex.: `fa-calendar-days` no Roteiro) |
| `<BottomNav>` | barra clássica fixa no rodapé (ícone + rótulo, pílula no ativo) com Panorama, Provisões, Roteiro, Registros e Mais; respeita `--safe-bottom` | sem props; lê a rota. Em Ritmo, Cofre e Início, o item "Mais" fica ativo |
| `<MoreSheet>` | sheet do "Mais": grade com Início, Estudos, Ritmo e Cofre, mais a lista Minha Conta (perfil, cor, conexões MCP), Tema, Novo Usuário (admin) e Sair | aberto pela BottomNav |
| `<Sheet open onClose title? footer? fullScreen?>` | bottom sheet com alça, `max-height: 92dvh`, corpo rolável, rodapé fixo com safe-area, travamento de scroll que funciona no iOS (`position: fixed` no body + restaurar o scroll) e suporte a sheets aninhados | `fullScreen` para editores e builders |
| `<ActionSheet title subtitle? actions>` | lista de ações (uma primária em destaque e as destrutivas em vermelho) | `actions: [{icon, label, onClick, variant}]` |
| `<Fab icon onClick label>` | botão "+" da página no canto inferior direito, acima da BottomNav | um por página |

**Integração com o que existe:**
- `BaseModal` passa a renderizar `<Sheet>` quando `useIsMobile()`, então todos os modais existentes viram sheet sem mexer em cada chamada. Os modais grandes (editor de nota, builders, detalhe de tarefa, Metas) usam `fullScreen`.
- `DatePicker`, `TimePicker`, `CustomSelect` e `DateRangeFilter` renderizam o painel dentro de um `<Sheet>` no mobile (em portal), em vez do popover absoluto. Isso resolve o corte dentro de modais rolando e o vazamento pelas bordas.
- `ConfirmDialog` ancora no rodapé no mobile, com botões de largura total.
- Toasts ficam acima da BottomNav: `bottom: calc(var(--bottom-nav-h) + var(--safe-bottom) + 8px)`.

### 4.5 Shell (`routes/index.jsx` → `PrivateRoute`)

- **Mobile (≤768):**
  - a sidebar/hambúrguer atual não renderiza;
  - `PrivateRoute` renderiza `<BottomNav>`;
  - cada página renderiza sua `<MobileTopbar>` no lugar do `.page-header`, que fica só no desktop/tablet.
- **AiAssistant:**
  - no mobile, o FAB flutuante não aparece;
  - o `fa-robot` da topbar abre o assistente em `<Sheet fullScreen>`;
  - o canto inferior direito fica livre para o `<Fab>` "+".
- **UserDrawer:** no mobile, abre em tela cheia a partir do avatar ou do "Mais". O painel interno de cores usa `repeat(auto-fill, minmax(52px, 1fr))`.
- **Tablet (769–1024):** a sidebar atual em modo recolhido (só ícones), sem BottomNav; as páginas usam os ajustes de tablet (seção 5).
- **Desktop (≥1025):** inalterado.

### 4.6 PWA básico

- Um `public/manifest.webmanifest` com:
  - `name`: "Bússola", `short_name`: "Bússola";
  - `display: standalone`;
  - `theme_color` e `background_color` = `#202124`;
  - ícones 192/512 + maskable, gerados a partir de `src/assets/images/bussola.svg`.
- No `index.html`:
  - `<link rel="manifest">`;
  - `<meta name="theme-color">`;
  - `apple-touch-icon` e `apple-mobile-web-app-capable`.
- **Sem service worker** (sem offline; evita cache de dados sensíveis).

## 5. Páginas (layout mobile ≤768)

Gutter de 16px, a escala de espaçamento da seção 4.1, `<MobileTopbar>` no topo e `<Fab>` para a ação principal.

### 5.1 Provisões (Finanças), tela 2 aprovada (opção "Abas")

1. **Topbar:** "Provisões" + `fa-robot` + avatar.
2. **Faixa de KPIs** rolável horizontalmente (Disponível, Receitas, Despesas, Guardado quando > 0, Caixa). Tocar no Caixa abre o `CaixaModal` em sheet. As explicações que hoje estão em `title` aparecem ao tocar no chip.
3. **Abas segmentadas** Transações · Metas · Categorias (estado local; o desktop continua com o layout atual de 2 colunas e os cards de entrada).
4. **Aba Transações:**
   - busca + botão `fa-sliders` com contador de filtros ativos, que abre o **sheet de filtros** com chips para Tipo, Status, Pagamento, Categoria, Período (presets + personalizado) e Ordenar, e o botão "Ver N transações";
   - chips removíveis com os filtros ativos;
   - lista **agrupada por dia** (cabeçalho "Hoje · 02/10");
   - cada linha em 2 níveis: na linha 1, ícone da categoria (o atual), título com reticências e valor à direita; na linha 2, categoria · forma de pagamento. Pendente mostra o chip "Efetivar";
   - tocar na linha abre o `<ActionSheet>`: Efetivar (primária, quando pendente) / Editar / Ver parcelas ou histórico / Encerrar recorrência / Excluir;
   - a paginação vira "Carregar mais".
5. **`<Fab>` "+":** abre um `<ActionSheet>` com Pontual / Parcelada / Recorrente e, depois, o formulário em sheet. O formulário mostra o tipo em controle segmentado e o valor em destaque com `inputMode="decimal"`, com Salvar fixo no rodapé.
6. **Aba Metas:**
   - os `MetaCard` atuais em 1 coluna, com o resumo Disponível/Guardado/Total e a explicação visível;
   - "Nova meta" pelo `<Fab>` quando a aba está ativa;
   - Guardar/Retirar (`CofreScene`) e Histórico abrem em `<Sheet fullScreen>`. Na CofreScene, o pote fica menor ao lado do saldo, os chips têm 44px e o botão de confirmar fica fixo no rodapé. O Histórico tem um único scroll, com o eixo do gráfico em `dd/mm` e o BRL compacto;
   - o `MetasModal` continua sendo usado no desktop; no mobile, as views internas são reaproveitadas dentro da aba.
7. **Aba Categorias:** os `CategoryCard` atuais em lista, a toolbar Despesa/Receita em controle segmentado e "Nova categoria" pelo `<Fab>`. O seletor de ícone abre em sheet com 6 colunas.

### 5.2 Registros, tela 3 aprovada (kanban "uma coluna por vez")

1. **Topbar** "Registros" e abas segmentadas Caderno · Tarefas · Jornada, ocupando toda a largura.
2. **Caderno:**
   - busca de largura total e chips de grupo; o chip `fa-folder-open` "Grupos" abre um sheet de gestão de grupos, com editar/excluir visíveis;
   - "Fixados" no topo e os acordeões por grupo, com **o `AnotacaoCard` atual** em 1 coluna;
   - um "⋯" visível no card (Editar / Fixar / Excluir) no lugar do hover;
   - `<Fab>` para nova nota.
3. **Editor de nota (`AnotacaoModal`):**
   - `<Sheet fullScreen>` com a barra superior ✕ · fixar · preview · **Salvar**;
   - título, e o grupo como chip que abre um sheet;
   - a toolbar de formatação numa linha só, rolável, com botões de 40px, presa acima do teclado (`visualViewport`);
   - sem a dica de atalhos de teclado no mobile.
   
   O `ViewAnotacaoModal` também vira fullScreen, com as ações de copiar/PDF num "⋯".
4. **Tarefas:**
   - chips de status com contagem (A Fazer · Em Andamento · Bloqueado · Concluído · Cancelado) mostram **uma coluna por vez**, com swipe horizontal entre colunas (scroll-snap);
   - quick-add no topo da coluna;
   - **o card atual do board (`BoardCard`)** com um "⋯" que abre o `<ActionSheet>` (Abrir / Mover para… / Excluir);
   - drag só por toque longo: `MouseSensor` + `TouchSensor` (delay ~250ms, tolerance 5) no lugar do `PointerSensor`, com `touch-action` adequado;
   - busca e prioridade num sheet de filtro;
   - o `TarefaDetailPanel` vira `<Sheet fullScreen>`, sem autofocus, com status e prioridade como chips, subtarefas de 44px, indentação limitada a 12px por nível e Excluir no "⋯".
5. **Jornada:**
   - mantém o layout atual de coluna única (que já funciona abaixo de 900px);
   - adiciona a linha "data · X de Y hábitos" com barra de progresso;
   - círculos de check-in com 44px;
   - "⋯" visível (Editar / Pausar / Excluir) no lugar do hover;
   - `<Fab>` para novo hábito; "Lista" fica na topbar.

### 5.3 Roteiro (Agenda), tela 4 aprovada (opção "Faixa da semana")

1. **Topbar** "Roteiro" + `fa-calendar-days`, que abre o **calendário do mês atual** (o `.dias-grid` existente) num sheet; tocar num dia leva a faixa e a lista para aquela data.
2. **Faixa da semana:** 7 dias no estilo das células atuais do calendário (dia da semana, número e ponto quando há evento), com navegação ‹ › e swipe entre semanas. Hoje e o dia selecionado aparecem destacados.
3. Busca + ordenação em uma linha.
4. **Lista:** o cabeçalho do dia selecionado ("Hoje · Qui, 2 de outubro") e, depois, os próximos dias; **o `CompromissoCard` atual** em 1 coluna, com 12px entre cards e editar/excluir sempre visíveis com 44px.
   - O dia da semana do cabeçalho do card vai para baixo da data quando não cabe (≤480).
   - Corrigir a margem negativa da `.column-header-flex`, que vence a regra mobile por especificidade.
5. **`<Fab>`:** novo compromisso. O `AgendaModal` vira sheet, com Título e Data/Hora empilhados, o lembrete no corpo e o rodapé 50/50.
6. O tooltip de hover do dia é removido no mobile; a seleção por toque o substitui.

### 5.4 Panorama, tela 5 aprovada (opção "Cubo em cima")

1. **Hero:** o cubo (`Reservoir`) centralizado com ~150px, o rótulo "CAIXA · PATRIMÔNIO", o total centralizado com `clamp`, as barras Disponível/Guardado e o período + privacidade.
2. **KPIs em grade 2×2:** Receita, Despesa, Balanço, Poupança, com divisórias finas; Projeção numa linha inteira abaixo.
3. **Ordem dos widgets, empilhados em 1 coluna e mantendo o design atual:** Atenção agora → Orçamento por categoria → Cofrinhos & metas → Gastos por categoria → Evolução → Forma de pagamento → Média por dia → Ritmo / Produtividade / Agenda / Cofre.
4. **Atenção agora:** carrossel scroll-snap de 1 card por vez, **só com alertas reais** (sem os placeholders "Sem aviso aqui"), com dismiss de 44px.
5. **Gastos por categoria:** ganha uma **legenda visível** (nome, valor, %).
6. **Evolução:** 6 meses no mobile, com rótulos legíveis; tocar numa barra mostra os valores numa linha fixa.
7. Os spans de grid passam de inline (`style={{gridColumn}}`) para classes (`.span-4/6/8/12`), sobrescritas por media query: 6 colunas no tablet e largura total no mobile.

### 5.5 Ritmo, tela 6 aprovada (opção "Grade 2×4")

1. **Dados de bio:** os 7 chips atuais (Peso, Altura, % Gordura, Meta Calórica, TMB, Hidratação, Atividade), com os mesmos ícones, mais o "Ajustar perfil" numa **grade 2×4**.
2. Os painéis Volume semanal e Macros ficam empilhados, em largura total. Volume com a coluna de rótulo de 76px e blocos limitados (com muitos sets, vira barra contínua).
3. Abas Plano de Treino | Plano de Dieta; a biblioteca de planos numa faixa scroll-snap, com os mini-cards atuais e ações de 44px. "Novo treino" e "Nova dieta" pelo `<Fab>`.
4. Os cards de treino (`refeicao-card-pro`) e de refeição mantêm o design e as tabelas atuais, com padding de célula reduzido. O resumo de macros quebra linha (`flex-wrap`).
5. **Builders (`TreinoModal`, `DietaModal`):**
   - `<Sheet fullScreen>`;
   - os grids inline passam para classes;
   - no mobile, cada exercício ou alimento vira um bloco empilhado: o nome (e o grupo/busca) em largura total, e uma linha numérica abaixo (Sets/Min/Max, ou Qtd/Un + Kcal/P/C/G);
   - `inputMode` `numeric` ou `decimal`, remover com 44px e Salvar fixo no rodapé.
6. **BioModal:** coluna única, sugestões como texto auxiliar inline (sem tooltip de hover), `inputMode="decimal"`.

### 5.6 Cofre, tela 6 aprovada (opção "Lista compacta")

1. **Topbar** "Meu Cofre", busca, e a **lista compacta**: uma linha por segredo, com:
   - o ícone;
   - título e serviço, mais a validade em cor de alerta quando estiver perto;
   - o botão `fa-eye` (primário, 44px);
   - um "⋯" que abre o `<ActionSheet>` (Editar / Ver notas / Excluir).
   
   A tabela continua no desktop.
2. **`<Fab>`:** "Guardar segredo". O `SegredoModal` vira sheet, com campos empilhados, `autocomplete="new-password"`, `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}` e sem autofocus no toque.
3. **`ViewSecretModal`:**
   - o valor num bloco monoespaçado grande, com os botões Revelar e Copiar de 48px;
   - o clipboard é limpo **ao fechar**, além do timer, e o resultado da escrita é verificado;
   - o toast só afirma "limpo" quando a escrita deu certo, e os erros são tratados.

### 5.6b Estudos (módulo vindo de `feat/estudos`, mesclado nesta branch)

Estudos fica no "Mais" (`fa-graduation-cap`). As rotas são `/estudos` (biblioteca), `/estudos/:id` (leitura) e `/estudos/kit`. O layout mobile segue as mesmas regras (16px de gutter, cards atuais em 1 coluna, ações visíveis, sheets) e é detalhado no plano `mobile-08-estudos`, depois de ler a página real.

### 5.7 Login, Registro, Auth e Início

- **Login/Registro:** no mobile, o card do formulário vem primeiro, a ilustração e o parágrafo somem, e o padding vai para 16px. O toggle de tema deixa de sobrepor o conteúdo. As colisões de `.auth-container` e `.auth-card` são resolvidas (seção 4.3).
- **Auth (Forgot, Reset, Verify):** escopadas, com cards de largura total no mobile.
- **Início (Home):** empilhamento e tipografia (o h1 do hero com `clamp`); parágrafos alinhados à esquerda no mobile.

## 6. Tablet (769–1024)

- Sidebar recolhida (ícones).
- Grids de 2 colunas onde hoje há 3 ou 4.
- Finanças mantém as 2 colunas, com a coluna direita em ~320px; o cabeçalho da lista quebra linha; ações sempre visíveis quando `hover: none`.
- Agenda: grid de cards com 1 coluna dentro da coluna da lista.
- Panorama com `span-6`, e Evolução em largura total.

## 7. Ordem de implementação (commits na branch)

1. **Higiene:** CSS e componentes mortos, CDN e import duplicados, variáveis inexistentes, `components.css` com os primitivos de formulário/modal e os escopos de Agenda/UserDrawer/Auth.
2. **Fundação:** `tokens.css`, regras globais de toque, `dvh`, safe area, viewport, Tooltip só com hover, reduced motion.
3. **Primitivos e shell:** `useIsMobile`, `Sheet`, `ActionSheet`, `Fab`, `MobileTopbar`, `BottomNav`, `MoreSheet`; `BaseModal` → `Sheet`; pickers/selects em sheet; toasts e ConfirmDialog; AiAssistant em sheet; UserDrawer em tela cheia; sidebar recolhida no tablet.
4. Provisões + Metas + Categorias + Caixa.
5. Registros (Caderno, editor, Tarefas, Jornada).
6. Roteiro.
7. Panorama.
8. Ritmo (página + builders + BioModal).
9. Cofre.
10. Login/Registro/Auth/Início + PWA.

Cada etapa termina com a verificação da seção 8.

## 8. Verificação

- **Build:** `npm run build` passa. Lint sem **novos** erros nos arquivos tocados (o repo já tem ~40 erros pré-existentes; regras `react-hooks` v7 estritas, ver CLAUDE.md).
- **Playwright (script de auditoria):**
  - roda contra o backend local com banco demo descartável (`.env` gerado com chaves aleatórias, sem segredos reais) e o Vite;
  - percorre todas as rotas em **360, 390, 430 e 768px**;
  - mede `scrollWidth` e os elementos que ultrapassam o viewport; critério: **zero ofensores** (exceto drawers fechados fora da tela);
  - tira screenshots antes e depois por página, revisadas visualmente quanto a espaçamento (escala da 4.1), corte e alinhamento;
  - abre os modais principais (nova transação, nota, tarefa, compromisso, builders, segredo) com viewport reduzida (simulando o teclado) para confirmar que Salvar fica alcançável.
- **Desktop:** screenshots em 1280px antes e depois por página, que devem ser visualmente iguais (exceto as correções de bugs).
- **Backend:** nenhuma mudança; a suíte pytest não é afetada.
- **Teste manual final:** num celular real (iOS Safari e Chrome Android): instalação do PWA, safe areas, teclado, drag por toque longo, clipboard do Cofre.

## 9. Fora de escopo

- Service worker / offline.
- Refresh visual (novas cores, fontes ou design dos cards).
- Mudanças de API e backend.
- Reescrever o desktop.
