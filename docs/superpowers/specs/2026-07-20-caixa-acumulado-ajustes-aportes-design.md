# Caixa acumulado, ajustes de caixa e aportes pendentes

**Data:** 2026-07-20
**Status:** Aprovado (design)

## Problemas

1. **Dinheiro histórico ("aumentar caixa" / saldo inicial):** o usuário tem
   dinheiro guardado de antes de usar o Bussola. Lançar como receita normal
   corrompe histórico/gráficos do mês, porque não é receita do período. Precisa
   de uma forma de somar esse valor ao patrimônio **sem** entrar nos gráficos
   mensais nem nas estatísticas de categoria.

2. **Inconsistência mensal×acumulado (descoberta):** hoje `total` =
   receitas−despesas **do mês**, mas `guardado` (cofrinhos) é **acumulado**.
   Logo `disponível = net_do_mês − guardado_acumulado` pode ficar absurdo
   (ex.: net R$500 no mês, R$3.000 guardado há anos → disponível −2.500).

3. **Aportes automáticos:** devem ficar `Pendente` até o usuário efetivar
   (como recorrentes), e ser efetiváveis tanto na tabela de transações quanto no
   modal do cofre. Hoje já nascem `Pendente`, mas a linha de cofre na tabela de
   transações não tem o botão Efetivar.

4. **Origem do aporte:** na transação, distinguir aporte automático (`agendado`)
   de manual.

## Decisões (confirmadas com o usuário)

- **Caixa acumulado** (não mensal-com-base-fixa).
- **Lista de ajustes de caixa** (não um valor único).

---

## Parte A — Caixa acumulado + ajustes de caixa

### Modelo

```
Caixa (patrimônio) = Σ ajustes(entrada − saída)
                   + Σ receitas efetivadas (todos os tempos)
                   − Σ despesas efetivadas (todos os tempos)
Guardado   = Σ saldo_atual dos cofrinhos ativos   (já existente)
Disponível = Caixa − Guardado
Invariante: disponível + guardado = caixa
```

Só `status == 'Efetivada'` conta (pendentes/futuras ficam de fora). Movimentações
de cofrinho continuam neutras (não são `Transacao`, não afetam o caixa; só movem
entre disponível e guardado).

### Backend

**`app/models/caixa.py`** (novo) — `AjusteCaixa`:
`id, user_id, tipo ('entrada'|'saida'), valor (MoneyCents), data (DateTime),
observacao, created_at`. Registrar em `app/models/__init__.py`.

**`app/schemas/caixa.py`** (novo) — `AjusteCaixaCreate/Update/Response`.

**`app/services/financas.py`**
- `calcular_caixa(db, user_id)` → ajustes(entrada−saída) + receita_efetivada_total
  − despesa_efetivada_total. Cada `func.sum(MoneyCents)` volta em reais.
- CRUD: `listar_ajustes / criar_ajuste / atualizar_ajuste / deletar_ajuste`.
- `get_dashboard_data`: passa `calcular_caixa(...)` para `calcular_resumo` em vez
  do net mensal.

**`app/services/metas.py`**
- `calcular_resumo(db, user_id, caixa)`: `total=caixa`, `guardado=total_guardado`,
  `disponivel=caixa−guardado`. (Rename do parâmetro `saldo_bruto`→`caixa`.)

**`app/api/v1/endpoints/financas.py`**
- `GET/POST /financas/caixa/ajustes`, `PUT/DELETE /financas/caixa/ajustes/{id}`.

**Migração Alembic** para `ajuste_caixa` (hand-written; `create_all` no import já
cria a tabela em prod — reconciliar com `alembic stamp head` se preciso).

### Frontend

**`services/api.ts`** — `getAjustesCaixa / createAjusteCaixa / updateAjusteCaixa /
deleteAjusteCaixa`.

**`pages/Financas/components/CaixaModal.jsx`** (novo) — lista de ajustes +
form (tipo entrada/saída, valor, data, observação) com adicionar/editar/excluir.

**`pages/Financas/index.jsx`** — chip **"Caixa"** clicável no header (= `resumo.total`)
abre o `CaixaModal`; recarrega no `onUpdate`.

Ajustes **não** aparecem na lista de transações (ficam só no modal + no KPI Caixa),
pra não confundir com lançamentos do mês.

### Panorama

- **`services/panorama.py`**: KPI `caixa` = `financas_service.calcular_caixa(...)`.
- **`schemas/panorama.py`**: campo `caixa`.
- **Frontend Panorama**: card KPI "Caixa/Patrimônio". Gráficos/KPIs mensais
  inalterados (ajustes nunca entram).

---

## Parte B — Aportes automáticos pendentes + origem

### Efetivar na tabela de transações
- `schemas/metas.py` `CofreMovRow`: adicionar `origem`.
- `services/metas.py` `listar_grupos_cofre`: incluir `origem` em `movimentacoes`.
- `pages/Financas/index.jsx` (`cofreRows`): propagar `origem`.
- `TransactionCard.jsx` (ramo cofre): botão **Efetivar/Desmarcar** (mirror
  recorrente) via `toggleMovimentacao(meta_id, _movId)`; e **tag origem**
  ("Automático" para `agendado`, "Manual" caso contrário).

Aportes agendados continuam nascendo `Pendente` (já é o caso); nada auto-efetiva.

### Ajustes de cofre (refino do trabalho anterior)
- **Excluir na tabela:** botão excluir na linha de cofre →
  `deleteMovimentacao(meta_id, _movId)`. (Estava só no modal.)
- **Limite do cofre:** aporte não pode ultrapassar `valor_alvo` (hoje dá pra
  estourar clicando +100 repetidamente); retirada não pode passar do saldo.
  - Backend: validar em `criar_movimentacao` e `atualizar_movimentacao`
    (`saldo + aporte ≤ valor_alvo`; saldo resultante ≤ alvo e ≥ 0).
  - Frontend `CofreScene`: clampar chips (+50/+100…) e o valor final ao
    restante (`valor_alvo − saldo`) no modo guardar e ao `saldo` no retirar.
  - `gerar_aportes_agendados`: capar o valor gerado ao restante; pular se já
    estiver no alvo.
- **Editar aporte sem observação:** remover o campo `observação` do
  `MovimentacaoEditForm` (não faz sentido ali). Como o form não envia mais
  `observacao`, reverter o carregamento de `observacao` na linha de cofre
  (`CofreMovRow`, `listar_grupos_cofre`, `cofreRows`).

---

## Testes (pytest)

- `calcular_caixa`: ajustes(entrada/saída) + receitas/despesas efetivadas;
  pendentes/futuras não contam.
- `calcular_resumo` com caixa: invariante `disponivel + guardado == total`.
- CRUD de ajuste recomputa o caixa.
- (metas/financas existentes continuam passando; ajustar chamadas de
  `calcular_resumo` que usavam `saldo_bruto=`.)

## Fora de escopo

- Modelo completo de Contas.
- Ajustes de caixa como linhas na lista de transações.
- Excluir movimentação de cofre pela tabela de transações (fica no modal).
