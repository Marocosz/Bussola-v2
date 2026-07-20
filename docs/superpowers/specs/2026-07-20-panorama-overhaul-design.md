# Panorama Overhaul — correção, valor e redesign "Reservatório"

**Data:** 2026-07-20
**Status:** Em revisão (design)
**Base:** análise sênior de produto/eng do Panorama atual (8 gráficos Chart.js).

## Objetivo

Transformar o Panorama de um "dashboard genérico de widgets" em uma **visão
panorâmica coerente, honesta e com identidade** (linguagem visual da jarra do
cofrinho), em 3 camadas incrementais que andam **sincronizadas** com Finanças e
Metas (mesma fonte de verdade de números):

- **P0 — Correção:** consertar incoerências temporais e bugs expostos pelo filtro de data.
- **P1 — Valor:** deltas vs período anterior, orçamento por categoria, trazer Cofrinhos + Ritmo, consolidar tarefas, demover cofre de senhas.
- **P2 — Assinatura:** herói "Reservatório" (metáfora de fluido, continuidade com a jarra) + faixa "Atenção agora" (insights determinísticos).

Princípio-mestre de sincronização: **o Panorama NUNCA recalcula dinheiro por
conta própria.** Ele consome `financas_service.calcular_caixa`,
`metas_service.calcular_resumo`, `metas_service.total_guardado` e os totais de
categoria já usados na tela de Finanças. Assim Caixa/Disponível/Guardado são
idênticos em Finanças, Metas e Panorama.

---

## Contrato de dados (backend `services/panorama.py` + `schemas/panorama.py`)

`get_dashboard_data(db, user_id, start_date, end_date)` continua recebendo o
intervalo `[start, end)`. Semântica temporal explícita e coerente:

- **Métricas de período** (respeitam `[start,end)`): receita, despesa, balanço,
  gastos por categoria, receita por categoria, padrão semanal, orçamento.
- **Estoque acumulado** (independe do range, é saldo, não fluxo): `caixa`,
  `disponivel`, `guardado`.
- **Tendência** (janela própria rolante, rotulada): evolução mensal + linha de
  Caixa real (12 meses terminando em `max(hoje, end)`), rotulada "Últimos 12 meses".

### Campos novos/alterados do payload

```
kpis:
  receita_mes, despesa_mes, balanco_mes          # período
  caixa, disponivel, guardado                    # acumulado (calcular_caixa/resumo)
  comparativo: { receita, despesa, balanco }     # período anterior [start-Δ, start)
  # agenda/registros/cofre: mantidos, mas cofre-senhas demovido no front
evolucao: { labels[], receita[], despesa[], caixa_real[] }   # 12m; caixa_real = trajetória real
gastos_por_categoria: { labels, data, colors }               # período (top N + "Outros")
receitas_por_categoria: { labels, data, colors }             # NOVO — período (para o Reservatório)
padrao_semanal: { labels, data }                             # MÉDIA por dia da semana (não soma)
forecast: null | { elapsed, total, projetado, conhecido_pendente, status } # só se hoje ∈ [start,end)
orcamento: [ { nome, cor, icone, gasto, limite, pct } ]      # NOVO — período (só faz sentido em 1 mês)
cofrinhos: { total_guardado, qtd, metas: [ enriquecer_meta(...) ] }  # NOVO
ritmo: { peso_atual, peso_delta, treinos_periodo, adesao_dieta } | null  # NOVO (compacto)
insights: [ { id, tipo, severidade, titulo, detalhe, acao } ]           # NOVO — regras determinísticas
```

---

## P0 — Correção (detalhe por bug)

1. **Forecast honesto.** `forecast` só é retornado quando `hoje ∈ [start,end)`.
   - `elapsed = (hoje − start).days + 1`, `total = (end − start).days`.
   - `projetado = despesa_ate_hoje/elapsed × total + despesa_pendente_conhecida_no_resto`
     (recorrentes/parceladas/pontuais `Pendente` com `data ∈ [hoje, end)`). Usar o que o
     app já sabe, não só extrapolação linear.
   - `status = 'danger'` se `projetado > receita_periodo` senão `'safe'`.
   - Período passado/fechado → `forecast = null`; o front mostra o resultado real ("período fechado").

2. **Linha de Caixa real** (`caixa_real[]`). Para cada mês da janela de tendência:
   `caixa_no_fim_do_mês = ajustes(entrada−saída até a data) + Σ(receita−despesa efetivada até a data)`.
   Baseline = caixa no início da janela (não zero). Substitui o "acumulado" falso.

3. **Tendência rotulada.** Janela sempre 12 meses terminando em `max(hoje,end)`; título "Últimos 12 meses". As métricas de período continuam separadas — a incoerência some porque a semântica fica explícita.

4. **Cores por tema.** Hook `useThemeColors()` lê as CSS vars
   (`getComputedStyle(document.documentElement)`) e reconstrói as cores dos
   gráficos; re-lê quando o tema muda (observando `data-theme`/classe no root).
   Zero hex hardcoded → conserta tema claro (gauge/radar).

5. **Padrão semanal = média.** `média_dia = Σ(gasto no dia da semana) / nº de ocorrências daquele dia no range`. Rótulo "Média por dia da semana".

---

## P1 — Valor

6. **Deltas vs período anterior.** Backend calcula o período anterior de mesmo
   tamanho `[start−(end−start), start)` e devolve `comparativo`. Front mostra
   ▲/▼ % em Receita, Despesa, Balanço. Cenário: período anterior sem dados → "—".

7. **Orçamento por categoria (burndown).** Usa `Categoria.meta_limite` (despesa)
   e o gasto do período. Só é exibido quando o range é **um mês** (limite é
   mensal); em range multi-mês, esconde com nota "orçamento é mensal". Barra por
   categoria com % e destaque de estouro (>100%). Alimenta insight de estouro.

8. **Cofrinhos no Panorama.** `cofrinhos` via `metas_service.listar_metas` +
   `enriquecer_meta` (progresso, data projetada). Base para as mini-jarras e o
   Reservatório. Só metas `ativa` (arquivada/concluída tratadas à parte).

9. **Ritmo (saúde) compacto.** Resumo leve: peso atual + delta no período, nº de
   treinos no período, adesão à dieta. (Campos exatos a confirmar nos modelos
   `RitmoBio/RitmoPlanoTreino/RitmoDietaConfig` na implementação.) Cumpre a
   promessa de "consolida tudo".

10. **Consolidar tarefas.** Um único widget de tarefas (barra por prioridade +
    % concluído). Remove a redundância Radar + Donut + KPIs.

11. **Demover cofre de senhas.** Vira um stat pequeno no rodapé, não um grupo de KPI.

---

## P2 — Assinatura

12. **Faixa "Atenção agora"** (topo). Lista `insights` **determinística** (sem
    LLM — rápido, grátis, sincronizado). Regras iniciais:
    - ritmo de gasto > X% do seguro (do `forecast`);
    - categoria com gasto > `meta_limite` (estouro);
    - contas a vencer em ≤7 dias (transações `Pendente` futuras);
    - aporte agendado pendente a confirmar;
    - cofrinho que atinge a meta no mês (via `data_projetada`).
    Cada insight tem `severidade` (info/aviso/perigo) e `acao` (link/rota).
    LLM (AI brain) como narrador é evolução futura, não bloqueia P2.

13. **Herói "Reservatório"** (SVG, linguagem da jarra). Um tanque grande = Caixa,
    com o líquido dividido em **Disponível** (onda animada como a jarra) e
    **Guardado**; entradas de renda escorrem por cima (top categorias de receita),
    saídas drenam por baixo (top categorias de despesa), e **mini-jarras dos
    cofrinhos** ao lado, ligadas por um "cano" ao Guardado. Números: Caixa,
    Disponível, Guardado (idênticos a Finanças/Metas). Reusa a animação de onda e
    o `cor`/`icone` das metas.
    - **v1 (P2a):** tanque com bandas Disponível/Guardado + resumo de entradas/
      saídas + fileira de mini-jarras. Estático elegante, temado, com hover.
    - **v2 (futuro):** fluxos animados (estilo Sankey "molhado").

---

## Nova arquitetura de informação (frontend)

```
Panorama            [filtro de data]              [👁 privacidade]
⚡ Atenção agora  (0–3 cartões de insight)
🌊 Reservatório (herói)   —  Caixa · Disponível · Guardado
Ritmo do mês (forecast/cockpit)   |   Poupança + mini-jarras dos cofrinhos
Orçamento por categoria (burndown, só em 1 mês) · KPIs com delta
Compacto: Agenda · Tarefas (1 widget) · Saúde · Provisões/Roteiro/Registros · Senhas(stat)
```

Componentes novos: `AttentionStrip`, `Reservoir`, `GoalJarsRow`, `BudgetList`,
`TasksWidget`, hook `useThemeColors`. Mantém `DateRangeFilter`, privacidade e os
modais de drill-down.

---

## Cenários & casos de borda (obrigatórios)

1. **Conta vazia** (sem transações/ajustes/metas): tudo zero → estados vazios com CTA; tanque vazio.
2. **Range sem dados** (ex.: "Ano passado" p/ user novo): gráficos vazios, deltas "—".
3. **1 mês vs multi-mês:** orçamento só em 1 mês; tendência sempre 12m rotulada.
4. **Range no passado:** forecast oculto, mostra resultado real.
5. **Range no futuro:** KPIs majoritariamente pendentes; forecast = compromissos conhecidos.
6. **Caixa negativo:** tanque em estado de déficit (vermelho), Disponível negativo.
7. **Guardado > Caixa** (Disponível < 0): banda de Guardado excede o tanque → aviso visual + insight (coerente com a invariante disponível+guardado=caixa).
8. **Privacidade:** blur em TODOS os valores monetários (inclui números do Reservatório e mini-jarras).
9. **Tema claro/escuro:** todas as cores via CSS vars (`useThemeColors`).
10. **Muitas categorias:** donut/reservatório limitam a top N + "Outros".
11. **Cofrinho concluído/arquivado:** Reservatório mostra só ativos; concluído com selo distinto.
12. **Aportes agendados pendentes:** não entram no Guardado até efetivar; viram insight "confirmar aporte".
13. **Performance:** payload cresce (cofrinhos/ritmo/deltas/insights) — usar
    queries agregadas (sem N+1); deltas = 1 par de queries extra; reusar passes.
14. **Timezone:** manter o padrão atual do módulo (`datetime.now()` naive nas janelas financeiras) — consistente com Finanças.

---

## Impacto & sincronização (o que mais muda em volta)

- **Nada quebra em Finanças/Metas:** as assinaturas de `calcular_caixa`,
  `calcular_resumo`, `total_guardado`, `enriquecer_meta`, `listar_metas` **não
  mudam**; Panorama só as consome. Números batem entre as 3 telas por construção.
- **`schemas/panorama.py`** ganha campos novos (aditivos) → compatível.
- **Transferência neutra preservada:** cofrinhos não entram em receita/despesa;
  o Reservatório mostra "Guardado" como camada do Caixa, não como gasto.
- **AI brain:** não é dependência de P2 (insights são regras); fica como evolução.
- **Frontend:** reescrita de `pages/Panorama/index.jsx` + novos componentes; o
  `DateRangeFilter` e `utils/dateRange.js` (já criados) são reaproveitados.

---

## Testes (pytest + build/lint)

- Backend: forecast só quando hoje∈range; `caixa_real` com baseline correto e
  batendo com `calcular_caixa` no ponto final; deltas do período anterior;
  média semanal; `receitas_por_categoria`; regras de `insights` (estouro de
  orçamento, conta a vencer, aporte pendente, meta no mês); range vazio.
- Garantir que os 51 testes atuais seguem passando (sem mudança de assinatura).
- Frontend: `npm run build` limpo + sem erros novos de lint nos arquivos tocados.

## Faseamento de entrega

- **Fase P0** (correção) — isolada, segura, deployável sozinha.
- **Fase P1** (valor) — aditiva.
- **Fase P2a** (Atenção + Reservatório v1) — o salto de identidade.
- **P2b** (fluxos animados) e **LLM narrador** — evoluções pós-entrega.

## Fora de escopo (agora)

- Narração via LLM na faixa de atenção (fica como evolução).
- Sankey animado com físicas de fluido (v2).
- Modelo completo de Contas.
