# MCP Server do Bussola — Design

**Data:** 2026-10-01
**Status:** aprovado em conversa, aguardando revisão da spec

## 1. Objetivo

Expor o Bussola como um servidor **MCP remoto** em `https://bussola.marocos.dev/mcp`, para que o
usuário opere todos os módulos existentes a partir do **Claude Code** (PC ou qualquer máquina) e do
**claude.ai / app mobile** (conector personalizado), usando a própria assinatura do Claude.

Exemplos de uso: "registra 42,90 no mercado no débito", "o que tenho na agenda amanhã?",
"cria uma tarefa pra revisar o contrato com 3 subtarefas", "quanto falta pra meta da viagem?".

**Critério de sucesso:** conectar o Bussola no claude.ai (OAuth) e no Claude Code (PAT), e executar
leitura e escrita em todos os módulos do catálogo (§5), com isolamento por usuário.

### Fora de escopo (desta fase)
- O módulo **Estudos** (trilhas, material gerado, registro de sessões). Vem depois, como
  `app/mcp/tools/estudos.py`; este design só garante que plugar um módulo novo seja um arquivo.
- Revelar, criar ou editar segredos do Cofre.
- Auth/usuários/bot, clima e notícias, endpoints `/ai/*`, reordenar tarefas, exportar PDF.
- MCP resources e prompts (só tools).

## 2. Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde roda | Embutido no `bussola_backend`, montado em `/mcp` | Sem container novo; compose, service names, domínio e healthchecks intactos (nenhuma armadilha do checklist Coolify se aplica) |
| SDK | `mcp` oficial (FastMCP), transporte Streamable HTTP, `stateless_http=True`, `json_response=True` | O uvicorn roda com 2 workers — não pode haver estado de sessão em memória |
| Desenho das tools | Curadas, orientadas a tarefa (~48), chamando os **services** existentes | Auto-gerar dos ~85 endpoints dá tools cruas e caras em contexto |
| Auth | Bussola é o próprio Authorization Server OAuth 2.1 (router escrito à mão sob `/oauth/`) + PAT | claude.ai exige OAuth; o provider de AS do SDK monta `/register` e `/token` na raiz e colide com o SPA |
| Escopo | Leitura e escrita em tudo; Cofre só metadados | Valor descriptografado passaria pelo LLM e ficaria no histórico do chat |

## 3. Arquitetura

### 3.1 Estrutura

```
bussola_api/app/mcp/
  __init__.py
  server.py        # instância FastMCP + AuthSettings/TokenVerifier; importa e registra tools/*
  auth.py          # BussolaTokenVerifier: Bearer -> McpToken (hash) -> AccessToken(user_id, scopes)
  context.py       # usuario_e_db(): context manager que abre SessionLocal e carrega o User do token
  resolvers.py     # resolução por nome (categoria, meta, grupo, hábito...): casefold + sem acento
  tools/
    perfil.py  panorama.py  financas.py  metas.py  agenda.py
    registros.py  habitos.py  ritmo.py  cofre.py
```

- Cada `tools/<modulo>.py` expõe `register(mcp)` e só **traduz** argumentos para chamadas de service
  (`financas_service`, `metas_service`, ...). Regra de negócio continua em `app/services/`; a camada
  MCP não consulta models diretamente, exceto via `resolvers.py` para resolver nome → id.
- Se um service não tiver o método necessário (ex.: listagem filtrada que hoje só existe dentro do
  dashboard), o método é **adicionado ao service**, não escrito na tool.

### 3.2 Montagem

- `main.py`: registra duas rotas explícitas apontando para o app Starlette do SDK: `app.router.add_route("/mcp", mcp_asgi)` e `app.router.add_route("/.well-known/oauth-protected-resource/mcp", mcp_asgi)`, onde `mcp_asgi = mcp.streamable_http_app()`. O `session_manager.run()` do MCP é encadeado no lifespan do FastAPI. Não usa `app.mount` porque a raiz já redireciona a barra final da API, e montar em `/mcp` criaria `/mcp/mcp`.
- `server.py` configura `AuthSettings(issuer_url="https://bussola.marocos.dev",
  resource_server_url="https://bussola.marocos.dev/mcp", required_scopes=["bussola:read"])`; o SDK
  responde 401 com `WWW-Authenticate: Bearer resource_metadata=...`. A URL pública vem de
  `settings.PUBLIC_BASE_URL` (nova setting; default `http://localhost:8000` em dev).

### 3.3 Rede

`claude.ai / Claude Code → Traefik → nginx (frontend) → bussola_backend:8000`

`bussola_web/nginx.conf` ganha três `location` com `proxy_buffering off` e `proxy_read_timeout 300s`:
`/mcp`, `/.well-known/oauth-` (prefixo) e `/oauth/`. Nenhuma outra mudança de infraestrutura.

### 3.4 Fluxo de uma chamada

1. SDK extrai o Bearer → `BussolaTokenVerifier.verify_token()` → `sha256(token)` buscado em
   `McpToken`; rejeita se revogado, expirado, ou usuário inexistente/`is_active=False`; atualiza
   `last_used_at`.
2. A tool verifica o escopo exigido (`exigir_escopo("bussola:write")`).
3. `with usuario_e_db() as (db, user):` → chama o service com `user.id`.
4. Retorna dict/list enxuto (JSON estruturado).

### 3.5 Erros

- `HTTPException` 4xx do service e `ValidationError` do Pydantic → `ToolError` com mensagem em
  português e acionável (ex.: `Categoria 'mercadoo' não encontrada. Disponíveis: Mercado, Lazer, ...`).
- Exceção inesperada → `logger.exception(...)` + `ToolError("Erro interno ao executar <tool>.")`,
  sem stack trace para o cliente.
- Escopo insuficiente → `ToolError("Este token não tem permissão de escrita (bussola:write).")`.

## 4. Autenticação

### 4.1 Models (novos)

| Model | Campos |
|---|---|
| `McpClient` | `id`, `client_id` (único, aleatório), `client_name`, `redirect_uris` (JSON), `created_at` |
| `McpAuthCode` | `id`, `code_hash`, `client_id`, `user_id`, `redirect_uri`, `code_challenge`, `scopes`, `expires_at` (10 min), `used` |
| `McpToken` | `id`, `token_hash` (único), `user_id`, `client_id` (nulo p/ PAT), `kind` (`access`/`refresh`/`pat`), `name`, `scopes`, `expires_at`, `last_used_at`, `revoked`, `created_at` |

Migration Alembic escrita à mão (ver gotcha do `create_all()` no CLAUDE.md). Service novo
`app/services/mcp_auth.py` (`mcp_auth_service = McpAuthService()`), no padrão singleton do projeto.

### 4.2 Endpoints

| Rota | Comportamento |
|---|---|
| `GET /.well-known/oauth-protected-resource` (e `/.well-known/oauth-protected-resource/mcp`) | Servido pelo SDK: `resource` = `/mcp`, `authorization_servers` = base pública |
| `GET /.well-known/oauth-authorization-server` | Metadata RFC 8414: `authorization_endpoint=/oauth/authorize`, `token_endpoint=/oauth/token`, `registration_endpoint=/oauth/register`, `code_challenge_methods_supported=["S256"]`, `grant_types_supported=["authorization_code","refresh_token"]`, `token_endpoint_auth_methods_supported=["none"]`, `scopes_supported=["bussola:read","bussola:write"]` |
| `POST /oauth/register` | RFC 7591, só clientes públicos. Valida `redirect_uris` (https ou `http://localhost`/`127.0.0.1`). Rate limit slowapi 10/hora/IP |
| `GET /oauth/authorize` | Valida `client_id`, `redirect_uri` (match exato), `response_type=code`, `code_challenge` + `S256`, `scope`, `state`. Inválido antes de confiar no redirect → 400 em JSON; válido → 302 para `/conexoes/autorizar?<params>` do SPA |
| `POST /api/v1/oauth/consent` | JWT normal (`get_current_user`). Body: params do authorize + `aprovado` + `scopes` escolhidos. Aprovado → cria `McpAuthCode` e devolve `{redirect_url: "<redirect_uri>?code=...&state=..."}`; negado → `...?error=access_denied&state=...` |
| `POST /oauth/token` | `authorization_code`: valida código (hash, não usado, não expirado, mesmo client e redirect_uri) e PKCE `S256`; marca usado; emite access (1h) + refresh (30 dias). `refresh_token`: valida, revoga o antigo, emite par novo (rotação). Erros no formato OAuth (`invalid_grant`, ...) |
| `GET /api/v1/mcp-tokens` | Lista conexões do usuário (OAuth agrupado por client + PATs): nome, escopos, `last_used_at`, expiração |
| `POST /api/v1/mcp-tokens` | Cria PAT (`name`, `scopes`, `validade_dias`, padrão 90). Retorna o token **uma única vez** |
| `DELETE /api/v1/mcp-tokens/{id}` | Revoga PAT, ou todos os tokens de um client OAuth |

`/oauth/*` e `/.well-known/*` ficam fora do prefixo `/api/v1` (exigência de descoberta OAuth);
são registrados num router próprio em `main.py`.

### 4.3 Tokens

- 32 bytes de `secrets.token_urlsafe`, prefixo `bsl_` (PAT `bsl_pat_`), banco guarda só SHA-256.
- Comparação por hash lookup; códigos de autorização também só por hash.

### 4.4 Frontend

- **`/conexoes/autorizar`** (página nova): se deslogado, redireciona ao login existente (inclusive Google)
  e volta com os params preservados. Mostra "**{client_name}** quer acessar seu Bussola", escopos
  (ler / ler e escrever, escrita pré-marcada) e Autorizar / Negar. Ao responder, chama
  `POST /api/v1/oauth/consent` e faz `window.location = redirect_url`.
- **Configurações → Conexões MCP**: tabela de conexões com Revogar; botão "Novo token" (modal
  `BaseModal`) que mostra o PAT uma vez, com botão copiar e o comando
  `claude mcp add --transport http bussola https://bussola.marocos.dev/mcp --header "Authorization: Bearer <token>"`.
- Wrappers em `src/services/api.ts`.

## 5. Catálogo de tools

### 5.1 Convenções
- Nomes em português `verbo_objeto`; descrições em português explicando quando usar.
- **Upsert:** `salvar_X(id=None, ...)` — sem `id` cria; com `id` edita só os campos enviados
  (a tool carrega o registro, aplica os campos e chama o update do service). Status/fixar/ativar
  são campos do `salvar_X`.
- Referência por nome **ou** id (`categoria="Mercado"` ou `categoria_id=3`), via `resolvers.py`.
  Nome ambíguo/inexistente → erro listando as opções.
- Datas ISO `YYYY-MM-DD` (data-hora `YYYY-MM-DDTHH:MM`), dinheiro em reais (`float`).
- Listagens: filtros + `limite` (padrão 50, máx. 200), campos enxutos.
- Leitura: `readOnlyHint=True`, escopo `bussola:read`. Escrita: escopo `bussola:write`.
  `excluir_*`: `destructiveHint=True`.

### 5.2 Tools

| Módulo | Leitura | Escrita |
|---|---|---|
| Perfil | `meu_perfil` | — |
| Panorama | `panorama_geral(de, ate)`, `historico_categoria(categoria)` | — |
| Finanças | `resumo_financeiro(mes)`, `listar_transacoes(mes, categoria, tipo, status, busca, limite)`, `listar_categorias` | `salvar_transacao`, `marcar_pagamento`, `encerrar_recorrencia`, `excluir_transacao`, `salvar_categoria`, `excluir_categoria`, `salvar_ajuste_caixa`, `excluir_ajuste_caixa` |
| Metas | `listar_metas`, `detalhar_meta` | `salvar_meta`, `arquivar_meta`, `movimentar_meta`, `excluir_movimentacao` |
| Agenda | `listar_compromissos(de, ate)` | `salvar_compromisso`, `excluir_compromisso` |
| Registros | `listar_grupos`, `listar_anotacoes(grupo, busca)`, `ler_anotacao`, `listar_tarefas(status)` | `salvar_grupo`, `excluir_grupo`, `salvar_anotacao`, `excluir_anotacao`, `salvar_tarefa`, `marcar_subtarefa`, `excluir_tarefa` |
| Hábitos | `listar_habitos`, `historico_habito` | `salvar_habito`, `checkin_habito(habito, data)`, `excluir_habito` |
| Ritmo | `ultimo_bio`, `listar_treinos`, `listar_dietas`, `buscar_alimento(q)` | `registrar_bio`, `salvar_treino`, `excluir_treino`, `salvar_dieta`, `excluir_dieta` |
| Cofre | `listar_segredos` (nome, categoria, notas — nunca o valor) | — |

Detalhes por tool:
- `meu_perfil`: nome, email, cidade, data/hora atual e fuso — dá ao Claude o "hoje" para datas relativas.
- `salvar_transacao`: descrição, valor, tipo (receita/despesa), categoria, data, forma de pagamento,
  status, recorrência/parcelas — espelha o schema de criação de `financas`.
- `marcar_pagamento(id, pago)`: idempotente (define, não alterna); internamente só chama o toggle se
  o estado atual difere.
- `movimentar_meta(meta, tipo, valor, data, id=None)`: `tipo` = `deposito`/`retirada`; respeita a
  regra de meta travada do service.
- `salvar_anotacao`: aceita conteúdo em **Markdown** e converte para o HTML do editor de notas
  (lib `markdown`, dependência nova); `ler_anotacao` devolve o HTML como está salvo (o Claude lê HTML
  sem problema — sem conversão de volta).
- `checkin_habito(habito, data=hoje, feito=True)`: idempotente, como `marcar_pagamento`.
- `marcar_subtarefa(id, feita)`: idempotente.
- `listar_segredos`: serializa só campos de metadado; teste garante que o campo de valor nunca sai.

## 6. Segurança

- Isolamento: toda tool passa `user.id` aos services, que já filtram por `user_id`.
- `redirect_uri` com match exato contra o registrado; PKCE `S256` obrigatório; código de uso único
  e expira em 10 min; refresh com rotação.
- Usuário desativado → todos os tokens falham na verificação.
- Cofre: nenhuma tool importa/chama a descriptografia.
- Rate limit em `/oauth/register` e `/oauth/token`.
- `client_name` é exibido escapado na tela de consentimento (vem de registro público).

## 7. Testes

Padrão de `tests/conftest.py` (SQLite em memória, `user`, `client`):
- `test_mcp_auth.py`: registro de cliente; authorize inválido (redirect diferente, sem PKCE);
  consent → token; PKCE errado; código reutilizado; refresh com rotação; token revogado/expirado;
  usuário inativo; metadata endpoints.
- `test_mcp_tools.py`: chamada das tools via cliente MCP em processo (`mcp` `ClientSession` sobre o
  ASGI app) com token de teste: escopo `read` bloqueia escrita; isolamento entre dois usuários;
  caminho feliz por módulo; resolução por nome (ok/ambíguo/inexistente); `listar_segredos` sem valor.
- Frontend: `npm run build` passa, sem erros novos de lint nos arquivos tocados.

## 8. Rollout

1. Merge em `main` → auto-deploy no Coolify (tabelas novas criadas por `create_all()` no boot;
   rodar/stampar a migration conforme o gotcha).
2. Setar `PUBLIC_BASE_URL=https://bussola.marocos.dev` nas envs do backend no Coolify **antes** do deploy.
3. Verificar: `curl https://bussola.marocos.dev/.well-known/oauth-authorization-server` e
   `curl -i https://bussola.marocos.dev/mcp` (espera 401 com `WWW-Authenticate`).
4. claude.ai → Configurações → Conectores → Adicionar conector personalizado → URL `/mcp` → fluxo OAuth.
5. Claude Code → gerar PAT na tela → `claude mcp add ...`.

## 9. Ajustes do planejamento

A spec é atualizada na Task 0 com estes pontos (todos decorrem do código/SDK real):
- O app Starlette do SDK serve `/mcp` e `/.well-known/oauth-protected-resource/mcp` a partir da própria raiz, então ele **não** é montado em `/mcp` (viraria `/mcp/mcp`) nem na raiz (um mount em `/` desliga o redirect de barra final da API). O FastAPI registra duas rotas explícitas que apontam para ele.
- A tela de consentimento do SPA fica em **`/conexoes/autorizar`** (não `/oauth/consent`), porque `nginx` encaminha o prefixo `/oauth/` ao backend.
- `excluir_meta` vira **`arquivar_meta`** (o service faz soft delete). `movimentar_meta.tipo` = `aporte`/`retirada` (enum real).
- `panorama_geral(de, ate)` em vez de `periodo` (o service recebe intervalo). `listar_tarefas(status)` sem `grupo` (tarefa não tem grupo).
- SDK 2.2: proteção de DNS rebinding precisa ser desligada explicitamente (senão rejeita `Host: bussola.marocos.dev`), e o session manager só roda uma vez por instância (o app MCP é recriado a cada lifespan).
