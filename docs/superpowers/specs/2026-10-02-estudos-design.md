# Estudos — Design

**Data:** 2026-10-02
**Status:** aprovado em conversa, aguardando revisão da spec

## 1. Objetivo

Um módulo **Estudos** no Bussola: uma **biblioteca de materiais de estudo avulsos**, organizados por
tema e tags, **criados pelo Claude via MCP** e exibidos no site com visual próprio — não Markdown,
não HTML livre, e sim **blocos tipados** renderizados por componentes no padrão de design do projeto.

O "método" (como pesquisar, como escrever, receitas de cada tipo de material) vive num **kit
baixável** (skill + agentes para o Claude Code; skill + instruções de Projeto para o claude.ai),
no espírito do faculdAIde. O site exibe, deixa responder quizzes e oferece um menu **"Pedir ao
Claude"** que copia comandos prontos para o kit.

**Independente do faculdAIde** (decisão do usuário).

**Critério de sucesso:** com o kit instalado, `/estudos aula <assunto>` no Claude Code produz um
material pesquisado, com fontes citadas, gravado via MCP e legível em `/estudos/<id>` com todos os
blocos renderizados; quizzes respondidos ficam registrados; ações do menu "Pedir ao Claude" geram
comandos que o kit entende.

### Fora de escopo (v1)
- Trilhas/cursos sequenciais (o uso escolhido é biblioteca avulsa).
- Repetição espaçada (FSRS), grau de confiança, tela de "revisar erros", lembretes — **nada de
  pressão para estudar** (decisão do usuário).
- Busca de texto completo, índice lateral, tempo de leitura (**fase 2**).
- Grifos/anotações do usuário, histórico de versões, exportar PDF (**fase 2**).
- Edição de material pelo site (quem escreve é o Claude).
- Prompts/recursos do MCP para o método (o kit é mais forte; ver §2).
- Playground de código executável.

## 2. Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde | Página própria **Estudos** (sidebar), Registros intacto | Estrutura (tema → materiais → blocos, quiz, estudado) não cabe num "card especial" de Registros |
| Formato | **Blocos tipados (JSON)**, vários por material e repetíveis | Visual consistente (o design mora nos componentes), padrão validado no servidor, quiz interativo com registro, sem XSS (LLM nunca injeta HTML) |
| Método | **Kit baixável** (skill + agentes) | Skill multi-etapa + subagentes de pesquisa/revisão são muito mais fortes que prompts de MCP; skills também sobem no claude.ai (valem no app) |
| Contrato de formato | Ferramenta MCP `catalogo_de_blocos` | Fonte única do schema: o kit consulta em vez de duplicar; bloco novo é descoberto sem reinstalar o kit |
| Progresso | **Leve**: marcar estudado (opcional) + resultado de quiz | Sem cobrança; o histórico só serve quando o usuário pede ("exercícios do que errei") |
| Confiabilidade | **Citações inline `[n]`** ligadas às fontes do material | Cada afirmação rastreável (estilo NotebookLM); a skill é obrigada a citar |

## 3. Modelo de dados

Padrão do projeto: models em `app/models/estudos.py`, service singleton `estudos_service`, todo
query filtrado por `user_id`. Migration Alembic escrita à mão (ver gotcha do `create_all()` no CLAUDE.md).

| Model | Campos |
|---|---|
| `EstudoTema` | `id`, `user_id`, `nome` (único por usuário), `cor`, `icone`, `descricao`, `criado_em` |
| `EstudoMaterial` | `id`, `user_id`, `tema_id` (nulo = sem tema), `tipo` (`aula`/`resumo`/`comparativo`/`exercicios`), `titulo`, `subtitulo`, `nivel` (`iniciante`/`intermediario`/`avancado`), `tags` (JSON lista), `blocos` (JSON lista), `fontes` (JSON lista `{titulo, url}`), `estudado_em` (nulo = não estudado), `criado_em`, `atualizado_em` |
| `EstudoResposta` | `id`, `user_id`, `material_id`, `bloco_id`, `resposta` (índice da opção ou texto), `acertou` (bool), `respondido_em` |

Excluir material apaga suas respostas.

## 4. Catálogo de blocos

Cada bloco: `{ "id": "b7", "tipo": "<tipo>", ...campos }`. Validação por **união discriminada
Pydantic** em `app/schemas/estudos_blocos.py`. `id` opcional na entrada — o servidor gera `b<n>`
para quem não tem e **preserva ids existentes** (o menu "Pedir ao Claude" e o histórico de respostas
dependem deles); ids únicos dentro do material.

| `tipo` | Campos (obrigatórios em negrito) | Render |
|---|---|---|
| `secao` | **titulo** | divisor de seção com âncora |
| `texto` | **conteudo** | prosa; inline: `**negrito**`, `*itálico*`, `` `código` ``, `[n]` |
| `conceito` | **titulo**, **texto** | cartão de destaque na cor do tema |
| `definicao` | **termo**, **definicao** | termo grande + definição formal |
| `analogia` | **texto** | bloco com ícone de lâmpada |
| `passos` | **passos** `[{titulo, texto}]` (≥2) | fluxo vertical numerado |
| `codigo` | **linguagem**, **codigo**, legenda | realce (highlight.js) + copiar |
| `comparacao` | **colunas** `[str]` (≥2), **linhas** `[{rotulo, valores[str], destaque?: int}]` (len(valores)=len(colunas)) | tabela estilizada; `destaque` = coluna vencedora na linha |
| `decisao` | **regras** `[{se, entao}]` (≥1) | guia "quando usar o quê" |
| `lista` | **itens** `[str]` (≥1), estilo `pontos`/`checklist` | lista estilizada |
| `alerta` | **nivel** `dica`/`atencao`/`erro`, **texto**, titulo | callout colorido |
| `formula` | **latex**, legenda | KaTeX (`trust: false`) |
| `diagrama` | **mermaid**, legenda | Mermaid (`securityLevel: 'strict'`), carregado sob demanda |
| `quiz` | **pergunta**, **opcoes** `[str]` (2–6), **correta** (índice válido), **explicacao** | interativo; registra resposta |
| `questao_aberta` | **pergunta**, **resposta_modelo** | "revelar" + "acertei/errei" registrado |

Campos de texto aceitam a formatação inline acima (interpretada pelo site; nunca HTML) — vale para
`texto.conteudo`, `conceito.texto`, `definicao.definicao`, `analogia.texto`, `passos[].texto`,
`alerta.texto`, `quiz.explicacao`, `questao_aberta.resposta_modelo`, `lista.itens[]`,
`decisao.regras[].entao`.

**Regras de composição (servidor):**
- Material com ≥1 bloco e ≤200 blocos; textos com limite de tamanho por campo.
- `comparativo` exige ≥1 `comparacao`; `exercicios` exige ≥1 `quiz` ou `questao_aberta`.
- Toda citação `[n]` exige `1 ≤ n ≤ len(fontes)`.
- Erro de validação aponta o local: `bloco 4 (quiz): 'correta' = 5, mas há 4 opções`.

**Receitas (kit, não servidor):** Aula = conceito → analogia → definição → passos → código/exemplo →
alertas (armadilhas) → 2–3 quizzes; Resumo = seções curtas com listas/tabelas/código, denso;
Comparativo = comparação + decisão (+ texto de contexto); Exercícios = sequência de quiz/questão
aberta graduada. A composição é livre (blocos repetíveis, qualquer ordem); só os mínimos acima são
checados.

`catalogo_de_blocos()` devolve, para cada tipo: campos, obrigatórios, limites, um exemplo válido,
os mínimos por tipo de material e `versao_formato` (inteiro, começa em 1; incrementa em mudança
incompatível ou bloco novo).

## 5. MCP (novas tools em `app/mcp/tools/estudos.py`)

Convenções existentes: upsert `salvar_X`, nome-ou-id para tema/material, `excluir_*` com
`destructive_hint`, leitura `bussola:read`, resto `bussola:write`, retorno `dict`.

| Tool | Comportamento |
|---|---|
| `catalogo_de_blocos()` | ver §4 |
| `listar_temas_estudo()` | temas com contagem de materiais |
| `listar_materiais(tema, tipo, tag, estudado, busca, limite)` | lista enxuta (id, titulo, tipo, tema, tags, nivel, estudado, atualizado_em); `busca` em título e tags |
| `ler_material(id)` | completo: blocos (com ids), fontes, estudado |
| `listar_respostas_quiz(material, so_erros, limite)` | histórico: material, bloco, resposta, acertou, data |
| `salvar_tema(id, nome, cor, icone, descricao)` | upsert |
| `salvar_material(id, tema, tipo, titulo, subtitulo, nivel, tags, blocos, fontes)` | cria completo; edição parcial; `blocos` enviado **substitui** a lista |
| `editar_blocos(material, operacoes)` | operações em ordem: `{op: "inserir", depois_de?: id, blocos: [...]}`, `{op: "substituir", id, bloco}`, `{op: "remover", id}`; valida o material resultante inteiro |
| `marcar_estudado(material, estudado)` | idempotente |
| `excluir_material(id)` | remove material e respostas |
| `excluir_tema(tema)` | só se vazio; senão erro com a contagem |

## 6. API REST (site)

Prefixo `/api/v1/estudos`, JWT normal:
- `GET /temas`, `GET /materiais?tema&tipo&estudado`, `GET /materiais/{id}`
- `POST /materiais/{id}/respostas` `{bloco_id, resposta}` → servidor calcula `acertou` (quiz:
  compara com `correta`; questão aberta: o próprio usuário informa `acertou`)
- `PATCH /materiais/{id}/estudado` `{estudado: bool}`
- `DELETE /materiais/{id}`
- `GET /kit/{alvo}.zip` (`alvo` ∈ `claude-code`, `claude-ai`) — monta o zip em memória a partir de
  `kit/compartilhado/` + `kit/<alvo>/`; `GET /kit/versao` → conteúdo de `kit/VERSION`

O site não cria nem edita material.

## 7. Frontend

Rotas: `/estudos` (biblioteca), `/estudos/:id` (leitura), `/estudos/kit` (downloads). Item
**Estudos** na sidebar (`fa-graduation-cap`). Wrappers em `src/services/api.ts`.

**Biblioteca:** `.page-header` padrão com KPIs (materiais, estudados, temas) e botão "Kit do
Claude"; coluna de temas (cor + contagem) + filtros por tipo e "só não estudados"; grade de cartões
(etiqueta de tipo colorida — Aula azul, Resumo verde, Comparativo roxo, Exercícios laranja —, título,
subtítulo, tags, nível, ✓ estudado). Estado vazio explica e aponta para o Kit.

**Leitura:** breadcrumb tema › título; etiquetas; ações: marcar estudado, **Pedir ao Claude ▾**,
excluir; seletor de destino dos comandos (`Claude Code` | `claude.ai`, salvo em `localStorage`).
Coluna de leitura (~760px). Fontes numeradas ao fim; `[n]` rola até a fonte.

**Menu "Pedir ao Claude"** (no material e, via botão ✨ no hover, em cada bloco): Aprofundar,
Simplificar, Criar exercícios, Criar comparativo relacionado, Verificar/atualizar fontes, Tirar
dúvida (abre campo de pergunta). Copia o comando para a área de transferência + toast.
- Claude Code: `/estudos <acao> material:<id> [bloco:<bid>] ["pergunta"]`
- claude.ai: frase em linguagem natural com as mesmas referências (ex.: "Use a skill estudos para
  aprofundar o bloco b7 do material 12 no Bússola.")

**Componentes:** `pages/Estudos/blocos/<Tipo>.jsx` + `BlocoRenderer` (tipo desconhecido → aviso
discreto, não quebra); `TextoInline` interpreta a formatação inline e `[n]` gerando elementos React
(nunca `dangerouslySetInnerHTML`). highlight.js (já no projeto); `katex` e `mermaid` como
dependências novas com import dinâmico. Só tokens do tema (claro/escuro).

**Quiz:** clicar numa opção revela certo/errado + explicação e registra (`POST /respostas`);
"refazer" limpa localmente. **Questão aberta:** "revelar resposta" → "acertei"/"errei" registra.

**Kit:** dois cartões (Claude Code / claude.ai) com botão de download, passo a passo de instalação
e (claude.ai) botão de copiar as instruções do Projeto; versão do kit exibida.

## 8. Kit

```
kit/
  VERSION
  compartilhado/references/
    metodo-de-pesquisa.md   # escada de autoridade, buscas por conceito, SIFT, 1 fonte por afirmação,
                            # números/definições conferidos em 2 fontes, senão "não verificado"
    pedagogia.md            # concreto → abstrato, exemplo resolvido, armadilhas, Feynman, atomicidade
    receitas.md             # por tipo: blocos esperados, ordem, tamanho, nº de questões
    blocos.md               # quando usar cada bloco (schema vem de catalogo_de_blocos)
    acoes.md                # contrato com o site: sintaxe material:ID/bloco:ID e cada ação do menu
  claude-code/
    skills/estudos/SKILL.md
    agents/estudos-pesquisador.md
    agents/estudos-escritor.md
    agents/estudos-revisor.md
    README.md
  claude-ai/
    estudos/SKILL.md        # mesma skill sem subagentes
    instrucoes-do-projeto.md
    README.md
```
No zip, `compartilhado/references/` é copiado para dentro da pasta da skill de cada alvo
(`skills/estudos/references/` e `estudos/references/`).

**Comandos:** `aula <assunto>`, `resumo <assunto>`, `comparativo <X> vs <Y>`,
`exercicios <assunto | material:ID> [só erros]`, `aprofundar material:ID [bloco:ID]`,
`simplificar material:ID [bloco:ID]`, `fontes material:ID`, `duvida material:ID [bloco:ID] "pergunta"`
(a resposta vira bloco no material).

**Fluxo (Claude Code):** (1) entender pedido (assunto, tipo, nível, tema) → (2) `catalogo_de_blocos`
+ `listar_materiais` (já existe? sugerir aprofundar em vez de duplicar) → (3) **pesquisador** por
subtópico, em paralelo, devolvendo dossiê de afirmações com fonte → (4) **escritor** monta os blocos
pela receita, citando `[n]` → (5) **revisor** independente: afirmação × fonte, pedagogia, formato;
até 2 rodadas → (6) `salvar_material`/`editar_blocos` → responde com
`https://bussola.marocos.dev/estudos/<id>`.

**claude.ai:** mesma skill (upload em Configurações → Skills) + Projeto "Estudos" com as instruções
e o conector do Bussola; fluxo sequencial (pesquisa → escrita → checklist de autorrevisão).

**Compatibilidade:** a skill conhece a `versao_formato` para a qual foi escrita; se
`catalogo_de_blocos` informar uma versão maior, avisa "baixe o kit atualizado em /estudos/kit" (o
servidor rejeita material inválido de qualquer forma).

## 9. Segurança

- Nenhum campo vira HTML; formatação inline interpretada pelo site.
- Mermaid `securityLevel: 'strict'`; KaTeX `trust: false`.
- Isolamento por `user_id` em todo query (service e MCP).
- Download do kit autenticado; zip montado só a partir de `kit/` (sem caminho vindo do usuário além
  do `alvo` validado contra a lista fixa).

## 10. Testes

- Service/schemas: validação de cada tipo de bloco (válido/inválido), mínimos por tipo, citações
  fora do intervalo, geração e preservação de ids, `editar_blocos` (inserir/substituir/remover e
  revalidação), isolamento entre usuários.
- MCP: cada tool via `mcp_call` (caminho feliz, nome-ou-id, escopo de leitura bloqueando escrita).
- API: respostas de quiz (acertou calculado no servidor), estudado idempotente, download do kit
  (zip contém os arquivos esperados; `alvo` inválido → 404).
- Frontend: `npm run build` passa; sem erros novos de lint nos arquivos tocados.

## 11. Fases futuras
- **Fase 2:** busca de texto completo, índice lateral pelas seções, tempo de leitura; grifos e
  anotações; histórico de versões; exportar PDF.
