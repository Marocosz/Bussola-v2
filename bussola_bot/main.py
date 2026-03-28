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
