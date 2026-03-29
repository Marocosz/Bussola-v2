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
