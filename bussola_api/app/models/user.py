from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    # =========================================================
    # RELACIONAMENTOS (MÓDULOS EXISTENTES)
    # =========================================================
    # (Seus outros relacionamentos de Finanças/Agenda ficam aqui, 
    # o SQLAlchemy os identifica automaticamente se estiverem definidos lá nos outros arquivos)

    # =========================================================
    # NOVOS RELACIONAMENTOS (MÓDULO RITMO)
    # =========================================================
    # Estes campos criam o vínculo "Pai -> Filhos".
    # O cascade="all, delete-orphan" garante que, se você excluir um Usuário,
    # o banco apaga automaticamente os treinos, dietas e dados corporais dele.

    ritmo_bios = relationship("RitmoBio", back_populates="user", cascade="all, delete-orphan")
    ritmo_planos = relationship("RitmoPlanoTreino", back_populates="user", cascade="all, delete-orphan")
    ritmo_dietas = relationship("RitmoDietaConfig", back_populates="user", cascade="all, delete-orphan")