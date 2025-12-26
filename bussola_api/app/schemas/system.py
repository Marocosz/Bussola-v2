"""
=======================================================================================
ARQUIVO: system.py (Schema de Configuração do Sistema)
=======================================================================================

OBJETIVO:
    Expor configurações públicas do backend para o frontend.
    Permite que a UI se adapte dinamicamente (ex: esconder botão Google Login se desativado).
=======================================================================================
"""

from pydantic import BaseModel

class SystemConfig(BaseModel):
    deployment_mode: str # 'SAAS' ou 'SELF_HOSTED'
    public_registration: bool
    google_login_enabled: bool
    discord_login_enabled: bool
    stripe_enabled: bool
    version: str = "2.0.0"