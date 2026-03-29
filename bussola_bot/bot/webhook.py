"""
Servidor HTTP interno do bot para receber notificações push da API.

A API chama POST /webhook/discord-linked após confirmar um vínculo,
eliminando a necessidade de polling periódico.
"""

from aiohttp import web


def create_webhook_app(bot) -> web.Application:
    app = web.Application()

    async def handle_discord_linked(request: web.Request) -> web.Response:
        token = request.headers.get("X-Bot-Service-Token", "")
        if token != bot.bot_service_token:
            return web.json_response({"error": "Unauthorized"}, status=401)

        try:
            data = await request.json()
            discord_id = int(data["discord_id"])
        except Exception:
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
            except Exception:
                pass  # DMs podem estar desativadas

        return web.json_response({"ok": True})

    app.router.add_post("/webhook/discord-linked", handle_discord_linked)
    return app


async def start_webhook_server(bot, port: int = 8001):
    app = create_webhook_app(bot)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    print(f"✅ Webhook server listening on :{port}")
