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

    # ------------------------------------------------------------------
    # Slash command: /start — ponto de entrada principal
    # ------------------------------------------------------------------

    @app_commands.command(name="start", description="Começar a usar o Bússola Bot")
    async def start_command(self, interaction: discord.Interaction):
        """Exibe boas-vindas se não vinculado, ou confirma se já estiver vinculado."""
        await interaction.response.defer(ephemeral=True)

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

        is_linked = await self.bot.api.check_link_status(str(interaction.user.id))
        if not is_linked:
            await interaction.followup.send("Sua conta não está vinculada.", ephemeral=True)
            return

        success = await self.bot.api.unlink_account(str(interaction.user.id))
        if success:
            await interaction.followup.send("✅ Conta desvinculada com sucesso.", ephemeral=True)
        else:
            await interaction.followup.send("❌ Erro ao desvincular. Tente novamente.", ephemeral=True)

    # ------------------------------------------------------------------
    # Lógica interna de vinculação
    # ------------------------------------------------------------------

    async def _start_link_flow(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

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


async def setup(bot: commands.Bot):
    await bot.add_cog(AuthCog(bot))
