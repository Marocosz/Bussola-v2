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
                self._welcomed.add(user.id)
                await user.send(
                    "✅ **Conta vinculada com sucesso!**\n\n"
                    "Você já pode usar todos os comandos. "
                    "Digite `/ajuda` para ver o que está disponível."
                )
                return
        # Timeout silencioso — o link expirou, usuário pode usar /link novamente


async def setup(bot: commands.Bot):
    await bot.add_cog(AuthCog(bot))
