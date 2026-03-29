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
