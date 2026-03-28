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
