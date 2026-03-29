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
