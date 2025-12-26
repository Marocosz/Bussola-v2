"""
=======================================================================================
ARQUIVO: agenda.py (Modelo de Dados - Agenda/Calendário)
=======================================================================================

OBJETIVO:
    Definir a estrutura de persistência para eventos e compromissos temporais.

PARTE DO SISTEMA:
    Backend / Database Layer.

RESPONSABILIDADES:
    1. Armazenar dados de eventos (título, local, data).
    2. Gerenciar o status do ciclo de vida do compromisso (Pendente/Realizado).
    3. Garantir isolamento de dados por usuário (Multi-tenancy).

COMUNICAÇÃO:
    - Relaciona-se diretamente com: app.models.user.User.
    - Utilizado por: Services de agendamento e Workers de notificação (Lembretes).
=======================================================================================
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base_class import Base

class Compromisso(Base):
    """
    Representa um item único na agenda do usuário.
    """
    __tablename__ = 'compromisso'

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    descricao = Column(Text, nullable=True)
    local = Column(String(200), nullable=True)
    
    # Armazena o timestamp exato do evento. 
    # Essencial para ordenação e disparo de triggers de notificação.
    data_hora = Column(DateTime, nullable=False) 
    
    # Flag lógica para indicar se o Worker de notificações deve processar este item.
    lembrete = Column(Boolean, default=False)
    
    # Controle de Estado (Regra de Negócio):
    # - 'Pendente': Estado inicial.
    # - 'Realizado': Concluído pelo usuário.
    # - 'Perdido': Data passou e não foi concluído (lógica aplicada via cron/job).
    status = Column(String(50), default='Pendente')

    # [SEGURANÇA / MULTI-TENANCY]
    # O vínculo obrigatório com User garante que nenhum compromisso seja "órfão"
    # e permite filtrar queries estritamente pelo ID do usuário logado.
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    user = relationship("User", back_populates="compromissos")