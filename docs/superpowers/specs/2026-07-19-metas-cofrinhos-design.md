# Design — Sistema de Metas & Cofrinhos (Módulo Finanças)

**Data:** 2026-07-19
**Módulo:** Finanças / Provisões (Bússola V2)
**Status:** Aprovado — pronto para plano de implementação

---

## 1. Objetivo

Adicionar ao módulo de Provisões um sistema de **Metas** (cofrinhos/baús): o usuário
cria um objetivo com valor-alvo (ex: "Comprar carro — R$ 50.000") e vai **guardando
dinheiro** nele, seja de forma **avulsa** ou por um **aporte mensal agendado que ele
confirma** (reaproveitando a mecânica `Pendente → Efetivada` já existente nas
transações). A experiência de guardar é **lúdica e dinâmica**: uma tela imersiva onde
o usuário digita um valor, **arrasta uma moeda 2.5D** e a solta dentro do
cofrinho/baú, com animação, confete e progresso subindo.

Referências de mercado que inspiram o design: **Nubank Caixinhas**, **Monzo Pots**
(transferência real, pote separado, locked pots), **YNAB** (meta com data-alvo e
aporte sugerido) e **Qapital / PicPay Cofrinho** (imagem da meta, aporte agendado).

---

## 2. Decisões de produto (fixadas no brainstorming)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Modelo contábil | **Movimento real** — o dinheiro sai do saldo e vai pro pote |
| 2 | Aporte vs gasto | **Transferência neutra** — reduz o disponível, mas NÃO é despesa |
| 3 | Escopo extra | Projeção + aporte sugerido · Meta trancada (locked) · Histórico + gráfico |
| 4 | Escopo cortado | **Round-up** (fica fora do MVP) |
| 5 | Tech visual | **2.5D que parece 3D** — CSS 3D + Framer Motion (não WebGL) |
| 6 | KPIs em Finanças | Finanças passa a mostrar 3 números (Disponível / Guardado / Total) |
| 7 | Navegação | **Rota dedicada `/metas`** (+ atalho no header de Finanças e item na Navbar) |
| 8 | Nome do módulo | **"Metas"** (visual de cofrinho/baú) |

---

## 3. Modelo contábil (o coração)

Guardar dinheiro é uma **transferência neutra**: sai do *disponível*, vira *guardado*,
mas continua sendo patrimônio do usuário. **Nenhum aporte vira uma `Transacao` de
despesa.**

```
Patrimônio total  =  Saldo bruto (receitas efetivadas − despesas efetivadas)   ← NÃO muda ao guardar
Guardado          =  Σ aportes efetivados − Σ retiradas efetivadas   (metas ativas)
Disponível        =  Patrimônio total − Guardado                     ← o que sobra pra gastar
```

Invariante: **Total = Disponível + Guardado**. Guardar R$ 500 move R$ 500 de
*Disponível* → *Guardado*; o Total não muda. Quando o usuário **de fato compra o carro**,
ele lança uma despesa normal no fluxo (fora do escopo da meta — a meta só acumula).
Retirar da meta devolve ao *Disponível*. Excluir uma meta devolve o guardado ao
*Disponível* automaticamente (deixa de ser contado).

O `saldo_atual` de cada Meta é um **cache denormalizado** (padrão idêntico ao
`HistoricoGastoMensal`): recalculado a cada movimentação efetivada, e sempre
re-derivável de `Σ MovimentacaoMeta` para segurança.

---

## 4. Data model (backend)

Novo arquivo `app/models/metas.py`. Segue os padrões de `financas.py`: `user_id`
obrigatório (multi-tenancy), `icone`/`cor` para UI, `status` string, datas em UTC via
`now_utc`.

### `Meta` — o cofrinho

| Campo | Tipo | Default | Nota |
|---|---|---|---|
| `id` | Integer PK | | |
| `user_id` | FK user.id | | isolamento por usuário |
| `nome` | String(150) | | "Comprar carro" |
| `valor_alvo` | Float | | 50000.0 |
| `saldo_atual` | Float | 0.0 | cache = Σ movimentações efetivadas |
| `data_alvo` | Date | null | usado em projeção/aporte sugerido |
| `icone` | String(50) | `fa-solid fa-piggy-bank` | mesmo padrão de Categoria |
| `cor` | String(7) | `#4f46e5` | |
| `imagem_url` | String(500) | null | capa opcional (ou emoji/preset) |
| `trancada` | Boolean | False | locked — bloqueia retirada |
| `status` | String(50) | `ativa` | `ativa` / `concluida` / `arquivada` |
| `aporte_mensal_valor` | Float | null | valor do aporte agendado |
| `aporte_mensal_dia` | Integer | null | dia do mês (1–28) do aporte |
| `created_at` | DateTime | `now_utc` | |
| `concluida_em` | DateTime | null | preenchido ao bater o alvo |

Relacionamento: `movimentacoes = relationship('MovimentacaoMeta', cascade="all, delete-orphan")`.
`User` ganha `back_populates="metas"`.

### `MovimentacaoMeta` — o extrato do cofrinho

| Campo | Tipo | Default | Nota |
|---|---|---|---|
| `id` | Integer PK | | |
| `meta_id` | FK meta.id | | |
| `user_id` | FK user.id | | |
| `tipo` | String(20) | | `aporte` / `retirada` |
| `valor` | Float | | sempre positivo; `tipo` define o sinal |
| `data` | DateTime | `now_utc` | |
| `status` | String(50) | `Efetivada` | `Pendente` / `Efetivada` — reusa a máquina de confirmar |
| `origem` | String(20) | `manual` | `manual` (avulso) / `agendado` (mensal) |
| `id_grupo_recorrencia` | String(100) | null (index) | série do aporte mensal |
| `observacao` | String(300) | null | |

Regra: aporte **manual** nasce `Efetivada`; aporte **agendado** nasce `Pendente`
(o usuário confirma, igual uma conta).

### Migration

Uma migration Alembic (`alembic revision --autogenerate`) criando as duas tabelas.

---

## 5. Backend — serviço, schemas e API

Camadas idênticas ao resto do projeto:
`endpoints/metas.py → services/metas.py → models/metas.py`, com `schemas/metas.py`.
Router registrado em `app/api/v1/router.py` com prefixo **`/financas/metas`** (sub-recurso
de Finanças) e tag `Metas`.

### Schemas (`schemas/metas.py`)

- Enums: `TipoMovimentacao` (`aporte`/`retirada`), `OrigemMovimentacao` (`manual`/`agendado`),
  `StatusMeta` (`ativa`/`concluida`/`arquivada`). Reusa `StatusTransacao` de `financas.py`.
- `MetaCreate`, `MetaUpdate`, `MetaResponse` (com campos calculados: `progresso_pct`,
  `aporte_sugerido`, `data_projetada`, `meses_restantes`).
- `MovimentacaoCreate`, `MovimentacaoResponse`.
- `MetasDashboardResponse`: `{ metas: [MetaResponse], resumo: { disponivel, guardado, total } }`.

### Endpoints (`/financas/metas`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/financas/metas` | Lista metas + campos calculados + resumo (disponível/guardado/total) |
| `POST` | `/financas/metas` | Cria meta |
| `PUT` | `/financas/metas/{id}` | Edita (alvo, data, trancar/destrancar, configurar aporte mensal) |
| `DELETE` | `/financas/metas/{id}` | Exclui meta (guardado volta ao disponível) |
| `POST` | `/financas/metas/{id}/movimentacoes` | Aporte/retirada **avulso** (valida locked, valida saldo, marca `concluida` ao bater alvo) |
| `GET` | `/financas/metas/{id}/movimentacoes` | Extrato (timeline + gráfico) |
| `PUT` | `/financas/metas/{id}/movimentacoes/{mid}/toggle-status` | **Confirma aporte mensal pendente** (Pendente→Efetivada) |
| `DELETE` | `/financas/metas/{id}/movimentacoes/{mid}` | Remove movimentação (recalcula `saldo_atual`) |

### Regras de negócio no serviço (`services/metas.py`)

- **Aporte**: cria `MovimentacaoMeta(tipo='aporte', status='Efetivada')`, incrementa
  `saldo_atual`. Se `saldo_atual >= valor_alvo` → `status='concluida'`, `concluida_em=now`.
- **Retirada**: valida `valor <= saldo_atual`; se `trancada` e não (concluída ou
  `data_alvo` já passou) → **HTTP 400** ("meta trancada"). Decrementa `saldo_atual`;
  se cai abaixo do alvo, volta a `ativa`.
- **Confirmar aporte mensal** (`toggle-status`): Pendente→Efetivada aplica ao
  `saldo_atual` (mesma lógica de aporte). Efetivada→Pendente reverte.
- **Aporte mensal (geração)**: espelha o worker de horizonte de `financas.py`. Ao
  configurar `aporte_mensal_valor`/`dia`, o serviço gera `MovimentacaoMeta` **Pendente**
  (`origem='agendado'`, `id_grupo_recorrencia`) para o mês corrente/próximo, num
  horizonte curto (1 mês). Geração idempotente disparada no `GET` do dashboard de metas
  (padrão passivo já usado em Finanças) — não cria um worker novo.
- **Projeção (cálculo puro, sem storage)**:
  - `meses_restantes = meses de hoje até data_alvo` (se houver).
  - `aporte_sugerido = (valor_alvo − saldo_atual) / meses_restantes`.
  - `data_projetada` = no ritmo médio dos aportes efetivados dos últimos N meses,
    quando `saldo_atual` alcança `valor_alvo`. Se ritmo = 0 → `null`.
- **Resumo/KPIs**: `guardado = Σ saldo_atual das metas ativas`;
  `total = saldo bruto de Finanças`; `disponivel = total − guardado`.

---

## 6. Integração com o saldo de Finanças (3 KPIs)

A resposta do dashboard de Finanças (`services/financas.py` /
`schemas/financas.py::FinancasDashboardResponse`) ganha um bloco `resumo_patrimonio`:
`{ disponivel, guardado, total }`. O header de `pages/Financas/index.jsx` passa a exibir
os 3 números no lugar do saldo único atual. O **Panorama** (dashboard agregador) também
reflete o `disponivel` corrigido. Mudança cross-cutting, isolada e pequena: apenas
subtrair o `guardado` do saldo já calculado.

---

## 7. Frontend — a experiência 2.5D

**Rota dedicada `/metas`** em `src/routes/index.jsx` (PrivateRoute), item novo na
`Navbar`, e atalho no header de `Financas`.

### Tela 1 — Grade de cofrinhos (`src/pages/Metas/index.jsx`)

Header com os 3 KPIs (Disponível / Guardado / Total). Grade de `MetaCard` (padrão visual
de `CategoryCard`): anel/barra de progresso, capa (ícone/cor/emoji), `R$ guardado /
R$ alvo`, data projetada, badge de "aporte pendente" quando houver, botão **Guardar**.
Botão "Nova meta". Context API + Toast + ConfirmDialog, idênticos ao resto do app.

### Tela 2 — O Cofre imersivo (`/metas/:id` ou overlay)

O coração lúdico:

```
   Digite:  [ R$ 500,00 ]
        ◉  ← arrasta a moeda (gira, física leve via Framer Motion)
       /
      ▼
   ╭──────╮   baú/cofrinho é drop target:
   │  ᵜᵜ  │   detecta o "solta", treme, tampa pula,
   │ ҉҉҉҉ │   moedas empilham + confete ✨
   ╰──────╯
   R$ 3.200 / R$ 50.000   [███░░░░░░░] 6%
```

Fluxo: digita valor → arrasta a `Coin` (com o valor escrito nela) → solta sobre o
`Bau` (drop target com hit-detection) → `POST /financas/metas/{id}/movimentacoes`
(aporte manual) → animação otimista + confete + progresso sobe. A mesma tela concentra:
configurar **aporte mensal**, **retirar**, **trancar/destrancar**, **gráfico de
evolução** (Chart.js — já instalado) e **timeline** das movimentações.

### Componentes

| Componente | Responsabilidade |
|---|---|
| `MetaCard.jsx` | Card na grade (padrão `CategoryCard`) |
| `CofreScene.jsx` | Cena 2.5D Framer Motion: drag da moeda, hit-detection no baú, animações |
| `Coin.jsx` | Visual da moeda/cédula com o valor digitado escrito nela |
| `MetaModals.jsx` | Criar/editar meta, configurar aporte mensal, retirar (padrão `FinancasModals`) |
| `MetaHistorico.jsx` | Timeline + gráfico de evolução (Chart.js) |
| Confete | Componente próprio em CSS/Framer (sem dep extra) |

Wrappers HTTP em `src/services/api.js` (padrão `getFinancasDashboard` etc.).

### Dependência nova

Apenas **`framer-motion`**, isolada ao módulo Metas. Confete e efeitos 3D via CSS
`transform`/`perspective`. Chart.js reaproveitado.

---

## 8. Faseamento da implementação

1. **Backend + migration** — `models/metas.py`, `schemas/metas.py`, `services/metas.py`
   (math de aporte/retirada/projeção/locked/recompute), `endpoints/metas.py`, registro no
   router, migration Alembic. Testes de serviço via TDD.
2. **Integração de saldo** — `resumo_patrimonio` no dashboard de Finanças + ajuste do
   Panorama.
3. **Frontend base** — rota `/metas`, item na Navbar, grade de cofrinhos, `MetaModals`
   (CRUD), aporte/retirada funcionais **sem** a cena 2.5D ainda; 3 KPIs no header de
   Finanças.
4. **A cena 2.5D** — `CofreScene` (drag + hit-detection + confete), `Coin`,
   `MetaHistorico` (gráfico + timeline).
5. **Aporte mensal agendado** — geração de pendentes + fluxo de confirmar (badge na
   grade e no dashboard).

---

## 9. Testes

- **Backend (foco, TDD)**: math de aporte/retirada; guarda de meta trancada;
  recomputo de `saldo_atual` após delete de movimentação; cálculo de `aporte_sugerido` e
  `data_projetada`; idempotência da geração do aporte mensal; invariante
  `Total = Disponível + Guardado`; isolamento por `user_id`.
- **Frontend**: o projeto não possui suíte de testes JS configurada (sem script `test`
  em `package.json`); validação será manual/visual, seguindo a convenção atual do repo.

---

## 10. Fora de escopo (MVP)

- **Round-up** (troco automático de compras) — adiável para uma fase futura.
- Rendimento/juros sobre o guardado (as metas não rendem — só acumulam).
- Metas compartilhadas entre usuários.
- WebGL / modelos 3D reais (fica no 2.5D).
