# Metas & Cofrinhos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao módulo Finanças um sistema de Metas (cofrinhos): objetivos com valor-alvo onde o usuário guarda dinheiro (avulso ou aporte mensal confirmável), com contabilidade de transferência neutra e uma tela imersiva 2.5D de arrastar moeda pro baú.

**Architecture:** Backend FastAPI em camadas (`endpoints → services → models`) espelhando o módulo Finanças; duas tabelas novas (`Meta`, `MovimentacaoMeta`) com `saldo_atual` denormalizado. Aporte é transferência neutra: reduz o "Disponível" (`Total − Guardado`) sem virar despesa. Frontend React 19 numa rota dedicada `/metas`, com a cena lúdica em Framer Motion (2.5D via CSS 3D, sem WebGL).

**Tech Stack:** Python 3.12, FastAPI 0.123, SQLAlchemy 2.0, Alembic 1.17, Pydantic 2.12, pytest (novo), React 19, Vite 7, react-router-dom 7, Chart.js 4 (já instalado), framer-motion (novo).

## Global Constraints

- **Contabilidade — transferência neutra:** aporte NUNCA cria uma `Transacao` de despesa. Invariante em todo o sistema: `Total = Disponível + Guardado`, onde `Guardado = Σ saldo_atual das metas ativas` e `Total = saldo bruto de Finanças (receitas − despesas efetivadas)`.
- **`saldo_atual` é cache denormalizado:** sempre re-derivável de `Σ MovimentacaoMeta` efetivadas (`aporte` soma, `retirada` subtrai). Toda mutação de movimentação recalcula.
- **Isolamento por usuário:** toda query filtra por `user_id`. Todo registro grava `user_id`.
- **Padrões do repo:** models herdam de `app.db.base_class.Base`; datas default via `app.core.timezone.now_utc`; services são um singleton instanciado no fim do arquivo (ex.: `metas_service = MetasService()`); endpoints injetam `deps.get_db` e `deps.get_current_user`; prefixo dos endpoints `/financas/metas`, tag `metas`.
- **Aporte manual** nasce `status='Efetivada'`; **aporte agendado** nasce `status='Pendente'`.
- **Moeda:** floats com `round(x, 2)` nos cálculos monetários (mesmo padrão do algoritmo de centavos de `financas.py`).
- **Fora do MVP:** round-up, rendimento/juros, metas compartilhadas, WebGL.

---

## File Structure

**Backend (`bussola_api/`)**
- `app/models/metas.py` — CREATE — modelos `Meta`, `MovimentacaoMeta`.
- `app/models/__init__.py` — MODIFY — exportar os modelos novos (Alembic os detecta).
- `app/models/user.py` — MODIFY — `relationship("Meta", back_populates="user")`.
- `app/schemas/metas.py` — CREATE — enums + DTOs.
- `app/services/metas.py` — CREATE — `MetasService` (CRUD, aporte/retirada, projeção, KPIs, aporte mensal).
- `app/api/v1/endpoints/metas.py` — CREATE — router de endpoints.
- `app/api/v1/router.py` — MODIFY — registrar o router de metas.
- `app/services/financas.py` + `app/schemas/financas.py` — MODIFY — bloco `resumo_patrimonio` (3 KPIs).
- `tests/conftest.py`, `tests/test_metas_service.py` — CREATE — infra + testes.
- `requirements-dev.txt` — CREATE — pytest.
- Migration Alembic — CREATE (autogenerate).

**Frontend (`bussola_web/`)**
- `src/pages/Metas/index.jsx` — CREATE — grade de cofrinhos + KPIs.
- `src/pages/Metas/CofreScene.jsx` — CREATE — cena 2.5D (drag da moeda → baú).
- `src/pages/Metas/components/MetaCard.jsx` — CREATE.
- `src/pages/Metas/components/Coin.jsx` — CREATE.
- `src/pages/Metas/components/MetaModals.jsx` — CREATE — criar/editar/retirar/config aporte mensal.
- `src/pages/Metas/components/MetaHistorico.jsx` — CREATE — Chart.js + timeline.
- `src/pages/Metas/components/Confetti.jsx` — CREATE — confete CSS.
- `src/pages/Metas/styles.css` — CREATE.
- `src/services/api.js` — MODIFY — wrappers HTTP.
- `src/routes/index.jsx` — MODIFY — rotas `/metas` e `/metas/:id`.
- `src/components/Navbar.jsx` — MODIFY — item "Metas".
- `src/pages/Financas/index.jsx` — MODIFY — 3 KPIs no header + atalho pra Metas.

---

# PHASE 1 — Backend: fundação + CRUD de Metas

### Task 1: Infra de testes (pytest + sessão in-memory + override de auth)

**Files:**
- Create: `bussola_api/requirements-dev.txt`
- Create: `bussola_api/tests/__init__.py`
- Create: `bussola_api/tests/conftest.py`
- Create: `bussola_api/pytest.ini`

**Interfaces:**
- Produces: fixtures `db` (Session SQLAlchemy sobre SQLite in-memory) e `user` (um `User` persistido); helper `client` (FastAPI `TestClient` com `get_db`/`get_current_user` sobrescritos para o `user` de teste).

- [ ] **Step 1: Declarar dependência de teste**

Create `bussola_api/requirements-dev.txt`:
```
pytest==8.3.4
httpx==0.28.1
```

- [ ] **Step 2: Instalar**

Run (no venv do backend): `pip install -r requirements-dev.txt`
Expected: `Successfully installed pytest-8.3.4 ...` (httpx já presente).

- [ ] **Step 3: Config do pytest**

Create `bussola_api/pytest.ini`:
```ini
[pytest]
pythonpath = .
testpaths = tests
```

- [ ] **Step 4: Package de testes**

Create `bussola_api/tests/__init__.py` (arquivo vazio).

- [ ] **Step 5: conftest com DB in-memory e override de auth**

Create `bussola_api/tests/conftest.py`:
```python
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db.base_class import Base
import app.models  # noqa: F401 — registra todas as tabelas no metadata
from app.main import app
from app.api import deps
from app.models.user import User


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def user(db):
    u = User(email="teste@bussola.dev", hashed_password="x", is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def client(db, user):
    app.dependency_overrides[deps.get_db] = lambda: db
    app.dependency_overrides[deps.get_current_user] = lambda: user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 6: Rodar pytest vazio pra validar a infra**

Run: `pytest -q`
Expected: `no tests ran` (exit 0) — sem erros de import. Se `User(...)` reclamar de campo obrigatório, ajuste o fixture `user` para os campos NOT NULL reais de `app/models/user.py`.

- [ ] **Step 7: Commit**

```bash
git add bussola_api/requirements-dev.txt bussola_api/pytest.ini bussola_api/tests/
git commit -m "test(metas): infra de testes pytest com sqlite in-memory e override de auth"
```

---

### Task 2: Modelos `Meta` e `MovimentacaoMeta` + registro + migration

**Files:**
- Create: `bussola_api/app/models/metas.py`
- Modify: `bussola_api/app/models/__init__.py`
- Modify: `bussola_api/app/models/user.py`
- Test: `bussola_api/tests/test_metas_service.py`

**Interfaces:**
- Produces: `Meta` (colunas: `id, user_id, nome, valor_alvo, saldo_atual, data_alvo, icone, cor, imagem_url, trancada, status, aporte_mensal_valor, aporte_mensal_dia, created_at, concluida_em`, rel. `movimentacoes`); `MovimentacaoMeta` (colunas: `id, meta_id, user_id, tipo, valor, data, status, origem, id_grupo_recorrencia, observacao`).

- [ ] **Step 1: Teste de criação persistente**

Create `bussola_api/tests/test_metas_service.py`:
```python
from datetime import date
from app.models.metas import Meta, MovimentacaoMeta


def test_meta_persiste_com_defaults(db, user):
    m = Meta(nome="Comprar carro", valor_alvo=50000.0, user_id=user.id)
    db.add(m)
    db.commit()
    db.refresh(m)
    assert m.id is not None
    assert m.saldo_atual == 0.0
    assert m.status == "ativa"
    assert m.trancada is False
    assert m.icone == "fa-solid fa-piggy-bank"


def test_movimentacao_relaciona_com_meta(db, user):
    m = Meta(nome="Viagem", valor_alvo=8000.0, user_id=user.id)
    db.add(m)
    db.commit()
    mov = MovimentacaoMeta(meta_id=m.id, user_id=user.id, tipo="aporte", valor=200.0)
    db.add(mov)
    db.commit()
    db.refresh(m)
    assert len(m.movimentacoes) == 1
    assert m.movimentacoes[0].status == "Efetivada"
    assert m.movimentacoes[0].origem == "manual"
```

- [ ] **Step 2: Rodar teste (deve falhar)**

Run: `pytest tests/test_metas_service.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.metas'`.

- [ ] **Step 3: Criar os modelos**

Create `bussola_api/app/models/metas.py`:
```python
"""
=======================================================================================
ARQUIVO: metas.py (Modelo de Dados - Metas & Cofrinhos)
=======================================================================================

OBJETIVO:
    Definir as entidades do sistema de metas de poupança (cofrinhos): o objetivo
    (Meta) e o extrato de movimentações (aportes/retiradas).

RESPONSABILIDADES:
    1. Meta: objetivo com valor-alvo e saldo acumulado (cache denormalizado).
    2. MovimentacaoMeta: cada aporte ou retirada; reusa status Pendente/Efetivada.
=======================================================================================
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from app.core.timezone import now_utc


class Meta(Base):
    """Cofrinho: um objetivo de poupança com valor-alvo e saldo acumulado."""
    __tablename__ = "meta"

    id = Column(Integer, primary_key=True)
    nome = Column(String(150), nullable=False)
    valor_alvo = Column(Float, nullable=False)

    # Cache denormalizado: soma das movimentações efetivadas (aporte − retirada).
    saldo_atual = Column(Float, nullable=False, default=0.0)

    data_alvo = Column(Date, nullable=True)

    icone = Column(String(50), nullable=True, default="fa-solid fa-piggy-bank")
    cor = Column(String(7), nullable=True, default="#4f46e5")
    imagem_url = Column(String(500), nullable=True)

    trancada = Column(Boolean, nullable=False, default=False)
    status = Column(String(50), nullable=False, default="ativa")  # ativa|concluida|arquivada

    aporte_mensal_valor = Column(Float, nullable=True)
    aporte_mensal_dia = Column(Integer, nullable=True)

    created_at = Column(DateTime, nullable=False, default=now_utc)
    concluida_em = Column(DateTime, nullable=True)

    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="metas")

    movimentacoes = relationship(
        "MovimentacaoMeta",
        back_populates="meta",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class MovimentacaoMeta(Base):
    """Extrato do cofrinho: um aporte ou retirada."""
    __tablename__ = "movimentacao_meta"

    id = Column(Integer, primary_key=True)
    meta_id = Column(Integer, ForeignKey("meta.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)

    tipo = Column(String(20), nullable=False)  # aporte|retirada
    valor = Column(Float, nullable=False)       # sempre positivo; 'tipo' define o sinal
    data = Column(DateTime, nullable=False, default=now_utc)

    status = Column(String(50), nullable=False, default="Efetivada")  # Pendente|Efetivada
    origem = Column(String(20), nullable=False, default="manual")     # manual|agendado
    id_grupo_recorrencia = Column(String(100), nullable=True, index=True)
    observacao = Column(String(300), nullable=True)

    meta = relationship("Meta", back_populates="movimentacoes")
```

- [ ] **Step 4: Registrar no `__init__.py` dos modelos**

Modify `bussola_api/app/models/__init__.py` — adicionar após a linha de import de `financas`:
```python
from .metas import Meta, MovimentacaoMeta
```

- [ ] **Step 5: Adicionar o back_populates em User**

Modify `bussola_api/app/models/user.py` — na classe `User`, junto dos outros `relationship`, adicionar:
```python
metas = relationship("Meta", back_populates="user", cascade="all, delete-orphan")
```

- [ ] **Step 6: Rodar teste (deve passar)**

Run: `pytest tests/test_metas_service.py -q`
Expected: PASS (2 passed).

- [ ] **Step 7: Gerar a migration**

Run: `alembic revision --autogenerate -m "add metas e movimentacao_meta"`
Expected: cria arquivo em `alembic/versions/` com `create_table('meta')` e `create_table('movimentacao_meta')`. Abrir o arquivo e conferir que ambas as tabelas aparecem no `upgrade()`. Se vier vazio, confirmar que `alembic/env.py` importa `app.models` (o metadata).

- [ ] **Step 8: Aplicar a migration**

Run: `alembic upgrade head`
Expected: `Running upgrade ... , add metas e movimentacao_meta`.

- [ ] **Step 9: Commit**

```bash
git add bussola_api/app/models/ bussola_api/tests/test_metas_service.py bussola_api/alembic/versions/
git commit -m "feat(metas): modelos Meta e MovimentacaoMeta + migration"
```

---

### Task 3: Schemas (DTOs + enums)

**Files:**
- Create: `bussola_api/app/schemas/metas.py`

**Interfaces:**
- Produces: `MetaCreate`, `MetaUpdate`, `MetaResponse` (campos calculados: `progresso_pct: float`, `aporte_sugerido: float | None`, `data_projetada: date | None`, `meses_restantes: int | None`), `MovimentacaoCreate`, `MovimentacaoResponse`, `ResumoPatrimonio` (`disponivel, guardado, total`), `MetasDashboardResponse` (`metas: list[MetaResponse]`, `resumo: ResumoPatrimonio`, `icones_disponiveis`, `cores_disponiveis`).

- [ ] **Step 1: Criar os schemas**

Create `bussola_api/app/schemas/metas.py`:
```python
"""Schemas (DTOs) do módulo Metas & Cofrinhos."""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class TipoMovimentacao(str, Enum):
    APORTE = "aporte"
    RETIRADA = "retirada"


class OrigemMovimentacao(str, Enum):
    MANUAL = "manual"
    AGENDADO = "agendado"


class StatusMeta(str, Enum):
    ATIVA = "ativa"
    CONCLUIDA = "concluida"
    ARQUIVADA = "arquivada"


class StatusMov(str, Enum):
    PENDENTE = "Pendente"
    EFETIVADA = "Efetivada"


# ---------- META ----------
class MetaBase(BaseModel):
    nome: str
    valor_alvo: float
    data_alvo: Optional[date] = None
    icone: Optional[str] = "fa-solid fa-piggy-bank"
    cor: Optional[str] = "#4f46e5"
    imagem_url: Optional[str] = None
    trancada: bool = False
    aporte_mensal_valor: Optional[float] = None
    aporte_mensal_dia: Optional[int] = None


class MetaCreate(MetaBase):
    pass


class MetaUpdate(BaseModel):
    nome: Optional[str] = None
    valor_alvo: Optional[float] = None
    data_alvo: Optional[date] = None
    icone: Optional[str] = None
    cor: Optional[str] = None
    imagem_url: Optional[str] = None
    trancada: Optional[bool] = None
    status: Optional[StatusMeta] = None
    aporte_mensal_valor: Optional[float] = None
    aporte_mensal_dia: Optional[int] = None


class MetaResponse(MetaBase):
    id: int
    saldo_atual: float
    status: StatusMeta
    created_at: datetime
    concluida_em: Optional[datetime] = None

    # Campos calculados on-the-fly
    progresso_pct: float = 0.0
    aporte_sugerido: Optional[float] = None
    data_projetada: Optional[date] = None
    meses_restantes: Optional[int] = None

    class Config:
        from_attributes = True


# ---------- MOVIMENTAÇÃO ----------
class MovimentacaoCreate(BaseModel):
    tipo: TipoMovimentacao
    valor: float
    data: Optional[datetime] = None
    observacao: Optional[str] = None


class MovimentacaoResponse(BaseModel):
    id: int
    meta_id: int
    tipo: TipoMovimentacao
    valor: float
    data: datetime
    status: StatusMov
    origem: OrigemMovimentacao
    observacao: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- DASHBOARD ----------
class ResumoPatrimonio(BaseModel):
    disponivel: float
    guardado: float
    total: float


class MetasDashboardResponse(BaseModel):
    metas: List[MetaResponse]
    resumo: ResumoPatrimonio
    icones_disponiveis: List[str]
    cores_disponiveis: List[str]
```

- [ ] **Step 2: Sanidade de import**

Run: `python -c "from app.schemas.metas import MetasDashboardResponse; print('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add bussola_api/app/schemas/metas.py
git commit -m "feat(metas): schemas (DTOs e enums)"
```

---

### Task 4: Service — CRUD + recomputo de saldo

**Files:**
- Modify: `bussola_api/app/services/metas.py` (Create)
- Test: `bussola_api/tests/test_metas_service.py`

**Interfaces:**
- Produces (singleton `metas_service`):
  - `criar_meta(db, meta_in: MetaCreate, user_id: int) -> Meta`
  - `atualizar_meta(db, meta_id: int, meta_in: MetaUpdate, user_id: int) -> Meta | None`
  - `deletar_meta(db, meta_id: int, user_id: int) -> bool`
  - `listar_metas(db, user_id: int) -> list[Meta]`
  - `_recompute_saldo(db, meta: Meta) -> None` (recalcula `saldo_atual` de `Σ` movimentações efetivadas; ajusta `status`/`concluida_em`).

- [ ] **Step 1: Testes de CRUD + recomputo**

Adicionar em `bussola_api/tests/test_metas_service.py`:
```python
from app.services.metas import metas_service
from app.schemas.metas import MetaCreate, MetaUpdate


def test_criar_e_listar_meta(db, user):
    metas_service.criar_meta(db, MetaCreate(nome="Carro", valor_alvo=50000.0), user.id)
    metas = metas_service.listar_metas(db, user.id)
    assert len(metas) == 1
    assert metas[0].nome == "Carro"
    assert metas[0].saldo_atual == 0.0


def test_listar_isola_por_usuario(db, user):
    metas_service.criar_meta(db, MetaCreate(nome="Minha", valor_alvo=100.0), user.id)
    assert metas_service.listar_metas(db, user_id=99999) == []


def test_recompute_saldo_soma_aportes_menos_retiradas(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="Viagem", valor_alvo=1000.0), user.id)
    db.add(MovimentacaoMeta(meta_id=m.id, user_id=user.id, tipo="aporte", valor=300.0))
    db.add(MovimentacaoMeta(meta_id=m.id, user_id=user.id, tipo="retirada", valor=100.0))
    db.add(MovimentacaoMeta(meta_id=m.id, user_id=user.id, tipo="aporte", valor=50.0,
                            status="Pendente"))  # pendente NÃO conta
    db.commit()
    metas_service._recompute_saldo(db, m)
    assert m.saldo_atual == 200.0


def test_atualizar_meta(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="X", valor_alvo=1.0), user.id)
    out = metas_service.atualizar_meta(db, m.id, MetaUpdate(nome="Y", valor_alvo=2.0), user.id)
    assert out.nome == "Y" and out.valor_alvo == 2.0


def test_deletar_meta(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="X", valor_alvo=1.0), user.id)
    assert metas_service.deletar_meta(db, m.id, user.id) is True
    assert metas_service.listar_metas(db, user.id) == []
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pytest tests/test_metas_service.py -q`
Expected: FAIL — `No module named 'app.services.metas'`.

- [ ] **Step 3: Criar o service**

Create `bussola_api/app/services/metas.py`:
```python
"""
=======================================================================================
ARQUIVO: metas.py (Serviço de Domínio - Metas & Cofrinhos)
=======================================================================================
OBJETIVO:
    Lógica do sistema de metas: CRUD, aportes/retiradas (transferência neutra),
    projeção de data-alvo, KPIs de patrimônio e aporte mensal agendado.
=======================================================================================
"""

from app.core.timezone import now_utc
from app.models.metas import Meta, MovimentacaoMeta
from app.schemas.metas import MetaCreate, MetaUpdate


class MetasService:

    # ---------- helpers internos ----------
    def _get_meta(self, db, meta_id, user_id):
        return (
            db.query(Meta)
            .filter(Meta.id == meta_id, Meta.user_id == user_id)
            .first()
        )

    def _recompute_saldo(self, db, meta: Meta) -> None:
        """Recalcula saldo_atual a partir das movimentações EFETIVADAS."""
        efetivadas = [m for m in meta.movimentacoes if m.status == "Efetivada"]
        total = sum(
            (m.valor if m.tipo == "aporte" else -m.valor) for m in efetivadas
        )
        meta.saldo_atual = round(total, 2)

        if meta.saldo_atual >= meta.valor_alvo and meta.status == "ativa":
            meta.status = "concluida"
            meta.concluida_em = now_utc()
        elif meta.saldo_atual < meta.valor_alvo and meta.status == "concluida":
            meta.status = "ativa"
            meta.concluida_em = None
        db.commit()
        db.refresh(meta)

    # ---------- CRUD ----------
    def criar_meta(self, db, meta_in: MetaCreate, user_id: int) -> Meta:
        meta = Meta(**meta_in.model_dump(), user_id=user_id)
        db.add(meta)
        db.commit()
        db.refresh(meta)
        return meta

    def listar_metas(self, db, user_id: int):
        return (
            db.query(Meta)
            .filter(Meta.user_id == user_id)
            .order_by(Meta.created_at.desc())
            .all()
        )

    def atualizar_meta(self, db, meta_id, meta_in: MetaUpdate, user_id) -> Meta | None:
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return None
        for field, value in meta_in.model_dump(exclude_unset=True).items():
            setattr(meta, field, value)
        db.commit()
        db.refresh(meta)
        # alvo pode ter mudado → reavaliar status
        self._recompute_saldo(db, meta)
        return meta

    def deletar_meta(self, db, meta_id, user_id) -> bool:
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return False
        db.delete(meta)
        db.commit()
        return True


metas_service = MetasService()
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `pytest tests/test_metas_service.py -q`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add bussola_api/app/services/metas.py bussola_api/tests/test_metas_service.py
git commit -m "feat(metas): service CRUD + recomputo de saldo denormalizado"
```

---

### Task 5: Service — aporte / retirada / locked

**Files:**
- Modify: `bussola_api/app/services/metas.py`
- Test: `bussola_api/tests/test_metas_service.py`

**Interfaces:**
- Consumes: `metas_service._get_meta`, `metas_service._recompute_saldo`.
- Produces:
  - `criar_movimentacao(db, meta_id, mov_in: MovimentacaoCreate, user_id) -> MovimentacaoMeta` (raise `ValueError` em regra violada).
  - `deletar_movimentacao(db, meta_id, mov_id, user_id) -> bool`.
  - `listar_movimentacoes(db, meta_id, user_id) -> list[MovimentacaoMeta]`.

- [ ] **Step 1: Testes de aporte/retirada/locked**

Adicionar em `bussola_api/tests/test_metas_service.py`:
```python
import pytest
from app.schemas.metas import MovimentacaoCreate


def test_aporte_incrementa_saldo(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=1000.0), user.id)
    metas_service.criar_movimentacao(
        db, m.id, MovimentacaoCreate(tipo="aporte", valor=250.0), user.id
    )
    assert metas_service._get_meta(db, m.id, user.id).saldo_atual == 250.0


def test_aporte_que_bate_alvo_conclui(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=100.0), user.id)
    metas_service.criar_movimentacao(
        db, m.id, MovimentacaoCreate(tipo="aporte", valor=100.0), user.id
    )
    out = metas_service._get_meta(db, m.id, user.id)
    assert out.status == "concluida" and out.concluida_em is not None


def test_retirada_alem_do_saldo_falha(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=1000.0), user.id)
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=50.0), user.id)
    with pytest.raises(ValueError, match="saldo"):
        metas_service.criar_movimentacao(
            db, m.id, MovimentacaoCreate(tipo="retirada", valor=80.0), user.id
        )


def test_retirada_em_meta_trancada_falha(db, user):
    m = metas_service.criar_meta(
        db, MetaCreate(nome="V", valor_alvo=1000.0, trancada=True), user.id
    )
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=200.0), user.id)
    with pytest.raises(ValueError, match="trancada"):
        metas_service.criar_movimentacao(
            db, m.id, MovimentacaoCreate(tipo="retirada", valor=100.0), user.id
        )


def test_deletar_movimentacao_recalcula_saldo(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=1000.0), user.id)
    mov = metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=200.0), user.id)
    metas_service.deletar_movimentacao(db, m.id, mov.id, user.id)
    assert metas_service._get_meta(db, m.id, user.id).saldo_atual == 0.0
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pytest tests/test_metas_service.py -q`
Expected: FAIL — `AttributeError: 'MetasService' object has no attribute 'criar_movimentacao'`.

- [ ] **Step 3: Implementar**

Adicionar os imports e métodos em `bussola_api/app/services/metas.py`. No topo, ampliar o import de schemas:
```python
from app.schemas.metas import MetaCreate, MetaUpdate, MovimentacaoCreate
```
Dentro da classe `MetasService`, antes de `metas_service = MetasService()`:
```python
    # ---------- movimentações ----------
    def _pode_retirar(self, meta: Meta) -> bool:
        """Meta trancada só libera retirada se concluída ou se a data-alvo já passou."""
        if not meta.trancada:
            return True
        if meta.status == "concluida":
            return True
        if meta.data_alvo and meta.data_alvo <= now_utc().date():
            return True
        return False

    def criar_movimentacao(self, db, meta_id, mov_in: MovimentacaoCreate, user_id):
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            raise ValueError("Meta não encontrada")

        if mov_in.tipo == "retirada":
            if not self._pode_retirar(meta):
                raise ValueError("Meta trancada: retirada bloqueada")
            if round(mov_in.valor, 2) > meta.saldo_atual:
                raise ValueError("Retirada maior que o saldo disponível")

        mov = MovimentacaoMeta(
            meta_id=meta.id,
            user_id=user_id,
            tipo=mov_in.tipo.value,
            valor=round(mov_in.valor, 2),
            data=mov_in.data or now_utc(),
            status="Efetivada",
            origem="manual",
            observacao=mov_in.observacao,
        )
        db.add(mov)
        db.commit()
        db.refresh(meta)
        self._recompute_saldo(db, meta)
        db.refresh(mov)
        return mov

    def listar_movimentacoes(self, db, meta_id, user_id):
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return []
        return (
            db.query(MovimentacaoMeta)
            .filter(MovimentacaoMeta.meta_id == meta_id)
            .order_by(MovimentacaoMeta.data.desc())
            .all()
        )

    def deletar_movimentacao(self, db, meta_id, mov_id, user_id) -> bool:
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return False
        mov = (
            db.query(MovimentacaoMeta)
            .filter(MovimentacaoMeta.id == mov_id, MovimentacaoMeta.meta_id == meta_id)
            .first()
        )
        if not mov:
            return False
        db.delete(mov)
        db.commit()
        db.refresh(meta)
        self._recompute_saldo(db, meta)
        return True
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `pytest tests/test_metas_service.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bussola_api/app/services/metas.py bussola_api/tests/test_metas_service.py
git commit -m "feat(metas): aporte/retirada com guarda de saldo e meta trancada"
```

---

### Task 6: Service — projeção, aporte sugerido e KPIs de patrimônio

**Files:**
- Modify: `bussola_api/app/services/metas.py`
- Test: `bussola_api/tests/test_metas_service.py`

**Interfaces:**
- Produces:
  - `enriquecer_meta(db, meta: Meta) -> dict` — retorna dict serializável para `MetaResponse` com `progresso_pct`, `aporte_sugerido`, `data_projetada`, `meses_restantes`.
  - `calcular_resumo(db, user_id: int, saldo_bruto: float) -> dict` — `{disponivel, guardado, total}` com `guardado = Σ saldo_atual (metas ativas)`, `total = saldo_bruto`, `disponivel = total − guardado`.
  - `total_guardado(db, user_id: int) -> float`.

- [ ] **Step 1: Testes de projeção e KPIs**

Adicionar em `bussola_api/tests/test_metas_service.py`:
```python
from datetime import date, timedelta


def test_aporte_sugerido_divide_faltante_por_meses(db, user):
    alvo_data = date.today() + timedelta(days=300)  # ~10 meses
    m = metas_service.criar_meta(
        db, MetaCreate(nome="V", valor_alvo=10000.0, data_alvo=alvo_data), user.id
    )
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=0.0), user.id)
    dados = metas_service.enriquecer_meta(db, m)
    assert dados["meses_restantes"] >= 9
    # faltante 10000 / ~10 meses ≈ 1000/mês (tolerância ampla)
    assert 800 <= dados["aporte_sugerido"] <= 1200


def test_progresso_pct(db, user):
    m = metas_service.criar_meta(db, MetaCreate(nome="V", valor_alvo=200.0), user.id)
    metas_service.criar_movimentacao(db, m.id, MovimentacaoCreate(tipo="aporte", valor=50.0), user.id)
    assert metas_service.enriquecer_meta(db, m)["progresso_pct"] == 25.0


def test_total_guardado_soma_metas_ativas(db, user):
    a = metas_service.criar_meta(db, MetaCreate(nome="A", valor_alvo=1000.0), user.id)
    b = metas_service.criar_meta(db, MetaCreate(nome="B", valor_alvo=1000.0), user.id)
    metas_service.criar_movimentacao(db, a.id, MovimentacaoCreate(tipo="aporte", valor=300.0), user.id)
    metas_service.criar_movimentacao(db, b.id, MovimentacaoCreate(tipo="aporte", valor=150.0), user.id)
    assert metas_service.total_guardado(db, user.id) == 450.0


def test_resumo_respeita_invariante(db, user):
    a = metas_service.criar_meta(db, MetaCreate(nome="A", valor_alvo=1000.0), user.id)
    metas_service.criar_movimentacao(db, a.id, MovimentacaoCreate(tipo="aporte", valor=300.0), user.id)
    resumo = metas_service.calcular_resumo(db, user.id, saldo_bruto=2000.0)
    assert resumo["guardado"] == 300.0
    assert resumo["total"] == 2000.0
    assert resumo["disponivel"] == 1700.0
    assert resumo["disponivel"] + resumo["guardado"] == resumo["total"]
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pytest tests/test_metas_service.py -q`
Expected: FAIL — `AttributeError: ... 'enriquecer_meta'`.

- [ ] **Step 3: Implementar**

Adicionar no topo de `bussola_api/app/services/metas.py`:
```python
from datetime import date
from dateutil.relativedelta import relativedelta
```
Dentro da classe, antes de `metas_service = MetasService()`:
```python
    # ---------- projeção & KPIs ----------
    def _media_aporte_mensal(self, meta: Meta) -> float:
        """Média mensal dos aportes efetivados desde a criação da meta."""
        aportes = [m for m in meta.movimentacoes
                   if m.status == "Efetivada" and m.tipo == "aporte" and m.valor > 0]
        if not aportes:
            return 0.0
        primeira = min(m.data for m in aportes)
        meses = max(1, (now_utc().replace(tzinfo=None) - primeira.replace(tzinfo=None)).days / 30.0)
        return round(sum(m.valor for m in aportes) / meses, 2)

    def enriquecer_meta(self, db, meta: Meta) -> dict:
        faltante = max(0.0, round(meta.valor_alvo - meta.saldo_atual, 2))
        progresso = 0.0
        if meta.valor_alvo > 0:
            progresso = round(min(100.0, (meta.saldo_atual / meta.valor_alvo) * 100), 1)

        meses_restantes = None
        aporte_sugerido = None
        if meta.data_alvo:
            hoje = now_utc().date()
            delta = relativedelta(meta.data_alvo, hoje)
            meses_restantes = max(0, delta.years * 12 + delta.months + (1 if delta.days > 0 else 0))
            if meses_restantes > 0:
                aporte_sugerido = round(faltante / meses_restantes, 2)

        data_projetada = None
        if faltante > 0:
            ritmo = self._media_aporte_mensal(meta)
            if ritmo > 0:
                meses_ate = faltante / ritmo
                data_projetada = (now_utc().date() + relativedelta(months=int(meses_ate) + 1))

        return {
            "id": meta.id,
            "nome": meta.nome,
            "valor_alvo": meta.valor_alvo,
            "saldo_atual": meta.saldo_atual,
            "data_alvo": meta.data_alvo,
            "icone": meta.icone,
            "cor": meta.cor,
            "imagem_url": meta.imagem_url,
            "trancada": meta.trancada,
            "status": meta.status,
            "aporte_mensal_valor": meta.aporte_mensal_valor,
            "aporte_mensal_dia": meta.aporte_mensal_dia,
            "created_at": meta.created_at,
            "concluida_em": meta.concluida_em,
            "progresso_pct": progresso,
            "aporte_sugerido": aporte_sugerido,
            "data_projetada": data_projetada,
            "meses_restantes": meses_restantes,
        }

    def total_guardado(self, db, user_id: int) -> float:
        metas = db.query(Meta).filter(
            Meta.user_id == user_id, Meta.status == "ativa"
        ).all()
        return round(sum(m.saldo_atual for m in metas), 2)

    def calcular_resumo(self, db, user_id: int, saldo_bruto: float) -> dict:
        guardado = self.total_guardado(db, user_id)
        total = round(saldo_bruto, 2)
        return {
            "disponivel": round(total - guardado, 2),
            "guardado": guardado,
            "total": total,
        }
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `pytest tests/test_metas_service.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bussola_api/app/services/metas.py bussola_api/tests/test_metas_service.py
git commit -m "feat(metas): projecao, aporte sugerido e KPIs de patrimonio"
```

---

### Task 7: Service — aporte mensal agendado + confirmar pendente

**Files:**
- Modify: `bussola_api/app/services/metas.py`
- Test: `bussola_api/tests/test_metas_service.py`

**Interfaces:**
- Produces:
  - `gerar_aportes_agendados(db, user_id: int) -> None` — idempotente; para cada meta ativa com `aporte_mensal_valor` e `aporte_mensal_dia`, garante uma `MovimentacaoMeta` Pendente (`origem='agendado'`) para o mês corrente se ainda não existir.
  - `toggle_status_movimentacao(db, meta_id, mov_id, user_id) -> MovimentacaoMeta | None` — alterna Pendente↔Efetivada e recomputa saldo.

- [ ] **Step 1: Testes**

Adicionar em `bussola_api/tests/test_metas_service.py`:
```python
def test_gerar_aporte_agendado_e_idempotente(db, user):
    m = metas_service.criar_meta(
        db,
        MetaCreate(nome="V", valor_alvo=10000.0, aporte_mensal_valor=500.0, aporte_mensal_dia=5),
        user.id,
    )
    metas_service.gerar_aportes_agendados(db, user.id)
    metas_service.gerar_aportes_agendados(db, user.id)  # 2ª vez não duplica
    movs = metas_service.listar_movimentacoes(db, m.id, user.id)
    pendentes = [x for x in movs if x.status == "Pendente" and x.origem == "agendado"]
    assert len(pendentes) == 1
    assert pendentes[0].valor == 500.0
    # ainda pendente: saldo intocado
    assert metas_service._get_meta(db, m.id, user.id).saldo_atual == 0.0


def test_confirmar_aporte_pendente_aplica_no_saldo(db, user):
    m = metas_service.criar_meta(
        db,
        MetaCreate(nome="V", valor_alvo=10000.0, aporte_mensal_valor=500.0, aporte_mensal_dia=5),
        user.id,
    )
    metas_service.gerar_aportes_agendados(db, user.id)
    mov = [x for x in metas_service.listar_movimentacoes(db, m.id, user.id) if x.status == "Pendente"][0]
    metas_service.toggle_status_movimentacao(db, m.id, mov.id, user.id)
    assert metas_service._get_meta(db, m.id, user.id).saldo_atual == 500.0
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pytest tests/test_metas_service.py -q`
Expected: FAIL — `AttributeError: ... 'gerar_aportes_agendados'`.

- [ ] **Step 3: Implementar**

Adicionar `import uuid` no topo de `bussola_api/app/services/metas.py`. Dentro da classe, antes de `metas_service = MetasService()`:
```python
    # ---------- aporte mensal agendado ----------
    def gerar_aportes_agendados(self, db, user_id: int) -> None:
        """Idempotente: garante 1 aporte Pendente no mês corrente por meta configurada."""
        hoje = now_utc()
        metas = db.query(Meta).filter(
            Meta.user_id == user_id,
            Meta.status == "ativa",
            Meta.aporte_mensal_valor.isnot(None),
        ).all()
        for meta in metas:
            ja_existe = any(
                m.origem == "agendado"
                and m.status == "Pendente"
                and m.data.year == hoje.year
                and m.data.month == hoje.month
                for m in meta.movimentacoes
            )
            if ja_existe:
                continue
            dia = min(meta.aporte_mensal_dia or 1, 28)
            data_mov = hoje.replace(day=dia, hour=0, minute=0, second=0, microsecond=0)
            db.add(MovimentacaoMeta(
                meta_id=meta.id,
                user_id=user_id,
                tipo="aporte",
                valor=round(meta.aporte_mensal_valor, 2),
                data=data_mov,
                status="Pendente",
                origem="agendado",
                id_grupo_recorrencia=f"agendado-{meta.id}",
            ))
        db.commit()

    def toggle_status_movimentacao(self, db, meta_id, mov_id, user_id):
        meta = self._get_meta(db, meta_id, user_id)
        if not meta:
            return None
        mov = (
            db.query(MovimentacaoMeta)
            .filter(MovimentacaoMeta.id == mov_id, MovimentacaoMeta.meta_id == meta_id)
            .first()
        )
        if not mov:
            return None
        mov.status = "Efetivada" if mov.status == "Pendente" else "Pendente"
        db.commit()
        db.refresh(meta)
        self._recompute_saldo(db, meta)
        db.refresh(mov)
        return mov
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `pytest tests/test_metas_service.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bussola_api/app/services/metas.py bussola_api/tests/test_metas_service.py
git commit -m "feat(metas): aporte mensal agendado idempotente + confirmar pendente"
```

---

### Task 8: Endpoints + registro no router

**Files:**
- Create: `bussola_api/app/api/v1/endpoints/metas.py`
- Modify: `bussola_api/app/api/v1/router.py`
- Test: `bussola_api/tests/test_metas_api.py`

**Interfaces:**
- Consumes: `metas_service`, schemas de `app.schemas.metas`, `deps.get_db`, `deps.get_current_user`, `financas_service.get_dashboard_data` (para `saldo_bruto`).
- Produces: rotas HTTP sob `/api/v1/financas/metas` (ver spec §5).

- [ ] **Step 1: Testes de API (via TestClient)**

Create `bussola_api/tests/test_metas_api.py`:
```python
def test_criar_e_listar_via_api(client):
    r = client.post("/api/v1/financas/metas", json={"nome": "Carro", "valor_alvo": 50000})
    assert r.status_code == 200, r.text
    assert r.json()["nome"] == "Carro"

    r2 = client.get("/api/v1/financas/metas")
    assert r2.status_code == 200
    body = r2.json()
    assert len(body["metas"]) == 1
    assert "resumo" in body and {"disponivel", "guardado", "total"} <= body["resumo"].keys()


def test_aporte_via_api_atualiza_progresso(client):
    meta_id = client.post("/api/v1/financas/metas", json={"nome": "V", "valor_alvo": 200}).json()["id"]
    r = client.post(
        f"/api/v1/financas/metas/{meta_id}/movimentacoes",
        json={"tipo": "aporte", "valor": 50},
    )
    assert r.status_code == 200, r.text
    metas = client.get("/api/v1/financas/metas").json()["metas"]
    alvo = next(m for m in metas if m["id"] == meta_id)
    assert alvo["saldo_atual"] == 50.0
    assert alvo["progresso_pct"] == 25.0


def test_retirada_bloqueada_retorna_400(client):
    meta_id = client.post(
        "/api/v1/financas/metas", json={"nome": "V", "valor_alvo": 1000, "trancada": True}
    ).json()["id"]
    client.post(f"/api/v1/financas/metas/{meta_id}/movimentacoes", json={"tipo": "aporte", "valor": 100})
    r = client.post(
        f"/api/v1/financas/metas/{meta_id}/movimentacoes", json={"tipo": "retirada", "valor": 50}
    )
    assert r.status_code == 400
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pytest tests/test_metas_api.py -q`
Expected: FAIL — 404 nas rotas (router não registrado).

- [ ] **Step 3: Criar os endpoints**

Create `bussola_api/app/api/v1/endpoints/metas.py`:
```python
"""Endpoints do módulo Metas & Cofrinhos (prefixo /financas/metas)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas.metas import (
    MetaCreate, MetaUpdate, MetaResponse,
    MovimentacaoCreate, MovimentacaoResponse,
    MetasDashboardResponse, ResumoPatrimonio,
)
from app.services.metas import metas_service
from app.services.financas import financas_service, ICONES_DISPONIVEIS, CORES_DISPONIVEIS

router = APIRouter()


def _saldo_bruto(db: Session, user_id: int) -> float:
    """Saldo bruto de Finanças: receitas − despesas efetivadas."""
    dash = financas_service.get_dashboard_data(db, user_id)
    receita = sum(float(c.total_ganho or 0) for c in dash.categorias_receita)
    despesa = sum(float(c.total_gasto or 0) for c in dash.categorias_despesa)
    return receita - despesa


@router.get("", response_model=MetasDashboardResponse)
@router.get("/", response_model=MetasDashboardResponse)
def get_metas_dashboard(db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    metas_service.gerar_aportes_agendados(db, current_user.id)
    metas = metas_service.listar_metas(db, current_user.id)
    metas_out = [MetaResponse(**metas_service.enriquecer_meta(db, m)) for m in metas]
    resumo = metas_service.calcular_resumo(db, current_user.id, _saldo_bruto(db, current_user.id))
    return MetasDashboardResponse(
        metas=metas_out,
        resumo=ResumoPatrimonio(**resumo),
        icones_disponiveis=ICONES_DISPONIVEIS,
        cores_disponiveis=CORES_DISPONIVEIS,
    )


@router.post("", response_model=MetaResponse)
@router.post("/", response_model=MetaResponse)
def create_meta(meta_in: MetaCreate, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    m = metas_service.criar_meta(db, meta_in, current_user.id)
    return MetaResponse(**metas_service.enriquecer_meta(db, m))


@router.put("/{meta_id}", response_model=MetaResponse)
def update_meta(meta_id: int, meta_in: MetaUpdate, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    m = metas_service.atualizar_meta(db, meta_id, meta_in, current_user.id)
    if not m:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    return MetaResponse(**metas_service.enriquecer_meta(db, m))


@router.delete("/{meta_id}")
def delete_meta(meta_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    if not metas_service.deletar_meta(db, meta_id, current_user.id):
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    return {"ok": True}


@router.post("/{meta_id}/movimentacoes", response_model=MovimentacaoResponse)
def create_movimentacao(meta_id: int, mov_in: MovimentacaoCreate, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    try:
        return metas_service.criar_movimentacao(db, meta_id, mov_in, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{meta_id}/movimentacoes", response_model=list[MovimentacaoResponse])
def list_movimentacoes(meta_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    return metas_service.listar_movimentacoes(db, meta_id, current_user.id)


@router.put("/{meta_id}/movimentacoes/{mov_id}/toggle-status", response_model=MovimentacaoResponse)
def toggle_movimentacao(meta_id: int, mov_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    mov = metas_service.toggle_status_movimentacao(db, meta_id, mov_id, current_user.id)
    if not mov:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    return mov


@router.delete("/{meta_id}/movimentacoes/{mov_id}")
def delete_movimentacao(meta_id: int, mov_id: int, db: Session = Depends(deps.get_db), current_user=Depends(deps.get_current_user)):
    if not metas_service.deletar_movimentacao(db, meta_id, mov_id, current_user.id):
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    return {"ok": True}
```

> Nota: se `financas_service.get_dashboard_data` retornar um objeto com atributos diferentes de `categorias_receita`/`categorias_despesa`, ajuste `_saldo_bruto` para a forma real (checar `app/services/financas.py`). O objetivo é `receitas − despesas efetivadas`.

- [ ] **Step 4: Registrar no router**

Modify `bussola_api/app/api/v1/router.py`:
- No bloco de imports `from app.api.v1.endpoints import (...)`, adicionar `metas,`.
- Após a linha `api_router.include_router(financas.router, ...)`, adicionar:
```python
api_router.include_router(metas.router, prefix="/financas/metas", tags=["metas"])
```

- [ ] **Step 5: Rodar (deve passar)**

Run: `pytest tests/test_metas_api.py -q`
Expected: PASS. Se falhar em `_saldo_bruto`, aplicar a nota do Step 3.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `pytest -q`
Expected: todos os testes de metas passam.

- [ ] **Step 7: Commit**

```bash
git add bussola_api/app/api/v1/endpoints/metas.py bussola_api/app/api/v1/router.py bussola_api/tests/test_metas_api.py
git commit -m "feat(metas): endpoints REST + registro no router"
```

---

# PHASE 2 — Integração do saldo (3 KPIs em Finanças)

### Task 9: `resumo_patrimonio` no dashboard de Finanças

**Files:**
- Modify: `bussola_api/app/schemas/financas.py`
- Modify: `bussola_api/app/services/financas.py`
- Test: `bussola_api/tests/test_financas_resumo.py`

**Interfaces:**
- Consumes: `metas_service.calcular_resumo`.
- Produces: `FinancasDashboardResponse` ganha campo opcional `resumo_patrimonio: ResumoPatrimonio | None`.

- [ ] **Step 1: Teste**

Create `bussola_api/tests/test_financas_resumo.py`:
```python
def test_dashboard_financas_inclui_resumo_patrimonio(client):
    r = client.get("/api/v1/financas/")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "resumo_patrimonio" in body
    assert {"disponivel", "guardado", "total"} <= body["resumo_patrimonio"].keys()
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pytest tests/test_financas_resumo.py -q`
Expected: FAIL — `resumo_patrimonio` ausente.

- [ ] **Step 3: Schema**

Modify `bussola_api/app/schemas/financas.py` — no fim, importar e adicionar campo. No topo:
```python
from app.schemas.metas import ResumoPatrimonio
```
Em `FinancasDashboardResponse`, adicionar:
```python
    resumo_patrimonio: Optional[ResumoPatrimonio] = None
```

- [ ] **Step 4: Serviço preenche o resumo**

Modify `bussola_api/app/services/financas.py` — em `get_dashboard_data`, antes do `return`, calcular o resumo a partir dos totais já computados e anexá-lo. Localizar onde o dict/objeto de resposta é montado e adicionar:
```python
        from app.services.metas import metas_service  # import local evita ciclo
        saldo_bruto = total_receita - total_despesa   # usar as variáveis de total já existentes na função
        resposta["resumo_patrimonio"] = metas_service.calcular_resumo(db, user_id, saldo_bruto)
```
> Ajuste os nomes `total_receita`/`total_despesa`/`resposta` para as variáveis reais dessa função. O valor deve ser `Σ receitas efetivadas − Σ despesas efetivadas` (o mesmo saldo bruto que o front exibe hoje).

- [ ] **Step 5: Rodar (deve passar)**

Run: `pytest tests/test_financas_resumo.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add bussola_api/app/schemas/financas.py bussola_api/app/services/financas.py bussola_api/tests/test_financas_resumo.py
git commit -m "feat(metas): resumo_patrimonio (3 KPIs) no dashboard de Financas"
```

---

# PHASE 3 — Frontend base (rota, grade, CRUD, aporte simples)

> **Nota de testes (frontend):** o projeto não tem suíte JS (`package.json` sem script `test`). Cada task de frontend valida com `npm run lint` + `npm run build` + verificação visual manual descrita no passo. Não há red-green de teste unitário aqui.

### Task 10: Wrappers HTTP em `api.js`

**Files:**
- Modify: `bussola_web/src/services/api.js`

**Interfaces:**
- Produces (export nomeado): `getMetasDashboard()`, `createMeta(payload)`, `updateMeta(id, payload)`, `deleteMeta(id)`, `createMovimentacao(metaId, payload)`, `listMovimentacoes(metaId)`, `toggleMovimentacao(metaId, movId)`, `deleteMovimentacao(metaId, movId)`.

- [ ] **Step 1: Ler o padrão existente**

Abrir `bussola_web/src/services/api.js`, localizar `getFinancasDashboard` e copiar o mesmo estilo (instância axios, tratamento de retorno).

- [ ] **Step 2: Adicionar os wrappers**

No `bussola_web/src/services/api.js`, seguindo o mesmo `api`/axios já usado no arquivo:
```javascript
// --- METAS & COFRINHOS ---
export const getMetasDashboard = async () => {
  const { data } = await api.get('/financas/metas');
  return data;
};
export const createMeta = async (payload) => {
  const { data } = await api.post('/financas/metas', payload);
  return data;
};
export const updateMeta = async (id, payload) => {
  const { data } = await api.put(`/financas/metas/${id}`, payload);
  return data;
};
export const deleteMeta = async (id) => {
  const { data } = await api.delete(`/financas/metas/${id}`);
  return data;
};
export const createMovimentacao = async (metaId, payload) => {
  const { data } = await api.post(`/financas/metas/${metaId}/movimentacoes`, payload);
  return data;
};
export const listMovimentacoes = async (metaId) => {
  const { data } = await api.get(`/financas/metas/${metaId}/movimentacoes`);
  return data;
};
export const toggleMovimentacao = async (metaId, movId) => {
  const { data } = await api.put(`/financas/metas/${metaId}/movimentacoes/${movId}/toggle-status`);
  return data;
};
export const deleteMovimentacao = async (metaId, movId) => {
  const { data } = await api.delete(`/financas/metas/${metaId}/movimentacoes/${movId}`);
  return data;
};
```
> Se o arquivo usa outra convenção (ex.: nome da instância não é `api`, ou wrappers retornam `response` inteiro), adaptar para bater exatamente com `getFinancasDashboard`.

- [ ] **Step 3: Lint**

Run: `cd bussola_web && npm run lint`
Expected: sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add bussola_web/src/services/api.js
git commit -m "feat(metas): wrappers HTTP do modulo de metas no api.js"
```

---

### Task 11: Rota `/metas`, item na Navbar e página-esqueleto com KPIs

**Files:**
- Create: `bussola_web/src/pages/Metas/index.jsx`
- Create: `bussola_web/src/pages/Metas/styles.css`
- Modify: `bussola_web/src/routes/index.jsx`
- Modify: `bussola_web/src/components/Navbar.jsx`

**Interfaces:**
- Consumes: `getMetasDashboard`.
- Produces: componente `Metas` exportado; rotas `/metas` e `/metas/:id`.

- [ ] **Step 1: Página-esqueleto**

Create `bussola_web/src/pages/Metas/index.jsx`:
```jsx
import React, { useEffect, useState } from 'react';
import { getMetasDashboard } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './styles.css';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function Metas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const fetchData = async () => {
    try {
      setData(await getMetasDashboard());
    } catch (e) {
      addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar metas.' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, []);

  const resumo = data?.resumo || { disponivel: 0, guardado: 0, total: 0 };

  return (
    <div className="container main-container metas-scope">
      <div className="page-header">
        <div className="page-header-main">
          <h1><i className="fa-solid fa-piggy-bank"></i> Metas & Cofrinhos</h1>
        </div>
        <div className="page-header-kpis">
          <span className="ph-kpi positivo"><i className="fa-solid fa-wallet"></i> Disponível {fmt(resumo.disponivel)}</span>
          <span className="ph-kpi guardado"><i className="fa-solid fa-piggy-bank"></i> Guardado {fmt(resumo.guardado)}</span>
          <span className="ph-kpi"><i className="fa-solid fa-scale-balanced"></i> Total {fmt(resumo.total)}</span>
        </div>
      </div>

      {loading ? (
        <p className="empty-list-msg">Carregando metas...</p>
      ) : (data?.metas?.length ? (
        <div className="metas-grid">
          {data.metas.map((m) => (
            <div key={m.id} className="meta-card-placeholder">{m.nome} — {fmt(m.saldo_atual)} / {fmt(m.valor_alvo)}</div>
          ))}
        </div>
      ) : (
        <p className="empty-list-msg">Nenhuma meta ainda. Crie seu primeiro cofrinho!</p>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: CSS base**

Create `bussola_web/src/pages/Metas/styles.css`:
```css
.metas-scope .metas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}
.metas-scope .ph-kpi.guardado { color: var(--cor-azul-primario, #4f46e5); }
.meta-card-placeholder {
  padding: 1rem; border-radius: 12px;
  background: var(--cor-fundo-card, #1e1e24);
  border: 1px solid var(--cor-borda, #333);
}
```

- [ ] **Step 3: Registrar as rotas**

Modify `bussola_web/src/routes/index.jsx`:
- Import: `import { Metas } from '../pages/Metas';`
- Nas rotas privadas, após a de `/financas`:
```jsx
<Route path="/metas" element={<PrivateRoute><Metas /></PrivateRoute>} />
<Route path="/metas/:id" element={<PrivateRoute><Metas /></PrivateRoute>} />
```

- [ ] **Step 4: Item na Navbar**

Modify `bussola_web/src/components/Navbar.jsx` — localizar o link de `/financas` e adicionar, no mesmo padrão, um item apontando para `/metas` com label "Metas" e ícone `fa-solid fa-piggy-bank`. (Copiar exatamente a estrutura de `<NavLink>`/`<Link>` usada pelos vizinhos.)

- [ ] **Step 5: Build + verificação visual**

Run: `cd bussola_web && npm run build`
Expected: build ok. Rodar `npm run dev`, logar, abrir `/metas`: header com 3 KPIs e "Nenhuma meta ainda".

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Metas/ bussola_web/src/routes/index.jsx bussola_web/src/components/Navbar.jsx
git commit -m "feat(metas): rota /metas, item na navbar e pagina com KPIs"
```

---

### Task 12: `MetaCard` + `MetaModals` (criar/editar meta)

**Files:**
- Create: `bussola_web/src/pages/Metas/components/MetaCard.jsx`
- Create: `bussola_web/src/pages/Metas/components/MetaModals.jsx`
- Modify: `bussola_web/src/pages/Metas/index.jsx`
- Modify: `bussola_web/src/pages/Metas/styles.css`

**Interfaces:**
- Consumes: `createMeta`, `updateMeta`, `deleteMeta`; contextos `ToastContext`, `ConfirmDialogContext`.
- Produces: `MetaCard({ meta, onOpen, onEdit, onDelete })`; `MetaModals({ activeModal, closeModal, onUpdate, editingData, meta, iconesDisponiveis, coresDisponiveis })`.

- [ ] **Step 1: MetaCard**

Create `bussola_web/src/pages/Metas/components/MetaCard.jsx`:
```jsx
import React from 'react';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function MetaCard({ meta, onOpen, onEdit, onDelete }) {
  const pct = meta.progresso_pct ?? 0;
  return (
    <div className="meta-card" style={{ '--meta-cor': meta.cor || '#4f46e5' }}>
      <div className="meta-card-head" onClick={() => onOpen(meta)}>
        <div className="meta-card-icon"><i className={meta.icone || 'fa-solid fa-piggy-bank'}></i></div>
        <div className="meta-card-title">
          <strong>{meta.nome}</strong>
          {meta.trancada && <i className="fa-solid fa-lock" title="Trancada" style={{ marginLeft: 6, opacity: .7 }}></i>}
          {meta.status === 'concluida' && <span className="meta-badge-done">Concluída 🎉</span>}
        </div>
      </div>

      <div className="meta-progress">
        <div className="meta-progress-bar"><span style={{ width: `${pct}%` }} /></div>
        <div className="meta-progress-labels">
          <span>{fmt(meta.saldo_atual)}</span>
          <span className="muted">/ {fmt(meta.valor_alvo)} · {pct}%</span>
        </div>
      </div>

      {meta.data_projetada && (
        <div className="meta-proj muted">
          <i className="fa-solid fa-flag-checkered"></i> Projeção: {new Date(meta.data_projetada).toLocaleDateString('pt-BR')}
        </div>
      )}

      <div className="meta-card-actions">
        <button className="btn-primary" onClick={() => onOpen(meta)}><i className="fa-solid fa-hand-holding-dollar"></i> Guardar</button>
        <button className="btn-icon" onClick={() => onEdit(meta)} title="Editar"><i className="fa-solid fa-pen"></i></button>
        <button className="btn-icon" onClick={() => onDelete(meta)} title="Excluir"><i className="fa-solid fa-trash"></i></button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: MetaModals (criar/editar)**

Create `bussola_web/src/pages/Metas/components/MetaModals.jsx`:
```jsx
import React, { useEffect, useState } from 'react';
import { createMeta, updateMeta } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

const EMPTY = { nome: '', valor_alvo: '', data_alvo: '', icone: 'fa-solid fa-piggy-bank', cor: '#4f46e5', trancada: false };

export function MetaModals({ activeModal, closeModal, onUpdate, editingData, iconesDisponiveis = [], coresDisponiveis = [] }) {
  const [form, setForm] = useState(EMPTY);
  const { addToast } = useToast();

  useEffect(() => {
    if (editingData) {
      setForm({
        nome: editingData.nome || '',
        valor_alvo: editingData.valor_alvo || '',
        data_alvo: editingData.data_alvo ? String(editingData.data_alvo).slice(0, 10) : '',
        icone: editingData.icone || 'fa-solid fa-piggy-bank',
        cor: editingData.cor || '#4f46e5',
        trancada: !!editingData.trancada,
      });
    } else {
      setForm(EMPTY);
    }
  }, [editingData, activeModal]);

  if (activeModal !== 'meta') return null;

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      nome: form.nome,
      valor_alvo: Number(form.valor_alvo),
      data_alvo: form.data_alvo || null,
      icone: form.icone,
      cor: form.cor,
      trancada: form.trancada,
    };
    try {
      if (editingData) await updateMeta(editingData.id, payload);
      else await createMeta(payload);
      addToast({ type: 'success', title: 'Pronto', description: 'Meta salva.' });
      onUpdate();
      closeModal();
    } catch (err) {
      addToast({ type: 'error', title: 'Erro', description: err.response?.data?.detail || 'Falha ao salvar.' });
    }
  };

  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{editingData ? 'Editar meta' : 'Nova meta'}</h2>
        <form onSubmit={submit} className="meta-form">
          <label>Nome
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </label>
          <label>Valor-alvo (R$)
            <input type="number" step="0.01" min="0" value={form.valor_alvo}
                   onChange={(e) => setForm({ ...form, valor_alvo: e.target.value })} required />
          </label>
          <label>Data-alvo (opcional)
            <input type="date" value={form.data_alvo} onChange={(e) => setForm({ ...form, data_alvo: e.target.value })} />
          </label>
          <label>Cor
            <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
          </label>
          <label className="meta-check">
            <input type="checkbox" checked={form.trancada} onChange={(e) => setForm({ ...form, trancada: e.target.checked })} />
            Trancar (bloqueia retirada até atingir o alvo ou a data)
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```
> As classes `modal-backdrop`/`modal-content`/`btn-secondary` devem espelhar as usadas em `FinancasModals.jsx`. Abrir esse arquivo e reusar as mesmas classes/estrutura de modal já estilizadas no projeto.

- [ ] **Step 3: Ligar na página**

Modify `bussola_web/src/pages/Metas/index.jsx`: importar `MetaCard`, `MetaModals`, `deleteMeta`, `useConfirm`; substituir o `meta-card-placeholder` por `<MetaCard .../>`; adicionar estado `activeModal`/`editingData`; botão "Nova meta" no header; handlers `onEdit`/`onDelete` (com `useConfirm`) e `onOpen` (por ora, abre o modal de editar — a cena vem na Task 14); renderizar `<MetaModals .../>` passando `data.icones_disponiveis`/`data.cores_disponiveis`.

- [ ] **Step 4: Estilo dos cards**

Modify `bussola_web/src/pages/Metas/styles.css` — adicionar estilos para `.meta-card`, `.meta-progress-bar span` (usar `background: var(--meta-cor)`), `.meta-card-actions`, `.meta-badge-done`. Seguir a linguagem visual de `pages/Financas/styles.css`.

- [ ] **Step 5: Build + verificação visual**

Run: `cd bussola_web && npm run build`
Expected: ok. No `/metas`: criar meta "Comprar carro / 50000", card aparece com barra em 0%, editar e excluir funcionam.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Metas/
git commit -m "feat(metas): MetaCard e modal de criar/editar meta"
```

---

### Task 13: Aporte/retirada simples + 3 KPIs no header de Finanças

**Files:**
- Modify: `bussola_web/src/pages/Metas/components/MetaModals.jsx`
- Modify: `bussola_web/src/pages/Metas/index.jsx`
- Modify: `bussola_web/src/pages/Financas/index.jsx`

**Interfaces:**
- Consumes: `createMovimentacao`; `resumo_patrimonio` do dashboard de Finanças.

- [ ] **Step 1: Modal de aporte/retirada (versão form)**

Modify `bussola_web/src/pages/Metas/components/MetaModals.jsx` — adicionar um segundo bloco que renderiza quando `activeModal === 'movimentacao'`, com: toggle Aporte/Retirada, input de valor, observação, submit chamando `createMovimentacao(meta.id, { tipo, valor, observacao })`; em erro 400 (trancada/saldo) mostrar `err.response.data.detail` no toast. Receber `meta` via props.

```jsx
// dentro de MetaModals, após o return do modal 'meta':
// (novo componente-irmão no mesmo arquivo)
export function MovimentacaoModal({ activeModal, closeModal, onUpdate, meta }) {
  const [tipo, setTipo] = useState('aporte');
  const [valor, setValor] = useState('');
  const { addToast } = useToast();
  if (activeModal !== 'movimentacao' || !meta) return null;
  const submit = async (e) => {
    e.preventDefault();
    try {
      await createMovimentacao(meta.id, { tipo, valor: Number(valor), observacao: null });
      addToast({ type: 'success', title: 'Pronto', description: tipo === 'aporte' ? 'Aporte guardado!' : 'Retirada feita.' });
      onUpdate(); closeModal(); setValor('');
    } catch (err) {
      addToast({ type: 'error', title: 'Ops', description: err.response?.data?.detail || 'Falha.' });
    }
  };
  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{meta.nome}</h2>
        <div className="mov-toggle">
          <button className={tipo === 'aporte' ? 'active' : ''} onClick={() => setTipo('aporte')}>Guardar</button>
          <button className={tipo === 'retirada' ? 'active' : ''} onClick={() => setTipo('retirada')}>Retirar</button>
        </div>
        <form onSubmit={submit}>
          <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor (R$)" required autoFocus />
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <button type="submit" className="btn-primary">Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```
Adicionar no topo do arquivo: `import { createMovimentacao } from '../../../services/api';`.

- [ ] **Step 2: Página usa o modal de movimentação**

Modify `bussola_web/src/pages/Metas/index.jsx`: importar `MovimentacaoModal`; o handler `onOpen(meta)` passa a abrir `activeModal='movimentacao'` guardando a `meta` selecionada; renderizar `<MovimentacaoModal meta={selectedMeta} .../>`.

- [ ] **Step 3: 3 KPIs no header de Finanças**

Modify `bussola_web/src/pages/Financas/index.jsx` — no cálculo do header (linhas ~246-260), preferir `data.resumo_patrimonio` quando presente:
```jsx
const resumo = data?.resumo_patrimonio;
const disponivel = resumo ? resumo.disponivel : (totalReceita - totalDespesa);
const guardado = resumo ? resumo.guardado : 0;
```
E substituir o KPI de saldo único por dois: "Disponível" (`fmtCurrency(disponivel)`) e, quando `guardado > 0`, um chip "Guardado" (`fmtCurrency(guardado)`) com link para `/metas`. Manter receita/despesa como estão.

- [ ] **Step 4: Build + verificação visual (fluxo ponta-a-ponta)**

Run: `cd bussola_web && npm run build`
Expected: ok. Manual: guardar R$500 numa meta → card sobe o progresso; header de Finanças mostra "Disponível" caindo R$500 e "Guardado" +R$500; tentar retirar de meta trancada → toast de bloqueio.

- [ ] **Step 5: Commit**

```bash
git add bussola_web/src/pages/Metas/ bussola_web/src/pages/Financas/index.jsx
git commit -m "feat(metas): aporte/retirada e 3 KPIs no header de Financas"
```

---

# PHASE 4 — A cena 2.5D (arrastar moeda pro baú)

### Task 14: `framer-motion` + `Coin` + `CofreScene` + `Confetti`

**Files:**
- Modify: `bussola_web/package.json` (via npm install)
- Create: `bussola_web/src/pages/Metas/components/Coin.jsx`
- Create: `bussola_web/src/pages/Metas/components/Confetti.jsx`
- Create: `bussola_web/src/pages/Metas/CofreScene.jsx`
- Modify: `bussola_web/src/pages/Metas/index.jsx`
- Modify: `bussola_web/src/pages/Metas/styles.css`

**Interfaces:**
- Consumes: `createMovimentacao`, `framer-motion` (`motion`, `useMotionValue`, `animate`).
- Produces: `CofreScene({ meta, onDeposited })` — tela imersiva: digitar valor → arrastar `Coin` → soltar sobre o baú → `POST` aporte → confete + progresso.

- [ ] **Step 1: Instalar framer-motion**

Run: `cd bussola_web && npm install framer-motion@^11`
Expected: adicionado em `dependencies`.

- [ ] **Step 2: Coin**

Create `bussola_web/src/pages/Metas/components/Coin.jsx`:
```jsx
import React from 'react';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function Coin({ valor }) {
  return (
    <div className="coin-3d">
      <div className="coin-face">
        <span className="coin-symbol">R$</span>
        <span className="coin-value">{valor ? fmt(valor).replace('R$', '').trim() : '0,00'}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Confetti (CSS puro)**

Create `bussola_web/src/pages/Metas/components/Confetti.jsx`:
```jsx
import React from 'react';

const COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];

export function Confetti({ show }) {
  if (!show) return null;
  const pieces = Array.from({ length: 40 });
  return (
    <div className="confetti-layer" aria-hidden>
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i / 40) * 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 10) * 0.05}s`,
            transform: `rotate(${(i * 37) % 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: CofreScene (o coração)**

Create `bussola_web/src/pages/Metas/CofreScene.jsx`:
```jsx
import React, { useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { createMovimentacao } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Coin } from './components/Coin';
import { Confetti } from './components/Confetti';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function CofreScene({ meta, onDeposited }) {
  const [valor, setValor] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const bauRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const { addToast } = useToast();

  const pct = meta.progresso_pct ?? Math.min(100, (meta.saldo_atual / meta.valor_alvo) * 100);

  const onDragEnd = async (_event, info) => {
    const bau = bauRef.current?.getBoundingClientRect();
    const dropped = { x: info.point.x, y: info.point.y };
    const hit = bau && dropped.x >= bau.left && dropped.x <= bau.right && dropped.y >= bau.top && dropped.y <= bau.bottom;

    if (!hit || !Number(valor)) {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 25 });
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 25 });
      return;
    }
    // moeda "cai" pra dentro do baú
    animate(y, y.get() + 40, { duration: 0.18 });
    setDepositing(true);
    try {
      await createMovimentacao(meta.id, { tipo: 'aporte', valor: Number(valor), observacao: null });
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1400);
      addToast({ type: 'success', title: 'Guardado!', description: `${fmt(Number(valor))} no cofrinho.` });
      setValor('');
      onDeposited?.();
    } catch (err) {
      addToast({ type: 'error', title: 'Ops', description: err.response?.data?.detail || 'Falha ao guardar.' });
    } finally {
      x.set(0); y.set(0);
      setDepositing(false);
    }
  };

  return (
    <div className="cofre-scene">
      <Confetti show={celebrate} />
      <div className="cofre-header">
        <h2>{meta.nome}</h2>
        <div className="cofre-progress">
          <div className="meta-progress-bar"><span style={{ width: `${pct}%`, background: meta.cor }} /></div>
          <span className="muted">{fmt(meta.saldo_atual)} / {fmt(meta.valor_alvo)} · {Math.round(pct)}%</span>
        </div>
      </div>

      <div className="cofre-stage">
        <input
          className="cofre-valor-input"
          type="number" step="0.01" min="0" value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Digite o valor e arraste a moeda ↓"
        />

        <motion.div
          className="coin-draggable"
          drag
          dragSnapToOrigin={false}
          style={{ x, y }}
          onDragEnd={onDragEnd}
          whileDrag={{ scale: 1.15, rotate: 12 }}
          whileTap={{ cursor: 'grabbing' }}
        >
          <Coin valor={Number(valor)} />
        </motion.div>

        <motion.div
          ref={bauRef}
          className={`bau-drop ${depositing ? 'bau-open' : ''}`}
          animate={celebrate ? { scale: [1, 1.08, 1] } : {}}
        >
          <i className="fa-solid fa-box-open bau-icon"></i>
          <span className="bau-label">Solte aqui</span>
        </motion.div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Estilos da cena (CSS 3D)**

Modify `bussola_web/src/pages/Metas/styles.css` — adicionar:
```css
.cofre-scene { position: relative; padding: 1rem; }
.cofre-stage { display: flex; flex-direction: column; align-items: center; gap: 2rem; min-height: 340px; padding: 2rem 0; perspective: 900px; }
.cofre-valor-input { font-size: 1.2rem; text-align: center; padding: .6rem 1rem; border-radius: 10px; }

.coin-draggable { cursor: grab; touch-action: none; z-index: 5; }
.coin-3d { width: 84px; height: 84px; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #ffe07a, #f5b301 55%, #b8860b);
  box-shadow: 0 8px 18px rgba(0,0,0,.35), inset 0 2px 4px rgba(255,255,255,.6), inset 0 -6px 10px rgba(0,0,0,.25);
  display: flex; align-items: center; justify-content: center;
  transform: rotateX(12deg); transition: transform .1s; }
.coin-face { display: flex; flex-direction: column; align-items: center; color: #7a5901; font-weight: 800; }
.coin-symbol { font-size: .7rem; } .coin-value { font-size: .85rem; }

.bau-drop { width: 200px; height: 130px; border-radius: 14px;
  background: linear-gradient(160deg, #6b4423, #4a2f18); border: 3px solid #3a2412;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #f5d18a; box-shadow: 0 12px 24px rgba(0,0,0,.4); transform: rotateX(8deg); }
.bau-drop .bau-icon { font-size: 2.4rem; margin-bottom: .4rem; }
.bau-drop.bau-open .bau-icon { color: #ffe07a; }

.confetti-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 20; }
.confetti-piece { position: absolute; top: -10px; width: 9px; height: 14px; border-radius: 2px;
  animation: confetti-fall 1.3s ease-in forwards; }
@keyframes confetti-fall { to { transform: translateY(360px) rotate(540deg); opacity: 0; } }

@media (max-width: 640px) { .bau-drop { width: 160px; } }
```

- [ ] **Step 6: Abrir a cena a partir do card**

Modify `bussola_web/src/pages/Metas/index.jsx`: quando `activeModal === 'movimentacao'`, renderizar a `CofreScene` dentro do modal (no lugar do form simples da Task 13) para a meta selecionada, passando `onDeposited={fetchData}`. Manter o form simples de retirada como aba/opção secundária dentro do mesmo modal (retirada não usa drag).

- [ ] **Step 7: Build + verificação visual**

Run: `cd bussola_web && npm run build`
Expected: ok. Manual: abrir uma meta, digitar 500, arrastar a moeda até o baú e soltar → confete, toast "Guardado!", barra sobe; soltar fora do baú → moeda volta; soltar sem valor → nada acontece. Testar no mobile (touch): `touch-action: none` permite o drag.

- [ ] **Step 8: Commit**

```bash
git add bussola_web/package.json bussola_web/package-lock.json bussola_web/src/pages/Metas/
git commit -m "feat(metas): cena 2.5D de arrastar moeda pro bau (framer-motion + confete)"
```

---

### Task 15: `MetaHistorico` (gráfico de evolução + timeline)

**Files:**
- Create: `bussola_web/src/pages/Metas/components/MetaHistorico.jsx`
- Modify: `bussola_web/src/pages/Metas/index.jsx` (ou o modal da cena)

**Interfaces:**
- Consumes: `listMovimentacoes`, `deleteMovimentacao`, `chart.js`/`react-chartjs-2` (já instalados).
- Produces: `MetaHistorico({ meta })` — gráfico de linha do saldo acumulado + lista das movimentações (com excluir).

- [ ] **Step 1: Componente**

Create `bussola_web/src/pages/Metas/components/MetaHistorico.jsx`:
```jsx
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { listMovimentacoes, deleteMovimentacao } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function MetaHistorico({ meta, onChange }) {
  const [movs, setMovs] = useState([]);
  const { addToast } = useToast();

  const load = async () => {
    try { setMovs(await listMovimentacoes(meta.id)); } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, [meta.id]);

  const efetivadas = [...movs].filter((m) => m.status === 'Efetivada')
    .sort((a, b) => new Date(a.data) - new Date(b.data));
  let acc = 0;
  const pontos = efetivadas.map((m) => {
    acc += m.tipo === 'aporte' ? m.valor : -m.valor;
    return { x: new Date(m.data).toLocaleDateString('pt-BR'), y: Number(acc.toFixed(2)) };
  });

  const chartData = {
    labels: pontos.map((p) => p.x),
    datasets: [{ label: 'Guardado', data: pontos.map((p) => p.y),
      borderColor: meta.cor || '#4f46e5', backgroundColor: 'rgba(79,70,229,.15)', tension: .3, fill: true }],
  };

  const remove = async (id) => {
    try { await deleteMovimentacao(meta.id, id); await load(); onChange?.(); }
    catch (e) { addToast({ type: 'error', title: 'Erro', description: 'Falha ao excluir.' }); }
  };

  return (
    <div className="meta-historico">
      {pontos.length > 1 && <div className="meta-chart"><Line data={chartData} options={{ plugins: { legend: { display: false } } }} /></div>}
      <ul className="meta-timeline">
        {movs.map((m) => (
          <li key={m.id} className={m.status === 'Pendente' ? 'pendente' : ''}>
            <i className={`fa-solid ${m.tipo === 'aporte' ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
            <span>{m.tipo === 'aporte' ? 'Aporte' : 'Retirada'} {m.origem === 'agendado' ? '(mensal)' : ''}</span>
            <strong>{fmt(m.valor)}</strong>
            <span className="muted">{new Date(m.data).toLocaleDateString('pt-BR')}</span>
            <button className="btn-icon" onClick={() => remove(m.id)}><i className="fa-solid fa-xmark"></i></button>
          </li>
        ))}
        {!movs.length && <li className="muted">Sem movimentações ainda.</li>}
      </ul>
    </div>
  );
}
```
> `react-chartjs-2` exige registro dos elementos do Chart.js. Verificar se o projeto já faz `ChartJS.register(...)` globalmente (procurar em componentes que usam gráficos, ex. Panorama). Se não houver registro global, adicionar no topo deste arquivo:
> ```jsx
> import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';
> ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);
> ```

- [ ] **Step 2: Exibir no modal da cena**

Modify `bussola_web/src/pages/Metas/index.jsx` (ou o componente do modal): abaixo da `CofreScene`, renderizar `<MetaHistorico meta={selectedMeta} onChange={fetchData} />`.

- [ ] **Step 3: Build + verificação visual**

Run: `cd bussola_web && npm run build`
Expected: ok. Manual: após 2+ aportes, o gráfico de linha aparece subindo; timeline lista as movimentações; excluir um aporte recalcula saldo e progresso.

- [ ] **Step 4: Commit**

```bash
git add bussola_web/src/pages/Metas/
git commit -m "feat(metas): grafico de evolucao (Chart.js) + timeline de movimentacoes"
```

---

# PHASE 5 — Aporte mensal agendado (frontend)

### Task 16: Configurar aporte mensal + confirmar pendente

**Files:**
- Modify: `bussola_web/src/pages/Metas/components/MetaModals.jsx`
- Modify: `bussola_web/src/pages/Metas/components/MetaCard.jsx`
- Modify: `bussola_web/src/pages/Metas/index.jsx`

**Interfaces:**
- Consumes: `updateMeta` (grava `aporte_mensal_valor`/`aporte_mensal_dia`), `toggleMovimentacao` (confirma pendente).

- [ ] **Step 1: Campos de aporte mensal no modal de meta**

Modify `bussola_web/src/pages/Metas/components/MetaModals.jsx` — no form do modal `meta`, adicionar dois campos opcionais: "Aporte mensal (R$)" (`aporte_mensal_valor`) e "Dia do mês" (`aporte_mensal_dia`, `min=1 max=28`), incluídos no `payload`. Atualizar `EMPTY` e o `useEffect` de edição para carregá-los.

- [ ] **Step 2: Badge de pendente no card**

Modify `bussola_web/src/pages/Metas/components/MetaCard.jsx` — receber prop `aportePendente` (a movimentação Pendente da meta, se houver) e, quando presente, mostrar um chip "Confirmar aporte de {valor}" com botão que chama `onConfirmAporte(meta, aportePendente)`.

- [ ] **Step 3: Buscar pendentes e confirmar**

Modify `bussola_web/src/pages/Metas/index.jsx`:
- Para cada meta com `aporte_mensal_valor`, buscar as movimentações (`listMovimentacoes`) e achar a Pendente do mês; passar como `aportePendente` ao `MetaCard`. (Alternativa mais simples: o dashboard já roda `gerar_aportes_agendados`; buscar pendentes só ao abrir a meta. Se preferir evitar N requests, mostrar o badge apenas dentro da cena/modal via `MetaHistorico`, que já lista pendentes.)
- `onConfirmAporte`: chama `toggleMovimentacao(meta.id, mov.id)` → toast "Aporte confirmado!" → `fetchData()`.

- [ ] **Step 4: Build + verificação visual (fluxo mensal)**

Run: `cd bussola_web && npm run build`
Expected: ok. Manual: editar meta, definir aporte mensal R$500 dia 5, salvar; recarregar `/metas` (o backend gera a pendente); abrir a meta → na timeline aparece "Aporte (mensal) — Pendente"; confirmar → saldo sobe R$500, some da pendência.

- [ ] **Step 5: Rodar a suíte de backend inteira (garantia de não-regressão)**

Run: `cd bussola_api && pytest -q`
Expected: todos os testes de metas/finanças passam.

- [ ] **Step 6: Commit**

```bash
git add bussola_web/src/pages/Metas/
git commit -m "feat(metas): configurar aporte mensal e confirmar pendente (fluxo tipo conta)"
```

---

## Notas finais de execução

- **Ordem:** fases são sequenciais; dentro de uma fase, as tasks também (cada uma depende de interfaces da anterior).
- **Ponto de atenção #1 (`_saldo_bruto`):** o cálculo do saldo bruto em `metas/endpoints.py` e em `services/financas.py` deve usar exatamente a mesma definição que o front de Finanças usa hoje (`Σ total_ganho − Σ total_gasto`). Se `get_dashboard_data` já expõe esse total, reusar em vez de recomputar.
- **Ponto de atenção #2 (Chart.js):** confirmar se há registro global de componentes do Chart.js antes de assumir; seguir a nota da Task 15.
- **Ponto de atenção #3 (Navbar/modais):** Navbar e classes de modal devem copiar 1:1 os padrões existentes (`FinancasModals.jsx`, `Navbar.jsx`) — não inventar estrutura nova.
- **Docs:** ao final, atualizar `docs/FINANCE.md` com uma seção "Metas & Cofrinhos" (opcional, fora das tasks de código).
