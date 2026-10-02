# Receitas por tipo de material

A composição é livre (blocos repetíveis, em qualquer ordem). O servidor só checa os mínimos
(`comparativo` ≥ 1 `comparacao`; `exercicios` ≥ 1 `quiz` ou `questao_aberta`) e os limites do
catálogo. As receitas abaixo são o padrão de qualidade.

## Aula (`tipo: "aula"`) — do zero até usar

Ordem típica (um assunto grande repete o ciclo por `secao`):

1. `texto` curto de motivação: que problema isso resolve (1 parágrafo).
2. `conceito` — a ideia central em 2–4 frases.
3. `analogia` — ponte com algo cotidiano.
4. `definicao` — a versão formal, citada.
5. `passos` — como funciona / como fazer (3–7 passos).
6. `codigo` ou exemplo resolvido (`texto`, `formula`, `diagrama`).
7. `alerta` — 1–3 armadilhas.
8. `quiz` × 2–3 (+ opcional 1 `questao_aberta`).

Tamanho: 12–35 blocos. Use `secao` para separar partes quando passar de ~12 blocos.

## Resumo (`tipo: "resumo"`) — revisão densa

- `secao` curtas, cada uma com `lista`, `comparacao`, `codigo` ou `definicao`.
- Pouca prosa; nada de analogias longas.
- Opcional: `decisao` no fim ("quando usar o quê") e 1 `quiz`.

Tamanho: 8–25 blocos.

## Comparativo (`tipo: "comparativo"`) — X vs Y (vs Z)

1. `texto` de contexto: o que as opções têm em comum e por que a escolha importa (com citações).
2. `comparacao` — linhas = critérios concretos (desempenho, curva de aprendizado, custo,
   ecossistema…); `destaque` = coluna vencedora no critério, quando houver uma.
3. `decisao` — regras "se … então …" cobrindo os casos reais.
4. Opcional: um `codigo` por opção, `alerta` de armadilhas na migração, 1–2 `quiz` de cenário.

Tamanho: 5–15 blocos. Células da tabela não aceitam `[n]`: cite os fatos da tabela no `texto` de
contexto ou em `definicao`/`alerta` ao redor.

Comparativo relacionado (`comparativo material:ID`): leia o material, identifique a alternativa
mais relevante ao assunto dele (pergunte ao usuário se houver duas óbvias) e crie um material novo.

## Exercícios (`tipo: "exercicios"`) — prática graduada

- 6–12 questões, do fácil ao difícil: 2–3 de reconhecimento, 3–5 de aplicação, 1–3 de análise/caso.
- Misture `quiz` e `questao_aberta` (≥ 1 aberta para assuntos conceituais).
- Opcional: `secao` por nível ("Aquecimento", "Aplicação", "Desafio") e um `texto` inicial de uma
  frase com o pré-requisito.
- `exercicios material:ID`: baseie-se no conteúdo do material.
- `exercicios material:ID só erros`: use `listar_respostas_quiz(material=ID, so_erros=true)` e
  crie perguntas **novas** sobre exatamente os pontos errados (não repita a pergunta errada).

## Ações sobre material existente (detalhes em acoes.md)

- **Aprofundar**: insira blocos logo depois do bloco/seção alvo (novo `conceito`, `passos`,
  `codigo`, `alerta` + 1 `quiz`).
- **Simplificar**: substitua o bloco alvo por versão mais simples (+ `analogia` se ajudar); o id é mantido.
- **Dúvida**: insira um `texto` (ou `alerta` nível `dica`) logo após o bloco alvo começando com
  `**Dúvida:** <pergunta>` e a resposta citada.
