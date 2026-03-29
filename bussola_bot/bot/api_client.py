import httpx


class ApiClient:
    """
    Wrapper HTTP para a bussola_api.
    Todas as requisições incluem o X-Bot-Service-Token automaticamente.
    """

    def __init__(self, base_url: str, service_token: str):
        self.base_url = base_url.rstrip("/")
        self._headers = {"X-Bot-Service-Token": service_token}

    async def generate_link_token(self, discord_id: str) -> str | None:
        """
        Gera um one-time token de vinculação para o discord_id.
        Retorna o token UUID ou None em caso de erro.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/v1/bot/auth/link-token",
                    json={"discord_id": discord_id},
                    headers=self._headers,
                    timeout=10.0,
                )
                if response.status_code == 200:
                    return response.json()["token"]
                return None
            except httpx.RequestError:
                return None

    async def check_link_status(self, discord_id: str) -> bool:
        """
        Verifica se o discord_id já está vinculado a uma conta Bussola.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/api/v1/bot/auth/link-status",
                    params={"discord_id": discord_id},
                    headers=self._headers,
                    timeout=10.0,
                )
                if response.status_code == 200:
                    return response.json()["linked"]
                return False
            except httpx.RequestError:
                return False

    async def unlink_account(self, discord_id: str) -> bool:
        """Remove o vínculo entre discord_id e a conta Bussola."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(
                    "DELETE",
                    f"{self.base_url}/api/v1/bot/auth/unlink",
                    json={"discord_id": discord_id},
                    headers=self._headers,
                    timeout=10.0,
                )
                return response.status_code == 200
            except httpx.RequestError:
                return False
