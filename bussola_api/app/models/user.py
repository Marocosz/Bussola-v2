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
    # RELACIONAMENTOS GERAIS
    # =========================================================
    compromissos = relationship("Compromisso", back_populates="user", cascade="all, delete-orphan")
    segredos = relationship("Segredo", back_populates="user", cascade="all, delete-orphan")
    
    categorias_financas = relationship("Categoria", back_populates="user", cascade="all, delete-orphan")
    transacoes = relationship("Transacao", back_populates="user", cascade="all, delete-orphan")
    
    grupos_anotacao = relationship("GrupoAnotacao", back_populates="user", cascade="all, delete-orphan")
    anotacoes = relationship("Anotacao", back_populates="user", cascade="all, delete-orphan")
    tarefas = relationship("Tarefa", back_populates="user", cascade="all, delete-orphan")

    # =========================================================
    # RELACIONAMENTOS RITMO
    # =========================================================
    ritmo_bios = relationship("RitmoBio", back_populates="user", cascade="all, delete-orphan")
    ritmo_planos = relationship("RitmoPlanoTreino", back_populates="user", cascade="all, delete-orphan")
    ritmo_dietas = relationship("RitmoDietaConfig", back_populates="user", cascade="all, delete-orphan")