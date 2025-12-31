"""
=======================================================================================
ARQUIVO: app/core/timezone.py
=======================================================================================
Autoridade central para manipulação de tempo e fusos horários.
"""
from datetime import datetime
import pytz

# Configuração Global
# Altere aqui se o projeto mudar de país, o resto do sistema se adapta automaticamente.
PROJECT_TIMEZONE = pytz.timezone('America/Sao_Paulo')
UTC = pytz.utc

def now_utc() -> datetime:
    """Retorna o momento atual em UTC (Padrão para salvar no Banco)."""
    return datetime.now(UTC)

def now_local() -> datetime:
    """Retorna o momento atual no fuso do projeto (Para logs e debug)."""
    return datetime.now(PROJECT_TIMEZONE)

def to_utc(dt: datetime) -> datetime:
    """
    Converte qualquer datetime para UTC.
    Se o datetime não tiver fuso (naive), assume que ele é do fuso do projeto.
    """
    if dt is None:
        return None
        
    if dt.tzinfo is None:
        # Se veio sem fuso, assumimos que é o horário local do Brasil
        dt = PROJECT_TIMEZONE.localize(dt)
        
    return dt.astimezone(UTC)

def to_local(dt: datetime) -> datetime:
    """
    Converte datetime (geralmente UTC do banco) para o fuso do projeto (Brasil).
    Essencial para a IA entender 'Manhã', 'Tarde', 'Noite'.
    """
    if dt is None:
        return None
        
    if dt.tzinfo is None:
        # Se o banco salvou sem timezone (naive), assumimos que foi salvo em UTC
        dt = UTC.localize(dt)
        
    return dt.astimezone(PROJECT_TIMEZONE)

def format_iso(dt: datetime) -> str:
    """Retorna string ISO 8601 limpa para o Frontend/IA."""
    return dt.isoformat()