# Discord Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o serviço `bussola_bot/` com estrutura base, fluxo completo de vinculação Discord ↔ Bussola (OAuth one-time token), mensagem de boas-vindas e confirmação de vínculo.

**Architecture:** Bot separado (discord.py) que autentica na `bussola_api` via `X-Bot-Service-Token`. A API expõe endpoints `/bot/auth/` protegidos por service token para gerar e verificar tokens de vinculação. O frontend expõe `/discord/link?token=` para que o usuário confirme a vinculação após login.

**Tech Stack:** discord.py 2.x, httpx (async), python-dotenv, FastAPI (já existente), React + axios (já existente), Alembic (já existente).

---

## File Map

### Criados
- `bussola_bot/main.py`
- `bussola_bot/requirements.txt`
- `bussola_bot/.env.example`
- `bussola_bot/bot/__init__.py`
- `bussola_bot/bot/client.py`
- `bussola_bot/bot/api_client.py`
- `bussola_bot/bot/cogs/__init__.py`
- `bussola_bot/bot/cogs/auth.py`
- `bussola_bot/bot/cogs/financas.py` (placeholder)
- `bussola_bot/bot/cogs/agenda.py` (placeholder)
- `bussola_bot/bot/cogs/registros.py` (placeholder)
- `bussola_bot/bot/cogs/ritmo.py` (placeholder)
- `bussola_bot/bot/cogs/configuracoes.py` (placeholder)
- `bussola_api/app/models/discord_link_token.py`
- `bussola_api/app/api/bot_deps.py`
- `bussola_api/app/api/v1/endpoints/bot_auth.py`
- `bussola_api/app/api/v1/endpoints/discord_link.py`
- `bussola_web/src/pages/Auth/DiscordLink.jsx`

### Modificados
- `bussola_api/app/models/__init__.py` — exportar `DiscordLinkToken`
- `bussola_api/app/core/config.py` — adicionar `BOT_SERVICE_TOKEN`, `FRONTEND_URL`
- `bussola_api/app/api/v1/router.py` — registrar `bot_auth` e `discord_link`
- `bussola_api/.env` — adicionar `BOT_SERVICE_TOKEN`
- `bussola_web/src/routes/index.jsx` — adicionar rota `/discord/link`
- `bussola_web/src/pages/Login/index.jsx` — suportar redirect `?next=` após login

---

## Task 1: bussola_bot/ — Estrutura base

**Files:**
- Create: `bussola_bot/main.py`
- Create: `bussola_bot/requirements.txt`
- Create: `bussola_bot/.env.example`
- Create: `bussola_bot/bot/__init__.py`
- Create: `bussola_bot/bot/cogs/__init__.py`

- [ ] **Step 1: Criar estrutura de pastas**

```bash
mkdir -p bussola_bot/bot/cogs
touch bussola_bot/bot/__init__.py
touch bussola_bot/bot/cogs/__init__.py
```

- [ ] **Step 2: Criar requirements.txt**

```
# bussola_bot/requirements.txt
discord.py==2.3.2
httpx==0.28.1
python-dotenv==1.2.1
APScheduler==3.10.4
```

- [ ] **Step 3: Criar .env.example**

```
# bussola_bot/.env.example
DISCORD_BOT_TOKEN=
BOT_SERVICE_TOKEN=
API_BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 4: Criar main.py**

```python
# bussola_bot/main.py
import asyncio
import os
from dotenv import load_dotenv
from bot.client import BussolaBot

load_dotenv()

async def main():
    bot = BussolaBot()
    async with bot:
        await bot.start(os.getenv("DISCORD_BOT_TOKEN"))

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 5: Commit**

```bash
git add bussola_bot/
git commit -m "feat(discord-bot): estrutura base do bussola_bot"
```

---

## Task 2: bussola_api — BOT_SERVICE_TOKEN no config + bot_deps.py

**Files:**
- Modify: `bussola_api/app/core/config.py`
- Modify: `bussola_api/.env`
- Create: `bussola_api/app/api/bot_deps.py`

- [ ] **Step 1: Adicionar BOT_SERVICE_TOKEN e FRONTEND_URL ao config.py**

Em `bussola_api/app/core/config.py`, dentro da classe `Settings`, adicionar após o bloco de integrações de terceiros:

```python
    BOT_SERVICE_TOKEN: Optional[str] = None
    FRONTEND_URL: str = "http://localhost:5173"
```

- [ ] **Step 2: Adicionar ao .env**

No arquivo `bussola_api/.env`, adicionar (gere um valor seguro com `openssl rand -hex 32`):

```
BOT_SERVICE_TOKEN=gere_um_valor_com_openssl_rand_hex_32
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 3: Criar bot_deps.py**

```python
# bussola_api/app/api/bot_deps.py
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.api.deps import get_db
from app.models.user import User


def require_bot_token(x_bot_service_token: str = Header(...)):
    """Valida o SERVICE_TOKEN do bot. Usado em todos os endpoints /bot/."""
    if not settings.BOT_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="Bot service não configurado")
    if x_bot_service_token != settings.BOT_SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Token de serviço inválido")


def get_bot_user(
    discord_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_bot_token),
) -> User:
    """
    Resolve discord_id → User autenticado.
    Usado em endpoints que exigem que o usuário já esteja vinculado.
    """
    user = db.query(User).filter(User.discord_id == discord_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário não encontrado ou inativo")
    return user
```

- [ ] **Step 4: Commit**

```bash
git add bussola_api/app/core/config.py bussola_api/app/api/bot_deps.py
git commit -m "feat(discord-bot): adiciona BOT_SERVICE_TOKEN e bot_deps"
```

---

## Task 3: bussola_api — DiscordLinkToken model + migration

**Files:**
- Create: `bussola_api/app/models/discord_link_token.py`
- Modify: `bussola_api/app/models/__init__.py`

- [ ] **Step 1: Criar o modelo**

```python
# bussola_api/app/models/discord_link_token.py
from sqlalchemy import Boolean, Column, Integer, String, DateTime, func
from app.db.base_class import Base


class DiscordLinkToken(Base):
    __tablename__ = "discord_link_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    discord_id = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Exportar no __init__.py**

Em `bussola_api/app/models/__init__.py`, adicionar após as importações existentes:

```python
from .discord_link_token import DiscordLinkToken
```

- [ ] **Step 3: Gerar e rodar a migration**

```bash
cd bussola_api
source venvbussola2/bin/activate  # Windows: venvbussola2\Scripts\activate
alembic revision --autogenerate -m "add discord_link_tokens table"
alembic upgrade head
```

Verificar que a migration criou a tabela `discord_link_tokens` com as colunas corretas.

- [ ] **Step 4: Commit**

```bash
git add bussola_api/app/models/discord_link_token.py bussola_api/app/models/__init__.py bussola_api/alembic/versions/
git commit -m "feat(discord-bot): adiciona model DiscordLinkToken e migration"
```

---

## Task 4: bussola_api — Endpoints do bot (link-token + link-status)

**Files:**
- Create: `bussola_api/app/api/v1/endpoints/bot_auth.py`

- [ ] **Step 1: Criar bot_auth.py**

```python
# bussola_api/app/api/v1/endpoints/bot_auth.py
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.bot_deps import require_bot_token
from app.api.deps import get_db
from app.models.discord_link_token import DiscordLinkToken
from app.models.user import User

router = APIRouter()


class LinkTokenRequest(BaseModel):
    discord_id: str


class LinkTokenResponse(BaseModel):
    token: str


class LinkStatusResponse(BaseModel):
    linked: bool


@router.post(
    "/auth/link-token",
    response_model=LinkTokenResponse,
    dependencies=[Depends(require_bot_token)],
)
def generate_link_token(payload: LinkTokenRequest, db: Session = Depends(get_db)):
    """
    Gera um one-time token para vincular discord_id a uma conta Bussola.
    Invalida tokens anteriores não utilizados para o mesmo discord_id.
    """
    # Se já vinculado, não gera token
    already_linked = db.query(User).filter(
        User.discord_id == payload.discord_id
    ).first()
    if already_linked:
        raise HTTPException(
            status_code=400,
            detail="Este Discord já está vinculado a uma conta Bussola"
        )

    # Invalida tokens anteriores não usados para este discord_id
    db.query(DiscordLinkToken).filter(
        DiscordLinkToken.discord_id == payload.discord_id,
        DiscordLinkToken.used == False,
    ).delete()

    # Gera novo token com expiração de 10 minutos
    new_token = DiscordLinkToken(
        token=str(uuid.uuid4()),
        discord_id=payload.discord_id,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(new_token)
    db.commit()

    return {"token": new_token.token}


@router.get(
    "/auth/link-status",
    response_model=LinkStatusResponse,
    dependencies=[Depends(require_bot_token)],
)
def check_link_status(discord_id: str, db: Session = Depends(get_db)):
    """Verifica se um discord_id já está vinculado a alguma conta."""
    user = db.query(User).filter(User.discord_id == discord_id).first()
    return {"linked": user is not None}
```

- [ ] **Step 2: Commit**

```bash
git add bussola_api/app/api/v1/endpoints/bot_auth.py
git commit -m "feat(discord-bot): endpoints bot/auth (link-token e link-status)"
```

---

## Task 5: bussola_api — Endpoint de confirmação (frontend)

**Files:**
- Create: `bussola_api/app/api/v1/endpoints/discord_link.py`

- [ ] **Step 1: Criar discord_link.py**

```python
# bussola_api/app/api/v1/endpoints/discord_link.py
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, CurrentUser
from app.models.discord_link_token import DiscordLinkToken
from app.models.user import User

router = APIRouter()


class ConfirmLinkRequest(BaseModel):
    token: str


class ConfirmLinkResponse(BaseModel):
    message: str


@router.post("/confirm", response_model=ConfirmLinkResponse)
def confirm_discord_link(
    payload: ConfirmLinkRequest,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """
    Chamado pelo frontend após o usuário autenticar.
    Vincula o discord_id (do token) ao usuário logado.
    """
    link_token = db.query(DiscordLinkToken).filter(
        DiscordLinkToken.token == payload.token,
        DiscordLinkToken.used == False,
    ).first()

    if not link_token:
        raise HTTPException(status_code=404, detail="Token inválido ou já utilizado")

    if link_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expirado. Gere um novo link pelo Discord")

    # Garante que o discord_id não está vinculado a outra conta
    existing = db.query(User).filter(
        User.discord_id == link_token.discord_id
    ).first()
    if existing and existing.id != current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Este Discord já está vinculado a outra conta Bussola"
        )

    # Vincula e invalida o token
    current_user.discord_id = link_token.discord_id
    link_token.used = True
    db.commit()

    return {"message": "Conta vinculada com sucesso!"}
```

- [ ] **Step 2: Commit**

```bash
git add bussola_api/app/api/v1/endpoints/discord_link.py
git commit -m "feat(discord-bot): endpoint discord/link/confirm para frontend"
```

---

## Task 6: bussola_api — Registrar novos routers

**Files:**
- Modify: `bussola_api/app/api/v1/router.py`

- [ ] **Step 1: Adicionar imports e registros no router.py**

Em `bussola_api/app/api/v1/router.py`, adicionar o import:

```python
from app.api.v1.endpoints import (
    auth,
    home,
    financas,
    agenda,
    registros,
    ritmo,
    cofre,
    panorama,
    system,
    users,
    ai,
    bot_auth,       # novo
    discord_link,   # novo
)
```

E no final do arquivo, antes do final, adicionar:

```python
# Discord Bot (autenticação via SERVICE_TOKEN)
api_router.include_router(bot_auth.router, prefix="/bot", tags=["bot"])

# Discord Link (confirmação via JWT do usuário)
api_router.include_router(discord_link.router, prefix="/discord/link", tags=["discord"])
```

- [ ] **Step 2: Verificar que a API sobe sem erros**

```bash
cd bussola_api
uvicorn app.main:app --reload --port 8000
```

Acessar http://localhost:8000/docs e confirmar que os endpoints aparecem:
- `POST /api/v1/bot/auth/link-token`
- `GET /api/v1/bot/auth/link-status`
- `POST /api/v1/discord/link/confirm`

- [ ] **Step 3: Commit**

```bash
git add bussola_api/app/api/v1/router.py
git commit -m "feat(discord-bot): registra routers bot_auth e discord_link"
```

---

## Task 7: bussola_bot — api_client.py

**Files:**
- Create: `bussola_bot/bot/api_client.py`

- [ ] **Step 1: Criar api_client.py**

```python
# bussola_bot/bot/api_client.py
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
```

- [ ] **Step 2: Commit**

```bash
git add bussola_bot/bot/api_client.py
git commit -m "feat(discord-bot): api_client com generate_link_token e check_link_status"
```

---

## Task 8: bussola_bot — Auth cog (boas-vindas + /link + polling)

**Files:**
- Create: `bussola_bot/bot/cogs/auth.py`
- Create: `bussola_bot/bot/cogs/financas.py` (placeholder)
- Create: `bussola_bot/bot/cogs/agenda.py` (placeholder)
- Create: `bussola_bot/bot/cogs/registros.py` (placeholder)
- Create: `bussola_bot/bot/cogs/ritmo.py` (placeholder)
- Create: `bussola_bot/bot/cogs/configuracoes.py` (placeholder)

- [ ] **Step 1: Criar auth.py**

```python
# bussola_bot/bot/cogs/auth.py
import asyncio

import discord
from discord import app_commands
from discord.ext import commands


WELCOME_COLOR = 0x5865F2  # Discord Blurple


class LinkView(discord.ui.View):
    """View com o botão 'Vincular Conta' enviado na mensagem de boas-vindas."""

    def __init__(self, cog: "AuthCog", user: discord.User):
        super().__init__(timeout=600)  # expira junto com o token (10 min)
        self.cog = cog
        self.user = user

    @discord.ui.button(label="Vincular Conta", style=discord.ButtonStyle.primary, emoji="🔗")
    async def link_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user.id:
            await interaction.response.send_message(
                "Este botão não é para você.", ephemeral=True
            )
            return
        await self.cog._start_link_flow(interaction)


class AuthCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        # Controla quem já recebeu a mensagem de boas-vindas nesta sessão
        # para evitar spam quando o usuário manda várias mensagens sem vincular.
        self._welcomed: set[int] = set()

    # ------------------------------------------------------------------
    # Evento: primeira mensagem no DM → boas-vindas se não vinculado
    # ------------------------------------------------------------------

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot:
            return
        if not isinstance(message.channel, discord.DMChannel):
            return
        if message.author.id in self._welcomed:
            return

        is_linked = await self.bot.api.check_link_status(str(message.author.id))
        if not is_linked:
            self._welcomed.add(message.author.id)
            await self._send_welcome(message.channel, message.author)

    async def _send_welcome(self, channel: discord.DMChannel, user: discord.User):
        embed = discord.Embed(
            title="Olá! Sou o Bússola Bot 🧭",
            description=(
                "Sou a interface do **Bússola** direto no seu Discord.\n\n"
                "Consulte seus dados, registre informações e receba "
                "notificações sem sair do Discord.\n\n"
                "Para começar, vincule sua conta Bússola:"
            ),
            color=WELCOME_COLOR,
        )
        embed.set_footer(text="O link de vinculação expira em 10 minutos.")
        await channel.send(embed=embed, view=LinkView(self, user))

    # ------------------------------------------------------------------
    # Slash command: /link
    # ------------------------------------------------------------------

    @app_commands.command(name="link", description="Vincule sua conta Bússola ao Discord")
    async def link_command(self, interaction: discord.Interaction):
        await self._start_link_flow(interaction)

    async def _start_link_flow(self, interaction: discord.Interaction):
        discord_id = str(interaction.user.id)

        is_linked = await self.bot.api.check_link_status(discord_id)
        if is_linked:
            await interaction.response.send_message(
                "✅ Sua conta já está vinculada!", ephemeral=True
            )
            return

        token = await self.bot.api.generate_link_token(discord_id)
        if not token:
            await interaction.response.send_message(
                "❌ Erro ao gerar o link. Tente novamente em instantes.",
                ephemeral=True,
            )
            return

        link_url = f"{self.bot.frontend_url}/discord/link?token={token}"

        await interaction.response.send_message(
            f"🔗 Clique no link abaixo para vincular sua conta "
            f"**(válido por 10 minutos)**:\n{link_url}",
            ephemeral=True,
        )

        # Inicia polling em background — não bloqueia o bot
        asyncio.create_task(self._poll_link(interaction.user, discord_id))

    async def _poll_link(self, user: discord.User, discord_id: str):
        """
        Verifica a cada 3 segundos se o usuário completou a vinculação.
        Timeout: 10 minutos (200 tentativas × 3s).
        """
        for _ in range(200):
            await asyncio.sleep(3)
            if await self.bot.api.check_link_status(discord_id):
                self._welcomed.add(user.id)  # não mostra boas-vindas novamente
                await user.send(
                    "✅ **Conta vinculada com sucesso!**\n\n"
                    "Você já pode usar todos os comandos. "
                    "Digite `/ajuda` para ver o que está disponível."
                )
                return
        # Timeout silencioso — o link expirou, usuário pode usar /link novamente


async def setup(bot: commands.Bot):
    await bot.add_cog(AuthCog(bot))
```

- [ ] **Step 2: Criar cogs placeholder**

Conteúdo idêntico para cada arquivo (apenas o nome da classe muda):

```python
# bussola_bot/bot/cogs/financas.py
from discord.ext import commands

class FinancasCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

async def setup(bot: commands.Bot):
    await bot.add_cog(FinancasCog(bot))
```

Criar os seguintes arquivos com o mesmo padrão (trocando `Financas` pelo nome do módulo):
- `bussola_bot/bot/cogs/agenda.py` — `AgendaCog`
- `bussola_bot/bot/cogs/registros.py` — `RegistrosCog`
- `bussola_bot/bot/cogs/ritmo.py` — `RitmoCog`
- `bussola_bot/bot/cogs/configuracoes.py` — `ConfiguracoesCog`

- [ ] **Step 3: Commit**

```bash
git add bussola_bot/bot/cogs/
git commit -m "feat(discord-bot): auth cog com boas-vindas, /link e polling"
```

---

## Task 9: bussola_bot — client.py + main.py

**Files:**
- Create: `bussola_bot/bot/client.py`

- [ ] **Step 1: Criar client.py**

```python
# bussola_bot/bot/client.py
import os
import discord
from discord.ext import commands

from bot.api_client import ApiClient

COGS = [
    "bot.cogs.auth",
    "bot.cogs.financas",
    "bot.cogs.agenda",
    "bot.cogs.registros",
    "bot.cogs.ritmo",
    "bot.cogs.configuracoes",
]


class BussolaBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.dm_messages = True

        super().__init__(command_prefix="!", intents=intents)

        self.api_base_url: str = os.getenv("API_BASE_URL", "http://localhost:8000")
        self.bot_service_token: str = os.getenv("BOT_SERVICE_TOKEN", "")
        self.frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
        self.api: ApiClient = ApiClient(self.api_base_url, self.bot_service_token)

    async def setup_hook(self):
        """Carrega todos os cogs e sincroniza slash commands com o Discord."""
        for cog in COGS:
            await self.load_extension(cog)
        await self.tree.sync()

    async def on_ready(self):
        print(f"✅ Bot online: {self.user} (ID: {self.user.id})")
        print(f"   API: {self.api_base_url}")
        print(f"   Frontend: {self.frontend_url}")
```

- [ ] **Step 2: Criar .env do bot**

```bash
cp bussola_bot/.env.example bussola_bot/.env
```

Preencher com os valores reais:
- `DISCORD_BOT_TOKEN` — token do bot no Discord Developer Portal
- `BOT_SERVICE_TOKEN` — mesmo valor configurado na `bussola_api/.env`
- `API_BASE_URL` — `http://localhost:8000` para desenvolvimento
- `FRONTEND_URL` — `http://localhost:5173` para desenvolvimento

- [ ] **Step 3: Instalar dependências e testar o bot**

```bash
cd bussola_bot
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Esperado no terminal:
```
✅ Bot online: Bússola#XXXX (ID: 1487509947880177775)
   API: http://localhost:8000
   Frontend: http://localhost:5173
```

- [ ] **Step 4: Commit**

```bash
git add bussola_bot/bot/client.py bussola_bot/.env.example
git commit -m "feat(discord-bot): client.py com BussolaBot e carregamento de cogs"
```

---

## Task 10: bussola_web — PrivateRoute suporta redirect ?next=

**Files:**
- Modify: `bussola_web/src/routes/index.jsx`
- Modify: `bussola_web/src/pages/Login/index.jsx`

- [ ] **Step 1: Atualizar PrivateRoute para preservar URL de retorno**

Em `bussola_web/src/routes/index.jsx`, substituir a função `PrivateRoute`:

```jsx
import { useLocation } from 'react-router-dom'; // adicionar ao import existente

function PrivateRoute({ children }) {
    const { authenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="loading-screen">Carregando Usuário...</div>;
    }

    if (!authenticated) {
        const next = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?next=${next}`} />;
    }

    return (
        <div className="app-layout">
            <Navbar />
            <div className="app-content">
                {children}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Atualizar Login para redirecionar para ?next= após login**

Em `bussola_web/src/pages/Login/index.jsx`, adicionar import:

```jsx
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
```

Adicionar dentro da função `Login`, após o `const navigate = useNavigate()`:

```jsx
const [searchParams] = useSearchParams();
const nextUrl = searchParams.get('next') || '/home';
```

Substituir todas as chamadas `navigate('/home')` por `navigate(nextUrl)` (são 2 ocorrências: `handleGoogleClick` e `handleSubmit`).

- [ ] **Step 3: Commit**

```bash
git add bussola_web/src/routes/index.jsx bussola_web/src/pages/Login/index.jsx
git commit -m "feat(discord-bot): login suporta redirect ?next= após autenticação"
```

---

## Task 11: bussola_web — Página DiscordLink

**Files:**
- Create: `bussola_web/src/pages/Auth/DiscordLink.jsx`

- [ ] **Step 1: Criar DiscordLink.jsx**

```jsx
// bussola_web/src/pages/Auth/DiscordLink.jsx
import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import logoBussola from '../../assets/images/bussola.svg';

export function DiscordLink() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const initialized = useRef(false);

    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('Vinculando sua conta...');

    const token = searchParams.get('token');

    useEffect(() => {
        if (initialized.current) return;

        if (!token) {
            setStatus('error');
            setMessage('Link inválido. Gere um novo link pelo Discord usando /link.');
            return;
        }

        initialized.current = true;

        const confirm = async () => {
            try {
                await api.post('/discord/link/confirm', { token });

                setStatus('success');
                setMessage('Conta vinculada com sucesso!');

                addToast({
                    type: 'success',
                    title: 'Discord vinculado!',
                    description: 'Você já pode usar o Bússola Bot no Discord.',
                });

                setTimeout(() => navigate('/home'), 3000);
            } catch (error) {
                setStatus('error');
                const errorMsg =
                    error?.response?.data?.detail ||
                    'Não foi possível vincular a conta.';
                setMessage(errorMsg);

                addToast({ type: 'error', title: 'Falha', description: errorMsg });
            }
        };

        confirm();
    }, [token, navigate, addToast]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: 'var(--cor-fundo-principal)',
            color: 'var(--cor-texto-principal)',
            padding: '20px',
            textAlign: 'center',
        }}>
            <div style={{
                background: 'var(--cor-fundo-card)',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                maxWidth: '450px',
                width: '100%',
                border: '1px solid var(--cor-borda-suave, #e5e7eb)',
            }}>
                <img
                    src={logoBussola}
                    alt="Logo Bússola"
                    style={{ height: '60px', marginBottom: '25px' }}
                />

                <h2 style={{ marginBottom: '10px', fontSize: '1.5rem' }}>
                    Vincular Discord
                </h2>
                <p style={{ color: 'var(--cor-texto-secundario)', marginBottom: '25px', fontSize: '0.95rem' }}>
                    Conectando sua conta Bússola ao Discord Bot
                </p>

                <div style={{ minHeight: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

                    {status === 'loading' && (
                        <div style={{ color: 'var(--cor-texto-secundario)' }}>
                            <i className="fas fa-circle-notch fa-spin"
                               style={{ fontSize: '2.5rem', marginBottom: '15px', color: 'var(--cor-azul-primario)' }} />
                            <p>{message}</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div>
                            <i className="fas fa-check-circle"
                               style={{ fontSize: '3rem', color: '#10B981', marginBottom: '15px' }} />
                            <p style={{ color: '#10B981', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                {message}
                            </p>
                            <p style={{ fontSize: '0.85rem', marginTop: '10px', color: 'var(--cor-texto-secundario)' }}>
                                Redirecionando para o início...
                            </p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div>
                            <i className="fas fa-times-circle"
                               style={{ fontSize: '3rem', color: '#EF4444', marginBottom: '15px' }} />
                            <p style={{ color: '#EF4444', fontWeight: 'bold' }}>{message}</p>
                            <button
                                onClick={() => navigate('/home')}
                                style={{
                                    marginTop: '20px',
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: 'var(--cor-azul-primario)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '0.95rem',
                                }}
                            >
                                Voltar ao Início
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add bussola_web/src/pages/Auth/DiscordLink.jsx
git commit -m "feat(discord-bot): página DiscordLink para confirmação de vínculo"
```

---

## Task 12: bussola_web — Registrar rota /discord/link

**Files:**
- Modify: `bussola_web/src/routes/index.jsx`

- [ ] **Step 1: Adicionar import e rota**

Em `bussola_web/src/routes/index.jsx`, adicionar o import:

```jsx
import { DiscordLink } from '../pages/Auth/DiscordLink';
```

E nas rotas públicas (antes das privadas), adicionar:

```jsx
<Route path="/discord/link" element={<DiscordLink />} />
```

A rota deve ser **privada** (dentro de `PrivateRoute`) — se o usuário não estiver logado, o PrivateRoute vai redirecionar para `/login?next=/discord/link?token=...` e após o login voltará automaticamente.

Alterar para:

```jsx
<Route
    path="/discord/link"
    element={<PrivateRoute><DiscordLink /></PrivateRoute>}
/>
```

- [ ] **Step 2: Testar o fluxo completo**

1. Iniciar o backend: `cd bussola_api && uvicorn app.main:app --reload`
2. Iniciar o frontend: `cd bussola_web && npm run dev`
3. Iniciar o bot: `cd bussola_bot && python main.py`
4. No Discord, enviar qualquer mensagem para o bot no DM
5. Confirmar que aparece a mensagem de boas-vindas com o botão "Vincular Conta"
6. Clicar no botão → link deve aparecer
7. Acessar o link no browser → tela de login se não autenticado → redireciona para `/discord/link?token=...` após login
8. Tela mostra "Vinculando..." → "Conta vinculada com sucesso!"
9. No Discord, bot deve enviar "✅ Conta vinculada com sucesso!"

- [ ] **Step 3: Commit final**

```bash
git add bussola_web/src/routes/index.jsx
git commit -m "feat(discord-bot): rota /discord/link registrada no frontend"
```
