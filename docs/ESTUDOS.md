# Estudos — biblioteca de materiais criados pelo Claude

Spec: `docs/superpowers/specs/2026-10-02-estudos-design.md` · Plano: `docs/superpowers/plans/2026-10-02-estudos.md`

## O que é

Biblioteca de materiais de estudo avulsos (aula, resumo, comparativo, exercícios), organizados por
tema e tags. Quem **cria e edita** é o Claude, pelo MCP; o site **exibe**, deixa responder quizzes,
marcar como estudado e copiar comandos ("Pedir ao Claude"). O método (pesquisa, pedagogia,
receitas) mora no **kit** baixável em `/estudos/kit`.

## Formato: blocos tipados

- Contrato único: `bussola_api/app/schemas/estudos_blocos.py` (15 tipos, união discriminada
  Pydantic, limites, mínimos por tipo de material, citações, ids, catálogo). O Claude lê o contrato
  pela tool `catalogo_de_blocos` (`versao_formato` = 1; incremente em mudança incompatível ou bloco
  novo e atualize o kit).
- Ids `b<n>` gerados no servidor, preservados nas edições; `EstudoMaterial.seq_bloco` garante que
  id removido nunca volta (respostas antigas e comandos copiados não apontam para o bloco errado).
- Citações `[n]` exigem `1 ≤ n ≤ len(fontes)`; fontes só `http(s)://`.
- **Gramática inline** (negrito, itálico, código, `[n]`, escapes, parágrafos) implementada em dois
  lugares que precisam andar juntos: `estudos_blocos.py::citacoes` (backend) e
  `bussola_web/src/pages/Estudos/blocos/inline.js` (site). Regras no plano, seção "Gramática inline";
  checagem rápida do lado do site: `node scripts/verificar-estudos.mjs` (em `bussola_web/`).

## Backend

| Camada | Arquivo |
|---|---|
| Models | `app/models/estudos.py` (`EstudoTema`, `EstudoMaterial`, `EstudoResposta`) |
| Migration | `alembic/versions/e4b8c1d2a9f7_add_estudos_tables.py` (à mão) |
| Service | `app/services/estudos.py` (`estudos_service`) · kit: `app/services/estudos_kit.py` |
| REST | `app/api/v1/endpoints/estudos.py` (prefixo `/api/v1/estudos`) |
| MCP | `app/mcp/tools/estudos.py` |

REST (site): `GET /temas`, `GET /materiais?tema_id&tipo&estudado&tag&busca`, `GET /materiais/{id}`,
`POST /materiais/{id}/respostas` (`acertou` calculado no servidor para quiz; informado pelo usuário
na questão aberta), `PATCH /materiais/{id}/estudado`, `DELETE /materiais/{id}`,
`GET /kit/versao`, `GET /kit/instrucoes-projeto`, `GET /kit/{claude-code|claude-ai}.zip`.

MCP: `catalogo_de_blocos`, `listar_temas_estudo`, `listar_materiais`, `ler_material`,
`listar_respostas_quiz` (leitura); `salvar_tema`, `salvar_material`, `editar_blocos`,
`marcar_estudado` (escrita); `excluir_material`, `excluir_tema` (destrutivas). Toda escrita revalida
o material resultante inteiro: se falhar, nada muda, e o erro aponta `bloco N (tipo): ...`.

## Kit

`bussola_api/kit/` (dentro do contexto de build do backend — por isso não fica na raiz):
`VERSION`, `compartilhado/references/*.md` (método, pedagogia, receitas, blocos, ações),
`claude-code/` (skill + agentes `estudos-pesquisador|escritor|revisor`), `claude-ai/` (skill sem
subagentes + instruções do Projeto). O zip é montado em memória; as referências vão para dentro da
pasta da skill; o zip do claude.ai traz também `estudos.zip` pronto para upload. Ao mudar o kit,
suba `VERSION`.

Contrato com o site (`acoes.md` ⇄ `src/pages/Estudos/comandos.js`):
`/estudos <aprofundar|simplificar|exercicios|comparativo|fontes|duvida> material:<id> [bloco:<bid>] ["pergunta"]`
ou, no claude.ai, `Use a skill estudos para <ação> o bloco b7 do material 12 no Bússola.`

## Frontend

`src/pages/Estudos/`: `index.jsx` (biblioteca), `Leitura.jsx` (`/estudos/:id`), `Kit.jsx`
(`/estudos/kit`), `PedirAoClaude.jsx`, `comandos.js`, `blocos/` (um componente por tipo +
`BlocoRenderer`, `TextoInline`). KaTeX (`trust: false`) e Mermaid (`securityLevel: 'strict'`) são
carregados sob demanda e só quando o bloco chega perto da tela; são os únicos pontos com
`dangerouslySetInnerHTML` (saída sanitizada pelas libs). Nenhum texto do material vira HTML.

## Dev

- Material de teste: `python scripts/seed_estudos.py --email <usuario> [--grande]` (em `bussola_api/`).
- Testes: `tests/test_estudos_blocos.py`, `test_estudos_service.py`, `test_estudos_api.py`,
  `test_estudos_kit.py`, `test_mcp_estudos.py`.
- Produção: tabelas novas nascem pelo `create_all` do boot; depois do deploy, `alembic stamp head`.
