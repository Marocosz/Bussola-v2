"""Tools de perfil: quem é o usuário e que dia é hoje (base para datas relativas)."""

from typing import Any

from app.core.timezone import PROJECT_TIMEZONE, now_local
from app.mcp.context import usuario_e_db
from app.mcp.tools import registrar

DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def meu_perfil() -> dict[str, Any]:
    """Nome, email e cidade do usuário e a data/hora atual no fuso dele.
    Chame antes de interpretar datas relativas ("amanhã", "mês passado")."""
    with usuario_e_db() as (db, user):
        agora = now_local()
        return {
            "nome": user.full_name,
            "email": user.email,
            "cidade": user.city,
            "agora": agora.strftime("%Y-%m-%dT%H:%M"),
            "hoje": agora.date().isoformat(),
            "dia_semana": DIAS[agora.weekday()],
            "fuso": str(PROJECT_TIMEZONE),
        }


def register(mcp):
    registrar(mcp, leitura=(meu_perfil,))
