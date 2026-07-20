# Edição sincronizada de grupos de transação e movimentações de cofre

**Data:** 2026-07-20
**Status:** Aprovado (design)

## Problema

Dois buracos no módulo de Finanças/Metas:

1. **Edição de transações agrupadas** (parcelada / recorrente): ao editar uma
   ocorrência, não há escolha de alcance. Hoje `atualizar_transacao` só propaga
   `valor`/`descricao`/`categoria_id` para o futuro **quando é `recorrente`**;
   parcelada é sempre individual. O usuário quer:
   - mudança de **categoria** (e descrição) → refletir em **todo o grupo**;
   - mudança de **valor** → **perguntar** se é "somente esta" ou "esta e as
     futuras".

2. **Edição de aporte/retirada do cofre**: `MovimentacaoMeta` tem create / list /
   toggle-status / delete, mas **não tem update**. A movimentação aparece como
   linha na lista de Finanças (via `listar_grupos_cofre`), mas sem editar. Tudo
   deve ficar sincronizado entre a timeline da meta e a lista de transações.

## Decisões de design (confirmadas com o usuário)

- **Alcance de edição de grupo:** depende do campo. Categoria/descrição mudam o
  grupo inteiro automaticamente; só valor abre diálogo de alcance.
- **Valor de parcela com "esta e as futuras":** parcelas independentes; o total
  exibido (`valor_total_parcelamento`) é recalculado como a soma real.
- **Cofre continua virtual** (transferência neutra, não entra em receita/despesa).
  Apenas ganha edição que sincroniza saldo + patrimônio.
- **Edição de cofre disponível nos dois lugares:** timeline da meta e lista de
  Finanças.

Sem migração de banco: ambas as features usam colunas já existentes. `escopo_valor`
e os campos de `MovimentacaoUpdate` são apenas de request, não colunas.

---

## Parte A — Edição de transações agrupadas com alcance

### Backend

**`schemas/financas.py`**
- `TransacaoUpdate` ganha `escopo_valor: Optional[str] = 'apenas'` (valores
  `'apenas'` | `'futuras'`). Só controla a propagação de `valor`.

**`services/financas.py::atualizar_transacao` (reescrito)**

Regras de propagação por campo, considerando "agrupada" =
`id_grupo_recorrencia` presente e `tipo_recorrencia in ('recorrente','parcelada')`:

| Campo | Pontual | Agrupada |
|-------|---------|----------|
| `categoria_id`, `descricao` | só a alvo | **grupo inteiro** (passado + futuro) |
| `valor` | só a alvo | alvo; se `escopo_valor=='futuras'`, também `data > data_original` |
| `data`, `status`, `recorrencia_encerrada` | só a alvo | só a alvo |

- Para **parcelada**, após aplicar `valor`, recalcular
  `valor_total_parcelamento = soma(valor de todas as linhas do grupo)` e gravar
  em **todas** as linhas do grupo (mantém o total coerente na exibição).
- Recorrente não tem total → sem recálculo.
- Ordem: aplica todos os campos na alvo (setattr) → propaga categoria/descrição
  ao grupo → propaga valor ao conjunto conforme escopo → recalcula total.

Isso **muda** o comportamento atual de recorrente (que sempre propagava valor ao
futuro): agora o usuário escolhe.

### Frontend

**`context/ConfirmDialogContext.jsx`** (enhancement retrocompatível)
- `openDialog` aceita opcionalmente `options: [{ label, value, variant }]`.
  Quando presente, renderiza esses botões e resolve com o `value` escolhido
  (cancelar resolve `null`/`false`). Sem `options` → comportamento atual
  (true/false) intacto.

**`pages/Financas/components/FinancasModals.jsx`**
- No submit de edição de transação agrupada (`editingData` presente,
  `tipo_recorrencia in ['parcelada','recorrente']`, `id_grupo_recorrencia`
  presente) **e valor alterado** (`Number(formData.valor) !== Number(editingData.valor)`):
  abre o seletor de alcance (*Somente esta* / *Esta e as futuras*) e envia
  `escopo_valor`. Mudança só de categoria/descrição/data não abre diálogo.

**`services/api.ts`**
- `updateTransacao` já existe; o payload passa a poder incluir `escopo_valor`.

---

## Parte B — Editar aporte/retirada do cofre (sincronizado)

### Backend

**`schemas/metas.py`**
- Novo `MovimentacaoUpdate`: `tipo?`, `valor?` (gt=0), `data?`, `observacao?`
  (todos opcionais). Status fica no toggle existente.

**`services/metas.py::atualizar_movimentacao(db, meta_id, mov_id, mov_in, user_id)`**
- Carrega meta + movimentação (escopo user + meta).
- Aplica campos fornecidos.
- Validações:
  - se resultar em `retirada` e a meta estiver trancada sem liberação
    (`_pode_retirar` == False) → `ValueError`.
  - se a edição deixaria o saldo consolidado (soma das efetivadas) negativo →
    `ValueError` + rollback.
- `_recompute_saldo` (recalcula saldo e status concluída/ativa).
- Retorna a movimentação.
- **Agendado:** editar uma ocorrência afeta só ela; não altera
  `aporte_mensal_valor` da meta. `gerar_aportes_agendados` continua idempotente
  (dedupe por origem + ano + mês), então não recria a editada.

**`endpoints/metas.py`**
- `PUT /financas/metas/{meta_id}/movimentacoes/{mov_id}` → `MovimentacaoResponse`.
  400 em `ValueError`, 404 se não achar.

### Frontend

**`services/api.ts`**
- `updateMovimentacao(metaId, movId, data)` → PUT.

**Novo `pages/Metas/components/MovimentacaoEditForm.jsx`**
- Só os campos (tipo toggle guardar/retirar, valor, data, observação) — sem
  wrapper de modal. Reutilizado nos dois lugares.

**`pages/Metas/components/MetaHistorico.jsx`**
- Botão editar por item → edição **inline** (item vira formulário), sem modal
  aninhado (respeita o padrão de "views internas" do MetasModal). Salva via
  `updateMovimentacao` → recarrega + `onChange`.

**`pages/Financas/components/TransactionCard.jsx`** (ramo de cofre)
- Botão editar → chama `onEditCofre(transacao)` (nova prop).

**`pages/Financas/index.jsx`**
- Handler `onEditCofre` abre um `BaseModal` com `MovimentacaoEditForm`
  preenchido via `meta_id` / `_movId` / `tipo_mov` / `valor` / `data`. Salva →
  `fetchData`.

---

## Fluxo de dados

- Editar valor de grupo → modal → seletor de alcance → `PUT /transacoes/{id}`
  com `escopo_valor` → service propaga → `fetchData`.
- Editar categoria/descrição de grupo → `PUT` → service propaga ao grupo todo →
  `fetchData`.
- Editar movimentação de cofre (qualquer lugar) →
  `PUT /metas/{meta}/movimentacoes/{mov}` → `_recompute_saldo` → ambas as views
  recarregam do mesmo registro.

## Tratamento de erros

- Retirada > saldo / meta trancada → 400 → toast.
- Não encontrado → 404.
- `escopo_valor` ausente → default `'apenas'`.

## Testes (pytest, seguindo `tests/` existente)

Transações (`test_financas_service` / `test_financas_api`):
- categoria propaga ao grupo inteiro (recorrente **e** parcelada, passado + futuro);
- valor `escopo='apenas'` altera só a alvo; `'futuras'` altera alvo + posteriores;
- valor de parcela recalcula `valor_total_parcelamento` (soma real).

Cofre (`test_metas_service` / `test_metas_api`):
- editar valor recomputa `saldo_atual`;
- flip aporte↔retirada recomputa saldo;
- retirada que excede saldo → `ValueError` / 400;
- meta trancada bloqueia edição para retirada.

## Fora de escopo

- Materializar cofre como `Transacao` real no banco.
- Alcance de edição em movimentações de cofre (cada uma é individual).
- Toggle de status na lista de Finanças para linhas de cofre (opcional; a
  timeline da meta já tem confirmar).
