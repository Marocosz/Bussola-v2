# Logging System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a structured JSON logging system across all three layers (API, Bot, Frontend) with Coolify-compatible stdout output.

**Architecture:** Each service emits structured JSON logs to stdout. The API gets a centralized logging config, a request/response middleware, and a global error handler. The bot replaces all `print()` with a proper logger. The frontend gets a typed logger service and an ErrorBoundary component.

**Tech Stack:** Python `python-json-logger` (API + Bot), TypeScript (Frontend logger), FastAPI middleware, React ErrorBoundary, Nginx log_format, Docker json-file logging driver.

---

## File Map

**Create:**
- `bussola_api/app/core/logging_config.py` — centralized logging setup for the API
- `bussola_api/app/api/middleware/logging_middleware.py` — request/response logging middleware
- `bussola_api/app/api/middleware/__init__.py` — package marker
- `bussola_bot/bot/logger.py` — centralized logging setup for the bot
- `bussola_web/src/utils/logger.ts` — typed logger service for the frontend
- `bussola_web/src/components/ErrorBoundary.tsx` — React error boundary

**Modify:**
- `bussola_api/requirements.txt` — add `python-json-logger`
- `bussola_api/app/core/config.py` — add `LOG_LEVEL` setting
- `bussola_api/app/main.py` — wire up logging, middleware, global error handler
- `bussola_bot/main.py` — call `setup_bot_logging()` on startup
- `bussola_bot/bot/client.py` — replace `print()` with logger
- `bussola_bot/bot/webhook.py` — replace `print()` with logger
- `bussola_bot/bot/cogs/auth.py` — replace `print()` with logger
- `bussola_web/src/main.jsx` — wrap app with ErrorBoundary
- `bussola_web/src/services/api.ts` — replace `console.error/warn/log` with logger
- `bussola_web/nginx.conf` — add JSON access log format
- `docker-compose.yml` — add `LOG_LEVEL` env var and logging driver to all services

---

## Task 1: Add `python-json-logger` to API dependencies

**Files:**
- Modify: `bussola_api/requirements.txt`

- [ ] **Step 1: Add the dependency**

Open `bussola_api/requirements.txt` and add after the existing entries (keep alphabetical order, place after `python-dotenv`):

```
python-json-logger==2.0.7
```

- [ ] **Step 2: Install locally to verify the package name is valid**

```bash
cd bussola_api
pip install python-json-logger==2.0.7
```

Expected: `Successfully installed python-json-logger-2.0.7`

- [ ] **Step 3: Commit**

```bash
git add bussola_api/requirements.txt
git commit -m "chore(api): add python-json-logger dependency"
```

---

## Task 2: Add `LOG_LEVEL` to API config

**Files:**
- Modify: `bussola_api/app/core/config.py:41-176`

- [ ] **Step 1: Add the field to the Settings class**

In `bussola_api/app/core/config.py`, inside the `Settings` class, after the line `PROJECT_NAME: str = "Bússola API"`, add:

```python
    LOG_LEVEL: str = "INFO"
```

The resulting block at the top of the class should look like:

```python
class Settings(BaseSettings):
    # Identificação da API
    PROJECT_NAME: str = "Bússola API"
    LOG_LEVEL: str = "INFO"
    API_V1_STR: str = "/api/v1"
```

- [ ] **Step 2: Verify import works**

```bash
cd bussola_api
python -c "from app.core.config import settings; print(settings.LOG_LEVEL)"
```

Expected output: `INFO`

- [ ] **Step 3: Commit**

```bash
git add bussola_api/app/core/config.py
git commit -m "feat(api): add LOG_LEVEL config setting"
```

---

## Task 3: Create centralized logging config for the API

**Files:**
- Create: `bussola_api/app/core/logging_config.py`

- [ ] **Step 1: Create the file**

```python
# bussola_api/app/core/logging_config.py
import logging
import sys
from pythonjsonlogger import jsonlogger


class BussolaJsonFormatter(jsonlogger.JsonFormatter):
    """
    Formatter que garante campos fixos em todos os logs da API.
    Remove campos sensíveis antes de emitir.
    """

    def add_fields(self, log_record: dict, record: logging.LogRecord, message_dict: dict) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record["service"] = "bussola_api"
        # Remove campos sensíveis que possam ter vazado no extra={}
        for field in ("password", "token", "secret", "authorization", "encryption_key"):
            log_record.pop(field, None)


def setup_logging(log_level: str = "INFO") -> None:
    """
    Configura o sistema de logging global da API.
    Deve ser chamada UMA VEZ, no início de main.py, antes de qualquer outra importação
    que possa logar.

    Args:
        log_level: Nível de log (DEBUG, INFO, WARNING, ERROR, CRITICAL).
                   Em produção use INFO. Em dev pode usar DEBUG.
    """
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        BussolaJsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s"
        )
    )

    root = logging.getLogger()
    root.setLevel(numeric_level)
    # Limpa handlers existentes para evitar duplicação em reloads
    root.handlers = [handler]

    # Loggers de terceiros muito verbosos — silencia em INFO+
    if numeric_level >= logging.INFO:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
        logging.getLogger("passlib").setLevel(logging.WARNING)
```

- [ ] **Step 2: Verify the module imports without error**

```bash
cd bussola_api
python -c "from app.core.logging_config import setup_logging; setup_logging(); import logging; logging.getLogger('test').info('ok', extra={'user_id': 1})"
```

Expected: A single JSON line printed to stdout containing `"message": "ok"` and `"service": "bussola_api"`.

- [ ] **Step 3: Commit**

```bash
git add bussola_api/app/core/logging_config.py
git commit -m "feat(api): add centralized JSON logging configuration"
```

---

## Task 4: Create request/response logging middleware

**Files:**
- Create: `bussola_api/app/api/middleware/__init__.py`
- Create: `bussola_api/app/api/middleware/logging_middleware.py`

- [ ] **Step 1: Create the package marker**

Create `bussola_api/app/api/middleware/__init__.py` as an empty file.

- [ ] **Step 2: Create the middleware**

```python
# bussola_api/app/api/middleware/logging_middleware.py
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("api.http")

# Paths cujo body nunca deve aparecer em logs (LGPD: dados sensíveis)
_SENSITIVE_PATH_PREFIXES = ("/api/v1/cofre",)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware que:
    - Gera um request_id único por requisição (UUID truncado de 8 chars)
    - Loga entrada e saída de toda requisição HTTP
    - Injeta X-Request-ID no header de resposta (facilita debug no frontend)
    - Loga como WARNING requisições com status >= 400
    - Captura e loga exceções não tratadas antes de re-lançá-las
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        start = time.perf_counter()

        logger.info(
            "Requisição recebida",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client_ip": request.client.host if request.client else "unknown",
            },
        )

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start) * 1000)
            logger.error(
                "Exceção não tratada durante requisição",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                    "error_type": type(exc).__name__,
                    "error": str(exc),
                },
                exc_info=True,
            )
            raise

        duration_ms = round((time.perf_counter() - start) * 1000)
        status = response.status_code

        log_level = logging.WARNING if status >= 400 else logging.INFO
        logger.log(
            log_level,
            "Requisição concluída",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": status,
                "duration_ms": duration_ms,
            },
        )

        response.headers["X-Request-ID"] = request_id
        return response
```

- [ ] **Step 3: Verify imports**

```bash
cd bussola_api
python -c "from app.api.middleware.logging_middleware import RequestLoggingMiddleware; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add bussola_api/app/api/middleware/
git commit -m "feat(api): add HTTP request/response logging middleware"
```

---

## Task 5: Wire logging into `main.py` (setup + middleware + global error handler)

**Files:**
- Modify: `bussola_api/app/main.py`

- [ ] **Step 1: Read the current main.py imports section carefully**

The file starts with `load_dotenv()` at line 35, then imports at lines 38–49.
We need to add logging setup right after `load_dotenv()` and before anything else logs.

- [ ] **Step 2: Add imports at the top of the imports block**

After the existing imports block (after line 49 `from app.db import base`), add:

```python
import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.logging_config import setup_logging
from app.api.middleware.logging_middleware import RequestLoggingMiddleware
```

- [ ] **Step 3: Call `setup_logging` right after `load_dotenv()`**

The current code at lines 32-36 is:
```python
from dotenv import load_dotenv
import os

load_dotenv()
# -------------------------------------
```

Change to:
```python
from dotenv import load_dotenv
import os

load_dotenv()

# Logging deve ser inicializado antes de qualquer outra importação que possa logar
from app.core.config import settings as _settings_for_logging
from app.core.logging_config import setup_logging
setup_logging(_settings_for_logging.LOG_LEVEL)
# -------------------------------------
```

- [ ] **Step 4: Add middleware registration after the CORS block**

After the existing CORS middleware block (after line 100), add:

```python
# --------------------------------------------------------------------------------------
# LOGGING DE REQUISIÇÕES
# --------------------------------------------------------------------------------------
app.add_middleware(RequestLoggingMiddleware)
```

- [ ] **Step 5: Add global exception handler after the rate limiter block**

After the line `app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)` (line 81), add:

```python
# --------------------------------------------------------------------------------------
# HANDLER GLOBAL DE ERROS
# --------------------------------------------------------------------------------------
_logger = logging.getLogger("api.main")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    _logger.critical(
        "Erro interno não tratado",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "error_type": type(exc).__name__,
            "error": str(exc),
        },
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor.", "request_id": request_id},
    )
```

- [ ] **Step 6: Smoke test — start the server and check log output**

```bash
cd bussola_api
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

In another terminal:
```bash
curl http://localhost:8000/
```

Expected in the server terminal: A JSON line with `"path": "/"`, `"status_code": 200`, `"service": "bussola_api"`.

- [ ] **Step 7: Commit**

```bash
git add bussola_api/app/main.py
git commit -m "feat(api): wire logging setup, middleware and global error handler"
```

---

## Task 6: Set up logger for the Discord bot

**Files:**
- Create: `bussola_bot/bot/logger.py`
- Modify: `bussola_bot/main.py`

- [ ] **Step 1: Create `bussola_bot/bot/logger.py`**

```python
# bussola_bot/bot/logger.py
import logging
import os
import sys
from pythonjsonlogger import jsonlogger


class BotJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record: dict, record: logging.LogRecord, message_dict: dict) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record["service"] = "bussola_bot"
        for field in ("token", "secret"):
            log_record.pop(field, None)


def setup_bot_logging() -> None:
    """
    Configura logging estruturado para o bot Discord.
    Deve ser chamada uma vez em main.py antes de iniciar o bot.
    """
    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    numeric_level = getattr(logging, log_level_str, logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(BotJsonFormatter())

    root = logging.getLogger()
    root.setLevel(numeric_level)
    root.handlers = [handler]

    # discord.py é muito verboso por padrão — mantém apenas WARNING
    logging.getLogger("discord").setLevel(logging.WARNING)
    logging.getLogger("discord.http").setLevel(logging.ERROR)
    logging.getLogger("aiohttp").setLevel(logging.WARNING)
```

- [ ] **Step 2: Check that `python-json-logger` exists in the bot's requirements**

```bash
cat bussola_bot/requirements.txt 2>/dev/null || echo "No requirements.txt found"
```

If the file doesn't exist or doesn't have `python-json-logger`, add it:

```bash
grep -q "python-json-logger" bussola_bot/requirements.txt || echo "python-json-logger==2.0.7" >> bussola_bot/requirements.txt
```

- [ ] **Step 3: Update `bussola_bot/main.py` to call `setup_bot_logging()`**

Current content of `main.py`:
```python
import asyncio
import os
from dotenv import load_dotenv
from bot.client import BussolaBot

load_dotenv(override=False)

async def main():
    bot = BussolaBot()
    async with bot:
        await bot.start(os.getenv("DISCORD_BOT_TOKEN"))

if __name__ == "__main__":
    asyncio.run(main())
```

Replace with:
```python
import asyncio
import os
from dotenv import load_dotenv

load_dotenv(override=False)

# Logging deve ser configurado antes de qualquer outra importação
from bot.logger import setup_bot_logging
setup_bot_logging()

from bot.client import BussolaBot


async def main():
    bot = BussolaBot()
    async with bot:
        await bot.start(os.getenv("DISCORD_BOT_TOKEN"))


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 4: Verify import**

```bash
cd bussola_bot
python -c "from bot.logger import setup_bot_logging; setup_bot_logging(); import logging; logging.getLogger('test').info('bot logger ok')"
```

Expected: A single JSON line with `"service": "bussola_bot"` and `"message": "bot logger ok"`.

- [ ] **Step 5: Commit**

```bash
git add bussola_bot/bot/logger.py bussola_bot/main.py
git commit -m "feat(bot): add centralized JSON logging setup"
```

---

## Task 7: Replace `print()` with logger in `client.py` and `webhook.py`

**Files:**
- Modify: `bussola_bot/bot/client.py`
- Modify: `bussola_bot/bot/webhook.py`

- [ ] **Step 1: Update `bussola_bot/bot/client.py`**

Current `on_ready` method (lines 40-43):
```python
    async def on_ready(self):
        print(f"✅ Bot online: {self.user} (ID: {self.user.id})")
        print(f"   API: {self.api_base_url}")
        print(f"   Frontend: {self.frontend_url}")
```

Replace the full file content as follows (add logger import at top, replace prints):

```python
import logging
import os
import discord
from discord.ext import commands

from bot.api_client import ApiClient
from bot.webhook import start_webhook_server

logger = logging.getLogger(__name__)

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

        webhook_port = int(os.getenv("BOT_WEBHOOK_PORT", "8001"))
        await start_webhook_server(self, webhook_port)

    async def on_ready(self):
        logger.info(
            "Bot online",
            extra={
                "bot_user": str(self.user),
                "bot_id": self.user.id,
                "api_base_url": self.api_base_url,
                "frontend_url": self.frontend_url,
            },
        )
```

- [ ] **Step 2: Update `bussola_bot/bot/webhook.py`**

Current line 54: `print(f"✅ Webhook server listening on :{port}")`

Add logger import at the top and replace the print:

```python
"""
Servidor HTTP interno do bot para receber notificações push da API.

A API chama POST /webhook/discord-linked após confirmar um vínculo,
eliminando a necessidade de polling periódico.
"""
import logging

from aiohttp import web

logger = logging.getLogger(__name__)


def create_webhook_app(bot) -> web.Application:
    app = web.Application()

    async def handle_discord_linked(request: web.Request) -> web.Response:
        token = request.headers.get("X-Bot-Service-Token", "")
        if token != bot.bot_service_token:
            logger.warning("Webhook: token de serviço inválido", extra={"client_ip": request.remote})
            return web.json_response({"error": "Unauthorized"}, status=401)

        try:
            data = await request.json()
            discord_id = int(data["discord_id"])
        except Exception as exc:
            logger.warning("Webhook: payload inválido", extra={"error": str(exc)})
            return web.json_response({"error": "Invalid payload"}, status=400)

        user = bot.get_user(discord_id)
        if user is None:
            try:
                user = await bot.fetch_user(discord_id)
            except Exception:
                user = None

        if user:
            try:
                await user.send(
                    "✅ **Conta vinculada com sucesso!**\n\n"
                    "Você já pode usar todos os comandos. "
                    "Digite `/start` para ver o que posso fazer."
                )
                logger.info("DM de confirmação enviada", extra={"discord_id": discord_id})
            except Exception:
                logger.warning("Falha ao enviar DM (DMs desativadas)", extra={"discord_id": discord_id})

        return web.json_response({"ok": True})

    app.router.add_post("/webhook/discord-linked", handle_discord_linked)
    return app


async def start_webhook_server(bot, port: int = 8001):
    app = create_webhook_app(bot)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logger.info("Webhook server iniciado", extra={"port": port})
```

- [ ] **Step 3: Commit**

```bash
git add bussola_bot/bot/client.py bussola_bot/bot/webhook.py
git commit -m "feat(bot): replace print() with structured logger in client and webhook"
```

---

## Task 8: Replace `print()` with logger in `cogs/auth.py`

**Files:**
- Modify: `bussola_bot/bot/cogs/auth.py`

- [ ] **Step 1: Update `bussola_bot/bot/cogs/auth.py`**

Add `import logging` and `logger = logging.getLogger(__name__)` at the top, then replace the three `print(...)` calls:

Line 61: `print(f"[start_command] Erro: {e}")` →
```python
logger.error("Erro no comando /start", extra={"discord_user_id": interaction.user.id, "error": str(e)}, exc_info=True)
```

Line 91: `print(f"[unlink_command] Erro: {e}")` →
```python
logger.error("Erro no comando /desvincular", extra={"discord_user_id": interaction.user.id, "error": str(e)}, exc_info=True)
```

Line 123: `print(f"[_start_link_flow] Erro: {e}")` →
```python
logger.error("Erro no fluxo de vinculação", extra={"discord_user_id": interaction.user.id, "error": str(e)}, exc_info=True)
```

The full updated file:

```python
import logging

import discord
from discord import app_commands
from discord.ext import commands

logger = logging.getLogger(__name__)

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

    # ------------------------------------------------------------------
    # Slash command: /start — ponto de entrada principal
    # ------------------------------------------------------------------

    @app_commands.command(name="start", description="Começar a usar o Bússola Bot")
    async def start_command(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        try:
            is_linked = await self.bot.api.check_link_status(str(interaction.user.id))

            if is_linked:
                await interaction.followup.send(
                    "✅ Sua conta já está vinculada! Use `/ajuda` para ver os comandos disponíveis.",
                    ephemeral=True,
                )
                return

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
            await interaction.followup.send(embed=embed, view=LinkView(self, interaction.user), ephemeral=True)
        except Exception as e:
            logger.error(
                "Erro no comando /start",
                extra={"discord_user_id": interaction.user.id, "error": str(e)},
                exc_info=True,
            )
            await interaction.followup.send("❌ Erro interno. Tente novamente.", ephemeral=True)

    # ------------------------------------------------------------------
    # Slash command: /link — gera novo link de vinculação
    # ------------------------------------------------------------------

    @app_commands.command(name="link", description="Vincule sua conta Bússola ao Discord")
    async def link_command(self, interaction: discord.Interaction):
        await self._start_link_flow(interaction)

    # ------------------------------------------------------------------
    # Slash command: /desvincular
    # ------------------------------------------------------------------

    @app_commands.command(name="desvincular", description="Remove o vínculo entre seu Discord e o Bússola")
    async def unlink_command(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        try:
            is_linked = await self.bot.api.check_link_status(str(interaction.user.id))
            if not is_linked:
                await interaction.followup.send("Sua conta não está vinculada.", ephemeral=True)
                return

            success = await self.bot.api.unlink_account(str(interaction.user.id))
            if success:
                await interaction.followup.send("✅ Conta desvinculada com sucesso.", ephemeral=True)
            else:
                await interaction.followup.send("❌ Erro ao desvincular. Tente novamente.", ephemeral=True)
        except Exception as e:
            logger.error(
                "Erro no comando /desvincular",
                extra={"discord_user_id": interaction.user.id, "error": str(e)},
                exc_info=True,
            )
            await interaction.followup.send("❌ Erro interno. Tente novamente.", ephemeral=True)

    # ------------------------------------------------------------------
    # Lógica interna de vinculação
    # ------------------------------------------------------------------

    async def _start_link_flow(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        try:
            discord_id = str(interaction.user.id)

            is_linked = await self.bot.api.check_link_status(discord_id)
            if is_linked:
                await interaction.followup.send("✅ Sua conta já está vinculada!", ephemeral=True)
                return

            token = await self.bot.api.generate_link_token(discord_id)
            if not token:
                await interaction.followup.send(
                    "❌ Erro ao gerar o link. Tente novamente em instantes.",
                    ephemeral=True,
                )
                return

            link_url = f"{self.bot.frontend_url}/discord/link?token={token}"
            await interaction.followup.send(
                f"🔗 Clique no link abaixo para vincular sua conta "
                f"**(válido por 10 minutos)**:\n{link_url}",
                ephemeral=True,
            )
        except Exception as e:
            logger.error(
                "Erro no fluxo de vinculação",
                extra={"discord_user_id": interaction.user.id, "error": str(e)},
                exc_info=True,
            )
            await interaction.followup.send("❌ Erro interno. Tente novamente.", ephemeral=True)


async def setup(bot: commands.Bot):
    await bot.add_cog(AuthCog(bot))
```

- [ ] **Step 2: Verify no `print(` remain in bot/**

```bash
grep -rn "print(" bussola_bot/
```

Expected: No output (zero matches).

- [ ] **Step 3: Commit**

```bash
git add bussola_bot/bot/cogs/auth.py
git commit -m "feat(bot): replace print() with structured logger in auth cog"
```

---

## Task 9: Create frontend logger utility

**Files:**
- Create: `bussola_web/src/utils/logger.ts`

- [ ] **Step 1: Create the file**

```typescript
// bussola_web/src/utils/logger.ts

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  service: "bussola_web";
  timestamp: string;
  context?: Record<string, unknown>;
}

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const configuredLevel = (import.meta.env.VITE_LOG_LEVEL ?? (import.meta.env.DEV ? "debug" : "warn")) as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[configuredLevel];
}

const SENSITIVE_KEYS = new Set(["password", "token", "secret", "authorization"]);

function sanitize(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    clean[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return clean;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    service: "bussola_web",
    timestamp: new Date().toISOString(),
    context: sanitize(context),
  };

  const fn =
    level === "error" ? console.error
    : level === "warn" ? console.warn
    : level === "debug" ? console.debug
    : console.info;

  fn(JSON.stringify(entry));
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
```

- [ ] **Step 2: Add `VITE_LOG_LEVEL` to frontend env example**

Check if there's a `.env.example` or `.env` in `bussola_web/`:

```bash
ls bussola_web/.env* 2>/dev/null
```

Add to `bussola_web/.env` (or create it if it doesn't exist):

```env
VITE_LOG_LEVEL=warn
```

- [ ] **Step 3: Commit**

```bash
git add bussola_web/src/utils/logger.ts bussola_web/.env
git commit -m "feat(web): add typed structured logger utility"
```

---

## Task 10: Create React ErrorBoundary component

**Files:**
- Create: `bussola_web/src/components/ErrorBoundary.tsx`

- [ ] **Step 1: Create the component**

```tsx
// bussola_web/src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "../utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Captura erros de renderização React que escapariam silenciosamente.
 * Loga o erro com stack trace completo e exibe uma UI de fallback.
 * Deve envolver o <App /> no main.jsx.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error("Erro de renderização React capturado pelo ErrorBoundary", {
      error_message: error.message,
      error_name: error.name,
      component_stack: info.componentStack ?? "",
      stack: error.stack ?? "",
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "16px",
            fontFamily: "sans-serif",
          }}
        >
          <h2>Algo deu errado.</h2>
          <p>Recarregue a página para tentar novamente.</p>
          <button onClick={() => window.location.reload()}>Recarregar</button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add bussola_web/src/components/ErrorBoundary.tsx
git commit -m "feat(web): add React ErrorBoundary with structured error logging"
```

---

## Task 11: Register ErrorBoundary in `main.jsx`

**Files:**
- Modify: `bussola_web/src/main.jsx`

- [ ] **Step 1: Update `main.jsx`**

Current content:
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.jsx'

import './assets/styles/global.css'
import 'weather-icons/css/weather-icons.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <App />
        </GoogleOAuthProvider>
    </React.StrictMode>,
)
```

Replace with:
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

import './assets/styles/global.css'
import 'weather-icons/css/weather-icons.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <App />
            </GoogleOAuthProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)
```

- [ ] **Step 2: Verify the build passes**

```bash
cd bussola_web
npm run build
```

Expected: Build completes without TypeScript/ESLint errors.

- [ ] **Step 3: Commit**

```bash
git add bussola_web/src/main.jsx
git commit -m "feat(web): wrap app with ErrorBoundary"
```

---

## Task 12: Replace `console.log/error/warn` with logger in `api.ts`

**Files:**
- Modify: `bussola_web/src/services/api.ts`

- [ ] **Step 1: Add the logger import at the top of `api.ts`**

After the existing `import axios from 'axios';` line, add:

```typescript
import { logger } from '../utils/logger';
```

- [ ] **Step 2: Replace console calls in the response interceptor**

Find the `catch (refreshError)` block (around lines 114-118) — it currently calls `handleLogout()` silently.
Add a log line before `handleLogout()`:

```typescript
            } catch (refreshError) {
                logger.error("Falha ao renovar token de acesso", {
                    url: originalRequest.url,
                });
                processQueue(refreshError, null);
                isRefreshing = false;
                handleLogout();
                return Promise.reject(refreshError);
            }
```

- [ ] **Step 3: Find and replace existing `console.error` and `console.warn` calls**

Search for all console calls in the file:

```bash
grep -n "console\." bussola_web/src/services/api.ts
```

For each one found, replace with the equivalent logger call. Typical pattern:

```typescript
// Before:
console.error("Erro no login:", error);
// After:
logger.error("Erro no login", { error: String(error) });

// Before:
console.warn("Erro logout:", error);
// After:
logger.warn("Erro no logout", { error: String(error) });
```

- [ ] **Step 4: Verify the build still passes**

```bash
cd bussola_web
npm run build
```

Expected: Build completes without errors.

- [ ] **Step 5: Commit**

```bash
git add bussola_web/src/services/api.ts
git commit -m "feat(web): replace console calls with structured logger in api.ts"
```

---

## Task 13: Update `nginx.conf` with JSON access log

**Files:**
- Modify: `bussola_web/nginx.conf`

- [ ] **Step 1: Replace the full `nginx.conf`**

```nginx
# Formato de log JSON — uma linha por requisição, legível no Coolify
log_format json_combined escape=json
  '{'
    '"timestamp":"$time_iso8601",'
    '"service":"nginx",'
    '"method":"$request_method",'
    '"path":"$request_uri",'
    '"status":$status,'
    '"bytes_sent":$body_bytes_sent,'
    '"duration_ms":"$request_time",'
    '"client_ip":"$remote_addr",'
    '"upstream":"$upstream_addr"'
  '}';

server {
    listen 80;

    # Onde estão os arquivos do React buildado
    root /usr/share/nginx/html;
    index index.html;

    access_log /dev/stdout json_combined;
    error_log /dev/stderr warn;

    # Configuração para SPA (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy Reverso para a API (Backend)
    location /api/ {
        resolver 127.0.0.11 valid=30s ipv6=off;
        set $backend http://bussola_backend:8000;
        proxy_pass $backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-ID $request_id;
    }
}
```

- [ ] **Step 2: Validate nginx config syntax (if nginx is available locally)**

```bash
nginx -t -c $(pwd)/bussola_web/nginx.conf 2>/dev/null || echo "nginx not available locally — will be tested in Docker"
```

- [ ] **Step 3: Commit**

```bash
git add bussola_web/nginx.conf
git commit -m "feat(nginx): add structured JSON access log for Coolify visibility"
```

---

## Task 14: Update `docker-compose.yml` with logging driver and `LOG_LEVEL`

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Replace `docker-compose.yml` with the updated version**

```yaml
services:
  bussola_backend:
    build: ./bussola_api
    container_name: bussola_backend
    env_file:
      - ./bussola_api/.env
    environment:
      - TZ=America/Sao_Paulo
      - BOT_WEBHOOK_URL=http://bussola_bot:8001
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
    volumes:
      - ./bussola_api/data:/app/data
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
    networks:
      - internal
      - coolify

  frontend:
    build: ./bussola_web
    container_name: bussola_frontend
    restart: unless-stopped
    depends_on:
      - bussola_backend
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "3"
    networks:
      - internal
      - coolify

  bussola_bot:
    build: ./bussola_bot
    container_name: bussola_bot
    environment:
      - TZ=America/Sao_Paulo
      - API_BASE_URL=http://bussola_backend:8000
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
      - BOT_SERVICE_TOKEN=${BOT_SERVICE_TOKEN}
      - FRONTEND_URL=${FRONTEND_URL}
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
    restart: unless-stopped
    depends_on:
      - bussola_backend
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "3"
    networks:
      - internal
      - coolify

networks:
  internal:
    driver: bridge
  coolify:
    external: true
```

- [ ] **Step 2: Validate compose file syntax**

```bash
docker compose config
```

Expected: Outputs the merged/validated config without errors.

- [ ] **Step 3: Test with Docker build**

```bash
docker compose up -d --build
docker compose logs --tail=20 bussola_backend
```

Expected: JSON-formatted log lines from the API in the output.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): add LOG_LEVEL env var and json-file logging driver to all services"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task(s) |
|---|---|
| JSON estruturado | Tasks 3, 6, 9 |
| Níveis de log por ambiente | Tasks 2, 6, 9 |
| Correlation/request ID | Task 4 (X-Request-ID header) |
| Middleware de request/response | Tasks 4, 5 |
| Handler global de erros | Task 5 |
| Bot: substituir print() | Tasks 7, 8 |
| Frontend: logger centralizado | Task 9 |
| Frontend: captura de erros globais | Tasks 10, 11 |
| Frontend: substituir console calls | Task 12 |
| Nginx access log estruturado | Task 13 |
| Docker logging driver | Task 14 |
| LOG_LEVEL por environment | Tasks 2, 6, 9, 14 |
| Dados sensíveis não logados | Tasks 3, 6, 9 |

### Placeholder scan

None found — all steps contain complete code.

### Type consistency

- `logger.ts` exports `logger` object — referenced as `logger` in `api.ts` (Task 12) ✓
- `ErrorBoundary` exported as named export — imported with `{ ErrorBoundary }` in `main.jsx` (Task 11) ✓
- `setup_logging()` defined in `logging_config.py` — called in `main.py` (Task 5) ✓
- `setup_bot_logging()` defined in `bot/logger.py` — called in `main.py` (Task 6) ✓
- `RequestLoggingMiddleware` defined in `middleware/logging_middleware.py` — imported in `main.py` (Task 5) ✓
