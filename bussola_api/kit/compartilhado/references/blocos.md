# Blocos — quando usar cada um

O schema exato (campos, obrigatórios, limites, exemplo) vem de `catalogo_de_blocos()` — consulte
sempre antes de escrever. Este arquivo diz **quando** usar cada bloco.

| Bloco | Use para | Evite |
|---|---|---|
| `secao` | dividir o material em partes com título (vira âncora) | seção com um bloco só |
| `texto` | prosa curta: motivação, ligação entre blocos, explicação | parágrafos com mais de ~4 frases |
| `conceito` | a ideia central de um assunto, em destaque | definição formal (use `definicao`) |
| `definicao` | termo + definição formal, citada | explicação informal |
| `analogia` | ponte com algo cotidiano antes do formal | analogia que precisa ser explicada |
| `passos` | processo ordenado (2 a 20 passos) | itens sem ordem (use `lista`) |
| `codigo` | exemplo executável, comando, configuração | pseudo-código longo sem legenda |
| `comparacao` | critérios × opções; `destaque` = vencedora na linha | tabela de uma coluna |
| `decisao` | regras "se … então …" | — |
| `lista` | itens sem ordem; `checklist` para verificações | — |
| `alerta` | `dica`, `atencao` (armadilha), `erro` (erro comum grave) | aviso genérico |
| `formula` | matemática/complexidade em LaTeX | fórmula trivial que cabe no texto |
| `diagrama` | fluxos, sequências, estados, hierarquias (Mermaid) | diagrama decorativo |
| `quiz` | checar compreensão com 2–6 opções | decoreba |
| `questao_aberta` | explicar/aplicar com as próprias palavras | pergunta de sim/não |

## Formatação inline

Vale **somente** em: `texto.conteudo`, `conceito.texto`, `definicao.definicao`, `analogia.texto`,
`passos[].texto`, `alerta.texto`, `quiz.explicacao`, `questao_aberta.resposta_modelo`,
`lista.itens[]`, `decisao.regras[].entao`. Nos demais campos (títulos, perguntas, opções, células)
o texto aparece literal.

- `**negrito**` e `*itálico*`: a marca de abertura não pode ser seguida de espaço, nem a de
  fechamento precedida de espaço (`2 * 3 * 4` fica literal). Itálico pode ficar dentro de negrito;
  negrito dentro de itálico não.
- `` `código` ``: conteúdo literal (nada é interpretado lá dentro).
- `[n]`: citação da fonte n (1 a 3 dígitos, começa em 1). Para colchetes literais com número,
  escape: `\[1]`.
- Escapes: `\*`, `` \` ``, `\[`, `\]`, `\\`.
- Linha em branco separa parágrafos; quebra simples vira quebra de linha. Nenhuma marca atravessa parágrafos.
- **Nunca HTML** (aparece como texto) e nunca Markdown de títulos, listas ou links — use os blocos.
- Lembre que é JSON: barra invertida vira `\\` e aspas viram `\"`.

## Ids

- Cada bloco tem `id` (ex.: `b7`). Ao criar, não mande ids: o servidor gera.
- Ao reenviar `blocos` em `salvar_material`, **mantenha o id dos blocos que continuam** — o
  histórico de respostas e os comandos do site dependem deles.
- Ids de blocos removidos nunca são reaproveitados.
- Prefira `editar_blocos` para mudanças pontuais.

## Diagramas e fórmulas

- Mermaid: `graph TD`/`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`,
  `erDiagram`. Sem `click`, sem HTML em rótulos; rótulos com acento ou parênteses entre aspas:
  `A["Seção crítica (lock)"]`. Revise a sintaxe: diagrama inválido aparece como aviso no site.
- LaTeX: só matemática (KaTeX), sem `\href`, `\url`, `\includegraphics` nem macros próprias.
