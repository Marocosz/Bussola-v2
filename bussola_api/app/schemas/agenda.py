from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

class CompromissoBase(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    local: Optional[str] = None
    data_hora: datetime
    lembrete: bool = False

class CompromissoCreate(CompromissoBase):
    pass

class CompromissoUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    local: Optional[str] = None
    data_hora: Optional[datetime] = None
    lembrete: Optional[bool] = None
    status: Optional[str] = None

class CompromissoResponse(CompromissoBase):
    id: int
    status: str
    class Config:
        from_attributes = True

# Schemas para o Calendário Visual
class CalendarDay(BaseModel):
    type: str = "day" # 'day' ou 'month_divider'
    full_date: Optional[str] = None # YYYY-MM-DD
    day_number: Optional[str] = None
    weekday_short: Optional[str] = None
    is_today: bool = False
    
    # --- CAMPO ADICIONADO ---
    is_padding: bool = False 
    # ------------------------

    compromissos: List[Dict[str, Any]] = [] # Lista simplificada para o tooltip
    
    # Campos apenas para o divisor
    month_name: Optional[str] = None
    year: Optional[int] = None

class AgendaDashboardResponse(BaseModel):
    compromissos_por_mes: Dict[str, List[CompromissoResponse]]
    calendar_days: List[CalendarDay]