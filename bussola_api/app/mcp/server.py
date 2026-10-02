"""
=======================================================================================
ARQUIVO: server.py (MCP - servidor do Bussola)
=======================================================================================

OBJETIVO:
    Instância MCPServer com auth (o Bussola é o resource server e o authorization
    server), registro das tools de cada módulo e o app ASGI ligado ao
    FastAPI — o app do SDK serve /mcp e /.well-known/oauth-protected-resource/mcp.
=======================================================================================
"""

from contextlib import asynccontextmanager

from mcp.server.auth.settings import AuthSettings
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

from app.core.config import settings
from app.mcp.auth import BussolaTokenVerifier
from app.mcp.context import ESCOPO_LEITURA
from app.mcp.tools import agenda, financas, habitos, metas, perfil, registros, ritmo

MODULOS = (perfil, financas, metas, agenda, registros, habitos, ritmo)

_base = settings.PUBLIC_BASE_URL.rstrip("/")

mcp = MCPServer(
    name="bussola",
    title="Bússola",
    instructions=(
        "Sistema operacional pessoal do usuário: finanças, metas (cofrinhos), agenda, "
        "anotações, tarefas, hábitos, saúde (Ritmo) e cofre de senhas (só metadados). "
        "Chame meu_perfil para saber a data de hoje. Valores em reais; datas ISO (AAAA-MM-DD). "
        "Categorias, metas, grupos e hábitos aceitam nome ou id."
    ),
    token_verifier=BussolaTokenVerifier(),
    auth=AuthSettings(
        issuer_url=_base,
        resource_server_url=f"{_base}/mcp",
        required_scopes=[ESCOPO_LEITURA],
        validate_token_resource=False,  # nosso verificador já confere o token no banco
    ),
)

for modulo in MODULOS:
    modulo.register(mcp)


class McpAsgi:
    """App ASGI apontado pelas rotas /mcp do FastAPI. O SDK só deixa o session manager rodar UMA vez por
    instância e o lifespan do FastAPI roda a cada TestClient — então cada lifespan
    recria o app Starlette do MCP (e com ele um session manager novo)."""

    def __init__(self):
        self.app = None

    async def __call__(self, scope, receive, send):
        await self.app(scope, receive, send)


mcp_asgi = McpAsgi()


@asynccontextmanager
async def mcp_lifespan():
    mcp_asgi.app = mcp.streamable_http_app(
        streamable_http_path="/mcp",
        stateless_http=True,   # 2 workers do uvicorn: nada de sessão em memória
        json_response=True,
        # O default liga proteção de DNS rebinding só para localhost e rejeitaria
        # Host: bussola.marocos.dev. Servidor remoto com Bearer não precisa dela.
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    async with mcp.session_manager.run():
        yield
