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
