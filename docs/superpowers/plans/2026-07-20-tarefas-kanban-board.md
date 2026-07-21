# Board Kanban de Tarefas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a aba "Tarefas" do módulo Registros num board kanban de 4 colunas fixas com drag-and-drop e painel deslizante de detalhe, estilo ClickUp.

**Architecture:** Backend adiciona `Tarefa.ordem` (posição na coluna) + valor `Cancelado` no enum de status, um endpoint de board (agrupa por status) e um endpoint de reordenação (move entre colunas / reordena dentro). Frontend novo em `pages/Registros/components/kanban/` usa `@dnd-kit` para o arraste e `framer-motion` para o slide-over. As 4 colunas mapeiam para os valores de `status` já existentes (`Pendente`→"A Fazer", `Em andamento`, `Concluído`) mais o novo `Cancelado`.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + pytest (backend); React 19 + Vite + @dnd-kit + framer-motion (frontend).

## Global Constraints

- Backend services são singletons; métodos `(db, ..., user_id)` e **toda query filtra por `user_id`** (multi-tenancy).
- Valores de `status` no banco mantidos verbatim: `"Pendente"`, `"Em andamento"`, `"Concluído"`, `"Cancelado"`. O rótulo "A Fazer" é só UI sobre `"Pendente"`.
- Endpoints sob prefixo `/api/v1/registros`.
- `app/main.py` roda `Base.metadata.create_all()` no import — tabela nova nasce sozinha, mas **coluna nova em tabela existente exige migração Alembic**.
- Cadeia Alembic deve ter **um único head** (`tests/test_migrations.py::test_alembic_single_head`).
- Frontend julgado por **`npm run build` passar** + **zero erro NOVO de `npm run lint`** nos arquivos tocados (esbuild não faz typecheck; `.ts` não é lintado).
- ESLint estrito (react-hooks v7): **não** `setState` síncrono em `useEffect`; **não** mutar acumulador em `map`/`reduce`; `catch {` vazio quando o erro não é usado.
- Rodar pytest no Windows pelo venv: `venvbussola/Scripts/python.exe -m pytest ...` (a partir de `bussola_api/`).
- Toda mensagem de commit termina com:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Branch de trabalho: `feat/tarefas-kanban-board` (já criado, spec já commitado nele).

---

## File Structure

**Backend**
- `bussola_api/app/models/registros.py` — MOD: `Tarefa.ordem`, enum `CANCELADO`.
- `bussola_api/alembic/versions/<hash>_add_ordem_tarefa.py` — NOVO: migração.
- `bussola_api/app/schemas/registros.py` — MOD: `ordem` em `TarefaResponse`; `TarefaBoardResponse`; `ReordenarTarefasRequest`.
- `bussola_api/app/services/registros.py` — MOD: `get_board_data`, `reordenar_tarefas`, `ordem` no `create_tarefa`.
- `bussola_api/app/api/v1/endpoints/registros.py` — MOD: `GET /tarefas/board`, `PATCH /tarefas/reordenar`.
- `bussola_api/tests/test_registros_board.py` — NOVO: testes.

**Frontend**
- `bussola_web/package.json` — MOD: deps `@dnd-kit/*`.
- `bussola_web/src/services/api.ts` — MOD: `getTarefasBoard`, `reordenarTarefas`, tipos.
- `bussola_web/src/pages/Registros/components/kanban/columns.js` — NOVO: config das colunas.
- `bussola_web/src/pages/Registros/components/kanban/SubtaskTree.jsx` — NOVO: editor de subtarefas (client-side).
- `bussola_web/src/pages/Registros/components/kanban/BoardCard.jsx` — NOVO: card sortable.
- `bussola_web/src/pages/Registros/components/kanban/BoardColumn.jsx` — NOVO: coluna.
- `bussola_web/src/pages/Registros/components/kanban/TarefaDetailPanel.jsx` — NOVO: slide-over.
- `bussola_web/src/pages/Registros/components/kanban/TarefaBoard.jsx` — NOVO: orquestrador DnD.
- `bussola_web/src/pages/Registros/styles/kanban.css` — NOVO: estilos.
- `bussola_web/src/pages/Registros/index.jsx` — MOD: aba tarefas → `<TarefaBoard/>`, remover header-actions e estado de filtro de tarefas.

---

## Task 1: Modelo `Tarefa.ordem` + enum `Cancelado` + migração

**Files:**
- Modify: `bussola_api/app/models/registros.py`
- Create: `bussola_api/alembic/versions/<hash>_add_ordem_tarefa.py`
- Test: `bussola_api/tests/test_registros_board.py`

**Interfaces:**
- Produces: `Tarefa.ordem` (int, default 0); `StatusTarefa.CANCELADO == "Cancelado"`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `bussola_api/tests/test_registros_board.py`:

```python
from app.models.registros import Tarefa, StatusTarefa


def test_tarefa_tem_ordem_default_zero(db, user):
    t = Tarefa(titulo="X", user_id=user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    assert t.ordem == 0


def test_status_cancelado_existe_no_enum():
    assert StatusTarefa.CANCELADO.value == "Cancelado"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_registros_board.py -v`
Expected: FAIL (`AttributeError: ordem` / `CANCELADO`).

- [ ] **Step 3: Alterar o modelo**

Em `bussola_api/app/models/registros.py`, no enum `StatusTarefa` (após `CONCLUIDO`):

```python
class StatusTarefa(str, enum.Enum):
    PENDENTE = "Pendente"
    EM_ANDAMENTO = "Em andamento"
    CONCLUIDO = "Concluído"
    CANCELADO = "Cancelado"
```

Na classe `Tarefa`, logo após o campo `status`:

```python
    status = Column(String(50), default=StatusTarefa.PENDENTE.value)
    ordem = Column(Integer, nullable=False, default=0)  # Posição dentro da coluna do board
```

- [ ] **Step 4: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_registros_board.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Gerar o esqueleto da migração**

Run (em `bussola_api/`): `venvbussola/Scripts/python.exe -m alembic revision -m "add_ordem_tarefa"`
Isso cria `alembic/versions/<hash>_add_ordem_tarefa.py` com o `down_revision` já apontando para o head atual.

- [ ] **Step 6: Escrever `upgrade`/`downgrade` à mão (com backfill portável)**

Substituir o corpo do arquivo gerado (preservar as linhas `revision`/`down_revision` que o Alembic gerou):

```python
"""add_ordem_tarefa

Revision ID: <hash>
Revises: <head anterior>
Create Date: ...

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "<hash>"
down_revision: Union[str, Sequence[str], None] = "<head anterior>"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Prioridade -> peso, para o backfill inicial dar uma ordem sensata.
_PESO_PRIO = {"Crítica": 0, "Alta": 1, "Média": 2, "Baixa": 3}


def upgrade() -> None:
    op.add_column(
        "tarefa",
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
    )

    # Backfill em Python (portável — não depende de window functions do SQLite).
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, user_id, status, prioridade, prazo FROM tarefa")
    ).fetchall()

    # Agrupa por (user_id, status) e ordena por prioridade, prazo, id.
    grupos: dict = {}
    for r in rows:
        grupos.setdefault((r.user_id, r.status), []).append(r)

    for _, tarefas in grupos.items():
        tarefas.sort(
            key=lambda x: (
                _PESO_PRIO.get(x.prioridade, 9),
                x.prazo is None,          # com prazo primeiro
                str(x.prazo),
                x.id,
            )
        )
        for idx, t in enumerate(tarefas):
            bind.execute(
                sa.text("UPDATE tarefa SET ordem = :o WHERE id = :id"),
                {"o": idx, "id": t.id},
            )


def downgrade() -> None:
    op.drop_column("tarefa", "ordem")
```

- [ ] **Step 7: Verificar head único**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_migrations.py -v`
Expected: PASS (`test_alembic_single_head`).

- [ ] **Step 8: Commit**

```bash
git add app/models/registros.py alembic/versions/*_add_ordem_tarefa.py tests/test_registros_board.py
git commit -m "feat(tarefas): campo ordem + status Cancelado + migração

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `create_tarefa` seta `ordem` no fim da coluna

**Files:**
- Modify: `bussola_api/app/services/registros.py` (`create_tarefa`, ~linha 221)
- Test: `bussola_api/tests/test_registros_board.py`

**Interfaces:**
- Consumes: `Tarefa.ordem`.
- Produces: nova `Tarefa` recebe `ordem = max(ordem da coluna do seu status) + 1`.

- [ ] **Step 1: Teste que falha**

Adicionar em `tests/test_registros_board.py`:

```python
from app.services.registros import registros_service
from app.schemas.registros import TarefaCreate


def test_create_tarefa_recebe_ordem_no_fim_da_coluna(db, user):
    t1 = registros_service.create_tarefa(db, TarefaCreate(titulo="A"), user.id)
    t2 = registros_service.create_tarefa(db, TarefaCreate(titulo="B"), user.id)
    assert t1.ordem == 0
    assert t2.ordem == 1
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_registros_board.py::test_create_tarefa_recebe_ordem_no_fim_da_coluna -v`
Expected: FAIL (`t2.ordem == 0`, esperado `1`).

- [ ] **Step 3: Implementar**

Em `create_tarefa`, antes de instanciar `nova_tarefa`, calcular a próxima ordem para o `status` da nova tarefa (default `"Pendente"`):

```python
    def create_tarefa(self, db: Session, tarefa_data, user_id: int):
        """Cria a Tarefa Raiz e dispara a criação recursiva das subtarefas."""
        status_novo = tarefa_data.status or "Pendente"
        max_ordem = (
            db.query(func.max(Tarefa.ordem))
            .filter(Tarefa.user_id == user_id, Tarefa.status == status_novo)
            .scalar()
        )
        proxima_ordem = (max_ordem + 1) if max_ordem is not None else 0

        nova_tarefa = Tarefa(
            titulo=tarefa_data.titulo,
            descricao=tarefa_data.descricao,
            fixado=tarefa_data.fixado,
            prioridade=tarefa_data.prioridade,
            prazo=tarefa_data.prazo,
            status=status_novo,
            ordem=proxima_ordem,
            user_id=user_id,
        )
        db.add(nova_tarefa)
        db.flush()  # ID para subtarefas

        if tarefa_data.subtarefas:
            self._create_subtarefas_recursivo(db, tarefa_data.subtarefas, nova_tarefa.id, None)

        db.commit()
        db.refresh(nova_tarefa)
        return nova_tarefa
```

(`func` já está importado no topo: `from sqlalchemy import func, case`.)

- [ ] **Step 4: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_registros_board.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/registros.py tests/test_registros_board.py
git commit -m "feat(tarefas): create_tarefa posiciona no fim da coluna (ordem)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Endpoint `GET /tarefas/board` (agrupar + ordenar)

**Files:**
- Modify: `bussola_api/app/schemas/registros.py` (`ordem` em `TarefaResponse`; `TarefaBoardResponse`)
- Modify: `bussola_api/app/services/registros.py` (`get_board_data`)
- Modify: `bussola_api/app/api/v1/endpoints/registros.py` (rota)
- Test: `bussola_api/tests/test_registros_board.py`

**Interfaces:**
- Produces:
  - `registros_service.get_board_data(db, user_id) -> dict` com chaves `a_fazer`, `em_andamento`, `concluido`, `cancelado` (listas de `Tarefa`).
  - `TarefaBoardResponse(a_fazer, em_andamento, concluido, cancelado: List[TarefaResponse])`.
  - Rota `GET /api/v1/registros/tarefas/board`.

- [ ] **Step 1: Teste que falha**

Adicionar em `tests/test_registros_board.py`:

```python
def test_board_agrupa_e_ordena(client):
    # cria 2 pendentes, 1 em andamento
    client.post("/api/v1/registros/tarefas", json={"titulo": "P1"})
    client.post("/api/v1/registros/tarefas", json={"titulo": "P2"})
    client.post("/api/v1/registros/tarefas", json={"titulo": "A1", "status": "Em andamento"})

    r = client.get("/api/v1/registros/tarefas/board")
    assert r.status_code == 200, r.text
    body = r.json()
    assert {"a_fazer", "em_andamento", "concluido", "cancelado"} == set(body.keys())
    assert [t["titulo"] for t in body["a_fazer"]] == ["P1", "P2"]   # ordem asc
    assert len(body["em_andamento"]) == 1
    assert body["a_fazer"][0]["ordem"] == 0
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_registros_board.py::test_board_agrupa_e_ordena -v`
Expected: FAIL (404 — rota não existe).

- [ ] **Step 3: Schema — `ordem` + `TarefaBoardResponse`**

Em `app/schemas/registros.py`, dentro de `TarefaResponse` adicionar o campo:

```python
class TarefaResponse(TarefaBase):
    id: int
    ordem: int = 0
    data_criacao: datetime
    data_conclusao: Optional[datetime] = None
    subtarefas: List[SubtarefaResponse] = []
```

E, após `TarefaResponse` (antes da seção de Hábitos), adicionar:

```python
class TarefaBoardResponse(BaseModel):
    a_fazer: List[TarefaResponse]
    em_andamento: List[TarefaResponse]
    concluido: List[TarefaResponse]
    cancelado: List[TarefaResponse]


class ReordenarTarefasRequest(BaseModel):
    status: str
    tarefa_ids: List[int]
```

- [ ] **Step 4: Service — `get_board_data`**

Em `app/services/registros.py`, adicionar dentro da classe (após `get_dashboard_data`):

```python
    def get_board_data(self, db: Session, user_id: int):
        """
        Monta as 4 colunas do board.

        Colunas abertas (Pendente / Em andamento): ordenadas por `ordem` (reordenação
        manual). Colunas fechadas (Concluído / Cancelado): mais recentes no topo
        (data_conclusao desc), limitadas a 200 — reordenar dentro delas não governa a
        exibição (o `ordem` ainda é gravado no drop, mas ignorado aqui).
        """
        base = db.query(Tarefa).filter(Tarefa.user_id == user_id)

        a_fazer = base.filter(Tarefa.status == "Pendente") \
            .order_by(Tarefa.ordem.asc(), Tarefa.id.desc()).all()
        em_andamento = base.filter(Tarefa.status == "Em andamento") \
            .order_by(Tarefa.ordem.asc(), Tarefa.id.desc()).all()
        concluido = base.filter(Tarefa.status == "Concluído") \
            .order_by(Tarefa.data_conclusao.desc().nullslast(), Tarefa.id.desc()).limit(200).all()
        cancelado = base.filter(Tarefa.status == "Cancelado") \
            .order_by(Tarefa.data_conclusao.desc().nullslast(), Tarefa.id.desc()).limit(200).all()

        return {
            "a_fazer": a_fazer,
            "em_andamento": em_andamento,
            "concluido": concluido,
            "cancelado": cancelado,
        }
```

- [ ] **Step 5: Endpoint**

Em `app/api/v1/endpoints/registros.py`, importar os novos schemas na lista de imports:

```python
from app.schemas.registros import (
    RegistrosDashboardResponse,
    AnotacaoCreate, AnotacaoResponse, AnotacaoUpdate,
    TarefaCreate, TarefaResponse, TarefaUpdate,
    TarefaBoardResponse, ReordenarTarefasRequest,
    GrupoCreate, GrupoResponse,
    HabitoCreate, HabitoUpdate, HabitoResponse, HabitoRegistroResponse,
    ExportPdfRequest,
)
```

E adicionar a rota logo antes de `@router.post("/tarefas", ...)`:

```python
@router.get("/tarefas/board", response_model=TarefaBoardResponse)
def get_tarefas_board(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user),
):
    """Retorna as tarefas agrupadas nas 4 colunas do board kanban."""
    return registros_service.get_board_data(db, current_user.id)
```

> **Ordem das rotas importa:** `/tarefas/board` deve ser declarada **antes** de qualquer `/tarefas/{id}` para não ser capturada como `id="board"`. Como o arquivo tem `POST /tarefas` e `PUT /tarefas/{id}`, declarar o GET `/tarefas/board` junto ao bloco de tarefas, antes do `PUT/{id}`, é seguro (métodos HTTP diferentes, mas manter agrupado e no topo do bloco).

- [ ] **Step 6: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_registros_board.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/schemas/registros.py app/services/registros.py app/api/v1/endpoints/registros.py tests/test_registros_board.py
git commit -m "feat(tarefas): endpoint GET /tarefas/board agrupando por coluna

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Endpoint `PATCH /tarefas/reordenar` (mover + reordenar)

**Files:**
- Modify: `bussola_api/app/services/registros.py` (`reordenar_tarefas`)
- Modify: `bussola_api/app/api/v1/endpoints/registros.py` (rota)
- Test: `bussola_api/tests/test_registros_board.py`

**Interfaces:**
- Consumes: `ReordenarTarefasRequest`, `get_board_data`.
- Produces:
  - `registros_service.reordenar_tarefas(db, user_id, status, tarefa_ids) -> None`.
  - Rota `PATCH /api/v1/registros/tarefas/reordenar`.

- [ ] **Step 1: Testes que falham**

Adicionar em `tests/test_registros_board.py`:

```python
def test_reordenar_dentro_da_coluna(client):
    id1 = client.post("/api/v1/registros/tarefas", json={"titulo": "P1"}).json()["id"]
    id2 = client.post("/api/v1/registros/tarefas", json={"titulo": "P2"}).json()["id"]

    r = client.patch(
        "/api/v1/registros/tarefas/reordenar",
        json={"status": "Pendente", "tarefa_ids": [id2, id1]},
    )
    assert r.status_code == 200, r.text
    a_fazer = client.get("/api/v1/registros/tarefas/board").json()["a_fazer"]
    assert [t["id"] for t in a_fazer] == [id2, id1]


def test_reordenar_entre_colunas_muda_status_e_conclusao(client):
    tid = client.post("/api/v1/registros/tarefas", json={"titulo": "X"}).json()["id"]

    # move para Concluído
    client.patch(
        "/api/v1/registros/tarefas/reordenar",
        json={"status": "Concluído", "tarefa_ids": [tid]},
    )
    board = client.get("/api/v1/registros/tarefas/board").json()
    assert [t["id"] for t in board["concluido"]] == [tid]
    assert board["concluido"][0]["data_conclusao"] is not None
    assert board["a_fazer"] == []

    # tira de Concluído -> limpa data_conclusao
    client.patch(
        "/api/v1/registros/tarefas/reordenar",
        json={"status": "Em andamento", "tarefa_ids": [tid]},
    )
    board = client.get("/api/v1/registros/tarefas/board").json()
    assert board["em_andamento"][0]["data_conclusao"] is None


def test_reordenar_ignora_tarefa_de_outro_user(db, client, user):
    from app.models.registros import Tarefa
    from app.models.user import User
    outro = User(email="outro@x.dev", hashed_password="y", is_active=True)
    db.add(outro)
    db.commit()
    db.refresh(outro)
    alheia = Tarefa(titulo="alheia", status="Pendente", user_id=outro.id)
    db.add(alheia)
    db.commit()
    db.refresh(alheia)

    r = client.patch(
        "/api/v1/registros/tarefas/reordenar",
        json={"status": "Concluído", "tarefa_ids": [alheia.id]},
    )
    assert r.status_code == 200
    db.refresh(alheia)
    assert alheia.status == "Pendente"   # inalterada
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_registros_board.py -k reordenar -v`
Expected: FAIL (404 — rota não existe).

- [ ] **Step 3: Service — `reordenar_tarefas`**

Em `app/services/registros.py`, adicionar após `update_status_tarefa`:

```python
    def reordenar_tarefas(self, db: Session, user_id: int, status: str, tarefa_ids: list):
        """
        Persiste a nova ordem/coluna de um drop do board.

        Para cada id (na ordem recebida) que pertença ao usuário:
        grava `ordem = índice`, aplica o `status` destino e ajusta `data_conclusao`
        (seta se virou 'Concluído', limpa caso contrário). Ids alheios são ignorados.
        """
        tarefas = (
            db.query(Tarefa)
            .filter(Tarefa.id.in_(tarefa_ids), Tarefa.user_id == user_id)
            .all()
        )
        por_id = {t.id: t for t in tarefas}

        for indice, tid in enumerate(tarefa_ids):
            tarefa = por_id.get(tid)
            if tarefa is None:
                continue
            tarefa.ordem = indice
            tarefa.status = status
            if status == "Concluído":
                if tarefa.data_conclusao is None:
                    tarefa.data_conclusao = datetime.now()
            else:
                tarefa.data_conclusao = None

        db.commit()
```

- [ ] **Step 4: Endpoint**

Em `app/api/v1/endpoints/registros.py`, adicionar após `update_tarefa_status`:

```python
@router.patch("/tarefas/reordenar")
def reordenar_tarefas(
    dados: ReordenarTarefasRequest,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user),
):
    """Persiste a reordenação/movimentação de cards do board (drag-and-drop)."""
    registros_service.reordenar_tarefas(db, current_user.id, dados.status, dados.tarefa_ids)
    return {"status": "success"}
```

> **Ordem das rotas:** declarar `/tarefas/reordenar` **antes** de `/tarefas/{id}` no arquivo, senão o PATCH `/tarefas/{id}/status` não colide, mas mantenha `reordenar` junto ao bloco de tarefas, acima das rotas com `{id}` que usem PATCH sem sufixo. (Aqui não há PATCH `/tarefas/{id}` puro, então é seguro; ainda assim, agrupar no topo do bloco.)

- [ ] **Step 5: Rodar e ver passar**

Run: `venvbussola/Scripts/python.exe -m pytest tests/test_registros_board.py -v`
Expected: PASS (todos).

- [ ] **Step 6: Commit**

```bash
git add app/services/registros.py app/api/v1/endpoints/registros.py tests/test_registros_board.py
git commit -m "feat(tarefas): endpoint PATCH /tarefas/reordenar (mover + reordenar)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Deps @dnd-kit + serviços no `api.ts`

**Files:**
- Modify: `bussola_web/package.json`
- Modify: `bussola_web/src/services/api.ts` (~linha 392-505)

**Interfaces:**
- Produces:
  - `getTarefasBoard(): Promise<TarefaBoard>`
  - `reordenarTarefas(status: string, tarefaIds: number[]): Promise<any>`
  - tipos `Tarefa.ordem`, `TarefaBoard`.

- [ ] **Step 1: Instalar as dependências**

Run (em `bussola_web/`): `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: adiciona as 3 deps ao `package.json` e `package-lock.json`.

- [ ] **Step 2: Tipos + serviços**

Em `src/services/api.ts`, no `interface Tarefa` adicionar `ordem`:

```typescript
export interface Tarefa {
    // ...campos existentes...
    ordem: number;
    subtarefas: Subtarefa[];
}
```

E adicionar, junto aos outros wrappers de tarefa (após `toggleSubtarefa`):

```typescript
export interface TarefaBoard {
    a_fazer: Tarefa[];
    em_andamento: Tarefa[];
    concluido: Tarefa[];
    cancelado: Tarefa[];
}

export const getTarefasBoard = async (): Promise<TarefaBoard> => {
    const response = await api.get('/registros/tarefas/board');
    return response.data;
};

export const reordenarTarefas = async (status: string, tarefaIds: number[]) => {
    const response = await api.patch('/registros/tarefas/reordenar', {
        status,
        tarefa_ids: tarefaIds,
    });
    return response.data;
};
```

- [ ] **Step 3: Verificar build**

Run (em `bussola_web/`): `npm run build`
Expected: build passa sem erros.

- [ ] **Step 4: Commit**

```bash
git add bussola_web/package.json bussola_web/package-lock.json bussola_web/src/services/api.ts
git commit -m "feat(tarefas): deps @dnd-kit + serviços de board no api.ts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Config das colunas + editor de subtarefas

**Files:**
- Create: `bussola_web/src/pages/Registros/components/kanban/columns.js`
- Create: `bussola_web/src/pages/Registros/components/kanban/SubtaskTree.jsx`

**Interfaces:**
- Produces:
  - `COLUNAS` (array), `COL_KEYS` (string[]), `statusToKey(status)`, `PRIO_COLORS`.
  - `<SubtaskTree subtarefas onChange />` — editor client-side (add raiz/filho, remover, toggle) que emite o array atualizado via `onChange`.

- [ ] **Step 1: `columns.js`**

```javascript
// Mapa das 4 colunas fixas do board. `status` = valor gravado no banco.
export const COLUNAS = [
    { key: 'a_fazer',      status: 'Pendente',     label: 'A Fazer',      accent: 'var(--cor-azul-primario)' },
    { key: 'em_andamento', status: 'Em andamento', label: 'Em Andamento', accent: 'var(--cor-laranja-aviso)' },
    { key: 'concluido',    status: 'Concluído',    label: 'Concluído',    accent: 'var(--cor-verde-sucesso)' },
    { key: 'cancelado',    status: 'Cancelado',    label: 'Cancelado',    accent: 'var(--cor-vermelho-delete)' },
];

export const COL_KEYS = COLUNAS.map(c => c.key);

const STATUS_BY_KEY = Object.fromEntries(COLUNAS.map(c => [c.key, c.status]));
const KEY_BY_STATUS = Object.fromEntries(COLUNAS.map(c => [c.status, c.key]));

export const keyToStatus = (key) => STATUS_BY_KEY[key];
export const statusToKey = (status) => KEY_BY_STATUS[status] || 'a_fazer';

export const PRIO_COLORS = {
    'Crítica': '#ef4444',
    'Alta': '#f59e0b',
    'Média': '#3b82f6',
    'Baixa': '#10b981',
};
```

- [ ] **Step 2: `SubtaskTree.jsx` (editor recursivo client-side)**

Porta a lógica de `ModalSubtaskEdit` (de `TarefaModal.jsx`) para um componente reutilizável que opera sobre um array local e emite mudanças via `onChange`. Sem chamadas de API — a persistência acontece no save do painel (via `updateTarefa`/`createTarefa`, que recriam a árvore).

```jsx
import React, { useState } from 'react';

// Um nó editável da árvore de subtarefas.
function TreeNode({ sub, path, onToggle, onDelete, onAddChild, level }) {
    const [isAdding, setIsAdding] = useState(false);
    const [childTitle, setChildTitle] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (!childTitle.trim()) return;
        onAddChild(path, childTitle.trim());
        setChildTitle('');
        setIsAdding(false);
    };

    return (
        <div className="kb-tree-node">
            <div className="kb-tree-row">
                <i
                    className={`fa-regular ${sub.concluido ? 'fa-square-check' : 'fa-square'} kb-tree-check`}
                    onClick={() => onToggle(path)}
                ></i>
                <span className={`kb-tree-title ${sub.concluido ? 'kb-riscado' : ''}`}>{sub.titulo}</span>
                <div className="kb-tree-actions">
                    {level < 4 && (
                        <button type="button" className="kb-icon-btn" onClick={() => setIsAdding(v => !v)} title="Sub-etapa">
                            <i className="fa-solid fa-plus"></i>
                        </button>
                    )}
                    <button type="button" className="kb-icon-btn danger" onClick={() => onDelete(path)} title="Remover">
                        <i className="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="kb-tree-add">
                    <input
                        className="form-input" autoFocus value={childTitle}
                        onChange={e => setChildTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd(e)}
                        placeholder="Nome da sub-etapa..."
                    />
                    <button type="button" className="btn-primary kb-mini" onClick={handleAdd}><i className="fa-solid fa-check"></i></button>
                    <button type="button" className="btn-secondary kb-mini" onClick={() => setIsAdding(false)}><i className="fa-solid fa-xmark"></i></button>
                </div>
            )}

            {sub.subtarefas && sub.subtarefas.length > 0 && (
                <div className="kb-tree-children">
                    {sub.subtarefas.map((child, i) => (
                        <TreeNode
                            key={i} sub={child} path={[...path, i]}
                            onToggle={onToggle} onDelete={onDelete} onAddChild={onAddChild}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function SubtaskTree({ subtarefas, onChange }) {
    const [novaRaiz, setNovaRaiz] = useState('');

    const clone = () => JSON.parse(JSON.stringify(subtarefas));

    const nodeAt = (arr, path) => {
        let node = { subtarefas: arr };
        for (const idx of path) node = node.subtarefas[idx];
        return node;
    };

    const addRaiz = (e) => {
        if (e) e.preventDefault();
        if (!novaRaiz.trim()) return;
        onChange([...subtarefas, { titulo: novaRaiz.trim(), concluido: false, subtarefas: [] }]);
        setNovaRaiz('');
    };

    const addChild = (path, titulo) => {
        const next = clone();
        const parent = nodeAt(next, path);
        if (!parent.subtarefas) parent.subtarefas = [];
        parent.subtarefas.push({ titulo, concluido: false, subtarefas: [] });
        onChange(next);
    };

    const toggle = (path) => {
        const next = clone();
        const node = nodeAt(next, path);
        node.concluido = !node.concluido;
        onChange(next);
    };

    const remove = (path) => {
        const next = clone();
        const parentPath = path.slice(0, -1);
        const idx = path[path.length - 1];
        const parentArr = parentPath.length ? nodeAt(next, parentPath).subtarefas : next;
        parentArr.splice(idx, 1);
        onChange(next);
    };

    return (
        <div className="kb-subtree">
            <div className="kb-tree-addroot">
                <input
                    className="form-input" value={novaRaiz}
                    onChange={e => setNovaRaiz(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addRaiz(e)}
                    placeholder="Adicionar etapa principal..."
                />
                <button type="button" className="btn-secondary kb-mini" onClick={addRaiz}><i className="fa-solid fa-plus"></i></button>
            </div>
            {subtarefas.length === 0
                ? <div className="kb-tree-empty">Nenhuma subtarefa.</div>
                : subtarefas.map((sub, i) => (
                    <TreeNode
                        key={i} sub={sub} path={[i]}
                        onToggle={toggle} onDelete={remove} onAddChild={addChild} level={0}
                    />
                ))}
        </div>
    );
}
```

> Nota ESLint: `clone()`/`nodeAt()`/`splice` operam sobre uma cópia local (`JSON.parse(JSON.stringify(...))`) e não dentro de `map`/`reduce` — não violam `react-hooks/immutability`.

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: passa (componentes ainda não importados, mas devem compilar).

- [ ] **Step 4: Commit**

```bash
git add bussola_web/src/pages/Registros/components/kanban/columns.js bussola_web/src/pages/Registros/components/kanban/SubtaskTree.jsx
git commit -m "feat(tarefas): config de colunas + editor de subtarefas do board

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `BoardCard` (card compacto sortable)

**Files:**
- Create: `bussola_web/src/pages/Registros/components/kanban/BoardCard.jsx`

**Interfaces:**
- Consumes: `PRIO_COLORS`, `@dnd-kit/sortable`.
- Produces: `<BoardCard tarefa onClick hidden />`. Calcula progresso de subtarefas.

- [ ] **Step 1: Implementar**

```jsx
import React from 'react';
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
export function BoardCard({ tarefa, onClick, hidden = false, overlay = false }) {
    const sortable = useSortable({ id: tarefa.id, disabled: overlay });
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

    const style = overlay ? undefined : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const prog = contarSubtarefas(tarefa.subtarefas);
    const prazo = formatarPrazo(tarefa.prazo);
    const atrasado = tarefa.prazo && new Date(tarefa.prazo) < new Date() && tarefa.status !== 'Concluído';
    const prioColor = PRIO_COLORS[tarefa.prioridade] || PRIO_COLORS['Média'];

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
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add bussola_web/src/pages/Registros/components/kanban/BoardCard.jsx
git commit -m "feat(tarefas): componente BoardCard (card sortable)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `BoardColumn` (coluna droppable + quick-add)

**Files:**
- Create: `bussola_web/src/pages/Registros/components/kanban/BoardColumn.jsx`

**Interfaces:**
- Consumes: `BoardCard`, `@dnd-kit/sortable`, `@dnd-kit/core` (`useDroppable`).
- Produces: `<BoardColumn coluna tarefas cardVisivel onCardClick onQuickAdd />`.
  - `coluna`: item de `COLUNAS`. `tarefas`: array. `cardVisivel(tarefa) -> bool` (filtro).
  - `onQuickAdd(status, titulo)`.

- [ ] **Step 1: Implementar**

```jsx
import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BoardCard } from './BoardCard';

export function BoardColumn({ coluna, tarefas, cardVisivel, onCardClick, onQuickAdd }) {
    const { setNodeRef, isOver } = useDroppable({ id: coluna.key });
    const [adding, setAdding] = useState(false);
    const [titulo, setTitulo] = useState('');

    const confirmar = () => {
        if (titulo.trim()) onQuickAdd(coluna.status, titulo.trim());
        setTitulo('');
        setAdding(false);
    };

    const visiveis = tarefas.filter(cardVisivel);

    return (
        <div className="kb-column">
            <div className="kb-column-head">
                <span className="kb-column-accent" style={{ backgroundColor: coluna.accent }}></span>
                <span className="kb-column-label">{coluna.label}</span>
                <span className="kb-column-count">{tarefas.length}</span>
                <button className="kb-column-add" onClick={() => setAdding(true)} title="Nova tarefa"><i className="fa-solid fa-plus"></i></button>
            </div>

            <div ref={setNodeRef} className={`kb-column-body ${isOver ? 'kb-column-body--over' : ''}`}>
                <SortableContext items={tarefas.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tarefas.map(t => (
                        <BoardCard key={t.id} tarefa={t} onClick={onCardClick} hidden={!cardVisivel(t)} />
                    ))}
                </SortableContext>

                {visiveis.length === 0 && !adding && (
                    <div className="kb-column-empty">Solte aqui</div>
                )}

                {adding && (
                    <div className="kb-quickadd">
                        <textarea
                            className="form-input" autoFocus value={titulo}
                            onChange={e => setTitulo(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmar(); }
                                if (e.key === 'Escape') { setAdding(false); setTitulo(''); }
                            }}
                            placeholder="Título da tarefa..."
                        />
                        <div className="kb-quickadd-actions">
                            <button className="btn-primary kb-mini" onClick={confirmar}><i className="fa-solid fa-check"></i></button>
                            <button className="btn-secondary kb-mini" onClick={() => { setAdding(false); setTitulo(''); }}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
                )}
            </div>

            {!adding && (
                <button className="kb-column-addfoot" onClick={() => setAdding(true)}>
                    <i className="fa-solid fa-plus"></i> Nova tarefa
                </button>
            )}
        </div>
    );
}
```

> **DnD com filtro:** os cards fora do filtro recebem `kb-card--hidden` (CSS `display:none`) mas **permanecem** no `SortableContext.items`, preservando a integridade da ordenação. Assim reordenar com filtro ativo não corrompe a ordem dos ocultos.

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add bussola_web/src/pages/Registros/components/kanban/BoardColumn.jsx
git commit -m "feat(tarefas): componente BoardColumn (droppable + quick-add)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `TarefaDetailPanel` (slide-over criar/editar)

**Files:**
- Create: `bussola_web/src/pages/Registros/components/kanban/TarefaDetailPanel.jsx`

**Interfaces:**
- Consumes: `SubtaskTree`, `COLUNAS`, `createTarefa`, `updateTarefa`, `deleteTarefa`, `DatePicker`, `useToast`, `useConfirm`, `framer-motion`.
- Produces: `<TarefaDetailPanel aberto tarefa onClose onSaved />`.
  - `tarefa = null` → modo criação. `onSaved()` → refetch do board.

- [ ] **Step 1: Implementar**

```jsx
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createTarefa, updateTarefa, deleteTarefa } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import { useConfirm } from '../../../../context/ConfirmDialogContext';
import { DatePicker } from '../../../../components/Pickers';
import { SubtaskTree } from './SubtaskTree';
import { COLUNAS, PRIO_COLORS } from './columns';

const PRIOS = ['Baixa', 'Média', 'Alta', 'Crítica'];

export function TarefaDetailPanel({ aberto, tarefa, onClose, onSaved }) {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const editando = !!tarefa;

    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [prioridade, setPrioridade] = useState('Média');
    const [status, setStatus] = useState('Pendente');
    const [prazo, setPrazo] = useState('');
    const [subtarefas, setSubtarefas] = useState([]);
    const [salvando, setSalvando] = useState(false);

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

    return (
        <AnimatePresence>
            {aberto && (
                <>
                    <motion.div
                        className="kb-panel-backdrop"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.aside
                        className="kb-panel registros-scope"
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.22 }}
                    >
                        <div className="kb-panel-head">
                            <h2>{editando ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
                            <button className="close-btn" onClick={onClose}>&times;</button>
                        </div>

                        <div className="kb-panel-body">
                            <div className="form-group">
                                <label>O que precisa ser feito?</label>
                                <input className="form-input" value={titulo} autoFocus
                                    onChange={e => setTitulo(e.target.value)} placeholder="Título..." />
                            </div>

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

                        <div className="kb-panel-foot">
                            {editando
                                ? <button className="btn-secondary danger" onClick={excluir}><i className="fa-solid fa-trash-can"></i> Excluir</button>
                                : <span />}
                            <div className="kb-panel-foot-right">
                                <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                                <button className="btn-primary" onClick={salvar} disabled={salvando}>
                                    {salvando ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}
                                </button>
                            </div>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
```

> **ESLint:** o reset do form usa o padrão "prev key" em render (não `setState` em `useEffect`). O `useEffect` só zera `prevId` quando fecha — não seta estado derivado de props de forma síncrona no fluxo de abertura.

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add bussola_web/src/pages/Registros/components/kanban/TarefaDetailPanel.jsx
git commit -m "feat(tarefas): slide-over de detalhe/edição (TarefaDetailPanel)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `TarefaBoard` (orquestrador DnD + toolbar)

**Files:**
- Create: `bussola_web/src/pages/Registros/components/kanban/TarefaBoard.jsx`

**Interfaces:**
- Consumes: `BoardColumn`, `BoardCard`, `TarefaDetailPanel`, `COLUNAS`, `COL_KEYS`, `keyToStatus`, `statusToKey`, `getTarefasBoard`, `reordenarTarefas`, `createTarefa`, `@dnd-kit/*`, `useToast`.
- Produces: `<TarefaBoard />` (sem props, self-fetch).

- [ ] **Step 1: Implementar**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
    useSensor, useSensors, closestCorners,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { getTarefasBoard, reordenarTarefas, createTarefa } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import { logger } from '../../../../utils/logger';
import { COLUNAS, COL_KEYS, keyToStatus, statusToKey, PRIO_COLORS } from './columns';
import { BoardColumn } from './BoardColumn';
import { BoardCard } from './BoardCard';
import { TarefaDetailPanel } from './TarefaDetailPanel';

const VAZIO = { a_fazer: [], em_andamento: [], concluido: [], cancelado: [] };
const PRIOS = ['Todas', 'Crítica', 'Alta', 'Média', 'Baixa'];

export function TarefaBoard() {
    const { addToast } = useToast();
    const [colunas, setColunas] = useState(VAZIO);
    const [loading, setLoading] = useState(true);
    const [activeTarefa, setActiveTarefa] = useState(null);

    const [busca, setBusca] = useState('');
    const [filtroPrio, setFiltroPrio] = useState('Todas');

    const [panelAberto, setPanelAberto] = useState(false);
    const [panelTarefa, setPanelTarefa] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const carregar = useCallback(async () => {
        try {
            const data = await getTarefasBoard();
            setColunas({
                a_fazer: data.a_fazer, em_andamento: data.em_andamento,
                concluido: data.concluido, cancelado: data.cancelado,
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

    const quickAdd = async (status, titulo) => {
        try {
            await createTarefa({ titulo, status });
            carregar();
        } catch (e) {
            logger.error('Erro no quick-add', { error: String(e) });
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao criar tarefa.' });
        }
    };

    const abrirNova = () => { setPanelTarefa(null); setPanelAberto(true); };
    const abrirCard = (t) => { setPanelTarefa(t); setPanelAberto(true); };

    const cardVisivel = (t) => {
        if (filtroPrio !== 'Todas' && t.prioridade !== filtroPrio) return false;
        if (busca) {
            const term = busca.toLowerCase();
            const emTitulo = t.titulo?.toLowerCase().includes(term);
            const emDesc = t.descricao?.toLowerCase().includes(term);
            if (!emTitulo && !emDesc) return false;
        }
        return true;
    };

    return (
        <div className="kb-board-scope">
            <div className="kb-toolbar">
                <div className="kb-toolbar-search">
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tarefa..." />
                </div>
                <select className="kb-toolbar-select" value={filtroPrio} onChange={e => setFiltroPrio(e.target.value)}>
                    {PRIOS.map(p => <option key={p} value={p}>{p === 'Todas' ? 'Prioridade' : p}</option>)}
                </select>
                <button className="btn-primary small-btn" onClick={abrirNova}>
                    <i className="fa-solid fa-plus"></i> Nova Tarefa
                </button>
            </div>

            {loading ? (
                <div className="kb-loading"><i className="fa-solid fa-circle-notch fa-spin"></i> Carregando board...</div>
            ) : (
                <DndContext
                    sensors={sensors} collisionDetection={closestCorners}
                    onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
                >
                    <div className="kb-board">
                        {COLUNAS.map(col => (
                            <BoardColumn
                                key={col.key} coluna={col} tarefas={colunas[col.key]}
                                cardVisivel={cardVisivel} onCardClick={abrirCard} onQuickAdd={quickAdd}
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
        </div>
    );
}
```

> `PRIO_COLORS` importado mas não usado diretamente aqui? Remover do import se o lint acusar `no-unused-vars` — o board usa só `COLUNAS/COL_KEYS/keyToStatus/statusToKey`. (Verificar no Step 2 e ajustar o import.)

- [ ] **Step 2: Verificar build + lint**

Run: `npm run build`
Expected: passa.
Run: `npm run lint 2>&1 | grep kanban` (ou revisar a saída)
Expected: **zero** erro novo nos arquivos `kanban/`. Se acusar `no-unused-vars` para `statusToKey`/`PRIO_COLORS`, remover do import.

- [ ] **Step 3: Commit**

```bash
git add bussola_web/src/pages/Registros/components/kanban/TarefaBoard.jsx
git commit -m "feat(tarefas): TarefaBoard — orquestração DnD com @dnd-kit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Estilos `kanban.css`

**Files:**
- Create: `bussola_web/src/pages/Registros/styles/kanban.css`
- Modify: `bussola_web/src/pages/Registros/components/kanban/TarefaBoard.jsx` (import do css)

**Interfaces:**
- Consumes: tokens `--cor-*`.
- Produces: classes `kb-*` usadas pelos componentes.

- [ ] **Step 1: Escrever o CSS**

```css
/* ===== Board Kanban de Tarefas ===== */
.kb-board-scope { display: flex; flex-direction: column; height: 100%; min-height: 0; }

.kb-toolbar { display: flex; gap: 10px; align-items: center; padding: 4px 2px 14px; flex-wrap: wrap; }
.kb-toolbar-search { position: relative; display: flex; align-items: center; }
.kb-toolbar-search i { position: absolute; left: 12px; color: var(--cor-texto-secundario); font-size: 0.85rem; }
.kb-toolbar-search input {
    padding: 9px 12px 9px 34px; border: 1px solid var(--cor-borda); border-radius: 10px;
    background: var(--cor-card-principal); color: var(--cor-texto-principal); min-width: 220px; outline: none;
}
.kb-toolbar-select {
    padding: 9px 12px; border: 1px solid var(--cor-borda); border-radius: 10px;
    background: var(--cor-card-principal); color: var(--cor-texto-principal); cursor: pointer;
}
.kb-toolbar .btn-primary { margin-left: auto; }

/* Colunas */
.kb-board { display: flex; gap: 14px; flex: 1; min-height: 0; overflow-x: auto; padding-bottom: 6px; }
.kb-column {
    display: flex; flex-direction: column; min-width: 280px; flex: 1 1 0; max-width: 360px;
    background: var(--cor-fundo-hover); border: 1px solid var(--cor-borda); border-radius: 14px; min-height: 0;
}
.kb-column-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; }
.kb-column-accent { width: 10px; height: 10px; border-radius: 50%; }
.kb-column-label { font-weight: 600; color: var(--cor-texto-principal); font-size: 0.92rem; }
.kb-column-count {
    font-size: 0.72rem; color: var(--cor-texto-secundario); background: var(--cor-card-secundario);
    padding: 1px 8px; border-radius: 20px;
}
.kb-column-add { margin-left: auto; background: none; border: none; color: var(--cor-texto-secundario); cursor: pointer; padding: 4px; border-radius: 6px; }
.kb-column-add:hover { background: var(--cor-fundo-hover); color: var(--cor-texto-principal); }

.kb-column-body { flex: 1; overflow-y: auto; padding: 4px 10px 10px; display: flex; flex-direction: column; gap: 8px; min-height: 60px; transition: background 0.15s; border-radius: 0 0 14px 14px; }
.kb-column-body--over { background: rgba(var(--cor-tema-rgb), 0.06); }
.kb-column-empty { text-align: center; color: var(--cor-texto-secundario); font-size: 0.82rem; padding: 18px; border: 1px dashed var(--cor-borda); border-radius: 10px; opacity: 0.7; }
.kb-column-addfoot { margin: 0 10px 10px; background: none; border: none; color: var(--cor-texto-secundario); cursor: pointer; text-align: left; padding: 8px; border-radius: 8px; font-size: 0.85rem; }
.kb-column-addfoot:hover { background: var(--cor-fundo-hover); color: var(--cor-texto-principal); }

/* Card */
.kb-card {
    display: flex; gap: 0; background: var(--cor-card-principal); border: 1px solid var(--cor-borda);
    border-radius: 10px; overflow: hidden; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s;
}
.kb-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.18); }
.kb-card--hidden { display: none; }
.kb-card--overlay { box-shadow: 0 12px 28px rgba(0,0,0,0.35); transform: rotate(2deg); cursor: grabbing; }
.kb-card-prio { width: 4px; flex-shrink: 0; }
.kb-card-body { padding: 10px 12px; flex: 1; min-width: 0; }
.kb-card-top { display: flex; align-items: flex-start; gap: 6px; }
.kb-card-title { margin: 0; font-size: 0.9rem; font-weight: 500; color: var(--cor-texto-principal); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kb-card-pin { color: var(--cor-laranja-aviso); font-size: 0.75rem; margin-left: auto; }
.kb-card-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.kb-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; color: var(--cor-texto-secundario); background: var(--cor-fundo-hover); padding: 2px 7px; border-radius: 6px; }
.kb-chip--late { color: #fff; background: var(--cor-vermelho-delete); }
.kb-card-progress { height: 4px; background: var(--cor-fundo-hover); border-radius: 4px; margin-top: 8px; overflow: hidden; }
.kb-card-progress-fill { height: 100%; background: var(--cor-verde-sucesso); border-radius: 4px; transition: width 0.2s; }

/* Quick-add */
.kb-quickadd { display: flex; flex-direction: column; gap: 6px; background: var(--cor-card-principal); border: 1px solid var(--cor-borda); border-radius: 10px; padding: 8px; }
.kb-quickadd textarea { resize: none; min-height: 46px; }
.kb-quickadd-actions { display: flex; gap: 6px; justify-content: flex-end; }
.kb-mini { width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; }

/* Loading */
.kb-loading { padding: 3rem; text-align: center; color: var(--cor-texto-secundario); }
.kb-loading i { color: var(--cor-azul-primario); margin-right: 8px; }

/* Slide-over */
.kb-panel-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(3px); z-index: 1000; }
.kb-panel {
    position: fixed; top: 0; right: 0; height: 100%; width: 440px; max-width: 92vw; z-index: 1001;
    background: var(--cor-card-principal); border-left: 1px solid var(--cor-borda);
    display: flex; flex-direction: column; box-shadow: -8px 0 30px rgba(0,0,0,0.25);
}
.kb-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--cor-borda); }
.kb-panel-head h2 { margin: 0; font-size: 1.1rem; color: var(--cor-texto-principal); }
.kb-panel-body { flex: 1; overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
.kb-panel-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--cor-borda); }
.kb-panel-foot-right { display: flex; gap: 8px; margin-left: auto; }
.btn-secondary.danger { color: var(--cor-vermelho-delete); }

/* Editor de subtarefas */
.kb-subtree { display: flex; flex-direction: column; gap: 6px; }
.kb-tree-addroot, .kb-tree-add { display: flex; gap: 6px; }
.kb-tree-node { display: flex; flex-direction: column; }
.kb-tree-row { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px; }
.kb-tree-row:hover { background: var(--cor-fundo-hover); }
.kb-tree-check { cursor: pointer; color: var(--cor-texto-secundario); }
.kb-tree-title { flex: 1; font-size: 0.88rem; color: var(--cor-texto-principal); }
.kb-riscado { text-decoration: line-through; opacity: 0.55; }
.kb-tree-actions { display: flex; gap: 2px; }
.kb-icon-btn { background: none; border: none; color: var(--cor-texto-secundario); cursor: pointer; padding: 4px; border-radius: 5px; }
.kb-icon-btn:hover { background: var(--cor-card-secundario); }
.kb-icon-btn.danger:hover { color: var(--cor-vermelho-delete); }
.kb-tree-children { padding-left: 18px; border-left: 1px solid var(--cor-borda); margin-left: 8px; }
.kb-tree-empty { font-size: 0.82rem; color: var(--cor-texto-secundario); padding: 8px 0; }
```

- [ ] **Step 2: Importar o CSS no board**

No topo de `TarefaBoard.jsx`, adicionar após os imports de componentes:

```jsx
import '../../styles/kanban.css';
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add bussola_web/src/pages/Registros/styles/kanban.css bussola_web/src/pages/Registros/components/kanban/TarefaBoard.jsx
git commit -m "feat(tarefas): estilos do board kanban (kanban.css)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Integrar no `index.jsx` (aba Tarefas → board)

**Files:**
- Modify: `bussola_web/src/pages/Registros/index.jsx`

**Interfaces:**
- Consumes: `<TarefaBoard/>`.

- [ ] **Step 1: Importar o board e remover imports mortos**

No topo de `index.jsx`:
- Adicionar: `import { TarefaBoard } from './components/kanban/TarefaBoard';`
- Remover os imports agora não usados na aba: `TarefaCard`, `TarefaModal` (só se não forem usados em outro lugar do arquivo — confirmar com busca).

- [ ] **Step 2: Substituir o conteúdo da aba Tarefas**

Trocar TODO o bloco `{activeTab === 'tarefas' && ( ... )}` (o `<div className="column-scroll-content">` com `tarefas-grid` e o acordeão de concluídas) por:

```jsx
                {/* CONTEÚDO: TAREFAS (Board Kanban) */}
                {activeTab === 'tarefas' && (
                    <div className="column-scroll-content" style={{ display: 'flex', flexDirection: 'column' }}>
                        <TarefaBoard />
                    </div>
                )}
```

- [ ] **Step 3: Remover o header-actions e o estado de filtro de tarefas**

- Remover o bloco `{activeTab === 'tarefas' && ( <div className="header-actions-group"> ... </div> )}` do header (os dropdowns de período/prioridade e o botão "Nova Tarefa" — agora vivem na toolbar do board).
- Remover os estados órfãos: `prioDropdownOpen`, `filtroPrioridade`, `dataDropdownOpen`, `filtroData`, `showConcluidas`, e o `useMemo` `{ tarefasPendentes, tarefasConcluidas }` + as constantes `tarefasPendentesRaw`/`tarefasConcluidasRaw` + `handleNewTarefa`/`handleEditTarefa`/`editingTarefa`/`tarefaModalOpen`.
- Remover o `<TarefaModal ... />` do bloco de MODAIS.
- Remover as constantes `PRIORIDADES` e `FILTROS_DATA` do topo se ficarem sem uso.

> Cuidado: fazer isso incrementalmente e rodar `npm run build` a cada remoção — o build acusa símbolo não definido, o lint acusa `no-unused-vars`.

- [ ] **Step 4: Verificar build + lint**

Run: `npm run build`
Expected: passa.
Run: `npm run lint`
Expected: **nenhum erro NOVO** em `index.jsx` (comparar com a baseline de ~40 erros pré-existentes; os arquivos tocados devem sair limpos).

- [ ] **Step 5: Commit**

```bash
git add bussola_web/src/pages/Registros/index.jsx
git commit -m "feat(tarefas): aba Tarefas passa a renderizar o Board kanban

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Verificação end-to-end + limpeza

**Files:**
- Verify/Delete: `bussola_web/src/pages/Registros/components/TarefaCard.jsx`, `TarefaModal.jsx`

- [ ] **Step 1: Rodar a suíte de backend inteira**

Run (em `bussola_api/`): `venvbussola/Scripts/python.exe -m pytest -q`
Expected: tudo verde (incluindo `test_registros_board.py` e `test_migrations.py`).

- [ ] **Step 2: Confirmar que `TarefaCard`/`TarefaModal` estão órfãos**

Run: `grep -rn "TarefaCard\|TarefaModal" bussola_web/src`
Expected: apenas as próprias definições. Se estiverem órfãos, deletar os dois arquivos.

- [ ] **Step 3: Build final**

Run (em `bussola_web/`): `npm run build`
Expected: passa.

- [ ] **Step 4: Subir a aplicação e testar manualmente (o gate real de frontend)**

Backend: `uvicorn app.main:app --reload --port 8000` · Frontend: `npm run dev`.
Checklist manual em `/registros` → aba **Tarefas**:
- [ ] As 4 colunas aparecem com contadores.
- [ ] Arrastar card entre colunas muda a coluna e persiste após refresh.
- [ ] Arrastar dentro da coluna reordena e persiste após refresh.
- [ ] Soltar em "Concluído" mantém o card lá; soltar em outra limpa a conclusão.
- [ ] Quick-add cria card na coluna certa.
- [ ] Clicar no card abre o painel deslizante; salvar/excluir funcionam.
- [ ] "Nova Tarefa" abre o painel em branco e cria.
- [ ] Busca e filtro de prioridade ocultam/mostram cards sem quebrar o arraste.
- [ ] Tema claro e escuro renderizam corretamente.

- [ ] **Step 5: Commit da limpeza (se houve deleção)**

```bash
git add -A
git commit -m "chore(tarefas): remove TarefaCard/TarefaModal órfãos após o board

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (feita pelo autor do plano)

**Cobertura do spec:**
- §3.1 modelo `ordem`/`Cancelado` → Task 1. §3.2 migração → Task 1.
- §4.1 schemas → Task 3 (board + ordem) e Task 4 (reordenar). §4.2 service → Tasks 2/3/4. §4.3 endpoints → Tasks 3/4. §4.4 testes → Tasks 1-4.
- §5.1 deps → Task 5. §5.2 serviços → Task 5. §5.3 componentes → Tasks 6-10. §5.4 index → Task 12. §5.5 estilos → Task 11.
- §6 casos de borda (otimista+rollback, atrasado, cap 200, conclusão) → Tasks 3/4/10.
- §7 gate/regras → verificações de build+lint em cada task de FE; `test_migrations` na Task 1.

**Placeholders:** `<hash>`/`<head anterior>` são preenchidos pelo `alembic revision` (Step 5/6 da Task 1) — não são TODOs. Nenhum "TBD"/"implementar depois".

**Consistência de tipos/nomes:** `get_board_data`, `reordenar_tarefas`, `TarefaBoardResponse(a_fazer/em_andamento/concluido/cancelado)`, `ReordenarTarefasRequest(status, tarefa_ids)`, `getTarefasBoard`, `reordenarTarefas(status, tarefaIds)`, `keyToStatus/statusToKey`, `COLUNAS/COL_KEYS` — usados de forma idêntica entre backend, `api.ts` e componentes.

**Riscos anotados:** ordem de rotas (`/tarefas/board` e `/tarefas/reordenar` antes de `{id}`); imports possivelmente não usados no board (ajustar por lint); remoção incremental no `index.jsx` com build a cada passo.
