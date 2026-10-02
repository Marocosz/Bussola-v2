# MCP — Bussola como servidor para o Claude

O backend expõe um servidor MCP remoto em `https://bussola.marocos.dev/mcp`
(Streamable HTTP, stateless). Código em `bussola_api/app/mcp/`; spec em
`docs/superpowers/specs/2026-10-01-mcp-server-design.md`.

## Conectar

- **claude.ai / app:** Configurações → Conectores → Adicionar conector personalizado →
  URL `https://bussola.marocos.dev/mcp`. O Claude faz o OAuth: você loga no Bussola e
  autoriza em `/conexoes/autorizar` (ler, ou ler e escrever).
- **Claude Code:** no Bussola, Configurações da Conta → Conexões MCP → Novo token. Depois:
  `claude mcp add --transport http bussola https://bussola.marocos.dev/mcp --header "Authorization: Bearer <token>"`

Revogue qualquer conexão na mesma tela.

## Arquitetura

- `server.py` — `MCPServer` (SDK `mcp` 2.x) ligado ao FastAPI por duas rotas explícitas; serve `/mcp`; a metadata do recurso (`/.well-known/oauth-protected-resource[/mcp]`) é do router OAuth.
- `auth.py` — verifica o Bearer contra `mcp_token` (só hash SHA-256 no banco).
- `context.py` — `usuario_e_db(escopo)`: usuário do token, checagem de escopo, tradução de
  erros de service em `ToolError`.
- `resolvers.py` — "nome ou id" para categoria, meta, grupo e hábito.
- `tools/<modulo>.py` — uma função por tool; regra de negócio fica nos services.
- Estudos (`tools/estudos.py`): o formato dos materiais é o contrato de `catalogo_de_blocos`; detalhes em `docs/ESTUDOS.md`.
- OAuth: `app/api/v1/endpoints/oauth.py` (`/.well-known/oauth-authorization-server`,
  `/oauth/register|authorize|token`, `/api/v1/oauth/consent`) e `app/services/mcp_auth.py`.

## Adicionar um módulo

Crie `app/mcp/tools/<modulo>.py` com funções que retornam `dict[str, Any]` e um
`register(mcp)` usando `registrar(mcp, leitura=..., escrita=..., destrutivas=...)`;
acrescente o módulo a `MODULOS` em `server.py`. Teste com a fixture `mcp_call`.

## Produção

- Env do backend: `PUBLIC_BASE_URL=https://bussola.marocos.dev`.
- `FRONTEND_URL` deve ser a URL de produção (o authorize redireciona para `/conexoes/autorizar` nela).
- No primeiro deploy sobre um banco já populado, rode `alembic stamp head` (as tabelas são criadas por `create_all` no boot).
- A tela de consentimento mostra o host de destino do redirect e avisa quando ele não é do Claude.
- Smoke test: `curl https://bussola.marocos.dev/.well-known/oauth-authorization-server` e
  `curl -i -X POST https://bussola.marocos.dev/mcp` (espera 401 com `WWW-Authenticate`).
- O Cofre nunca expõe valores via MCP, por design.
