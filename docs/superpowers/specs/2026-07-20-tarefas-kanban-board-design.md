# Design — Board Kanban de Tarefas (módulo Registros)

**Data:** 2026-07-20
**Módulo:** Registros → aba **Tarefas**
**Autor:** brainstorming com o usuário (marocosz)

---

## 1. Contexto e problema

A aba **Tarefas** do módulo Registros hoje é apenas uma **grade de cards** (`TarefaCard`)
com um checkbox binário (Pendente ↔ Concluído), badge de prioridade, prazo e a árvore de
subtarefas renderizada inline dentro de cada card. Não há colunas, não há fluxo de trabalho,
não há arrastar-e-soltar. O `status` `"Em andamento"` existe no enum do modelo mas é
**inacessível pela interface**. O usuário classificou a experiência atual como "muito ruim"
e pediu um **sistema de kanban parecido com o ClickUp**.

O backend já foi parcialmente preparado para isso: o endpoint `PATCH /tarefas/{id}/status`
inclusive traz o comentário _"Kanban drag-and-drop"_. Ou seja, a fundação existe e nunca
foi usada.

### O que NÃO muda
- **Caderno** (anotações/grupos) e **Jornada** (hábitos) permanecem intactos.
- Recursividade de subtarefas, cascata de conclusão e os endpoints existentes de subtarefa.

---

## 2. Decisões (travadas no brainstorming)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Modelo de colunas | **Status fixos** — board pronto, sem tabela nova |
| 2 | Colunas | **A Fazer / Em Andamento / Concluído / Cancelado** (4) |
| 3 | Visões | **Só o Board** (sem visão Lista/Calendário por enquanto) |
| 4 | Interação com o card | **Painel deslizante lateral (slide-over)** estilo ClickUp |
| 5 | Drag-and-drop | **@dnd-kit** (`core` + `sortable` + `utilities`) |

### Mapa Coluna → `status` (valores de banco mantidos)

| Coluna (UI) | `status` no banco | Acento (dark / semântica) |
|-------------|-------------------|---------------------------|
| **A Fazer** | `Pendente` | cinza-azulado neutro |
| **Em Andamento** | `Em andamento` | laranja (`--cor-laranja-aviso`) |
| **Concluído** | `Concluído` | verde (`--cor-verde-sucesso`) |
| **Cancelado** | `Cancelado` *(novo valor)* | vermelho apagado / opacidade reduzida |

Manter os valores de banco existentes (`Pendente`, `Em andamento`, `Concluído`) evita
qualquer migração de dados. O rótulo visível "A Fazer" é só apresentação sobre `Pendente`.

---

## 3. Camada de dados

### 3.1 Modelo (`app/models/registros.py`)

- **Novo campo `Tarefa.ordem`** — `Column(Integer, nullable=False, default=0)`.
  Posição do card dentro da sua coluna. Ordenação do board é sempre `ORDER BY ordem ASC, id DESC`.
- **Novo valor no enum** `StatusTarefa`: `CANCELADO = "Cancelado"`.
  Como `Tarefa.status` é `String(50)` (não enum nativo do banco), **não há migração** para
  esse valor — é puramente Python.

### 3.2 Migração Alembic (necessária **apenas** para `ordem`)

`create_all()` cria tabelas novas mas **não altera** tabelas existentes, então adicionar
`ordem` à tabela `tarefa` exige migração explícita. **Escrever à mão** (não confiar só no
autogenerate) por robustez:

- `upgrade()`:
  1. `op.add_column('tarefa', sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'))`.
  2. **Backfill em Python** (loop via `op.get_bind()`, portável — evita depender da versão do
     SQLite p/ window functions / `UPDATE...FROM`): para cada `user_id`, para cada `status`,
     numerar as tarefas `0,1,2,...` ordenando por prioridade (Crítica→Baixa) e depois `prazo`,
     `id`. Assim os cards não empilham todos em `ordem=0`.
  3. (Opcional) remover o `server_default` depois do backfill com `op.alter_column` para o
     default ficar só na aplicação. Aceitável mantê-lo; decisão de implementação.
- `downgrade()`: `op.drop_column('tarefa', 'ordem')`.

> Em produção (Coolify, SQLite no volume), aplicar com `alembic upgrade head` normal — é uma
> mudança real de schema, não um no-op.

---

## 4. Backend — Schemas, Service, Endpoints

### 4.1 Schemas (`app/schemas/registros.py`)

- `TarefaResponse`: adicionar `ordem: int = 0`.
- `TarefaBoardResponse` (novo):
  ```python
  class TarefaBoardResponse(BaseModel):
      a_fazer: List[TarefaResponse]
      em_andamento: List[TarefaResponse]
      concluido: List[TarefaResponse]
      cancelado: List[TarefaResponse]
  ```
- `ReordenarTarefasRequest` (novo):
  ```python
  class ReordenarTarefasRequest(BaseModel):
      status: str                 # status/coluna destino
      tarefa_ids: List[int]       # ids na ordem nova da coluna destino
  ```
- `TarefaCreate` já possui `status` (default `"Pendente"`); nada a mudar ali.

### 4.2 Service (`app/services/registros.py`)

- **`get_board_data(db, user_id)`** → monta as 4 listas.
  - **Colunas abertas** (`A Fazer` / `Em Andamento`): todas, `ORDER BY ordem ASC, id DESC`.
    Aqui o `ordem` (reordenação manual por arraste) define a exibição.
  - **Colunas fechadas** (`Concluído` / `Cancelado`): `ORDER BY data_conclusao DESC NULLS LAST,
    id DESC`, **limitadas a 200** cada (mais recentes no topo; "carregar antigas" = melhoria
    futura). Reordenar manualmente dentro delas não é significativo — o `ordem` continua sendo
    gravado no drop (ver 4.2 `reordenar_tarefas`), mas **não** governa a exibição dessas colunas.
    Registrar essa decisão com comentário no código.
- **`reordenar_tarefas(db, user_id, status, tarefa_ids)`** → uma tacada resolve mover-entre-
  colunas **e** reordenar-dentro:
  - Buscar só tarefas do `user_id` cujo `id ∈ tarefa_ids` (segurança/tenant).
  - Para cada id na ordem recebida: `ordem = índice`; `status = <status destino>`.
  - Ajustar `data_conclusao`: se novo status == `"Concluído"` e estava vazio → `now()`;
    se novo status != `"Concluído"` → `None`.
  - Ignorar ids que não pertencem ao usuário (não vazar, não estourar).
  - Idempotente. Uma chamada por "drop".
- **`create_tarefa`**: setar `ordem` da nova tarefa = `max(ordem)+1` da coluna daquele
  `status` (entra no fim da coluna). Default `status` continua `"Pendente"`.
- `update_status_tarefa` e `update_tarefa` permanecem; garantir que `update_status_tarefa`
  aceite `"Cancelado"` (aceita qualquer string hoje — ok) e trate `data_conclusao`
  (já trata: seta se `"Concluído"`, senão `None`).

### 4.3 Endpoints (`app/api/v1/endpoints/registros.py`)

- `GET /registros/tarefas/board` → `TarefaBoardResponse`.
- `PATCH /registros/tarefas/reordenar` → recebe `ReordenarTarefasRequest`, chama
  `reordenar_tarefas`, retorna `{ "status": "success" }`.
- Mantidos: `POST /tarefas`, `PUT /tarefas/{id}`, `PATCH /tarefas/{id}/status`,
  `DELETE /tarefas/{id}`, `POST /tarefas/{id}/subtarefas`, `PATCH /subtarefas/{id}/toggle`.

### 4.4 Testes (`bussola_api/tests/test_registros_board.py` — novo)

Seguindo o padrão de `conftest.py` (fixtures `db`, `user`, `client`). Registros hoje não tem
teste; este arquivo cobre a lógica nova:

- `test_board_agrupa_por_coluna` — cria tarefas em status diferentes e valida as 4 listas.
- `test_board_ordena_por_ordem` — valida `ORDER BY ordem`.
- `test_reordenar_dentro_da_coluna` — reordena ids e confere `ordem` persistida.
- `test_reordenar_entre_colunas_muda_status` — mover para `Concluído` seta `status` +
  `data_conclusao`; mover para fora limpa `data_conclusao`.
- `test_reordenar_ignora_tarefa_de_outro_user` — tenant isolation.
- `test_criar_tarefa_recebe_ordem_no_fim_da_coluna`.

---

## 5. Frontend

### 5.1 Dependências

Adicionar ao `bussola_web`: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

### 5.2 Serviços (`src/services/api.ts`)

- `getTarefasBoard()` → `GET /registros/tarefas/board`.
- `reordenarTarefas(status, tarefaIds)` → `PATCH /registros/tarefas/reordenar`.
- `createTarefa` já existe (aceita `status` no payload — já suportado).
- Tipos: acrescentar `ordem` em `interface Tarefa`; `interface TarefaBoard { a_fazer; em_andamento; concluido; cancelado }`.

### 5.3 Componentes novos (`src/pages/Registros/components/kanban/`)

- **`TarefaBoard.jsx`** — dono do board.
  - Busca via `getTarefasBoard()` no mount; mantém estado local das 4 colunas (para DnD
    otimista). Expõe refresh.
  - **Toolbar própria** (renderizada dentro da aba Tarefas, abaixo do seletor de abas):
    busca textual (título/descrição), filtro de prioridade, filtro de período (paridade com o
    atual) e botão **"Nova Tarefa"** (abre o painel em modo criação).
  - Envolve as colunas num `DndContext` (sensores `Pointer` + `Keyboard` + `Touch`;
    colisão `closestCorners`). `onDragStart` guarda o card ativo; `onDragOver` faz o
    _cross-column preview_ movendo o item entre listas locais; `onDragEnd` persiste via
    `reordenarTarefas(statusDestino, idsDestino)` com **rollback + toast** em caso de erro.
  - `DragOverlay` renderiza o `BoardCard` "flutuante" durante o arraste.
- **`BoardColumn.jsx`** — uma coluna.
  - Header: acento colorido + rótulo + contador (pill). Corpo rolável independente.
  - `SortableContext` (estratégia vertical) com os cards da coluna.
  - **Quick-add** no rodapé: input "+ tarefa" que cria título-only naquela coluna
    (`createTarefa({ titulo, status })`).
  - Coluna vazia → placeholder tracejado ("Solte aqui" / "Nenhuma tarefa").
- **`BoardCard.jsx`** — card compacto (`useSortable`).
  - Faixa lateral fina na cor da prioridade; título com _clamp_ de 2 linhas.
  - Rodapé: chip de prazo (vermelho se atrasado), pill de progresso de subtarefas
    (`3/5` + mini-barra), ícone de pin se `fixado`.
  - Clique (sem arraste) → abre o `TarefaDetailPanel`. Check rápido opcional conclui.
- **`TarefaDetailPanel.jsx`** — o **slide-over** (framer-motion: `AnimatePresence` +
  slide da direita, backdrop com `backdrop-filter: blur` igual aos modais atuais).
  - Serve para **ver/editar** um card existente **e para criar** (aberto em branco).
  - Campos: título editável, dropdown de **status** (move de coluna), prioridade (reusa o
    `custom-select` existente), prazo (`DatePicker`), descrição (`textarea`), e a **árvore de
    subtarefas** com check inline + adicionar/remover (porta a lógica de `SubtaskItem` /
    `ModalSubtaskEdit` já existentes).
  - Rodapé: excluir (com `useConfirm`) + salvar (`updateTarefa` / `createTarefa`).
    Subtarefas com check permanecem instantâneas (`toggleSubtarefa`), como hoje.
  - **Aposenta o uso do `TarefaModal`** na aba de tarefas (o arquivo pode ser removido depois
    se nenhum outro lugar o importar — verificar na implementação).

### 5.4 Integração no `index.jsx`

- A aba `tarefas` passa a renderizar **`<TarefaBoard/>`** no lugar da grade atual
  (`tarefas-grid` + acordeão "Concluídas").
- Remover o bloco de header-actions específico de tarefas do `registros-main-header`
  (filtros/‘Nova Tarefa’) — essa toolbar migra para dentro do `TarefaBoard`. O seletor de
  abas (Caderno/Tarefas/Jornada) permanece.
- Estado de filtro de tarefas (`filtroPrioridade`, `filtroData`, dropdowns) sai do `index.jsx`
  e passa para o board.

### 5.5 Estilos (`src/pages/Registros/styles/kanban.css` — novo, importado pelo board)

- Layout: board em `flex` horizontal, altura preenchendo a área da aba; cada coluna com
  header fixo e corpo `overflow-y: auto`. Scroll horizontal do board só se não couber.
- Cards: fundo `--cor-card-secundario`, hover eleva (`translateY(-2px)` + sombra), estado
  `dragging` com opacidade/tilt/sombra maior; placeholder de gap no ponto de soltura.
- Slide-over: painel ~420px à direita, `--cor-card-principal`, backdrop-blur.
- **Tema dark/light automático** via os tokens existentes (`--cor-*`). Nada de cor hardcoded
  fora da paleta de prioridade/acento de coluna (que reusa `--cor-verde-sucesso`,
  `--cor-laranja-aviso`, `--cor-vermelho-delete`, etc.).

---

## 6. Interações e casos de borda

- **Arraste** entre colunas muda o status; dentro da coluna reordena. Persistência otimista;
  se a API falhar, reverte o estado local e mostra toast de erro.
- Soltar em **Concluído** grava `data_conclusao`; tirar de lá limpa. **Cancelado** não é
  "sucesso": `data_conclusao` fica `None` e a coluna tem tratamento visual apagado.
- **Concluído/Cancelado** limitados a 200 no fetch (evita board gigante). "Ver antigas" =
  melhoria futura, não faz parte deste escopo.
- **Atrasado**: prazo passado e não concluído → chip vermelho + leve borda no card (como hoje).
- Acessibilidade: @dnd-kit fornece sensor de teclado; manter `aria-label` nos cards/colunas.

---

## 7. Regras do projeto a respeitar (gate)

- **Frontend julgado por `npm run build`** (esbuild, sem typecheck) + **zero erro NOVO de
  lint** nos arquivos tocados. `.ts` (services) não é lintado; a régua é build + lint limpo
  no que foi mexido.
- ESLint estrito (react-hooks v7): **não** `setState` síncrono dentro de `useEffect` (resetar
  form via ajuste em render guardado por "prev key"); **não** mutar acumulador em `map`/`reduce`
  (hoistar helper puro); `catch {` vazio quando o erro não é usado.
- Modais/painéis seguem o padrão compartilhado (`BaseModal`, `.form-row`/`.form-group`,
  `.btn-action-icon`), espelhando `FinancasModals.jsx`.
- Services no padrão singleton do backend: métodos `(db, ..., user_id)` com filtro por
  `user_id` em toda query.

---

## 8. Arquivos afetados (resumo)

**Backend**
- `app/models/registros.py` — `Tarefa.ordem`, enum `CANCELADO`.
- `alembic/versions/<novo>_add_ordem_tarefa.py` — migração (add coluna + backfill).
- `app/schemas/registros.py` — `TarefaBoardResponse`, `ReordenarTarefasRequest`, `ordem` no response.
- `app/services/registros.py` — `get_board_data`, `reordenar_tarefas`, `ordem` no create.
- `app/api/v1/endpoints/registros.py` — `GET /tarefas/board`, `PATCH /tarefas/reordenar`.
- `tests/test_registros_board.py` — novo.

**Frontend**
- `package.json` — `@dnd-kit/{core,sortable,utilities}`.
- `src/services/api.ts` — `getTarefasBoard`, `reordenarTarefas`, tipos.
- `src/pages/Registros/components/kanban/{TarefaBoard,BoardColumn,BoardCard,TarefaDetailPanel}.jsx` — novos.
- `src/pages/Registros/styles/kanban.css` — novo.
- `src/pages/Registros/index.jsx` — aba tarefas → `<TarefaBoard/>`; remover header-actions e estado de filtro de tarefas.
- `src/pages/Registros/components/TarefaModal.jsx` / `TarefaCard.jsx` — deixam de ser usados na aba (verificar remoção segura na implementação).

---

## 9. Fora de escopo (YAGNI)

- Colunas customizáveis / workflows por usuário.
- Visões Lista e Calendário.
- Tags/labels, estimativas, responsáveis (POS single-user).
- Paginação/lazy-load das colunas Concluído/Cancelado (só o cap de 200 agora).
- Swimlanes, limites de WIP, subtarefas como cards próprios no board.
