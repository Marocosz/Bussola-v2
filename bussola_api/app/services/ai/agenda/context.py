from pydantic import BaseModel, Field, computed_field
from typing import List, Optional
from datetime import datetime

class TaskItemContext(BaseModel):
    """
    Representação blindada de uma tarefa para análise da IA.
    Removemos dados sensíveis ou inúteis para economizar tokens.
    """
    id: int
    titulo: str
    descricao: Optional[str] = Field(None, description="Descrição curta se houver")
    prioridade: str = Field(..., description="'alta', 'media' ou 'baixa'")
    status: str = Field(..., description="'pendente', 'concluida', etc")
    
    # Datas em formato ISO (YYYY-MM-DD)
    data_vencimento: Optional[str] = None
    created_at: str 
    
    # Flags Booleanas ajudam a IA a raciocinar mais rápido
    has_subtasks: bool = False
    
    # Campo opcional para categorização (ex: 'trabalho', 'pessoal')
    categoria: Optional[str] = "geral"

class AgendaContext(BaseModel):
    """
    O Contexto Global da Agenda.
    Fundamental para o 'Time Strategist' e 'Flow Architect' entenderem o TEMPO.
    """
    user_id: int
    
    # Contexto Temporal Absoluto
    data_atual: str       # Ex: "2025-10-27"
    hora_atual: str       # Ex: "18:30" (Fundamental para regra das 18h)
    dia_semana: str       # Ex: "Sexta-feira"
    
    # Janela de Análise (Geralmente 30 dias para frente)
    tarefas: List[TaskItemContext] = Field(default_factory=list)
    
    # Metadados de Produtividade
    foco_do_dia: Optional[str] = Field(None, description="O 'Big Rock' do usuário")
    
    @computed_field
    def total_pendentes(self) -> int:
        return len([t for t in self.tarefas if t.status != 'concluida'])