# Ações — contrato com o site

O site do Bússola tem o botão **Pedir ao Claude** no material e um botão ✨ em cada bloco. Eles
copiam um comando para o usuário colar no Claude. A skill precisa entendê-los exatamente.

## Sintaxe (Claude Code)

```
/estudos <acao> material:<id> [bloco:<bid>] ["pergunta"]
```

- `material:<id>` — id numérico do material (ex.: `material:12`).
- `bloco:<bid>` — id do bloco (ex.: `bloco:b7`). Ausente = o material inteiro.
- `"pergunta"` — só em `duvida`, entre aspas duplas.

Exemplos que o site gera:

- `/estudos aprofundar material:12 bloco:b7`
- `/estudos simplificar material:12`
- `/estudos exercicios material:12`
- `/estudos comparativo material:12`
- `/estudos fontes material:12 bloco:b3`
- `/estudos duvida material:12 bloco:b7 "por que a busca é logarítmica?"`

## Frases (claude.ai)

Mesmo pedido em linguagem natural — extraia ação, material, bloco e pergunta:

- "Use a skill estudos para aprofundar o bloco b7 do material 12 no Bússola."
- "Use a skill estudos para simplificar o material 12 no Bússola."
- "Use a skill estudos para criar exercícios sobre o material 12 no Bússola."
- "Use a skill estudos para criar um comparativo relacionado ao material 12 no Bússola."
- "Use a skill estudos para verificar e atualizar as fontes do bloco b3 do material 12 no Bússola."
- "Use a skill estudos para responder uma dúvida sobre o bloco b7 do material 12 e registrar a
  resposta como bloco no material no Bússola. Dúvida: "por que a busca é logarítmica?""

## Ações

| acao | Rótulo no site | O que fazer | Tools |
|---|---|---|---|
| `aprofundar` | Aprofundar | pesquisar além do que o alvo já diz; inserir blocos novos logo depois do bloco alvo (ou no fim da seção / do material) | `ler_material` → pesquisa → `editar_blocos` (`inserir` com `depois_de`) |
| `simplificar` | Simplificar | reescrever o alvo mais simples e curto, mantendo a verdade e as citações; pode acrescentar `analogia` | `ler_material` → `editar_blocos` (`substituir`, + `inserir`) |
| `exercicios` | Criar exercícios | material NOVO `exercicios` sobre o alvo; com "só erros", focar nas respostas erradas | `ler_material`, `listar_respostas_quiz`, `salvar_material` |
| `comparativo` | Criar comparativo relacionado | material NOVO `comparativo` entre o assunto do alvo e a alternativa mais relevante | `ler_material` → pesquisa → `salvar_material` |
| `fontes` | Verificar/atualizar fontes | reconferir cada afirmação citada do alvo contra a fonte; corrigir texto, trocar fonte morta ou fraca, acrescentar o que falta | `ler_material` → WebFetch → `editar_blocos` ou `salvar_material(id, blocos, fontes)` |
| `duvida` | Tirar dúvida | responder a pergunta com pesquisa e registrar a resposta como bloco logo após o alvo | `ler_material` → pesquisa → `editar_blocos` (`inserir`) |

Comandos de criação (não vêm do site, o usuário digita): `aula <assunto>`, `resumo <assunto>`,
`comparativo <X> vs <Y>`, `exercicios <assunto> [só erros]`.

## Regras

- Sempre `ler_material(id)` antes de agir; se o `bloco:` não existir mais, diga isso e ofereça agir
  sobre o material inteiro.
- Preserve os ids dos blocos existentes. `substituir` mantém o id automaticamente.
- Fontes novas entram no fim da lista. Se remover uma fonte, use `salvar_material(id, blocos=…, fontes=…)`
  renumerando as citações `[n]` de todos os blocos (mantendo os ids).
- Material novo criado a partir de outro (`exercicios`, `comparativo`): mesmo tema do original.
- Responda com a `url` do material e os ids dos blocos novos/alterados.
