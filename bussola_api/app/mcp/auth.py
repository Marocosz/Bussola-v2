"""Verificador de Bearer do MCP: token -> McpToken (por hash) -> AccessToken do SDK."""

from datetime import timezone

import anyio
from mcp.server.auth.provider import AccessToken

from app.mcp.context import sessao
from app.services.mcp_auth import mcp_auth_service


def verificar_token(token: str) -> AccessToken | None:
    with sessao() as db:
        reg = mcp_auth_service.verificar(db, token)
        if not reg:
            return None
        expira = int(reg.expires_at.replace(tzinfo=timezone.utc).timestamp()) if reg.expires_at else None
        return AccessToken(
            token=token,
            client_id=reg.client_id or f"pat:{reg.id}",
            scopes=reg.scopes.split(),
            expires_at=expira,
            subject=str(reg.user_id),
        )


class BussolaTokenVerifier:
    async def verify_token(self, token: str) -> AccessToken | None:
        return await anyio.to_thread.run_sync(verificar_token, token)
