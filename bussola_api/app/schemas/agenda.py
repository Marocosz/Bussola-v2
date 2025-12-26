"""
=======================================================================================
ARQUIVO: agenda.py (Schemas - Agenda/Calendário)
=======================================================================================

OBJETIVO:
    Definir os contratos de dados (DTOs) para entrada e saída da API de Agenda.
    Inclui suporte para operações CRUD e visualização de calendário.

PARTE DO SISTEMA:
    Backend / API Layer (Serialização).
=======================================================================================
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

class CompromissoBase(BaseModel):
    """Campos comuns para criação e leitura."""
    titulo: str
    descricao: Optional[str] = None
    local: Optional[str] = None
    data_hora: datetime
    lembrete: bool = False

class CompromissoCreate(CompromissoBase):
    """Schema para criação (POST)."""
    pass

class CompromissoUpdate(BaseModel):
    """Schema para atualização (PATCH/PUT). Todos os campos opcionais."""
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    local: Optional[str] = None
    data_hora: Optional[datetime] = None
    lembrete: Optional[bool] = None
    status: Optional[str] = None

class CompromissoResponse(CompromissoBase):
    """Schema de resposta completa (GET)."""
    id: int
    status: str
    class Config:
        from_attributes = True

# --------------------------------------------------------------------------------------
# CALENDÁRIO VISUAL
# --------------------------------------------------------------------------------------

class CalendarDay(BaseModel):
    """
    Representa um dia no grid do calendário frontend.
    Pode ser um dia real ('day') ou um divisor de mês ('month_divider').
    """
    type: str = "day" 
    full_date: Optional[str] = None # Formato ISO YYYY-MM-DD
    day_number: Optional[str] = None
    weekday_short: Optional[str] = None
    is_today: bool = False
    
    # is_padding: Indica se é um dia vazio no início/fim do mês para completar a grade visual.
    is_padding: bool = False 

    # Lista leve de eventos para exibição rápida (tooltips/dots).
    compromissos: List[Dict[str, Any]] = [] 
    
    # Metadados para divisores
    month_name: Optional[str] = None
    year: Optional[int] = None

class AgendaDashboardResponse(BaseModel):
    """Payload agregado para a tela inicial da Agenda."""
    compromissos_por_mes: Dict[str, List[CompromissoResponse]]
    calendar_days: List[CalendarDay]